#!/usr/bin/env python3
"""Audit generated programs locally; no API calls and no secret reads."""
import argparse
import json
import re
from datetime import date
from pathlib import Path
import pipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--program', choices=sorted(pipeline.PROGRAMS), default='A01')
    parser.add_argument('--complete', action='store_true', help='all configured layers must PASS')
    args = parser.parse_args()
    pipeline.select_program(args.program)
    prefix = f'{args.program}-'
    failures, summary = [], []
    for state_path in sorted((pipeline.OUT / 'audit').glob(f'{prefix}*.json')):
        state = json.loads(state_path.read_text())
        item = state['chapter_id']
        if state['status'] != 'pass':
            failures.append(f'{item}: {state["status"]}')
            continue
        path = pipeline.ROOT / state['target']
        if not path.exists() or pipeline.digest(path.read_text()) != state['published_hash']:
            failures.append(f'{item}: published hash mismatch')
            continue
        final = state['history'][-1]
        reviews_ok = not final['local_issues'] and all(pipeline.passed(pipeline.Review.model_validate(review)) for review in final['reviews'].values())
        comparison = final.get('golden_sample_comparison')
        comparison_ok = comparison is None or pipeline.comparative_passed(pipeline.ComparativeReview.model_validate(comparison))
        if final['stage'] != 'edited' or not reviews_ok or not comparison_ok:
            failures.append(f'{item}: final editorial or Golden parity gate failed')
        draft = pipeline.Draft.model_validate(state['final_draft'])
        minimum = 1500 if '-D' in item else 3000
        failures.extend(f'{item}: {issue}' for issue in pipeline.validate_draft(draft, minimum))
        for year, month, day, weekday in re.findall(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*([월화수목금토일])요일', draft.markdown):
            try:
                if '월화수목금토일'[date(int(year), int(month), int(day)).weekday()] != weekday:
                    failures.append(f'{item}: calendar weekday mismatch {year}-{month}-{day}')
            except ValueError:
                failures.append(f'{item}: invalid calendar date')
        summary.append({'id': item, 'characters': len(draft.markdown), 'revisions': state['revision_count'], 'calculations': len(draft.calculations), 'golden_parity': comparison.get('overall_parity') if comparison else None})
    if args.complete:
        required = {f'{args.program}-{number}' for number in range(1, len(pipeline.TITLES) + 1)} | {f'{args.program}-D{number:02}' for number in range(1, len(pipeline.DRILLS) + 1)} | {f'{args.program}-C01'}
        missing = required - {row['id'] for row in summary}
        failures.extend(f'{item}: required PASS document missing' for item in sorted(missing))
    for path in pipeline.OUT.rglob('*.md'):
        for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', path.read_text()):
            if not link.startswith(('https:', 'http:', '#')) and not (path.parent / link.split('#')[0]).exists():
                failures.append(f'{path.relative_to(pipeline.ROOT)}: broken link {link}')
    print(json.dumps({'program': args.program, 'passed_documents': summary, 'issues': failures}, ensure_ascii=False, indent=2))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())

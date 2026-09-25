#!/usr/bin/env python3
"""Audit only generated A01; no API calls, no secret reads."""
import json
import argparse
import re
from datetime import date
from pathlib import Path
from pipeline import OUT, ROOT, Draft, Review, digest, passed, validate_draft

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--complete', action='store_true', help='9 chapters + 8 drills + 1 case required')
    args = parser.parse_args()
    failures = []
    summary = []
    for state_path in sorted((OUT / 'audit').glob('A01-*.json')):
        state = json.loads(state_path.read_text())
        item = state['chapter_id']
        if state['status'] != 'pass':
            failures.append(f'{item}: {state["status"]}')
            continue
        path = ROOT / state['target']
        if not path.exists() or digest(path.read_text()) != state['published_hash']:
            failures.append(f'{item}: published hash mismatch')
            continue
        final = state['history'][-1]
        if final['stage'] != 'edited' or final['local_issues'] or not all(passed(Review.model_validate(r)) for r in final['reviews'].values()):
            failures.append(f'{item}: final editorial gate failed')
        draft = Draft.model_validate(state['final_draft'])
        failures.extend(f'{item}: {x}' for x in validate_draft(draft, 1500 if '-D' in item else 3000))
        for year, month, day, weekday in re.findall(r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*([월화수목금토일])요일', draft.markdown):
            try:
                actual = '월화수목금토일'[date(int(year), int(month), int(day)).weekday()]
                if actual != weekday:
                    failures.append(f'{item}: calendar weekday mismatch {year}-{month}-{day}')
            except ValueError:
                failures.append(f'{item}: invalid calendar date')
        summary.append({'id': item, 'characters': len(draft.markdown), 'revisions': state['revision_count'], 'calculations': len(draft.calculations)})
    if args.complete:
        required = {f'A01-{i}' for i in range(1,10)} | {f'A01-D{i:02}' for i in range(1,9)} | {'A01-C01'}
        missing = required - {row['id'] for row in summary}
        failures.extend(f'{item}: required PASS document missing' for item in sorted(missing))
    for path in OUT.rglob('*.md'):
        for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', path.read_text()):
            if not link.startswith(('https:', 'http:', '#')) and not (path.parent / link.split('#')[0]).exists():
                failures.append(f'{path.relative_to(ROOT)}: broken link {link}')
    print(json.dumps({'passed_documents': summary, 'issues': failures}, ensure_ascii=False, indent=2))
    return bool(failures)

if __name__ == '__main__':
    raise SystemExit(main())

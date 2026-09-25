#!/usr/bin/env python3
"""Build a curated, commit-safe run report from local audit artifacts."""
import argparse
import json
from collections import Counter
import pipeline


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('program', choices=sorted(pipeline.PROGRAMS), nargs='?', default='A01')
    args = parser.parse_args()
    pipeline.select_program(args.program)
    prefix = f'{args.program}-'
    states = [json.loads(p.read_text()) for p in sorted((pipeline.OUT / 'audit').glob(f'{prefix}*.json'))]
    archives = [json.loads(p.read_text()) for p in (pipeline.OUT / 'audit/archive').glob(f'{prefix}*.json')]
    calls = [json.loads(p.read_text()) for p in (pipeline.OUT / 'audit/calls').glob('*.json')]
    roles = Counter(call['role'] for call in calls)
    usage = Counter()
    for call in calls:
        for key in ('input_tokens', 'output_tokens', 'total_tokens'):
            usage[key] += call['usage'].get(key, 0)

    lines = [f'# {args.program} 실행 보고', '', '이 보고서는 로컬 감사 이력에서 만든 커밋 안전 요약본이다. API 원문 응답·초안·상세 검수 trace는 저장소에 포함하지 않는다.', '', '## 산출물', '', '| ID | 상태 | 본문 글자 수 | 재작성 횟수 | Golden parity |', '|---|---|---:|---:|---|']
    for state in states:
        final = state.get('history', [])[-1] if state.get('history') else {}
        comparison = final.get('golden_sample_comparison', {})
        parity = comparison.get('overall_parity', '해당 없음')
        revisions = state.get('revision_count', 0) + sum(archive.get('revision_count', 0) for archive in archives if archive['chapter_id'] == state['chapter_id'])
        lines.append(f'| {state["chapter_id"]} | {state["status"]} | {len(state.get("final_draft", {}).get("markdown", ""))} | {revisions} | {parity} |')
    lines += ['', '## API 역할과 호출', '']
    lines += [f'- {role}: {count}회' for role, count in sorted(roles.items())]
    versions = ', '.join(sorted(set(call.get('prompt_version', 'unknown') for call in calls))) or '호출 없음'
    lines += ['', f'- 실행 Prompt version: {versions}', f'누적 입력 토큰 {usage["input_tokens"]:,}, 출력 토큰 {usage["output_tokens"]:,}, 합계 {usage["total_tokens"]:,}.', '']

    unresolved = [state for state in states if state.get('status') != 'pass']
    lines += ['## 재현성 판정', '']
    if unresolved:
        lines += [f'**판정: 보류.** {", ".join(state["chapter_id"] for state in unresolved)}이(가) PASS하지 않아 후속 Layer 2·Layer 3 및 전체 확장을 시작하지 않는다.', '', '## 수동 검토 필요 사항', '']
        for state in unresolved:
            last = state.get('history', [])[-1] if state.get('history') else {}
            issues = []
            for review in last.get('reviews', {}).values():
                issues.extend(review.get('critical_issues', []) + review.get('numerical_issues', []) + review.get('unsupported_claims', []))
            comparison = last.get('golden_sample_comparison', {})
            issues.extend(comparison.get('critical_issues', []))
            lines += [f'### {state["chapter_id"]}', ''] + [f'- {issue}' for issue in dict.fromkeys(issues)] + ['']
        if args.program == 'A02':
            lines += ['## 후속 조치', '', 'A02 Prompt version을 `a02-v2`로 올렸다. Golden Reference는 전체 본문 대신 짧은 발췌만 전달하고, A01의 현장·시간축·Crew·수치·병목 사건·문장 구조 재사용을 명시적으로 금지한다. 그러나 현재 원고는 자동 수정 한도에 도달했으므로, 구체적인 수동 수정 명세를 검토·승인하기 전에는 재실행하지 않는다.', '']
    else:
        lines += ['**판정: 통과.** Layer 1·Layer 2·Layer 3, Golden parity, 수치 일관성, 미해결 manual review를 모두 별도 검증한다.', '']
    lines += ['## 재사용', '', '[A01 Golden Sample](../a01/README.md) · [실행 방법](../../tools/authoring/README.md)', '']
    pipeline.save(pipeline.OUT / 'REPORT.md', '\n'.join(lines))
    print(pipeline.OUT / 'REPORT.md')


if __name__ == '__main__':
    main()

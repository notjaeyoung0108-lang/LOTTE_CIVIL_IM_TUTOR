#!/usr/bin/env python3
"""Build an evidence-based run report from audit artifacts; no API calls."""
import json
from collections import Counter
from pipeline import OUT, save

def main():
    states = [json.loads(p.read_text()) for p in sorted((OUT/'audit').glob('A01-*.json'))]
    archives = [json.loads(p.read_text()) for p in (OUT/'audit/archive').glob('A01-*.json')]
    calls = [json.loads(p.read_text()) for p in (OUT/'audit/calls').glob('*.json')]
    roles = Counter(c['role'] for c in calls)
    usage = Counter()
    for c in calls:
        for k in ('input_tokens','output_tokens','total_tokens'):
            usage[k] += c['usage'].get(k, 0)
    lines = ['# A01 실행 보고', '', '이 보고는 저장된 API 응답과 검수 이력에서 생성합니다. PASS만 최종 교재에 반영합니다.', '', '## 산출물', '', '| ID | 상태 | 본문 글자 수 | 재작성 횟수 |', '|---|---|---:|---:|']
    for s in states:
        lines.append(f'| {s["chapter_id"]} | {s["status"]} | {len(s.get("final_draft",{}).get("markdown",""))} | {s["revision_count"] + sum(a["revision_count"] for a in archives if a["chapter_id"]==s["chapter_id"])} |')
    lines += ['', '## API 역할과 호출', '']
    lines += [f'- {role}: {count}회' for role, count in sorted(roles.items())]
    lines += ['', f'누적 입력 토큰 {usage["input_tokens"]:,}, 출력 토큰 {usage["output_tokens"]:,}, 합계 {usage["total_tokens"]:,}. reasoning 토큰은 API가 보고한 출력 토큰에 포함됩니다. 재사용된 캐시는 새 호출로 집계하지 않습니다.', '', '## 검수에서 발견해 수정한 주요 문제', '', '아래는 이전 초안에서 검수로 발견된 내용이며, 최종 발행본은 다시 모든 게이트를 통과한 버전이다.', '']
    for s in archives + states:
        issues = []
        for h in s['history']:
            for r in h['reviews'].values():
                issues += r['critical_issues'] + r['numerical_issues']
        issues = list(dict.fromkeys(issues))
        if issues:
            lines += [f'### {s["chapter_id"]}', ''] + [f'- {v}' for v in issues[:8]] + ['']
    manual_specs = sorted((OUT / 'manual-review').glob('A01-*.md'))
    if manual_specs:
        lines += ['## 수동 검토 후 수정 실행', '', '자동 재작성은 실행별 최대 3회로 유지했습니다. 한도 도달 원고는 needs_manual_review로 남긴 뒤 구체적인 수동 검토 명세를 작성한 경우에만 별도 수정 실행을 했습니다. 원래 실패 이력은 audit/archive에 보존하며 수정본에도 모든 검수 게이트를 적용합니다. 위 재작성 횟수는 보존된 이전 실행을 합산합니다.', '']
        lines += [f'- [{path.stem} 수정 명세](manual-review/{path.name})' for path in manual_specs]
        lines.append('')
    manual = [s['chapter_id'] for s in states if s['status'] != 'pass']
    lines += ['## 남은 검토', '', '검수 미완료: ' + (', '.join(manual) if manual else '실행된 문서 중 없음.'), '', '기존 미추적 `docs/field/tasks`에는 미존재 F01/F02 등 CASE 및 README 링크가 있어 기존 전체 `node tools/validate.js` 검증이 실패합니다. 해당 작업 중 파일은 수정하지 않았습니다. 신규 A01은 별도 `python3 tools/authoring/validate.py`로 검증합니다.', '', '## 재사용', '', '[전체 목차](README.md) · [실행 명령과 설정](../../tools/authoring/README.md) · [구조 설계](DESIGN.md)', '']
    save(OUT/'REPORT.md', '\n'.join(lines))
    print('docs/a01/REPORT.md')

if __name__ == '__main__':
    main()

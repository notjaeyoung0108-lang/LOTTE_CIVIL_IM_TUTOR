# GPT API 교재 제작

저장소 루트에서 실행합니다. `.env`의 `OPENAI_API`를 우선 사용하고 없으면 `OPENAI_API_KEY`를 사용합니다. 둘 다 없으면 종료합니다. 키 값은 출력하지 않습니다. `.env`는 Git에서 제외합니다.

```sh
python3 -m pip install -r tools/authoring/requirements.txt
python3 tools/authoring/pipeline.py generate A01-4 --dry-run
python3 tools/authoring/pipeline.py generate A01-4
python3 tools/authoring/pipeline.py generate A01
python3 tools/authoring/pipeline.py curriculum A02
python3 tools/authoring/pipeline.py generate A02-4
python3 tools/authoring/pipeline.py generate A02
python3 tools/authoring/pipeline.py generate-drills A02
python3 tools/authoring/pipeline.py generate-case A02
python3 tools/authoring/pipeline.py review A01-4
python3 tools/authoring/pipeline.py generate-drills A01
python3 tools/authoring/pipeline.py generate-case A01
python3 tools/authoring/pipeline.py index
python3 -m unittest discover -s tools/authoring/tests -v
```

`generate A01` 또는 `generate A02`는 각각 `-4` 파일럿을 먼저 검증하며 실패 시 멈춥니다. 성공한 요청과 PASS 발행본을 캐시하여 재실행으로 이어갈 수 있습니다. `--dry-run`은 API·파일 변경 없이 소스/역할/설정을 보여줍니다. `review`는 기존 최종 원고를 검수 흐름에 다시 넣습니다. 동일 검수 요청이면 API 응답을 재사용합니다. 프롬프트 변경 시 해시가 달라져 다시 검수합니다.

설정은 `config.json`, 프롬프트는 `prompts/*.md`입니다. `AUTHORING_MODEL`, `AUTHORING_MODEL_FIELD_WRITER` 등 역할별 모델, `AUTHORING_REASONING_FIELD_WRITER` 등 역할별 reasoning, `MAX_REVISION` 환경변수로 변경할 수 있습니다. 모델 자동 대체는 없습니다. 최대 재작성은 전체 단계 합산 3회입니다. 초기 초안과 Chief Editor 첫 편집은 재작성 횟수에서 제외합니다.

Structured Outputs를 사용하는 역할은 Curriculum Architect, Civil Field Writer, Scenario Designer, Schedule/Cost Analyst, Field Reviewer, Pedagogy Reviewer, Chief Editor입니다. Reviewer 3개는 독립 API 요청으로 병렬 수행합니다. 점수의 평균을 사용하지 않습니다. 7개 핵심 점수 각각 4 이상, unsupported_claim_risk=1(위험 없음), 모든 이슈 목록 없음, pass=true를 모두 요구합니다. Chief Editor 이후에도 재검수하며 10% 초과 축약을 차단합니다. A02 Layer 1에는 Golden Sample Comparative Reviewer를 추가해 A01과 설명 밀도·현장성·질문 생성·절차 구체성을 별도로 비교합니다.

`docs/a01/audit/{ID}.json` 및 `docs/a02/audit/{ID}.json`은 로컬 상태·검수·재작성 이력·초안을 보관하고 `audit/calls`는 API 역할·모델·reasoning·응답 ID·사용 토큰·시간·컨텍스트 해시를 기록합니다. 이 원문 증빙은 Git에서 제외하고, 커밋에는 `REPORT.md`의 안전한 요약만 남깁니다. 로컬 `.authoring-cache`도 Git 제외입니다. API 응답은 `store=False`로 요청합니다. 실패 원고는 audit에만 보존합니다. 기존 발행본의 재검수가 실패하면 목차에서 제외하고 이전 본문은 로컬 캐시에 보존합니다.

계산 검증은 숫자와 사칙연산/min/max/ceil만 해석하며 모델이 만든 코드를 실행하지 않습니다. 산술 식과 본문 대응·달력·자원 배차·가정·비용 범위는 Quantitative Reviewer가 독립 검사합니다. 이는 실제 프로젝트의 승인이나 전문 기술 검토를 대신하지 않습니다.

새 수행업무는 `programs.json`에 교과과정 ID·목표·관련 자료 allowlist·대표 구간·단위문제·통합 CASE를 먼저 정의한다. Writer/Reviewer/Revision/Editor/캐시 엔진과 프롬프트는 재사용한다. A02는 A01 Golden Sample의 일부를 context에 넣되, 사실·수치·사건·문장·문장 구조를 재사용하지 않는 품질 calibration으로만 사용한다. A02가 통과하기 전에는 이후 업무의 대량 생성으로 확장하지 않는다.

구현 참고: [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol). 확인일 2026-09-24, 설치 SDK 2.45.0의 `client.responses.parse(..., text_format=...)` 사용.

Pilot 통과 뒤 독립 챕터의 API 작업을 병렬 실행하려면 `generate A01 --workers 4`를 사용합니다. 단위문제는 관련 세부챕터 2개만 Context로 가져옵니다. 통합 CASE는 Layer 1 전체를 연결합니다.

자동 수정 한도에 도달한 원고는 일반 `generate` 재실행으로 초기화할 수 없습니다. 원고와 검수 결과를 직접 검토하여 구체적 수정 명세를 작성한 뒤에만 다음과 같이 별도 수정 실행을 합니다. 이전 FAIL 이력은 `audit/archive`에 보존되며 수정본도 모든 검수 게이트를 다시 통과해야 합니다.

```sh
python3 tools/authoring/repair.py A01-1 --note docs/a01/manual-review/A01-1.md
python3 tools/authoring/finalize.py
python3 tools/authoring/validate.py --program A01 --complete
python3 tools/authoring/report.py A01
```

`finalize.py`는 검수된 본문을 유지하며 이전/다음 챕터 링크를 추가합니다. `validate.py --program A01 --complete`는 Layer 1 9개·단위문제 8개·통합 CASE 1개가 모두 PASS인지 검사합니다. `report.py A01`은 수동 검토 이전 실패 실행까지 포함해 재작성 횟수와 검수 이력을 안전한 요약으로 보고합니다.

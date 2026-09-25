#!/usr/bin/env python3
"""A01 authoring: explicit contexts, structured reviews, fail-closed publishing."""
from __future__ import annotations
import argparse
import ast
import hashlib
import json
import math
import operator
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from typing import Literal
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, ConfigDict

ROOT = Path(__file__).resolve().parents[2]
HOME = Path(__file__).resolve().parent
OUT = ROOT / 'docs/a01'
CACHE = ROOT / '.authoring-cache'
CONFIG = json.loads((HOME / 'config.json').read_text())
TITLES = ['공정계획 담당자는 실제로 무슨 일을 하는가', '도면에서 작업구간과 WBS를 어떻게 나누는가', 'Activity는 어떻게 정의하는가', '물량·Crew·생산성으로 Duration을 어떻게 산정하는가', '실제 시공순서와 선후관계를 어떻게 만드는가', '승인·자재·장비·작업면·검측 Constraint를 어떻게 관리하는가', 'Master → 월간 → Look Ahead → 일일계획은 어떻게 연결되는가', '파트너사 및 관계부서와 계획을 어떻게 조정하는가', '계획과 실제가 달라졌을 때 어떻게 갱신하고 재계획하는가']
DRILLS = ['Shop DWG 승인 지연', '생산성 가정 오류', '크레인 중복배차', '작업면 미확보', '자재납기와 공정 충돌', '검측 일정 누락', 'Crew 추가투입 판단', '물량 증가 후 Duration 미갱신']
SOURCES = ['AUTHORING_GUIDE.md', 'docs/REBUILD_DESIGN.md', 'docs/part_b/14.md', 'reference/현장용어집.md']

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Chapter(Strict):
    id: str
    title: str
    objective: str
    prerequisites: list[str]
    concepts: list[str]
    actions: list[str]
    next_problems: list[str]
    connections: list[str]
    source_paths: list[str]

class Curriculum(Strict):
    chapters: list[Chapter]
    scope_review: str

class Calculation(Strict):
    label: str
    expression: str
    expected: float
    unit: str
    assumptions: str

class Draft(Strict):
    markdown: str
    calculations: list[Calculation]

class Review(Strict):
    field_depth: int = Field(ge=1, le=5)
    procedural_specificity: int = Field(ge=1, le=5)
    question_generation: int = Field(ge=1, le=5)
    numerical_consistency: int = Field(ge=1, le=5)
    field_language: int = Field(ge=1, le=5)
    pedagogical_clarity: int = Field(ge=1, le=5)
    cross_function_connection: int = Field(ge=1, le=5)
    unsupported_claim_risk: int = Field(ge=1, le=5)
    numerical_issues: list[str]
    critical_issues: list[str]
    unsupported_claims: list[str]
    revision_requests: list[str]
    passed: bool = Field(alias='pass')

SCORES = ['field_depth', 'procedural_specificity', 'question_generation', 'numerical_consistency', 'field_language', 'pedagogical_clarity', 'cross_function_connection']

def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)

def digest(value):
    return hashlib.sha256(dump(value).encode()).hexdigest()

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(value if isinstance(value, str) else dump(value), encoding='utf-8')
    temporary.replace(path)

def now():
    return datetime.now(timezone.utc).isoformat()

def passed(review):
    return review.passed and all(getattr(review, k) >= 4 for k in SCORES) and review.unsupported_claim_risk == 1 and not (review.numerical_issues or review.critical_issues or review.unsupported_claims)

def evaluate(expression):
    """Tiny arithmetic language; never execute LLM-provided code."""
    if len(expression) > 300:
        raise ValueError('expression too long')
    ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv}
    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            value = node.value
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        elif isinstance(node, ast.BinOp) and type(node.op) in ops:
            value = ops[type(node.op)](visit(node.left), visit(node.right))
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in ('min', 'max', 'ceil') and not node.keywords:
            args = [visit(a) for a in node.args]
            value = {'min': min, 'max': max, 'ceil': math.ceil}[node.func.id](*args)
        else:
            raise ValueError('unsupported arithmetic syntax')
        if not math.isfinite(value) or abs(value) > 1e15:
            raise ValueError('nonfinite or excessive number')
        return value
    return visit(ast.parse(expression, mode='eval').body)

def validate_draft(draft, minimum):
    issues = []
    if len(draft.markdown) < minimum:
        issues.append(f'본문 {len(draft.markdown)}자: 최소 {minimum}자 미달')
    if '교육용 가정' not in draft.markdown:
        issues.append('교육용 수치 가정 고지 누락')
    for c in draft.calculations:
        try:
            actual = evaluate(c.expression)
            if not math.isclose(actual, c.expected, rel_tol=1e-6, abs_tol=0.001):
                issues.append(f'{c.label}: 산술 결과 {actual}, 제시값 {c.expected}')
        except (ValueError, SyntaxError, TypeError, ZeroDivisionError, OverflowError) as e:
            issues.append(f'{c.label}: 검증 불가 {type(e).__name__}')
    return issues

def contexts():
    # Deliberate allowlist: never glob the repository or include .env.
    return {p: (ROOT / p).read_text(encoding='utf-8') for p in SOURCES}

def settings(role):
    return {'model': os.getenv(f'AUTHORING_MODEL_{role.upper()}', os.getenv('AUTHORING_MODEL', CONFIG['default_model'])), 'reasoning': os.getenv(f'AUTHORING_REASONING_{role.upper()}', CONFIG['roles'][role])}

def signature():
    return {'config': CONFIG, 'roles': {r: settings(r) for r in CONFIG['roles']}, 'prompts': {p.name: p.read_text() for p in sorted((HOME / 'prompts').glob('*.md'))}, 'engine': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}

class Runner:
    def __init__(self):
        load_dotenv(ROOT / '.env', override=False)
        key = os.getenv('OPENAI_API') or os.getenv('OPENAI_API_KEY')
        if not key:
            raise RuntimeError('OPENAI_API 또는 OPENAI_API_KEY가 필요합니다.')
        self.client = OpenAI(api_key=key, timeout=600, max_retries=2)

    def call(self, role, item, payload, schema):
        conf = settings(role)
        prompt = (HOME / 'prompts/common.md').read_text() + '\n' + (HOME / f'prompts/{role}.md').read_text()
        prompt += '\n계산 expression은 숫자와 + - * / 괄호 및 min/max/ceil만 사용한다. 날짜는 본문에서 달력을 명시하고 경과 작업일로 환산해 검증한다. Python 코드나 변수는 쓰지 않는다.'
        request = {'role': role, 'item': item, 'payload': payload, 'prompt': prompt, 'version': CONFIG['prompt_version'], 'settings': conf, 'schema': schema.model_json_schema(), 'max_output_tokens': CONFIG['max_output_tokens']}
        key = digest(request)
        record_path = CACHE / 'calls' / f'{key}.json'
        if record_path.exists():
            record = json.loads(record_path.read_text())
            print(f'{item} {role}: cached', flush=True)
            return schema.model_validate(record['output'])
        print(f'{item} {role}: API {conf["model"]}/{conf["reasoning"]}', flush=True)
        try:
            response = self.client.responses.parse(model=conf['model'], reasoning={'effort': conf['reasoning']}, input=[{'role': 'system', 'content': prompt}, {'role': 'user', 'content': dump(payload)}], text_format=schema, max_output_tokens=CONFIG['max_output_tokens'], store=False)
        except Exception as e:
            # SDK exceptions can contain authorization-related server text. Do not log raw exceptions.
            raise RuntimeError(f'API {role}: {type(e).__name__}; HTTP {getattr(e, "status_code", "unknown")}') from None
        if response.status != 'completed' or response.output_parsed is None:
            raise RuntimeError(f'{role}: incomplete/refused response; not publishable')
        result = response.output_parsed
        record = {'chapter_id': item, 'role': role, 'model': conf['model'], 'reasoning': conf['reasoning'], 'prompt_version': CONFIG['prompt_version'], 'context_hash': digest(payload), 'request_hash': key, 'created_at': now(), 'response_id': response.id, 'usage': response.usage.model_dump() if response.usage else {}, 'output': result.model_dump(by_alias=True)}
        save(record_path, record)
        save(OUT / 'audit/calls' / f'{key}.json', record)
        return result

    def curriculum(self):
        payload = {'proposal': [{'id': f'A01-{i}', 'title': t} for i, t in enumerate(TITLES, 1)], 'references': contexts()}
        result = self.call('curriculum', 'A01', payload, Curriculum)
        if [x.id for x in result.chapters] != [f'A01-{i}' for i in range(1, 10)]:
            raise RuntimeError('Curriculum IDs/order must match A01-1..9')
        save(OUT / 'curriculum.json', result.model_dump())
        return result

    def reviews(self, item, draft, context, previous=None):
        payload = {'context': context, 'draft': draft.model_dump(), 'previous_passed_draft': previous.model_dump() if previous else None}
        roles = ['field_reviewer', 'pedagogy_reviewer', 'quantitative_reviewer']
        with ThreadPoolExecutor(max_workers=3) as pool:
            results = list(pool.map(lambda role: self.call(role, item, payload, Review), roles))
        return dict(zip(roles, results))

    def generate(self, item, context, kind='chapter', force_review=False, initial_draft=None, manual_note=None):
        minimum = 1500 if kind == 'drill' else 3000
        request_hash = digest({'context': context, 'kind': kind, 'signature': signature()})
        target = OUT / ('layer1' if kind == 'chapter' else 'layer2' if kind == 'drill' else 'layer3') / f'{item}.md'
        status_path = OUT / 'audit' / f'{item}.json'
        old = json.loads(status_path.read_text()) if status_path.exists() else {}
        if not force_review and old.get('status') == 'pass' and old.get('context_hash') == request_hash and target.exists() and digest(target.read_text()) == old.get('published_hash'):
            print(f'{item}: PASS cache', flush=True)
            return True
        if old.get('status') == 'needs_manual_review' and not manual_note:
            raise RuntimeError(f'{item}: needs_manual_review. 수동 검토 명세를 먼저 작성하고 repair 명령을 사용하세요.')
        # A transport or structured-output failure must not erase the prior
        # draft/review evidence when a normal retry starts a new run.
        if old and (manual_note or old.get('status') == 'error'):
            save(OUT / 'audit/archive' / f'{item}-{digest(old)[:12]}.json', old)
        status = {'chapter_id': item, 'context_hash': request_hash, 'status': 'running', 'started_at': now(), 'revision_count': 0, 'history': [], 'target': str(target.relative_to(ROOT))}
        if manual_note:
            status['manual_intervention'] = manual_note
        save(status_path, status)
        # Remove outdated published content from the public location before replacement.
        existing_body = target.read_text() if target.exists() else None
        if target.exists():
            save(CACHE / 'previous' / f'{item}.md', target.read_text())
            target.unlink()
        writer = 'field_writer' if kind == 'chapter' else 'scenario_designer'
        limit = int(os.getenv('MAX_REVISION', str(CONFIG['max_revision'])))
        if limit < 0:
            raise ValueError('MAX_REVISION must be nonnegative')
        try:
            if initial_draft is not None:
                draft = initial_draft
            elif force_review and 'final_draft' in old:
                draft = Draft(markdown=existing_body or old['final_draft']['markdown'], calculations=old['final_draft']['calculations'])
            else:
                draft = self.call(writer, item, {'context': context}, Draft)
            stage = 'draft'
            accepted = None
            while True:
                issues = validate_draft(draft, minimum)
                if accepted and len(draft.markdown) < 0.9 * len(accepted.markdown):
                    issues.append('Chief Editor가 통과 원고를 10% 초과 축약함')
                reviews = self.reviews(item, draft, context, accepted)
                entry = {'stage': stage, 'revision': status['revision_count'], 'local_issues': issues, 'reviews': {k: v.model_dump(by_alias=True) for k, v in reviews.items()}, 'draft': draft.model_dump()}
                status['history'].append(entry)
                save(status_path, status)
                good = not issues and all(passed(v) for v in reviews.values())
                if good and stage == 'draft':
                    accepted = draft
                    draft = self.call('chief_editor', item, {'context': context, 'approved_draft': draft.model_dump()}, Draft)
                    stage = 'edited'
                    continue
                if good:
                    body = draft.markdown.rstrip() + '\n\n[전체 목차](../README.md) · [기존 CASE 14](../../part_b/14.md)\n'
                    save(target, body)
                    status.update(status='pass', final_draft=draft.model_dump(), published_hash=digest(body), completed_at=now())
                    save(status_path, status)
                    print(f'{item}: PASS ({len(draft.markdown)} chars, revisions={status["revision_count"]})', flush=True)
                    return True
                if status['revision_count'] >= limit:
                    status.update(status='needs_manual_review', final_draft=draft.model_dump(), completed_at=now())
                    save(status_path, status)
                    print(f'{item}: needs_manual_review', flush=True)
                    return False
                status['revision_count'] += 1
                draft = self.call('chief_editor' if stage == 'edited' else writer, item, {'context': context, 'previous_draft': draft.model_dump(), 'approved_draft': accepted.model_dump() if accepted else None, 'revision': status['revision_count'], 'specific_feedback': entry}, Draft)
        except Exception as e:
            status.update(status='error', error_type=type(e).__name__, completed_at=now())
            save(status_path, status)
            raise

    def chapter_context(self, chapter, curriculum):
        return {'chapter': chapter.model_dump(), 'curriculum': curriculum.model_dump(), 'layer': 1, 'level': [1, 2], 'representative_site': '가상 도심 지하차도 B2 BOX 구조물', 'references': contexts()}

    def layer1(self):
        paths = [OUT / 'layer1' / f'A01-{i}.md' for i in range(1, 10)]
        for p in paths:
            status = OUT / 'audit' / f'{p.stem}.json'
            data = json.loads(status.read_text()) if status.exists() else {}
            if not p.exists() or data.get('status') != 'pass' or data.get('published_hash') != digest(p.read_text()):
                raise RuntimeError('Layer 1의 9개 챕터가 모두 PASS여야 문제 생성 가능')
        return {p.stem: p.read_text() for p in paths}

    def scenario_context(self, item, title, kind):
        source = self.layer1()
        related = {1: [3, 6], 2: [4, 9], 3: [5, 8], 4: [2, 6], 5: [5, 6], 6: [3, 6], 7: [4, 8], 8: [4, 9]}
        if kind == 'drill':
            source = {f'A01-{n}': source[f'A01-{n}'] for n in related[int(item.split('D')[1])]}
        return {'id': item, 'title': title, 'kind': kind, 'layer1': source, 'references': {'CASE14': (ROOT / 'docs/part_b/14.md').read_text()}, 'focus': '단위 판단 1~2개' if kind == 'drill' else '금요일 타설 가능 여부, 타 구간 Float와 자원 이동, 추가비·회피가능원가·EAC, 조건부 결정'}

    def scenario(self, item, title, kind):
        return self.generate(item, self.scenario_context(item, title, kind), kind)

def index():
    lines = ['# A01 — 공정계획 수립', '', '현장상황 → 질문 → 정보 수집 → 분석 → 판단 → 실행 → 재확인', '', '검수와 최종 편집 검수를 모두 통과한 문서만 연결합니다. 생성 전·검수 미완료 문서는 대기 상태입니다.', '']
    for folder, title, items in [('layer1', 'Layer 1 · Level 1~2 수행업무 실무지식', [(f'A01-{i}', t) for i, t in enumerate(TITLES, 1)]), ('layer2', 'Layer 2 · Level 3 단위 판단', [(f'A01-D{i:02}', t) for i, t in enumerate(DRILLS, 1)]), ('layer3', 'Layer 3 · Level 4 통합 CASE', [('A01-C01', '금요일 타설 그대로 갈 수 있습니까?')])]:
        lines += [f'## {title}', '']
        for item, label in items:
            path = OUT / folder / f'{item}.md'
            status_path = OUT / 'audit' / f'{item}.json'
            state = json.loads(status_path.read_text()) if status_path.exists() else {}
            ok = path.exists() and state.get('status') == 'pass' and state.get('published_hash') == digest(path.read_text())
            lines.append(f'- [{item}. {label}]({folder}/{item}.md)' if ok else f'- {item}. {label} — {state.get("status", "대기")}')
        lines.append('')
    lines += ['[기존 CASE 14](../part_b/14.md) · [기존 교재](../../README.md) · [설계안](DESIGN.md) · [실행 방법](../../tools/authoring/README.md)', '']
    save(OUT / 'README.md', '\n'.join(lines))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['generate', 'review', 'generate-drills', 'generate-case', 'curriculum', 'index'])
    parser.add_argument('target', nargs='?', default='A01')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--workers', type=int, choices=range(1, 5), default=1, help='Pilot PASS 이후 독립 챕터 API 동시 실행 수')
    args = parser.parse_args()
    if args.target != 'A01' and args.target not in [f'A01-{i}' for i in range(1, 10)]:
        parser.error('현재 Pilot은 A01 또는 A01-1..9만 지원합니다.')
    if args.command in ('generate-drills', 'generate-case', 'curriculum', 'index') and args.target != 'A01':
        parser.error('이 명령은 A01 전체를 대상으로 합니다.')
    if args.dry_run:
        print(dump({'command': args.command, 'target': args.target, 'sources': SOURCES, 'roles': {r: settings(r) for r in CONFIG['roles']}, 'pilot_first': 'A01-4', 'max_revision': int(os.getenv('MAX_REVISION', str(CONFIG['max_revision']))), 'network_calls': 0, 'writes': 0}))
        return 0
    if args.command == 'index':
        index()
        return 0
    runner = Runner()
    success = True
    try:
        if args.command in ('generate', 'review', 'curriculum'):
            curriculum = runner.curriculum()
            if args.command != 'curriculum':
                ids = ['A01-4'] + [f'A01-{i}' for i in range(1, 10) if i != 4] if args.target == 'A01' else [args.target]
                def generate_one(item):
                    chapter = next(c for c in curriculum.chapters if c.id == item)
                    return runner.generate(item, runner.chapter_context(chapter, curriculum), force_review=args.command == 'review')
                success = generate_one(ids[0])
                if success and len(ids) > 1:
                    if args.workers == 1:
                        for item in ids[1:]:
                            if not generate_one(item):
                                success = False
                                break
                    else:
                        with ThreadPoolExecutor(max_workers=args.workers) as pool:
                            success = all(list(pool.map(generate_one, ids[1:])))
        elif args.command == 'generate-drills':
            for i, title in enumerate(DRILLS, 1):
                if not runner.scenario(f'A01-D{i:02}', title, 'drill'):
                    success = False
                    break
        elif args.command == 'generate-case':
            success = runner.scenario('A01-C01', '금요일 타설 그대로 갈 수 있습니까?', 'case')
    finally:
        index()
    return 0 if success else 2

if __name__ == '__main__':
    try:
        sys.exit(main())
    except (RuntimeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

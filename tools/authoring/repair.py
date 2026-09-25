#!/usr/bin/env python3
"""Explicit manual remediation, preserving failed runs and reapplying all gates."""
import argparse
import json
from pathlib import Path
from pipeline import Runner, Curriculum, Draft, OUT, index, DRILLS

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('target')
    parser.add_argument('--note',type=Path,required=True)
    args=parser.parse_args()
    if args.target not in [f'A01-{i}' for i in range(1,10)]+[f'A01-D{i:02}' for i in range(1,9)]+['A01-C01']:
        parser.error('unknown A01 artifact ID')
    old=json.loads((OUT/'audit'/f'{args.target}.json').read_text())
    if old['status']!='needs_manual_review':
        parser.error('repair requires a needs_manual_review artifact')
    note=args.note.read_text()
    if len(note)<100:
        parser.error('a concrete manual review and repair specification is required')
    r=Runner()
    curriculum=Curriculum.model_validate(json.loads((OUT/'curriculum.json').read_text()))
    kind='drill' if '-D' in args.target else 'case' if '-C' in args.target else 'chapter'
    if kind=='chapter':
        chapter=next(c for c in curriculum.chapters if c.id==args.target)
        context=r.chapter_context(chapter,curriculum)
    else:
        title=DRILLS[int(args.target.split('D')[1])-1] if kind=='drill' else '금요일 타설 그대로 갈 수 있습니까?'
        context=r.scenario_context(args.target,title,kind)
    context['manual_review_specification']=note
    draft=r.call('field_writer' if kind=='chapter' else 'scenario_designer',args.target,{'context':context,'previous_draft':old['final_draft'],'specific_feedback':old['history'][-1],'manual_repair_specification':note},Draft)
    try:
        ok=r.generate(args.target,context,kind,initial_draft=draft,manual_note={'specification':note,'previous_status':old['status'],'previous_revisions':old['revision_count']})
    finally:
        index()
    return 0 if ok else 2

if __name__=='__main__':
    raise SystemExit(main())

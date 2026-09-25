#!/usr/bin/env python3
"""Add deterministic navigation to reviewed bodies without editing their prose."""
import argparse
import json
import pipeline

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('program', choices=sorted(pipeline.PROGRAMS), nargs='?', default='A01')
    args = parser.parse_args()
    pipeline.select_program(args.program)
    states = {}
    for p in (pipeline.OUT / 'audit').glob(f'{args.program}-*.json'):
        state = json.loads(p.read_text())
        target = pipeline.ROOT / state['target']
        if state['status']=='pass' and target.exists() and pipeline.digest(target.read_text())==state['published_hash']:
            states[state['chapter_id']] = (p,state,target)
    for item, (audit, state, target) in states.items():
        body = state['final_draft']['markdown'].rstrip()
        links = ['[전체 목차](../README.md)', '[기존 CASE 14](../../part_b/14.md)']
        if item.split('-')[-1].isdigit():
            n=int(item.split('-')[1])
            for other, label in [(f'{args.program}-{n-1}', '이전 챕터'), (f'{args.program}-{n+1}', '다음 챕터')]:
                if other in states:
                    links.append(f'[{label}]({other}.md)')
        body += '\n\n---\n\n' + ' · '.join(links) + '\n'
        pipeline.save(target,body)
        state['published_hash']=pipeline.digest(body)
        pipeline.save(audit,state)
    pipeline.index()
    print(f'Navigation linked: {len(states)} reviewed documents')

if __name__=='__main__':
    main()

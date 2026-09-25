#!/usr/bin/env python3
"""Add deterministic navigation to reviewed bodies without editing their prose."""
import json
from pipeline import ROOT, OUT, save, digest, index

def main():
    states = {}
    for p in (OUT/'audit').glob('A01-*.json'):
        state = json.loads(p.read_text())
        target = ROOT/state['target']
        if state['status']=='pass' and target.exists() and digest(target.read_text())==state['published_hash']:
            states[state['chapter_id']] = (p,state,target)
    for item, (audit, state, target) in states.items():
        body = state['final_draft']['markdown'].rstrip()
        links = ['[전체 목차](../README.md)', '[기존 CASE 14](../../part_b/14.md)']
        if item.split('-')[-1].isdigit():
            n=int(item.split('-')[1])
            for other, label in [(f'A01-{n-1}', '이전 챕터'), (f'A01-{n+1}', '다음 챕터')]:
                if other in states:
                    links.append(f'[{label}]({other}.md)')
        body += '\n\n---\n\n' + ' · '.join(links) + '\n'
        save(target,body)
        state['published_hash']=digest(body)
        save(audit,state)
    index()
    print(f'Navigation linked: {len(states)} reviewed documents')

if __name__=='__main__':
    main()

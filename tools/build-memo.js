#!/usr/bin/env node
/* Authoring only: extract Chapter 2 memorization cards verbatim from docs/ch2-normal. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/ch2-normal');
const types = {flow: 'Flow', hold: 'Hold Point', pre: '전제조건', ab: '이상징후'};
const plain = s => s.replace(/\*\*/g, '').replace(/`/g, '').trim();
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(x => x.trim());
const files = fs.readdirSync(dir, {withFileTypes: true}).filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(d => fs.readdirSync(path.join(dir, d.name)).filter(f => f.endsWith('.md')).sort().map(f => path.join(dir, d.name, f)));
const sections = [], cards = [];
for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const head = /^# (\S+)\. (.+)$/.exec(lines[0]);
  if (!head) throw new Error(`Missing title: ${path.relative(root, file)}`);
  const [, id, title] = head;
  sections.push({id, title});
  const secs = lines.map((l, i) => /^## /.test(l) ? {h: l.slice(3).trim(), i} : null).filter(Boolean);
  secs.forEach((s, k) => { s.end = k + 1 < secs.length ? secs[k + 1].i : lines.length; });
  const find = re => secs.find(s => re.test(s.h));
  const block = s => {
    const a = lines.findIndex((l, i) => i >= s.i && i < s.end && l.startsWith('```text'));
    if (a < 0) return null;
    let b = a + 1; while (b < lines.length && !lines[b].startsWith('```')) b++;
    return lines.slice(a + 1, b).join('\n');
  };
  const table = s => {
    const rows = lines.slice(s.i, s.end).filter(l => l.trim().startsWith('|'));
    return rows.length ? {head: cells(rows[0]).map(plain), rows: rows.slice(2).map(cells)} : null;
  };
  const add = (type, q, a) => cards.push({id: `${id}-${type}-${cards.filter(c => c.section === id && c.type === type).length + 1}`, section: id, type, q, a});
  const flowSec = find(/Flow/), flow = flowSec && block(flowSec);
  if (!flow) throw new Error(`${id}: Flow block not found`);
  add('flow', '정상 공종 Flow는? (◆ Hold Point 표시)', '```text\n' + flow + '\n```');
  const holdSec = find(/^Hold Point/), hold = holdSec && block(holdSec);
  if (!hold) throw new Error(`${id}: Hold Point block not found`);
  add('hold', 'Hold Point(되돌릴 수 없는 지점)는?', '```text\n' + hold + '\n```');
  lines.forEach((l, i) => {
    const m = /^\*\*→ 넘어가는 조건:\*\*\s*(.+)$/.exec(l); if (!m) return;
    let j = i; while (j >= 0 && !/^#{2,3} /.test(lines[j])) j--;
    add('pre', `[${plain(lines[j].replace(/^#+ /, ''))}] 다음으로 넘어가는 조건은?`, m[1].trim());
  });
  const abSec = find(/^이상의 신호/), ab = abSec && table(abSec);
  if (!ab || ab.head.length !== 3) throw new Error(`${id}: 이상의 신호 table must have 3 columns`);
  ab.rows.forEach(r => add('ab', `보이는 것: ${plain(r[0])}\n→ 무엇이 문제인가?`, `**${ab.head[1]}** — ${r[1]}\n\n**${ab.head[2]}** — ${r[2]}`));
}
const data = {title: '챕터 2 · 올바른 상황 암기', types, sections, cards};
fs.writeFileSync(path.join(root, 'data/memo.js'), '// Generated from docs/ch2-normal by tools/build-memo.js.\nwindow.MEMO = ' + JSON.stringify(data, null, 2) + ';\n');
const count = Object.keys(types).map(t => `${t}:${cards.filter(c => c.type === t).length}`).join(' ');
console.log(`Built memo → ${sections.length} sections, ${cards.length} cards (${count})`);

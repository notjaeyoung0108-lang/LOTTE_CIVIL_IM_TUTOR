#!/usr/bin/env node
/* Authoring only: compile approved A01 Markdown into the static web app. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), base = path.join(root, 'docs/a01');
const layers = [
  {folder:'layer1', label:'Layer 1 · 실무지식', level:'Level 1–2'},
  {folder:'layer2', label:'Layer 2 · 단위 판단', level:'Level 3'},
  {folder:'layer3', label:'Layer 3 · 통합 CASE', level:'Level 4'}
];
const order = value => {
  const match = /^A01-(?:(D)(\d+)|(C)(\d+)|(\d+))$/.exec(value);
  if (!match) throw new Error(`Unexpected A01 ID: ${value}`);
  return match[5] ? Number(match[5]) : match[1] ? 100 + Number(match[2]) : 200 + Number(match[4]);
};
const clean = markdown => markdown
  .replace(/\n---\n\n\[전체 목차\][^\n]*\n?$/, '')
  .replace(/\n\[전체 목차\][^\n]*\n?$/, '')
  .trim() + '\n';
const items = layers.flatMap(layer => fs.readdirSync(path.join(base, layer.folder))
  .filter(name => name.endsWith('.md'))
  .map(name => {
    const file = path.join(base, layer.folder, name), md = clean(fs.readFileSync(file, 'utf8'));
    const heading = /^#\s+(.+)$/m.exec(md);
    if (!heading) throw new Error(`Missing title: ${path.relative(root, file)}`);
    const id = path.basename(name, '.md');
    return {id, title:heading[1].replace(new RegExp(`^${id}[.\s·—-]*`), '').trim(), layer:layer.folder, layerLabel:layer.label, level:layer.level, file:path.relative(root, file), md};
  }))
  .sort((a, b) => order(a.id) - order(b.id));
if (items.length !== 18 || new Set(items.map(item => item.id)).size !== items.length) throw new Error('A01 must contain 18 unique approved documents');
const data = {id:'A01', title:'공정계획 수립', status:'Golden Sample', flow:'현장상황 → 질문 → 정보 수집 → 분석 → 판단 → 실행 → 재확인', items};
fs.writeFileSync(path.join(root, 'data/a01.js'), '// Generated from approved docs/a01 Layer 1–3 Markdown.\nwindow.A01_GOLDEN = ' + JSON.stringify(data, null, 2) + ';\n');
console.log(`Built A01 Golden Sample → ${items.length} documents`);

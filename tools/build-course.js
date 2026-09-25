#!/usr/bin/env node
/* Authoring only: compile the three-chapter course Markdown into the static web app. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const chapters = [
  {
    id: 'ch1', num: 1, dir: 'docs/ch1-flow',
    title: '기본 Flow',
    lead: '현장이 어떤 논리로 돌아가는가',
    blurb: '공종과 무관한 골격을 먼저 익힙니다. 특정 현장도, 날짜도, 인물도 나오지 않습니다.'
  },
  {
    id: 'ch2', num: 2, dir: 'docs/ch2-normal',
    title: '올바른 상황',
    lead: '공종별로 정상적인 순서는 무엇인가',
    blurb: '왜 그 순서인지, 되돌릴 수 없는 지점은 어디인지, 무엇이 보이면 이상인지를 배웁니다.'
  },
  {
    id: 'ch3', num: 3, dir: 'docs/ch3-problem',
    title: '문제풀이',
    lead: '어긋났을 때 어디로 돌아가고 무엇을 확인하는가',
    blurb: '관리업무 축과 공종 축이 만나는 자리에서 판단합니다. 정보는 일부 숨겨져 있습니다.'
  }
];
// Chapter navigation footers belong to the Markdown files, not the web reader.
const clean = md => md
  .replace(/\n---\n\n\[[^\]]*목차\][^\n]*\n?$/, '')
  .replace(/\n\[[^\]]*목차\][^\n]*\n?$/, '')
  .trim() + '\n';
const rank = id => id.split(/[-.]/).map(part => {
  const n = Number(part);
  return Number.isFinite(n) ? String(n).padStart(4, '0') : part;
}).join('-');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.md') && entry.name !== 'README.md' ? [full] : [];
  });
}
const built = chapters.map(chapter => {
  const sections = walk(path.join(root, chapter.dir)).map(file => {
    const md = clean(fs.readFileSync(file, 'utf8'));
    const heading = /^#\s+(.+)$/m.exec(md);
    if (!heading) throw new Error(`Missing title: ${path.relative(root, file)}`);
    const id = path.basename(file, '.md');
    const title = heading[1].replace(new RegExp(`^${id}\\s*[.·—-]*\\s*`), '').trim();
    if (!title) throw new Error(`Empty title after ID strip: ${id}`);
    return {id, title, file: path.relative(root, file), md};
  }).sort((a, b) => rank(a.id).localeCompare(rank(b.id)));
  return {...chapter, dir: undefined, sections};
});
const ids = built.flatMap(chapter => chapter.sections.map(section => section.id));
if (new Set(ids).size !== ids.length) throw new Error('Duplicate section ID across chapters');
if (!built[0].sections.length) throw new Error('Chapter 1 must have sections');
const data = {title: '토목현장 실무 교재', flow: '기본 Flow → 올바른 상황 → 문제풀이', chapters: built};
fs.writeFileSync(path.join(root, 'data/course.js'), '// Generated from docs/ch1-flow, docs/ch2-normal, docs/ch3-problem.\nwindow.COURSE = ' + JSON.stringify(data, null, 2) + ';\n');
console.log(`Built course → ${built.map(c => `${c.id}:${c.sections.length}`).join(' ')}`);

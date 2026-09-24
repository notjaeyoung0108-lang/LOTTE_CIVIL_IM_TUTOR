#!/usr/bin/env node
/* Authoring only: committed data works without a runtime server. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const curriculum = JSON.parse(fs.readFileSync(path.join(root, 'docs/curriculum.json'), 'utf8'));
const books = curriculum.map(c => {
  const md = fs.readFileSync(path.join(root, 'docs', c.story), 'utf8');
  const studyMd = fs.readFileSync(path.join(root, 'docs', c.study), 'utf8');
  if (!md.includes('## PART A. 현장소설') || !studyMd.includes('## PART B. 학습')) throw new Error(`Missing part: ${c.id}`);
  return {id:c.id, title:c.title, growth:c.growth, file:c.story, md, studyFile:c.study, studyMd};
});
if (!books.length || new Set(books.map(b => b.id)).size !== books.length) throw new Error('Missing/duplicate chapters');
fs.writeFileSync(path.join(root, 'data/book.js'), '// Generated from docs/curriculum.json and both manuscript parts.\nwindow.BOOK = ' + JSON.stringify(books, null, 2) + ';\n');
console.log(`Built ${books.length} events / ${books.length * 2} manuscripts → data/book.js`);

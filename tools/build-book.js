#!/usr/bin/env node
/* Optional authoring command only; the committed data/book.js runs via file://. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(path.join(root, 'docs')).filter(f => /^\d{2}_.+\.md$/.test(f)).sort();
const books = files.map(file => {
  const md = fs.readFileSync(path.join(root, 'docs', file), 'utf8');
  const title = /^# (.+)$/m.exec(md)?.[1];
  if (!title) throw new Error(`Missing title: ${file}`);
  return {id:Number(file.slice(0,2)), title, file, md};
});
if (!books.length || new Set(books.map(b=>b.id)).size!==books.length) throw new Error('Missing/duplicate chapters');
fs.writeFileSync(path.join(root, 'data', 'book.js'), '// Generated from docs/ by node tools/build-book.js. Edit the Markdown source.\nwindow.BOOK = '+JSON.stringify(books,null,2)+';\n');
console.log(`Built ${books.length} chapters → data/book.js`);

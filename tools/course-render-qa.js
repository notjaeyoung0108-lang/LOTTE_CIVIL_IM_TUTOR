/* Course web surface regression. Uses a minimal DOM shim so it runs without a browser. */
'use strict';
const fs=require('fs'), vm=require('vm'), assert=require('assert/strict');
const mainHtml={value:''};
const el=(id)=>({id,
  _html:'', get innerHTML(){return this._html;}, set innerHTML(v){this._html=v; if(id==='main')mainHtml.value=v;},
  className:'', textContent:'', hidden:true, dataset:{}, style:{}, classList:{add(){},remove(){},contains(){return false;}},
  addEventListener(){}, removeAttribute(){}, setAttribute(){}, focus(){}, scrollIntoView(){},
  querySelector(){return null;}, querySelectorAll(){return [];}, closest(){return null;}});
const nodes=new Map();
const document={
  getElementById(id){ if(!nodes.has(id))nodes.set(id,el(id)); return nodes.get(id); },
  querySelector(sel){ return sel==='.skip'?el('skip'):null; },
  querySelectorAll(){ return []; },
  addEventListener(){}, title:''
};
const store=new Map(); const handlers=[];
const sandbox={
  window:{}, document,
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  location:{hash:'#course', replace(h){this.hash=h;}},
  history:{replaceState(){}},
  addEventListener(ev,fn){ if(ev==="hashchange") handlers.push(fn); }, setInterval(){}, setTimeout(){}, clearTimeout(){},
  scrollTo(){}, scrollY:0, innerWidth:1280,
  Blob:function(){}, URL:{createObjectURL:()=>'', revokeObjectURL(){}},
  console, Date, Math, JSON, Set, Map, Number, String, Array, Object, RegExp, Intl, Error
};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);
process.chdir(require("path").resolve(__dirname,".."));
for(const f of ['data/stage1.js','data/stage2.js','data/cases.js','data/book.js','data/a01.js','data/course.js'])
  vm.runInContext(fs.readFileSync(f,'utf8'),sandbox);
vm.runInContext(fs.readFileSync('app.js','utf8'),sandbox);

const show=hash=>{ sandbox.location.hash=hash; handlers.forEach(fn=>fn()); return mainHtml.value; };

// route() already ran on load with #course.
const COURSE_CHAPTERS=sandbox.window.COURSE.chapters;
let html=mainHtml.value;
assert(html.includes('토목현장 실무 교재'),'course home title');
assert(html.includes('챕터 1 · 기본 Flow'),'chapter 1 heading');
assert(html.includes('챕터 3 · 문제풀이'),'chapter 3 heading');
assert(html.includes('href="#course/1-0"'),'section link');
assert(html.includes('href="#course/1-10"'),'last section link');
const empty=COURSE_CHAPTERS.filter(ch=>!ch.sections.length);
assert.equal(html.includes('작성 예정'),empty.length>0,'pending marker must match empty chapters');
assert(!/undefined|\[object Object\]|NaN/.test(html),'placeholder leak in course home');
const links=[...html.matchAll(/href="#course\/([^"]+)"/g)].map(m=>m[1]);
const total=COURSE_CHAPTERS.reduce((n,ch)=>n+ch.sections.length,0);
assert.equal(links.length,total,total+' section links, got '+links.length);
console.log('교재 목차 렌더링 OK · 절 링크 '+links.length+'개 · 빈 챕터 '+empty.length+'개 표시 정합');
console.log('  링크 순서:',links.join(', '));

// Section reader
for (const id of ['1-0','1-5','1-10','2-D-1','3-01','3-05']) {
  const body = show('#course/'+id);
  assert(body.includes('article class=\"panel prose\"'),'prose article '+id);
  assert(body.includes('data-action=\"course-read\"'),'read button '+id);
  assert(body.includes('href=\"#course\"'),'back link '+id);
  assert(body.length>4000,'section too short '+id+': '+body.length);
  assert(!/undefined|\[object Object\]/.test(body),'placeholder leak '+id);
  assert(body.includes('<table'),'table rendered '+id);
  assert(body.includes('<pre'),'code fence rendered '+id);
  console.log('  절 '+id.padEnd(4)+' 렌더링 OK · '+body.length+'자 · 표/도식 포함');
}
assert(show('#course/nope').includes('토목현장 실무 교재'),'unknown section falls back to index');
console.log('없는 절 → 목차로 폴백 OK');

// Book home entry card
const home = show('#book');
assert(home.includes('class=\"course-entry\"'),'course entry card');
assert(home.includes('COURSE · 토목현장 실무 교재'),'course kicker');
assert.equal((home.match(/class=\"golden-entry\"/g)||[]).length,1,'A01 golden entry must stay unique');
assert(home.includes(total+'개 절'),'section count');
console.log('교재 홈 진입 카드 OK · golden-entry 는 여전히 1개(A01 QA 호환)');

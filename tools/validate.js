#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), context={window:{}};vm.createContext(context);
for(const name of ['stage1','stage2','cases','book'])vm.runInContext(fs.readFileSync(path.join(root,'data',name+'.js'),'utf8'),context);
const {STAGE1,STAGE2,CASES,BOOK}=context.window, all=[...STAGE1,...STAGE2,...CASES];
assert(STAGE1.length>=80);assert(STAGE2.length>=100);assert(CASES.length>=30);assert.equal(BOOK.length,10);
assert.equal(new Set(all.map(c=>c.id)).size,all.length,'Duplicate IDs');
assert.equal(new Set([...STAGE1,...STAGE2].map(c=>c.q)).size,STAGE1.length+STAGE2.length,'Duplicate questions');
const cats=['공사','공무','공정','원가','품질·안전','현장리스크'], fields=['토공','지반','구조','도로','교량','터널','도심지','종합'];
for(const c of all){assert(c.id&&c.domain&&cats.includes(c.category),c.id);assert(BOOK.some(b=>b.id===c.chapter),`${c.id} chapter missing`);}
for(const [s,cards] of [[1,STAGE1],[2,STAGE2]])for(const c of cards){assert.equal(c.s,s);assert(c.q&&c.g&&c.a.length>120,c.id);for(const key of s===1?['정의','왜 필요한가','누가 사용하는가','연결 자료','현장 활용']:['현상','원인','현장 영향','관리방법','관리 연결'])assert(c.a.includes(key),`${c.id}: ${key}`);}
for(const c of CASES){
 assert.equal(c.s,3);assert(['기본','중급','고급'].includes(c.difficulty));assert(fields.includes(c.field));assert(c.background&&c.question);
 assert(c.issues.length>=4&&c.issues.length<=7,`${c.id} issues`);assert(c.hints.length>=3);assert(c.framework.length===7);
 assert(c.comparison.length>=2,`${c.id} options`);for(const o of c.comparison)for(const k of ['name','time','cost','safety','quality','civil','approval'])assert(o[k],`${c.id} ${k}`);
 assert(c.interviewAnswer.length>=800,`${c.id} short spoken answer`);assert(c.keyPoints.length>=3&&c.pitfalls.length>=3);
 const expected=['상황 파악','우선순위 설정','원인·영향 분석','대안 도출','대안 비교 및 선택','실행·협의','모니터링'];
 c.framework.forEach((f,i)=>{assert(f.title.includes(expected[i]),`${c.id} framework`);assert(f.body.length>45);});
}
for(const b of BOOK){assert.equal(b.md,fs.readFileSync(path.join(root,'docs',b.file),'utf8'),`Rebuild book: ${b.file}`);assert(b.md.length>1000);}
for(const text of ['4,500','55%','18개월'])assert(CASES[0].background.includes(text));
for(const text of ['2배','2개월','7%','80억','1.5개월'])assert(CASES[0].issues.join(' ').includes(text));
console.log(`PASS: ${STAGE1.length} basic / ${STAGE2.length} domain / ${CASES.length} cases / ${BOOK.length} chapters; IDs, schemas, lengths, coverage, book sync.`);

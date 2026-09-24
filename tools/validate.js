#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), context={window:{}};vm.createContext(context);
for(const name of ['stage1','stage2','cases','book'])vm.runInContext(fs.readFileSync(path.join(root,'data',name+'.js'),'utf8'),context);
const {STAGE1,STAGE2,CASES,BOOK}=context.window, all=[...STAGE1,...STAGE2,...CASES];
assert(STAGE1.length>=80);assert(STAGE2.length>=100);assert(CASES.length>=30);const curriculum=JSON.parse(fs.readFileSync(path.join(root,'docs/curriculum.json'),'utf8'));assert.equal(BOOK.length,curriculum.length);assert.equal(BOOK.length,18);
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
const expectedSections=['문제상황','아직 판단할 수 없는 것','공사담당자의 사고체계','공무담당자의 사고체계','공사 ↔ 공무 연결','기술원리와 공간','시간축','현장용어','조건 변경 시뮬레이션','판단 연습과 핵심원칙'];
for(const [i,b] of BOOK.entries()){
 assert.equal(b.id,i+1);assert.equal(b.title,curriculum[i].title);assert.equal(b.growth,curriculum[i].growth);
 assert.equal(b.file,curriculum[i].story);assert.equal(b.studyFile,curriculum[i].study);
 for(const [file,md] of [[b.file,b.md],[b.studyFile,b.studyMd]]) {
  assert.equal(md,fs.readFileSync(path.join(root,'docs',file),'utf8'),`Rebuild: ${file}`);
  assert.equal((md.match(/^```/gm)||[]).length%2,0,`Unclosed fence: ${file}`);
 }
 assert(b.md.includes('## PART A. 현장소설'));assert(!b.md.includes('PART B.'));
 assert(b.studyMd.includes('## PART B. 학습'));assert(!b.studyMd.includes('PART A.'));
 assert(b.md.includes('안재영'));assert(!/안재영|김도윤|이수진|박성호|최만식|정태식|오미란|한지우|[0-9]+년차/.test(b.studyMd),`Character leaked into learning ${b.id}`);
 assert(!/화면 정지|### [0-9]+\.|사고과정 해설|공사담당자의 사고체계/.test(b.md),`Learning leaked into fiction ${b.id}`);
 const headings=[...b.studyMd.matchAll(/^### (\d+)\. (.+)$/gm)];
 assert.deepEqual(headings.map(m=>m[2]),expectedSections,`Sections ${b.id}`);
 assert.deepEqual(headings.map(m=>Number(m[1])),Array.from({length:10},(_,j)=>j+1));
 assert.equal((b.studyMd.match(/\| 행동 \| 왜 \| 하지 않으면 \| 후속 영향/g)||[]).length,2,`Why tables ${b.id}`);
 assert(b.studyMd.includes('**해설:**'));assert(b.md.length>800&&b.studyMd.length>1500,`Incomplete manuscript ${b.id}`);
}
const corpus=BOOK.map(b=>b.md+'\n'+b.studyMd).join('\n');
for(const term of ['Heaving','Piping','Boiling','H-Pile','Sheet Pile','Soldier Pile','Waler','Strut','Raker','Anchor','정착','배력근','보강근','피복','BBS','Shop Drawing','거푸집','동바리','Cold Joint','Slump','공시체','양생','ITP','Hold Point','Witness Point','IR/WIR','NCR','Critical Path','Look Ahead','Recovery','함수비','다짐도','기성','정산'])assert(corpus.includes(term),`Coverage: ${term}`);
const paragraphs=BOOK.flatMap(b=>[b.md,b.studyMd]).flatMap(md=>md.split(/\n\s*\n/)).filter(p=>p.length>100&&!p.startsWith('|'));
assert.equal(new Set(paragraphs).size,paragraphs.length,'Repeated long paragraph');
// Independent arithmetic checks for educational examples, not engineering design validation.
assert.equal(3*10*60/30,60);assert.equal(Math.min(60,40),40);assert.equal(1000*1.2,1200);
assert.equal(6*60/15,24);assert.equal(120/Math.min(24,40,20),6);
assert.equal((2/1.12/1.9*100).toFixed(1),'94.0');assert.equal(18-4,14);
assert.equal(Math.max(3+5,3+2),8);assert.equal(Math.max(3+1,3+2),5);
assert.equal(1000*600/1000,600);assert.equal(700+500,1200);
assert.equal(Math.max(4,5,2)+2,7);assert.equal(Math.max(3,5,2)+2,7);
assert.equal(Math.max(4,2,2)+2,6);assert.equal(Math.max(3,2,2)+2,5);
assert.equal((10.20-40*0.005).toFixed(2),'10.00');
function markdownFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?markdownFiles(path.join(dir,e.name)):e.name.endsWith('.md')?[path.join(dir,e.name)]:[]);}
for(const file of [path.join(root,'README.md'),path.join(root,'AUTHORING_GUIDE.md'),...markdownFiles(path.join(root,'docs')),...markdownFiles(path.join(root,'reference'))]) {
 const text=fs.readFileSync(file,'utf8');
 for(const m of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  if(/^(https?:|#)/.test(m[1]))continue;
  const target=path.resolve(path.dirname(file),decodeURIComponent(m[1].split('#')[0]));
  assert(fs.existsSync(target),`Broken link ${path.relative(root,file)} → ${m[1]}`);
 }
}
for(const text of ['4,500','55%','18개월'])assert(CASES[0].background.includes(text));
for(const text of ['2배','2개월','7%','80억','1.5개월'])assert(CASES[0].issues.join(' ').includes(text));
console.log(`PASS: ${STAGE1.length} basic / ${STAGE2.length} domain / ${CASES.length} cases / ${BOOK.length} chapters; IDs, schemas, lengths, coverage, book sync.`);

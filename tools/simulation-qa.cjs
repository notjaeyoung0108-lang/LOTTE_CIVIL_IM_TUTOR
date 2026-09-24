/* Growth curriculum regression: split reading, migration, navigation, rendering. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..'),KEY='lotte_civil_im_tutor.v1';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const errors=[],checks=[];
 try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.join(ROOT,'index.html')).href;
  const nav=async(id,part)=>{await page.evaluate(h=>location.hash=h,`#book/${id}/${part}`);await page.waitForFunction(([id,part])=>document.querySelector('.eyebrow')?.textContent.includes(`CHAPTER ${String(id).padStart(2,'0')}`)&&document.querySelector('.book-parts [aria-current]')?.textContent.includes(part==='study'?'PART B':'PART A'),[id,part]);};
  await page.goto(url+'#book');assert.equal(await page.locator('.chapter').count(),18);
  const old={version:1,cards:{'s1-001':{reps:2,last:100,due:200,grade:2,misses:1}},cases:{'case-001':{answer:'보존할 내 답변',hints:1,rubric:[true],completed:false,viewed:100,lastPracticed:0}},filters:{category:'전체',difficulty:'전체',field:'전체'},log:[{id:'s1-001',at:100,grade:2}],book:{last:10,read:[1,10]}};
  await page.evaluate(([k,s])=>localStorage.setItem(k,JSON.stringify(s)),[KEY,old]);await page.reload();
  await nav(13,'story');
  let state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
  assert.deepEqual(state.book.read,[]);assert.equal(state.cards['s1-001'].reps,2);assert.equal(state.cases['case-001'].answer,old.cases['case-001'].answer);assert.equal(state.log.length,1);
  await page.locator('[data-action="read"]').click();await nav(13,'study');assert(!(await page.locator('[data-action="read"]').textContent()).includes('✓'));
  await page.locator('[data-action="read"]').click();await page.reload();state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.deepEqual(state.book.read,['13/story','13/study']);assert.equal(state.book.part,'study');
  await page.evaluate(()=>location.hash='#book');await page.locator('.chapter').first().waitFor();assert.equal(await page.locator('.backlink').getAttribute('href'),'#book/13/study');
  checks.push('old ten-chapter reads reset for new edition; card grades, drafts, logs preserved; A/B reads and resume persist separately');
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   for(let id=1;id<=18;id++)for(const part of ['story','study']){
    await nav(id,part);const text=await page.locator('article.prose').textContent();
    assert(text.includes(part==='story'?'PART A. 현장소설':'PART B. 학습'));
    assert(!text.includes(part==='story'?'공사담당자의 사고체계':'안재영'));
    assert.equal(await page.locator('article.prose').count(),1);assert(!text.includes('```'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}/${id}/${part}`);
    const expected=await page.evaluate(([id,part])=>{const b=BOOK.find(b=>b.id===id);return((part==='story'?b.md:b.studyMd).match(/^```text$/gm)||[]).length;},[id,part]);
    assert.equal(await page.locator('pre').count(),expected);
   }
  }
  checks.push('all 36 reading surfaces at 320/390/1280px; narrative/analysis separation, diagrams and no document overflow');
  await nav(1,'story');await page.locator('.book-nav a').last().click();await page.waitForURL('**#book/1/study');await page.locator('.book-nav a').last().click();await page.waitForURL('**#book/2/story');
  await nav(18,'study');assert.equal(await page.locator('.book-nav a').last().getAttribute('href'),'#book');
  await page.evaluate(()=>location.hash='#book/999/study');await page.locator('.chapter').first().waitFor();assert.equal(await page.locator('.chapter').count(),18);
  checks.push('story → same-event learning → next story; final return and invalid chapter fallback');
  await page.setViewportSize({width:390,height:844});await nav(13,'story');await page.screenshot({path:path.join(ROOT,'docs/qa/rebuild-story-mobile.png'),fullPage:true});
  await nav(13,'study');await page.screenshot({path:path.join(ROOT,'docs/qa/rebuild-study-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>location.hash='#book');await page.locator('.chapter').first().waitFor();await page.screenshot({path:path.join(ROOT,'docs/qa/rebuild-curriculum.png'),fullPage:true});
  // The renderer must continue escaping content in the new surface.
  await page.evaluate(()=>{BOOK[0].md='# Fixture\n\n```text\n<img src=x onerror="window.__injected=true">\n**literal** & <tag>\n```\n\nAfter fence';location.hash='#book/1/story';});
  await page.waitForFunction(()=>document.querySelector('article h1')?.textContent==='Fixture');
  assert.equal(await page.locator('article img').count(),0);assert.equal(await page.locator('pre strong').count(),0);assert.equal(await page.evaluate(()=>window.__injected),undefined);assert((await page.locator('pre').textContent()).includes('**literal** & <tag>'));
  checks.push('fenced HTML remains escaped and literal Markdown preserved');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(ROOT,'docs/qa/simulation-results.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),checks,errors},null,2)+'\n');
  console.log(checks.map(c=>'PASS: '+c).join('\n'));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

/* Optional content/rendering QA; same external Playwright setup as browser-qa.cjs. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const errors=[],checks=[];
 try {
  const page=await browser.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.join(ROOT,'index.html')).href;
  await page.goto(url+'#book');
  assert((await page.locator('.intro').textContent()).includes('안재영'));
  assert.equal(await page.locator('.chapter').count(),10);
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   for(let id=1;id<=10;id++){
    await page.evaluate(id=>{location.hash='#book/'+id;},id);
    await page.waitForFunction(id=>document.querySelector('.eyebrow')?.textContent.includes('CHAPTER '+String(id).padStart(2,'0')),id);
    const content=await page.locator('article.prose').textContent();
    for(const expected of ['안재영','화면 정지','조건 변경','최종 현장 질문','사고과정 해설'])assert(content.includes(expected),`${id}: ${expected}`);
    assert(!content.includes('```'),`${id}: unrendered fence`);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} chapter ${id}`);
    const blocks=await page.locator('pre').allTextContents();
    for(const block of blocks)assert(block.includes('\n'),'diagram lost line breaks');
    const expected=await page.evaluate(id=>(BOOK.find(b=>b.id===id).md.match(/^```text$/gm)||[]).length,id);
    assert.equal(blocks.length,expected,`diagram count chapter ${id}`);
   }
  }
  checks.push('10 chapters at 320/390/1280px: protagonist, decision questions, diagrams, no page overflow');
  await page.evaluate(()=>{location.hash='#book/5';});
  await page.waitForSelector('pre');
  assert(await page.locator('pre').first().evaluate(e=>e.scrollWidth>e.clientWidth||innerWidth===1280));
  await page.setViewportSize({width:320,height:900});
  assert(await page.locator('pre').first().evaluate(e=>e.scrollWidth>e.clientWidth));
  checks.push('wide diagram scrolls inside its own container on mobile');
  // Untrusted fenced text must stay text, including markup and inline Markdown syntax.
  await page.evaluate(()=>{BOOK[0].md='# Fixture\n\nParagraph\n```text\n<img src=x onerror="window.__injected=true">\n**literal** & <tag>\n```\n\nAfter fence';location.hash='#book/1';});
  await page.waitForFunction(()=>document.querySelector('article h1')?.textContent==='Fixture');
  assert.equal(await page.locator('article img').count(),0);
  assert.equal(await page.locator('pre strong').count(),0);
  assert.equal(await page.evaluate(()=>window.__injected),undefined);
  assert((await page.locator('pre').textContent()).includes('**literal** & <tag>'));
  assert((await page.locator('article').textContent()).includes('After fence'));
  checks.push('fenced HTML escaped; literal Markdown preserved; paragraph-to-fence boundary works');
  await page.reload();
  await page.evaluate(()=>{location.hash='#s1/s1-001';});
  await page.waitForSelector('[data-action="flip"]');
  await page.locator('[data-action="flip"]').click();
  assert((await page.locator('.prose').textContent()).includes('왜 필요한가'));
  await page.evaluate(()=>{location.hash='#s3/case-001';});
  await page.waitForSelector('textarea');
  await page.locator('[data-action="flip"]').click();
  assert.equal(await page.locator('.steps li').count(),7);
  checks.push('basic card answer and seven-step Case still render');
  assert.deepEqual(errors,[]);
  const results={date:new Date().toISOString(),browser:await browser.version(),checks,errors};
  fs.writeFileSync(path.join(ROOT,'docs/qa/simulation-results.json'),JSON.stringify(results,null,2)+'\n');
  console.log('PASS: '+checks.join('\nPASS: '));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

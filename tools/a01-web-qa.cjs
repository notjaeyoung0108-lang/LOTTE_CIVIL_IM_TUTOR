/* A01 web surface regression; intentionally writes no screenshots or reports. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'index.html')).href;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(url+'#book');
  assert.equal(await page.locator('.golden-entry').count(),1);
  assert((await page.locator('.golden-entry').textContent()).includes('A01'));
  await page.locator('.golden-entry').click();await page.waitForURL('**#a01');
  assert.equal(await page.locator('.chapter').count(),18);
  assert.equal(await page.locator('#tabs a[aria-current="page"]').getAttribute('data-tab'),'book');
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});
   for(const id of ['A01-1','A01-D01','A01-C01']){
    await page.evaluate(hash=>location.hash=hash,'#a01/'+id);
    await page.waitForFunction(id=>document.querySelector('article.prose h1')?.textContent.includes(id),id);
    assert.equal(await page.locator('article.prose').count(),1);
    assert((await page.locator('article.prose').textContent()).length>3000);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}/${id}`);
   }
  }
  await page.evaluate(()=>location.hash='#a01/A01-D01');await page.locator('article details').waitFor();
  assert.equal(await page.locator('article details').count(),1);assert.equal(await page.locator('article details').evaluate(element=>element.open),false);
  await page.locator('article details summary').click();assert.equal(await page.locator('article details').evaluate(element=>element.open),true);
  assert(!(await page.locator('article.prose').textContent()).includes('<details>'));
  assert.deepEqual(errors,[]);
  console.log('PASS: #book A01 entry, 18-document index, Layer 1/2/3 readers, disclosure, mobile widths');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

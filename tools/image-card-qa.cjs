/* Optional browser QA; no runtime dependency. */
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  const open=async id=>{await page.goto(url+'#'+id.slice(0,2)+'/'+id);await page.locator('.card-id').filter({hasText:id.toUpperCase()}).waitFor();};
  for(const width of [320,390,1280]) {
   await page.setViewportSize({width,height:900});
   for(const id of ['s2-201','s2-202','s2-203','s2-204','s2-205','s1-007','s2-001']) {
    await open(id);
    for(const back of [false,true]) {
     if(back)await page.locator('[data-action="flip"]').click();
     const img=page.locator('.flash-image img');
     const hasImage=['s2-201','s2-202','s2-203'].includes(id);
     assert.equal(await img.count(),hasImage?1:0);
     if(hasImage){await img.evaluate(el=>el.decode());assert(await img.evaluate(el=>el.naturalWidth>0&&el.clientWidth<=720));assert(await img.getAttribute('alt'));}
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}/${id}/${back}`);
    }
   }
  }
  await open('s2-201');
  await page.locator('.flash-image img').evaluate(el=>{el.src='assets/flashcards/earthwork/missing.png';});
  await page.locator('.flash-image figcaption').waitFor({state:'visible'});
  assert(await page.locator('.flash-image img').isHidden());
  await page.locator('[data-action="flip"]').click();
  await page.locator('[data-grade="3"]').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lotte_civil_im_tutor.v1')).cards['s2-201'].reps),1);
  await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lotte_civil_im_tutor.v1')).cards['s2-201'].reps),1);
  // Data mutations are confined to this disposable browser page.
  await page.evaluate(()=>{const c=window.STAGE2.find(c=>c.id==='s2-202');delete c.imageAlt;c.g='시추 "구멍" <도식>';location.hash='#s2/s2-202';});
  await page.locator('.card-id').filter({hasText:'S2-202'}).waitFor();
  assert.equal(await page.locator('.flash-image img').getAttribute('alt'),'시추 "구멍" <도식>');
  await page.evaluate(()=>{const c=window.STAGE2.find(c=>c.id==='s2-202');delete c.g;});
  await page.locator('[data-action="flip"]').click();
  assert.equal(await page.locator('.flash-image img').getAttribute('alt'),'시추공은 왜 뚫는가?');
  assert.deepEqual(errors,[]);
  console.log('PASS: image/text cards front/back at 320/390/1280px; PNG loading; failure fallback; escaped alt fallbacks; grade persistence; no page errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

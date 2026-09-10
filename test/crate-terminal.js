const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
start(0,async({srv,url})=>{
 let browser,checks=0;const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Crate Inspector');await page.click('#go');await page.waitForFunction(()=>MUSTEAT.state.id);
  await page.evaluate(()=>{const s=MUSTEAT.state;s.pendingRush={bonus:200500};s.nextEvent=Date.now()+1e9;s.crateAt=Date.now()+1e9;s.told={gang:Date.now(),rec:Date.now()};MUSTEAT.save()});
  await page.addInitScript(()=>{window.crateFlashes=[];let was=false;const watch=()=>{const rabbit=document.querySelector('#modalBox .target-rabbit'),on=rabbit&&rabbit.style.opacity==='1';if(on&&!was)window.crateFlashes.push({heading:document.querySelectorAll('.crate-heading .shown').length,note:document.querySelectorAll('.crate-note .shown').length,top:rabbit.getBoundingClientRect().top});was=on;requestAnimationFrame(watch)};requestAnimationFrame(watch)});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();await page.waitForSelector('.crate-heading .target-char');
  ok('heading and note start concealed',await page.locator('.crate-heading .shown,.crate-note .shown').count()===0);
  ok('payout is purple and uses the actual bonus',await page.locator('.crate-payout').innerText()==='₵200.5K'&&await page.locator('.crate-payout').evaluate(e=>getComputedStyle(e).color==='rgb(215, 173, 255)'));
  ok('note has a separate paragraph',await page.locator('.crate-note').evaluate(e=>e.tagName==='P'&&/and a note\.$/.test(e.previousElementSibling.textContent)));
  ok('rush remains unstarted during the transmission',await page.evaluate(()=>!!MUSTEAT.state.pendingRush&&!MUSTEAT.state.fx.rush));
  await page.waitForFunction(()=>window.crateFlashes.length===3);
  ok('second boot starts after the complete heading, before the note',await page.evaluate(()=>crateFlashes[2].heading>0&&crateFlashes[2].note===0&&crateFlashes[2].top>crateFlashes[0].top));
  await page.locator('#modalBox').screenshot({path:'.logs/crate-terminal-mobile.png'});
  await page.waitForFunction(()=>document.querySelector('.crate-note')&&!document.querySelector('#modalBox .target-caret'));
  ok('two rabbit flashes occur before each text block',await page.evaluate(()=>crateFlashes.length===4&&crateFlashes.slice(0,2).every(f=>f.heading===0&&f.note===0)&&crateFlashes.slice(2).every(f=>f.heading>0&&f.note===0)));
  ok('final copy and bold eat survive cleanup',await page.locator('.crate-note').innerText()==='The note says eat.'&&await page.locator('.crate-note b').innerText()==='eat'&&await page.locator('.target-rabbit,.target-char').count()===0);
  ok('mobile modal fits horizontally',await page.locator('#modalBox').evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0&&document.documentElement.scrollWidth<=innerWidth));
  await page.click('#ok');
  ok('TAKEN starts the full rush and clears pending state',await page.evaluate(()=>!MUSTEAT.state.pendingRush&&MUSTEAT.state.fx.rush-Date.now()>76000));
  await page.evaluate(()=>{MUSTEAT.state.pendingRush={bonus:200500};delete MUSTEAT.state.fx.rush;MUSTEAT.save()});await page.reload();await page.waitForSelector('.target-caret');await page.click('#ok');
  ok('closing during animation cancels all effects',await page.locator('.target-caret,.target-rabbit,.target-char').count()===0&&await page.locator('#modal').isHidden());
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{MUSTEAT.state.pendingRush={bonus:200500};MUSTEAT.save()});await page.reload();await page.waitForSelector('.crate-note');
  ok('reduced motion shows both lines immediately without flashes',await page.locator('.crate-note').innerText()==='The note says eat.'&&await page.locator('.target-rabbit,.target-char').count()===0);
  await page.setViewportSize({width:1000,height:900});await page.locator('#modalBox').screenshot({path:'.logs/crate-terminal-desktop.png'});
  ok('no browser errors',errors.length===0);console.log(`\n${checks} passed`);
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

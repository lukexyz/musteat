// README fresh starts use isolated, resumable saves and keep ledger navigation in that instance.
const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
start(0,async({srv,url})=>{
 let browser,checks=0;const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();const context=await browser.newContext({reducedMotion:'reduce'}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const normal=await context.newPage();await normal.goto(url+'index.html?dev');await normal.click('#intro');await normal.fill('#nm','Original Citizen');await normal.click('#go');await normal.waitForFunction(()=>MUSTEAT.state.id);
  const original=await normal.evaluate(()=>{MUSTEAT.state.cash=123456;MUSTEAT.state.nextEvent=Date.now()+1e9;MUSTEAT.state.crateAt=Date.now()+1e9;MUSTEAT.save();return MUSTEAT.state.id});
  const readme=fs.readFileSync(path.join(__dirname,'../README.md'),'utf8'),play=readme.match(/\*\*Play:\*\* \[[^\]]+\]\(([^)]+)\)/)[1];
  ok('README Play targets the explicit new-game flag',new URL(play).searchParams.get('game')==='new');
  const game=await context.newPage();await game.setContent(`<a href="${url}index.html${new URL(play).search}&dev">Play</a>`);await game.click('a');await game.waitForSelector('#intro:not([hidden])');
  const instance=game.url(),slot=new URL(instance).searchParams.get('slot');
  ok('clicking Play allocates an instance and consumes game=new',/^game-[a-f0-9]{32}$/.test(slot)&&!new URL(instance).searchParams.has('game'));
  ok('new instance has zero progress and starts with the intro',await game.evaluate(()=>!MUSTEAT.state.id&&!MUSTEAT.state.name&&MUSTEAT.state.cash===0&&MUSTEAT.state.total===0));
  await game.waitForTimeout(5500);
  ok('first-visit intro waits for a click past the former timeout',await game.locator('#intro').isVisible()&&await game.locator('#modal').isHidden());
  ok('reduced-motion intro text remains readable',await game.locator('#intro .lines p').evaluateAll(lines=>lines.every(p=>getComputedStyle(p).opacity==='1')));
  await game.reload();await game.waitForSelector('#intro:not([hidden])');
  ok('refresh before registration keeps the allocated instance',game.url()===instance);
  await game.click('#intro');ok('intro leads to fresh alias registration',await game.locator('#nm').inputValue()==='');await game.fill('#nm','New Citizen');await game.click('#go');await game.waitForFunction(()=>MUSTEAT.state.id);
  const citizen=await game.evaluate(()=>{MUSTEAT.state.cash=54321;MUSTEAT.state.nextEvent=Date.now()+1e9;MUSTEAT.state.crateAt=Date.now()+1e9;MUSTEAT.save();return MUSTEAT.state.id});
  ok('new registration gets a different player identity',citizen!==original);
  await game.reload();await game.waitForFunction(()=>MUSTEAT.state.id);
  ok('refresh resumes the new citizen without replaying registration',await game.evaluate(id=>MUSTEAT.state.id===id&&MUSTEAT.state.cash===54321&&document.getElementById('intro').hidden,citizen));
  await game.click('[data-act="saveInfo"]');
  ok('save panel exposes a stable bookmark for this instance',new URL(await game.locator('#modalBox a').getAttribute('href'),url).searchParams.get('slot')===slot);
  await game.locator('#modalBox #ok').click();
  const ledger=await Promise.all([context.waitForEvent('page'),game.locator('footer a[href^="ledger.html"]').click()]).then(r=>r[0]);await ledger.waitForLoadState();
  ok('footer high scores preserve the instance',new URL(ledger.url()).searchParams.get('slot')===slot);
  ok('both leaderboard return links preserve the instance',(await ledger.locator('a[href^="index.html"]').evaluateAll(els=>els.map(e=>new URL(e.href).searchParams.get('slot')))).every(s=>s===slot));
  await ledger.locator('.home-link').click();await ledger.waitForFunction(()=>MUSTEAT.state.id);
  ok('leaderboard logo returns to the same citizen',await ledger.evaluate(id=>MUSTEAT.state.id===id,citizen));await ledger.close();
  const another=await context.newPage();await another.goto(url+'index.html?game=new&dev&ref=FRIEND&v=Guest#entry');await another.waitForSelector('#intro:not([hidden])');
  ok('another fresh-start click gets another distinct instance',new URL(another.url()).searchParams.get('slot')!==slot);
  ok('fresh starts preserve referral and intro parameters',await another.evaluate(()=>MUSTEAT.state.ref==='FRIEND'&&new URLSearchParams(location.search).get('v')==='Guest'&&location.hash==='#entry'));await another.close();
  await game.click('#reset');await game.click('#confirm');await game.waitForSelector('#intro:not([hidden])');
  ok('reset stays in its instance and opens a fresh intro',new URL(game.url()).searchParams.get('slot')===slot&&await game.evaluate(()=>!MUSTEAT.state.id));
  ok('resetting an instance leaves the default save untouched',await game.evaluate(id=>{const s=JSON.parse(localStorage.getItem('musteat_save'));return s.id===id&&s.cash===123456},original));
  await normal.reload();await normal.waitForFunction(()=>MUSTEAT.state.id);
  ok('the normal URL still resumes the original citizen',await normal.evaluate(id=>MUSTEAT.state.id===id,original));
  ok('no browser errors',errors.length===0);console.log(`\n${checks} passed`);
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

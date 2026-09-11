// Confirmed ledger rows drive grouped visual transfers, never balances or historical replays.
const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
start(0,async({srv,db,url})=>{
 let browser,checks=0;
 const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1000,height:1100},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Pulse Test');await page.click('#go');
  await page.waitForFunction(()=>MUSTEAT.state.id);
  const me=await page.evaluate(()=>{
   Object.assign(MUSTEAT.state,{total:30000,cash:1000,portfolioUnlocked:true,ref:'BOSS',gear:{},upg:{},ach:{},nextEvent:Date.now()+1e9,crateAt:Date.now()+1e9,told:{gang:Date.now(),rec:Date.now()}});
   MUSTEAT.render();return {id:MUSTEAT.state.id,code:MUSTEAT.state.code};
  });
  db.players.push({id:'boss',code:'BOSS',name:'Upper Management',total:0,lastSeen:Date.now()},
   {id:'runner',code:'RUNNER',name:'Actual Labour',ref:me.code,total:0,lastSeen:Date.now()});
  let serial=0;
  const pay=(incoming,extra={})=>db.ledger.push({id:'pulse-'+(++serial),ts:Date.now(),from:incoming?'runner':me.id,to:incoming?me.id:'boss',amount:12,kind:'cut',...extra});
  const sync=async()=>{await page.evaluate(()=>MUSTEAT.sync());await page.waitForTimeout(80)};
  pay(false);pay(true);await sync();await page.click('#tabPfB');await page.waitForSelector('#pfEmpire .pyr');await page.waitForTimeout(150);
  await page.emulateMedia({reducedMotion:'no-preference'});
  ok('opening Portfolio never replays historical payments',await page.locator('.payment-traces').count()===0);
  await page.locator('#pfFlow').scrollIntoViewIfNeeded();
  pay(false);pay(false);pay(false);
  await sync();await page.waitForSelector('.payment-out circle');
  ok('multiple new rows to one recipient produce one red pulse',await page.locator('.payment-out').count()===1);
  ok('outgoing pulse identifies the real recipient and uses red',await page.locator('.payment-out').evaluate(e=>e.dataset.person==='boss'&&getComputedStyle(e).color==='rgb(239, 113, 136)'));
  const start=await page.locator('.payment-out circle').getAttribute('cy');await page.waitForTimeout(200);
  ok('pulse travels upwards towards the recipient',Number(await page.locator('.payment-out circle').getAttribute('cy'))<Number(start));
  await page.locator('#pfFlow').screenshot({path:'/private/tmp/musteat-payment-out.png'});
  await page.waitForTimeout(1000);await sync();
  ok('repeat sync does not replay the same ledger IDs',await page.locator('.payment-traces').count()===0);
  await page.waitForTimeout(2800); // Let unrelated registration/achievement toasts clear before the visual check.
  await page.locator('#pfEmpire .pyr').scrollIntoViewIfNeeded();
  pay(true);pay(true);await sync();await page.waitForSelector('.payment-in circle');
  ok('incoming rows group into one green pulse from the actual runner',await page.locator('.payment-in').count()===1&&await page.locator('.payment-in').evaluate(e=>e.dataset.person==='runner'&&getComputedStyle(e).color==='rgb(156, 233, 117)'));
  await page.locator('#pfEmpire .pyr').screenshot({path:'/private/tmp/musteat-payment-in.png'});
  ok('traces are decorative and do not intercept input',await page.locator('.payment-traces').evaluate(e=>e.getAttribute('aria-hidden')==='true'&&getComputedStyle(e).pointerEvents==='none'));
  await page.waitForTimeout(1000);
  pay(true,{amount:0});pay(false,{amount:-1});pay(true,{from:'stranger',to:'boss'});await sync();
  ok('zero, negative and unrelated payments do not animate',await page.locator('.payment-traces').count()===0);
  await page.click('#tabRunB');pay(true);await sync();
  await page.click('#tabPfB');await page.waitForTimeout(180);
  ok('payments observed in Operations are not replayed on return',await page.locator('.payment-traces').count()===0);
  // Also cover rows first fetched by the Portfolio-entry refresh.
  await page.click('#tabRunB');pay(false);await page.click('#tabPfB');await page.waitForTimeout(180);
  ok('entry refresh quietly absorbs payments recorded while away',await page.locator('.payment-traces').count()===0);
  await page.emulateMedia({reducedMotion:'reduce'});pay(true);await sync();
  ok('reduced motion skips transfers',await page.locator('.payment-traces').count()===0);
  await page.emulateMedia({reducedMotion:'no-preference'});await sync();
  ok('turning motion on does not replay skipped payments',await page.locator('.payment-traces').count()===0);
  await page.evaluate(()=>{location.hash='highscores'});await page.waitForSelector('#highscoresView:visible');
  pay(true);await sync();
  await page.evaluate(()=>{location.hash=''});await page.waitForSelector('#gameView:visible');await sync();
  ok('high-score browsing never queues transfers for the return',await page.locator('.payment-traces').count()===0);
  await page.locator('#pfEmpire .pyr').scrollIntoViewIfNeeded();
  await page.route('**/api?op=sync*',route=>route.abort());pay(true);await sync();
  ok('failed sync does not animate fallback rows',await page.locator('.payment-traces').count()===0);
  await page.unroute('**/api?op=sync*');await sync();
  ok('reconnection establishes a quiet baseline',await page.locator('.payment-traces').count()===0);
  await page.setViewportSize({width:1000,height:450});await page.evaluate(()=>scrollTo(0,0));
  pay(true);await sync();
  await page.locator('#pfEmpire .pyr').scrollIntoViewIfNeeded();
  ok('off-screen payments are not replayed when scrolling to the pyramid',await page.locator('.payment-traces').count()===0);
  await page.setViewportSize({width:320,height:850});await page.locator('#pfEmpire .pyr').scrollIntoViewIfNeeded();
  pay(true);await sync();await page.waitForSelector('.payment-in circle');
  ok('mobile transfer stays inside the diagram with no overflow',await page.locator('.payment-traces').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left&&a.right<=b.right+1&&document.documentElement.scrollWidth<=innerWidth}));
  await page.click('#tabRunB');
  ok('leaving Portfolio immediately clears active transfers',await page.locator('.payment-traces').count()===0);
  ok('animation never changes cash',await page.evaluate(()=>MUSTEAT.state.cash)===1000);
  ok('no browser errors',errors.length===0);
  console.log('\n'+checks+' checks passed.');
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

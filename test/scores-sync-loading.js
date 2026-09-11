// A returning player's slow/broken game sync must not block read-only high scores.
const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
start(0,async({srv,db,url})=>{
 let browser,checks=0;
 const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();const page=await browser.newPage({reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  db.players.push({id:'rival',code:'RIVAL',name:'Visible Rival',total:50000,played:1800,pace0:'{"30":42000}'});
  db.ledger.push({id:'known-payment',from:'worker',to:'rival',amount:75,kind:'cut',level:1,ts:Date.now()});
  await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Returning Player');await page.click('#go');
  await page.waitForFunction(()=>MUSTEAT.state.id);
  await page.evaluate(()=>{MUSTEAT.state.nextEvent=Date.now()+1e9;MUSTEAT.state.crateAt=Date.now()+1e9;MUSTEAT.save()});
  let heldSync=[],heldReads=[],delayReads=true,readCount=0;
  await page.route('**/api?op=sync*',route=>{heldSync.push(route)});
  await page.route('**/api?table=*',route=>{readCount++;if(delayReads)heldReads.push(route);else return route.continue()});
  await page.evaluate(()=>history.replaceState(null,'','#highscores'));
  await page.reload();await page.waitForSelector('.score-skeleton');
  console.log('  observed status: '+await page.textContent('#ledger-loadMessage'));
  ok('unknown data is never labelled up to date or zero citizens',!/Up to date|0 registered/.test(await page.textContent('#ledger-loadMessage')));
  await page.waitForFunction(()=>document.getElementById('ledger-loadStatus').classList.contains('loading'));
  ok('returning player starts independent public reads despite pending game sync',heldSync.length>0&&heldReads.length===2);
  delayReads=false;for(const route of heldReads.splice(0))await route.continue();
  await page.waitForSelector('#ledger-scores tr');
  ok('scores and ledger load while the game POST remains blocked',/Visible Rival/.test(await page.textContent('#ledger-scores'))&&await page.textContent('#ledger-sumAll')==='₵75'&&heldSync.length>0);
  ok('completed reads report actual citizen count',/Up to date/.test(await page.textContent('#ledger-loadMessage')));
  for(const route of heldSync.splice(0))await route.abort();
  await page.unroute('**/api?op=sync*');
  await page.waitForTimeout(100);
  await page.route('**/api?op=sync*',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.evaluate(()=>MUSTEAT.sync());
  await page.evaluate(()=>MUSTEAT.refreshScores());
  ok('public-read retry works even when game writes fail',/Up to date/.test(await page.textContent('#ledger-loadMessage'))&&await page.textContent('#ledger-sumAll')==='₵75');
  await page.unroute('**/api?op=sync*');
  delayReads=true;
  await page.evaluate(()=>{void MUSTEAT.refreshScores()});
  await page.waitForTimeout(80);
  db.players.find(p=>p.id==='rival').name='Newer Alias';
  await page.evaluate(()=>MUSTEAT.sync());
  ok('game sync continues to update scores during an independent read',/Newer Alias/.test(await page.textContent('#ledger-scores')));
  delayReads=false;
  for(const route of heldReads.splice(0)){
   const table=new URL(route.request().url()).searchParams.get('table');
   await route.fulfill({contentType:'application/json',body:JSON.stringify(table==='players'?[{id:'stale',name:'Outdated Alias',pace0:'{"30":1}'}]:[])});
  }
  await page.waitForTimeout(80);
  ok('older public responses cannot overwrite newer game data',/Newer Alias/.test(await page.textContent('#ledger-scores'))&&await page.textContent('#ledger-sumAll')==='₵75');
  await page.route('**/api?op=sync*',route=>route.fulfill({contentType:'application/json',body:'{"error":"sync unavailable"}'}));
  await page.evaluate(()=>MUSTEAT.sync());
  ok('invalid sync response cannot erase real scores with an empty company',/Newer Alias/.test(await page.textContent('#ledger-scores'))&&await page.textContent('#ledger-sumAll')==='₵75');
  await page.evaluate(()=>MUSTEAT.refreshScores());
  ok('public reads recover from an invalid game-sync response',/Up to date/.test(await page.textContent('#ledger-loadMessage')));
  ok('no uncaught browser errors',errors.length===0);
  console.log('\n'+checks+' sync/loading checks passed.');
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

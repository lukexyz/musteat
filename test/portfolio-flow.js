// Compact map, preloaded lifetime stats, correct commission rules and accessible hover cards.
const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
start(0,async({srv,db,url})=>{
 let browser,checks=0;
 const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1000,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;page.on('request',r=>{if(r.url().includes('/api'))requests++});
  await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Actual Labour');await page.click('#go');await page.waitForFunction(()=>MUSTEAT.state.id);
  await page.evaluate(()=>{Object.assign(MUSTEAT.state,{total:30000,cash:1000,portfolioUnlocked:true,gear:{trainers:10},upg:{},ach:{},nextEvent:Date.now()+1e9,crateAt:Date.now()+1e9,told:{gang:Date.now(),rec:Date.now()}});MUSTEAT.render()});
  await page.click('#tabPfB');
  ok('solo player gets a compact map without an invented recruiter',await page.locator('[data-flow^="up"]').count()===0&&/No recruiter above you/.test(await page.locator('#pfFlow').innerText()));
  ok('lifetime earnings are visible without hovering',await page.locator('#flowLifetime').isVisible() && /₵30/.test(await page.locator('#flowLifetime').innerText()));
  ok('small eye pyramid sits above the no-recruiter line',await page.locator('.scheme-eye').evaluate(e=>e.nextElementSibling.classList.contains('money-empty')&&e.getBoundingClientRect().width===28));
  ok('instruction filler is removed while bar labels remain',await page.locator('.money-legend,.money-foot').count()===0 && await page.locator('.money-bar').isVisible() && (await page.locator('.money-amounts span').allTextContents()).join('|')==='You keep 85%|Runner tax 0%|Gang 15%');
  ok('solo keeps 85% and pays 15% gang tax',await page.locator('[data-flow="you"] .account-head .rate-value').innerText()==='85%'&&await page.locator('[data-flow="gang"] .account-head .rate-value').innerText()==='15%');
  await page.locator('[data-flow="gang"]').hover();
  ok('Sector 7 has no unrecorded stat or empty reveal',await page.locator('[data-flow="gang"] .account-reveal').count()===0 && !(await page.locator('[data-flow="gang"]').innerText()).includes('Not recorded'));
  await page.locator('[data-flow="gang"]').click();
  ok('Sector 7 click opens the extortion share modal',await page.locator('.invite-heading h3').innerText()==='Get rid of Sector 7 Extortion for good');
  ok('extortion modal offers all four share messages',await page.locator('#modalBox [data-invite]').count()===4);
  ok('extortion modal retains your referral code and hides hover',await page.locator('.invite-ref').inputValue()==='?ref='+await page.evaluate(()=>MUSTEAT.state.code)&&await page.locator('.account-card.revealed .account-reveal').isHidden());
  await page.click('#cancel');await page.locator('[data-flow="gang"]').focus();await page.keyboard.press('Enter');
  ok('keyboard activation opens the same four-message modal',await page.locator('#modalBox [data-invite]').count()===4&&await page.locator('#modal').isVisible());
  await page.setViewportSize({width:320,height:850});
  ok('extortion heading and messages fit mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)&&await page.locator('#modalBox').evaluate(e=>e.scrollWidth<=e.clientWidth));
  await page.click('#cancel');await page.setViewportSize({width:1000,height:900});
  await page.locator('#empireLive [data-act="share"]').click();
  ok('ordinary share keeps its existing heading',await page.locator('.invite-heading h3').innerText()==='Copy your invite');await page.click('#cancel');
  const actualRunners=await page.evaluate(()=>MUSTEAT.state.down.list.length);
  ok('hypothetical recruit shows the requested CTA and cut',await page.locator('[data-flow="recruit"] .account-head strong').innerText()==='Find a recruit'&&await page.locator('[data-flow="recruit"] .rate-label').innerText()==='You take'&&await page.locator('[data-flow="recruit"] .rate-value').innerText()==='15%');
  await page.locator('[data-flow="recruit"]').click();
  ok('recruit CTA opens the four share options',await page.locator('#modalBox [data-invite]').count()===4&&await page.locator('.invite-heading h3').innerText()==='Get rid of Sector 7 Extortion for good');
  ok('hypothetical card never adds a real runner',await page.evaluate(()=>MUSTEAT.state.down.list.length)===actualRunners);
  await page.click('#cancel');await page.locator('[data-flow="recruit"]').focus();await page.keyboard.press('Enter');
  ok('recruit CTA is keyboard accessible',await page.locator('#modal').isVisible()&&await page.locator('#modalBox [data-invite]').count()===4);await page.click('#cancel');
  await page.click('#tabRunB');
  db.players.push({id:'boss',code:'BOSS',name:'Link Sender',ref:'MIDDLE',buildings:'depot,plant',total:500000,lastSeen:Date.now()},
   {id:'middle',code:'MIDDLE',name:'Regional Leech',ref:'TOP',buildings:'factory',total:1000000,lastSeen:Date.now()},
   {id:'top',code:'TOP',name:'Executive Parasite',total:2000000,lastSeen:Date.now()},
   {id:'peer',code:'PEER',name:'Other Legs',ref:'BOSS',total:1000,lastSeen:Date.now()});
  const id=await page.evaluate(()=>MUSTEAT.state.id);
  db.ledger.push({id:'pay1',from:id,to:'boss',amount:123.5},{id:'pay2',from:id,to:'boss',amount:20},{id:'not-yours',from:'other',to:'boss',amount:99999});
  await page.evaluate(()=>{MUSTEAT.state.ref='BOSS';MUSTEAT.render()});
  const beforeOpen=requests;await page.click('#tabPfB');await page.waitForSelector('[data-flow="up3"]');
  ok('opening Portfolio refreshes all people and payments before hover',requests>beforeOpen);
  ok('upstream names retain their pyramid order',(await page.locator('.money-map [data-flow]').evaluateAll(es=>es.map(e=>e.dataset.flow))).join(',')==='up3,up2,up1,you,gang,recruit');
  ok('rates include buildings and fractional commissions',(await page.locator('[data-flow^="up"] .account-head .rate-value').allTextContents()).join(',')==='2.5%,7.5%,18.75%');
  ok('three ancestors fit in a compact card without a permanent inspector',(await page.locator('#pfFlow').boundingBox()).height<460&&await page.locator('#moneyInspector').count()===0);
  await page.locator('[data-flow="up1"]').scrollIntoViewIfNeeded();
  const closedHeight=(await page.locator('[data-flow="up1"]').boundingBox()).height;
  const beforeHover=requests;await page.locator('[data-flow="up1"]').hover();
  ok('stats expand the existing card without a floating tooltip',(await page.locator('[data-flow="up1"]').boundingBox()).height>closedHeight && await page.locator('#portfolioHover,[role="tooltip"]').count()===0);
  ok('outgoing payments get the ominous treatment',await page.locator('[data-flow="up1"]').evaluate(e=>e.classList.contains('dread')&&getComputedStyle(e).backgroundColor==='rgb(27, 11, 17)'));

  ok('hover shows preloaded lifetime earnings instantly',await page.locator('.account-card.revealed .account-reveal').isVisible()&&/Lifetime earnings\s*₵500K/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  ok('lifetime tax sums only payments from you',/Lifetime tax\s*₵143.5/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  ok('hover makes no network request',requests===beforeHover);
  ok('player reveal contains only the two lifetime stats',await page.locator('.account-card.revealed .account-reveal .account-line').count()===2 && await page.locator('.account-card.revealed .account-note,.account-card.revealed .account-mood').count()===0);
  await page.locator('#pfFlow').screenshot({path:'/private/tmp/musteat-inline-outgoing.png'});
  await page.keyboard.press('Escape');ok('Escape dismisses hover card',await page.locator('.account-card.revealed .account-reveal').isHidden());
  await page.locator('[data-flow="up2"]').focus();ok('keyboard focus reveals cached stats inside the card',await page.locator('[data-flow="up2"]').getAttribute('aria-expanded')==='true'&&await page.locator('[data-flow="up2"]').getAttribute('aria-expanded')==='true');
  ok('no recorded payment is shown as zero, not estimated',/Lifetime tax\s*₵0/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  await page.evaluate(()=>{MUSTEAT.state.shop={name:'My Shop',at:Date.now()};MUSTEAT.render()});
  ok('shop keeps ancestry and commissions with a broken dependency',await page.locator('[data-flow="up1"] + .money-link.independent').count()===1&&await page.locator('[data-flow="you"] .account-head .rate-value').innerText()==='85%'&&await page.locator('[data-flow="up1"] .account-head .rate-value').innerText()==='18.75%');
  await page.evaluate(()=>{MUSTEAT.state.up[0].shopName='Boss Shop';MUSTEAT.render()});
  ok('ancestor independence breaks the correct parent connection',await page.locator('[data-flow="up2"] + .money-link.independent').count()===1);
  await page.evaluate(()=>{MUSTEAT.state.franchiseOf='boss';MUSTEAT.render()});
  ok('franchise keeps royalty connection and boosted royalty',await page.locator('[data-flow="up1"] + .money-link.independent').count()===0&&await page.locator('[data-flow="up1"] .account-head .rate-value').innerText()==='31.25%');
  const code=await page.evaluate(()=>MUSTEAT.state.code);
  db.players.push({id:'runner',code:'RUNNER',name:'Independent Accomplice',ref:code,shopName:'Free-ish',total:42000,lastSeen:Date.now()});
  db.ledger.push({id:'reverse',from:'runner',to:id,amount:222});
  await page.evaluate(async()=>{await MUSTEAT.sync();MUSTEAT.render()});
  const runner=page.locator('#pfEmpire [data-person="runner"]');await runner.scrollIntoViewIfNeeded();await page.waitForTimeout(150);await runner.hover();
  ok('downline usernames also have cached earnings cards',/Lifetime earnings\s*₵42K/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  ok('downline hover keeps payment direction clear',/Lifetime tax\s*₵222/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  ok('incoming payments use the celebratory treatment',await runner.evaluate(e=>e.classList.contains('lucrative')&&getComputedStyle(e).backgroundColor==='rgb(13, 27, 16)'));
  ok('independent runner stays visible with dashed tie',await runner.evaluate(e=>e.classList.contains('independent')));
  await page.locator('#pfEmpire').screenshot({path:'/private/tmp/musteat-inline-income.png'});
  await page.evaluate(()=>{MUSTEAT.state.down.paid.runner+=1;MUSTEAT.render()});
  ok('live rendering does not strand the hover card',await page.locator('.account-card.revealed .account-reveal').isVisible());
  await page.click('#tabRunB');ok('leaving Portfolio closes the card',await page.locator('.account-card.revealed .account-reveal').isHidden());
  await page.click('#tabPfB');await page.waitForSelector('[data-flow="up3"]');
  for(const width of [1000,390,320]){
   await page.setViewportSize({width,height:850});await page.locator('[data-flow="up1"]').click();
   ok('inline reveal stays inside its card at '+width+'px',await page.locator('.account-card.revealed .account-reveal').evaluate(e=>{const r=e.getBoundingClientRect(),c=e.closest('.account-card').getBoundingClientRect();return r.left>=c.left&&r.right<=c.right&&r.bottom<=c.bottom+1&&document.documentElement.scrollWidth<=innerWidth}));
  }
  ok('reduced motion disables the reveal animation',await page.locator('.account-card.revealed .account-content').evaluate(e=>getComputedStyle(e).animationName==='none'));
  await page.keyboard.press('Escape');await page.locator('#pfFlow').screenshot({path:'/private/tmp/musteat-compact-map-mobile.png'});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.mouse.move(0,0);await page.locator('[data-flow="up1"]').hover();
  ok('normal motion uses a short in-card decode reveal',await page.locator('[data-flow="up1"] .account-content').evaluate(e=>getComputedStyle(e).animationName==='account-decode'&&getComputedStyle(e).animationDuration==='0.28s'));
  await page.waitForTimeout(300);
  ok('animated stats finish within the card bounds',await page.locator('[data-flow="up1"] .account-reveal').evaluate(e=>e.getBoundingClientRect().bottom<=e.closest('.account-card').getBoundingClientRect().bottom));
  await page.mouse.move(0,0);await page.waitForTimeout(400);
  ok('leaving collapses the stats again',await page.locator('.account-card.revealed').count()===0);
  await page.emulateMedia({reducedMotion:'reduce'});

  await page.evaluate(()=>{MUSTEAT.state.up=[];MUSTEAT.render()});await page.locator('[data-flow="unknown"]').click();
  ok('missing records remain unavailable',/Lifetime earnings\s*Not recorded[\s\S]*Lifetime tax\s*Not recorded/.test(await page.locator('.account-card.revealed .account-reveal').innerText()));
  await page.evaluate(()=>{MUSTEAT.state.up=[{id:'hostile',name:'<img src=x onerror=alert(1)>',total:12}];MUSTEAT.render()});await page.locator('[data-flow="up1"]').click();
  ok('citizen names are escaped in hover cards',await page.locator('#pfFlow img').count()===0&&(await page.locator('[data-flow="up1"] .account-head strong').innerText()).includes('<img'));
  ok('no browser errors',errors.length===0);
  console.log('\n'+checks+' passed');
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

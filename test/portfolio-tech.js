// Own-tech cards and income attribution, using the local sheet mock.
const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
start(0,async({srv,url})=>{
 let browser,checks=0;
 const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};
 try{
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1000,height:1000},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Solo Inspector');await page.click('#go');
  await page.waitForFunction(()=>MUSTEAT.state.id);
  await page.evaluate(()=>{Object.assign(MUSTEAT.state,{gear:{trainers:12,hover:16,drones:7,pod:10,mask:3},upg:{},techEarnings:{},total:1e8,cash:1e6,portfolioUnlocked:true,tab:'portfolio',nextEvent:Date.now()+1e9,crateAt:Date.now()+1e9,told:{gang:Date.now(),rec:Date.now()}});MUSTEAT.render()});
  ok('owned producers and support tech each have a tile',await page.locator('.asset-tile').count()===5);
  ok('desktop uses a three-column grid',await page.locator('.asset-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===3));
  ok('no unowned tech or default sprite images',await page.locator('[data-asset="portal"],.asset-tile img').count()===0);
  ok('support tiles show effects, not invented earnings',/×2.0 order value/.test(await page.locator('[data-asset="pod"]').innerText())&&/−75% trouble/.test(await page.locator('[data-asset="mask"]').innerText()));
  ok('empty social and trophy sections are hidden',await page.locator('#pfRunners').evaluate(e=>e.closest('section').hidden)&&await page.locator('#portfolio').evaluate(e=>e.closest('section').hidden));
  ok('solo invitation recognises the player’s work',/You built all this yourself/.test(await page.locator('#pfEmpire').innerText()));
  ok('operation scene stays last',await page.locator('#operation').evaluate(e=>e.closest('section')===document.querySelector('#tab-portfolio').lastElementChild));
  const before=await page.evaluate(()=>({total:MUSTEAT.state.total,tracked:Object.values(MUSTEAT.state.techEarnings).reduce((a,b)=>a+b,0)}));
  await page.waitForTimeout(500);
  const after=await page.evaluate(()=>({total:MUSTEAT.state.total,tracked:Object.values(MUSTEAT.state.techEarnings).reduce((a,b)=>a+b,0)}));
  ok('live attribution sums to actual automatic credits',after.tracked>before.tracked&&Math.abs((after.total-before.total)-(after.tracked-before.tracked))<1e-5);
  const check=await page.evaluate(()=>{
   const s=MUSTEAT.state;const upgrade=MUSTEAT.UPGRADES.find(u=>u.gear==='hover');s.upg[upgrade.id]=true;
   s.fx={rush:Date.now()+100000,rain:Date.now()+100000};s.techEarnings={};s.lastSeen=Date.now()-120000;
   const c=MUSTEAT.calc(s),total=s.total,off=MUSTEAT.offline(s),sum=Object.values(s.techEarnings).reduce((a,b)=>a+b,0);
   return{sum,gain:off.gain,credited:s.total-total,base:c.baseIncome*120,ratio:s.techEarnings.hover/s.techEarnings.trainers,expected:(.6*16*2)/(.1*12),support:'pod' in s.techEarnings||'mask' in s.techEarnings};
  });
  ok('offline allocation matches credited earnings',Math.abs(check.sum-check.gain)<1e-6&&Math.abs(check.credited-check.gain)<1e-6);
  ok('offline uses its base rate despite active rush and rain',Math.abs(check.gain-check.base)<1);
  ok('production upgrades change the allocation without double-counting support',Math.abs(check.ratio-check.expected)<1e-8&&!check.support);
  ok('taps and rations are not mislabelled as automated tech earnings',await page.evaluate(()=>{const s=MUSTEAT.state,before=JSON.stringify(s.techEarnings);MUSTEAT.runDelivery();s.rationDue=Date.now()-1;MUSTEAT.claimRation();return JSON.stringify(s.techEarnings)===before}));
  ok('per-tech records and their start date survive recovery',await page.evaluate(async()=>{const s=MUSTEAT.state,copy=await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(s));return JSON.stringify(s.techEarnings)===JSON.stringify(copy.techEarnings)&&copy.techEarningsSince===s.techEarningsSince}));
  ok('invalid recovered earnings are rejected',await page.evaluate(async()=>{const s=structuredClone(MUSTEAT.state);s.techEarnings.hover=-1;try{await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(s));return false}catch{return true}}));
  ok('legacy recovery invents no historical per-tech earnings',await page.evaluate(async()=>{const s=structuredClone(MUSTEAT.state);delete s.techEarnings;delete s.techEarningsSince;const copy=await MUSTEAT.decodeRecovery(await MUSTEAT.encodeRecovery(s));return Object.keys(copy.techEarnings).length===0&&copy.total===s.total}));
  const recorded=await page.evaluate(()=>{MUSTEAT.state.fx={};MUSTEAT.save();return {...MUSTEAT.state.techEarnings}});
  await page.reload();await page.waitForFunction(()=>MUSTEAT.state.id);
  ok('recorded earnings survive reload',await page.evaluate(before=>Object.entries(before).every(([id,v])=>MUSTEAT.state.techEarnings[id]>=v),recorded));
  await page.evaluate(()=>{const s=MUSTEAT.state;s.tab='portfolio';for(const g of MUSTEAT.GEAR)s.gear[g.id]=g.max||12;s.lastSeen=Date.now()-600000;MUSTEAT.offline(s);MUSTEAT.render()});
  ok('all twelve owned technologies fit the collection',await page.locator('.asset-tile').count()===12);
  await page.screenshot({path:'.logs/portfolio-tech-desktop.png',fullPage:true});
  await page.setViewportSize({width:360,height:800});
  await page.waitForFunction(()=>innerWidth===360&&getComputedStyle(document.querySelector('.asset-grid')).gridTemplateColumns.split(' ').length===2);
  ok('mobile keeps a two-column grid within the viewport',await page.locator('.asset-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===2&&document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#pfTech').scrollIntoViewIfNeeded();await page.screenshot({path:'.logs/portfolio-tech-mobile.png',fullPage:true});
  ok('existing lifetime earnings and tracking limits are visible',/Lifetime earned · all sources[\s\S]*Earlier earnings were not split by tech/i.test(await page.locator('#pfTech').innerText()));
  ok('no browser errors',errors.length===0);
  console.log(`\n${checks} passed`);
 }catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}
});

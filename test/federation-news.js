const {chromium}=require('playwright');
const {start}=require('./sheetmock');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const headlines=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8').match(/const FEDERATION_NEWS = (\[[\s\S]*?\n\]);/)[1]);
start(0,async({srv,url})=>{let browser,checks=0;const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name)};try{
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1000,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.newsTime=Date.now();Date.now=()=>window.newsTime});
 await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Bottom Rung');await page.click('#go');await page.waitForFunction(()=>MUSTEAT.state.id);
 await page.evaluate(()=>{const s=MUSTEAT.state;s.ref='BOSS';s.shop=null;s.nextEvent=Date.now()+1e9;s.crateAt=Date.now()+1e9;s.told={gang:Date.now(),rec:Date.now()};MUSTEAT.render()});
 ok('exactly 50 distinct short headlines',headlines.length===50&&new Set(headlines.map(h=>h[0])).size===50&&headlines.every(h=>h[0].replaceAll('|','').length<=60));
 const seen=new Set();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const advance=()=>page.evaluate(()=>{newsTime+=45000;MUSTEAT.render()});
 // Empty the initial pre-registration bag, then sample a complete eligible cycle.
 for(let i=0;i<100;i++){await advance();seen.add(+await page.locator('#federationNews').getAttribute('data-headline'))}
 ok('all 50 can appear for a solo runner paying both taxes',seen.size===50);
 for(const width of [1000,521,360]){
  await page.setViewportSize({width,height:900});
  let fits=true;
  for(const [text] of headlines){fits&&=await page.locator('#federationNews').evaluate((e,text)=>{e.textContent=text.replace(/\.$/,'')+'_';const r=e.getBoundingClientRect(),card=e.closest('.stat').getBoundingClientRect();return e.scrollWidth<=e.clientWidth&&r.bottom<=card.bottom&&document.documentElement.scrollWidth<=innerWidth},text)}
  ok('every headline fits without scrolling or clipping at '+width+'px',fits);
 }
 await advance();const index=await page.locator('#federationNews').getAttribute('data-headline');
 await page.evaluate(()=>{newsTime+=44999;MUSTEAT.render()});
 ok('headlines stay put for a full forty-five seconds',await page.locator('#federationNews').getAttribute('data-headline')===index);
 await page.evaluate(()=>{
   window.newsMotion={flashes:0,beforeTyping:true,typed:false};let previous=false;
   newsTime+=1;MUSTEAT.render();
   const watch=()=>{const cursor=document.querySelector('.news-caret');if(!cursor)return;const chars=[...document.querySelectorAll('.news-char')],visible=chars.filter(e=>e.style.opacity==='1').length;
     const flash=document.querySelector('.news-rabbit')?.style.opacity==='1';
     if(flash&&!previous){newsMotion.flashes++;newsMotion.beforeTyping&&=visible===0}previous=flash;
     newsMotion.typed||=visible>0&&visible<chars.length;requestAnimationFrame(watch)};
   requestAnimationFrame(watch);
 });
 ok('headline advances at forty-five seconds',await page.locator('#federationNews').getAttribute('data-headline')!==index);
 ok('scrolling label runs at the slower forty-five-second pace',await page.locator('.news-track').evaluate(e=>getComputedStyle(e).animationDuration==='45s'));
 await page.waitForFunction(()=>!document.querySelector('.news-caret'));
 ok('rabbit flashes twice before the headline speed-types',await page.evaluate(()=>newsMotion.flashes===2&&newsMotion.beforeTyping&&newsMotion.typed));
 ok('finished headline replaces the full stop with an underscore and clears the boot animation',await page.locator('.news-caret,.news-rabbit,.news-char').count()===0&&await page.locator('#federationNews').innerText()===headlines[+await page.locator('#federationNews').getAttribute('data-headline')][0].replace(/\.$/,'')+'_');
 ok('no player controls or purple emphasis remain in the card',await page.locator('#newsCard button,#federationNews b').count()===0&&await page.locator('#federationNews').evaluate(e=>e.children.length===1&&getComputedStyle(e).color==='rgb(199, 210, 212)'));
 ok('underscore is white with a gentle blink and small bloom',await page.locator('.news-end-caret').evaluate(e=>{const s=getComputedStyle(e);return s.color==='rgb(255, 255, 255)'&&s.animationDuration==='2.8s'&&s.textShadow!=='none'&&e.getAttribute('aria-hidden')==='true'}));
 const beforeStateChange=await page.locator('#federationNews').getAttribute('data-headline');
 await page.evaluate(()=>{const s=MUSTEAT.state;s.shop={name:'No Longer Yours',at:Date.now()};s.down.list=[{id:'r1',name:'Accomplice',level:1,total:0}];MUSTEAT.render()});
 ok('changing player state does not refresh the card early',await page.locator('#federationNews').getAttribute('data-headline')===beforeStateChange);
 let generalOnly=true;for(let i=0;i<45;i++){await advance();generalOnly&&=!headlines[+await page.locator('#federationNews').getAttribute('data-headline')][1]}
 ok('tax and bottom-rung jokes stop when no longer applicable',generalOnly);
 await page.emulateMedia({reducedMotion:'reduce'});
 const still=await page.locator('#federationNews').getAttribute('data-headline');await advance();
 ok('reduced motion stops both the headline and scrolling label',await page.locator('#federationNews').getAttribute('data-headline')===still&&await page.locator('.news-track').evaluate(e=>getComputedStyle(e).animationName==='none'));
 ok('reduced motion keeps the underscore static',await page.locator('.news-end-caret').evaluate(e=>getComputedStyle(e).animationName==='none'));
 await page.locator('#federationNews').evaluate(e=>{e.firstChild.textContent='Social ladder inspection: you are the floor'});
 await page.locator('.stats').screenshot({path:'.logs/federation-news-mobile.png'});
 await page.setViewportSize({width:1000,height:900});await page.locator('.stats').screenshot({path:'.logs/federation-news-desktop.png'});
 ok('no browser errors',errors.length===0);console.log(`\n${checks} passed`);
}catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();srv.close()}});

// The header countdown follows score playtime and never crowds the news ticker.
const { chromium } = require('playwright');
const { start } = require('./sheetmock');
const assert = require('node:assert/strict');
start(0, async ({srv,url}) => {
  let browser, checks=0;
  const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('  ok   '+name);};
  try {
    browser=await chromium.launch();
    const page=await browser.newPage({viewport:{width:1100,height:850}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.__clockTime=Date.now();Date.now=()=>window.__clockTime;});
    await page.goto(url+'index.html?dev');await page.click('#intro');await page.fill('#nm','Clock Watcher');await page.click('#go');await page.waitForFunction(()=>MUSTEAT.state.id);
    await page.evaluate(()=>{const s=MUSTEAT.state;s.nextEvent=Date.now()+1e9;s.crateAt=Date.now()+1e9;s.told={gang:Date.now(),rec:Date.now()};MUSTEAT.render();});
    const clock=page.locator('#leaderboardClock'), label=page.locator('#leaderboardClockLabel');
    ok('new citizens start at 30:00',await label.textContent()==='30:00');
    ok('countdown is inactive and skipped by keyboard navigation',await clock.getAttribute('aria-disabled')==='true'&&await clock.getAttribute('tabindex')==='-1');
    const before=page.url();await clock.click({force:true});
    ok('clicking the running countdown does nothing',page.url()===before&&await page.isHidden('#highscoresView')&&await page.isHidden('#modal'));
    await page.mouse.move(0,0);
    const normal=await clock.evaluate(el=>getComputedStyle(el).borderColor);
    await clock.hover();await page.waitForTimeout(250);
    ok('hover brings out the red border and ominous glow',await clock.evaluate((el,normal)=>getComputedStyle(el).borderColor!==normal&&getComputedStyle(el).boxShadow!=='none',normal));
    await page.screenshot({path:'/private/tmp/musteat-countdown-hover.png'});
    await page.evaluate(()=>{window.__clockTime+=1000;MUSTEAT.frame();});
    ok('one active second counts down once',await label.textContent()==='29:59');
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});window.__clockTime+=60000;MUSTEAT.frame();delete document.hidden;});
    ok('background time does not spend the comparison clock',await label.textContent()==='29:59');
    await page.evaluate(()=>{MUSTEAT.state.played=29;MUSTEAT.save();});await page.reload();await page.waitForFunction(()=>MUSTEAT.state.id);
    ok('refresh resumes saved playtime at 29:31',await label.textContent()==='29:31');
    const sizes=[];
    for(const width of [320,360,520,600,1100]) {
      await page.setViewportSize({width,height:850});
      for(const ready of [false,true]) for(const decrypted of [false,true]) {
        await page.evaluate(({ready,decrypted})=>{const s=MUSTEAT.state;s.played=ready?1800:29;if(decrypted)s.upg.propaganda=true;else delete s.upg.propaganda;MUSTEAT.render();},{ready,decrypted});
        await page.waitForTimeout(50);
        const layout=await page.evaluate(()=>{
          const clock=document.getElementById('leaderboardClock').getBoundingClientRect(),logo=document.querySelector('#gameView h1').getBoundingClientRect(),news=document.getElementById('newsCard').getBoundingClientRect(),button=document.getElementById('leaderboardClock');
          return {width:clock.width,height:clock.height,fit:document.documentElement.scrollWidth<=innerWidth&&clock.right<=innerWidth&&clock.left>=logo.right&&clock.bottom<news.top&&button.scrollWidth<=button.clientWidth};
        });
        assert.ok(layout.fit,`header/ticker overflow at ${width}, ready=${ready}, CRT=${decrypted}`);sizes.push(layout.width+':'+layout.height);
      }
    }
    ok('countdown and unlocked button fit beside the logo above both tickers at 320–1100px',true);
    ok('unlocking never changes the pill dimensions',new Set(sizes).size===1);
    await page.evaluate(()=>{const s=MUSTEAT.state;s.played=1799.5;s.gear={trainers:3};MUSTEAT.render();});
    ok('final fraction of a second still displays 00:01',await label.textContent()==='00:01'&&await clock.getAttribute('aria-disabled')==='true');
    const cash=await page.evaluate(()=>MUSTEAT.state.cash);
    await page.evaluate(()=>{window.__clockTime+=500;MUSTEAT.frame();});
    ok('zero keeps the red glyph and enables the Leaderboards button',await label.textContent()==='Leaderboards'&&await clock.getAttribute('aria-disabled')==='false'&&await clock.getAttribute('tabindex')==='0'&&await clock.evaluate(el=>getComputedStyle(el).color==='rgb(232, 76, 101)'&&getComputedStyle(el.querySelector('svg')).display!=='none'));
    ok('reaching zero records minute 30 and keeps the game earning',await page.evaluate(cash=>MUSTEAT.state.pace[30]!=null&&MUSTEAT.state.cash>cash,cash));
    await clock.focus();await page.keyboard.press('Enter');await page.waitForSelector('#highscoresView:not([hidden])');
    ok('unlocked button opens the in-page 30-minute leaderboard',page.url().endsWith('#highscores?minute=30&order=pace')&&await page.inputValue('#ledger-scoreMinute')==='30');
    await page.click('#highscoresView p [data-back-game]');await page.waitForSelector('#gameView:not([hidden])');
    await page.evaluate(()=>{window.__clockTime+=1000;MUSTEAT.frame();});
    ok('the game continues past 30 minutes without a negative countdown',await label.textContent()==='Leaderboards'&&await page.evaluate(()=>MUSTEAT.state.played>1800));
    await page.setViewportSize({width:360,height:850});await page.screenshot({path:'/private/tmp/musteat-countdown-ready-mobile.png'});
    await page.emulateMedia({reducedMotion:'reduce'});
    ok('reduced motion disables the hover transition',await clock.evaluate(el=>getComputedStyle(el).transitionDuration==='0s'));
    ok('no browser errors',errors.length===0);
    console.log('\n'+checks+' countdown checks passed.');
  }catch(e){console.error(e);process.exitCode=1;}finally{if(browser)await browser.close();srv.close();}
});

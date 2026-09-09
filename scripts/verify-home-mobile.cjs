const assert=require('node:assert/strict');
const {chromium}=require(process.env.OMICSFM_PLAYWRIGHT||'playwright');
const base=process.env.OMICSFM_TEST_URL||'http://localhost:8000/';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const width of [320,390]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{let display;Object.defineProperty(window,'OmicsFMDisplay',{get:()=>display,set(value){display=value;let connect;Object.defineProperty(value,'connect',{get:()=>connect,set(fn){connect=c=>{window.testHome=c;return fn(c);};}});}});});
   await page.goto(base+'Home.dc.html');await page.waitForFunction(()=>window.testHome?.state.data);await page.evaluate(()=>testHome.stopTimer());
   const toggles=page.locator('.mobile-modality-toggle');
   assert.equal(await toggles.count(),3);
   for(const theme of ['dark','light']){
    if(theme==='light')await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
    for(let i=0;i<3;i++){
     const button=toggles.nth(i),panel=page.locator('.modality-content').nth(i);
     assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await panel.isVisible(),false);
     await button.click();await page.waitForTimeout(80);
     assert.equal(await button.getAttribute('aria-expanded'),'true');assert(await panel.isVisible());
     const br=await button.boundingBox(),pr=await panel.boundingBox();assert(Math.abs(pr.y-br.y-br.height)<2,'Panel immediately below its own heading');
     if(i<2)assert((await toggles.nth(i+1).boundingBox()).y>=pr.y+pr.height,'Next heading below expanded panel');
     assert(await panel.locator('a').first().isVisible());
     await button.click();assert.equal(await panel.isVisible(),false);
    }
    await toggles.nth(0).focus();await page.keyboard.press('Space');assert.equal(await toggles.nth(0).getAttribute('aria-expanded'),'true');
    await toggles.nth(1).click();assert.equal(await toggles.nth(0).getAttribute('aria-expanded'),'false');assert.equal(await toggles.nth(1).getAttribute('aria-expanded'),'true');await toggles.nth(1).click();
    assert.equal(await page.getByRole('link',{name:'Start exploring',exact:true}).isVisible(),false);
    for(let scene=0;scene<10;scene++){
     await page.evaluate(i=>{testHome.goScene(i);testHome.stopTimer();},scene);await page.waitForTimeout(100);
     const colors=await page.evaluate(()=>{const c=(testHome.state.front?testHome.hB:testHome.hA).current,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let lime=0,pink=0,purple=0;for(let i=0;i<d.length;i+=4){const [r,g,b,a]=d.slice(i,i+4);if(a<100)continue;if(r>180&&g>240&&b<30)lime++;if(r>240&&g<70&&b>90&&b<140)pink++;if([[139,92,255],[170,131,255],[81,0,253]].some(v=>Math.abs(r-v[0])<3&&Math.abs(g-v[1])<3&&Math.abs(b-v[2])<3))purple++;}return {lime,pink,purple,sc:testHome.SCENES[testHome.state.scene].mod};});
     assert(colors[colors.sc==='single_cell'?'pink':'lime']>10,`${width} ${theme} scene ${scene+1}: brand points ${JSON.stringify(colors)}`);
     assert.equal(colors.purple,0,'No purple carousel points');
     const height=(await page.locator('[data-screen-label="Carousel card"]').boundingBox()).height;assert(height<270,`${width}: compact card ${height}`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    console.log('PASS',width,theme,'accordion placement, collapse, keyboard, links, compact cards and ten highlight palettes');
   }
   assert.deepEqual(errors,[]);
   // Resizing back to desktop restores the original three columns and CTA.
   await page.setViewportSize({width:1366,height:900});await page.waitForTimeout(200);
   assert.equal(await toggles.first().isVisible(),false);
   for(let i=0;i<3;i++)assert(await page.locator('.modality-content').nth(i).locator('a').first().isVisible());
   assert(await page.getByRole('link',{name:'Start exploring',exact:true}).isVisible());
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

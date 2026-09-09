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
   const hero=await page.locator('[data-screen-label=Hero]').boundingBox(),first=await toggles.first().boundingBox();assert(Math.abs(first.y-hero.y-hero.height)<2,'No gap below the off-white carousel card');
   for(let i=0;i<2;i++){const a=await toggles.nth(i).boundingBox(),b=await toggles.nth(i+1).boundingBox();assert(Math.abs(b.y-a.y-a.height)<1,'No white slivers between modality rows');}
   for(const theme of ['dark','light']){
    if(theme==='light')await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
    if(theme==='light'){
     const expected=[['rgb(192, 254, 4)','rgb(10, 10, 12)'],['rgb(81, 0, 253)','rgb(244, 244, 245)'],['rgb(252, 45, 118)','rgb(10, 10, 12)']];
     for(let i=0;i<3;i++)assert.deepEqual(await toggles.nth(i).evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el).color]),expected[i]);
    }
    for(let i=0;i<3;i++){
     const button=toggles.nth(i),panel=page.locator('.modality-content').nth(i);
     assert.equal(await button.getAttribute('aria-expanded'),'false');assert.equal(await panel.isVisible(),false);
     await button.click();await page.waitForTimeout(750);
     assert(Math.abs((await button.boundingBox()).y-72)<3,'Opening scrolls the modality below the fixed header');
     assert.equal(await button.getAttribute('aria-expanded'),'true');assert(await panel.isVisible());
     if(theme==='light'){const band=await panel.locator(':scope>div').first().evaluate(el=>({bg:getComputedStyle(el).backgroundColor,padding:parseFloat(getComputedStyle(el).paddingBottom)}));assert.equal(band.bg,await button.evaluate(el=>getComputedStyle(el).backgroundColor));assert(band.padding>=18,'Colour band extends below project count');}
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
     assert(colors[{proteomics:'lime',bulk:'purple',single_cell:'pink'}[colors.sc]]>10,`${width} ${theme} scene ${scene+1}: brand points ${JSON.stringify(colors)}`);
     const annotations=await page.evaluate(()=>({labels:testHome._heroLabels,points:testHome._heroFit.highlighted.map(p=>[testHome._heroFit.X(p),testHome._heroFit.Y(p)]),expected:testHome.SCENES[testHome.state.scene].family==='immunoglobulins'?2:1}));
     assert.equal(annotations.labels.length,annotations.expected,'Every carousel annotation is visible');
     for(const label of annotations.labels)assert(!annotations.points.some(p=>Math.abs(p[0]-label.x)<label.width/2+6&&Math.abs(p[1]-label.y)<label.height/2+6),'Labels clear highlighted dots');
     assert.equal(await page.locator('[data-screen-label="Carousel card"]').evaluate(el=>getComputedStyle(el).backgroundColor),theme==='light'?'rgb(231, 231, 237)':'rgb(19, 19, 22)');
     const height=(await page.locator('[data-screen-label="Carousel card"]').boundingBox()).height;assert(height<270,`${width}: compact card ${height}`);
    }
    const cards=page.locator('.representation-cards');
    await cards.scrollIntoViewIfNeeded();
    assert.equal(await cards.locator(':scope>div').first().evaluate(el=>getComputedStyle(el).backgroundColor),theme==='light'?'rgb(231, 231, 237)':'rgb(19, 19, 22)');
    const previous=page.getByRole('button',{name:'Previous representation',exact:true}),next=page.getByRole('button',{name:'Next representation',exact:true});
    assert(await previous.isDisabled());
    for(let i=1;i<=2;i++){await next.click();assert(await cards.locator(':scope>div').nth(i).isVisible());assert.equal(await cards.locator(':scope>div').nth(i-1).isVisible(),false);assert.equal(await page.locator('.representation-controls>span').textContent(),String(i+1).padStart(2,'0')+' / 03');}
    assert(await next.isDisabled());await previous.click();await previous.focus();await page.keyboard.press('Enter');assert(await previous.isDisabled());
    if(theme==='light'){
     for(let i=0;i<3;i++){
      const footer=page.locator('.task-grid>a').nth(i).locator(':scope>div:last-child>div:last-child');
      assert.equal(await footer.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
      assert.equal(await footer.locator('span').last().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(192, 254, 4)');
     }
     for(const chip of await page.locator('.family-chip[aria-pressed=false]').all())assert.equal(await chip.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(231, 231, 237)');
     await page.locator('.family-chip').nth(1).click();assert.equal(await page.locator('.family-chip[aria-pressed=true]').textContent(),'histones');
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
   for(const card of await page.locator('.representation-cards>div').all())assert(await card.isVisible());
   assert.equal(await page.locator('.representation-controls').isVisible(),false);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

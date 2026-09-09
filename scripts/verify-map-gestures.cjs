const assert=require('node:assert/strict');
const {chromium}=require(process.env.OMICSFM_PLAYWRIGHT || 'playwright');
const base=process.env.OMICSFM_TEST_URL || 'http://localhost:8000/';
const names=['Proteomics Samples','Proteomics Proteins','Bulk Samples','Bulk Genes','Single-cell Samples','Single-cell Genes'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:{width:mobile?390:1366,height:844},isMobile:mobile,hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];
   // Capture the map at mount time in the test context only.
   await page.addInitScript(()=>{let display;Object.defineProperty(window,'OmicsFMDisplay',{get:()=>display,set(value){display=value;let connect;Object.defineProperty(value,'connect',{get:()=>connect,set(fn){connect=c=>{window.testMap=c;return fn(c);};}});}});});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.text().includes('passive event listener'))errors.push(m.text());});
   for(const name of names){
    await page.goto(base+encodeURIComponent(name+'.dc.html'));await page.waitForSelector('.theme-toggle');
    const canvas=page.locator('[data-screen-label="Plot"]>canvas');await page.waitForFunction(()=>window.testMap?.state.d);await page.waitForTimeout(100);
    const view=()=>page.evaluate(()=>({...testMap.state.view}));
    const before=await view();
    const canceled=await canvas.evaluate(el=>{const r=el.getBoundingClientRect();const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-100,clientX:r.x+r.width/2,clientY:r.y+r.height/2});el.dispatchEvent(e);return e.defaultPrevented;});
    await page.waitForTimeout(80);
    assert(canceled,name+': cancel native page zoom');
    assert(Math.abs((await view()).k-before.k*Math.exp(.1575))<.00001,name+': apply wheel zoom exactly once');
    const box=await canvas.boundingBox(),x=Math.round(box.x+box.width/2),y=Math.round(box.y+box.height/2);
    const session=await context.newCDPSession(page);
    const scale=await page.evaluate(()=>visualViewport.scale),wheelView=await view();
    await session.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaY:-100,deltaX:0,modifiers:2});await page.waitForTimeout(150);
    assert((await view()).k>wheelView.k,name+': native trackpad wheel zooms map');
    assert.equal(await page.evaluate(()=>visualViewport.scale),scale,name+': wheel leaves page scale unchanged');
    const pinchView=await view();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-40,y,id:1},{x:x+40,y,id:2}]});
    for(const d of [50,60,70,80])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-d,y,id:1},{x:x+d,y,id:2}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(150);
    assert(Math.abs((await view()).k/pinchView.k-2)<.02,name+': pinch doubles map zoom');
    assert.equal(await page.evaluate(()=>visualViewport.scale),scale,name+': pinch leaves page scale unchanged');
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.panel),'map');
    // The Safari gesture fallback is cancelable and changes the map at its anchor.
    const gestureView=await view();
    const gestures=await canvas.evaluate(el=>{const r=el.getBoundingClientRect();return ['gesturestart','gesturechange','gestureend'].map(type=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{scale:1.1,clientX:r.x+r.width/2,clientY:r.y+r.height/2});el.dispatchEvent(e);return e.defaultPrevented;});});
    await page.waitForTimeout(80);assert(gestures.every(Boolean));assert(Math.abs((await view()).k/gestureView.k-1.1)<.001);
    const outside=await page.locator('header').evaluate(el=>{const e=new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-100});el.dispatchEvent(e);return e.defaultPrevented;});
    assert.equal(outside,false,'Do not disable browser zoom outside the map');
    assert.deepEqual(errors,[],name);await session.detach();
    console.log('PASS',mobile?'phone':'desktop touchscreen',name,'wheel, pinch, Safari gesture fallback, page zoom isolation');
   }
   await context.close();
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

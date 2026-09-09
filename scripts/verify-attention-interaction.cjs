const assert=require('node:assert/strict');
const {chromium}=require(process.env.OMICSFM_PLAYWRIGHT||'playwright');
const base=process.env.OMICSFM_TEST_URL||'http://localhost:8000/';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:{width:mobile?390:1366,height:900},isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{let display;Object.defineProperty(window,'OmicsFMDisplay',{get:()=>display,set(value){display=value;let connect;Object.defineProperty(value,'connect',{get:()=>connect,set(fn){connect=c=>{window.testMap=c;return fn(c);};}});}});});
  for(const name of ['Proteomics Attention','Bulk Attention']){
   await page.goto(base+encodeURIComponent(name+'.dc.html'));
   await page.waitForFunction(()=>window.testMap?.nodesDS?.length>0 && !testMap.state.loading && testMap.pageValues().graphVis==='visible');await page.waitForTimeout(300);
   const id=await page.evaluate(()=>{
    const c=testMap,canvas=c.net.canvas.frame.canvas,w=canvas.clientWidth,h=canvas.clientHeight;
    return Object.entries(c.net.getPositions()).map(([id,p])=>({id:+id,...c.net.canvasToDOM(p)})).filter(p=>p.x>70&&p.x<w-90&&p.y>80&&p.y<h-100&&c.net.getNodeAt(p)===p.id).sort((a,b)=>Math.hypot(a.x-w/2,a.y-h/2)-Math.hypot(b.x-w/2,b.y-h/2))[0].id;
   });
   const point=()=>page.evaluate(id=>{const c=testMap,canvas=c.net.canvas.frame.canvas,r=canvas.getBoundingClientRect(),p=c.net.canvasToDOM(c.net.getPositions([id])[id]);return {x:r.x+p.x*r.width/canvas.clientWidth,y:r.y+p.y*r.height/canvas.clientHeight};},id);
   let pos=await point();if(mobile)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);
   await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>testMap.state.sel),-1,'Single click must not open a node');
   const before=await page.evaluate(id=>testMap.net.getPositions([id])[id],id);
   if(mobile){const session=await context.newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pos,id:1}]});for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pos.x+i*6,y:pos.y+i*3,id:1}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();}
   else {await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.mouse.move(pos.x+48,pos.y+24,{steps:8});await page.mouse.up();}
   await page.waitForTimeout(400);
   const after=await page.evaluate(id=>testMap.net.getPositions([id])[id],id);
   assert(Math.hypot(after.x-before.x,after.y-before.y)>5,'Dragging must displace the node');
   assert.equal(await page.evaluate(()=>testMap.state.sel),-1,'Dragging must keep the overview');
   assert.equal(await page.locator('html').getAttribute('data-panel'),'map');
   pos=await point();if(mobile){await page.touchscreen.tap(pos.x,pos.y);await page.touchscreen.tap(pos.x,pos.y);}else await page.mouse.dblclick(pos.x,pos.y);
   await page.waitForFunction(id=>testMap.state.sel===id&&testMap.state.partners!==null,id);
   if(mobile)assert.equal(await page.locator('html').getAttribute('data-panel'),'details');
   const row=page.locator('.attention-partner').first();await row.waitFor();
   assert.equal(await row.locator('.attention-score').evaluate(el=>getComputedStyle(el).fontSize),'14px');
   assert(Math.abs(await row.locator('.attention-bar').evaluate(el=>parseFloat(getComputedStyle(el).height))-8)<.1);
   assert((await row.locator('.attention-bar').boundingBox()).width>120,'Bar uses the available panel width');
   assert.deepEqual(errors,[]);console.log('PASS',mobile?'touch':'mouse',name,'single click, drag, double-click details and larger scores/bars');
  }await context.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {loadComponent} = require('./verify-site.cjs');
const root = path.resolve(__dirname, '..');
const style = {setProperty(name, value) { this[name] = value; }};
const window = {innerHeight: 768, addEventListener() {}};
let nextFrame;
vm.runInNewContext(fs.readFileSync(path.join(root, 'display.js'), 'utf8'), {
  window, document: {documentElement: {style}},
  performance:{now:()=>0}, cancelAnimationFrame(){},
  requestAnimationFrame(callback){nextFrame=callback;return 1;},
});
assert.equal(style.zoom, '0.8');
assert.equal(style['--omics-viewport-height'], '960px');
const canvas = {clientWidth:1000, clientHeight:600,
  getBoundingClientRect: () => ({left:80,top:40,width:800,height:480})};
assert.deepEqual([...window.OmicsFMDisplay.pointer(canvas, 480, 280)], [500,300]);
const network = {canvas:{frame:{canvas}}, interactionHandler:{}};
window.OmicsFMDisplay.adaptNetwork(network);
assert.equal(network.interactionHandler.getPointer({x:480,y:280}).x, 500);
assert.equal(network.interactionHandler.getPointer({x:480,y:280}).y, 300);
window.scrollY=0;
window.scrollTo=({top})=>{window.scrollY=top;};
window.OmicsFMDisplay.scrollToEnd({getBoundingClientRect:()=>({bottom:968})});
nextFrame(325);
assert.equal(window.scrollY,180, 'Scroll visibly passes through its midpoint');
nextFrame(650);
assert.equal(window.scrollY,360, 'Scroll reveals 160 pixels below the cards');
(async () => {
  for (const name of ['Proteomics Samples','Proteomics Proteins','Bulk Samples','Bulk Genes','Single-cell Samples','Single-cell Genes']) {
    const {instance} = await loadComponent(`${name}.dc.html`);
    instance.cv.current = canvas;
    assert.deepEqual([...instance.pos({clientX:480,clientY:280})], [500,300], name);
    for (const width of [1000,1280,1366,1707,1920,4300]) {
      instance.state.headerW=width;
      instance.state.infoClosed=false;
      const values=instance.renderVals();
      assert.equal(values.colW, values.rightW, `${name}: paper aligns with the information panel`);
      assert.equal(values.navFont, window.OmicsFMDisplay.homeHeaderLayout(width).navFont, `${name}: font matches Home`);
    }
  }
  for (const name of fs.readdirSync(root).filter(name=>name.endsWith('.dc.html'))) {
    const html=fs.readFileSync(path.join(root,name),'utf8');
    const displayAsset=html.match(/src="\.\/(assets\/runtime\/display\.([a-f0-9]+)\.js)"/);
    assert(displayAsset, `${name}: runtime must have a versioned URL`);
    const runtime=fs.readFileSync(path.join(root,displayAsset[1]),'utf8').replace(/\r\n/g,'\n');
    assert.equal(runtime,fs.readFileSync(path.join(root,'display.js'),'utf8').replace(/\r\n/g,'\n'));
    assert.equal(require('node:crypto').createHash('sha256').update(runtime).digest('hex').slice(0,12),displayAsset[2]);
    assert(html.includes('height:var(--omics-viewport-height,100vh)'),name);
    const header=html.slice(html.indexOf('<header'),html.indexOf('</header>'));
    assert(header.includes('height:72px'),name);
    if (name !== 'Home.dc.html') {
      const paper=header.match(/<a href="https:\/\/www.biorxiv.org\/[\s\S]*?<\/a>/)[0];
      assert(paper.includes('border:2px solid transparent'),name);
      assert(paper.includes('style-hover="border-color:currentColor"'),name);
    }
  }
  const {instance} = await loadComponent('Home.dc.html');
  for (let scene=0; scene<instance.SCENES.length; scene++) {
    instance.state.scene=scene;
    assert(!/\d[\d,]* of \d/i.test(instance.renderVals().sceneReadout));
  }
  console.log('PASS default 80% scale, aligned explorer headers, extended animated scroll, six UMAP and network pointer mappings, and carousel readouts');
})().catch(error=>{console.error(error);process.exitCode=1;});

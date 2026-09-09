const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadComponent} = require('./verify-site.cjs');
const root = path.resolve(__dirname, '..');

(async () => {
  for (const name of ['Proteomics Samples','Bulk Samples','Single-cell Samples','Proteomics Proteins','Bulk Genes','Single-cell Genes']) {
    const {instance:p} = await loadComponent(name + '.dc.html');
    for (const [w,h] of [[650,596],[1000,650],[2600,1080],[3400,720]]) {
      p.cv.current.clientWidth=w; p.cv.current.clientHeight=h;
      for (const view of [{k:1,x:0,y:0},{k:2.5,x:73,y:-42}]) {
        p.state.view=view;
        const g=p.geom(), a=g.P(0,0), x=g.P(1,0), y=g.P(0,1);
        const stretch = name.startsWith('Proteomics') ? 1.4 : 1;
        assert(Math.abs((x[0]-a[0])+stretch*(y[1]-a[1]))<1e-8, `${name}: unexpected axis proportions at ${w}`);
        assert.equal(a[1],x[1]); assert.equal(a[0],y[0]);
        const point=g.P(p.state.d.xy[0],p.state.d.xy[1]);
        assert(Math.abs(point[0]-g.X(0))<1e-8 && Math.abs(point[1]-g.Y(0))<1e-8);
        if(p.toScreen) assert.deepEqual(p.toScreen(g,p.state.d.xy[0],p.state.d.xy[1]),point);
      }
    }
    p.componentWillUnmount();
  }
  for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.dc.html'))) {
    const html=fs.readFileSync(path.join(root,name),'utf8');
    if(name==='Home.dc.html') {
      const header=html.slice(0,html.indexOf('</header>'));
      for(const [label,target] of [['Proteomics','Proteomics Samples.dc.html'],['Bulk transcriptomics','Bulk Samples.dc.html'],['Single-cell transcriptomics','Single-cell Samples.dc.html']]) {
        const links=Array.from(header.matchAll(/<a\s+href="([^"]+)"([^>]*)>(.*?)<\/a>/gs));
        assert(links.some(([,href,attrs,text])=>href===target&&text===label&&attrs.includes('style-hover=')),`${label}: missing sample-map link or hover style`);
      }
    }
    assert(html.includes('assets/brand/fold/wordmark-'), `${name}: missing horizontal logo`);
  }
  console.log('PASS six UMAPs keep consistent proportions at laptop and ultrawide sizes (proteomics 1.4x horizontal), including zoom, pan, dots and annotations; home modality links open their sample maps and retain hover styles.');
})().catch(error=>{console.error(error);process.exitCode=1;});

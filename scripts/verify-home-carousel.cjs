const assert = require('node:assert/strict');
const {loadComponent} = require('./verify-site.cjs');

(async () => {
  const {instance:h} = await loadComponent('Home.dc.html');
  let previousCardWidth=0;
  for(const viewportWidth of [900,1280,1366,1600,1920]) {
    h.state.headerW=viewportWidth; h.state.viewportH=1080;
    const layout=h.renderVals(), width=parseFloat(layout.cardW);
    assert(width>previousCardWidth,'Carousel card should shrink with viewport width');
    assert(parseFloat(layout.cardBodyFont)>=14,'Compact card text should remain readable');
    previousCardWidth=width;
  }
  h.state.viewportH=720;
  assert(parseFloat(h.renderVals().cardW)<previousCardWidth,'Short viewports should also compact the card');
  delete h.state.headerW; delete h.state.viewportH;
  for (const [w,height,cardWidth,cardHeight] of [[1126,654,560,216],[900,650,440,242],[740,640,380,265],[1300,850,560,230],[1174,644,440,265],[1100,596,440,286],[1320,740,440,265],[1100,596,440,325]]) {
    for (const canvas of [h.hA.current,h.hB.current]) {canvas.clientWidth=w;canvas.clientHeight=height;}
    h.hCard.current.clientWidth=cardWidth;h.hCard.current.offsetHeight=cardHeight;
    for (let i=0;i<h.SCENES.length;i++) {
      h.goScene(i);const g=h._heroFit;
      assert(g.highlighted.length>0);
      let hidden=0;
      for (const point of g.highlighted) {
        assert(Number.isFinite(g.X(point))&&Number.isFinite(g.Y(point)));
        const overlaps=g.X(point)<cardWidth+12&&g.Y(point)>height-cardHeight-60;
        if(i===3)hidden+=overlaps;else assert(!overlaps,`Highlight overlaps card: ${w}, scene ${i+1}`);
      }
      if(i===3)assert(hidden/g.highlighted.length<=.12,'Atlas overlap should remain limited');
      const expected=h.SCENES[i].family==='immunoglobulins'?2:1;
      assert.equal(h._heroLabels.length,expected,`Missing annotations: ${w}, scene ${i+1}`);
      if(expected===2) {
        assert.deepEqual(Array.from(h._heroLabels,p=>p.text).sort(),['CONSTANT CHAIN\nIMMUNOGLOBULINS','VARIABLE CHAIN\nIMMUNOGLOBULINS']);
        assert(h._heroLabels.every(p=>p.height===49),'Two-line annotation bounds must include both lines');
      }
      h._heroLabels.forEach((p,j) => {
        assert(p.x-p.width/2>=0&&p.x+p.width/2<=w&&p.y-p.height/2>=0&&p.y+p.height/2<=height);
        assert(!(p.x-p.width/2<cardWidth+12&&p.y+p.height/2>height-cardHeight-60),`Label overlaps card: ${w}, scene ${i+1}`);
        for (const q of h._heroLabels.slice(j+1)) assert(Math.abs(p.x-q.x)>=(p.width+q.width)/2||Math.abs(p.y-q.y)>=(p.height+q.height)/2);
      });
    }
  }
  h.componentWillUnmount();
  console.log('PASS ten scenes at eight sizes including laptop heights: highlights clear the card, atlas dots may overlap up to 12%, focused annotations remain visible and do not overlap');
})().catch(error => {console.error(error);process.exitCode=1;});

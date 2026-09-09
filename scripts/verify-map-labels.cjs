const assert=require('node:assert/strict');
const {loadComponent}=require('./verify-site.cjs');
(async()=>{
 for(const width of [320,390,1366])for(const name of ['Proteomics Samples','Bulk Samples','Single-cell Samples','Proteomics Proteins','Bulk Genes','Single-cell Genes']){
  const {instance:c}=await loadComponent(name+'.dc.html','',{innerWidth:width});
  const canvas=c.cv.current;canvas.clientWidth=width;canvas.clientHeight=700;
  const ctx=canvas.getContext('2d');ctx.measureText=text=>({width:String(text).length*(Number(String(ctx.font).match(/[\d.]+(?=px)/)?.[0])||14)*.6});
  const snapshots=[];
  for(const k of [.4,1,3]){
   c.state.view={k,x:0,y:0};
   const states=name.endsWith('Samples')?[{field:'class',iso:-1,query:''},{field:'class',iso:0,projMode:true,query:''}]:[{query:'',fam:-1,path:-1,sel:-1},{query:'RPL',fam:-1,path:-1,sel:c.state.d.gene.findIndex(g=>g==='RPL3')},{query:'',fam:0,path:-1,sel:0}];
   if(c.state.ov)c.state.ov.labels=true;
   for(const state of states){
    Object.assign(c.state,state);c.draw();const boxes=c._mapLabels;
    assert(Array.isArray(boxes));
    for(let i=0;i<boxes.length;i++){
     const a=boxes[i];assert(a.width>0&&a.height>0&&Number.isFinite(a.x)&&Number.isFinite(a.y));
     assert(a.x-a.width/2>=0&&a.x+a.width/2<=width&&a.y-a.height/2>=0&&a.y+a.height/2<=700,`${name}: labels stay in plot`);
     for(const b of boxes.slice(i+1))assert(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2,`${width} ${name} ${k}: labels overlap`);
    }
    if(state===states[0]&&boxes.length)snapshots.push({k,height:Math.max(...boxes.map(b=>b.height))});
   }
  }
  if(width<900&&snapshots.some(s=>s.k===.4)&&snapshots.some(s=>s.k===1))assert(snapshots.find(s=>s.k===.4).height<snapshots.find(s=>s.k===1).height,name+': labels shrink when zoomed out');
  c.componentWillUnmount();console.log('PASS',width,name,'zoom-aware labels, bounded collision-free annotations, search/selection/project modes');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

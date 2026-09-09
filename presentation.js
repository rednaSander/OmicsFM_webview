// Responsive navigation, accessible theme controls, and touch interaction.
(() => {
  const display = window.OmicsFMDisplay;
  let theme = 'dark', component, chrome, menu, panel = 'map';
  try { theme = localStorage.getItem('omicsfm-theme') === 'light' ? 'light' : 'dark'; } catch (_) {}
  const surfaces = {'#000':'#E7E7ED','#000000':'#E7E7ED','#0A0A0C':'#FFFFFF','#131316':'#FFFFFF','#1B1B20':'#F5F5F8','#1F1F25':'#F0F0F4','#2A2A31':'#D2D2DB','#F4F4F5':'#22222B'};
  const ink = {'#F4F4F5':'#18181F','#FFF':'#18181F','#FFFFFF':'#18181F','#E3E3E8':'#303039','#9A9AA6':'#555562','#5C5C68':'#676775','#C0FE04':'#C0FE04','#8B5CFF':'#8B5CFF','#BCA4FF':'#BCA4FF','#AA83FF':'#AA83FF','#FC2D76':'#FC2D76','#FFB020':'#FFB020'};
  const context = {'#36363F':'#B8B8C4','#3A3A44':'#B8B8C4','#45454F':'#A9A9B7','#1F1F25':'#DDDDE5','#26262C':'#C8C8D2','#6C6C78':'#707080'};
  const key = value => typeof value === 'string' ? value.toUpperCase() : value;
  const neutral = value => value && (key(value) in surfaces || key(value) in context);
  const ui = display.ui = {
    get theme() { return theme; },
    get mobile() { return display.isMobile(); },
    get themeAction() { return theme==='dark'?'Switch to light mode':'Switch to dark mode'; },
    toggleTheme: () => ui.setTheme(theme==='dark'?'light':'dark'),
    bg(value) { return theme === 'light' ? surfaces[key(value)] || value : value; },
    fg(value, background) {
      if (theme !== 'light') return value;
      if (key(background) === '#F4F4F5') return '#F4F4F5';
      if (background && !neutral(background) && background !== 'transparent') return value;
      return ink[key(value)] || value;
    },
    plot(value) {
      if (theme !== 'light') return value;
      if (typeof value === 'string' && /^rgba\(10,\s*10,\s*12,/i.test(value)) return value.replace(/10,\s*10,\s*12/, '255,255,255');
      if (typeof value === 'string' && /^rgba\(244,\s*244,\s*245,/i.test(value)) return value.replace(/244,\s*244,\s*245/, '40,40,50');
      return context[key(value)] || ink[key(value)] || surfaces[key(value)] || value;
    },
    logo(src) {
      if (theme !== 'light' || !src) return src;
      if (src.includes('-white.svg')) return src.replace('-white.svg','-black.svg');
      return src.replace(/-(proteomics|bulk|single_cell)\.svg$/, '-$1-light.svg');
    },
    network(items) {
      if (theme !== 'light') return items;
      const map = value => Array.isArray(value) ? value.map(map) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v)])) : typeof value === 'string' && value.startsWith('#') ? ui.plot(value) : value;
      return items.map(item=>({...item, color:map(item.color), ...(item.font ? {font:map(item.font)} : {})}));
    },
    setTheme(next) {
      theme = next === 'light' ? 'light' : 'dark';
      try { localStorage.setItem('omicsfm-theme',theme); } catch (_) {}
      applyTheme();
      if (component) { component._visual = null; component._applyNetworkTheme?.(); component.forceUpdate(); requestAnimationFrame(()=>{component.drawAll?.();component.draw?.();}); }
    },
    openPanel(next) {
      panel = next;
      document.documentElement.dataset.panel = panel;
      if (next === 'details') component?.pageValues().openInfo?.();
      updateChrome();
    },
  };
  const contexts = new WeakMap();
  display.themeNetwork = c => {
    // Transform presentation colours at the dataset boundary, leaving cached layout logic intact.
    for (const dataset of [c.nodesDS,c.edgesDS]) for (const name of ['add','update']) {
      const original=dataset[name].bind(dataset);
      dataset[name]=items=>original(ui.network(items));
    }
    c._applyNetworkTheme=()=>c.net.setOptions({nodes:{font:{color:ui.fg('#F4F4F5'),strokeColor:ui.bg('#0A0A0C')}}});
    c._applyNetworkTheme();
  };
  // The exported DC templates support property lookups, not function calls.
  ui.BG = new Proxy({}, {get:(_,color)=>ui.bg(color)});
  ui.FG = new Proxy({}, {get:(_,background)=>new Proxy({}, {get:(_,color)=>ui.fg(color,background)})});
  ui.LOGO = new Proxy({}, {get:(_,src)=>ui.logo(src)});
  display.canvasContext = canvas => {
    const ctx=canvas.getContext('2d');
    if(theme!=='light')return ctx;
    if(!contexts.has(ctx))contexts.set(ctx,new Proxy(ctx,{
      get(target,prop){
        if(prop==='fillText')return (text,x,y,...args)=>{
          const badge={'#C0FE04':['#C0FE04','#0A0A0C'],'#8B5CFF':['#5100FD','#F4F4F5'],'#5100FD':['#5100FD','#F4F4F5'],'#FC2D76':['#FC2D76','#0A0A0C']}[key(target.fillStyle)];
          if(!badge)return target.fillText(text,x,y,...args);
          const previous=target.fillStyle,size=Number(target.font.match(/[\d.]+(?=px)/)?.[0])||12;
          const width=Math.min(target.measureText(text).width,args[0]||Infinity),align=target.textAlign;
          const left=x-(align==='center'?width/2:align==='right'||align==='end'?width:0);
          const top=y-(target.textBaseline==='middle'?size/2:target.textBaseline==='top'||target.textBaseline==='hanging'?0:size);
          target.fillStyle=badge[0];target.fillRect(left-2,top-2,width+4,size+4);target.fillStyle=badge[1];
          try{return target.fillText(text,x,y,...args);}finally{target.fillStyle=previous;}
        };
        const value=Reflect.get(target,prop,target);return typeof value==='function'?value.bind(target):value;
      },
      set(target,prop,value){return Reflect.set(target,prop,prop==='fillStyle'||prop==='strokeStyle'?ui.plot(value):value,target);},
    }));
    return contexts.get(ctx);
  };
  function applyTheme() {
    const root=document.documentElement;
    if (root.dataset) root.dataset.theme=theme;
    root.style.colorScheme=theme;
    for (const color of new Set([...Object.keys(surfaces),...Object.keys(ink),...Object.keys(context)])) {
      root.style.setProperty('--ui-bg-'+color.slice(1).toLowerCase(),ui.bg(color));
      root.style.setProperty('--ui-fg-'+color.slice(1).toLowerCase(),ui.fg(color));
    }
    for (const background of [...Object.keys(surfaces),'#C0FE04','#5100FD','#8B5CFF','#FC2D76']) {
      for (const color of ['#0A0A0C','#F4F4F5','#9A9AA6','#5C5C68','#C0FE04','#8B5CFF','#FC2D76']) {
        root.style.setProperty('--ui-on-'+background.slice(1).toLowerCase()+'-'+color.slice(1).toLowerCase(),ui.fg(color,background));
      }
    }
    updateChrome();
  }
  function updateChrome() {
    if (!chrome) return;
    for (const tab of chrome.querySelectorAll('[data-panel]')) tab.setAttribute('aria-pressed',String(panel===tab.dataset.panel));
    const input=document.querySelector('.mobile-search input');
    if (input && document.activeElement!==input) input.value=component?.state.query || '';
  }
  function installChrome() {
    if (chrome || !document.createElement) return;
    const home=!!component.SCENES;
    document.documentElement.dataset.page=home?'home':'explorer';
    document.documentElement.dataset.panel=panel;
    chrome=document.createElement('div'); chrome.className='omics-chrome';
    chrome.innerHTML=`<button class="mobile-menu-toggle" type="button" aria-label="Open navigation" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>`;
    menu=document.createElement('dialog');menu.className='mobile-menu';menu.setAttribute('aria-label','Site navigation');
    menu.innerHTML='<div class="menu-heading"><strong>Explore OmicsFM</strong><button type="button" aria-label="Close navigation">×</button></div><a href="Home.dc.html">Home</a>';
    const current=decodeURIComponent(location.pathname).split('/').pop();
    for (const [label,prefix,views] of [['Proteomics','Proteomics',['Samples','Attention','Proteins']],['Bulk transcriptomics','Bulk',['Samples','Attention','Genes']],['Single-cell transcriptomics','Single-cell',['Samples','Genes']]]) {
      const group=document.createElement('section');const title=document.createElement('h2');title.textContent=label;group.append(title);
      const links=document.createElement('div');
      for (const view of views) { const a=document.createElement('a');a.href=`${prefix} ${view}.dc.html`;a.textContent=view;if(`${prefix} ${view}.dc.html`===current)a.setAttribute('aria-current','page');links.append(a); }
      group.append(links);menu.append(group);
    }
    const paper=document.createElement('a');paper.href='https://www.biorxiv.org/content/10.64898/2026.08.25.747021v1';paper.textContent='Read the paper ↗';menu.append(paper);
    menu.querySelector('button').onclick=()=>menu.close();
    chrome.querySelector('.mobile-menu-toggle').onclick=()=>menu.showModal();
    menu.addEventListener('click',e=>{if(e.target===menu)menu.close();});
    if (!home) {
      const tabs=document.createElement('nav');tabs.className='mobile-panel-tabs';tabs.setAttribute('aria-label','Explorer panels');
      for (const [id,text] of [['map','Map'],['filters','Filters & search'],['details','Details']]) {const b=document.createElement('button');b.type='button';b.dataset.panel=id;b.textContent=text;b.onclick=()=>ui.openPanel(id);tabs.append(b);}chrome.append(tabs);
      const tools=document.createElement('div');tools.className='mobile-map-tools';tools.setAttribute('aria-label','Map controls');
      for (const [text,label,factor] of [['+','Zoom in',1.4],['−','Zoom out',1/1.4],['↺','Reset map',0]]) {const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.onclick=()=>zoom(factor);tools.append(b);}chrome.append(tools);
      const help=document.createElement('div');help.className='mobile-map-help';help.textContent=component.ensureNetwork?'Drag nodes to move · pinch to zoom\nDouble-tap a node for details':'Pinch to zoom · drag to pan\nTap a point for details';
      document.querySelector('[data-screen-label="Plot"], [data-screen-label="Network"]').append(help);
      const form=document.createElement('form');form.className='mobile-search';form.setAttribute('role','search');
      const original=document.querySelector('header input');
      const input=document.createElement('input');input.type='search';input.setAttribute('aria-label','Search this map');input.placeholder=original?.placeholder || 'Search this map';input.autocomplete='off';
      input.oninput=()=>{component.pageValues().onQuery({target:{value:input.value}});};
      const button=document.createElement('button');button.type='submit';button.textContent='Find';
      form.onsubmit=e=>{e.preventDefault();component.pageValues().onQueryKey?.({key:'Enter'});ui.openPanel('map');};form.append(input,button);
      const results=document.createElement('div');results.className='mobile-search-results';form.append(results);
      document.querySelector('[data-screen-label="Controls"]').prepend(form);
    }
    document.body.append(chrome,menu);updateChrome();
  }
  function resetMap() {
    const c=component,patch={query:'',sel:-1,hover:-1,hoverNb:-1,drag:null};
    c._tip=null;
    if(c.ensureNetwork) {
      Object.assign(patch,{iso:-1,legendHover:-1,hoverP:-1,selEdge:-1,hoverEdge:-1,partners:null});
      c._partnerRequest=(c._partnerRequest||0)+1;c._pendingProtein=null;
    } else {
      patch.view={k:1,x:0,y:0};
      if('field' in c.state)Object.assign(patch,{field:'class',iso:-1,projMode:false,projHover:-1,legendHover:-1});
      else {
        Object.assign(patch,{mode:'fam',fam:-1,famHover:-1,path:-1,ov:{...c.state.ov,famOnly:false,mito:false}});
        c._pathSet=null;
      }
    }
    const search=document.querySelector('.mobile-search input');if(search)search.value='';
    c.setState(patch,()=>{
      ui.openPanel('map');
      if(c.net){c.net.unselectAll();c.net.fit({animation:{duration:180}});}
    });
  }
  function zoom(factor) {
    if(!factor){resetMap();return;}
    if(component.net) {component.net.moveTo({scale:component.net.getScale()*factor,animation:{duration:180}});return;}
    const view=component.state.view, k=Math.max(.4,Math.min(14,view.k*factor)),r=k/view.k;
    component.setState({view:{k,x:view.x*r,y:view.y*r}});
  }
  function attachTouch(c) {
    const canvas=c.cv?.current;
    if (!canvas || c.ensureNetwork || !canvas.addEventListener) return ()=>{};
    const pointers=new Map();let start=null, moved=false, lastTouch=0, gesture=null;
    const begin=()=>{const p=[...pointers.values()];start={points:p.map(a=>[...a]),view:{...c.state.view}};};
    const down=e=>{if(e.pointerType==='mouse')return;e.preventDefault();lastTouch=Date.now();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,display.pointer(canvas,e.clientX,e.clientY));moved=pointers.size>1;begin();};
    const move=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,display.pointer(canvas,e.clientX,e.clientY));const p=[...pointers.values()],v=start.view;
      if(p.length===1){const dx=p[0][0]-start.points[0][0],dy=p[0][1]-start.points[0][1];if(Math.hypot(dx,dy)>6)moved=true;c.setState({view:{k:v.k,x:v.x+dx,y:v.y+dy}});}
      else {moved=true;const mid=a=>[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],dist=a=>Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),a=mid(start.points),b=mid(p),k=Math.max(.4,Math.min(14,v.k*dist(p)/Math.max(1,dist(start.points)))),r=k/v.k,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2;c.setState({view:{k,x:b[0]-cx-(a[0]-cx-v.x)*r,y:b[1]-cy-(a[1]-cy-v.y)*r}});}
    };
    const up=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();lastTouch=Date.now();const p=pointers.get(e.pointerId);if(!moved&&pointers.size===1&&e.type!=='pointercancel'){const i=c.nearest(...p);c.setState({sel:i,hoverNb:-1});if(i>=0&&ui.mobile)ui.openPanel('details');}pointers.delete(e.pointerId);if(pointers.size){moved=true;begin();}else start=null;};
    const suppress=e=>{if(e.sourceCapabilities?.firesTouchEvents||Date.now()-lastTouch<700){e.preventDefault();e.stopImmediatePropagation();}};
    // React delegates wheel events through a passive listener. Handle them here so
    // Ctrl+wheel / trackpad pinch zooms the map without also zooming the document.
    const wheel=e=>{e.preventDefault();e.stopPropagation();c.pageValues().onWheel(e);};
    const prevent=e=>{if(e.cancelable)e.preventDefault();};
    // Safari emits gesture events for trackpad pinch; touch pinch uses pointers above.
    const gestureStart=e=>{prevent(e);gesture={view:{...c.state.view},point:display.pointer(canvas,e.clientX,e.clientY)};};
    const gestureChange=e=>{prevent(e);if(!gesture||pointers.size>1||!Number.isFinite(e.scale))return;const v=gesture.view,k=Math.max(.4,Math.min(14,v.k*e.scale)),r=k/v.k,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2,[mx,my]=gesture.point;c.setState({view:{k,x:mx-cx-(mx-cx-v.x)*r,y:my-cy-(my-cy-v.y)*r}});};
    const gestureEnd=e=>{prevent(e);gesture=null;};
    const listeners=[['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up],['click',suppress,true],['wheel',wheel,{passive:false}],['touchstart',prevent,{passive:false}],['touchmove',prevent,{passive:false}],['gesturestart',gestureStart,{passive:false}],['gesturechange',gestureChange,{passive:false}],['gestureend',gestureEnd,{passive:false}]];
    for(const [name,handler,options] of listeners)canvas.addEventListener(name,handler,options);
    return ()=>{for(const [name,handler,options] of listeners)canvas.removeEventListener(name,handler,options);};
  }
  display.connect = c => {
    component=c;if(!document.createElement)return ()=>{};
    installChrome();applyTheme();
    const touch=attachTouch(c);
    let selected=c.state.sel;
    const originalUpdate=c.componentDidUpdate?.bind(c);
    c.componentDidUpdate=function(){originalUpdate?.();updateChrome();
      if(ui.mobile && this.state.sel>=0 && this.state.sel!==selected)ui.openPanel('details');selected=this.state.sel;
      const results=document.querySelector('.mobile-search-results');if(results){results.replaceChildren();for(const r of this.pageValues().results||[]){const b=document.createElement('button');b.type='button';b.textContent=[r.gene,r.acc].filter(Boolean).join(' · ');b.onclick=()=>{r.pick();ui.openPanel('details');};results.append(b);}}
    };
    const resize=()=>{c.forceUpdate();requestAnimationFrame(()=>{c.drawAll?.();c.draw?.();});if(!ui.mobile && menu.open)menu.close();};window.addEventListener('resize',resize);
    const hero=document.querySelector('[data-screen-label="Hero"]');let swipe;
    const swipeDown=e=>{if(ui.mobile&&e.target.tagName==='CANVAS')swipe=[e.clientX,e.clientY];};
    const swipeUp=e=>{if(swipe&&Math.abs(e.clientX-swipe[0])>50&&Math.abs(e.clientY-swipe[1])<60){c.goScene((c.state.scene+(e.clientX<swipe[0]?1:c.SCENES.length-1))%c.SCENES.length);c.startTimer();}swipe=null;};
    hero?.addEventListener('pointerdown',swipeDown);hero?.addEventListener('pointerup',swipeUp);
    return ()=>{touch();window.removeEventListener('resize',resize);hero?.removeEventListener('pointerdown',swipeDown);hero?.removeEventListener('pointerup',swipeUp);chrome?.remove();menu?.remove();chrome=menu=component=null;};
  };
  applyTheme();
})();

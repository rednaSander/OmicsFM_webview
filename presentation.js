// Responsive navigation, accessible theme controls, and touch interaction.
(() => {
  const display = window.OmicsFMDisplay;
  let theme = 'dark', component, chrome, menu, panel = 'map';
  try { theme = localStorage.getItem('omicsfm-theme') === 'light' ? 'light' : 'dark'; } catch (_) {}
  const surfaces = {'#000':'#FFFFFF','#000000':'#FFFFFF','#0A0A0C':'#FAFAFC','#131316':'#F2F2F6','#1B1B20':'#ECECF1','#1F1F25':'#E7E7ED','#2A2A31':'#DEDEE6','#F4F4F5':'#22222B'};
  const ink = {'#F4F4F5':'#18181F','#FFF':'#18181F','#FFFFFF':'#18181F','#E3E3E8':'#303039','#9A9AA6':'#555562','#5C5C68':'#676775','#C0FE04':'#4F7100','#8B5CFF':'#5100FD','#BCA4FF':'#6230C8','#AA83FF':'#6331C8','#FC2D76':'#BF1752','#FFB020':'#8A5600'};
  const context = {'#36363F':'#B8B8C4','#3A3A44':'#B8B8C4','#45454F':'#A9A9B7','#1F1F25':'#DDDDE5','#26262C':'#C8C8D2','#6C6C78':'#707080'};
  const key = value => typeof value === 'string' ? value.toUpperCase() : value;
  const neutral = value => value && (key(value) in surfaces || key(value) in context);
  const ui = display.ui = {
    get theme() { return theme; },
    get mobile() { return display.isMobile(); },
    bg(value) { return theme === 'light' ? surfaces[key(value)] || value : value; },
    fg(value, background) {
      if (theme !== 'light') return value;
      if (key(background) === '#F4F4F5') return '#F4F4F5';
      if (background && !neutral(background) && background !== 'transparent') return value;
      return ink[key(value)] || value;
    },
    plot(value) {
      if (theme !== 'light') return value;
      if (typeof value === 'string' && /^rgba\(10,\s*10,\s*12,/i.test(value)) return value.replace(/10,\s*10,\s*12/, '250,250,252');
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
    const ctx = canvas.getContext('2d');
    if (theme !== 'light') return ctx;
    if (!contexts.has(ctx)) contexts.set(ctx,new Proxy(ctx,{
      get(target,prop) { const value=Reflect.get(target,prop,target); return typeof value === 'function' ? value.bind(target) : value; },
      set(target,prop,value) { return Reflect.set(target,prop,prop === 'fillStyle' || prop === 'strokeStyle' ? ui.plot(value) : value,target); },
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
  const sun='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
  const moon='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 15.2A9 9 0 0 1 8.8 4a9 9 0 1 0 11.2 11.2Z"/></svg>';
  function updateChrome() {
    if (!chrome) return;
    const button=chrome.querySelector('.theme-toggle');
    button.innerHTML=theme==='dark'?sun:moon;
    button.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');
    button.title=button.getAttribute('aria-label');
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
    chrome.innerHTML=`<button class="theme-toggle" type="button"></button><button class="mobile-menu-toggle" type="button" aria-label="Open navigation" aria-haspopup="dialog"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>`;
    chrome.querySelector('.theme-toggle').onclick=()=>ui.setTheme(theme==='dark'?'light':'dark');
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
      const help=document.createElement('div');help.className='mobile-map-help';help.textContent='Pinch to zoom · drag to pan\n'+(component.ensureNetwork?'Tap a node to explore its partners':'Tap a point for details');
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
  function zoom(factor) {
    if(component.net) {factor?component.net.moveTo({scale:component.net.getScale()*factor,animation:{duration:180}}):component.net.fit({animation:{duration:180}});return;}
    if(!factor){component.pageValues().resetView();return;}
    const view=component.state.view, k=Math.max(.4,Math.min(14,view.k*factor)),r=k/view.k;
    component.setState({view:{k,x:view.x*r,y:view.y*r}});
  }
  function attachTouch(c) {
    const canvas=c.cv?.current;
    if (!canvas || c.ensureNetwork || !canvas.addEventListener) return ()=>{};
    const pointers=new Map();let start=null, moved=false;
    const begin=()=>{const p=[...pointers.values()];start={points:p.map(a=>[...a]),view:{...c.state.view}};};
    const down=e=>{if(!ui.mobile||e.pointerType==='mouse')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,display.pointer(canvas,e.clientX,e.clientY));moved=pointers.size>1;begin();};
    const move=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();pointers.set(e.pointerId,display.pointer(canvas,e.clientX,e.clientY));const p=[...pointers.values()],v=start.view;
      if(p.length===1){const dx=p[0][0]-start.points[0][0],dy=p[0][1]-start.points[0][1];if(Math.hypot(dx,dy)>6)moved=true;c.setState({view:{k:v.k,x:v.x+dx,y:v.y+dy}});}
      else {moved=true;const mid=a=>[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],dist=a=>Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),a=mid(start.points),b=mid(p),k=Math.max(.4,Math.min(14,v.k*dist(p)/Math.max(1,dist(start.points)))),r=k/v.k,cx=canvas.clientWidth/2,cy=canvas.clientHeight/2;c.setState({view:{k,x:b[0]-cx-(a[0]-cx-v.x)*r,y:b[1]-cy-(a[1]-cy-v.y)*r}});}
    };
    const up=e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const p=pointers.get(e.pointerId);if(!moved&&pointers.size===1&&e.type!=='pointercancel'){const i=c.nearest(...p);c.setState({sel:i,hoverNb:-1});if(i>=0)ui.openPanel('details');}pointers.delete(e.pointerId);if(pointers.size){moved=true;begin();}else start=null;};
    const suppress=e=>{if(ui.mobile&&e.sourceCapabilities?.firesTouchEvents){e.preventDefault();e.stopImmediatePropagation();}};
    canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('click',suppress,true);
    return ()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('click',suppress,true);};
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

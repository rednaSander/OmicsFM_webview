// Match an 80% browser view without changing the visitor's browser settings.
(() => {
  const isMobile = () => window.innerWidth <= 900 || (window.innerWidth <= 1100 && !!window.matchMedia?.('(pointer: coarse)').matches);
  const activeScale = () => isMobile() ? 1 : 0.8;
  const viewportHeight = () => window.innerHeight / activeScale();
  const updateViewport = () => {
    document.documentElement.style.zoom = String(activeScale());
    if (document.documentElement.dataset) document.documentElement.dataset.mobile = String(isMobile());
    document.documentElement.style.setProperty('--omics-viewport-height', `${viewportHeight()}px`);
  };
  const pointer = (element, x, y) => {
    const rect = element.getBoundingClientRect();
    return [(x - rect.left) * element.clientWidth / rect.width,
      (y - rect.top) * element.clientHeight / rect.height];
  };
  let scrollFrame;
  window.OmicsFMDisplay = {
    get scale() { return activeScale(); }, isMobile, viewportHeight, pointer,
  homeHeaderLayout(width) {
    const W = Math.max(320, width), k = Math.max(.6, Math.min(1, W / 1440));
    const edge = 12, colW = Math.round((W <= 1600 ? 202 : 270) * k);
    const pad = W >= 1200 ? 12 : 8, gap = W >= 1800 ? 32 : W >= 1400 ? 18 : W >= 1200 ? 12 : 4;
    const searchW = Math.round(Math.max(180, 300 * k)), showCode = W >= 1280;
    const targetFont = W >= 1800 ? 16 : W >= 1400 ? 15 : W >= 1200 ? 14 : W >= 1000 ? 13 : 12;
    const textUnits = [...['Proteomics', 'Bulk transcriptomics', 'Single-cell transcriptomics'], 'About', 'Compare'].reduce((n, label) => n + label.length * .74, 0);
    const chrome = edge + 156 + 48 + colW + 12 + 52;
    const showSearch = W >= 1180 && W - chrome - searchW - 12 >= textUnits * 11 + 10 * pad + 4 * gap;
    const available = W - chrome - (showSearch ? searchW + 12 : 0);
    const font = Math.floor(Math.min(targetFont, (available - 10 * pad - 4 * gap - 4) / textUnits) * 10) / 10;
    return {navFont: Math.max(1, font) + 'px', navGap: gap + 'px', navPad: pad + 'px',
      searchW: searchW + 'px', showSearch, showCode,
      navAvailableWidth: available, navRequiredWidth: textUnits * Math.max(1, font) + 10 * pad + 4 * gap};
  },
    explorerHeaderLayout(width, modality) {
      const W = Math.max(320, width), k = Math.max(.6, Math.min(1, W / 1440));
      const navFont = this.homeHeaderLayout(W).navFont;
      const colW = Math.round(Math.max(240, 340 * k));
      const gap = W >= 1200 ? 8 : 2;
      const labels = ['Home', '/', modality, '/', 'Samples', ...(modality === 'Single-cell transcriptomics' ? [] : ['Attention']), modality === 'Proteomics' ? 'Proteins' : 'Genes'];
      const navWidth = labels.reduce((sum, label) => sum + label.length * .74 * parseFloat(navFont) + (label === '/' ? 0 : 24), 0) + (labels.length - 1) * gap;
      const available = W - 12 - 156 - 32 - navWidth - colW - 24 - 52;
      const searchW = Math.max(180, Math.min(320, available));
      return {navFont, navGap:gap + 'px', edgePad:'12px', colW:colW + 'px',
        showSearch:W >= 1180 && available >= 180, searchW:searchW + 'px'};
    },
    mapLabelScale(zoom = 1) {
      return isMobile() ? Math.max(.58, .8 * Math.sqrt(Math.min(1, zoom))) : 1;
    },
    placeMapLabel(placed, x, y, width, height, bounds) {
      if (![x,y,width,height].every(Number.isFinite) || x<0 || x>bounds.w || y<0 || y>bounds.h || width>bounds.w-16) return null;
      const cx=Math.max(8+width/2,Math.min(bounds.w-8-width/2,x));
      const cy=Math.max(40+height/2,Math.min(bounds.h-44-height/2,y));
      for(const [dx,dy] of [[0,0],[0,-height-4],[0,height+4],[-width/2-10,0],[width/2+10,0],[0,-2*(height+4)],[0,2*(height+4)]]) {
        const box={x:cx+dx,y:cy+dy,width,height};
        if(box.x-width/2<8||box.x+width/2>bounds.w-8||box.y-height/2<40||box.y+height/2>bounds.h-44)continue;
        if(placed.some(p=>Math.abs(p.x-box.x)<(p.width+width)/2+3&&Math.abs(p.y-box.y)<(p.height+height)/2+3))continue;
        placed.push(box);return box;
      }
      return null;
    },
    scrollToEnd(element) {
      if (!element) return;
      cancelAnimationFrame(scrollFrame);
      const from = window.scrollY;
      const rect = element.getBoundingClientRect();
      const to = Math.max(0, isMobile() ? from + rect.top - 72 : from + rect.bottom - window.innerHeight + 160);
      const started = performance.now();
      const step = now => {
        const progress = Math.min(1, (now - started) / 650);
        const eased = progress * progress * (3 - 2 * progress);
        window.scrollTo({top:from + (to - from) * eased, behavior:'instant'});
        if (progress < 1) scrollFrame = requestAnimationFrame(step);
      };
      scrollFrame = requestAnimationFrame(step);
    },
    adaptNetwork(network) {
      // vis-network assumes one screen pixel per layout pixel for input.
      network.interactionHandler.getPointer = position => {
        const [x, y] = pointer(network.canvas.frame.canvas, position.x, position.y);
        return { x, y };
      };
    },
  };
  updateViewport();
  window.addEventListener('resize', updateViewport);
})();

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

if (document.createElement) { const style=document.createElement("style"); style.textContent=".omics-chrome button,.mobile-menu button,.mobile-search button{font-family:'JetBrains Mono',monospace;cursor:pointer}\n.theme-toggle,.mobile-menu-toggle,.mobile-map-tools button{display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:1px solid var(--ui-bg-2a2a31,#2A2A31);background:var(--ui-bg-000,#000);color:var(--ui-fg-f4f4f5,#F4F4F5)}\n.theme-toggle{position:relative;flex:none;z-index:70;width:40px;height:40px;cursor:pointer;background:var(--ui-bg-1b1b20,#1B1B20);border-color:transparent}\n.theme-toggle .theme-moon,html[data-theme=light] .theme-toggle .theme-sun{display:none}\nhtml[data-theme=light] .theme-toggle .theme-moon{display:block}\n.theme-toggle:focus-visible{outline:2px solid var(--ui-fg-8b5cff,#8B5CFF);outline-offset:3px}\n.theme-toggle:hover,.mobile-menu-toggle:hover{border-color:currentColor}\n.omics-chrome :focus-visible,.mobile-menu :focus-visible,.mobile-search :focus-visible{outline:2px solid var(--ui-fg-8b5cff,#8B5CFF);outline-offset:3px}\n.mobile-menu-toggle,.mobile-panel-tabs,.mobile-map-tools,.mobile-search,.mobile-map-help{display:none}\n.mobile-menu{position:fixed;inset:12px 12px auto auto;margin:0;max-width:calc(100vw - 24px);width:420px;max-height:calc(100dvh - 24px);overflow-y:auto;padding:20px;border:1px solid var(--ui-bg-2a2a31,#2A2A31);color:var(--ui-fg-f4f4f5,#F4F4F5);background:var(--ui-bg-000,#000);font-family:'Space Grotesk',sans-serif}\n.mobile-menu::backdrop{background:#0009;backdrop-filter:blur(4px)}\n.menu-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;font-size:19px}\n.menu-heading button{width:44px;height:44px;font-size:28px;background:transparent;border:0;color:inherit}\n.mobile-menu section{padding:20px 0;border-block:1px solid var(--ui-bg-2a2a31,#2A2A31)}\n.mobile-menu h2{font-size:16px;margin:0 0 12px}\n.mobile-menu section>div{display:flex;gap:8px;flex-wrap:wrap}\n.mobile-menu a{display:inline-flex;align-items:center;min-height:44px;padding:10px 12px;font:13px 'JetBrains Mono',monospace;color:inherit;text-decoration:none}\n.mobile-menu a[aria-current=page]{background:var(--ui-bg-1b1b20,#1B1B20);box-shadow:inset 0 -2px #8B5CFF}\n.mobile-menu>a{display:flex}\n.mobile-modality-toggle{display:none}\n.representation-controls{display:none}\nhtml[data-mobile=false] .representation-cards{grid-auto-rows:max-content!important;align-content:space-between;gap:28px!important}\nhtml[data-mobile=false] .representation-cards>div>div:last-child{margin-top:0!important}\nhtml[data-mobile=false][data-theme=light] .representation-cards>div{background:#E7E7ED!important}\nhtml[data-mobile=false][data-theme=light] .modality-content>div:first-child{padding-bottom:18px!important}\n.mobile-footer-logo{display:none}\n.modality-content{display:contents}\nhtml[data-mobile=false] #modality-single_cell{container:single-cell-card / inline-size}\n/* Three 136px links, two 12px gaps and 64px horizontal padding need 496px. */\n@container single-cell-card (width < 496px){.modality-content>div:last-child>a{flex-basis:100%!important}}\n/* DC serializes inline accent colours to RGB. Only match the text colour itself. */\nhtml[data-theme=light] :is([style^=\"color: rgb(192, 254, 4)\"],[style*=\"; color: rgb(192, 254, 4)\"]){background-color:#C0FE04!important;color:#0A0A0C!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}\nhtml[data-theme=light] :is([style^=\"color: rgb(139, 92, 255)\"],[style*=\"; color: rgb(139, 92, 255)\"],[style^=\"color: rgb(81, 0, 253)\"],[style*=\"; color: rgb(81, 0, 253)\"]){background-color:#5100FD!important;color:#F4F4F5!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}\nhtml[data-theme=light] :is([style^=\"color: rgb(252, 45, 118)\"],[style*=\"; color: rgb(252, 45, 118)\"]){background-color:#FC2D76!important;color:#0A0A0C!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}\nhtml[data-theme=light][data-page=explorer] :is(.viewer-modality-label,.viewer-paper-link){background-color:transparent!important;color:#18181F!important}\nhtml[data-theme=light] .detection-value{background-color:transparent!important;color:#18181F!important}\nhtml[data-theme=light] input.detection-slider{background:#18181F}\nhtml[data-theme=light] input.detection-slider::-webkit-slider-thumb{background:#18181F}\nhtml[data-theme=light] input.detection-slider::-moz-range-thumb{background:#18181F}\nhtml[data-theme=light] select[aria-label=\"Tissue network\"]{border-radius:0;background:#E7E7ED!important;color:#18181F!important;color-scheme:light}\nhtml[data-theme=light] div:has(>select[aria-label=\"Tissue network\"]){background:#E7E7ED!important;outline-color:#676775!important}\nhtml[data-theme=light] select[aria-label=\"Tissue network\"]::picker(select){background:#E7E7ED;border-color:#D2D2DB}\nhtml[data-theme=light] select[aria-label=\"Tissue network\"] option{background:#E7E7ED!important;color:#555562!important}\nhtml[data-theme=light] select[aria-label=\"Tissue network\"] option:is(:hover,:focus,:checked){color:#18181F!important;outline:1px solid #676775;outline-offset:-1px}\nhtml[data-theme=light] select[aria-label=\"Tissue network\"] option::checkmark{color:#18181F}\nhtml[data-theme=light] .task-grid>a:nth-child(-n+3)>div:last-child>div:last-child{background:transparent!important}\nhtml[data-theme=light] .task-grid>a:nth-child(-n+3)>div:last-child>div:last-child>span:last-child{background:#C0FE04;color:#0A0A0C;padding:4px 8px}\nhtml[data-theme=light] .family-chip[aria-pressed=false]{background:#E7E7ED!important;color:#555562!important}\nhtml[data-theme=light] .compare-grid>div>div:first-of-type>span:first-child{align-self:flex-start}\nhtml[data-mobile=true]{scroll-padding-top:72px}\nhtml[data-mobile=true] body{overflow-x:hidden}\nhtml[data-mobile=true] [data-screen-label=Header]{height:64px!important;padding:0 16px!important;position:sticky!important;top:0;z-index:65!important;flex:none}\nhtml[data-mobile=true] [data-screen-label=Header]>a:first-child{height:40px!important}\nhtml[data-mobile=true] [data-screen-label=Header]>a:first-child img{width:156px!important;height:auto!important}\nhtml[data-mobile=true] [data-screen-label=Header]>:not(a:first-child){display:none!important}\nhtml[data-mobile=true] [data-screen-label=Header]>.header-actions.header-actions{display:contents!important}\nhtml[data-mobile=true] .header-actions>:not(.theme-toggle){display:none!important}\nhtml[data-mobile=true] .theme-toggle{position:fixed;top:10px;right:66px;bottom:auto;width:44px;height:44px;box-shadow:none}\nhtml[data-mobile=true] .mobile-menu-toggle{display:flex;position:fixed;top:10px;right:12px;z-index:70}\nhtml[data-mobile=true] input,html[data-mobile=true] select{font-size:16px!important}\nhtml[data-mobile=true] button,html[data-mobile=true] input,html[data-mobile=true] select{touch-action:manipulation}\nhtml[data-mobile=true] .home-content{padding:48px 20px 0!important;gap:56px!important}\nhtml[data-mobile=true] [data-screen-label=Hero]{--mobile-plot-height:clamp(300px,49svh,460px);height:auto!important;min-height:0!important;padding-top:var(--mobile-plot-height)}\nhtml[data-mobile=true] [data-screen-label=Hero]>canvas{width:100%!important;height:var(--mobile-plot-height)!important;right:0!important;bottom:auto!important;touch-action:pan-y}\nhtml[data-mobile=true] .hero-rail{display:none!important}\nhtml[data-mobile=true] .hero-readout{top:12px!important;left:16px!important;right:16px!important;font-size:10px!important;gap:8px!important}\nhtml[data-mobile=true] .hero-readout>span:first-child{max-width:100%!important;gap:8px!important}\nhtml[data-mobile=true] .hero-readout>span:last-child{display:none!important}\nhtml[data-mobile=true] .hero-axes{height:var(--mobile-plot-height)!important;right:0!important;bottom:auto!important}\nhtml[data-mobile=true] .hero-axes>div{display:none!important}\nhtml[data-mobile=true] .hero-dots{left:50%!important;right:auto!important;top:calc(var(--mobile-plot-height) - 44px)!important;transform:translateX(-50%)!important;flex-direction:row!important;gap:2px!important}\nhtml[data-mobile=true] .hero-dots button{height:44px!important;width:26px!important;align-items:center}\nhtml[data-mobile=true] .hero-dots button span{height:15px!important;width:4px!important}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]{position:relative!important;width:100%!important;bottom:auto!important;left:auto!important;gap:0!important;padding:0!important;min-height:0;background:var(--mobile-carousel-card-bg,#131316)!important;color:var(--ui-fg-f4f4f5,#F4F4F5)!important}\nhtml[data-theme=light] [data-screen-label=\"Carousel card\"]{--mobile-carousel-card-bg:#E7E7ED}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]>div:first-child{font-size:10px!important;letter-spacing:.06em!important;padding:10px 20px!important;opacity:1!important}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]>div:first-child>span:first-child{white-space:nowrap;flex:none}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]>div:nth-child(2){font-size:22px!important;padding:14px 20px 0!important}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]>p{font-size:14px!important;line-height:1.45!important;padding:8px 20px 16px!important}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"]>div:last-child{display:none!important}\nhtml[data-mobile=true] [data-screen-label=\"Carousel card\"] a{height:46px!important;font-size:12px!important;padding:0 20px!important}\nhtml[data-mobile=true] [data-screen-label=\"Modality bar\"]{display:none!important}\nhtml[data-mobile=true] [data-screen-label=\"Modality bar\"]>a{min-height:58px;padding:12px 20px!important;gap:10px!important}\nhtml[data-mobile=true] [data-screen-label=\"Modality bar\"]>a>span:last-child{font-size:10px!important}\nhtml[data-mobile=true] #modalities{grid-template-columns:1fr!important;gap:0!important;padding:0!important;margin-top:0}\nhtml[data-mobile=true] .mobile-modality-toggle{display:flex;align-items:center;gap:10px;min-height:58px;width:100%;padding:12px 20px;border:0;background:transparent;text-align:left;font:500 12px 'JetBrains Mono',monospace;letter-spacing:.03em;text-transform:uppercase;cursor:pointer}\nhtml[data-mobile=true] .mobile-modality-toggle>span:first-child{flex:1;min-width:0}\nhtml[data-mobile=true] .mobile-modality-toggle .modality-count{font-size:9px;white-space:nowrap}\nhtml[data-mobile=true] .mobile-modality-toggle::after{content:'+';font-size:20px;width:14px;flex:none;text-align:center}\nhtml[data-mobile=true] .mobile-modality-toggle[aria-expanded=true]::after{content:'\\2212'}\nhtml[data-mobile=true] .mobile-modality-toggle:focus-visible{outline:2px solid currentColor;outline-offset:-4px}\nhtml[data-mobile=true] .modality-content{display:none}\nhtml[data-mobile=true] .modality-content[data-open=true]{display:flex;flex-direction:column}\nhtml[data-mobile=true] .modality-content>div{padding-left:20px!important;padding-right:20px!important}\nhtml[data-mobile=true] .modality-content>div:last-child{padding-bottom:20px!important}\nhtml[data-mobile=true] #modality-proteomics{--modality-band:#C0FE04;--modality-band-ink:#0A0A0C}\nhtml[data-mobile=true] #modality-bulk{--modality-band:#5100FD;--modality-band-ink:#F4F4F5}\nhtml[data-mobile=true] #modality-single_cell{--modality-band:#FC2D76;--modality-band-ink:#0A0A0C}\nhtml[data-mobile=true][data-theme=light] .modality-content>div:first-child{padding-top:4px!important;padding-bottom:18px!important;background:var(--modality-band)!important;color:var(--modality-band-ink)!important}\nhtml[data-mobile=true][data-theme=light] .modality-content>div:first-child>span{background:transparent!important;color:var(--modality-band-ink)!important}\nhtml[data-mobile=true] #modalities a{min-height:46px}\nhtml[data-mobile=true] #what{grid-template-columns:1fr!important;gap:32px!important}\nhtml[data-mobile=true] #what p{font-size:16px!important;line-height:1.65!important}\nhtml[data-mobile=true] p,html[data-mobile=true] .task-grid>a>div:last-child>div:nth-child(2){text-align:justify!important;text-align-last:left;hyphens:auto;hyphenate-limit-chars:6 3 3;text-wrap:pretty}\nhtml[data-mobile=true] .representation-cards{grid-template-columns:minmax(0,1fr)!important;grid-auto-rows:auto!important;min-width:0;max-width:100%;overflow:visible}\nhtml[data-mobile=true] .representation-cards>div{grid-area:1/1;visibility:hidden;pointer-events:none;background:var(--representation-card-bg,#131316)!important;color:var(--ui-fg-f4f4f5,#F4F4F5)!important;padding:24px!important}\nhtml[data-mobile=true] .representation-cards>div[data-active=true]{visibility:visible;pointer-events:auto}\nhtml[data-mobile=true] .representation-controls{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:-16px;font:12px 'JetBrains Mono',monospace;color:var(--ui-fg-9a9aa6,#9A9AA6)}\nhtml[data-mobile=true] .representation-controls button{width:48px;height:44px;border:0;background:var(--ui-bg-131316,#131316);color:var(--ui-fg-f4f4f5,#F4F4F5);font-size:22px;cursor:pointer}\nhtml[data-mobile=true] .representation-controls button:disabled{opacity:.3;cursor:default}\nhtml[data-mobile=true] .representation-controls button:focus-visible{outline:2px solid #C0FE04;outline-offset:3px}\nhtml[data-theme=light] .representation-cards{--representation-card-bg:#E7E7ED}\nhtml[data-mobile=true] .representation-cards>div>div{color:var(--ui-fg-f4f4f5,#F4F4F5)!important}\nhtml[data-mobile=true] .representation-cards>div>p{color:var(--ui-fg-9a9aa6,#9A9AA6)!important}\nhtml[data-mobile=true] .representation-cards>div>div:first-child{color:var(--ui-fg-5c5c68,#5C5C68)!important}\nhtml[data-mobile=true] .representation-cards:focus-visible{outline:2px solid #C0FE04;outline-offset:4px}\nhtml[data-mobile=true] .home-content h2{font-size:28px!important}\nhtml[data-mobile=true] [data-screen-label=Tasks]{margin:0 -20px!important;padding:48px 20px!important}\nhtml[data-mobile=true] .task-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px!important}\nhtml[data-mobile=true] .task-grid canvas{transform:none!important}\nhtml[data-mobile=true] .compare-grid{grid-template-columns:1fr!important}\nhtml[data-mobile=true] .compare-grid>div{aspect-ratio:1.2!important}\nhtml[data-mobile=true] #about{padding:32px 20px 88px!important;margin-top:56px!important;grid-template-columns:1fr!important;gap:28px!important}\nhtml[data-mobile=true] .footer-identity{display:grid!important;grid-template-columns:minmax(0,1fr) 60px;gap:16px!important;align-items:start}\nhtml[data-mobile=true] .footer-identity>div:first-child{grid-column:2;grid-row:1;justify-content:flex-end}\nhtml[data-mobile=true] .footer-identity>p{grid-column:1;grid-row:1;max-width:none!important}\nhtml[data-mobile=true] .footer-identity>div:last-child{grid-column:1/-1;grid-row:2}\nhtml[data-mobile=true] .footer-wordmark{display:none!important}\nhtml[data-mobile=true] .mobile-footer-logo{display:block}\nhtml[data-mobile=true][data-page=explorer] body{overflow:hidden}\nhtml[data-mobile=true] .explorer-grid{display:block!important;position:relative;overflow:hidden;margin-bottom:calc(60px + env(safe-area-inset-bottom))}\nhtml[data-mobile=true] .explorer-grid>[title^=\"Drag to resize\"]{display:none!important}\nhtml[data-mobile=true] [data-screen-label=Plot],html[data-mobile=true] [data-screen-label=Network]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;margin:0!important}\n[data-screen-label=Plot]>canvas{touch-action:none}\nhtml[data-mobile=true] [data-screen-label=Network] button{min-height:40px;min-width:44px}\nhtml[data-mobile=true] [data-screen-label=Plot]>div[style*=\"pointer-events\"]>div{left:18px!important;right:18px!important;font-size:10px!important;gap:8px!important}\nhtml[data-mobile=true] [data-screen-label=Controls],html[data-mobile=true] [data-screen-label=Inspector]{display:none!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;z-index:20;overscroll-behavior:contain;overflow:auto!important}\nhtml[data-mobile=true][data-panel=filters] [data-screen-label=Controls],html[data-mobile=true][data-panel=details] [data-screen-label=Inspector]{display:flex!important}\nhtml[data-mobile=true] [data-screen-label=Controls] button,html[data-mobile=true] [data-screen-label=Inspector] button{min-height:42px}\nhtml[data-mobile=true] [data-screen-label=Controls] button{font-size:13px!important}\nhtml[data-mobile=true] [data-screen-label=Controls]>div{flex-shrink:0!important}\nhtml[data-mobile=true] [data-screen-label=Controls]>div[style*=\"overflow-y:auto\"]{overflow:visible!important;min-height:0!important;flex:0 0 auto!important}\nhtml[data-mobile=true] [data-screen-label=Controls]>.mobile-legend{overflow:visible!important;min-height:0!important;flex:0 0 auto!important}\nhtml[data-mobile=true] .mobile-panel-tabs{position:fixed;bottom:0;left:0;right:0;display:grid;grid-template-columns:1fr 1.5fr 1fr;z-index:60;background:var(--ui-bg-000,#000);border-top:1px solid var(--ui-bg-2a2a31,#2A2A31);height:calc(60px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom)}\nhtml[data-mobile=true] .mobile-panel-tabs button{border:0;border-top:2px solid transparent;background:transparent;color:var(--ui-fg-9a9aa6,#9A9AA6);font-size:12px}\nhtml[data-mobile=true] .mobile-panel-tabs button[aria-pressed=true]{color:var(--ui-fg-f4f4f5,#F4F4F5);border-top-color:#8B5CFF}\nhtml[data-mobile=true][data-panel=map] .mobile-map-tools{position:fixed;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:30;display:flex;flex-direction:column;gap:6px}\nhtml[data-mobile=true] .mobile-map-tools button{font-size:23px}\nhtml[data-mobile=true] .mobile-map-help{display:block;position:absolute;left:18px;bottom:16px;max-width:calc(100% - 80px);font:10px/1.6 'JetBrains Mono',monospace;white-space:pre-line;color:var(--ui-fg-9a9aa6,#9A9AA6);pointer-events:none;background:var(--ui-bg-0a0a0c,#0A0A0C);z-index:2}\nhtml[data-mobile=true] [data-screen-label=Network] .mobile-map-help{bottom:52px}\nhtml[data-mobile=true] .mobile-search{display:flex;flex-wrap:wrap;gap:8px;padding:20px 20px 0;flex:none}\n.mobile-search input{flex:1;min-width:0;height:46px;padding:0 12px;border:1px solid var(--ui-bg-2a2a31,#2A2A31);color:var(--ui-fg-f4f4f5,#F4F4F5);background:var(--ui-bg-000,#000);font:16px 'Space Grotesk',sans-serif;border-radius:0}\n.mobile-search>button{width:64px;min-height:46px;border:0;background:var(--ui-bg-1b1b20,#1B1B20);color:var(--ui-fg-f4f4f5,#F4F4F5)}\n.mobile-search-results{flex:0 0 100%;display:flex;flex-direction:column}\n.mobile-search-results button{text-align:left;border:0;border-bottom:1px solid var(--ui-bg-2a2a31,#2A2A31);padding:10px;background:var(--ui-bg-000,#000);color:var(--ui-fg-f4f4f5,#F4F4F5)}\n@media(max-width:600px){html[data-mobile=true] .task-grid{grid-template-columns:1fr!important}}\n@media(prefers-reduced-motion:reduce){html[data-mobile=true] *{scroll-behavior:auto!important}}\n"; document.head.append(style); }

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
    const chrome = edge + 60 + 48 + colW + 12 + (showCode ? 52 : 0);
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
      const available = W - 12 - 60 - 32 - navWidth - colW - 24;
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

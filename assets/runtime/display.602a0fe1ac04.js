// Match an 80% browser view without changing the visitor's browser settings.
(() => {
  const scale = 0.8;
  const viewportHeight = () => window.innerHeight / scale;
  const updateViewport = () => {
    document.documentElement.style.zoom = String(scale);
    document.documentElement.style.setProperty('--omics-viewport-height', `${viewportHeight()}px`);
  };
  const pointer = (element, x, y) => {
    const rect = element.getBoundingClientRect();
    return [(x - rect.left) * element.clientWidth / rect.width,
      (y - rect.top) * element.clientHeight / rect.height];
  };
  let scrollFrame;
  window.OmicsFMDisplay = {
    scale, viewportHeight, pointer,
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
    scrollToEnd(element) {
      if (!element) return;
      cancelAnimationFrame(scrollFrame);
      const from = window.scrollY;
      const to = Math.max(0, from + element.getBoundingClientRect().bottom - window.innerHeight + 160);
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

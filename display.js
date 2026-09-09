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
    scrollToEnd(element) {
      if (!element) return;
      cancelAnimationFrame(scrollFrame);
      const from = window.scrollY;
      const to = Math.max(0, from + element.getBoundingClientRect().bottom - window.innerHeight);
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

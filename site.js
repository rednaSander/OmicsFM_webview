// Site integration kept separate from the original generated DC runtime.
window.OmicsFM = {
  async loadJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.json();
    } catch (error) {
      let notice = document.getElementById('site-data-error');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'site-data-error';
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:100;background:#23151b;color:#fff;border:1px solid #fc2d76;padding:16px;font:14px system-ui';
        document.body.appendChild(notice);
      }
      notice.textContent = location.protocol === 'file:'
        ? 'Open this site using start-local.cmd so the explorer can load its data.'
        : 'The plot data could not be loaded. Please reload the page and check that the data folder is available.';
      throw error;
    }
  }
};

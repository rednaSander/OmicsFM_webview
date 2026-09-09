/* Integration checks run the exported component logic against its real payloads.
 * Canvas drawing is recorded without a browser; these are not visual QA checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const json = name => JSON.parse(read(name));

function checkLocalLinks(name) {
  const html = read(name);
  for (const [, link] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(https?:|data:|{{)/.test(link)) continue;
    const [file, fragment] = link.split('#');
    const target = file.split('?')[0] || name;
    assert(fs.existsSync(path.join(root, target)), `${name}: missing ${target}`);
    if (fragment) assert(read(target).includes(`id="${fragment}"`), `${name}: missing #${fragment}`);
  }
  for (const [, file] of html.matchAll(/OmicsFM.loadJSON\('([^']+)'\)/g)) json(file);
  const template = html.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
  const script = html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  return { html, template, script };
}

async function loadComponent(name, search = '') {
  const source = checkLocalLinks(name), timers = [], intervals = new Set();
  let drawCalls = 0;
  const ctx = new Proxy({ measureText: text => ({ width: text.length * 7 }) }, {
    get: (target, key) => key in target ? target[key] : () => { drawCalls++; },
  });
  const canvas = () => ({ clientWidth: 1000, clientHeight: 650, offsetHeight: 150,
    getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  class Logic {
    constructor() { this.props = {}; }
    setState(update, callback) { Object.assign(this.state, update); callback?.(); }
    forceUpdate() {}
  }
  const sandbox = {
    document: {documentElement:{style:{setProperty(){}}}},
    URLSearchParams, location: {search},
    DCLogic: Logic, React: { createRef: () => ({ current: canvas() }) }, console,
    OmicsFM: { loadJSON: async file => json(file) },
    window: { devicePixelRatio: 1, innerHeight: 900, addEventListener() {}, removeEventListener() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => callback(),
    setInterval: callback => { intervals.add(callback); return callback; },
    clearInterval: callback => intervals.delete(callback),
    setTimeout: callback => timers.push(callback), clearTimeout() {},
  };
  vm.runInNewContext(read('display.js'), sandbox, {filename:'display.js'});
  const Component = vm.runInNewContext(`${source.script}\nComponent`, sandbox, { filename: name });
  const instance = new Component();
  instance.renderVals();
  instance.componentDidMount();
  await new Promise(resolve => setImmediate(resolve));
  assert(instance.state.data || instance.state.d, `${name}: data did not load`);
  instance.componentDidUpdate();
  const vals = instance.renderVals();
  const aliases = new Set([...source.template.matchAll(/<sc-for[^>]* as="(\w+)"/g)].map(match => match[1]));
  for (const [, expression] of source.template.matchAll(/{{\s*(.*?)\s*}}/g)) {
    const key = expression.split('.')[0];
    if (['true', 'false'].includes(key) || aliases.has(key)) continue;
    assert(key in vals, `${name}: undefined template binding ${key}`);
  }
  return { instance, intervals, timers, drawCalls: () => drawCalls };
}

async function main() {
  for (const [name, digest] of [
    ['react.production.min.js', 'DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z'],
    ['react-dom.production.min.js', 'gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1'],
  ]) assert.equal(crypto.createHash('sha384').update(fs.readFileSync(path.join(root, 'assets/vendor', name))).digest('base64'), digest);

  const home = await loadComponent('Home.dc.html');
  const h = home.instance;
  for (const [file,digest] of Object.entries(h.state.carousel.sourceSha256)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),digest,
      `Home carousel is stale after ${file} changed; run python scripts/build_home_carousel.py`);
  }
  for (let width = 800; width <= 3840; width++) {
    const layout = h.homeHeaderLayout(width);
    assert(parseFloat(layout.navFont) > 0);
    assert(layout.navRequiredWidth <= layout.navAvailableWidth, `Header links exceed width ${width}`);
  }
  assert.equal(h.SCENES.length, 10);
  assert.equal(home.intervals.size, 1);
  for (let i = 0; i < h.SCENES.length; i++) {
    const before = home.drawCalls();
    h.renderVals().sceneDots[i].go();
    assert.equal(h.state.scene, i);
    assert(home.drawCalls() > before, `Scene ${i} did not draw`);
    assert(fs.existsSync(path.join(root,h.renderVals().sceneUrl.split('?')[0])));
    if (h.SCENES[i].kind === 'family') assert(!h.sceneCount(h.SCENES[i]).startsWith('0 '));
  }
  [...home.intervals][0](); assert.equal(h.state.scene, 0, 'Carousel must wrap');
  h.renderVals().pauseCarousel(); assert.equal(home.intervals.size,0);
  h.renderVals().sceneDots[4].go(); assert.equal(home.intervals.size,0);
  h.renderVals().resumeCarousel(); assert.equal(home.intervals.size,1);
  for (const chip of h.renderVals().familyChips) {
    chip.select(); h.componentDidUpdate();
    assert(h._n.p > 0 && h._n.b > 0 && h._n.s > 0, `${chip.name}: empty comparison plot`);
  }
  h.componentWillUnmount(); assert.equal(home.intervals.size, 0);
  console.log('PASS Home: ten scenes, auto-advance, wrap, family chips, all canvas plots, timer cleanup');

  const proteins = await loadComponent('Proteomics Proteins.dc.html');
  const p = proteins.instance, d = p.state.d;
  assert.equal(d.n, 20272); assert.equal(d.xy.length, 2 * d.n);
  const validPoint = (data, i) => Number.isFinite(data.xy[2 * i]) && Number.isFinite(data.xy[2 * i + 1]);
  for (let i = 0; i < d.n; i++) {
    assert(validPoint(d, i));
    for (let j = 0; j < (d.neigh[i] || []).length; j += 2) {
      assert(d.neigh[i][j] >= 0 && d.neigh[i][j] < d.n);
      assert(Number.isFinite(d.neigh[i][j + 1]));
    }
  }
  p.renderVals().onDet({ target: { value: '0' } });
  assert.equal(p.renderVals().visibleCount.replace(/[^0-9]/g, ''), String(d.n));
  p.renderVals().onQuery({ target: { value: 'RPL3' } }); assert(+p.renderVals().queryHits > 0);
  p.renderVals().tryChips.find(chip => chip.label === 'RPL3').go();
  assert.equal(p.renderVals().selGene, 'RPL3'); assert(p.renderVals().neighbours.length > 0);
  p.renderVals().neighbours[0].pick(); assert(p.renderVals().hasSel);
  const ribosome = d.pathways.findIndex(entry => entry.name === 'Ribosome');
  assert(ribosome >= 0); p.setPath(ribosome); assert(+p.renderVals().pathHits > 0);
  p.draw(); assert(proteins.drawCalls() > 0); p.componentWillUnmount();
  console.log('PASS Proteins: 20,272 records, coordinates, neighbours, detection slider, search, selection, pathway');

  const samples = await loadComponent('Proteomics Samples.dc.html');
  const s = samples.instance;
  assert(s.state.d.n > 0 && s.state.d.n <= 8490);
  const total = s.state.d.n;
  for (const tab of s.renderVals().fieldTabs) {
    tab.pick(); assert(s.renderVals().legend.length > 0); s.draw();
  }
  s.renderVals().fieldTabs[0].pick(); s.renderVals().legend[0].pick();
  assert(s.renderVals().isoOn); assert(+s.renderVals().visibleCount.replace(/[^0-9]/g, '') < total);
  s.renderVals().setModeProj(); assert(s.renderVals().legend.length > 0); s.draw();
  s.renderVals().onQuery({ target: { value: 'plasma' } }); assert(+s.renderVals().queryHits.replace(/[^0-9]/g, '') > 0);
  s.setState({ sel: 0 }); assert(s.renderVals().hasSel); assert(s.renderVals().neighbours.length > 0);
  s.draw(); assert(samples.drawCalls() > 0); s.componentWillUnmount();
  console.log(`PASS Samples: ${total} filtered records, seven colour modes, isolation, projects, search, selection`);
  console.log('PASS All local links, fragments, template bindings, data payloads, and vendored runtime hashes');
}
module.exports = { loadComponent, checkLocalLinks };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

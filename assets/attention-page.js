(function (root) {
  'use strict';
  const C = root.AttentionCore;
  const PALETTE = ['#65b5ff','#ffad48','#83e879','#ff5c9a','#7fe0d8','#ffe266','#dba0ff','#b9ddff','#edb993','#c0fe04','#57f1ff','#ffc395','#ff9fe7','#aaffc3','#b895ff','#ffe2bc','#ff8587','#54e6c1','#ef8eff','#dcff70'];
  const color = id => id < 0 ? '#c9ccd9' : PALETTE[id % PALETTE.length];
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const weight = n => Number(n).toPrecision(3);
  function physicsOptions(mode) {
    const clusters = mode === 'clusters';
    return {
      enabled: true, solver: 'barnesHut', stabilization: false,
      // Small fixed steps and stronger damping prevent dense islands oscillating.
      timestep: clusters ? .2 : .5, adaptiveTimestep: false,
      maxVelocity: clusters ? 5 : 50, minVelocity: .5,
      barnesHut: clusters
        ? { gravitationalConstant: -400, centralGravity: 0, springLength: 35, springConstant: .01, damping: .8, avoidOverlap: 0 }
        : { gravitationalConstant: -2500, centralGravity: .08, springLength: 90, springConstant: .025, damping: .25, avoidOverlap: .3 },
    };
  }
  const createLogic = (Base, React) => class extends Base {
    state = { data: null, manifest: null, paths: {}, tissue: 'brain', loading: true, error: '', mode: 'clusters',
      edgeLimit: 3000, degreeCap: 0, cluster: -1, protein: -1, selected: -1, selectedEdge: null,
      query: '', pathway: '', labels: true, partnerRows: [], partnersFor: -1,
      partnersLoading: false, partnerError: '', revision: 0 };
    graphRef = React.createRef();
    cache = new Map();
    shardCache = new Map();
    async request(url, signal) {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
    componentDidMount() {
      this._mounted = true;
      const url = new URL(location.href);
      this._initialProtein = url.searchParams.get('protein');
      this._initialTissue = url.searchParams.get('tissue') || 'brain';
      this.loadInitial();
      this._keys = e => {
        if (e.key === 'Escape') this.setState({ selected: -1, selectedEdge: null, query: '' });
      };
      window.addEventListener('keydown', this._keys);
    }
    async loadInitial() {
      this.setState({ loading: true, error: '' });
      try {
        const [manifest, paths] = await Promise.all([
          this.request('data/attention_explorer/manifest.json'), this.request('data/features/kegg_pathways.json'),
        ]);
        if (!this._mounted) return;
        this.setState({ manifest, paths }, () => this.loadTissue(manifest.tissues.some(t => t.id === this._initialTissue) ? this._initialTissue : 'brain'));
      } catch (e) { if (this._mounted) this.setState({ loading: false, error: this.errorText(e) }); }
    }
    errorText(e) { return location.protocol === 'file:' ? 'Open start-local.cmd and use http://localhost:8000 so the network can load its data.' : `Please check the local server and try again. ${e.message || ''}`; }
    async loadTissue(tissue) {
      this._request?.abort(); this._request = new AbortController();
      const ticket = this._ticket = (this._ticket || 0) + 1;
      this._partnerTicket = (this._partnerTicket || 0) + 1;
      const oldAcc = this.state.data && this.state.protein >= 0 ? this.state.data.nodes[this.state.protein][0] : this._initialProtein;
      this._initialProtein = null;
      this.setState({ tissue, loading: true, error: '', data: null, cluster: -1, selected: -1,
        protein: -1, selectedEdge: null, partnerRows: [], partnersFor: -1, partnerError: '', partnersLoading: false, query: '' });
      try {
        const data = this.cache.get(tissue) || await this.request(`data/attention_explorer/${tissue}.json`, this._request.signal);
        if (!this._mounted || ticket !== this._ticket) return;
        this.cache.set(tissue, data);
        if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value);
        this.setState({ data, loading: false }, () => {
          if (oldAcc) {
            const result = C.search(data.nodes, oldAcc, 1)[0];
            if (result && (result.n[0].toUpperCase() === oldAcc.toUpperCase() || result.n[1].toUpperCase() === oldAcc.toUpperCase())) this.openProtein(result.id);
            else this.setState({ query: oldAcc });
          }
        });
      } catch (e) {
        if (e.name !== 'AbortError' && this._mounted && ticket === this._ticket) this.setState({ loading: false, error: this.errorText(e) });
      }
    }
    async loadPartners(id) {
      const { tissue, data } = this.state;
      if (!data || id < 0) return;
      const ticket = this._partnerTicket = (this._partnerTicket || 0) + 1;
      const shard = Math.floor(id / data.shardSize), key = `${tissue}/${shard}`;
      this.setState({ partnersLoading: true, partnerError: '', partnerRows: [], partnersFor: -1 });
      try {
        let rows = this.shardCache.get(key);
        if (!rows) {
          rows = await this.request(`data/attention_explorer/${tissue}/partners-${shard}.json`);
          this.shardCache.set(key, rows);
          if (this.shardCache.size > 12) this.shardCache.delete(this.shardCache.keys().next().value);
        }
        if (!this._mounted || ticket !== this._partnerTicket || tissue !== this.state.tissue) return;
        this.setState({ partnerRows: rows[id % data.shardSize] || [], partnersFor: id, partnersLoading: false });
      } catch (e) {
        if (this._mounted && ticket === this._partnerTicket) this.setState({ partnersLoading: false, partnerError: this.errorText(e) });
      }
    }
    setMode(mode) {
      const wasProtein = this.state.mode === 'protein';
      this.setState({ mode, cluster: -1, selectedEdge: null,
        edgeLimit: mode === 'protein' ? (wasProtein ? this.state.edgeLimit : 25) : (wasProtein ? 3000 : this.state.edgeLimit),
      }, () => {
        if (mode === 'protein' && this.state.selected >= 0) this.openProtein(this.state.selected);
      });
    }
    openProtein(id) {
      if (!this.state.data || !this.state.data.nodes[id]) return;
      this.setState({ mode: 'protein', protein: id, selected: id, query: '', cluster: -1,
        selectedEdge: null, edgeLimit: this.state.mode === 'protein' ? this.state.edgeLimit : 25,
      }, () => this.loadPartners(id));
    }
    example(query) {
      if (!this.state.data) return;
      const match = C.search(this.state.data.nodes, query, 1)[0];
      if (match && match.score === 0) this.openProtein(match.id); else this.setState({ query });
    }
    inspect(id) {
      if (this.state.mode === 'protein') { this.openProtein(id); return; }
      this.setState({ selected: id, selectedEdge: null });
      this.loadPartners(id);
    }
    reset() {
      this._partnerTicket = (this._partnerTicket || 0) + 1;
      this.setState({ mode: 'clusters', edgeLimit: 3000, degreeCap: 0, cluster: -1, protein: -1,
        selected: -1, selectedEdge: null, query: '', pathway: '', labels: true,
        partnerRows: [], partnersFor: -1, partnersLoading: false, partnerError: '', revision: this.state.revision + 1 });
    }
    graph() {
      const s = this.state;
      if (!s.data) return { nodes: [], edges: [], degree: new Map(), candidates: 0 };
      const key = [s.tissue, s.mode, s.edgeLimit, s.degreeCap, s.cluster, s.protein, s.mode === 'protein' ? s.partnersFor : -1, s.revision].join(':');
      if (this._computedKey !== key) {
        this._computedKey = key;
        this._graph = C.filterEdges(s.data, s, s.partnersFor === s.protein ? s.partnerRows : []);
      }
      return this._graph;
    }
    componentDidUpdate() { this.draw(); }
    draw() {
      if (!this.graphRef.current || !root.vis) return;
      const graph = this.graph(), s = this.state;
      if (!this.network) {
        this.nodeSet = new root.vis.DataSet([]); this.edgeSet = new root.vis.DataSet([]);
        this.network = new root.vis.Network(this.graphRef.current, { nodes: this.nodeSet, edges: this.edgeSet }, {
          layout: { improvedLayout: false, randomSeed: 1 }, physics: physicsOptions(s.mode),
          nodes: { shape: 'dot', borderWidth: 1, font: { face: 'JetBrains Mono', color: '#f4f4f5', size: 12, strokeWidth: 3, strokeColor: '#0a0a0c' }, scaling: { label: { enabled: false } } },
          edges: { smooth: false, selectionWidth: 2, hoverWidth: 1 },
          interaction: { hover: true, tooltipDelay: 180, dragNodes: true, dragView: true, zoomView: true, multiselect: false, keyboard: { enabled: true, bindToWindow: false } },
        });
        this.network.on('click', params => {
          if (params.nodes.length) this.inspect(params.nodes[0]);
          else if (params.edges.length) this.setState({ selectedEdge: this.graph().edges[params.edges[0]], selected: -1 });
          else this.setState({ selected: -1, selectedEdge: null });
        });
        this.network.on('doubleClick', params => { if (params.nodes.length) this.openProtein(params.nodes[0]); });
        this.network.on('afterDrawing', ctx => this.drawClusterLabels(ctx));
      }
      if (!s.data) {
        this.nodeSet.clear(); this.edgeSet.clear(); this._drawKey = ''; return;
      }
      const topology = this._computedKey;
      const visual = `${topology}:${s.pathway}:${s.labels}:${s.selected}`;
      if (visual === this._drawKey) return;
      const changed = topology !== this._topology;
      const members = new Set(s.paths[s.pathway]?.members || []);
      const maxWeight = graph.edges[0]?.[2] || 1;
      const adjacent = new Set([s.selected]);
      if (s.selected >= 0) graph.edges.forEach(([a, b]) => { if (a === s.selected) adjacent.add(b); if (b === s.selected) adjacent.add(a); });
      const nodes = graph.nodes.map((id, i) => {
        const node = s.data.nodes[id], degree = graph.degree.get(id) || 0;
        const member = members.has(node[0]);
        const bg = s.pathway ? (member ? '#c0fe04' : '#0a0a0c') : color(node[2]);
        const border = s.pathway ? (member ? '#c0fe04' : '#fc2d76') : bg;
        const prominent = s.mode === 'protein' || graph.nodes.length <= 100 || degree >= 15 || id === s.selected;
        const title = document.createElement('div');
        title.textContent = `${node[1]} · ${node[0]}\n${degree} displayed edges · ${node[2] >= 0 ? 'cluster C' + node[2] : 'no retained cluster'}${s.pathway ? '\n' + (member ? 'Annotated KEGG member' : 'Not annotated to this pathway') : ''}`;
        let x = node[s.mode === 'clusters' ? 5 : 3], y = node[s.mode === 'clusters' ? 6 : 4];
        if (s.mode === 'protein') {
          const others = graph.nodes.filter(n => n !== s.protein), rank = others.indexOf(id);
          const angle = -Math.PI / 2 + rank / Math.max(1, others.length) * Math.PI * 2;
          x = id === s.protein ? 0 : Math.cos(angle) * (230 + (rank % 2) * 55);
          y = id === s.protein ? 0 : Math.sin(angle) * (230 + (rank % 2) * 55);
        }
        return { id, ...(changed ? { x, y } : {}), label: s.labels && prominent ? node[1] : '', title,
          size: id === s.protein && s.mode === 'protein' ? 13 : Math.min(10, 3.5 + Math.sqrt(degree) * .6),
          opacity: s.selected < 0 || adjacent.has(id) ? 1 : .7,
          color: { background: bg, border, highlight: { background: '#c0fe04', border: '#f4f4f5' }, hover: { background: '#f4f4f5', border: '#c0fe04' } },
          borderWidth: id === s.selected ? 3 : 1,
        };
      });
      const edges = graph.edges.map((e, id) => {
        const [a, b, score] = e, near = s.selected >= 0 && (a === s.selected || b === s.selected);
        const highlighted = s.pathway && members.has(s.data.nodes[a][0]) && members.has(s.data.nodes[b][0]);
        return { id, from: a, to: b, width: .5 + Math.sqrt(score / maxWeight) * 2,
          // Cross-cluster edges remain visible/inspectable but must not pull
          // separate islands together against their local spring layouts.
          physics: s.mode !== 'clusters' || s.data.nodes[a][2] === s.data.nodes[b][2],
          color: { color: near || highlighted ? '#c0fe04' : s.selected >= 0 ? '#24242b' : '#515360', highlight: '#c0fe04', hover: '#f4f4f5', opacity: near ? .95 : .55 },
        };
      });
      this._drawKey = visual; this._topology = topology;
      if (changed) { this.nodeSet.clear(); this.edgeSet.clear(); this.nodeSet.add(nodes); this.edgeSet.add(edges); }
      else { this.nodeSet.update(nodes); this.edgeSet.update(edges); }
      if (changed) this.network.setOptions({ physics: physicsOptions(s.mode) });
      if (graph.nodes.includes(s.selected)) this.network.selectNodes([s.selected], false); else this.network.unselectAll();
      if (changed && nodes.length) this.fit();
    }
    drawClusterLabels(ctx) {
      const s = this.state;
      if (!s.data || !s.labels || s.mode !== 'clusters') return;
      const positions = this.network.getPositions(), groups = new Map();
      for (const id of this.graph().nodes) {
        const c = s.data.nodes[id][2];
        if (c < 0 || !positions[id]) continue;
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c).push(positions[id]);
      }
      const scale = this.network.getScale(), fontSize = Math.min(28, Math.max(10, 11 / scale));
      ctx.save(); ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (const [id, points] of groups) {
        const cluster = s.data.communities.find(c => c.community === id);
        if (!cluster || points.length < 3) continue;
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = Math.min(...points.map(p => p.y)) - 14;
        const text = `C${id} · ${cluster.kegg_name || 'Unlabelled cluster'}`;
        const width = ctx.measureText(text).width;
        ctx.fillStyle = '#0a0a0cdd'; ctx.fillRect(x - width / 2 - 6, y - fontSize - 4, width + 12, fontSize + 10);
        ctx.fillStyle = '#f4f4f5'; ctx.fillText(text, x, y);
      }
      ctx.restore();
    }
    fit() { if (this.network) { this.network.fit({ animation: false }); this.network.moveTo({ scale: this.network.getScale() * .85 }); } }
    componentWillUnmount() { this._mounted = false; this._request?.abort(); this._partnerTicket++; this.network?.destroy(); window.removeEventListener('keydown', this._keys); }
    renderVals() {
      const s = this.state, d = s.data, graph = this.graph();
      const tissueName = s.manifest?.tissues.find(t => t.id === s.tissue)?.name || 'Brain';
      const selected = d && s.selected >= 0 ? d.nodes[s.selected] : null;
      const cluster = d?.communities.find(c => c.community === s.cluster);
      const results = d ? C.search(d.nodes, s.query) : [];
      const paths = Object.entries(s.paths).sort((a, b) => a[1].name.localeCompare(b[1].name));
      const pathMembers = new Set(s.paths[s.pathway]?.members || []);
      const pathCount = graph.nodes.filter(i => pathMembers.has(d.nodes[i][0])).length;
      const partnerOwner = s.mode === 'protein' ? s.protein : s.selected;
      const hasPartners = s.partnersFor === partnerOwner;
      const limits = s.mode === 'protein' ? [5, 10, 15, 25] : [500, 1000, 3000, 5000];
      const modes = [['clusters', 'Clusters'], ['network', 'Network'], ['protein', 'Protein']];
      return {
        graphRef: this.graphRef, tissue: s.tissue, tissueName, tissues: s.manifest?.tissues || [{ id: 'brain', name: 'Brain' }],
        booting: !s.manifest, loading: s.loading, error: s.error, hasError: !!s.error,
        retry: () => s.manifest ? this.loadTissue(s.tissue) : this.loadInitial(), onTissue: e => this.loadTissue(e.target.value),
        modes: modes.map(([id, label]) => ({ label, active: s.mode === id, pick: () => this.setMode(id) })),
        modeHelp: s.mode === 'clusters' ? 'Attention communities arranged as islands, with KEGG pathway labels.' : s.mode === 'network' ? 'The strongest edges, including hubs and proteins outside retained clusters.' : 'A protein and its strongest partners across the full tissue network.',
        query: s.query, onQuery: e => this.setState({ query: e.target.value }), hasQuery: !!s.query.trim(), noQuery: !s.query.trim(), noResults: !results.length,
        searchKey: e => { if (e.key === 'Enter' && results[0]) { e.preventDefault(); this.openProtein(results[0].id); } },
        results: results.map(({ id, n }) => ({ gene: n[1], acc: n[0], pick: () => this.openProtein(id) })),
        tryRPL3: () => this.example('RPL3'), tryPSMB5: () => this.example('PSMB5'), tryALB: () => this.example('ALB'),
        edgeLabel: s.mode === 'protein' ? 'Top partners' : 'Top attention edges', edgeValue: fmt(s.edgeLimit), edgeLimit: s.edgeLimit,
        edgeMin: s.mode === 'protein' ? 1 : 100, edgeMax: s.mode === 'protein' ? 25 : 5000, edgeStep: s.mode === 'protein' ? 1 : 100,
        onEdges: e => this.setState({ edgeLimit: Number(e.target.value), selectedEdge: null }),
        edgeStops: limits.map(n => ({ label: fmt(n), css: 'attn-small' + (s.edgeLimit === n ? ' on' : ''), pick: () => this.setState({ edgeLimit: n, selectedEdge: null }) })),
        edgeHelp: s.mode === 'clusters' ? 'The edge threshold is applied before cluster and degree filters. Cluster membership stays fixed.' : s.mode === 'protein' ? 'Ranked by attention to the central protein. No top-5,000 overview cutoff.' : 'Ranked globally within this tissue. Up to 5,000 precomputed edges are available.',
        degreeCap: s.degreeCap, capLabel: s.degreeCap ? '≤ ' + s.degreeCap : 'No cap', caps: Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `Max ${i + 1} per node` })),
        onCap: e => this.setState({ degreeCap: Number(e.target.value), selectedEdge: null }),
        pathway: s.pathway, pathwayOptions: paths.map(([id, p]) => ({ id, name: p.name })), hasPathway: !!s.pathway,
        onPathway: e => this.setState({ pathway: e.target.value }), clearPathway: () => this.setState({ pathway: '' }),
        pathwaySummary: `${fmt(pathCount)} of ${fmt(graph.nodes.length)} displayed proteins are annotated to this pathway.`,
        labels: s.labels, toggleLabels: () => this.setState({ labels: !s.labels }),
        fit: () => this.fit(), zoomIn: () => this.network?.moveTo({ scale: this.network.getScale() * 1.3 }), zoomOut: () => this.network?.moveTo({ scale: this.network.getScale() / 1.3 }), reset: () => this.reset(),
        viewLabel: s.mode === 'clusters' ? 'attention clusters' : s.mode === 'protein' ? `${d && s.protein >= 0 ? d.nodes[s.protein][1] : 'protein'} · top partners` : 'top-edge network',
        graphSummary: `${fmt(graph.nodes.length)} proteins · ${fmt(graph.edges.length)} edges${s.degreeCap ? ' · degree ≤ ' + s.degreeCap : ''}`,
        nodeCount: fmt(graph.nodes.length), edgeCount: fmt(graph.edges.length),
        networkSummary: d ? `${fmt(d.nodes.length)} proteins in this tissue. ${fmt(graph.candidates - graph.edges.length)} edges removed by the degree cap.` : 'Loading tissue data…',
        needsProtein: !s.loading && !s.error && s.mode === 'protein' && s.protein < 0,
        emptyGraph: !s.loading && !s.error && !!d && s.mode !== 'protein' && !graph.edges.length,
        hasSelected: !!selected, selectedGene: selected?.[1] || '', selectedAcc: selected?.[0] || '',
        uniprotUrl: selected ? `https://www.uniprot.org/uniprotkb/${selected[0]}` : '#',
        selectedSummary: selected ? `${graph.degree.get(s.selected) || 0} displayed edges · ${selected[2] >= 0 ? 'cluster C' + selected[2] : 'outside retained clusters'}.` : '',
        clearSelected: () => this.setState({ selected: -1 }), openSelected: () => this.openProtein(s.selected),
        partnersLoading: s.partnersLoading, partnerError: s.partnerError,
        retryPartners: () => this.loadPartners(partnerOwner), noPartners: hasPartners && !s.partnersLoading && !s.partnerRows.length,
        partners: hasPartners ? s.partnerRows.map(p => ({ gene: d.nodes[p[0]][1], acc: d.nodes[p[0]][0], weight: weight(p[1]), evidence: p[2] ? 'curated relationship' : 'no curated support', pick: () => this.openProtein(p[0]) })) : [],
        hasEdge: !!s.selectedEdge, edgeTitle: s.selectedEdge && d ? `${d.nodes[s.selectedEdge[0]][1]} — ${d.nodes[s.selectedEdge[1]][1]}` : '', edgeWeight: s.selectedEdge ? weight(s.selectedEdge[2]) : '',
        evidenceRows: s.selectedEdge ? C.evidence(s.selectedEdge[3], s.selectedEdge[4], s.manifest.databases).map(e => ({ ...e, color: e.status === 'Curated' ? '#c0fe04' : '#9a9aa6' })) : [],
        clearEdge: () => { this.network?.unselectAll(); this.setState({ selectedEdge: null }); },
        showClusters: s.mode === 'clusters' && !!d, clusterCount: d?.communities.length || 0,
        allClusters: () => this.setState({ cluster: -1, pathway: '', selected: -1, selectedEdge: null }),
        clusters: (d?.communities || []).map(c => ({ id: c.community, name: c.kegg_name || 'Unlabelled cluster', overlap: c.overlap, size: c.size,
          color: color(c.community), css: 'attn-list-button' + (s.cluster === c.community ? ' selected' : ''),
          pick: () => this.setState({ cluster: c.community, pathway: c.kegg_pathway || '', selected: -1, selectedEdge: null }),
        })),
        hasCluster: !!cluster && s.mode === 'clusters', clusterId: cluster?.community, clusterName: cluster?.kegg_name || '',
        clusterSummary: cluster ? `${cluster.overlap} of ${cluster.size} cluster proteins are annotated to this pathway. ${cluster.size - cluster.overlap} are not annotated; their membership is a hypothesis to investigate.` : '',
        clusterP: cluster?.p_value?.toExponential(2) || 'unavailable', keggUrl: cluster?.kegg_pathway ? `https://www.kegg.jp/pathway/${cluster.kegg_pathway}` : '#',
        clusterMethod: `Fixed Leiden communities from the top ${fmt(d?.clusterEdges || 3000)} edges, resolution ${d?.leiden.resolution || 1}, at least ${d?.leiden.min_size || 12} proteins. Changing edge count or degree does not rerun clustering or enrichment.`,
      };
    }
  };
  root.AttentionExplorer = { createLogic };
})(window);

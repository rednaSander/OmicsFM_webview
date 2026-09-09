// Pure graph operations, shared by the explorer and its integration checks.
(function (root) {
  'use strict';
  function filterEdges(data, options, partners = []) {
    const { mode, edgeLimit, degreeCap, cluster, protein } = options;
    let candidates = mode === 'protein'
      ? partners.slice(0, edgeLimit).map(p => [protein, p[0], p[1], p[2], p[3]])
      : data.edges.slice(0, edgeLimit);
    if (mode === 'clusters') candidates = candidates.filter(([a, b]) => {
      const ca = data.nodes[a][2], cb = data.nodes[b][2];
      return ca >= 0 && cb >= 0 && (cluster < 0 || (ca === cluster && cb === cluster));
    });
    const degree = new Map(), edges = [];
    for (const edge of candidates) {
      const [a, b, weight] = edge;
      if (a === b || !Number.isFinite(weight) || weight <= 0) continue;
      if (degreeCap && ((degree.get(a) || 0) >= degreeCap || (degree.get(b) || 0) >= degreeCap)) continue;
      edges.push(edge);
      degree.set(a, (degree.get(a) || 0) + 1);
      degree.set(b, (degree.get(b) || 0) + 1);
    }
    const nodes = [...degree.keys()];
    if (mode === 'protein' && protein >= 0 && !degree.has(protein)) nodes.push(protein);
    return { edges, nodes, degree, candidates: candidates.length };
  }
  function search(nodes, query, limit = 12) {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return nodes.map((n, id) => ({ id, n, score: n[0].toUpperCase() === q || n[1].toUpperCase() === q ? 0 : n[1].toUpperCase().startsWith(q) ? 1 : 2 }))
      .filter(({ n }) => n[0].toUpperCase().includes(q) || n[1].toUpperCase().includes(q))
      .sort((a, b) => a.score - b.score || a.n[1].localeCompare(b.n[1])).slice(0, limit);
  }
  function evidence(curated, evaluable, databases) {
    return databases.map((name, i) => ({ name, status: curated & (1 << i) ? 'Curated' : evaluable & (1 << i) ? 'Not curated' : 'Not covered' }));
  }
  const api = { filterEdges, search, evidence };
  root.AttentionCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);

const express = require('express');
const router = express.Router();
const { pool } = require('../lib/db');
const { UMAP } = require('umap-js');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── In-memory cache (data only changes on re-seed) ──
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/viz
 * Returns 2D-projected embeddings with cluster labels
 */
router.get('/', async (req, res) => {
  try {
    // Return cache if fresh
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      return res.json(cache);
    }

    // 1. Fetch all embeddings
    const [projectsRes, experienceRes] = await Promise.all([
      pool.query(`
        SELECT id, code, title, category, problem, solution, tags, sector_refs, embedding::text
        FROM projects WHERE embedding IS NOT NULL ORDER BY code
      `),
      pool.query(`
        SELECT id, company, role, period, description, tags, embedding::text
        FROM experience WHERE embedding IS NOT NULL ORDER BY company
      `),
    ]);

    const allItems = [];
    const allEmbeddings = [];

    for (const p of projectsRes.rows) {
      const emb = parseEmbedding(p.embedding);
      allEmbeddings.push(emb);
      allItems.push({
        type: 'project',
        code: p.code,
        title: p.title,
        category: p.category,
        tags: p.tags || [],
        refs: p.sector_refs || '',
        problem: p.problem,
        solution: p.solution,
      });
    }

    for (const e of experienceRes.rows) {
      const emb = parseEmbedding(e.embedding);
      allEmbeddings.push(emb);
      allItems.push({
        type: 'experience',
        company: e.company,
        role: e.role,
        period: e.period,
        description: e.description,
        tags: e.tags || [],
      });
    }

    if (allEmbeddings.length < 2) {
      return res.json({ points: [], clusters: [] });
    }

    // 2. UMAP: 512 dims → 3D
    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: Math.min(5, allEmbeddings.length - 1),
      minDist: 0.3,
      spread: 1.5,
      random: seededRandom(42),
    });
    const coords3D = umap.fit(allEmbeddings);

    // Normalize each axis to [0, 1]
    const xs = coords3D.map(c => c[0]);
    const ys = coords3D.map(c => c[1]);
    const zs = coords3D.map(c => c[2]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const rangeZ = maxZ - minZ || 1;

    const normalized = coords3D.map(c => [
      (c[0] - minX) / rangeX,
      (c[1] - minY) / rangeY,
      (c[2] - minZ) / rangeZ,
    ]);

    // 3. K-means clustering
    const k = Math.min(5, Math.floor(allItems.length / 3));
    const clusterAssignments = kmeans(normalized, k);

    // 4. Build cluster info
    const clusterGroups = {};
    for (let i = 0; i < allItems.length; i++) {
      const c = clusterAssignments[i];
      if (!clusterGroups[c]) clusterGroups[c] = [];
      clusterGroups[c].push({ ...allItems[i], idx: i });
    }

    // Compute centroids (3D)
    const clusterCentroids = {};
    for (const [cId, members] of Object.entries(clusterGroups)) {
      const cx = members.reduce((s, m) => s + normalized[m.idx][0], 0) / members.length;
      const cy = members.reduce((s, m) => s + normalized[m.idx][1], 0) / members.length;
      const cz = members.reduce((s, m) => s + normalized[m.idx][2], 0) / members.length;
      clusterCentroids[cId] = { cx, cy, cz };
    }

    // 5. LLM cluster labeling
    const clusterDescriptions = Object.entries(clusterGroups).map(([cId, members]) => {
      const items = members.map(m =>
        m.type === 'project'
          ? `${m.code} — ${m.title} (${m.category})`
          : `EXP: ${m.company} — ${m.role}`
      ).join('\n');
      return `Cluster ${cId}:\n${items}`;
    }).join('\n\n');

    // 5. LLM cluster labeling (with timeout to avoid serverless deadline)
    let clusterLabels = {};
    try {
      const llmPromise = anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Voici des clusters de réalisations et expériences professionnelles en IA/data. Pour chaque cluster, donne un titre court (3-5 mots max, en français) qui décrit le thème commun. Réponds UNIQUEMENT en JSON: {"0": "titre", "1": "titre", ...}\n\n${clusterDescriptions}`
        }],
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 8000)
      );
      const llmRes = await Promise.race([llmPromise, timeoutPromise]);
      const text = llmRes.content[0]?.text || '{}';
      console.log('[Viz] LLM raw response:', text);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) clusterLabels = JSON.parse(jsonMatch[0]);
    } catch (err) {
      console.error('[Viz] LLM labeling failed:', err.message, err.status || '', err.error || '');
      // Fallback: use cluster index
      for (const cId of Object.keys(clusterGroups)) {
        clusterLabels[cId] = `Cluster ${parseInt(cId) + 1}`;
      }
    }

    // 6. Assemble response (3D)
    const points = allItems.map((item, i) => ({
      ...item,
      x: normalized[i][0],
      y: normalized[i][1],
      z: normalized[i][2],
      cluster: clusterAssignments[i],
    }));

    const clusters = Object.entries(clusterGroups).map(([cId, members]) => ({
      id: parseInt(cId),
      label: clusterLabels[cId] || `Cluster ${parseInt(cId) + 1}`,
      cx: clusterCentroids[cId].cx,
      cy: clusterCentroids[cId].cy,
      cz: clusterCentroids[cId].cz,
      count: members.length,
    }));

    const result = { points, clusters };
    cache = result;
    cacheTime = Date.now();

    res.json(result);

  } catch (err) {
    console.error('[Viz] Error:', err.message);
    res.status(500).json({ error: 'Erreur de génération de la visualisation.' });
  }
});

// ── Force cache clear ──
router.post('/clear', (req, res) => {
  cache = null;
  cacheTime = 0;
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function parseEmbedding(embStr) {
  // pgvector returns "[0.1,0.2,...]"
  return embStr.replace(/[\[\]]/g, '').split(',').map(Number);
}

function seededRandom(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function kmeans(points, k, maxIter = 50) {
  const n = points.length;
  if (k >= n) return points.map((_, i) => i);

  // Init centroids: pick k evenly spaced points
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(i * n / k);
    centroids.push([...points[idx]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    const newAssign = points.map(p => {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = dist2(p, centroids[c]);
        if (d < bestDist) { bestDist = d; best = c; }
      }
      return best;
    });

    // Check convergence
    if (newAssign.every((a, i) => a === assignments[i])) break;
    assignments = newAssign;

    // Update centroids (N-dimensional)
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < centroids[c].length; d++) {
        centroids[c][d] = members.reduce((s, m) => s + m[d], 0) / members.length;
      }
    }
  }

  return assignments;
}

function dist2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

module.exports = router;

/**
 * KNNSimilar.js — "KNN Similar Questions"
 * Find semantically similar questions using embedding cosine similarity.
 * Shows the 5 nearest neighbours for each sampled question.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderKNNSimilarPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading similarity index...</div>`
  try {
    const data = await loadJSON('knn_similar.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  // Filter null/empty entries and drop ones with no useful neighbours
  const allEntries = Object.values(data || {}).filter(e => {
    if (!e || typeof e !== 'object') return false
    if (!e.question || !String(e.question).trim()) return false
    const ns = (e.neighbors || []).filter(n => Array.isArray(n) && n[0] && String(n[0]).trim())
    return ns.length > 0
  })

  // Fisher-Yates shuffle for a true random sample
  function shuffled(arr) {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>🔍 KNN Similar Questions</h1>
      <p>Pre-computed 5 nearest neighbours (cosine similarity) for ${allEntries.length} sampled questions. Use semantic search for more.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Built from <strong style="color:#fff">768-dim embeddings</strong> over all 6,134 questions.
        Similarity = cosine similarity (0 = opposite, 1 = identical).
        These neighbours may reveal <strong style="color:#fff">semantic duplicates KMeans misses</strong>.
      </p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="margin:0">Random Sample Explorer</h2>
        <button id="knnReshuffle" class="topic-tag" style="cursor:pointer">↻ Reshuffle</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px" id="knnGrid"></div>
    </div>
  `

  const gridEl = container.querySelector('#knnGrid')
  const reshuffleEl = container.querySelector('#knnReshuffle')

  function render() {
    const sample = shuffled(allEntries).slice(0, 40)
    gridEl.innerHTML = sample.map(entry => `
      <div class="knn-card">
        <div class="knn-q">
          <div class="knn-q-text">${escHtml(entry.question)}</div>
          <div class="knn-q-meta">
            <a href="/episodes?ep=${entry.episode}" class="nav-link" data-link>${entry.episode}</a>
            ${entry.resolved ? '<span style="color:var(--color-green);font-size:11px">✓ resolved</span>' : '<span style="color:var(--color-yellow);font-size:11px">✗ unresolved</span>'}
          </div>
        </div>
        <div class="knn-neighbors">
          ${(entry.neighbors || []).filter(n => Array.isArray(n) && n[0]).map(([nq, sim]) => `
            <div class="knn-n">
              <div class="knn-sim-bar"><div class="knn-sim-fill" style="width:${(sim*100).toFixed(1)}%"></div></div>
              <div class="knn-n-text">${escHtml(String(nq).slice(0, 90))}…</div>
              <div class="knn-sim-label">${(sim*100).toFixed(0)}%</div>
            </div>`
          ).join('')}
        </div>
      </div>
    `).join('')
  }

  render()
  reshuffleEl.addEventListener('click', render)
}

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
  const entries = Object.values(data || {})

  container.innerHTML = `
    <div class="page-header">
      <h1>🔍 KNN Similar Questions</h1>
      <p>Pre-computed 5 nearest neighbours (cosine similarity) for ${entries.length} randomly sampled questions. Use semantic search for more.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Built from <strong style="color:#fff">768-dim embeddings</strong> over all 6,097 questions.
        Similarity = cosine similarity (0 = opposite, 1 = identical).
        These neighbours may reveal <strong style="color:#fff">semantic duplicates KMeans misses</strong>.
      </p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h2>Random Sample Explorer</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px" id="knnGrid"></div>
    </div>
  `

  const gridEl = container.querySelector('#knnGrid')

  gridEl.innerHTML = entries.slice(0, 40).map(entry => `
    <div class="knn-card">
      <div class="knn-q">
        <div class="knn-q-text">${escHtml(entry.question)}</div>
        <div class="knn-q-meta">
          <a href="/episodes?ep=${entry.episode}" class="nav-link" data-link>${entry.episode}</a>
          ${entry.resolved ? '<span style="color:var(--color-green);font-size:11px">✓ resolved</span>' : '<span style="color:var(--color-yellow);font-size:11px">✗ unresolved</span>'}
        </div>
      </div>
      <div class="knn-neighbors">
        ${(entry.neighbors || []).map(([nq, sim], i) => `
          <div class="knn-n">
            <div class="knn-sim-bar"><div class="knn-sim-fill" style="width:${(sim*100).toFixed(1)}%"></div></div>
            <div class="knn-n-text">${escHtml(nq.slice(0, 90))}…</div>
            <div class="knn-sim-label">${(sim*100).toFixed(0)}%</div>
          </div>`
        ).join('')}
      </div>
    </div>
  `).join('')

  gridEl.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}

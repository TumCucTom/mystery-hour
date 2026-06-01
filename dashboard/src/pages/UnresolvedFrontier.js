/**
 * UnresolvedFrontier.js — "The Unresolved Frontier"
 * Clusters with the most unresolved questions — topics James has never cracked.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderUnresolvedFrontierPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const [frontier, clusterWorst] = await Promise.all([
      loadJSON('unresolved_frontier.json'),
      loadJSON('cluster_worst.json'),
    ])
    renderPage(container, frontier, clusterWorst)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data, clusterWorst) {
  const clusters = data || []
  const ci = {}
  for (const c of (clusterWorst.ranked_clusters || [])) {
    ci[c.cluster] = c
  }

  const totalUnres = clusters.reduce((s, c) => s + c.unresolved_count, 0)

  container.innerHTML = `
    <div class="page-header">
      <h1>🌀 The Unresolved Frontier</h1>
      <p>Topic clusters where questions have never been resolved. The topics James has never cracked.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <strong style="color:#f87171">${totalUnres} unanswered questions</strong> in clusters that have
        <strong style="color:#fff">never resolved</strong> across all 601 episodes.
        These topics are the final bosses of Mystery Hour.
      </p>
    </div>

    <div class="card">
      <h2>Hardest Topic Clusters</h2>
      <div class="uf-grid">
        ${clusters.map(c => {
          const info = ci[c.cluster] || {}
          return `
          <div class="uf-card card" style="border-left:4px solid var(--color-red)">
            <div class="uf-header">
              <div class="uf-cluster-id">Cluster ${c.cluster}</div>
              <div class="uf-badge">${c.unresolved_count} unresolved</div>
            </div>
            <div class="uf-label">${escHtml(c.label || '')}</div>
            <div class="uf-kw">${(c.keywords||[]).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
            <div class="uf-questions">
              ${(c.questions||[]).slice(0,3).map(q => `
                <div class="uf-q">
                  <a href="/episodes?ep=${q.ep}" class="nav-link" data-link>${q.ep}</a>
                  <span style="font-size:12px;color:var(--color-muted)">${escHtml(q.question.slice(0,80))}…</span>
                  ${q.n_answers > 0 ? `<span style="font-size:10px;color:var(--color-muted)">${q.n_answers} answers</span>` : '<span style="font-size:10px;color:var(--color-yellow)">unanswered</span>'}
                </div>
              `).join('')}
            </div>
          </div>`
        }).join('')}
      </div>
    </div>
  `

  container.querySelectorAll('a[data-link]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
  })
}

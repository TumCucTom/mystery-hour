/**
 * ClusterWorst.js — "Which Cluster Is James Worst At?"
 * Per-cluster overturned rate ranked. Find the topics that stump James most.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderClusterWorstPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const data = await loadJSON('cluster_worst.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const ranked = data.ranked_clusters || []
  const worst = ranked[0]
  // "Best" needs a minimum sample threshold — a cluster with 7 questions and 0 overturned isn't a meaningful "best"
  const MIN_BEST_SIZE = 20
  const bestCandidates = ranked.filter(r => (r.total || 0) >= MIN_BEST_SIZE)
  const best = bestCandidates[bestCandidates.length - 1]

  container.innerHTML = `
    <div class="page-header">
      <h1>🎯 Which Cluster Is James Worst At?</h1>
      <p>Per-cluster overturned answer rate — which topic clusters catch James out most?</p>
    </div>

    <div class="stats-grid" style="--cols:4;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-red)">${pct(worst?.overturned||0, worst?.total||1)}</div>
        <div class="stat-label">Worst Cluster Overturn Rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:var(--color-green)">${pct(best?.overturned||0, best?.total||1)}</div>
        <div class="stat-label">Best Cluster Overturn Rate <span style="font-size:10px;opacity:0.6">(≥${MIN_BEST_SIZE} Qs)</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${ranked.filter(r => (r.overturned_rate||0) > 0.15).length}</div>
        <div class="stat-label">Clusters >15% Overturn</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${ranked.length}</div>
        <div class="stat-label">Clusters Tracked</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;border-left:4px solid var(--color-red)">
      <h2>☠️ James's Worst Cluster</h2>
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <div>
          <div style="font-size:36px;font-weight:800;color:var(--color-red)">${pct(worst?.overturned||0, worst?.total||1)}</div>
          <div style="color:var(--color-muted);font-size:13px">overturned rate</div>
        </div>
        <div>
          <div style="font-weight:700;font-size:18px;margin-bottom:4px">${escHtml(worst?.label||'')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${(worst?.keywords||[]).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
          <div style="font-size:13px;color:var(--color-muted)">${worst?.overturned||0} overturned / ${worst?.total||0} questions</div>
        </div>
      </div>
      ${(worst?.examples||[]).length ? `
        <div style="margin-top:16px;border-top:1px solid var(--color-border);padding-top:12px">
          <div style="font-size:12px;color:var(--color-muted);margin-bottom:6px">Example overturned questions:</div>
          ${worst.examples.map(ex => `
            <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--color-border)">
              <a href="/episodes?ep=${ex.ep}" class="nav-link" data-link>${ex.ep}</a>
              — ${escHtml(ex.q)}…
            </div>
          `).join('')}
        </div>` : ''}
    </div>

    <div class="card">
      <h2>All Clusters Ranked by Overturn Rate</h2>
      <input type="text" id="cwSearch" placeholder="Filter clusters…" style="margin-bottom:12px;padding:8px;border-radius:6px;border:1px solid var(--color-border);width:100%;max-width:300px;background:var(--color-bg);color:var(--color-text)">
      <div id="cwList"></div>
    </div>
  `

  const listEl = container.querySelector('#cwList')
  const searchEl = container.querySelector('#cwSearch')

  function renderList(filter = '') {
    const q = filter.toLowerCase()
    const filtered = ranked.filter(r => !q || (r.label||'').toLowerCase().includes(q) || (r.keywords||[]).some(k => k.toLowerCase().includes(q)))
    const maxOver = Math.max(...ranked.map(r => r.overturned_rate || 0), 0.001)

    listEl.innerHTML = filtered.map(r => {
      const or_ = r.overturned_rate || 0
      const color = or_ > 0.15 ? 'var(--color-red)' : or_ > 0.08 ? 'var(--color-yellow)' : 'var(--color-green)'
      return `
      <div class="cw-row" style="border-left:3px solid ${color}">
        <div class="cw-label">
          <div style="font-weight:700;font-size:14px">${escHtml(r.label||'')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px">${(r.keywords||[]).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
        </div>
        <div class="cw-bar-wrap">
          <div class="cw-bar" style="width:${(or_/maxOver*100).toFixed(1)}%;background:${color}"></div>
        </div>
        <div class="cw-stats">
          <span style="font-weight:700;color:${color}">${pct(r.overturned, r.total)}</span>
          <span style="font-size:11px;color:var(--color-muted)">${r.overturned}O / ${r.total}Q</span>
        </div>
        <div class="cw-resolved">
          <span style="color:${(r.resolved_rate||0) > 0.8 ? 'var(--color-green)' : 'var(--color-muted)'}">${pct(r.resolved, r.total)}</span>
          <span style="font-size:11px;color:var(--color-muted)">resolved</span>
        </div>
      </div>`
    }).join('')
    listEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); history.pushState(null,'',a.href); window.dispatchEvent(new PopStateEvent('popstate')) })
    })
  }

  renderList()
  searchEl.addEventListener('input', e => renderList(e.target.value))
}

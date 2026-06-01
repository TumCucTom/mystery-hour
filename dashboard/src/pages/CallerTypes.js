/**
 * CallerTypes.js — "Caller Type Classifier"
 * Cluster callers by their topic distribution → label them as "Science Expert", "History Buff" etc.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderCallerTypesPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading caller types...</div>`
  try {
    const data = await loadJSON('caller_types.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const { callers, cluster_info: ci } = data
  const colour = (cid) => {
    const cols = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6']
    return cols[(cid || 0) % cols.length]
  }

  // Group callers by type label
  const typeGroups = {}
  for (const c of (callers || [])) {
    const label = c.type_label || `Topic ${c.dominant_cluster}`
    if (!typeGroups[label]) typeGroups[label] = []
    typeGroups[label].push(c)
  }
  const typeList = Object.entries(typeGroups).sort((a, b) => b[1].length - a[1].length)

  container.innerHTML = `
    <div class="page-header">
      <h1>🎯 Caller Type Classifier</h1>
      <p>Callers with 3+ questions clustered by their dominant topic. What kind of expert are they?</p>
    </div>

    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value">${callers?.length || 0}</div>
        <div class="stat-label">Typed Callers (3+ Q)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${typeList.length}</div>
        <div class="stat-label">Caller Types</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(callers || []).filter(c => c.dominant_pct > 0.5).length}</div>
        <div class="stat-label">Specialists (>50% one topic)</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h2>Caller Types</h2>
      <div class="type-grid">
        ${typeList.map(([label, members]) => `
          <div class="type-block card">
            <div class="type-header" style="border-left:4px solid ${colour(members[0].dominant_cluster)}">
              <div class="type-name">${escHtml(label)}</div>
              <div class="type-count">${members.length} callers</div>
            </div>
            <div class="type-members">
              ${members.slice(0, 8).map(c => {
                const info = (ci || {})[String(c.dominant_cluster)] || {}
                const kw = (info.keywords || [])[0] || ''
                return `
                <div class="type-member">
                  <div class="type-member-name">${escHtml(c.caller.split(' from ')[0])}</div>
                  <div class="type-member-loc">${escHtml(c.caller.split(' from ')[1] || '')}</div>
                  <div class="type-member-meta">
                    <span class="topic-tag" style="background:${colour(c.dominant_cluster)};color:#fff;font-size:9px">${escHtml(kw.slice(0,10))}</span>
                    <span style="font-size:10px;color:var(--color-muted)">${c.dominant_pct>0.5?'⭐':''} ${c.total_q}Q</span>
                  </div>
                </div>`
              }).join('')}
              ${members.length > 8 ? `<div style="font-size:11px;color:var(--color-muted);padding:4px 0">+${members.length-8} more</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

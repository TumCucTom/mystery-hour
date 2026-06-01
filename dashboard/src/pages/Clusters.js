/**
 * Clusters.js — topic cluster explorer
 */

export function renderClusters(page, store) {
  const { data } = store
  const clusters = data.clusters

  page.innerHTML = `
    <div class="page-header">
      <h1>Topic Clusters</h1>
      <p>Questions grouped by semantic similarity — BAAI/bge-base-en-v1.5 embeddings + KMeans clustering.</p>
    </div>
    <div class="section" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;margin:1rem 0">
      <select id="kSelect">
        <option value="80">k=80 clusters</option>
        <option value="120">k=120 clusters</option>
      </select>
      <input type="text" class="search-input" id="clusterFilter" placeholder="Filter by keyword (e.g. football, language...)" style="max-width:280px">
      <span id="clusterCount" style="color:#888;font-size:0.85rem"></span>
    </div>
    <div id="clusterGrid" class="cluster-grid" style="grid-template-columns:repeat(auto-fill, minmax(280px, 1fr))"></div>
    <div id="clusterDetail"></div>
  `

  const kSelect = page.querySelector('#kSelect')
  const filter = page.querySelector('#clusterFilter')
  const grid = page.querySelector('#clusterGrid')
  const detail = page.querySelector('#clusterDetail')

  let activeK = 80
  let activeClusters = clusters.k80 || []

  function render(filterText = '') {
    const ft = filterText.toLowerCase()
    const filtered = activeClusters.filter(c =>
      !ft ||
      (c.topic_label || '').toLowerCase().includes(ft) ||
      (c.keywords || []).some(k => k.toLowerCase().includes(ft))
    )
    page.querySelector('#clusterCount').textContent = `${filtered.length} clusters`

    grid.innerHTML = filtered.map(c => `
      <div class="cluster-card" data-cid="${c.cluster_id}">
        <div class="cluster-id">Cluster ${c.cluster_id} · ${c.size} Qs</div>
        <div class="cluster-topic">${escHtml(c.topic_label || '—')}</div>
        <div class="cluster-meta">
          <span class="badge ${c.resolved_rate > 0.7 ? 'badge-success' : 'badge-warning'}">${Math.round(c.resolved_rate*100)}% resolved</span>
          <span>avg ${c.avg_answers} answers</span>
        </div>
        <div class="cluster-kw">${(c.keywords || []).join(' · ')}</div>
      </div>
    `).join('')
  }

  kSelect.addEventListener('change', e => {
    activeK = parseInt(e.target.value)
    activeClusters = activeK === 120 ? (clusters.k120 || []) : (clusters.k80 || [])
    detail.style.display = 'none'
    render(filter.value)
  })

  filter.addEventListener('input', e => render(e.target.value))

  grid.addEventListener('click', e => {
    const card = e.target.closest('.cluster-card')
    if (!card) return
    const cid = parseInt(card.dataset.cid)
    showCluster(activeClusters.find(c => c.cluster_id === cid), detail)
  })

  render()
}

export function showCluster(c, detailEl) {
  if (!c) return
  const detail = detailEl || document.getElementById('clusterDetail')
  if (!detail) return
  detail.innerHTML = `
    <div class="card" style="margin-top:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h2 style="margin:0;font-size:1.3rem">Cluster ${c.cluster_id}: ${escHtml(c.topic_label || '')}</h2>
          <p style="margin:0.3rem 0 0;color:var(--text-muted)">${c.size} questions · ${Math.round(c.resolved_rate*100)}% resolved · avg ${c.avg_answers} answers</p>
        </div>
        <button class="btn btn-ghost" onclick="this.closest('.card').remove()">✕ Close</button>
      </div>
      <div class="cluster-kw" style="margin-bottom:1rem">${(c.keywords || []).join(' · ')}</div>
      ${(c.examples || []).map(ex => ex ? `
        <div class="q-item" style="margin:0.4rem 0">
          <div class="q-text" style="font-style:italic;color:#555">"${escHtml(ex)}"</div>
        </div>
      ` : '').join('')}
    </div>
  `
  detail.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

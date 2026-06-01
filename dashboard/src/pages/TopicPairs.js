/**
 * TopicPairs.js — "Topic Pair Co-occurrence"
 * Which topic clusters appear together most often in the same episode?
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderTopicPairsPage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading co-occurrence data...</div>`
  try {
    const data = await loadJSON('topic_pairs.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const { topics, cluster_info: ci, matrix, top_pairs } = data
  const clusters = topics || []

  // Build colour lookup
  const colour = (cid) => {
    const colours = ['#f87171','#fb923c','#fbbf24','#a3e635','#34d399','#22d3ee','#60a5fa','#a78bfa','#f472b6','#e879f9','#94a3b8','#4ade80','#2dd4bf','#818cf8','#c084fc','#fb7185','#facc15']
    return colours[(cid || 0) % colours.length]
  }

  // Normalise matrix to max for colour scale
  let maxC = 0
  for (const row of Object.values(matrix || {})) {
    for (const v of Object.values(row)) { if (v > maxC) maxC = v }
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>🔗 Topic Pair Co-occurrence</h1>
      <p>Which topic clusters appear together in the same episode? Cell colour = co-occurrence count.</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        Hover a row to see all pairs for that cluster. Click a top pair to highlight it.
        <strong style="color:#fff">${top_pairs?.[0]?.[1]}x ${top_pairs?.[0]?.[0]?.[0]}</strong> is the most common cluster pair.
      </p>
    </div>

    <!-- Co-occurrence matrix -->
    <div class="card" style="margin-bottom:24px">
      <h2>Co-occurrence Matrix (top ${clusters.length} clusters)</h2>
      <div style="overflow-x:auto">
        <div class="matrix-wrap">
          ${buildMatrix(clusters, matrix, ci, maxC, colour)}
        </div>
      </div>
    </div>

    <!-- Top pairs ranked -->
    <div class="card">
      <h2>Top 40 Cluster Pairs</h2>
      <div class="pairs-list">
        ${(top_pairs || []).map(([[c1, c2], count], i) => {
          const info1 = (ci || {})[String(c1)] || {}
          const info2 = (ci || {})[String(c2)] || {}
          return `
          <div class="pair-row" data-c1="${c1}" data-c2="${c2}">
            <div class="pair-rank">${i+1}</div>
            <div class="pair-clusters">
              <span class="topic-tag" style="background:${colour(c1)};color:#fff">C${c1}</span>
              <span style="color:var(--color-muted)">+</span>
              <span class="topic-tag" style="background:${colour(c2)};color:#fff">C${c2}</span>
            </div>
            <div class="pair-info">
              <div class="pair-label">${escHtml((info1.label || '').slice(0,30))} + ${escHtml((info2.label || '').slice(0,30))}</div>
              <div class="pair-kw">${[(info1.keywords||[])[0], (info2.keywords||[])[0]].filter(Boolean).map(k => `<span class="topic-tag">${escHtml(k)}</span>`).join('')}</div>
            </div>
            <div class="pair-count-bar">
              <div class="pair-bar-fill" style="width:${(count/(top_pairs[0][1]))*100}%;background:${colour(c1)}"></div>
            </div>
            <div class="pair-count">${count}×</div>
          </div>`
        }).join('')}
      </div>
    </div>
  `

  // Matrix cell tooltips
  container.querySelectorAll('.m-cell').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      const c1 = cell.dataset.c1, c2 = cell.dataset.c2
      const info1 = (ci || {})[String(c1)] || {}
      const info2 = (ci || {})[String(c2)] || {}
      cell.title = `${info1.label || c1} + ${info2.label || c2}: ${cell.dataset.v}×`
    })
  })
}

function buildMatrix(clusters, matrix, ci, maxC, colour) {
  const n = clusters.length
  const cellSize = Math.max(28, Math.min(48, Math.floor(600 / n)))

  let html = `<div style="display:grid;grid-template-columns:auto repeat(${n},${cellSize}px);grid-template-rows:auto repeat(${n},${cellSize}px);gap:1px">`

  // Header row
  html += `<div></div>`
  for (const cid of clusters) {
    const info = (ci || {})[String(cid)] || {}
    const kw = (info.keywords || [])[0] || `C${cid}`
    html += `<div class="m-header" style="writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);height:${cellSize}px;font-size:9px;color:var(--color-muted);display:flex;align-items:center;justify-content:center" title="${escHtml((info.label||'').slice(0,20))}">${escHtml(kw.slice(0,8))}</div>`
  }

  // Rows
  for (const cid1 of clusters) {
    const row = matrix?.[String(cid1)] || {}
    const info1 = (ci || {})[String(cid1)] || {}
    const kw1 = (info1.keywords || [])[0] || `C${cid1}`
    html += `<div class="m-header" style="font-size:9px;color:var(--color-muted);display:flex;align-items:center;white-space:nowrap" title="${escHtml((info1.label||'').slice(0,20))}">${escHtml(kw1.slice(0,8))}</div>`
    for (const cid2 of clusters) {
      const v = row?.[String(cid2)] || 0
      const intensity = maxC > 0 ? v / maxC : 0
      const c = cid1 === cid2 ? 'rgba(255,255,255,0.08)' : `rgba(59,130,246,${(0.1 + intensity * 0.9).toFixed(3)})`
      html += `<div class="m-cell" data-c1="${cid1}" data-c2="${cid2}" data-v="${v}" style="width:${cellSize}px;height:${cellSize}px;background:${c};border-radius:2px;cursor:${v > 0 ? 'pointer' : 'default'};transition:filter 0.15s" title="${v}×"></div>`
    }
  }
  html += '</div>'
  return html
}

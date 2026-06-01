/**
 * RayLiotta.js — Every Ray Liotta award given on Mystery Hour.
 * "I'm Ray Liotta and you're listening to James O'Brien on LBC. If you build it, they will come."
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export async function renderRayLiottaPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Ray Liotta awards...</div>`
  try {
    const data = await loadJSON(`${BASE}/ray_liotta_awards.json`)
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load: ${e.message}</p></div>`
  }
}

function renderPage(container, data) {
  const awards = Array.isArray(data) ? data : (data.awards || [])

  container.innerHTML = `
    <div class="page-header">
      <h1>🏆 The Ray Liotta Awards</h1>
      <p>"I'm Ray Liotta and you're listening to James O'Brien on LBC. If you build it, they will come."</p>
    </div>

    <div class="stats-grid" style="--cols:3;margin-bottom:24px">
      <div class="stat-card"><div class="stat-value">${awards.length}</div><div class="stat-label">Ray Liotta Awards</div></div>
      <div class="stat-card"><div class="stat-value">${new Set(awards.map(a => a.episode)).size}</div><div class="stat-label">Episodes</div></div>
      <div class="stat-card"><div class="stat-value">${awards.filter(a => a.qualification).length}</div><div class="stat-label">With Qualification</div></div>
    </div>

    <div class="card" style="background:rgba(231,76,60,0.06);border-left:4px solid #e74c3c;margin-bottom:24px">
      <p style="font-size:15px;line-height:1.7">
        When a caller gives an answer of <em>exceptional expertise</em> — demonstrating genuine credentials, rare knowledge, or personal experience —
        James awards them a Ray Liotta: a recording of Ray Liotta doing <em>"If you build it, they will come"</em> from Field of Dreams.
        It is the highest honour in British radio.
      </p>
    </div>

    <input type="text" id="rlSearch" placeholder="Search by episode, caller, or qualification..." style="margin-bottom:20px;padding:10px;border-radius:8px;border:1px solid var(--color-border);width:100%;max-width:500px">

    <div id="rlList"></div>
  `

  const listEl = container.querySelector('#rlList')

  function render(filter) {
    const filtered = awards.filter(a => {
      if (!filter) return true
      const s = filter.toLowerCase()
      return (
        (a.episode || '').includes(s) ||
        (a.caller || '').toLowerCase().includes(s) ||
        (a.qualification || '').toLowerCase().includes(s) ||
        (a.question || '').toLowerCase().includes(s) ||
        (a.answer || '').toLowerCase().includes(s)
      )
    })

    if (!filtered.length) {
      listEl.innerHTML = `<div class="card" style="text-align:center;color:var(--color-muted);padding:40px">No awards match "${esc(filter)}"</div>`
      return
    }

    listEl.innerHTML = filtered.map(a => `
      <div class="card" style="margin-bottom:20px;border-left:3px solid #e74c3c;padding:16px 20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div>
            <a href="/episodes?ep=${a.episode}" class="nav-link" data-link style="font-weight:700;font-size:16px">${esc(a.episode)}</a>
            ${a.caller && a.caller !== 'Unknown' ? `<span style="margin-left:12px;font-size:14px;color:var(--color-muted)">— <strong>${esc(a.caller)}</strong></span>` : ''}
          </div>
          <span style="background:#e74c3c;color:white;padding:3px 12px;border-radius:12px;font-size:12px;flex-shrink:0">🎙️ Ray Liotta awarded</span>
        </div>

        ${a.qualification ? `
        <div style="margin-bottom:8px;font-size:14px;background:rgba(46,204,113,0.1);border-radius:6px;padding:8px 12px;border-left:3px solid #2ecc71">
          <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--color-green);font-weight:700">Qualification</span>
          <div style="margin-top:4px;font-style:italic;color:var(--color-text)">"${esc(a.qualification)}"</div>
        </div>` : ''}

        ${a.question ? `
        <div style="margin-bottom:6px;font-size:15px">
          <strong style="color:var(--color-muted);font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Q:</strong>
          <span>${esc(a.question)}</span>
        </div>` : ''}

        ${a.answer ? `
        <div style="font-size:14px;color:var(--color-secondary)">
          <strong style="color:var(--color-muted);font-size:12px;text-transform:uppercase;letter-spacing:0.5px">A:</strong>
          <span>${esc(a.answer)}</span>
        </div>` : ''}
      </div>
    `).join('')

    listEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }

  render('')
  container.querySelector('#rlSearch').addEventListener('input', e => render(e.target.value))
}
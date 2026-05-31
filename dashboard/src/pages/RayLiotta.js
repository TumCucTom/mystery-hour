/**
 * RayLiotta.js — Every Ray Liotta award given on Mystery Hour.
 * "The highest honour British radio can bestow."
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }

export async function renderRayLiottaPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Ray Liotta awards...</div>`
  try {
    const data = await loadJSON(`${BASE}/ray_liotta_awards.json`)
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load Ray Liotta data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const awards = data.awards || []
  const byEpisode = {}
  for (const a of awards) {
    byEpisode.setdefault(a.episode, []).push(a)
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>🏆 The Ray Liotta Awards</h1>
      <p>"I'm Ray Liotta and you're listening to James O'Brien on LBC. If you build it, they will come." — The highest honour British radio can bestow.</p>
    </div>

    <div class="stats-grid" style="--cols:4;margin-bottom:24px">
      <div class="stat-card"><div class="stat-value">${data.total_awards.toLocaleString()}</div><div class="stat-label">Total Ray Liotta Awards</div></div>
      <div class="stat-card"><div class="stat-value">${data.episodes_count}</div><div class="stat-label">Episodes with Awards</div></div>
      <div class="stat-card"><div class="stat-value">${awards.filter(a => a.caller && a.caller !== 'Unknown').length}</div><div class="stat-label">Named Callers</div></div>
      <div class="stat-card"><div class="stat-value">${awards.filter(a => a.question.length > 50 && a.answer.length > 20).length}</div><div class="stat-label">Full Q&amp;A Captured</div></div>
    </div>

    <div class="card" style="margin-bottom:24px;background:rgba(231,76,60,0.08);border-left:4px solid #e74c3c">
      <h2 style="color:#e74c3c">📜 What is a Ray Liotta?</h2>
      <p style="font-size:15px;line-height:1.7">
        When a caller gives an answer of exceptional quality — demonstrating genuine expertise,
        unique knowledge, or "credentials that are almost unbelievably apposite relevant" — James
        awards them a Ray Liotta: a recording of the actor Ray Liotta doing the
        <em>"If you build it, they will come"</em> line from Field of Dreams, the movie he narrated.
        It is the highest accolade in British radio.
      </p>
    </div>

    <div style="margin-bottom:16px">
      <input type="text" id="rlSearch" placeholder="Search awards..." style="padding:10px;border-radius:8px;border:1px solid var(--color-border);width:100%;max-width:400px">
    </div>

    <div id="rlList"></div>
  `

  const listEl = container.querySelector('#rlList')

  function render(filter) {
    const filtered = awards.filter(a =>
      !filter ||
      (a.question && a.question.toLowerCase().includes(filter)) ||
      (a.answer && a.answer.toLowerCase().includes(filter)) ||
      (a.caller && a.caller.toLowerCase().includes(filter)) ||
      a.episode.includes(filter)
    )

    if (!filtered.length) {
      listEl.innerHTML = `<div class="card" style="text-align:center;color:var(--color-muted)">No awards match your search.</div>`
      return
    }

    listEl.innerHTML = filtered.map(a => `
      <div class="card" style="margin-bottom:16px;border-left:3px solid #e74c3c">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
          <div>
            <a href="/episodes?ep=${a.episode}" class="nav-link" data-link style="font-weight:700">${a.episode}</a>
            ${a.caller && a.caller !== 'Unknown' ? `<span style="margin-left:12px;font-size:14px;color:var(--color-muted)">— ${escHtml(a.caller)}</span>` : ''}
          </div>
          <div style="flex-shrink:0;margin-left:12px">
            <span style="background:#e74c3c;color:white;padding:3px 10px;border-radius:12px;font-size:12px">🎙️ Ray Liotta</span>
          </div>
        </div>
        ${a.question ? `<div style="margin-bottom:6px;font-size:15px"><strong>Q:</strong> ${escHtml(a.question.slice(0,300))}${a.question.length > 300 ? '...' : ''}</div>` : ''}
        ${a.answer ? `<div style="margin-bottom:8px;font-size:14px;color:var(--color-secondary)"><strong>A:</strong> ${escHtml(a.answer.slice(0,200))}${a.answer.length > 200 ? '...' : ''}</div>` : ''}
        ${a.qualification_reason && a.qualification_reason.length > 10 ? `
        <div style="font-size:13px;color:var(--color-muted);font-style:italic">"${escHtml(a.qualification_reason.slice(0,200))}${a.qualification_reason.length > 200 ? '...' : ''}"</div>` : ''}
        ${a.ray_liotta_line ? `<div style="margin-top:8px;font-size:12px;color:var(--color-muted);font-family:monospace">🎵 ${escHtml(a.ray_liotta_line.slice(0,100))}</div>` : ''}
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
  container.querySelector('#rlSearch').addEventListener('input', e => render(e.target.value.toLowerCase()))
}
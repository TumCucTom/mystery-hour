/**
 * RayLiotta.js — Every Ray Liotta award given on Mystery Hour.
 * "I'm Ray Liotta and you're listening to James O'Brien on LBC. If you build it, they will come."
 *
 * The accolade is awarded to callers who demonstrate exceptional
 * expertise — unique qualifications, rare knowledge, or personal
 * experience that lets them answer a question better than anyone
 * listening.
 */
import { loadJSON } from '../lib/data.js'

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function truncate(s, n) {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + '…'
}

export async function renderRayLiottaPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Ray Liotta awards…</div>`
  try {
    const data = await loadJSON('ray_liotta_awards.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load: ${e.message}</p></div>`
  }
}

function renderPage(container, data) {
  const awards = Array.isArray(data) ? data : (data.awards || [])
  const withName = awards.filter(a => a.caller).length
  const uniqueCallers = new Set(awards.map(a => a.caller).filter(Boolean)).size

  container.innerHTML = `
    <div class="page-header">
      <h1>🏆 The Ray Liotta Awards</h1>
      <p class="page-header-sub">
        "I'm Ray Liotta and you're listening to James O'Brien on LBC. If you build it, they will come."
      </p>
    </div>

    <div class="rl-hero">
      <div class="rl-hero-text">
        <h2>The best of the best.</h2>
        <p>When a caller earns the right to be believed — through credentials, experience, or knowledge so rare that no one else on the line could match it — James plays the voice note. It's the highest honour in British radio, and it's been given <strong>${awards.length} times</strong> across <strong>${new Set(awards.map(a => a.episode)).size} episodes</strong>.</p>
        <p class="rl-hero-quote">"If you build it, they will come." <span>— Field of Dreams (the recording)</span></p>
      </div>
      <div class="rl-hero-stats">
        <div class="rl-stat"><div class="rl-stat-num">${awards.length}</div><div class="rl-stat-label">Awards given</div></div>
        <div class="rl-stat"><div class="rl-stat-num">${new Set(awards.map(a => a.episode)).size}</div><div class="rl-stat-label">Episodes</div></div>
        <div class="rl-stat"><div class="rl-stat-num">${uniqueCallers}</div><div class="rl-stat-label">Unique callers</div></div>
        <div class="rl-stat"><div class="rl-stat-num">${withName}</div><div class="rl-stat-label">Named on air</div></div>
      </div>
    </div>

    <div class="rl-filters">
      <input type="text" id="rlSearch" placeholder="Search caller, qualification, or answer…" />
      <select id="rlSort">
        <option value="recent">Most recent</option>
        <option value="oldest">Oldest first</option>
        <option value="qual-len">Longest qualification</option>
        <option value="answer-len">Longest answer</option>
      </select>
      <span class="rl-filter-count" id="rlCount"></span>
    </div>

    <div id="rlList"></div>
  `

  const listEl = container.querySelector('#rlList')
  const searchEl = container.querySelector('#rlSearch')
  const sortEl = container.querySelector('#rlSort')
  const countEl = container.querySelector('#rlCount')

  // Sort by episode number for default ("most recent" — higher ep = more recent)
  function getEpNum(a) {
    const m = (a.episode || '').match(/ep_(\d+)/)
    return m ? parseInt(m[1], 10) : 0
  }

  function render() {
    const filter = searchEl.value.trim().toLowerCase()
    const sort = sortEl.value

    let filtered = awards
    if (filter) {
      filtered = filtered.filter(a => {
        const hay = [
          a.caller, a.qualification, a.question, a.answer, a.episode
        ].join(' ').toLowerCase()
        return hay.includes(filter)
      })
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'recent') return getEpNum(b) - getEpNum(a)
      if (sort === 'oldest') return getEpNum(a) - getEpNum(b)
      if (sort === 'qual-len') return (b.qualification || '').length - (a.qualification || '').length
      if (sort === 'answer-len') return (b.answer || '').length - (a.answer || '').length
      return 0
    })

    countEl.textContent = `${sorted.length} of ${awards.length}`

    if (!sorted.length) {
      listEl.innerHTML = `<div class="card" style="text-align:center;color:var(--color-muted);padding:40px">No awards match "${esc(filter)}"</div>`
      return
    }

    listEl.innerHTML = sorted.map(a => `
      <div class="rl-card">
        <div class="rl-card-head">
          <div class="rl-card-id">
            <a href="/episodes?ep=${esc(a.episode)}" class="rl-card-ep" data-link>${esc(a.episode)}</a>
            ${a.caller ? `<span class="rl-card-caller">${esc(a.caller)}</span>` : '<span class="rl-card-caller rl-card-anon">caller</span>'}
          </div>
          <span class="rl-card-badge">Ray Liotta</span>
        </div>

        ${a.qualification ? `
          <div class="rl-section rl-qual">
            <div class="rl-section-label">Qualification</div>
            <div class="rl-qual-body">${esc(truncate(a.qualification, 600))}</div>
          </div>` : ''}

        ${a.question ? `
          <div class="rl-section rl-q">
            <span class="rl-section-label">Q</span>
            <span class="rl-q-body">${esc(truncate(a.question, 400))}</span>
          </div>` : ''}

        ${a.answer ? `
          <div class="rl-section rl-a">
            <span class="rl-section-label">A</span>
            <span class="rl-a-body">${esc(truncate(a.answer, 500))}</span>
          </div>` : ''}
      </div>
    `).join('')
  }

  searchEl.addEventListener('input', render)
  sortEl.addEventListener('change', render)
  render()
}

/**
 * HallOfFame.js — "The Hall of Fame"
 * Repeat expert callers who appeared across multiple episodes.
 * Shows a leaderboard sorted by number of episodes, with expertise topics.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct(n, d) {
  return d ? `${Math.round(n / d * 100)}%` : '—'
}

export async function renderHallOfFamePage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading Hall of Fame...</div>`
  try {
    const data = await loadJSON('hall_of_fame.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load Hall of Fame data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const experts = data.experts || []
  const total = data.total || 0

  container.innerHTML = `
    <div class="page-header">
      <h1>🏆 The Hall of Fame</h1>
      <p>Callers who came back for more — repeat experts across multiple episodes.</p>
    </div>

    <div class="stats-grid" style="--cols: 3">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Repeat Expert Callers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${experts.length}</div>
        <div class="stat-label">Hall of Famers (2+ episodes)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${experts.filter(e => e.expertise && e.expertise.length > 0).length}</div>
        <div class="stat-label">With Known Expertise</div>
      </div>
    </div>

    <div class="card">
      <h2>Leaderboard</h2>
      <div class="hof-controls" style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap">
        <input type="text" id="hofSearch" placeholder="Search callers or locations..." style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text);flex:1;min-width:200px">
        <select id="hofSort" style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text)">
          <option value="episodes">Sort by Episodes</option>
          <option value="questions">Sort by Questions</option>
          <option value="rate">Sort by Win Rate</option>
        </select>
      </div>
      <div id="hofList"></div>
    </div>
  `

  const listEl = container.querySelector('#hofList')
  const searchEl = container.querySelector('#hofSearch')
  const sortEl = container.querySelector('#hofSort')

  function render(filter = '', sort = 'episodes') {
    const q = filter.toLowerCase()
    let filtered = experts.filter(e =>
      (!q || e.name.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q))
    )

    if (sort === 'episodes') {
      filtered.sort((a, b) => -(a.n_eps || a.episodes.length) + -(b.n_eps || b.episodes.length))
    } else if (sort === 'questions') {
      filtered.sort((a, b) => -a.questions + -b.questions)
    } else {
      filtered.sort((a, b) => {
        const ra = a.questions ? a.resolved / a.questions : 0
        const rb = b.questions ? b.resolved / b.questions : 0
        return ra - rb
      })
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div style="text-align:center;color:var(--color-muted);padding:32px">No callers match your search.</div>`
      return
    }

    listEl.innerHTML = `
      <div class="hof-grid">
        ${filtered.map((e, i) => {
          const nEps = e.n_eps || e.episodes.length
          const rate = e.questions ? e.resolved / e.questions : 0
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span class="hof-rank">#${i + 1}</span>`
          return `
          <div class="hof-card">
            <div class="hof-medal">${medal}</div>
            <div class="hof-info">
              <div class="hof-name">${escHtml(e.name)}</div>
              <div class="hof-location">📍 ${escHtml(e.location || 'Unknown')}</div>
              <div class="hof-stats">
                <span class="hof-stat">
                  <span class="hof-stat-val">${nEps}</span>
                  <span class="hof-stat-lbl">episodes</span>
                </span>
                <span class="hof-stat">
                  <span class="hof-stat-val">${e.questions}</span>
                  <span class="hof-stat-lbl">questions</span>
                </span>
                <span class="hof-stat">
                  <span class="hof-stat-val" style="color: ${rate >= 0.8 ? 'var(--color-green)' : rate >= 0.5 ? 'var(--color-yellow)' : 'var(--color-red)'}">${pct(e.resolved, e.questions)}</span>
                  <span class="hof-stat-lbl">win rate</span>
                </span>
              </div>
              ${e.expertise && e.expertise.length ? `<div class="hof-topics">${e.expertise.map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
              <div class="hof-episodes">
                ${(e.episodes || []).slice(0, 5).map(ep => `
                  <a href="/episodes?ep=${ep}" class="nav-link hof-ep-link" data-link>${ep}</a>
                `).join('')}
                ${(e.episodes || []).length > 5 ? `<span style="color:var(--color-muted)">+${e.episodes.length - 5} more</span>` : ''}
              </div>
            </div>
          </div>
        `}).join('')}
      </div>
    `

    listEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }

  render()
  searchEl.addEventListener('input', e => render(e.target.value, sortEl.value))
  sortEl.addEventListener('change', e => render(searchEl.value, e.target.value))
}

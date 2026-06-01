/**
 * Episodes.js — browse all episodes with Q&A detail
 */
export function renderEpisodes(page, store) {
  const { data } = store
  const eps = data.episodeStats

  page.innerHTML = `
    <div class="page-header">
      <h1>All Episodes</h1>
      <p>${eps.length} episodes · click any to explore its full Q&A.</p>
    </div>
    <div style="margin:1rem 0">
      <input type="text" class="search-input" id="epSearch" placeholder="Search episodes (e.g. football, ep_042)...">
    </div>
    <div id="epList"></div>
    <div id="episodesDetail"></div>
  `

  const epList = page.querySelector('#epList')
  const detailEl = page.querySelector('#episodesDetail')

  function renderList(eps2) {
    epList.innerHTML = eps2.map(ep => `
      <div class="card" style="display:grid;grid-template-columns:70px 1fr auto;gap:1rem;align-items:center;cursor:pointer;margin:0.4rem 0" data-ep="${ep.episode}">
        <div style="font-size:1.6rem;font-weight:800;color:var(--primary);text-align:center">${ep.episode.replace('ep_','')}</div>
        <div>
          <div style="font-weight:700;font-size:0.95rem">${ep.episode}</div>
          <div style="font-size:0.78rem;color:var(--text-muted)">${(ep.topics || []).join(', ') || 'various topics'}</div>
        </div>
        <div style="text-align:right;font-size:0.82rem">
          <div style="font-weight:700">${ep.n_questions}</div>
          <div style="color:var(--text-muted)">questions</div>
          <div style="color:var(--text-muted)">${ep.resolved} resolved</div>
        </div>
      </div>
    `).join('')

    epList.querySelectorAll('[data-ep]').forEach(card => {
      card.addEventListener('click', () => {
        const epId = card.dataset.ep
        history.pushState(null, '', `/episodes?ep=${epId}`)
        showEpisode(store, epId)
      })
    })
  }

  renderList(eps)

  // Search
  page.querySelector('#epSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase()
    const filtered = eps.filter(ep =>
      ep.episode.toLowerCase().includes(q) ||
      (ep.topics || []).some(t => t.toLowerCase().includes(q))
    )
    renderList(filtered)
  })

  // URL param
  const params = new URLSearchParams(location.search)
  const epParam = params.get('ep')
  if (epParam) showEpisode(store, epParam)
}

export function showEpisode(store, epId) {
  const { data } = store
  const ep = data.episodes.find(e => e.episode === epId)
  const detailEl = document.getElementById('episodesDetail')
  if (!ep || !detailEl) return

  const questions = ep.questions || []
  detailEl.innerHTML = `
    <div class="card" style="margin-top:1.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
        <div>
          <h2 style="margin:0;font-size:1.3rem">${ep.episode}</h2>
          <p style="margin:0.3rem 0 0;color:var(--text-muted)">
            ${questions.length} questions · ${questions.filter(q => q.resolved).length} resolved
          </p>
        </div>
        <button class="btn btn-ghost" onclick="this.closest('.card').remove()">← Back</button>
      </div>
      ${questions.map((q, qi) => `
        <div class="q-item" id="q${qi}">
          <div class="q-text"><strong>${escHtml(q.caller || 'anonymous')}:</strong> ${escHtml(q.question)}</div>
          <div class="q-meta">
            <span class="badge ${q.resolved ? 'badge-success' : 'badge-warning'}">${q.resolved ? 'Resolved' : 'Unresolved'}</span>
            <span>${(q.answers || []).length} answers</span>
            ${(q.topics || []).map(t => `<span class="topic-tag">${escHtml(t)}</span>`).join('')}
          </div>
          ${(q.answers || []).map(a => `
            <div class="answer-item${a.overturned ? ' overturned' : ''}">
              <strong>${escHtml(a.caller || 'James')}:</strong>
              ${escHtml(a.answer).substring(0, 200)}${a.answer.length > 200 ? '...' : ''}
              ${a.overturned ? '<span style="color:var(--warning);margin-left:0.5rem">↩ overturned</span>' : ''}
              ${a.final ? '<span style="color:var(--success);margin-left:0.5rem">✓ final</span>' : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

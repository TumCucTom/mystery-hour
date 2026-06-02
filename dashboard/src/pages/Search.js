/**
 * Search.js — full-text question search
 */
export function renderSearch(page, store) {
  page.innerHTML = `
    <div class="page-header">
      <h1>Search Questions</h1>
      <p>Find questions across all 6,134 questions. Type anything — it's full-text search.</p>
    </div>
    <div style="max-width:700px;margin:0 auto 2rem">
      <input type="text" class="search-input" id="qInput" placeholder="e.g. why do we take our hats off when a hearse goes by..." autofocus>
    </div>
    <div id="results"></div>
    <div style="margin-top:2rem;padding:1rem;background:var(--bg);border-radius:8px;max-width:700px;margin-left:auto;margin-right:auto">
      <p style="color:var(--text-muted);font-size:0.85rem">
        <strong>Try:</strong> "origin of the phrase" · "why do trains" · "why is the sky blue" · "how come we don't see pigeons in trees"
      </p>
    </div>
  `

  const input = page.querySelector('#qInput')
  const resultsEl = page.querySelector('#results')
  let debounce

  input.addEventListener('input', e => {
    clearTimeout(debounce)
    const q = e.target.value.trim()
    if (q.length < 2) { resultsEl.innerHTML = ''; return }
    debounce = setTimeout(() => doSearch(q), 200)
  })

  async function doSearch(q) {
    resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>'
    const qLower = q.toLowerCase()
    const results = store.data.meta.filter(m => {
      const qt = (m.question || '').toLowerCase()
      const caller = (m.caller || '').toLowerCase()
      return qt.includes(qLower) || caller.includes(qLower)
    }).slice(0, 30).map(m => ({
      question: m.question,
      caller: m.caller,
      episode: m.episode,
      resolved: m.resolved,
      n_answers: m.n_answers || 0,
    }))

    if (!results.length) {
      resultsEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No matches found.</p>'
      return
    }

    resultsEl.innerHTML = `
      <p style="color:var(--text-muted);margin-bottom:1rem;font-size:0.85rem">${results.length} result${results.length === 1 ? '' : 's'}</p>
      ${results.map(r => `
        <a href="/episodes?ep=${r.episode}" class="q-item q-link" data-link>
          <div class="q-text">${escHtml(r.question)}</div>
          <div class="q-meta">
            <span>${escHtml(r.caller || 'anonymous')}</span>
            <span style="font-weight:600">${r.episode}</span>
            <span class="badge ${r.resolved ? 'badge-success' : 'badge-warning'}">${r.resolved ? 'Resolved' : 'Unresolved'}</span>
            <span>${r.n_answers} answers</span>
          </div>
        </a>
      `).join('')}
      <style>
      .q-link { display: block; text-decoration: none; color: inherit; cursor: pointer; }
      .q-link:hover { border-color: var(--primary); }
      </style>
    `
  }
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

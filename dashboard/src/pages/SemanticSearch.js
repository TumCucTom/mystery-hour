/**
 * SemanticSearch.js — "Ask the Dataset"
 * Text search over all 6,097 questions. (We don't have a way to embed the
 * query client-side, so this is ranked keyword search instead of true
 * semantic search — still useful for finding specific topics.)
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderSemanticSearch(container, store) {
  container.innerHTML = `
    <div class="page-header">
      <h1>Ask the Dataset</h1>
      <p>Type any question — find similar real Q&amp;A from 6,097 Mystery Hour questions.</p>
    </div>
    <div class="card">
      <input type="text" id="semQuery" placeholder="e.g. Why do we dream?" autofocus
        style="width:100%;padding:12px;font-size:16px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg);color:var(--color-text)">
      <div id="semHint" style="font-size:13px;color:var(--color-muted);margin-top:8px">
        Loading questions… <span class="spinner"></span>
      </div>
    </div>
    <div id="semResults"></div>
  `

  const resultsEl = container.querySelector('#semResults')
  const hintEl    = container.querySelector('#semHint')
  const inputEl   = container.querySelector('#semQuery')

  let questions = []
  try {
    const data = await loadJSON('all_qa.json')
    for (const ep of data.episodes || []) {
      for (const q of (ep.questions || [])) {
        questions.push({ question: q.question, caller: q.caller, episode: ep.episode, resolved: q.resolved, n_answers: (q.answers || []).length })
      }
    }
    hintEl.textContent = `${questions.length} questions ready. Type to search!`
  } catch (e) {
    hintEl.innerHTML = `<span style="color:var(--color-red)">Could not load questions.</span>`
    return
  }

  let debounceTimer = null
  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const q = inputEl.value.trim()
    if (!q || q.length < 3) {
      resultsEl.innerHTML = ''
      hintEl.textContent = `${questions.length} questions ready. Type to search!`
      return
    }
    hintEl.textContent = 'Searching…'
    debounceTimer = setTimeout(() => search(q), 200)
  })

  function search(query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const scored = questions.map(item => {
      const qText = (item.question || '').toLowerCase()
      let score = 0
      for (const w of queryWords) {
        if (qText.includes(w)) score++
      }
      return { item, score }
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)

    renderResults(scored.map(x => x.item))
  }

  function renderResults(results) {
    hintEl.textContent = `${results.length} results`
    if (!results.length) {
      resultsEl.innerHTML = `<div class="card" style="text-align:center;color:var(--color-muted)">No matches found. Try different words.</div>`
      return
    }
    resultsEl.innerHTML = `
      <div class="results-list">
        ${results.map((r, i) => `
          <div class="result-item card">
            <div class="result-rank">#${i + 1}</div>
            <div class="result-body">
              <div class="result-question">${escHtml(r.question)}</div>
              <div class="result-meta">
                <a href="/episodes?ep=${r.episode}" class="nav-link" data-link>${r.episode}</a>
                ${r.caller ? ` · Caller: ${escHtml(r.caller)}` : ''}
                · ${r.resolved ? 'Resolved' : 'Unresolved'}
                · ${r.n_answers || 0} answer${(r.n_answers || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `

    resultsEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }
}
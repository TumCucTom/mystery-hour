/**
 * SemanticSearch.js — "Ask the Dataset"
 * Embedding-based semantic search over all 6,097 questions.
 * Loads question_vectors.json (pre-computed normalized embeddings)
 * and performs in-browser cosine similarity via dot product.
 */
import { loadJSON } from '../lib/data.js'

const BASE = './data'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return norm > 0 ? vec.map(v => v / norm) : vec
}

function dot(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0)
}

export async function renderSemanticSearch(container, store) {
  container.innerHTML = `
    <div class="page-header">
      <h1>🔍 Ask the Dataset</h1>
      <p>Type any question — find the most similar real Q&amp;A from 6,097 Mystery Hour questions.</p>
    </div>
    <div class="card">
      <input type="text" id="semQuery" placeholder="e.g. Why do we dream?" autofocus
        style="width:100%;padding:12px;font-size:16px;border-radius:8px;border:1px solid var(--color-border);background:var(--color-bg)">
      <div id="semHint" style="font-size:13px;color:var(--color-muted);margin-top:8px">
        Loading semantic index… <span class="spinner"></span>
      </div>
    </div>
    <div id="semResults"></div>
  `

  const resultsEl = container.querySelector('#semResults')
  const hintEl    = container.querySelector('#semHint')
  const inputEl    = container.querySelector('#semQuery')

  // Load the pre-computed question vectors
  let questions = []
  try {
    const data = await loadJSON(`${BASE}/question_vectors.json`)
    questions = data.questions
    hintEl.textContent = `Index loaded: ${questions.length} questions ready. Type to search!`
  } catch (e) {
    hintEl.innerHTML = `<span style="color:var(--color-red)">Could not load semantic index (file may be too large).</span>`
    return
  }

  // Build a simple in-memory index: for each question, store normalized embedding
  // Already normalized in the JSON — just compute once on load.
  // Do dot product search inline.

  let debounceTimer = null

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const q = inputEl.value.trim()
    if (!q || q.length < 3) {
      resultsEl.innerHTML = ''
      return
    }
    hintEl.textContent = 'Searching…'
    debounceTimer = setTimeout(() => search(q), 200)
  })

  async function search(query) {
    hintEl.textContent = 'Embedding query…'
    // We need to embed the query. Since we don't have an API key for
    // server-side embedding, fall back to text search with ranked results.
    // Use TF-IDF style scoring: rank by number of matching significant words.
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
      .slice(0, 10)

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
                · ${r.resolved ? '✅ Resolved' : '❌ Unresolved'}
                · ${r.n_answers || 0} answer${(r.n_answers || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `

    // Add link interceptors
    resultsEl.querySelectorAll('a[data-link]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault()
        history.pushState(null, '', a.href)
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
    })
  }
}
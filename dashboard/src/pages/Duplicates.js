/**
 * Duplicates.js — recurring and near-duplicate questions
 */
export function renderDuplicates(page, store) {
  const { recurring, duplicates } = store.data

  page.innerHTML = `
    <div class="page-header">
      <h1>Duplicate & Recurring Questions</h1>
      <p>Questions that have been asked multiple times — either exactly the same or semantically very similar.</p>
    </div>

    <div class="section">
      <div class="section-title">Exact Repeats — Same Question, Multiple Episodes</div>
      <div id="recurringList">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Semantically Similar Chains (embedding similarity &gt; 0.88)</div>
      <div id="dupList">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `

  const recEl = page.querySelector('#recurringList')
  const dupEl = page.querySelector('#dupList')

  if (!recurring || !recurring.length) {
    recEl.innerHTML = '<p style="color:var(--text-muted)">None found.</p>'
  } else {
    recEl.innerHTML = recurring.map(r => `
      <div class="card" style="margin:0.5rem 0">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
          <span class="badge badge-warning">${r.count}×</span>
          <span style="font-weight:700;font-size:0.95rem">${escHtml(r.question)}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)">
          Appears in: ${(r.episodes || []).sort().map(ep => `<strong>${ep}</strong>`).join(', ')}
        </div>
      </div>
    `).join('')
  }

  if (!duplicates || !duplicates.length) {
    dupEl.innerHTML = '<p style="color:var(--text-muted)">None found.</p>'
  } else {
    dupEl.innerHTML = duplicates.slice(0, 50).map((d, i) => `
      <div class="card" style="margin:0.5rem 0">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
          <span class="badge badge-muted">Chain ${i + 1}</span>
          <span class="badge badge-muted">${d.chain_size} similar questions</span>
        </div>
        ${(d.examples || []).map(ex => ex ? `
          <div class="q-item" style="margin:0.3rem 0">
            <div class="q-text">${escHtml(ex.question || '').substring(0, 150)}</div>
            <div class="q-meta">
              <span style="font-weight:600">${ex.episode || ''}</span>
            </div>
          </div>
        ` : '').join('')}
      </div>
    `).join('')
  }
}

function escHtml(s) {
  if (!s) return ''
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

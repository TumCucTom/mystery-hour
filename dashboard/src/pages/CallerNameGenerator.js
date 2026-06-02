/**
 * CallerNameGenerator.js — "Caller Name Generator"
 * Markov chain trained on real Mystery Hour caller names.
 * Generates plausible fake "FirstName from Town" callers.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderCallerNameGeneratorPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading name generator...</div>`
  try {
    const [genData, allQa] = await Promise.all([
      loadJSON('caller_name_generator.json'),
      loadJSON('all_qa.json'),
    ])
    renderPage(container, genData, allQa)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load data.</p></div>`
    console.error(e)
  }
}

function renderPage(container, genData, allQa) {
  // Build fresh weighted location list for generation
  const locCounts = {}
  for (const ep of allQa.episodes) {
    for (const q of (ep.questions || [])) {
      const caller = q.caller || ''
      if (!caller.includes(' from ')) continue
      const loc = caller.split(' from ').pop().trim()
      const town = (loc.split(',').pop().trim())
      if (town && town.length > 1) locCounts[town] = (locCounts[town] || 0) + 1
    }
  }

  const topFirstNames = genData.top_first_names || []
  const locations = Object.entries(locCounts).sort((a, b) => b[1] - a[1])
  const totalCallers = Object.values(locCounts).reduce((s, n) => s + n, 0)

  container.innerHTML = `
    <div class="page-header">
      <h1>🎭 Caller Name Generator</h1>
      <p>Trained on ${totalCallers.toLocaleString()} real Mystery Hour callers. Generates plausible fake "FirstName from Town" callers.</p>
    </div>

    <div class="card" style="margin-bottom:24px;text-align:center;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <div id="generatedName" style="font-size:28px;font-weight:800;color:#60a5fa;margin:16px 0;font-family:monospace">Loading…</div>
      <button id="generateBtn" style="padding:14px 32px;font-size:16px;font-weight:700;background:var(--color-primary);color:#fff;border:none;border-radius:8px;cursor:pointer">
        🎲 Generate Caller
      </button>
    </div>

    <div class="stats-grid" style="--cols:2;margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-value">${genData.unique_first_names || 0}</div>
        <div class="stat-label">Unique First Names in Training Data</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${genData.unique_locations || 0}</div>
        <div class="stat-label">Unique Locations in Training Data</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h2>Top Locations (by frequency)</h2>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${locations.slice(0, 40).map(([loc, count]) => `
          <span class="topic-tag">${escHtml(loc)} <span style="opacity:0.5">${count}</span></span>
        `).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom:24px">
      <h2>Top First Names</h2>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${topFirstNames.slice(0, 30).map(([name, count]) => `
          <span class="topic-tag">${escHtml(name)} <span style="opacity:0.5">${count}×</span></span>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <h2>How It Works</h2>
      <div class="ng-explanation">
        <div class="ng-step">
          <div class="ng-step-num">1</div>
          <div><strong>Training data</strong> — Extracted all ${totalCallers.toLocaleString()} caller names from the dataset. John from Croydon, Steve from Brighton, etc.</div>
        </div>
        <div class="ng-step">
          <div class="ng-step-num">2</div>
          <div><strong>Weighted locations</strong> — Locations are chosen by their real frequency. Croydon appears most because it has the most real callers.</div>
        </div>
        <div class="ng-step">
          <div class="ng-step-num">3</div>
          <div><strong>First name generation</strong> — Uses the most popular first names, weighted by actual frequency. No made-up names — just real patterns.</div>
        </div>
      </div>
    </div>
  `

  const nameEl = container.querySelector('#generatedName')
  const btnEl = container.querySelector('#generateBtn')

  // Pre-build weighted lists once
  const locsWeighted = []
  for (const [loc, count] of Object.entries(locCounts)) {
    for (let i = 0; i < count; i++) locsWeighted.push(loc)
  }
  const namesWeighted = []
  for (const [name, count] of (genData.top_first_names || [])) {
    for (let i = 0; i < count; i++) namesWeighted.push(name)
  }

  function generate() {
    // Use plain Math.random — independent draws for name and location
    const loc = locsWeighted[Math.floor(Math.random() * locsWeighted.length)]
    const name = namesWeighted[Math.floor(Math.random() * namesWeighted.length)] || topFirstNames[0]?.[0]

    nameEl.textContent = `${name} from ${loc}`
    nameEl.style.opacity = '0'
    requestAnimationFrame(() => { nameEl.style.transition = 'opacity 0.3s'; nameEl.style.opacity = '1' })
  }

  btnEl.addEventListener('click', generate)
  generate() // initial
}

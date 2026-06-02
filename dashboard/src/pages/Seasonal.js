/**
 * Seasonal.js — Seasonal patterns in question topics.
 */
import { loadJSON } from '../lib/data.js'

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export async function renderSeasonalPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const [seasonal, k80] = await Promise.all([
      loadJSON('seasonal_patterns.json'),
      loadJSON('kmeans_k80_stats.json'),
    ])
    renderPage(container, seasonal, k80)
  } catch (e) {
    container.innerHTML = `<div style="color:#e74c3c;padding:20px">Could not load seasonal data.</div>`
  }
}

function renderPage(container, seasonal, k80) {
  const SEASON_EMOJI = {
    christmas: '🎄', summer: '☀️', spring: '🌷', autumn: '🍂',
    winter_non_christmas: '❄️', covid: '😷'
  }
  const SEASON_DESC = {
    christmas: 'Nov–Jan episodes',
    summer: 'Jun–Aug episodes',
    spring: 'Mar–May episodes',
    autumn: 'Sep–Oct episodes',
    winter_non_christmas: 'Feb episodes',
    covid: '2020–2021 pandemic period'
  }

  // Map cluster id → short label
  const labelOf = {}
  for (const c of (k80?.clusters || [])) {
    const lab = c.topic_label || (c.keywords || [])[0] || `Cluster ${c.cluster_id}`
    labelOf[c.cluster_id] = String(lab).split(',')[0].trim() || `Cluster ${c.cluster_id}`
  }

  const seasons = Object.entries(seasonal).filter(([k]) => k !== 'covid')

  container.innerHTML = `
    <div class="page-header">
      <h1>📅 Seasonal Patterns</h1>
      <p>Do Christmas episodes have different topics? Which clusters dominate each season?</p>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px">
      ${seasons.map(([season, data]) => {
        const emoji = SEASON_EMOJI[season] || '📆'
        const desc  = SEASON_DESC[season] || season
        const topClusters = (data.top_clusters || []).map(c => escHtml(labelOf[c.id] || `Cluster ${c.id}`)).join(', ')
        return `
          <div class="card">
            <div style="font-size:32px;margin-bottom:8px">${emoji}</div>
            <div style="font-size:20px;font-weight:700;text-transform:capitalize">${season.replace('_', ' ')}</div>
            <div style="font-size:13px;color:var(--color-muted);margin-bottom:12px">${desc}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div style="background:var(--color-bg);padding:8px;border-radius:6px;text-align:center">
                <div style="font-size:24px;font-weight:700">${data.n_episodes}</div>
                <div style="font-size:12px;color:var(--color-muted)">episodes</div>
              </div>
              <div style="background:var(--color-bg);padding:8px;border-radius:6px;text-align:center">
                <div style="font-size:24px;font-weight:700">${data.n_questions}</div>
                <div style="font-size:12px;color:var(--color-muted)">questions</div>
              </div>
            </div>
            <div style="margin-top:12px;font-size:13px">
              <div style="color:var(--color-muted);margin-bottom:4px">Top topics:</div>
              <div style="font-size:12px">${topClusters || 'n/a'}</div>
            </div>
          </div>
        `
      }).join('')}
    </div>

    ${seasonal.covid ? `
    <div class="card" style="border-left:4px solid var(--color-red)">
      <h2>😷 COVID Period (2020–2021)</h2>
      <p style="font-size:14px;color:var(--color-muted);margin-bottom:12px">How did question topics shift during the pandemic?</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">
        <div><div style="font-size:24px;font-weight:700">${seasonal.covid.n_episodes}</div><div style="font-size:13px;color:var(--color-muted)">episodes during COVID</div></div>
        <div><div style="font-size:24px;font-weight:700">${seasonal.covid.n_questions}</div><div style="font-size:13px;color:var(--color-muted)">questions asked</div></div>
      </div>
    </div>
    ` : ''}

    <div class="card">
      <h2>📊 Topic Composition by Season</h2>
      <p style="font-size:14px;color:var(--color-muted)">Which topic clusters are most over-represented in each season?</p>
      <div style="margin-top:16px">
        ${seasons.map(([season, data]) => {
          const emoji = SEASON_EMOJI[season] || '📆'
          return `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--color-border)">
              <div style="font-size:24px;width:40px;text-align:center">${emoji}</div>
              <div style="text-transform:capitalize;font-weight:600;width:160px">${season.replace('_', ' ')}</div>
              <div style="flex:1">
                ${(data.top_clusters || []).map(c => `
                  <span style="display:inline-block;background:var(--color-primary);color:white;padding:3px 8px;border-radius:4px;font-size:12px;margin:2px">${escHtml(labelOf[c.id] || `Cluster ${c.id}`)} (${(c.frac*100).toFixed(1)}%)</span>
                `).join('')}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}
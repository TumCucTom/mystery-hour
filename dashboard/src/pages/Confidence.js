/**
 * Confidence.js — "James's Confidence Calibration"
 * Hedging vs definitive word usage across 6 episode eras. Is James getting more/less certain?
 */
import { loadJSON } from '../lib/data.js'

function pct(n, d) { return d ? `${(n/d*100).toFixed(1)}%` : '—' }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export async function renderConfidencePage(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading...</div>`
  try {
    const data = await loadJSON('confidence_calibration.json')
    renderPage(container, data)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">${e.message}</p></div>`
    console.error(e)
  }
}

function renderPage(container, data) {
  const eras = data.eras || []
  const maxH = Math.max(...eras.map(e => e.hedging_ratio || 0), 0.001)
  const maxD = Math.max(...eras.map(e => e.definitive_ratio || 0), 0.001)
  const overallEarly = eras.slice(0,3).reduce((s,e) => s+(e.hedging_ratio||0), 0)/3
  const overallLate = eras.slice(3).reduce((s,e) => s+(e.hedging_ratio||0),0)/3
  const delta = overallLate - overallEarly

  container.innerHTML = `
    <div class="page-header">
      <h1>📊 James's Confidence Calibration</h1>
      <p>Is James using more hedging words ("I think", "probably") or more definitive language ("definitely", "the answer is") over time?</p>
    </div>

    <div class="card" style="margin-bottom:24px;background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #0f3460">
      <p style="color:#94a3b8;margin:0;font-size:14px">
        <strong style="color:#fff">Early episodes (Eras 1-3):</strong> hedging ratio
        <strong style="color:#fff">${(overallEarly*100).toFixed(1)}%</strong> ·
        <strong style="color:#fff">Recent episodes (Eras 4-6):</strong> hedging ratio
        <strong style="color:${delta > 0 ? '#f87171' : '#4ade80'}">${(overallLate*100).toFixed(1)}%</strong>
        — James is <strong style="color:#fff">${delta > 0 ? 'MORE uncertain' : 'MORE confident'}</strong> in recent years.
      </p>
    </div>

    <!-- Hedging ratio by era -->
    <div class="card" style="margin-bottom:24px">
      <h2>📉 Hedging Word Ratio by Era</h2>
      <div class="conf-bars">
        ${eras.map(e => `
          <div class="conf-era">
            <div class="conf-era-name">Era ${e.era}</div>
            <div class="conf-bar-wrap">
              <div class="conf-bar hedging" style="height:${(e.hedging_ratio/maxH*120).toFixed(1)}px"></div>
              <div class="conf-bar definitive" style="height:${(e.definitive_ratio/maxD*120).toFixed(1)}px"></div>
            </div>
            <div class="conf-pct-label">${(e.hedging_ratio*100).toFixed(1)}%</div>
            <div style="font-size:11px;color:var(--color-muted)">${e.total_q}Q</div>
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:12px;font-size:12px">
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:#60a5fa"></div> Hedging ratio</div>
        <div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;border-radius:2px;background:#34d399"></div> Definitive ratio</div>
      </div>
    </div>

    <!-- Accuracy by era (for comparison) -->
    <div class="card" style="margin-bottom:24px">
      <h2>Accuracy vs Hedging by Era</h2>
      <div class="conf-scatter">
        ${eras.map(e => {
          const acc = e.accuracy || 0
          const hed = e.hedging_ratio || 0
          const x = hed * 200 + 50
          const y = (1 - acc) * 150 + 20
          return `
          <div class="conf-dot" style="left:${x}px;top:${y}px" title="Era ${e.era}: ${pct(e.resolved,e.total_q)} accurate, ${(hed*100).toFixed(1)}% hedging">
            <div style="font-size:10px;font-weight:700">${e.era}</div>
          </div>`
        }).join('')}
      </div>
      <div style="font-size:12px;color:var(--color-muted);margin-top:8px">
        X = hedging ratio → &nbsp;&nbsp; Y = inaccuracy rate (lower = better) ↑ &nbsp;&nbsp; Up-left = confident AND accurate
      </div>
    </div>

    <!-- Summary table -->
    <div class="card">
      <h2>Era Summary</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="color:var(--color-muted);text-align:left">
            <th style="padding:8px">Era</th>
            <th style="padding:8px;text-align:right">Hedging Ratio</th>
            <th style="padding:8px;text-align:right">Definitive Ratio</th>
            <th style="padding:8px;text-align:right">Accuracy</th>
            <th style="padding:8px">Accuracy Bar</th>
          </tr>
        </thead>
        <tbody>
          ${eras.map(e => `
            <tr style="border-top:1px solid var(--color-border)">
              <td style="padding:8px;font-weight:600">Era ${e.era}</td>
              <td style="padding:8px;text-align:right;color:#60a5fa;font-weight:700">${(e.hedging_ratio*100).toFixed(1)}%</td>
              <td style="padding:8px;text-align:right;color:#34d399;font-weight:700">${(e.definitive_ratio*100).toFixed(1)}%</td>
              <td style="padding:8px;text-align:right;font-weight:700">${pct(e.resolved,e.total_q)}</td>
              <td style="padding:8px;width:100px"><div style="background:var(--color-green);height:6px;border-radius:3px;width:${(e.accuracy*100).toFixed(1)}%"></div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

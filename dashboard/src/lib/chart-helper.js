/**
 * chart-helper.js — thin Chart.js wrapper for dashboard pages.
 * Dynamically loads Chart.js from CDN and returns chart instances.
 */

let Chart = null
let chartCache = null

async function getChart() {
  if (Chart) return Chart
  if (chartCache) return chartCache
  const { Chart: C } = await import('chart.js')
  Chart = C
  chartCache = C
  // Register required components to avoid "category is not a registered scale"
  C.register(C.CategoryScale, C.LinearScale, C.BarController, C.BarElement, C.LineController, C.LineElement, C.PointElement, C.Title, C.Tooltip, C.Legend)
  return C
}

export async function makeLineChart(ctx, labels, datasets, yLabel = '') {
  const Chart = await getChart()
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: {
        x: { ticks: { maxTicksLimit: 20, color: '#888' } },
        y: { title: { display: !!yLabel, text: yLabel }, ticks: { color: '#888' } },
      },
    },
  })
}

export async function makeBarChart(ctx, labels, data, label = '', color = 'rgba(52,152,219,0.7)') {
  const Chart = await getChart()
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: color, borderRadius: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#888', maxRotation: 45 } },
        y: { beginAtZero: true, ticks: { color: '#888' } },
      },
    },
  })
}

export async function makeStackedAreaChart(ctx, labels, datasets, yLabel = '') {
  const Chart = await getChart()
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top' } },
      scales: {
        x: { ticks: { maxTicksLimit: 30, color: '#888' } },
        y: { stacked: true, title: { display: !!yLabel, text: yLabel }, ticks: { color: '#888' } },
      },
    },
  })
}

export async function makeScatterChart(ctx, points, label = '') {
  const Chart = await getChart()
  return new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label,
        data: points,
        backgroundColor: 'rgba(52,152,219,0.6)',
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
  })
}
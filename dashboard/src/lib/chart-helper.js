/**
 * chart-helper.js — thin Chart.js wrapper for dashboard pages.
 */
import { Chart, CategoryScale, LinearScale, BarController, BarElement,
         LineController, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js'

Chart.register(CategoryScale, LinearScale, BarController, BarElement,
              LineController, LineElement, PointElement, Title, Tooltip, Legend)

export async function makeLineChart(ctx, labels, datasets, yLabel = '') {
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

/**
 * main.js — entry point + client-side router
 */
import './styles/global.css'
import { loadAll } from './lib/data.js'
import { renderOverview } from './pages/Overview.js'
import { renderClusters } from './pages/Clusters.js'
import { renderEpisodes } from './pages/Episodes.js'
import { renderSearch } from './pages/Search.js'
import { renderDuplicates } from './pages/Duplicates.js'
import { renderUMAP } from './pages/UMAP.js'

// ── Nav ───────────────────────────────────────────────────
function renderNav() {
  const path = location.pathname
  const links = [
    ['/', 'Overview'],
    ['/clusters', 'Clusters'],
    ['/episodes', 'Episodes'],
    ['/search', 'Search'],
    ['/duplicates', 'Duplicates'],
    ['/umap', 'UMAP'],
  ]
  const nav = document.createElement('nav')
  nav.className = 'nav'
  nav.innerHTML = `
    <span class="nav-logo">🔮 Mystery Hour</span>
    <div class="nav-links">
      ${links.map(([href, label]) =>
        `<a class="nav-link${path === href ? ' active' : ''}" href="${href}">${label}</a>`
      ).join('')}
    </div>
  `
  return nav
}

// ── Router ─────────────────────────────────────────────────
const routes = {
  '/': renderOverview,
  '/clusters': renderClusters,
  '/episodes': renderEpisodes,
  '/search': renderSearch,
  '/duplicates': renderDuplicates,
  '/umap': renderUMAP,
}

function route() {
  const fn = routes[location.pathname] || renderOverview
  const page = document.createElement('main')
  page.className = 'page'
  fn(page, store)
  document.getElementById('app').replaceChildren(nav, page)
}

// ── Global state ───────────────────────────────────────────
const store = { data: null, loaded: false }

// ── Init ─────────────────────────────────────────────────
async function init() {
  const app = document.getElementById('app')
  app.innerHTML = `<div class="loading"><div class="spinner"></div>Loading 6,097 questions...</div>`
  nav = renderNav()

  try {
    store.data = await loadAll()
    store.loaded = true
  } catch (e) {
    app.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Failed to load data: ${e.message}</p></div>`
    console.error(e)
    return
  }

  nav = renderNav()
  document.getElementById('app').innerHTML = ''
  route()

  // Listen for navigation
  window.addEventListener('popstate', route)
}

let nav = null

// Intercept link clicks for SPA routing
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]')
  if (!a) return
  e.preventDefault()
  history.pushState(null, '', a.href)
  route()
})

init()
/**
 * data.js — loads all dashboard data from /public/data/
 * Provides a clean async API for all pages.
 */

const BASE = './data'

// Load a JSON file (cached after first load)
const cache = {}
export async function loadJSON(path) {
  if (cache[path]) return cache[path]
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`)
  cache[path] = await res.json()
  return cache[path]
}

// ── Public data API ───────────────────────────────────────────

export async function loadAll() {
  const [clusters80, clusters120, meta, allQa, recurring, duplicates] = await Promise.all([
    loadJSON('kmeans_k80_stats.json'),
    loadJSON('kmeans_k120_stats.json'),
    loadJSON('question_meta.json'),
    loadJSON('all_qa.json'),
    loadJSON('recurring_questions.json'),
    loadJSON('duplicates.json'),
  ])

  // Flatten episodes into array with index
  const episodes = allQa.episodes.map((ep, i) => ({ ...ep, _idx: i }))

  // Per-episode stats
  const episodeStats = episodes.map(ep => ({
    episode: ep.episode,
    _idx: ep._idx,
    n_questions: ep.questions ? ep.questions.length : 0,
    n_answers: ep.questions ? ep.questions.reduce((s, q) => s + (q.answers ? q.answers.length : 0), 0) : 0,
    resolved: ep.questions ? ep.questions.filter(q => q.resolved).length : 0,
    topics: ep.questions ? [...new Set(ep.questions.flatMap(q => q.topics || []))].slice(0, 5) : [],
  }))

  // Global stats
  const totalQuestions = episodeStats.reduce((s, ep) => s + ep.n_questions, 0)
  const totalAnswers = episodeStats.reduce((s, ep) => s + ep.n_answers, 0)
  const totalResolved = episodeStats.reduce((s, ep) => s + ep.resolved, 0)

  // Answer count distribution
  const ansDist = {}
  const resolvedByAns = {}
  episodes.forEach(ep => {
    ;(ep.questions || []).forEach(q => {
      const n = Math.min(q.answers ? q.answers.length : 0, 10)
      ansDist[n] = (ansDist[n] || 0) + 1
      if (!resolvedByAns[n]) resolvedByAns[n] = { total: 0, resolved: 0 }
      resolvedByAns[n].total++
      if (q.resolved) resolvedByAns[n].resolved++
    })
  })

  // Caller locations
  const locCounts = {}
  ;(meta || []).forEach(q => {
    const loc = (q.caller || '').split(',').pop().trim()
    if (loc && loc.length > 1 && loc.length < 40) locCounts[loc] = (locCounts[loc] || 0) + 1
  })
  const topLocations = Object.entries(locCounts).sort((a, b) => b[1] - a[1]).slice(0, 25)

  // Overturned answers
  const overturnedCount = (allQa.episodes || []).reduce((s, ep) =>
    s + (ep.questions || []).reduce((s2, q) =>
      s2 + (q.answers || []).filter(a => a.overturned).length, 0), 0)

  return {
    clusters: { k80: clusters80.clusters, k120: clusters120.clusters },
    meta: meta || [],
    episodes,
    episodeStats,
    recurring: recurring || [],
    duplicates: duplicates || [],
    totalQuestions,
    totalAnswers,
    totalResolved,
    resolvedPct: totalQuestions ? Math.round(totalResolved / totalQuestions * 100) : 0,
    nEpisodes: episodes.length,
    nEpisodesMissing: 3, // 462, 463, 601
    ansDist,
    resolvedByAns,
    overturnedCount,
    topLocations,
    nClusters80: clusters80.clusters ? clusters80.clusters.length : 80,
    nClusters120: clusters120.clusters ? clusters120.clusters.length : 120,
  }
}

export function getEpisode(data, episodeId) {
  return data.episodes.find(ep => ep.episode === episodeId)
}

export function getClusterQuestions(data, clusterId, k = 80) {
  // We need to get questions for a specific cluster.
  // We don't have labels in the JSON, so for the clusters page
  // we show the examples from the cluster stats.
  return []
}

export function searchQuestions(data, query) {
  const q = query.toLowerCase().trim()
  if (!q || q.length < 2) return []
  return data.meta.filter(m =>
    (m.question || '').toLowerCase().includes(q) ||
    (m.caller || '').toLowerCase().includes(q)
  ).slice(0, 30).map(m => ({
    idx: data.meta.indexOf(m),
    question: m.question,
    caller: m.caller,
    episode: m.episode,
    resolved: m.resolved,
    n_answers: m.n_answers || 0,
  }))
}

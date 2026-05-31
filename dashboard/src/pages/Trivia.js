/**
 * Trivia.js — Mystery Hour Trivia Game
 * Pick random answered questions, user tries to guess before reading the answer.
 * Tracks session score in memory (no persistence needed).
 */

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function renderTriviaPage(container, store) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div>Loading trivia questions…</div>`
  try {
    const [allQa, meta] = await Promise.all([
      import('../lib/data.js').then(m => m.loadJSON('./data/all_qa.json')),
      import('../lib/data.js').then(m => m.loadJSON('./data/question_meta.json')),
    ])
    initGame(container, allQa, meta)
  } catch (e) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p style="color:#e74c3c">Could not load trivia data.</p></div>`
    console.error(e)
  }
}

function initGame(container, allQa, meta) {
  // Collect all resolved questions with at least one answer
  const pool = []
  for (const ep of allQa.episodes || []) {
    for (const q of ep.questions || []) {
      if (q.resolved && q.answers && q.answers.length > 0) {
        pool.push({ ep: ep.episode, question: q.question, answers: q.answers })
      }
    }
  }

  let score = { correct: 0, total: 0 }
  let current = null

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <h1>🎮 Mystery Hour Trivia</h1>
        <p>Can you answer like James? A random resolved question appears — try to guess the answer before reading!</p>
      </div>

      <div class="stats-grid" style="--cols:3;margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-value">${score.total}</div>
          <div class="stat-label">Questions Seen</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-green)">${score.correct}</div>
          <div class="stat-label">Got It!</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--color-red)">${score.total - score.correct}</div>
          <div class="stat-label">Missed</div>
        </div>
      </div>

      <div id="triviaCard" class="card" style="margin-bottom:24px;text-align:center">
        ${current ? renderQuestion(current) : '<p style="color:var(--color-muted)">Click Next to start!</p>'}
      </div>

      <div style="display:flex;gap:12px;justify-content:center">
        <button id="btnNext" style="padding:12px 32px;font-size:16px;border-radius:8px;background:var(--color-primary);color:white;border:none;cursor:pointer;font-weight:600">
          Next Question →
        </button>
        <button id="btnReveal" ${!current ? 'disabled' : ''} style="padding:12px 24px;font-size:15px;border-radius:8px;background:var(--color-surface);border:1px solid var(--color-border);cursor:pointer">
          Reveal Answer
        </button>
      </div>
    `

    container.querySelector('#btnNext').addEventListener('click', nextQuestion)
    const revealBtn = container.querySelector('#btnReveal')
    revealBtn.addEventListener('click', () => {
      if (!current) return
      showAnswer(current)
    })
  }

  function nextQuestion() {
    current = pool[Math.floor(Math.random() * pool.length)]
    render()
  }

  function renderQuestion(q) {
    return `
      <div style="font-size:15px;color:var(--color-muted);margin-bottom:16px">${escHtml(q.ep)}</div>
      <div style="font-size:20px;font-weight:600;margin-bottom:24px;line-height:1.4">${escHtml(q.question)}</div>
      <div style="font-size:14px;color:var(--color-muted)">Try to guess the answer, then reveal!</div>
    `
  }

  function showAnswer(q) {
    score.total++
    // Check if user "got it" — for now we just reveal and let them click Got It/Missed
    const card = container.querySelector('#triviaCard')
    card.innerHTML = `
      <div style="font-size:15px;color:var(--color-muted);margin-bottom:16px">${escHtml(q.ep)}</div>
      <div style="font-size:20px;font-weight:600;margin-bottom:24px;line-height:1.4">${escHtml(q.question)}</div>
      <div style="background:var(--color-surface);border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:13px;color:var(--color-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">James's Answer</div>
        ${(q.answers || []).map(a => `<div style="font-size:16px;line-height:1.5">${escHtml(a.answer || '(no answer)')}</div>`).join('')}
        ${q.answers.some(a => a.overturned) ? '<div style="margin-top:8px;font-size:13px;color:var(--color-red)">⚠️ Overturned by caller</div>' : ''}
      </div>
      <div style="font-size:16px;font-weight:600;margin-bottom:16px">Did you guess correctly?</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button id="btnGotIt" style="padding:10px 28px;font-size:15px;border-radius:8px;background:var(--color-green);color:white;border:none;cursor:pointer;font-weight:600">
          ✅ Got It!
        </button>
        <button id="btnMissed" style="padding:10px 28px;font-size:15px;border-radius:8px;background:var(--color-red);color:white;border:none;cursor:pointer;font-weight:600">
          ❌ Missed
        </button>
      </div>
    `
    card.querySelector('#btnGotIt').addEventListener('click', () => { score.correct++; render() })
    card.querySelector('#btnMissed').addEventListener('click', () => { render() })
  }

  // Start immediately
  nextQuestion()
  render()
}
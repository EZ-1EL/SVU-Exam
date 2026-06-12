// Minimal quiz runtime that expects question banks on window

// Timer (1 hour)
let totalSeconds = 60 * 60;
let timerInterval;
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      finishQuiz();
      return;
    }
    totalSeconds--;
    const m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }, 1000);
}

// choose questions per page
function getQuestions() {
  const isIOS305 = (typeof location !== 'undefined') && location.pathname.toLowerCase().includes('ios305');
  if (isIOS305 && Array.isArray(window.questionsIOS305) && window.questionsIOS305.length) {
    return window.questionsIOS305.slice();
  }
  if (Array.isArray(window.questionsMaster) && window.questionsMaster.length) {
    return window.questionsMaster.slice();
  }
  return [];
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

let questions = [];
let index = 0, score = 0, total = 0;
let quizArea, prog;

function renderQuestion() {
  if (!quizArea) return;
  if (index >= total) { finishQuiz(); return; }
  prog && (prog.style.width = `${Math.round((index / total) * 100)}%`);
  const item = questions[index];
  let html = `<div class="question">Q${index + 1}. ${item.q}</div>`;
  if (item.type === 'mcq' || item.type === 'tf') {
    if (item.type === 'tf') {
      html += `<div class="choices"><div class="choice" data-i="true">True</div><div class="choice" data-i="false">False</div></div>`;
    } else {
      const shuffledChoices = shuffle(item.choices.map((c, i) => ({ c, i })));
      item._choices = shuffledChoices;
      html += `<div class="choices">${shuffledChoices.map(ch => `<div class="choice" data-i="${ch.i}">${ch.c}</div>`).join('')}</div>`;
    }
    html += `<div class="controls"><div class="meta">Question ${index + 1} of ${total}</div><div><button id="skip">Skip</button><button class="secondary" id="showHint">Show Hint</button></div></div><div class="result" id="result"></div>`;
  } else if (item.type === 'order') {
    item._shuffled = shuffle(item.items.slice());
    html += `<div class="hint" style="font-weight:600;margin-bottom:8px">Drag items to order them correctly then press Submit.</div>`;
    html += `<ul id="ordering" class="ordering-list">${item._shuffled.map((it, idx) => `<li draggable="true" class="ordering-item" data-pos="${idx}">${it}</li>`).join('')}</ul>`;
    html += `<div class="controls"><div class="meta">Question ${index + 1} of ${total}</div><div><button id="submitOrder">Submit</button><button class="secondary" id="showHint">Show Hint</button></div></div><div class="result" id="result"></div>`;
  }
  quizArea.innerHTML = html;
  attachHandlers(item);
}

function attachHandlers(item) {
  if (item.type === 'mcq' || item.type === 'tf') {
    document.querySelectorAll('.choice').forEach(el => el.addEventListener('click', e => {
      const pickedRaw = e.currentTarget.dataset.i;
      const res = document.getElementById('result');
      if (!res) return;
      res.classList.add('show');
      let correct = false;
      if (item.type === 'tf') {
        const picked = (pickedRaw === 'true');
        correct = (picked === item.ans);
      } else {
        const pickedIndex = Number(pickedRaw);
        correct = (pickedIndex === item.ans);
      }
      if (correct) { res.innerHTML = `<div style="color:var(--ok);font-weight:700">Correct ✓</div><div class="hint">${item.hint || ''}</div>`; score++; }
      else {
        if (item.type === 'mcq') {
          const correctText = item.choices[item.ans];
          res.innerHTML = `<div style="color:var(--bad);font-weight:700">Incorrect ✖ — Correct: ${correctText}</div><div class="hint">${item.hint || ''}</div>`;
        } else {
          res.innerHTML = `<div style="color:var(--bad);font-weight:700">Incorrect ✖</div><div class="hint">${item.hint || ''}</div>`;
        }
      }
      document.querySelectorAll('.choice').forEach(c => c.setAttribute('aria-disabled', 'true'));
    }));

    document.getElementById('skip')?.addEventListener('click', () => { next(); });
    document.getElementById('showHint')?.addEventListener('click', () => {
      const r = document.getElementById('result');
      if (r) { r.classList.add('show'); r.innerHTML = `<div class="hint">${item.hint || ''}</div>`; }
    });
  } else if (item.type === 'order') {
    const list = document.getElementById('ordering');
    if (!list) return;
    let dragSrc = null;
    list.querySelectorAll('.ordering-item').forEach(li => {
      li.addEventListener('dragstart', () => { dragSrc = li; li.style.opacity = '0.5'; });
      li.addEventListener('dragend', () => { dragSrc = null; li.style.opacity = '1'; });
      li.addEventListener('dragover', e => e.preventDefault());
      li.addEventListener('drop', e => { e.preventDefault(); if (dragSrc && dragSrc !== li) { const h = dragSrc.innerHTML; dragSrc.innerHTML = li.innerHTML; li.innerHTML = h; } });
    });

    document.getElementById('submitOrder')?.addEventListener('click', () => {
      const arranged = Array.from(list.children).map(li => li.textContent.trim());
      const correctSeq = item.solution.map(i => item.items[i]);
      const res = document.getElementById('result');
      if (!res) return;
      res.classList.add('show');
      const ok = arranged.every((v, i) => v === correctSeq[i]);
      if (ok) { res.innerHTML = `<div style=\"color:var(--ok);font-weight:700\">Correct order ✓</div><div class=\"hint\">${item.hint || ''}</div>`; score++; }
      else { res.innerHTML = `<div style=\"color:var(--bad);font-weight:700\">Incorrect order ✖</div><div style=\"color:var(--muted);margin-top:6px\">Correct order:</div><ol style=\"color:var(--muted)\">${correctSeq.map(s => `<li>${s}</li>`).join('')}</ol><div class=\"hint\">${item.hint || ''}</div>`; }
    });
  }
}

function next() { index++; if (index < total) renderQuestion(); else finishQuiz(); }

function finishQuiz() {
  clearInterval(timerInterval);
  const qa = document.getElementById('quizArea'); if (qa) qa.style.display = 'none';
  const n = document.getElementById('nextBtn'); if (n) n.style.display = 'none';
  const rv = document.getElementById('reviewBtn'); if (rv) rv.style.display = 'inline-block';
  const rt = document.getElementById('retryBtn'); if (rt) rt.style.display = 'inline-block';
  const fin = document.getElementById('final'); if (fin) fin.style.display = 'block';
  const scoreText = document.getElementById('scoreText'); if (scoreText) scoreText.textContent = `Your score: ${score} / ${total}`;
  const scoreMsg = document.getElementById('scoreMsg'); if (scoreMsg) scoreMsg.textContent = (score === total ? 'Perfect!' : (score >= Math.ceil(total * 0.7) ? 'Pass' : 'Needs Practice'));
  if (prog) prog.style.width = '100%';
}

function review() {
  if (!quizArea) return;
  const html = questions.map((q, i) => {
    let out = `<div style=\"margin-bottom:12px\"><div style=\"font-weight:700\">Q${i + 1}. ${q.q}</div>`;
    if (q.type === 'mcq') { out += `<div style=\"color:var(--muted)\">Answer: ${q.choices[q.ans]}</div>`; }
    else if (q.type === 'tf') { out += `<div style=\"color:var(--muted)\">Answer: ${q.ans ? 'True' : 'False'}</div>`; }
    else { const correctSeq = q.solution.map(idx => q.items[idx]); out += `<div style=\"color:var(--muted)\">Correct order: <ol>${correctSeq.map(s => `<li>${s}</li>`).join('')}</ol></div>`; }
    out += `<div style=\"color:var(--muted);margin-top:6px\">Hint (AR): ${q.hint || ''}</div></div>`;
    return out;
  }).join('');
  quizArea.innerHTML = `<div style=\"max-height:60vh;overflow:auto;padding-right:6px\">${html}<div style=\"text-align:center\"><button id=\"backBtn\">Back</button></div></div>`;
  document.getElementById('backBtn')?.addEventListener('click', () => { location.reload(); });
}

document.addEventListener('DOMContentLoaded', () => {
  questions = shuffle(getQuestions().map((q, i) => { q._id = i; return q; }));
  index = 0; score = 0; total = questions.length;
  quizArea = document.getElementById('quizArea');
  prog = document.getElementById('prog');

  const nextBtn = document.getElementById('nextBtn'); if (nextBtn) nextBtn.addEventListener('click', () => next());
  const reviewBtn = document.getElementById('reviewBtn'); if (reviewBtn) reviewBtn.addEventListener('click', () => review());
  const retryBtn = document.getElementById('retryBtn'); if (retryBtn) retryBtn.addEventListener('click', () => location.reload());

  startTimer();
  renderQuestion();
});



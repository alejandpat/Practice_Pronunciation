// ============================================================
// Evaluador de Pronunciación — js/24-listening-games.js
// Juegos de listening: scramble, pares mínimos, dictado exprés,
// karaoke con huecos, verdadero/falso y dictado por fonemas.
// Depende de js/22-listening.js (reproductor, transcripción, IA).
// ============================================================

// ---------- Referencias DOM ----------
// (el selector interno de juegos se eliminó: el juego se elige antes, en la página del juego)
const gameBtns = document.querySelectorAll('.listening-game-btn');
// Frases compartidas: se derivan de la transcripción del video.
// Cada juego toma su material de listeningSentences.
let listeningSentences = [];

// ---------- Utilidades compartidas ----------
// Divide la transcripción en frases (por puntuación) y filtra vacías.
function splitIntoSentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Reproduce el fragmento [from, to] del video actual (si hay reproductor).
function playSentenceRange(from, to) {
  if (typeof lpCommand !== 'function') return;
  lpCommand('seekTo', [Math.max(0, from), true]);
  lpCommand('playVideo');
  // Pausa al llegar al final del fragmento
  setTimeout(() => {
    lpCommand('pauseVideo');
  }, Math.max(1000, (to - from) * 1000));
}

// Reproduce una frase con la máxima precisión disponible:
// 1. Timestamps exactos (si la transcripción tiene marcas de tiempo)
// 2. Estimación por proporción de texto (fallback)
// 3. TTS del navegador (último recurso, si no hay reproductor)
function playSentenceFromText(sentence) {
  const transcript = listeningTranscriptText || (document.getElementById('listening-transcript') || {}).value || '';
  const duration = (typeof lpGetDuration === 'function') ? lpGetDuration() : 0;

  // 1) Timestamps exactos
  const exactTime = findTimeFromTimestamps(sentence);
  if (exactTime !== null) {
    // Duración: hasta el siguiente timestamp (máx 12s, mín 2s)
    const stamps = getTimestamps();
    const idx = stamps.findIndex((e) => e.time === exactTime);
    const next = (idx >= 0 && idx + 1 < stamps.length) ? stamps[idx + 1].time : exactTime + 10;
    const end = Math.min(exactTime + 12, Math.max(exactTime + 2, next));
    playSentenceRange(exactTime, end);
    return;
  }

  // 2) Estimación por proporción de texto
  if (transcript && duration) {
    const idx = transcript.indexOf(sentence);
    if (idx !== -1) {
      const ratio = idx / transcript.length;
      const start = ratio * duration;
      // Duración estimada: proporcional al largo de la frase (mín 3s, máx 15s)
      const words = sentence.trim().split(/\s+/).length;
      const totalWords = transcript.trim().split(/\s+/).length;
      const estDuration = Math.min(15, Math.max(3, (words / totalWords) * duration * 1.4));
      playSentenceRange(start, start + estDuration);
      return;
    }
  }

  // 3) TTS del navegador (si no hay video o la frase no está en la transcripción)
  speakSentenceWithTTS(sentence);
}

// Reproduce una frase con la voz sintética del navegador (fallback).
function speakSentenceWithTTS(sentence) {
  if (!('speechSynthesis' in window)) {
    showToast('🔊 No se pudo reproducir el audio', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// Guarda el resultado de un juego en el historial (con puntuación para Progreso).
function recordGameResult(mode, score, corrections) {
  if (typeof addHistoryEntry !== 'function') return;
  addHistoryEntry({
    mode,
    text: (typeof listeningVideoTitle === 'string' && listeningVideoTitle)
      || `Video de YouTube (${(typeof listeningVideoId !== 'undefined' && listeningVideoId) || 'sin ID'})`,
    level: difficultyLevel.value,
    corrections: corrections || 0,
    scores: { listening: Math.round(score) }
  });
  if (typeof renderHistory === 'function') renderHistory();
}

// Títulos claros por juego (panel inferior)
const GAME_TITLES = {
  gaps: '✏️ Espacios vacíos',
  dictation: '✍️ Dictado',
  scramble: '🧩 Ordena la frase',
  minimal: '👂 Pares mínimos — elige la palabra correcta',
  sprint: '⚡ Dictado exprés',
  karaoke: '🎤 Karaoke con espacios',
  quiz: '✅ Verdadero / Falso',
  phoneme: '🔊 Dictado por fonemas'
};

// Marca el panel visible y oculta los demás (incluye los juegos base).
function showGamePanel(name) {
  const panels = {
    gaps: listeningGapExercise,
    scramble: document.getElementById('listening-game-scramble'),
    minimal: document.getElementById('listening-game-minimal'),
    sprint: document.getElementById('listening-game-sprint'),
    karaoke: document.getElementById('listening-game-karaoke'),
    quiz: document.getElementById('listening-game-quiz'),
    phoneme: document.getElementById('listening-game-phoneme')
  };
  Object.entries(panels).forEach(([key, el]) => {
    if (el) el.classList.toggle('hidden', key !== name);
  });
  // El dictado base y la rueda solo se muestran con sus juegos
  if (typeof listeningDictation !== 'undefined' && listeningDictation) {
    listeningDictation.classList.toggle('hidden', name !== 'dictation');
  }
  if (typeof lpWheel !== 'undefined') {
    lpWheel.classList.toggle('hidden', name !== 'gaps');
  }
  // Nombre del juego bien visible en el panel inferior
  if (typeof listeningExerciseTitle !== 'undefined' && listeningExerciseTitle) {
    listeningExerciseTitle.textContent = GAME_TITLES[name] || '✏️ Ejercicio';
  }
  // "🔁 Repetir espacio" solo tiene sentido en el juego de espacios vacíos
  if (typeof listeningReplayGapBtn !== 'undefined' && listeningReplayGapBtn) {
    listeningReplayGapBtn.classList.toggle('hidden', name !== 'gaps');
  }
  // Todos los juegos de listening requieren video: esconder "Usar transcripción pegada"
  if (typeof listeningManualBtn !== 'undefined' && listeningManualBtn) {
    listeningManualBtn.classList.add('hidden');
  }
  // Al cambiar de juego: detener el audio y limpiar correcciones anteriores
  stopListeningAudio();
  resetGameVisuals();
}

// ---------- Material compartido: frases del video ----------
// Detiene el audio: pausa el video y lo rebobina al inicio, y cancela TTS.
// Repite la pausa tras un breve retardo para asegurar que el player la
// aplique aunque estuviera procesando otro comando (evita que el video
// siga reproduciéndose al cambiar de juego).
function stopListeningAudio() {
  if (typeof lpCommand === 'function') {
    lpCommand('pauseVideo');
    lpCommand('seekTo', [0, true]);
    setTimeout(() => {
      lpCommand('pauseVideo');
    }, 300);
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Limpia marcas de corrección de todos los juegos (ok/miss/selected...).
function resetGameVisuals() {
  // Scramble: quitar ok/miss del contenedor de slots
  if (typeof scrambleSlotsEl !== 'undefined' && scrambleSlotsEl) {
    scrambleSlotsEl.classList.remove('ok', 'miss');
  }
  // Pares mínimos: limpiar clases de las opciones
  document.querySelectorAll('.minimal-option.ok, .minimal-option.miss').forEach((el) => el.classList.remove('ok', 'miss'));
  // Karaoke: limpiar clases de los inputs
  document.querySelectorAll('.karaoke-word input.gap-ok, .karaoke-word input.gap-miss').forEach((inp) => {
    inp.classList.remove('gap-ok', 'gap-miss');
  });
  // Verdadero/Falso: limpiar marcas de corrección
  document.querySelectorAll('.quiz-item.quiz-miss').forEach((el) => el.classList.remove('quiz-miss'));
  // Dictado exprés: reiniciar puntos y timer
  if (typeof sprintPoints !== 'undefined') { sprintPoints = 0; }
  if (typeof sprintScoreEl !== 'undefined' && sprintScoreEl) sprintScoreEl.textContent = 'Puntos: 0';
  if (typeof stopSprintTimer === 'function') stopSprintTimer();
  // Dictado base: limpiar resultado
  if (typeof listeningResult !== 'undefined' && listeningResult) listeningResult.classList.add('hidden');
}

// ---------- Precisión de audio: timestamps y normalización ----------
// Devuelve las frases de la transcripción actual (del video o manual).
// Se recalcula cada vez porque la transcripción cambia con cada canción.
function getGameSentences() {
  const text = (typeof listeningTranscriptText === 'string' && listeningTranscriptText)
    || (document.getElementById('listening-transcript') || {}).value
    || '';
  if (!listeningSentences.length || listeningSentencesSource !== text) {
    listeningSentences = splitIntoSentences(text);
    listeningSentencesSource = text || '';
  }
  return listeningSentences;
}
let listeningSentencesSource = '';

// ---------- Precisión de audio: timestamps y normalización ----------
// Normaliza texto para comparación: minúsculas, sin acentos ni puntuación.
function normalizeForMatch(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parsea transcripciones con marcas de tiempo en varios formatos:
//   00:12 frase...  |  [00:12.5] frase...  |  1:23 frase...  |  00:01:23 frase...
// Devuelve [{time, text}] ordenado por tiempo, o [] si no hay timestamps.
function parseTimestampedTranscript(text) {
  const lines = (text || '').split(/\r?\n/);
  const entries = [];
  const re = /^\s*[\[\(]?(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?[\]\)]?\s*[-–—]?\s*(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const hours = m[1] ? parseInt(m[1], 10) : 0;
    const minutes = parseInt(m[2], 10);
    const seconds = parseInt(m[3], 10);
    const frac = m[4] ? parseFloat('0.' + m[4]) : 0;
    const time = hours * 3600 + minutes * 60 + seconds + frac;
    const lineText = m[5].trim();
    if (lineText) entries.push({ time, text: lineText });
  }
  // Solo si la mayoría de las líneas tienen timestamp (evita falsos positivos)
  const nonEmpty = lines.filter((l) => l.trim()).length;
  if (entries.length < 2 || entries.length < nonEmpty * 0.6) return [];
  return entries.sort((a, b) => a.time - b.time);
}

// Cache de timestamps parseados (se invalida si cambia la transcripción)
let cachedTimestamps = null;
let cachedTimestampsSource = '';

// Devuelve los timestamps del video actual (o [])
function getTimestamps() {
  const text = (typeof listeningTranscriptText === 'string' && listeningTranscriptText)
    || (document.getElementById('listening-transcript') || {}).value
    || '';
  if (cachedTimestampsSource !== text) {
    cachedTimestamps = parseTimestampedTranscript(text);
    cachedTimestampsSource = text || '';
  }
  return cachedTimestamps || [];
}

// Busca el tiempo de inicio de una frase usando timestamps exactos.
// Devuelve el tiempo en segundos, o null si no se encuentra.
function findTimeFromTimestamps(sentence) {
  const stamps = getTimestamps();
  if (!stamps.length) return null;
  const target = normalizeForMatch(sentence);
  if (!target) return null;
  // Coincidencia exacta (texto normalizado)
  for (const entry of stamps) {
    if (normalizeForMatch(entry.text) === target) return entry.time;
  }
  // Coincidencia parcial: la frase está dentro de una línea con timestamp
  for (const entry of stamps) {
    const entryNorm = normalizeForMatch(entry.text);
    if (entryNorm.includes(target) || target.includes(entryNorm)) return entry.time;
  }
  return null;
}
gameBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    gameBtns.forEach((b) => b.classList.toggle('active', b === btn));
    const name = btn.dataset.game;
    showGamePanel(name);
    if (name === 'scramble') initScramble();
    if (name === 'minimal') initMinimal();
    if (name === 'sprint') initSprint();
    if (name === 'karaoke') initKaraoke();
    if (name === 'quiz') initQuiz();
    if (name === 'phoneme') initPhoneme();
  });
});

// ============================================================
// JUEGO: ORDENA LA FRASE (scramble)
// ============================================================
const scrambleSlotsEl = document.getElementById('scramble-slots');
const scrambleBankEl = document.getElementById('scramble-bank');
const scramblePlayBtn = document.getElementById('scramble-play-btn');
const scrambleNextBtn = document.getElementById('scramble-next-btn');
const scrambleCheckBtn = document.getElementById('scramble-check-btn');

let scrambleIndex = 0;
let scramblePlaced = []; // palabras colocadas, en orden
let scrambleBankWords = []; // [{word, used}]
let scrambleAttempts = 0;

function initScramble() {
  const sentences = getGameSentences();
  if (!sentences.length) {
    scrambleSlotsEl.innerHTML = '<span class="slot-empty">Carga primero un video con transcripción.</span>';
    scrambleBankEl.innerHTML = '';
    return;
  }
  scrambleIndex = Math.min(scrambleIndex, sentences.length - 1);
  const words = sentences[scrambleIndex].split(/\s+/).filter(Boolean);
  scramblePlaced = [];
  scrambleBankWords = words.map((word, i) => ({ word, used: false, id: i }));
  // Mezcla el banco (Fisher-Yates)
  for (let i = scrambleBankWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scrambleBankWords[i], scrambleBankWords[j]] = [scrambleBankWords[j], scrambleBankWords[i]];
  }
  renderScramble();
}

function renderScramble() {
  // Slots: palabras colocadas o placeholder
  scrambleSlotsEl.innerHTML = '';
  if (!scramblePlaced.length) {
    scrambleSlotsEl.innerHTML = '<span class="slot-empty">Haz clic en las palabras en orden…</span>';
  } else {
    scramblePlaced.forEach((word, i) => {
      const chip = document.createElement('span');
      chip.className = 'scramble-slot-word';
      chip.textContent = word;
      chip.title = 'Quitar';
      chip.addEventListener('click', () => {
        const bankItem = scrambleBankWords.find((w) => w.word === word && w.used);
        if (bankItem) bankItem.used = false;
        scramblePlaced.splice(i, 1);
        renderScramble();
      });
      scrambleSlotsEl.appendChild(chip);
    });
  }
  // Banco: palabras disponibles
  scrambleBankEl.innerHTML = '';
  scrambleBankWords.forEach((item) => {
    const chip = document.createElement('span');
    chip.className = 'scramble-word' + (item.used ? ' used' : '');
    chip.textContent = item.word;
    chip.addEventListener('click', () => {
      if (item.used) return;
      item.used = true;
      scramblePlaced.push(item.word);
      renderScramble();
    });
    scrambleBankEl.appendChild(chip);
  });
}

scramblePlayBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const sentence = sentences[scrambleIndex];
  if (!sentence) return;
  // Busca la frase en la transcripción para estimar su tiempo aproximado
  playSentenceFromText(sentence);
});

scrambleNextBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  if (scrambleIndex < sentences.length - 1) { scrambleIndex++; initScramble(); }
});

scrambleCheckBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const expected = (sentences[scrambleIndex] || '').split(/\s+/);
  const ok = scramblePlaced.length === expected.length
    && scramblePlaced.every((w, i) => w.toLowerCase() === (expected[i] || '').toLowerCase());
  scrambleSlotsEl.classList.toggle('ok', ok);
  scrambleSlotsEl.classList.toggle('miss', !ok);
  if (ok) {
    recordGameResult('listening (ordenar frase)', 100, 0);
  } else {
    scrambleAttempts++;
  }
  if (typeof showToast === 'function') {
    showToast(ok ? '✅ ¡Frase correcta!' : '❌ El orden no es correcto. Inténtalo de nuevo.', ok ? 'success' : 'warning');
  }
});

// ============================================================
// JUEGO: PARES MÍNIMOS (opción múltiple con audio)
// ============================================================
const minimalQuestionEl = document.getElementById('minimal-question');
const minimalOptionsEl = document.getElementById('minimal-options');
const minimalPlayBtn = document.getElementById('minimal-play-btn');
const minimalNextBtn = document.getElementById('minimal-next-btn');

let minimalIndex = 0;
let minimalData = []; // [{question, answer, options[]}]

function initMinimal() {
  const sentences = getGameSentences();
  if (!sentences.length) {
    minimalQuestionEl.innerHTML = '<span class="hint">Carga primero un video con transcripción.</span>';
    minimalOptionsEl.innerHTML = '';
    return;
  }
  if (!minimalData.length) {
    minimalData = buildLocalMinimalPairs(sentences);
  }
  minimalIndex = Math.min(minimalIndex, Math.max(0, minimalData.length - 1));
  renderMinimal();
}

// Fallback sin IA: elige una palabra larga de la frase y usa palabras del
// propio video como distractores.
function buildLocalMinimalPairs(sentences) {
  const allWords = [...new Set((sentences.join(' ').toLowerCase().match(/[a-z']+/g)) || [])];
  return sentences.slice(0, 10).map((sentence) => {
    const words = sentence.split(/\s+/);
    const idx = words.findIndex((w) => w.replace(/[^a-zA-Z']/g, '').length >= 4);
    if (idx === -1) return null;
    const answer = words[idx];
    const distractors = allWords
      .filter((w) => w !== answer.toLowerCase() && Math.abs(w.length - answer.length) <= 2)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    while (distractors.length < 3) distractors.push(['the', 'and', 'with', 'from'][distractors.length % 4]);
    const options = [answer, ...distractors].sort(() => Math.random() - 0.5);
    return { question: sentence.replace(answer, '____'), answer, options };
  }).filter(Boolean);
}

function renderMinimal() {
  const item = minimalData[minimalIndex];
  if (!item) return;
  minimalQuestionEl.textContent = item.question;
  minimalOptionsEl.innerHTML = '';
  item.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'minimal-option';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      const correct = opt === item.answer;
      btn.classList.add(correct ? 'ok' : 'miss');
      if (correct) {
        recordGameResult('listening (pares mínimos)', 100, 0);
      }
      if (typeof showToast === 'function') {
        showToast(correct ? '✅ ¡Correcto!' : '❌ Esa no es. Escucha de nuevo.', correct ? 'success' : 'warning');
      }
    });
    minimalOptionsEl.appendChild(btn);
  });
}

minimalPlayBtn.addEventListener('click', () => {
  const item = minimalData[minimalIndex];
  if (item) playSentenceFromText(item.question.replace('____', item.answer));
});

minimalNextBtn.addEventListener('click', () => {
  if (minimalIndex < minimalData.length - 1) { minimalIndex++; renderMinimal(); }
});

// ============================================================
// JUEGO: DICTADO EXPRÉS (sprint)
// ============================================================
const sprintInput = document.getElementById('sprint-input');
const sprintPlayBtn = document.getElementById('sprint-play-btn');
const sprintNextBtn = document.getElementById('sprint-next-btn');
const sprintCheckBtn = document.getElementById('sprint-check-btn');
const sprintTimerEl = document.getElementById('sprint-timer');
const sprintScoreEl = document.getElementById('sprint-score');

let sprintIndex = 0;
let sprintPoints = 0;
let sprintTimer = null;
let sprintSecondsLeft = 0;

function initSprint() {
  const sentences = getGameSentences();
  if (!sentences.length) {
    sprintInput.placeholder = 'Carga primero un video con transcripción.';
    sprintInput.disabled = true;
    return;
  }
  sprintInput.disabled = false;
  sprintIndex = Math.min(sprintIndex, sentences.length - 1);
  renderSprint();
}

function renderSprint() {
  sprintInput.value = '';
  sprintInput.focus();
  startSprintTimer(15);
}

function startSprintTimer(seconds) {
  stopSprintTimer();
  sprintSecondsLeft = seconds;
  updateSprintTimer();
  sprintTimer = setInterval(() => {
    sprintSecondsLeft--;
    updateSprintTimer();
    if (sprintSecondsLeft <= 0) {
      stopSprintTimer();
      if (typeof showToast === 'function') showToast('⏱️ ¡Tiempo! Escucha de nuevo e inténtalo.', 'warning');
    }
  }, 1000);
}

function updateSprintTimer() {
  sprintTimerEl.textContent = `⏱️ ${sprintSecondsLeft}s`;
  sprintTimerEl.classList.toggle('urgent', sprintSecondsLeft <= 5);
}

function stopSprintTimer() {
  if (sprintTimer) { clearInterval(sprintTimer); sprintTimer = null; }
}

sprintPlayBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const sentence = sentences[sprintIndex];
  if (sentence) playSentenceFromText(sentence);
});

sprintNextBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  if (sprintIndex < sentences.length - 1) { sprintIndex++; startSprintTimer(15); }
});

sprintCheckBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const expected = (sentences[sprintIndex] || '').toLowerCase().replace(/[^a-z' ]/g, '');
  const given = sprintInput.value.trim().toLowerCase().replace(/[^a-z' ]/g, '');
  if (!expected) return;
  const expectedWords = expected.split(/\s+/).filter(Boolean);
  const gotWords = given.split(/\s+/).filter(Boolean);
  const matched = expectedWords.filter((w) => gotWords.includes(w)).length;
  const ratio = expectedWords.length ? matched / expectedWords.length : 0;
  const points = Math.max(0, Math.round(ratio * 100 * (sprintSecondsLeft / 15)));
  sprintPoints += points;
  sprintScoreEl.textContent = `Puntos: ${sprintPoints}`;
  recordGameResult('listening (dictado exprés)', ratio * 100, expectedWords.length - matched);
  stopSprintTimer();
  if (typeof showToast === 'function') {
    showToast(`+${points} puntos (${gotWords.length}/${expectedWords.length} palabras)`, ratio === 1 ? 'success' : 'info');
  }
});

// ============================================================
// JUEGO: KARAOKE CON HUECOS
// ============================================================
const karaokeLineEl = document.getElementById('karaoke-line');
const karaokePlayBtn = document.getElementById('karaoke-play-btn');
const karaokeHideBtn = document.getElementById('karaoke-hide-btn');
const karaokeCheckBtn = document.getElementById('karaoke-check-btn');

let karaokeWords = []; // [{word, hidden, input}]

function initKaraoke() {
  const sentences = getGameSentences();
  if (!sentences.length) {
    karaokeLineEl.innerHTML = '<span class="hint">Carga primero un video con transcripción.</span>';
    return;
  }
  hideKaraokeWords();
}

// Oculta ~1 de cada 3 palabras y las convierte en inputs.
function hideKaraokeWords() {
  const sentences = getGameSentences();
  const text = sentences.join(' ');
  karaokeWords = (text.split(/\s+/) || []).map((word) => ({
    word,
    hidden: /^[a-zA-Z']+$/.test(word) && Math.random() < 0.33
  }));
  renderKaraoke();
}

function renderKaraoke() {
  karaokeLineEl.innerHTML = '';
  karaokeWords.forEach((item, i) => {
    const span = document.createElement('span');
    span.className = 'karaoke-word';
    if (item.hidden) {
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.index = i;
      item.input = input;
      span.classList.add('hidden-word');
      span.appendChild(input);
    } else {
      span.textContent = item.word + ' ';
    }
    karaokeLineEl.appendChild(span);
  });
}

karaokeHideBtn.addEventListener('click', hideKaraokeWords);

karaokePlayBtn.addEventListener('click', () => {
  // Reproduce el video desde el principio (o continúa) para seguir la letra
  lpCommand('playVideo');
});

karaokeCheckBtn.addEventListener('click', () => {
  let correct = 0;
  let total = 0;
  karaokeWords.forEach((item) => {
    if (!item.hidden || !item.input) return;
    total++;
    const given = (item.input.value || '').trim().toLowerCase().replace(/[^a-z']/g, '');
    const expected = item.word.toLowerCase().replace(/[^a-z']/g, '');
    const ok = given === expected;
    item.input.classList.remove('gap-ok', 'gap-miss');
    item.input.classList.add(ok ? 'gap-ok' : 'gap-miss');
    if (ok) correct++;
  });
  if (total > 0) {
    recordGameResult('listening (karaoke)', (correct / total) * 100, total - correct);
  }
  if (typeof showToast === 'function') {
    showToast(`🎤 ${correct} de ${total} palabras correctas`, correct === total ? 'success' : 'info');
  }
});

// ============================================================
// JUEGO: VERDADERO / FALSO (comprensión, generado por IA)
// ============================================================
const quizListEl = document.getElementById('quiz-list');
const quizGenerateBtn = document.getElementById('quiz-generate-btn');
const quizCheckBtn = document.getElementById('quiz-check-btn');

let quizData = []; // [{statement, answer(true|false), userAnswer}]

function initQuiz() {
  if (!quizData.length) {
    quizListEl.innerHTML = '<p class="hint">Pulsa "✨ Generar preguntas" para crear afirmaciones sobre el video.</p>';
  }
}

async function generateQuizQuestions() {
  const apiKey = getApiKey();
  if (!apiKey) {
    if (typeof showToast === 'function') showToast('Primero configura tu clave de API en ⚙️ Configuración.', 'warning');
    return;
  }
  const transcript = listeningTranscriptText || (document.getElementById('listening-transcript') || {}).value || '';
  if (!transcript) {
    if (typeof showToast === 'function') showToast('Carga primero un video con transcripción.', 'warning');
    return;
  }
  quizGenerateBtn.disabled = true;
  quizGenerateBtn.textContent = '✨ Generando…';
  const prompt = `You are an English listening teacher. Here is a transcript: "${transcript}"

Produce 5 true/false statements about the transcript content. Mix true and false statements. False statements should contradict or distort details. Statements must be in English, at ${difficultyLevel.value} level.

Return ONLY valid JSON: {"items": [{"statement": "...", "answer": true}]}`;
  try {
    const response = await callGemini(prompt, apiKey, { temperature: 0.5, jsonMode: true });
    const data = JSON.parse(response);
    quizData = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      statement: item.statement,
      answer: Boolean(item.answer),
      user: null
    }));
    renderQuiz();
  } catch (error) {
    if (typeof showToast === 'function') showToast(`❌ No se pudieron generar preguntas: ${error.message}`, 'error');
  } finally {
    quizGenerateBtn.disabled = false;
    quizGenerateBtn.textContent = '✨ Generar preguntas';
  }
}

function renderQuiz() {
  quizListEl.innerHTML = '';
  quizData.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'quiz-item';
    const statement = document.createElement('span');
    statement.className = 'quiz-statement';
    statement.textContent = `${i + 1}. ${item.statement}`;
    const trueBtn = document.createElement('button');
    trueBtn.className = 'quiz-true-btn';
    trueBtn.textContent = '✔️ Verdadero';
    const falseBtn = document.createElement('button');
    falseBtn.className = 'quiz-false-btn';
    falseBtn.textContent = '❌ Falso';
    [trueBtn, falseBtn].forEach((btn) => {
      btn.addEventListener('click', () => {
        item.user = btn === trueBtn;
        trueBtn.classList.toggle('selected', btn === trueBtn);
        falseBtn.classList.toggle('selected', btn === falseBtn);
      });
    });
    row.appendChild(statement);
    row.appendChild(trueBtn);
    row.appendChild(falseBtn);
    quizListEl.appendChild(row);
  });
}

quizGenerateBtn.addEventListener('click', generateQuizQuestions);

quizCheckBtn.addEventListener('click', () => {
  let correct = 0;
  let answered = 0;
  quizData.forEach((item, i) => {
    if (item.user == null) return;
    answered++;
    const ok = item.user === item.answer;
    if (ok) correct++;
    const itemEl = quizListEl.children[i];
    if (itemEl) itemEl.classList.toggle('quiz-miss', !ok);
  });
  if (answered > 0) {
    recordGameResult('listening (verdadero/falso)', (correct / answered) * 100, answered - correct);
  }
  if (typeof showToast === 'function') {
    showToast(answered ? `✅ ${correct} de ${answered} correctas` : 'Responde primero algunas preguntas.', answered ? 'info' : 'warning');
  }
});

// ============================================================
// JUEGO: DICTADO POR FONEMAS (sonidos difíciles)
// ============================================================
const phonemeFocusEl = document.getElementById('phoneme-focus');
const phonemeInput = document.getElementById('phoneme-input');
const phonemePlayBtn = document.getElementById('phoneme-play-btn');
const phonemeNextBtn = document.getElementById('phoneme-next-btn');
const phonemeCheckBtn = document.getElementById('phoneme-check-btn');

let phonemeIndex = 0;
let phonemeData = []; // [{sentence, focus}]

// Sonidos difíciles para hispanohablantes y sus patrones de búsqueda.
const PHONEME_FOCUSES = [
  { name: 'Contraste /ɪ/ vs /iː/ (ship/sheep)', pattern: /\b(ship|sheep|bit|beat|sit|seat|hit|heat|live|leave|fill|feel|it|eat)\w*/i },
  { name: 'b / v', pattern: /\b\w*(berry|very|boat|vote|base|vase|ban|van|best|vest|curb|curve)\w*/i },
  { name: 'Terminaciones -ed (/t/, /d/, /ɪd/)', pattern: /\b\w+ed\b/i },
  { word: 'S sonora final (plural -s /z/)', pattern: /\b\w+s\b/ },
  { name: 'Consonantes finales (t/d, k/g, s/z)', pattern: /\b\w+[tdkgs]\b/ },
  { name: 'H aspirada vs muda (h / silent h)', pattern: /\b(h[a-z]+|hour|honest)\b/i }
];

function initPhoneme() {
  const sentences = getGameSentences();
  if (!sentences.length) {
    phonemeFocusEl.textContent = 'Carga primero un video con transcripción.';
    phonemeInput.disabled = true;
    return;
  }
  phonemeInput.disabled = false;
  phonemeIndex = Math.min(phonemeIndex, sentences.length - 1);
  renderPhoneme();
}

// Elige frases que contengan sonidos difíciles y muestra el foco.
function renderPhoneme() {
  const sentences = getGameSentences();
  const sentence = sentences[phonemeIndex];
  if (!sentence) return;
  phonemeInput.value = '';
  phonemeInput.disabled = false;
  // Detecta qué sonido difícil aparece en la frase
  const focus = PHONEME_FOCUSES.find((f) => f.pattern.test(sentence));
  phonemeFocusEl.textContent = '🎯 ' + (focus ? focus.name : 'Dictado general');
  phonemeInput.focus();
}

phonemePlayBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const sentence = sentences[phonemeIndex];
  if (sentence) playSentenceFromText(sentence);
});

phonemeNextBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  if (phonemeIndex < sentences.length - 1) { phonemeIndex++; renderPhoneme(); }
});

phonemeCheckBtn.addEventListener('click', () => {
  const sentences = getGameSentences();
  const expected = (sentences[phonemeIndex] || '').toLowerCase().replace(/[^a-z' ]/g, '');
  const given = phonemeInput.value.trim().toLowerCase().replace(/[^a-z' ]/g, '');
  if (!expected) return;
  const expectedWords = expected.split(/\s+/).filter(Boolean);
  const gotWords = given.split(/\s+/).filter(Boolean);
  const matched = expectedWords.filter((w) => gotWords.includes(w)).length;
  const ratio = expectedWords.length ? matched / expectedWords.length : 0;
  const score = Math.round(ratio * 100);
  if (typeof showToast === 'function') {
    showToast(`🔊 ${gotWords.length}/${expectedWords.length} palabras correctas (${score}%)`, ratio === 1 ? 'success' : 'info');
  }
  // Guardar en historial
  recordGameResult('listening (dictado por fonemas)', score, expectedWords.length - gotWords.length);
});

// ---------- Visibilidad del selector de juegos ----------
// (eliminado: el selector interno ya no existe — el juego se elige antes, en la página del juego)

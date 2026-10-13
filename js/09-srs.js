// ============================================================
// REPASO — REPETICIÓN ESPACIADA (SRS)
// Las palabras falladas en práctica se convierten en tarjetas
// ============================================================

const REVIEW_KEY = 'srs_deck';

// Intervalos de repetición espaciada (en días) por nivel de dominio
const SRS_INTERVALS = [1, 2, 4, 8, 16, 32];

function loadDeck() {
  try {
    return JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveDeck(deck) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(deck));
}

// Registrar una palabra fallada (llamado desde evaluatePronunciation)
function recordMissedWord(word) {
  const clean = (word || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!clean || clean.length < 3) return; // solo palabras "reales"

  const deck = loadDeck();
  let card = deck.find((c) => c.word === clean);
  if (card) {
    card.failures += 1;
    card.interval = 0; // vuelve al principio del repaso
    card.due = new Date().toISOString();
  } else {
    deck.push({
      word: clean,
      failures: 1,
      interval: 0,
      due: new Date().toISOString(),
      added: new Date().toISOString()
    });
  }
  saveDeck(deck);
}

// Registrar que el usuario dijo bien una palabra que estaba en el mazo
function recordHitWord(word) {
  const clean = (word || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!clean) return;
  const deck = loadDeck();
  const card = deck.find((c) => c.word === clean);
  if (card) {
    card.streak = (card.streak || 0) + 1;
    // Si la dice bien 2 veces seguidas en práctica, se promueve de intervalo
    if (card.streak >= 2 && card.interval < SRS_INTERVALS.length - 1) {
      card.interval += 1;
      card.streak = 0;
    }
    card.due = new Date(Date.now() + card.interval * 86400000).toISOString();
    saveDeck(deck);
  }
}

const reviewStatsEl = document.getElementById('review-stats');
const reviewStartBtn = document.getElementById('review-start-btn');
const reviewClearBtn = document.getElementById('review-clear-btn');
const reviewSession = document.getElementById('review-session');
const reviewCardWord = document.getElementById('review-card-word');
const reviewMeta = document.getElementById('review-meta');
const reviewSpeakBtn = document.getElementById('review-speak-btn');
const reviewPracticeBtn = document.getElementById('review-practice-btn');
const reviewKnownBtn = document.getElementById('review-known-btn');
const reviewAgainBtn = document.getElementById('review-again-btn');
const reviewSentence = document.getElementById('review-sentence');

let reviewQueue = [];
let reviewCurrentCard = null;

function renderReviewStats() {
  const deck = loadDeck();
  const today = new Date().toISOString().slice(0, 10);
  const due = deck.filter((c) => (c.due || '').slice(0, 10) <= today).length;
  const mastered = deck.filter((c) => c.interval >= SRS_INTERVALS.length - 1).length;

  reviewStatsEl.innerHTML = `
    <div class="review-stat">
      <div class="stat-value">${deck.length}</div>
      <div class="stat-label">tarjetas en el mazo</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">${due}</div>
      <div class="stat-label">por repasar hoy</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">${mastered}</div>
      <div class="stat-label">dominadas</div>
    </div>
  `;
}

function startReviewSession() {
  const today = new Date().toISOString().slice(0, 10);
  reviewQueue = loadDeck()
    .filter((c) => (c.due || '').slice(0, 10) <= today)
    .sort((a, b) => (a.due || '').localeCompare(b.due || ''));

  if (!reviewQueue.length) {
    showToast('No hay tarjetas por repasar hoy. ¡Bien hecho! 🎉', 'success');
    return;
  }

  reviewSession.classList.remove('hidden');
  showNextReviewCard();
}

function showNextReviewCard() {
  reviewCurrentCard = reviewQueue.shift();

  if (!reviewCurrentCard) {
    reviewSession.classList.add('hidden');
    showToast('¡Repaso completado! 🎉', 'success');
    renderReviewStats();
    return;
  }

  reviewCardWord.textContent = reviewCurrentCard.word;
  reviewMeta.textContent = `Fallaste esta palabra ${reviewCurrentCard.failures} vez/veces. Nivel de repaso: ${reviewCurrentCard.interval + 1}/${SRS_INTERVALS.length}.`;
  reviewSentence.textContent = '';
}

function speakReviewWord() {
  if (!reviewCurrentCard) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(reviewCurrentCard.word);
  utterance.rate = 0.8;
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  window.speechSynthesis.speak(utterance);
}

// Practicar la palabra: la envía a la pestaña Práctica con una frase de ejemplo
async function practiceReviewCard() {
  if (!reviewCurrentCard) return;
  const word = reviewCurrentCard.word;
  const key = getApiKey();

  targetText.value = `Practice the word: "${word}". Use it in a sentence.`;
  autoResizeTargetText();

  // Cambiar a la pestaña Práctica
  activateTabByName('practice');

  // Si hay API key, generar una frase de práctica con la IA
  if (key) {
    reviewSentence.textContent = '⏳ Generando una frase de práctica…';
    try {
      const prompt = `Write ONE short English sentence (max 12 words) that uses the word "${word}" naturally, ` +
        `at ${LEVEL_NAMES[difficultyLevel.value]} level. Reply ONLY with valid JSON: {"sentence": "..."}`;
      const text = await callGemini(prompt, key, { temperature: 0.5, jsonMode: true });
      const result = JSON.parse(text);
      if (result.sentence) {
        targetText.value = result.sentence;
        autoResizeTargetText();
        reviewSentence.textContent = `Frase de práctica: "${result.sentence}"`;
      }
    } catch {
      reviewSentence.textContent = '';
    }
  }
}

function markCardKnown() {
  if (!reviewCurrentCard) return;
  const deck = loadDeck();
  const idx = deck.findIndex((c) => c.word === reviewCurrentCard.word);
  if (idx >= 0) {
    // Subir de nivel; al llegar al máximo se elimina del mazo
    if (deck[idx].interval >= SRS_INTERVALS.length - 1) {
      deck.splice(idx, 1);
      showToast(`🎉 "${reviewCurrentCard.word}" dominada. Salió del mazo.`, 'success');
    } else {
      deck[idx].interval += 1;
      deck[idx].due = new Date(Date.now() + deck[idx].interval * 86400000).toISOString();
    }
    saveDeck(deck);
  }
  showNextReviewCard();
}

function markCardAgain() {
  if (!reviewCurrentCard) return;
  const deck = loadDeck();
  const card = deck.find((c) => c.word === reviewCurrentCard.word);
  if (card) {
    card.interval = 0;
    card.due = new Date().toISOString();
    saveDeck(deck);
  }
  showNextReviewCard();
}

reviewStartBtn.addEventListener('click', startReviewSession);
reviewSpeakBtn.addEventListener('click', speakReviewWord);
reviewPracticeBtn.addEventListener('click', practiceReviewCard);
reviewKnownBtn.addEventListener('click', markCardKnown);
reviewAgainBtn.addEventListener('click', markCardAgain);

reviewClearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar todo el mazo de repaso?')) {
    localStorage.removeItem(REVIEW_KEY);
    renderReviewStats();
    reviewSession.classList.add('hidden');
    showToast('Mazo vaciado.', 'success');
  }
});

renderReviewStats();


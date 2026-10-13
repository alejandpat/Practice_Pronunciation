// ============================================================
// FONEMAS Y PARES MÍNIMOS
// Sonidos problemáticos para hispanohablantes
// ============================================================

const PHONEME_EXERCISES = {
  th: {
    name: 'TH (/θ/ y /ð/) — think / this',
    description: 'La "th" no existe en español. Coloca la punta de la lengua entre los dientes y sopla. Sorda (think) vs sonora (this).',
    pairs: [
      ['think', 'sink'], ['thank', 'sank'], ['bath', 'bas'],
      ['three', 'tree'], ['thin', 'fin'], ['they', 'day'],
      ['breathe', 'breeze'], ['weather', 'wetter'], ['then', 'den']
    ]
  },
  shortlong: {
    name: '/ɪ/ vs /iː/ — ship / sheep',
    description: 'Vocal corta y relajada (ship, /ɪ/) vs vocal larga y tensa (sheep, /iː/). En español ambas suenan como "i".',
    pairs: [
      ['ship', 'sheep'], ['sit', 'seat'], ['hit', 'heat'],
      ['bit', 'beat'], ['fill', 'feel'], ['live', 'leave'],
      ['mill', 'meal'], ['grin', 'green'], ['it', 'eat']
    ]
  },
  bv: {
    name: 'B vs V — boat / vote',
    description: 'En inglés la "v" se pronuncia con los dientes superiores tocando el labio inferior (fricativa), a diferencia del español donde b/v suenan igual.',
    pairs: [
      ['boat', 'vote'], ['berry', 'very'], ['best', 'vest'],
      ['ban', 'van'], ['bow', 'vow'], ['base', 'vase'],
      ['bile', 'vile'], ['berry', 'bury'], ['vest', 'west']
    ]
  },
  h: {
    name: 'H aspirada — hat / hot',
    description: 'La "h" en inglés se aspira (como una "j" suave). No es muda como en español. Cuidado con "hour" (muda) o "huge" (suena como "y").',
    pairs: [
      ['hat', 'at'], ['hair', 'air'], ['hate', 'eight'],
      ['hold', 'old'], ['heat', 'eat'], ['hedge', 'edge'],
      ['hearth', 'earth'], ['hilarious', 'illegible'], ['hand', 'and']
    ]
  },
  clusters: {
    name: 'Grupos consonánticos — spr-, -ght, -thr',
    description: 'En español añadimos una "e" antes de grupos como "sp-" (especial). En inglés se pronuncian juntos, sin vocal extra.',
    pairs: [
      ['splat', 'split'], ['spring', 'string'], ['street', 'sheet'],
      ['bright', 'brought'], ['thought', 'taught'], ['through', 'true'],
      ['strength', 'strand'], ['scripts', 'skips'], ['sixths', 'six']
    ]
  },
  ed: {
    name: 'Terminación -ed: /t/, /d/, /ɪd/',
    description: 'El "-ed" final tiene 3 sonidos: /t/ tras sordas (stopped), /d/ tras sonoras (played) y /ɪd/ tras t/d (wanted). No se dice "ed" completo.',
    pairs: [
      ['stopped', 'stop'], ['played', 'play'], ['wanted', 'want'],
      ['watched', 'watch'], ['loved', 'love'], ['needed', 'need'],
      ['kissed', 'kiss'], ['moved', 'move'], ['decided', 'decide']
    ]
  }
};

const phonemeSelect = document.getElementById('phoneme-select');
const phonemeDescription = document.getElementById('phoneme-description');
const phonemePairsEl = document.getElementById('phoneme-pairs');
const phonemePairsBtn = document.getElementById('phoneme-pairs-btn');
const phonemeMicBtn = document.getElementById('phoneme-mic-btn');
const phonemeStatus = document.getElementById('phoneme-status');
const phonemeResults = document.getElementById('phoneme-results');
const phonemeScore = document.getElementById('phoneme-score');
const phonemeSummary = document.getElementById('phoneme-summary');
const phonemeWordComparison = document.getElementById('phoneme-word-comparison');

let phonemeRecognition = null;
let phonemeIsListening = false;
let phonemeTranscript = '';
let currentPhonemePairs = [];

// Poblar el selector
Object.entries(PHONEME_EXERCISES).forEach(([key, ex]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = ex.name;
  phonemeSelect.appendChild(option);
});

function renderPhonemePairs() {
  const exercise = PHONEME_EXERCISES[phonemeSelect.value];
  phonemeDescription.textContent = exercise.description;

  // Elegir 5 pares al azar
  currentPhonemePairs = exercise.pairs.slice().sort(() => Math.random() - 0.5).slice(0, 5);

  phonemePairsEl.innerHTML = '';
  currentPhonemePairs.forEach(([wordA, wordB]) => {
    const div = document.createElement('div');
    div.className = 'phoneme-pair';
    div.innerHTML = `
      <span class="pair-word">${escapeHtml(wordA)}</span>
      <span class="pair-sep">/</span>
      <span class="pair-word">${escapeHtml(wordB)}</span>
    `;
    // Clic en un par: escuchar las dos palabras
    div.addEventListener('click', () => {
      window.speechSynthesis.cancel();
      [wordA, wordB].forEach((word) => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.rate = 0.8;
        const selectedVoice = getSelectedVoice();
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          utterance.lang = selectedVoice.lang;
        } else {
          utterance.lang = 'en-US';
        }
        window.speechSynthesis.speak(utterance);
      });
    });
    phonemePairsEl.appendChild(div);
  });
}

phonemeSelect.addEventListener('change', () => {
  localStorage.setItem('phoneme_level', phonemeSelect.value);
  renderPhonemePairs();
});

phonemePairsBtn.addEventListener('click', renderPhonemePairs);

// ---------- Reconocimiento de voz para fonemas ----------
const phonemeSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;
if (phonemeSpeech) {
  phonemeRecognition = new phonemeSpeech();
  phonemeRecognition.lang = 'en-US';
  phonemeRecognition.continuous = true;
  phonemeRecognition.interimResults = true;

  phonemeRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        phonemeTranscript += result[0].transcript + ' ';
      } else {
        interim += result[0].transcript;
      }
    }
    setPhonemeStatus('🎧 Escuchando… di las palabras en voz alta.', 'listening');
  };

  phonemeRecognition.onend = () => {
    if (phonemeIsListening) {
      try { phonemeRecognition.start(); } catch { /* ya iniciado */ }
    }
  };

  phonemeRecognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      setPhonemeStatus('Permiso de micrófono denegado.', 'error');
      stopPhonemeListening();
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      setPhonemeStatus('Error: ' + event.error, 'error');
    }
  };
} else {
  phonemeMicBtn.disabled = true;
}

function setPhonemeStatus(message, type = '') {
  phonemeStatus.textContent = message;
  phonemeStatus.className = 'status ' + type;
}

phonemeMicBtn.addEventListener('click', () => {
  if (phonemeIsListening) {
    stopPhonemeListening();
  } else {
    startPhonemeListening();
  }
});

function startPhonemeListening() {
  if (!phonemeRecognition) return;
  phonemeTranscript = '';
  phonemeResults.classList.add('hidden');
  phonemeIsListening = true;
  phonemeMicBtn.textContent = '⏹ Detener';
  setPhonemeStatus('🎧 Escuchando… di las palabras en voz alta y pulsa Detener.', 'listening');
  try { phonemeRecognition.start(); } catch { /* ya activo */ }
}

function stopPhonemeListening() {
  phonemeIsListening = false;
  phonemeMicBtn.textContent = '🎤 Leer los pares en voz alta';
  setPhonemeStatus('');

  if (phonemeRecognition) {
    try { phonemeRecognition.stop(); } catch { /* noop */ }
  }

  const said = phonemeTranscript.trim();
  if (!said) {
    setPhonemeStatus('No se detectó voz. Inténtalo de nuevo.', 'error');
    return;
  }

  // Comparar contra todos los pares del set actual
  const expectedWords = currentPhonemePairs.flat();
  const alignment = alignWords(expectedWords, normalize(said));
  const correct = alignment.filter((w) => w.status === 'ok').length;
  const score = expectedWords.length ? Math.round((correct / expectedWords.length) * 100) : 0;

  phonemeScore.textContent = score;
  phonemeScore.className = 'score-circle ' + scoreClass(score);

  const missed = alignment.filter((w) => w.status !== 'ok').map((w) => w.expected || w.word);
  phonemeSummary.textContent = missed.length
    ? `Dijiste ${correct} de ${expectedWords.length} palabras. Repasa: ${missed.join(', ')}.`
    : `¡Excelente! Distinguiste bien todos los sonidos.`;

  phonemeWordComparison.innerHTML = '';
  alignment.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'word ' + w.status;
    span.textContent = w.status === 'miss' && w.word === '—' ? w.expected : w.word;
    phonemeWordComparison.appendChild(span);
  });

  phonemeResults.classList.remove('hidden');
  setPhonemeStatus('Listo. Pulsa "Otros pares mínimos" para practicar más.');
  recordActivitySession('phonemes');

  // Guardar en el historial de fonemas
  addPhonemeHistoryEntry({
    phoneme: PHONEME_EXERCISES[phonemeSelect.value].name,
    score,
    missed
  });
}

// ---------- Inicialización de fonemas ----------
const savedPhoneme = localStorage.getItem('phoneme_level');
if (savedPhoneme && PHONEME_EXERCISES[savedPhoneme]) phonemeSelect.value = savedPhoneme;
renderPhonemePairs();


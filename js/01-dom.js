// Conversación
const convMicBtn = document.getElementById('conv-mic-btn-dock'); // botón fijo (dock) siempre visible
const convClearBtn = document.getElementById('conv-clear-btn');
const convStatus = document.getElementById('conv-status');
const convModeSelect = document.getElementById('conv-mode');
const convAutoEval = document.getElementById('conv-auto-eval');
const convEvalBtn = document.getElementById('conv-eval-btn');
const convPronSection = document.getElementById('conv-pron-section');
const convPronScore = document.getElementById('conv-pron-score');
const convPronSummary = document.getElementById('conv-pron-summary');
const convPronTips = document.getElementById('conv-pron-tips');
const convTranscriptSection = document.getElementById('conv-transcript-section');
const convLiveTranscript = document.getElementById('conv-live-transcript');
const convMessages = document.getElementById('conv-messages');

// Traducción
const translateSource = document.getElementById('translate-source');
const translateResult = document.getElementById('translate-result');
const translateDirection = document.getElementById('translate-direction');
const translateBtn = document.getElementById('translate-btn');
const translateStatus = document.getElementById('translate-status');

// Historial
const historyExportBtn = document.getElementById('history-export-btn');
const historyClearBtn = document.getElementById('history-clear-btn');
const historyList = document.getElementById('history-list');

// Progreso
const progressSummary = document.getElementById('progress-summary');
const progressEmpty = document.getElementById('progress-empty');
const progressChartCanvas = document.getElementById('progress-chart');
const progressLevelFilter = document.getElementById('progress-level-filter');

// Notificaciones
const toastContainer = document.getElementById('toast-container');

// Nivel de dificultad
const difficultyLevel = document.getElementById('difficulty-level');
const phraseChips = document.getElementById('phrase-chips');
const refreshPhrasesBtn = document.getElementById('refresh-phrases-btn');

// Ollama (respaldo local)
const ollamaUrlInput = document.getElementById('ollama-url');
const ollamaModelInput = document.getElementById('ollama-model');
const ollamaDirectCheckbox = document.getElementById('ollama-direct');

// ---------- Estado ----------
let recognition = null;
let isListening = false;
let finalTranscript = '';

// Estado de conversación
let convRecognition = null;
let convIsListening = false;
let convFinalTranscript = '';
let conversationHistory = []; // { role: 'user'|'assistant', text }

// ---------- Pestañas ----------
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
    if (tab.dataset.tab === 'history') renderHistory();
    if (tab.dataset.tab === 'progress') renderProgress();

    // Si el ítem está dentro de un desplegable, cerrarlo y reflejar la selección
    const dropdown = tab.closest('.tab-dropdown');
    if (dropdown) {
      dropdown.open = false;
      updateDropdownSummaries();
    }
  });
});

// Refleja en el summary del desplegable qué actividad está activa
function updateDropdownSummaries() {
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab) return;
  const dropdown = activeTab.closest('.tab-dropdown');
  if (!dropdown) return;
  const summary = dropdown.querySelector('summary');
  const icon = summary.textContent.trim().split(' ')[0]; // conserva el emoji
  summary.textContent = `${icon} ${activeTab.textContent.trim()}`;
}

// Activa una pestaña por nombre (usado por los accesos directos de la app)
function activateTabByName(tabName) {
  const target = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (target) target.click();
}

// Cerrar cualquier desplegable abierto al hacer clic fuera de él
document.addEventListener('click', (event) => {
  document.querySelectorAll('.tab-dropdown[open]').forEach((dropdown) => {
    if (!dropdown.contains(event.target)) dropdown.open = false;
  });
});

// ---------- Clave de API ----------
const savedKey = localStorage.getItem('gemini_api_key');
if (savedKey) {
  apiKeyInput.value = savedKey;
}

// ---------- Idioma de explicaciones ----------
const savedLang = localStorage.getItem('explanation_lang');
if (savedLang) {
  explanationLang.value = savedLang;
}
explanationLang.addEventListener('change', () => {
  localStorage.setItem('explanation_lang', explanationLang.value);
});

saveKeyBtn.addEventListener('click', () => {
  localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
  setStatus('Clave guardada ✔', 'listening');
  setTimeout(() => setStatus(''), 2000);
});

function getApiKey() {
  return apiKeyInput.value.trim();
}

// ---------- Clave de API de YouTube (opcional) ----------
const youtubeApiKeyInput = document.getElementById('youtube-api-key');
const saveYoutubeKeyBtn = document.getElementById('save-youtube-key-btn');

const savedYoutubeKey = localStorage.getItem('youtube_api_key');
if (savedYoutubeKey) {
  youtubeApiKeyInput.value = savedYoutubeKey;
}

saveYoutubeKeyBtn.addEventListener('click', () => {
  localStorage.setItem('youtube_api_key', youtubeApiKeyInput.value.trim());
  setStatus('Clave de YouTube guardada ✔', 'listening');
  setTimeout(() => setStatus(''), 2000);
});

// Clave para la API de YouTube: la específica de YouTube o, si no hay,
// la de Gemini (útil si ambas APIs están habilitadas en el mismo proyecto).
function getYouTubeApiKey() {
  return localStorage.getItem('youtube_api_key') || getApiKey();
}

// ---------- Auto-ajuste del textarea objetivo ----------
function autoResizeTargetText() {
  targetText.style.height = 'auto';
  targetText.style.height = Math.min(targetText.scrollHeight, 400) + 'px';
}

// Ajustar al escribir
targetText.addEventListener('input', autoResizeTargetText);

// Ajustar cuando cambia el tamaño de la ventana
window.addEventListener('resize', autoResizeTargetText);

// ---------- Nivel de dificultad ----------
const PHRASES_BY_LEVEL = {
  beginner: [
    { label: 'Saludo', phrase: 'Hello, my name is Ana. Nice to meet you.' },
    { label: 'Presentación', phrase: 'I live in a small house with my family.' },
    { label: 'Comida', phrase: 'I like coffee and bread for breakfast.' },
    { label: 'Rutina', phrase: 'Every day I wake up at seven in the morning.' },
    { label: 'Trabajo', phrase: 'My brother works at a hospital near the park.' },
    { label: 'Clima', phrase: 'It is very hot today, but tomorrow it will rain.' },
    { label: 'Compras', phrase: 'This shirt is too expensive, but I love the color.' },
    { label: 'Fin de semana', phrase: 'On Saturday, I play football with my friends in the park.' },
    { label: 'Mascotas', phrase: 'My cat sleeps on the sofa all afternoon.' },
    { label: 'Viaje', phrase: 'The bus to the city center leaves every ten minutes.' },
    { label: '📄 Párrafo', phrase: 'My name is Ana and I am from Mexico. Every morning, I wake up at seven o\'clock and drink a cup of coffee. Then, I go to work by bus. In the afternoon, I like to read books and listen to music. On weekends, I visit my family and we cook dinner together.' },
    { label: '📄 Párrafo', phrase: 'Tom is a student and he lives near the university. He has classes from Monday to Friday, and he studies in the library after lunch. His favorite subject is history because he loves old stories. In the evening, he plays football with his friends or watches movies at home. On Sundays, he calls his parents and tells them about his week.' }
  ],
  intermediate: [
    { label: 'Frase clásica', phrase: 'The quick brown fox jumps over the lazy dog.' },
    { label: 'Trabalenguas', phrase: 'She sells seashells by the seashore.' },
    { label: 'Reunión', phrase: 'I would like to schedule a meeting for next Thursday afternoon.' },
    { label: 'Direcciones', phrase: 'Could you tell me where the nearest train station is, please?' },
    { label: 'Entrevista', phrase: 'I have been working in marketing for three years, mainly on digital campaigns.' },
    { label: 'Restaurante', phrase: 'Could we see the menu, please? I would like to order the grilled salmon.' },
    { label: 'Opinión', phrase: 'In my opinion, working from home has more advantages than disadvantages.' },
    { label: 'Viaje', phrase: 'The flight was delayed for two hours, so we arrived late at night.' },
    { label: 'Tecnología', phrase: 'Smartphones have completely changed the way we communicate with each other.' },
    { label: 'Planes', phrase: 'If the weather is nice this weekend, we are planning to hike up the mountain.' },
    { label: '📄 Párrafo', phrase: 'Last summer, I decided to take a trip to the coast with two friends. We left early in the morning to avoid traffic, and by noon we were already walking along the beach. The weather was perfect, so we spent most of the day swimming and taking pictures. In the evening, we found a small restaurant near the harbor where we ate fresh fish and watched the sunset. It was one of the best weekends I have ever had.' },
    { label: '📄 Párrafo', phrase: 'Learning a new language takes time, patience, and constant practice. Many people start with a lot of enthusiasm, but they give up after a few months because they do not see immediate results. The secret is to set small, achievable goals: learning five new words a day, watching a short video in English, or having a five-minute conversation. Little by little, those small efforts build up, and one day you realize you are thinking in another language without even noticing.' }
  ],
  advanced: [
    { label: 'Trabalenguas', phrase: 'Sixth sick sheikh\'s sixth sheep\'s sick.' },
    { label: 'Formal', phrase: 'Notwithstanding the committee\'s reservations, the proposal was ratified unanimously.' },
    { label: 'Reunión', phrase: 'Had I been aware of the circumstances, I would have acted differently.' },
    { label: 'Abstracto', phrase: 'The phenomenon underscores the intricate interplay between perception and cognition.' },
    { label: 'Negocios', phrase: 'The quarterly figures suggest a marked deceleration in consumer spending across all segments.' },
    { label: 'Debate', phrase: 'One could argue that such measures, however well-intentioned, may inadvertently exacerbate the very problem they purport to solve.' },
    { label: 'Académico', phrase: 'The study\'s findings, while preliminary, corroborate earlier hypotheses regarding neuroplasticity in adult learners.' },
    { label: 'Literario', phrase: 'The evening light filtered through the ancient oaks, casting long shadows upon the moss-covered stones.' },
    { label: 'Filosofía', phrase: 'Whether consciousness emerges from complexity or precedes it remains one of the most contentious questions in contemporary philosophy.' },
    { label: 'Noticias', phrase: 'Negotiations stalled late Tuesday after both delegations failed to reach a consensus on the disputed border provisions.' },
    { label: '📄 Párrafo', phrase: 'The rapid evolution of artificial intelligence has prompted a profound reevaluation of how societies organize labor, education, and creativity. While optimists envision unprecedented gains in productivity and scientific discovery, skeptics caution against the erosion of privacy and the concentration of technological power. Navigating this tension will require not only robust regulation, but also a collective commitment to ensuring that the benefits of innovation are distributed equitably across all strata of society.' },
    { label: '📄 Párrafo', phrase: 'Climate change represents perhaps the most formidable collective action problem humanity has ever confronted. Its effects are unevenly distributed, disproportionately burdening nations that contributed least to the problem, while the political costs of meaningful mitigation fall on those with the greatest capacity to act. Addressing this paradox demands institutional architectures that transcend electoral cycles, as well as an unprecedented degree of international cooperation sustained across generations.' }
  ]
};

// Mostrar 5 chips aleatorios del nivel (sin repetir los del set anterior)
let lastShownPhrases = new Set();

function pickRandomPhrases(level) {
  const all = PHRASES_BY_LEVEL[level];
  const shuffled = all.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(5, all.length));
}

function renderPhraseChips() {
  const level = difficultyLevel.value;
  phraseChips.innerHTML = '';
  lastShownPhrases.clear();
  pickRandomPhrases(level).forEach(({ label, phrase }) => {
    lastShownPhrases.add(phrase);
    const btn = document.createElement('button');
    btn.className = 'btn chip';
    btn.textContent = label;
    btn.title = phrase;
    btn.addEventListener('click', () => {
      targetText.value = phrase;
      autoResizeTargetText();
    });
    phraseChips.appendChild(btn);
  });
}

// Botón de refrescar: muestra otras frases del mismo nivel
refreshPhrasesBtn.addEventListener('click', () => {
  renderPhraseChips();
});

const savedLevel = localStorage.getItem('difficulty_level');
if (savedLevel) difficultyLevel.value = savedLevel;
difficultyLevel.addEventListener('change', () => {
  localStorage.setItem('difficulty_level', difficultyLevel.value);
  renderPhraseChips();
});
renderPhraseChips();

// ---------- Configuración de Ollama ----------
// Valores por defecto detectados en esta máquina (Ollama con qwen2.5:7b)
const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = 'qwen2.5:7b';

const savedOllamaUrl = localStorage.getItem('ollama_url');
ollamaUrlInput.value = savedOllamaUrl !== null ? savedOllamaUrl : OLLAMA_DEFAULT_URL;
const savedOllamaModel = localStorage.getItem('ollama_model');
const savedOllamaDirect = localStorage.getItem('ollama_direct') === 'true';
if (savedOllamaDirect) ollamaDirectCheckbox.checked = true;

// ---------- Detección automática de modelos de Ollama ----------
const ollamaRefreshModelsBtn = document.getElementById('ollama-refresh-models');
const ollamaModelsStatus = document.getElementById('ollama-models-status');

function setOllamaModelsStatus(message) {
  const statusEl = document.getElementById('ollama-models-status');
  if (statusEl) statusEl.textContent = message || '';
}

function populateOllamaModels(models, selectedModel) {
  ollamaModelInput.innerHTML = '';
  if (!models.length) {
    ollamaModelInput.innerHTML = '<option value="">— No hay modelos instalados —</option>';
    return;
  }
  models.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    ollamaModelInput.appendChild(option);
  });
  // Restaurar el modelo guardado si sigue disponible; si no, usar el primero
  if (selectedModel && models.includes(selectedModel)) {
    ollamaModelInput.value = selectedModel;
  }
  localStorage.setItem('ollama_model', ollamaModelInput.value);
}

async function fetchOllamaModels() {
  const url = ollamaUrlInput.value.trim().replace(/\/+$/, '');
  if (!url) {
    setOllamaModelsStatus('⚠️ Escribe primero la URL de Ollama.');
    return;
  }

  ollamaRefreshModelsBtn.disabled = true;
  setOllamaModelsStatus('🔎 Buscando modelos…');

  try {
    const response = await fetch(url + '/api/tags');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const models = (data.models || []).map((m) => m.name);

    populateOllamaModels(models, ollamaModelInput.value || savedOllamaModel);
    setOllamaModelsStatus(
      models.length
        ? `✅ ${models.length} modelo(s) encontrado(s) en ${url}.`
        : '⚠️ Ollama responde, pero no tiene modelos. Instala uno con: ollama pull llama3.2'
    );
  } catch (error) {
    ollamaModelInput.innerHTML = '<option value="">— Ollama no disponible —</option>';
    setOllamaModelsStatus(
      `❌ No se pudo conectar con Ollama en ${url}. Posibles causas:\n` +
      `1) Ollama no está corriendo → ejecuta "ollama serve".\n` +
      `2) CORS: si abriste index.html con doble clic, Ollama bloquea el origen. Solución: define la variable OLLAMA_ORIGINS=* (o reinicia Ollama con: setx OLLAMA_ORIGINS "*" y vuelve a abrir Ollama).`
    );
  } finally {
    ollamaRefreshBtnFinally();
  }
}

function ollamaRefreshBtnFinally() {
  ollamaRefreshModelsBtn.disabled = false;
}

ollamaRefreshModelsBtn.addEventListener('click', fetchOllamaModels);

// Buscar modelos automáticamente al cambiar la URL (con pequeño retardo)
let ollamaUrlDebounce = null;
ollamaUrlInput.addEventListener('change', () => {
  localStorage.setItem('ollama_url', ollamaUrlInput.value.trim());
  clearTimeout(ollamaUrlDebounce);
  ollamaUrlDebounce = setTimeout(fetchOllamaModels, 400);
});

ollamaModelInput.addEventListener('change', () => {
  localStorage.setItem('ollama_model', ollamaModelInput.value.trim());
});

ollamaDirectCheckbox.addEventListener('change', () => {
  localStorage.setItem('ollama_direct', ollamaDirectCheckbox.checked ? 'true' : 'false');
});

// Carga inicial: poblar el desplegable con los modelos disponibles
populateOllamaModels(savedOllamaModel ? [savedOllamaModel] : [], savedOllamaModel);
if (ollamaUrlInput.value.trim()) {
  fetchOllamaModels();
}

function getOllamaConfig() {
  const url = ollamaUrlInput.value.trim().replace(/\/+$/, '');
  const model = ollamaModelInput.value.trim();
  return url && model ? { url, model } : null;
}

// ---------- Uso de Gemini (contador local por modelo) ----------
// Límites diarios conocidos del plan gratuito (peticiones por día, RPD).
// Fuente: ai.google.dev/pricing — pueden cambiar sin aviso.
const GEMINI_FREE_LIMITS = {
  'gemini-3.8-flash': 200,
  'gemini-3.5-flash-lite': 1000
};

const GEMINI_USAGE_KEY = 'gemini_usage_counter';

function getPacificMidnightReset() {
  // Medianoche en hora del Pacífico (los límites gratuitos se reinician a las 00:00 PST/PDT)
  const now = new Date();
  const pacificNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  );
  const midnight = new Date(pacificNow);
  midnight.setHours(24, 0, 0, 0);
  const msUntilReset = midnight - pacificNow;
  const hours = Math.floor(msUntilReset / 3600000);
  const minutes = Math.floor((msUntilReset % 3600000) / 60000);
  return { hours, minutes };
}

function getGeminiUsage() {
  try {
    const data = JSON.parse(localStorage.getItem(GEMINI_USAGE_KEY) || '{}');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    if (data.date !== today) {
      // Nuevo día en el Pacífico: el contador se reinicia
      return { date: today, counts: {} };
    }
    return data;
  } catch {
    return { date: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }), counts: {} };
  }
}

function recordGeminiUsage(model) {
  const usage = getGeminiUsage();
  usage.counts[model] = (usage.counts[model] || 0) + 1;
  localStorage.setItem(GEMINI_USAGE_KEY, JSON.stringify(usage));
  renderGeminiUsage();
}

function resetGeminiUsage() {
  localStorage.removeItem(GEMINI_USAGE_KEY);
  renderGeminiUsage();
}

function renderGeminiUsage() {
  const list = document.getElementById('gemini-usage-list');
  if (!list) return;

  const usage = getGeminiUsage();
  const { hours, minutes } = getPacificMidnightReset();
  const models = [...new Set([GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL, ...Object.keys(usage.counts)])];

  let html = '';
  models.forEach((model) => {
    const used = usage.counts[model] || 0;
    const limit = GEMINI_FREE_LIMITS[model];
    const limitText = limit ? `${used} / ${limit}` : `${used} / ?`;
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const barColor = pct >= 90 ? '#e05252' : pct >= 70 ? '#e0a832' : '#4caf7d';

    html += `
      <div class="usage-row">
        <div class="usage-row-head">
          <span><code>${model}</code></span>
          <b>${limitText} peticiones</b>
        </div>
        ${limit ? `<div class="usage-bar"><div class="usage-bar-fill" style="width:${pct}%;background:${barColor}"></div></div>` : ''}
      </div>`;
  });

  html += `<p class="usage-reset">⏰ Se reinicia en <b>${hours}h ${minutes}min</b> (medianoche, hora del Pacífico)</p>`;
  list.innerHTML = html;
}

const geminiUsageRefreshBtn = document.getElementById('gemini-usage-refresh');
const geminiUsageResetBtn = document.getElementById('gemini-usage-reset');
if (geminiUsageRefreshBtn) geminiUsageRefreshBtn.addEventListener('click', renderGeminiUsage);
if (geminiUsageResetBtn) {
  geminiUsageResetBtn.addEventListener('click', () => {
    resetGeminiUsage();
    showToast('Contador de uso reiniciado.', 'success');
  });
}

// Actualizar el contador de uso al abrir la app y cada minuto
// (la llamada inicial se hace al final del script, cuando todos los modelos están declarados)
setInterval(renderGeminiUsage, 60000);

// ---------- Estado / mensajes ----------
function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = 'status ' + type;
}

// ---------- Reconocimiento de voz ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  micBtn.disabled = true;
  setStatus('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.', 'error');
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US'; // idioma que se practica
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5; // varias interpretaciones posibles por frase

  // Guardar las alternativas de cada resultado final para elegir
  // la que mejor coincida con el texto objetivo al evaluar.
  let finalAlternatives = [];

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript + ' ';
        // Guardar hasta 5 interpretaciones alternativas de esta frase
        const alts = [];
        for (let k = 0; k < Math.min(5, result.length); k++) {
          alts.push(result[k].transcript);
        }
        finalAlternatives.push(alts);
      } else {
        interim += result[0].transcript;
      }
    }
    liveTranscript.textContent = (finalTranscript + interim).trim();
  };

  // Devolver las alternativas acumuladas (llamado al detener la escucha)
  recognition.getAlternativesSnapshot = () => finalAlternatives.slice();
  recognition.resetAlternatives = () => { finalAlternatives = []; };

  recognition.onend = () => {
    if (isListening) {
      // Chrome corta la escucha cada tanto; reiniciamos para sesión continua
      try { recognition.start(); } catch { /* ya iniciado */ }
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      setStatus('Permiso de micrófono denegado. Habilítalo en el navegador.', 'error');
      stopListening();
    } else if (event.error === 'no-speech') {
      // silencio: se reintenta solo vía onend
    } else if (event.error !== 'aborted') {
      setStatus('Error de reconocimiento: ' + event.error, 'error');
    }
  };
}

micBtn.addEventListener('click', () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

function startListening() {
  if (!recognition) return;
  finalTranscript = '';
  if (recognition.resetAlternatives) recognition.resetAlternatives();
  liveTranscript.textContent = '…';
  transcriptSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');

  isListening = true;
  micBtn.textContent = '⏹ Detener';
  micBtn.classList.remove('primary');
  micBtn.classList.add('accent');
  setStatus('🎧 Escuchando… lee el texto en voz alta y pulsa Detener al terminar.', 'listening');

  try {
    recognition.start();
  } catch {
    /* ya estaba activo */
  }
}

function stopListening() {
  isListening = false;
  micBtn.textContent = '🎤 Empezar a hablar';
  micBtn.classList.remove('accent');
  micBtn.classList.add('primary');
  setStatus('');

  if (recognition) {
    try { recognition.stop(); } catch { /* noop */ }
  }

  const said = finalTranscript.trim();
  if (said) {
    setStatus('Evaluación de pronunciación completa ✔');
    // Evaluación de pronunciación local (inmediata, sin IA).
    // Usa las alternativas del reconocimiento para elegir la interpretación
    // que mejor coincida con el texto objetivo (reduce falsos fallos).
    const alternatives = recognition.getAlternativesSnapshot
      ? recognition.getAlternativesSnapshot()
      : [];
    evaluatePronunciation(targetText.value, said, alternatives);
  } else {
    setStatus('No se detectó voz. Inténtalo de nuevo.', 'error');
  }
}

// ---------- Evaluación de pronunciación (local) ----------
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'’()]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}


// ============================================================
// Evaluador de Pronunciación — app.js
// Reconocimiento de voz (Web Speech API) + análisis con Gemini
// ============================================================

// ============================================================
// PERFILES DE USUARIO (aislamiento de datos por persona)
// Debe ejecutarse antes de cualquier uso de localStorage.
// ============================================================

// Claves que se aíslan por perfil (datos + preferencias de práctica)
const PROFILED_KEYS = [
  'practice_history',
  'translate_history',
  'dict_history',
  'phoneme_history',
  'exercise_results',
  'conv_saved_list',
  'conv_current',
  'practice_streak',
  'srs_deck',
  'gemini_usage_counter',
  'difficulty_level',
  'explanation_lang',
  'phoneme_level',
  'conv_auto_eval'
];

// Claves globales (compartidas entre perfiles): credenciales y ajustes del dispositivo
const GLOBAL_KEYS = ['gemini_api_key', 'ollama_url', 'ollama_model', 'ollama_direct', 'speech_voice'];

const PROFILES_LIST_KEY = 'profiles_list';
const ACTIVE_PROFILE_KEY = 'active_profile';

function readRawStorage(key) {
  return Storage.prototype.getItem.call(localStorage, key);
}

function writeRawStorage(key, value) {
  Storage.prototype.setItem.call(localStorage, key, value);
}

function removeRawStorage(key) {
  Storage.prototype.removeItem.call(localStorage, key);
}

function loadProfilesList() {
  try {
    const list = JSON.parse(readRawStorage(PROFILES_LIST_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveProfilesList(list) {
  writeRawStorage(PROFILES_LIST_KEY, JSON.stringify(list));
}

function getActiveProfile() {
  return readRawStorage(ACTIVE_PROFILE_KEY) || '';
}

function setActiveProfile(name) {
  writeRawStorage(ACTIVE_PROFILE_KEY, name);
}

// Instalado antes de cualquier otro código: prefija las claves de datos
// con el perfil activo (p. ej. "Pablo::practice_history").
const _profileGetItem = Storage.prototype.getItem;
const _profileSetItem = Storage.prototype.setItem;
const _profileRemoveItem = Storage.prototype.removeItem;

Storage.prototype.getItem = function (key) {
  if (typeof key === 'string' && PROFILED_KEYS.includes(key)) {
    return _profileGetItem.call(this, getActiveProfilePrefix() + key);
  }
  return _profileGetItem.call(this, key);
};

Storage.prototype.setItem = function (key, value) {
  if (typeof key === 'string' && PROFILED_KEYS.includes(key)) {
    return _profileSetItem.call(this, getActiveProfilePrefix() + key, value);
  }
  return _profileSetItem.call(this, key, value);
};

Storage.prototype.removeItem = function (key) {
  if (typeof key === 'string' && PROFILED_KEYS.includes(key)) {
    return _profileRemoveItem.call(this, getActiveProfilePrefix() + key);
  }
  return _profileRemoveItem.call(this, key);
};

function getActiveProfilePrefix() {
  const profile = getActiveProfileName();
  return profile ? profile + '::' : '';
}

function getActiveProfileName() {
  return readRawStorage(ACTIVE_PROFILE_KEY) || '';
}

// Garantiza que exista al menos un perfil y uno activo
function ensureDefaultProfile() {
  let list = loadProfilesList();
  if (!list.length) {
    list = ['Principal'];
    writeRawStorage(PROFILES_LIST_KEY, JSON.stringify(list));
  }
  if (!getActiveProfileName() || !list.includes(getActiveProfileName())) {
    writeRawStorage(ACTIVE_PROFILE_KEY, list[0]);
  }
}

// Migración única: mueve los datos pre-perfiles (claves sin prefijo) al
// perfil ACTIVO, para que no se pierda el progreso existente.
// IMPORTANTE: usa los métodos ORIGINALES guardados (_profileGetItem, etc.),
// porque readRawStorage/removeRawStorage resuelven Storage.prototype en tiempo
// de llamada y aquí ya están envueltos por el sistema de perfiles.
function migrateLegacyDataToFirstProfile() {
  const active = getActiveProfileName();
  if (!active) return;
  const prefix = active + '::';

  PROFILED_KEYS.forEach((key) => {
    const legacyValue = _profileGetItem.call(localStorage, key);
    if (legacyValue === null) return; // no había datos antiguos
    const prefixedValue = _profileGetItem.call(localStorage, prefix + key);
    if (prefixedValue === null) {
      // Solo migrar si el perfil no tiene ya datos propios
      _profileSetItem.call(localStorage, prefix + key, legacyValue);
    }
    _profileRemoveItem.call(localStorage, key); // limpiar la clave antigua
  });
}

ensureDefaultProfile();
migrateLegacyDataToFirstProfile();

// ---------- Referencias al DOM ----------
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key-btn');
const targetText = document.getElementById('target-text');
const micBtn = document.getElementById('mic-btn');
const statusEl = document.getElementById('status');
const transcriptSection = document.getElementById('transcript-section');
const liveTranscript = document.getElementById('live-transcript');
const resultsSection = document.getElementById('results-section');

const pronScore = document.getElementById('pron-score');
const pronSummary = document.getElementById('pron-summary');
const wordComparison = document.getElementById('word-comparison');
const explanationLang = document.getElementById('explanation-lang');

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

// Similitud entre dos palabras (0 a 1) usando distancia de Levenshtein
function wordSimilarity(a, b) {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // borrado
        dp[i][j - 1] + 1,       // inserción
        dp[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// Umbral de similitud para contar una palabra como "casi bien"
const CLOSE_SIMILARITY_THRESHOLD = 0.75;

// Alineación de palabras (distancia de edición a nivel de palabra)
function alignWords(expected, actual) {
  const m = expected.length;
  const n = actual.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const ops = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(''));

  for (let i = 0; i <= m; i++) { dp[i][0] = i; ops[i][0] = 'del'; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; ops[0][j] = 'ins'; }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = 'ok';
      } else {
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        // Sustitución "barata" si las palabras son casi iguales (fuzzy)
        const similarity = wordSimilarity(expected[i - 1], actual[j - 1]);
        const subCost = similarity >= CLOSE_SIMILARITY_THRESHOLD ? 0.4 : 1;
        const sub = dp[i - 1][j - 1] + subCost;
        const min = Math.min(del, ins, sub);
        dp[i][j] = min;
        ops[i][j] = min === sub ? 'sub' : min === del ? 'del' : 'ins';
      }
    }
  }

  // Reconstruir el camino óptimo
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === 'ok' || op === 'sub') {
      const similarity = wordSimilarity(expected[i - 1], actual[j - 1]);
      const status = op === 'ok'
        ? 'ok'
        : similarity >= CLOSE_SIMILARITY_THRESHOLD ? 'close' : 'miss';
      out.unshift({ word: actual[j - 1], expected: expected[i - 1], status, similarity });
      i--; j--;
    } else if (op === 'del') {
      out.unshift({ word: '—', expected: expected[i - 1], status: 'miss' });
      i--;
    } else {
      out.unshift({ word: actual[j - 1], expected: null, status: 'extra' });
      j--;
    }
  }
  return out;
}

// Elegir la interpretación (alternativa del reconocimiento) que mejor
// coincida con el texto objetivo. Devuelve el texto a evaluar.
function pickBestTranscript(expectedText, saidText, alternatives) {
  const expected = normalize(expectedText);
  if (!expected.length) return saidText;

  // Candidatos: la transcripción principal + todas las alternativas
  const candidates = [saidText];
  (alternatives || []).forEach((alts) => {
    alts.forEach((alt) => {
      if (alt && alt.trim()) candidates.push(alt.trim());
    });
  });

  let bestText = saidText;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const said = normalize(candidate);
    if (!said.length) continue;
    const alignment = alignWords(expected, said);
    // Puntuar: ok = 1, close = 0.6, extra penaliza
    let score = 0;
    alignment.forEach((w) => {
      if (w.status === 'ok') score += 1;
      else if (w.status === 'close') score += 0.6;
      else if (w.status === 'extra') score -= 0.5;
    });
    if (score > bestScore) {
      bestScore = score;
      bestText = candidate;
    }
  }
  return bestText;
}

function evaluatePronunciation(expectedText, saidText, alternatives = []) {
  const expected = normalize(expectedText);

  if (!expected.length) return;

  // Elegir la interpretación del reconocimiento que mejor coincida
  const bestSaidText = pickBestTranscript(expectedText, saidText, alternatives);
  const said = normalize(bestSaidText);

  if (!said.length) return;

  const alignment = alignWords(expected, said);
  const correct = alignment.filter((w) => w.status === 'ok').length;
  const close = alignment.filter((w) => w.status === 'close').length;
  const score = Math.round(((correct + close * 0.6) / expected.length) * 100);

  pronScore.textContent = score;
  pronScore.className = 'score-circle ' + scoreClass(score);

  const missed = alignment.filter((w) => w.status === 'miss').map((w) => w.expected);
  const closeWords = alignment.filter((w) => w.status === 'close').map((w) => w.expected);
  let summary;
  if (!missed.length && !closeWords.length) {
    summary = `¡Perfecto! Dijiste correctamente las ${expected.length} palabras.`;
  } else {
    const parts = [];
    if (closeWords.length) parts.push(`casi bien: ${closeWords.join(', ')}`);
    if (missed.length) parts.push(`con problemas: ${missed.join(', ')}`);
    summary = `Dijiste ${correct} de ${expected.length} palabras correctamente (${parts.join(' · ')}).`;
  }
  pronSummary.textContent = summary;

  // Alimentar el mazo de repaso (SRS): las "casi" no entran al mazo,
  // las falladas sí; las correctas suben de nivel.
  missed.forEach((word) => recordMissedWord(word));
  alignment.filter((w) => w.status === 'ok').forEach((w) => recordHitWord(w.expected));

  wordComparison.innerHTML = '';
  alignment.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'word ' + w.status;
    span.textContent = w.status === 'miss' && w.word === '—' ? w.expected : w.word;
    span.title =
      w.status === 'ok' ? 'Correcta' :
      w.status === 'close' ? `Casi: dijiste "${w.word}" (esperado: "${w.expected}")` :
      w.status === 'miss' ? (w.word === '—' ? `No dijiste: "${w.expected}"` : `Dijiste "${w.word}" en lugar de "${w.expected}"`) :
      `Palabra extra: "${w.word}"`;
    // Clic en la palabra: popup con audio y traducción
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const clean = span.textContent.replace(/[.,!?;:"']/g, '');
      if (clean) showWordPopup(clean, span);
    });
    wordComparison.appendChild(span);
  });
}

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

// ---------- Evaluación con Gemini ----------
const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite'; // modelo de respaldo (más ligero, disponible para proyectos nuevos)

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Detecta si un error es por alta demanda / saturación temporal
function isHighDemandError(message) {
  const msg = (message || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('try again later') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('429')
  );
}

// ---------- Insignia de modelo usado ----------
// Registra qué modelo respondió la última llamada a IA y muestra una
// insignia "🤖 Modelo: X" debajo del resultado de cada actividad.
let lastModelUsed = '';

function setLastModelUsed(model) {
  lastModelUsed = model;
}

function modelBadgeHtml() {
  if (!lastModelUsed) return '';
  return `<div class="model-badge">🤖 Modelo: ${escapeHtml(lastModelUsed)}</div>`;
}

// Inserta (o actualiza) la insignia de modelo dentro de un contenedor
function renderModelBadge(container) {
  if (!container) return;
  let badge = container.querySelector(':scope > .model-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'model-badge';
    container.appendChild(badge);
  }
  badge.textContent = '🤖 Modelo: ' + (lastModelUsed || 'desconocido');
}

// Llamada centralizada a Gemini con reintentos y modelo de respaldo.
// Si Gemini no está disponible (sin internet, saturado, etc.), intenta con Ollama local.
// Devuelve el texto de respuesta y avisa (toast) si usó un respaldo.
async function callGemini(prompt, apiKey, options = {}) {
  const { temperature = 0.2, jsonMode = true } = options;

  // Modo "Ollama directo": saltarse Gemini por completo
  if (ollamaDirectCheckbox.checked) {
    const ollama = getOllamaConfig();
    if (!ollama) {
      throw new Error('Ollama directo activado, pero falta configurar URL o modelo de Ollama.');
    }
    setLastModelUsed('Ollama: ' + ollama.model);
    return await callOllama(prompt, ollama, { temperature, jsonMode });
  }

  const modelsToTry = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey // la key va en el header, no en la URL
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err.error?.message || `HTTP ${response.status}`;
        // Si es alta demanda, probar con el siguiente modelo (fallback)
        if (isHighDemandError(message) && model !== GEMINI_FALLBACK_MODEL) {
          showToast('⚠️ Modelo principal saturado. Usando modelo de respaldo…', 'warning');
          continue;
        }
        throw new Error(message);
      }

      const data = await response.json();
      recordGeminiUsage(model); // registrar uso para el contador de cuota
      setLastModelUsed(model);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } catch (error) {
      lastError = error;
      // Si no es error de alta demanda, no tiene sentido probar el fallback
      if (!isHighDemandError(error.message)) break;
    }
  }

  // Último recurso: Ollama local (funciona sin internet)
  const ollama = getOllamaConfig();
  if (ollama) {
    try {
      showToast('📴 Sin conexión con Gemini. Usando Ollama local…', 'warning');
      setLastModelUsed('Ollama: ' + ollama.model);
      return await callOllama(prompt, ollama, { temperature, jsonMode });
    } catch (ollamaError) {
      throw new Error(
        `Gemini: ${lastError?.message || 'no disponible'}. Ollama: ${ollamaError.message}`
      );
    }
  }

  throw lastError || new Error('No se pudo contactar a Gemini.');
}

// Llamada a Ollama local (API de chat en http://localhost:11434)
async function callOllama(prompt, { url, model }, { temperature = 0.2, jsonMode = true } = {}) {
  const response = await fetch(url + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: jsonMode ? 'json' : undefined,
      options: { temperature }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.response || '';
}

const LEVEL_NAMES = { beginner: 'beginner (A1-A2)', intermediate: 'intermediate (B1-B2)', advanced: 'advanced (C1-C2)' };

// ============================================================
// SÍNTESIS DE VOZ (escuchar la frase/párrafo objetivo)
// ============================================================
const speakBtn = document.getElementById('speak-btn');
const stopSpeakBtn = document.getElementById('stop-speak-btn');
const speechRateSelect = document.getElementById('speech-rate');
const voiceSelect = document.getElementById('voice-select');

// ---------- Selector de voces ----------
function populateVoices() {
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => v.lang.startsWith('en'));

  // Conservar la opción por defecto y la selección guardada
  const savedVoice = localStorage.getItem('speech_voice') || '';
  voiceSelect.innerHTML = '<option value="">Voz del sistema por defecto</option>';

  englishVoices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    // Etiqueta: nombre + origen (Online = voces naturales de Edge)
    const isNatural = /natural|online/i.test(voice.name);
    option.textContent = (isNatural ? '⭐ ' : '') + voice.name + ' (' + voice.lang + ')';
    voiceSelect.appendChild(option);
  });

  if (savedVoice) voiceSelect.value = savedVoice;
}

voiceSelect.addEventListener('change', () => {
  localStorage.setItem('speech_voice', voiceSelect.value);
});

function getSelectedVoice() {
  const voices = window.speechSynthesis.getVoices();
  const savedVoice = voiceSelect.value;
  if (savedVoice) {
    const found = voices.find((v) => v.name === savedVoice);
    if (found) return found;
  }
  // Respaldo: primera voz en inglés disponible
  return voices.find((v) => v.lang.startsWith('en')) || null;
}

function speakTargetText() {
  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }

  window.speechSynthesis.cancel(); // cancelar cualquier lectura previa

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = parseFloat(speechRateSelect.value) || 1;

  // Usar la voz elegida en Configuración (o una voz en inglés por defecto)
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  }

  utterance.onend = () => {
    speakBtn.disabled = false;
    stopSpeakBtn.disabled = true;
  };

  speakBtn.disabled = true;
  stopSpeakBtn.disabled = false;
  window.speechSynthesis.speak(utterance);
}

speakBtn.addEventListener('click', speakTargetText);

stopSpeakBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  speakBtn.disabled = false;
  stopSpeakBtn.disabled = true;
});

// Inicialmente los botones de detener deshabilitados
stopSpeakBtn.disabled = true;

// Precargar voces (algunas plataformas las cargan de forma asíncrona)
if (window.speechSynthesis) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

// ---------- Probador de voz (Configuración) ----------
const voiceTestBtn = document.getElementById('voice-test-btn');
const voiceTestStopBtn = document.getElementById('voice-test-stop-btn');
const voiceTestText = document.getElementById('voice-test-text');

function speakTestPhrase() {
  const text = voiceTestText.value.trim();
  if (!text) {
    showToast('Escribe una frase para probar la voz.', 'warning');
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = parseFloat(speechRateSelect.value) || 1;

  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.onend = () => {
    voiceTestBtn.disabled = false;
    voiceTestStopBtn.disabled = true;
  };

  voiceTestBtn.disabled = true;
  voiceTestStopBtn.disabled = false;
  window.speechSynthesis.speak(utterance);
}

voiceTestBtn.addEventListener('click', speakTestPhrase);

voiceTestStopBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
  voiceTestBtn.disabled = false;
  voiceTestStopBtn.disabled = true;
});

voiceTestStopBtn.disabled = true;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// ============================================================
// MODO CONVERSACIÓN LIBRE
// ============================================================

// Reconocimiento de voz independiente para conversación
const convSpeech = window.SpeechRecognition || window.webkitSpeechRecognition;

if (convSpeech) {
  convRecognition = new convSpeech();
  convRecognition.lang = 'en-US';
  convRecognition.continuous = true;
  convRecognition.interimResults = true;

  convRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        convFinalTranscript += result[0].transcript + ' ';
      } else {
        interim += result[0].transcript;
      }
    }
    convLiveTranscript.textContent = (convFinalTranscript + interim).trim();
  };

  convRecognition.onend = () => {
    if (convIsListening) {
      try { convRecognition.start(); } catch { /* ya iniciado */ }
    }
  };

  convRecognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      setConvStatus('Permiso de micrófono denegado.', 'error');
      stopConvListening();
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      setConvStatus('Error: ' + event.error, 'error');
    }
  };
} else {
  convMicBtn.disabled = true;
}

// ---------- Campo de texto del modo chat (en el dock, siempre visible) ----------
const convChatRow = document.getElementById('conv-chat-row');
const convChatInput = document.getElementById('conv-chat-input');
const convChatSend = document.getElementById('conv-chat-send');

function updateConvDockForMode() {
  const isChat = convModeSelect.value === 'chat';
  convChatRow.classList.toggle('hidden', !isChat);
  convMicBtn.classList.toggle('hidden', isChat); // en chat no hace falta el micrófono
  if (isChat) convChatInput.focus();
}

convModeSelect.addEventListener('change', updateConvDockForMode);

function sendConvChat() {
  const text = convChatInput.value.trim();
  if (!text) return;
  convChatInput.value = '';
  sendConversationMessage(text);
}

convChatSend.addEventListener('click', sendConvChat);
convChatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendConvChat();
  }
});

convMicBtn.addEventListener('click', () => {
  if (convIsListening) {
    stopConvListening();
  } else {
    startConvListening();
  }
});

convClearBtn.addEventListener('click', () => {
  oralSpeechCancelled = true; // no reactivar el micrófono al cancelar la voz
  window.speechSynthesis.cancel();
  conversationHistory = [];
  convMessages.innerHTML = '';
  convFinalTranscript = '';
  convLastAudio = null; // descartar el audio de la intervención anterior
  convTranscriptSection.classList.add('hidden');
  convPronSection.classList.add('hidden');
  convEvalBtn.classList.add('hidden');
  localStorage.removeItem(CONV_CURRENT_KEY); // limpiar el auto-guardado
  setConvStatus('Nueva conversación lista. ¡Empieza a hablar en inglés!');
});

function setConvStatus(message, type = '') {
  convStatus.textContent = message;
  convStatus.className = 'status ' + type;
}

function startConvListening() {
  if (!convRecognition) return;
  convFinalTranscript = '';
  convLiveTranscript.textContent = '…';
  convTranscriptSection.classList.remove('hidden');

  convIsListening = true;
  convMicBtn.textContent = '⏹ Detener';
  convMicBtn.classList.remove('primary');
  convMicBtn.classList.add('accent');
  setConvStatus('🎧 Escuchando… habla libremente y pulsa Detener al terminar.', 'listening');

  startConvWavRecording(); // grabar el audio para evaluar pronunciación después
  try { convRecognition.start(); } catch { /* ya activo */ }
}

function stopConvListening() {
  convIsListening = false;
  convMicBtn.textContent = '🎤 Empezar a hablar';
  convMicBtn.classList.remove('accent');
  convMicBtn.classList.add('primary');
  setConvStatus('');

  if (convRecognition) {
    try { convRecognition.stop(); } catch { /* noop */ }
  }

  stopConvWavRecording(); // cerrar la grabación y guardar el WAV

  const said = convFinalTranscript.trim();
  if (said) {
    sendConversationMessage(said);
    recordActivitySession('conversation'); // la intervención oral cuenta para el seguimiento
    // Auto-evaluación: si está activada, evaluar la pronunciación sin pulsar el botón
    if (convAutoEval.checked && convLastAudio) {
      evaluateConvPronunciation();
    }
  } else {
    setConvStatus('No se detectó voz. Inténtalo de nuevo.', 'error');
  }
}

// ---------- Grabación WAV de la conversación (para evaluar pronunciación) ----------
// Graba en paralelo mientras el reconocimiento de voz escucha, para poder
// enviar el audio a Gemini y evaluar la pronunciación de la intervención.
let convWavRecording = null;
let convLastAudio = null; // último WAV grabado en la conversación

async function startConvWavRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];

    processor.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    convWavRecording = { ctx, stream, source, processor, chunks, sampleRate: ctx.sampleRate };
  } catch {
    // Si falla el micrófono para WAV, la conversación oral sigue funcionando
    // (el reconocimiento de voz tiene su propio acceso al micrófono).
  }
}

function stopConvWavRecording() {
  if (!convWavRecording) return;
  const { ctx, stream, source, processor, chunks, sampleRate } = convWavRecording;
  convWavRecording = null;

  try { processor.disconnect(); } catch { /* noop */ }
  try { source.disconnect(); } catch { /* noop */ }
  if (stream) stream.getTracks().forEach((track) => track.stop());
  try { ctx.close(); } catch { /* noop */ }

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const blob = encodeWavFromFloat32(merged, sampleRate);
  if (blob.size > 44) {
    convLastAudio = blob;
    convEvalBtn.classList.remove('hidden');
  }
}

// ---------- Evaluación de pronunciación de la conversación (IA) ----------
// Envía el audio de la última intervención a Gemini y muestra puntuación,
// palabras mal pronunciadas y consejos, igual que en la pestaña de práctica.
const CONV_EVAL_PROMPT = (said, explanationLang, level) =>
  `You are an expert English pronunciation coach for Spanish-speaking students. ` +
  `The student said this during a free conversation (browser speech recognition heard): "${said}". ` +
  `Listen to the attached audio recording of the student and:\n` +
  `1. Transcribe EXACTLY what you hear (word by word).\n` +
  `2. Identify which words were mispronounced (the student is a Spanish speaker at ${level} level).\n` +
  `3. Score pronunciation 0-100 based on clarity and accuracy.\n` +
  `4. Give 2-3 short, actionable pronunciation tips.\n` +
  (explanationLang === 'en'
    ? `Write "tips" and "summary" in ENGLISH.`
    : `Write "tips" and "summary" in SPANISH.`) +
  `\nReply ONLY with valid JSON: {
  "transcript": "what you heard",
  "score": 0-100,
  "mispronounced": [{ "expected": "...", "heard": "...", "tip": "..." }],
  "tips": ["...", "..."]
}`;

async function evaluateConvPronunciation() {
  const key = getApiKey();

  if (!key) {
    showToast('Configura tu clave de API en Configuración.', 'warning');
    return;
  }
  if (!convLastAudio) {
    showToast('Primero graba tu voz con 🎤 Empezar a hablar.', 'warning');
    return;
  }

  convEvalBtn.disabled = true;
  setConvStatus('🤖 Analizando tu pronunciación…');

  try {
    const prompt = CONV_EVAL_PROMPT(
      convFinalTranscript.trim() || '(sin transcripción del navegador)',
      explanationLang.value,
      difficultyLevel.value
    );
    const text = await callGeminiWithAudio(prompt, convLastAudio, key, { temperature: 0.2, jsonMode: true });
    const result = JSON.parse(text);

    const score = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
    convPronScore.textContent = score;
    convPronScore.className = 'score-circle ' + scoreClass(score);

    const mispronounced = result.mispronounced || [];
    convPronSummary.textContent = mispronounced.length
      ? `IA escuchó: "${result.transcript}". Palabras a mejorar: ${mispronounced.map((m) => m.expected).join(', ')}.`
      : `IA escuchó: "${result.transcript}". ¡Pronunciación excelente!`;

    convPronTips.innerHTML = '';
    (result.tips || []).forEach((tip) => {
      const li = document.createElement('li');
      li.textContent = tip;
      convPronTips.appendChild(li);
    });

    // Alimentar el mazo SRS con las palabras que la IA detectó mal
    (result.mispronounced || []).forEach((m) => recordMissedWord(m.expected));

    // Guardar en historial: la puntuación de pronunciación de la
    // conversación alimenta también la sección de Progreso
    addHistoryEntry({
      mode: 'conversación (pronunciación)',
      text: convFinalTranscript.trim() || result.transcript || '',
      level: difficultyLevel.value,
      scores: {
        pronunciation: score
      },
      corrections: mispronounced.length
    });

    convPronSection.classList.remove('hidden');
    renderModelBadge(convPronSection);
    setConvStatus('✔ Evaluación de pronunciación completada.');
  } catch (error) {
    setConvStatus('❌ Error: ' + error.message, 'error');
  } finally {
    convEvalBtn.disabled = false;
  }
}

convEvalBtn.addEventListener('click', evaluateConvPronunciation);

async function sendConversationMessage(userText) {
  const key = getApiKey();
  if (!key) {
    setConvStatus('Primero guarda tu clave de API de Gemini.', 'error');
    return;
  }

  // Mostrar mensaje del usuario
  addMessage('user', userText);
  conversationHistory.push({ role: 'user', text: userText });
  setConvStatus('🤖 Pensando…');

  const langInstruction = explanationLang.value === 'en'
    ? 'Write "corrections" explanations in ENGLISH.'
    : 'Write "corrections" explanations in SPANISH.';

  const historyText = conversationHistory
    .map((m) => {
      if (m.role === 'system') return `SYSTEM INSTRUCTION: ${m.text}`;
      return `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.text}`;
    })
    .join('\n');

  const level = difficultyLevel.value;
  const levelInstruction = level === 'beginner'
    ? 'The student is a BEGINNER: use simple vocabulary and short sentences in your reply.'
    : level === 'advanced'
      ? 'The student is ADVANCED: use rich, natural vocabulary and complex structures.'
      : 'The student is INTERMEDIATE: use clear, natural language.';

  const prompt = `You are a friendly English conversation tutor. The student level is ${level}. ${levelInstruction} Chat with the student in English, keeping responses short (2-4 sentences) and asking a follow-up question to keep the conversation going.

Conversation so far:
${historyText}

The student just said: "${userText}"

Respond ONLY with valid JSON, no markdown fences:
{
  "reply": "your conversational reply in English",
  "corrections": [ { "original": "...", "correction": "...", "explanation": "..." } ],
  "grammar": { "score": 0-100, "summary": "one short sentence about the student's grammar in this turn" },
  "vocabulary": { "score": 0-100, "summary": "one short sentence about the student's vocabulary in this turn" }
}
Only include real grammar/vocabulary mistakes in "corrections" (ignore speech recognition artifacts). If none, use an empty array. ${langInstruction}`;

  try {
    const text = await callGemini(prompt, key, { temperature: 0.7, jsonMode: true });
    const result = JSON.parse(text);

    addMessage('assistant', result.reply || '…', result.corrections || [], {
      grammar: result.grammar || null,
      vocabulary: result.vocabulary || null
    });
    conversationHistory.push({ role: 'assistant', text: result.reply || '' });
    setConvStatus('');

    // Modo oral: leer la respuesta en voz alta con la voz configurada
    if (convModeSelect.value === 'oral') {
      speakAssistantReply(result.reply || '…');
    }

    // Guardar en historial (conversación: gramática y vocabulario)
    addHistoryEntry({
      mode: 'conversación',
      text: userText,
      level: difficultyLevel.value,
      scores: {
        grammar: Math.round(result.grammar?.score ?? 0) || null,
        vocabulary: Math.round(result.vocabulary?.score ?? 0) || null
      },
      corrections: (result.corrections || []).length
    });
  } catch (error) {
    setConvStatus('Error: ' + error.message, 'error');
  }
}

function addMessage(role, text, corrections = [], scores = null) {
  const div = document.createElement('div');
  div.className = 'message ' + (role === 'user' ? 'user' : 'assistant');

  const roleLabel = role === 'user' ? 'Tú' : 'Tutor IA';
  let html = `<div class="message-role">${role === 'user' ? 'Tú' : 'Tutor'}</div>
    <div class="message-text">${escapeHtml(text)}</div>`;

  if (corrections.length) {
    const items = corrections.map((c) =>
      `<div>❌ <em>${escapeHtml(c.original)}</em> → <span class="suggestion">✅ ${escapeHtml(c.correction)}</span>
       <div class="hint">${escapeHtml(c.explanation)}</div></div>`
    ).join('');
    html += `<div class="message-corrections">${items}</div>`;
  }

  // Puntuaciones de gramática y vocabulario de este turno (solo tutor)
  if (scores && (scores.grammar || scores.vocabulary)) {
    const chips = [];
    if (scores.grammar?.score != null) {
      chips.push(`<span class="turn-score">📚 Gramática: <b class="${scoreClass(scores.grammar.score)}">${Math.round(scores.grammar.score)}</b></span>`);
    }
    if (scores.vocabulary?.score != null) {
      chips.push(`<span class="turn-score">💡 Vocabulario: <b class="${scoreClass(scores.vocabulary.score)}">${Math.round(scores.vocabulary.score)}</b></span>`);
    }
    html += `<div class="message-scores">${chips.join('')}</div>`;
  }

  // Insignia del modelo que generó la respuesta (solo tutor)
  if (role !== 'user' && lastModelUsed) {
    html += `<div class="model-badge">🤖 Modelo: ${escapeHtml(lastModelUsed)}</div>`;
  }

  div.innerHTML = html;
  convMessages.appendChild(div);
  convMessages.scrollTop = convMessages.scrollHeight;

  // Hacer clickeables las palabras del mensaje (audio + traducción)
  enableWordClicks(div.querySelector('.message-text'));
}

// ---------- Modo oral: leer la respuesta del tutor en voz alta ----------
let oralSpeechCancelled = false; // evita re-escuchar cuando el usuario detiene la voz manualmente

function speakAssistantReply(text) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = parseFloat(speechRateSelect.value) || 1;

  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }

  utterance.onstart = () => {
    setConvStatus('🗣️ El tutor está hablando…');
  };

  utterance.onend = () => {
    if (oralSpeechCancelled) {
      oralSpeechCancelled = false;
      return;
    }
    setConvStatus('');
    // Modo oral continuo: volver a escuchar automáticamente para seguir conversando
    if (convModeSelect.value === 'oral' && convRecognition) {
      startConvListening();
    }
  };

  window.speechSynthesis.speak(utterance);
}

// ============================================================
// TRADUCCIÓN
// ============================================================

translateBtn.addEventListener('click', async () => {
  const key = getApiKey();
  const source = translateSource.value.trim();

  if (!key) {
    setTranslateStatus('Primero guarda tu clave de API de Gemini.', 'error');
    return;
  }
  if (!source) {
    setTranslateStatus('Escribe el texto a traducir.', 'error');
    return;
  }

  translateBtn.disabled = true;
  setTranslateStatus('🌍 Traduciendo…');

  const [from, to] = translateDirection.value.split('-');
  const langNames = { en: 'English', es: 'Spanish' };

  const prompt = `Translate the following text from ${langNames[from]} to ${langNames[to]}.
Return ONLY the translation, nothing else. Keep the tone and register of the original.`;

  try {
    const translated = (
      await callGemini(prompt + '\n\nTEXT:\n' + source, key, { temperature: 0.1, jsonMode: false })
    ).trim();
    translateResult.value = translated;
    renderModelBadge(document.getElementById('translate-model-badge'));
    setTranslateStatus('Traducción lista ✔');

    // Guardar en el historial de traducciones
    const directionLabels = { 'en-es': 'EN → ES', 'es-en': 'ES → EN' };
    addLookupEntry(TRANSLATE_HISTORY_KEY, {
      source,
      translated,
      direction: directionLabels[translateDirection.value] || translateDirection.value,
      directionValue: translateDirection.value,
      date: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    });
    renderTranslateHistory();
    recordActivitySession('translate');
  } catch (error) {
    setTranslateStatus('Error: ' + error.message, 'error');
  } finally {
    translateBtn.disabled = false;
  }
});

function setTranslateStatus(message, type = '') {
  translateStatus.textContent = message;
  translateStatus.className = 'status ' + type;
}

// ============================================================
// HISTORIAL DE TRADUCCIONES Y BÚSQUEDAS DEL DICCIONARIO
// Módulo genérico reutilizable (localStorage, límite 50 entradas)
// ============================================================

const LOOKUP_HISTORY_LIMIT = 50;

function getLookupHistory(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function addLookupEntry(storageKey, entry) {
  const list = getLookupHistory(storageKey);
  // Evitar duplicados consecutivos (mismo texto y misma dirección)
  const isDuplicate = list[0] && JSON.stringify(list[0]) === JSON.stringify(entry);
  if (isDuplicate) return list;
  list.unshift(entry);
  if (list.length > LOOKUP_HISTORY_LIMIT) list.length = LOOKUP_HISTORY_LIMIT;
  try {
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch { /* almacenamiento lleno: ignorar */ }
  return list;
}

function clearLookupHistory(storageKey) {
  localStorage.removeItem(storageKey);
}

// ---------- Historial de traducciones ----------
const translateHistoryList = document.getElementById('translate-history-list');
const translateHistoryClearBtn = document.getElementById('translate-history-clear-btn');
const TRANSLATE_HISTORY_KEY = 'translate_history';

function renderTranslateHistory() {
  const list = getLookupHistory(TRANSLATE_HISTORY_KEY);
  translateHistoryList.innerHTML = '';

  if (!list.length) {
    translateHistoryList.innerHTML = '<p class="hint">Aún no hay traducciones guardadas.</p>';
    return;
  }

  list.forEach((entry) => {
    const item = document.createElement('button');
    item.className = 'history-entry';
    item.innerHTML =
      `<span class="entry-direction">${escapeHtml(entry.direction)}</span>` +
      `<span class="entry-source">${escapeHtml(entry.source)}</span>` +
      `<span class="entry-result">${escapeHtml(entry.translated)}</span>` +
      `<span class="entry-date">${escapeHtml(entry.date)}</span>`;
    item.addEventListener('click', () => {
      // Reutilizar la entrada: rellenar los campos y la dirección
      translateSource.value = entry.source;
      translateResult.value = entry.translated;
      const option = Array.from(translateDirection.options).find(
        (opt) => opt.value === entry.directionValue
      );
      if (option) translateDirection.value = entry.direction;
      translateHistoryList.querySelectorAll('.entry-direction, .entry-source, .entry-result')
        .forEach((el) => el.classList.remove('highlight'));
      item.classList.add('active');
    });
    translateHistoryList.appendChild(item);
  });
}

translateHistoryClearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar el historial de traducciones?')) {
    clearLookupHistory(TRANSLATE_HISTORY_KEY);
    renderTranslateHistory();
    showToast('Historial de traducciones vaciado.', 'info');
  }
});

// ---------- Historial de búsquedas del diccionario ----------
const dictHistoryList = document.getElementById('dict-history-list');
const dictHistoryClearBtn = document.getElementById('dict-history-clear-btn');
const DICT_HISTORY_KEY = 'dict_history';

function renderDictHistory() {
  const list = getLookupHistory(DICT_HISTORY_KEY);
  dictHistoryList.innerHTML = '';

  if (!list.length) {
    dictHistoryList.innerHTML = '<p class="hint">Aún no hay palabras buscadas.</p>';
    return;
  }

  list.forEach((entry) => {
    const chip = document.createElement('button');
    chip.className = 'btn chip';
    chip.innerHTML =
      `<span class="chip-word">${escapeHtml(entry.word)}</span>` +
      (entry.translation ? `<span class="chip-translation">${escapeHtml(entry.translation)}</span>` : '');
    chip.addEventListener('click', () => {
      dictSearchInput.value = entry.word;
      searchDictionary();
    });
    dictHistoryList.appendChild(chip);
  });
}

dictHistoryClearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar el historial de búsquedas del diccionario?')) {
    clearLookupHistory(DICT_HISTORY_KEY);
    renderDictHistory();
    showToast('Historial de búsquedas vaciado.', 'info');
  }
});

// ============================================================
// HISTORIAL DE PRÁCTICA
// ============================================================

// ============================================================
// NOTIFICACIONES (toast)
// ============================================================

const HISTORY_LIMIT = 100;
const HISTORY_WARNING = 90; // avisar a partir de esta cantidad

function showToast(message, type = 'info', duration = 5000) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// ============================================================
// HISTORIAL DE PRÁCTICA
// ============================================================

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('practice_history') || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem('practice_history', JSON.stringify(history));
}

function addHistoryEntry(entry) {
  const history = loadHistory();
  history.unshift({ ...entry, date: new Date().toISOString() });

  // Avisar cuando se acerca al límite
  if (history.length === HISTORY_WARNING) {
    showToast(`⚠️ Tu historial tiene ${HISTORY_WARNING} sesiones (límite: ${HISTORY_LIMIT}). Considera exportarlo para no perder datos.`, 'warning');
  }

  // Limitar a 100 entradas: se elimina la más antigua
  let removed = 0;
  while (history.length > HISTORY_LIMIT) {
    history.pop();
    removed++;
  }
  if (removed > 0) {
    showToast(`🗑️ Historial lleno (${HISTORY_LIMIT}). Se eliminó la sesión más antigua. Exporta tus datos para conservarlos.`, 'warning');
  }

  saveHistory(history);
}

// Exportar historial a JSON
historyExportBtn.addEventListener('click', () => {
  const history = loadHistory();
  if (!history.length) {
    showToast('No hay sesiones para exportar.', 'warning');
    return;
  }

  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial-practica-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Historial exportado ✔', 'success');
});

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = '<p class="hint">Aún no hay sesiones guardadas. ¡Haz tu primera práctica!</p>';
    return;
  }

  history.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

    let scoresHtml = '';
    if (entry.scores) {
      const s = entry.scores;
      scoresHtml = `
        <span class="history-score">🔊 Pronunciación: <b>${s.pronunciation ?? '--'}</b></span>
        <span class="history-score">📚 Gramática: <b>${s.grammar ?? '--'}</b></span>
        <span class="history-score">💡 Vocabulario: <b>${s.vocabulary ?? '--'}</b></span>`;
    } else if (entry.corrections != null) {
      scoresHtml = `<span class="history-score">✏️ Correcciones: <b>${entry.corrections}</b></span>`;
    }

    const LEVEL_LABELS = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
    const levelBadge = entry.level
      ? `<span class="history-mode" title="Nivel">${LEVEL_LABELS[entry.level] || ''} ${escapeHtml(entry.level)}</span>`
      : '';

    div.innerHTML = `
      <div class="history-head">
        <span class="history-mode">${escapeHtml(entry.mode)}</span>
        ${levelBadge}
        <span class="history-date">${dateStr}</span>
      </div>
      <div class="history-text">"${escapeHtml(entry.text)}"</div>
      <div class="history-scores">${scoresHtml}</div>
    `;
    historyList.appendChild(div);
  });
}

historyClearBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todo el historial?')) {
    localStorage.removeItem('practice_history');
    renderHistory();
  }
});

// Redibujar el progreso al cambiar el filtro de nivel
progressLevelFilter.addEventListener('change', renderProgress);

// ============================================================
// PROGRESO (gráficos con Chart.js)
// ============================================================

let progressChart = null;
const skillCharts = { pronunciation: null, grammar: null, vocabulary: null };
const SKILL_CHART_DEFS = [
  { key: 'pronunciation', canvasId: 'skill-chart-pronunciation', label: 'Pronunciación', color: '#6c8cff', rgba: 'rgba(108, 140, 255, 0.15)' },
  { key: 'grammar', canvasId: 'skill-chart-grammar', label: 'Gramática', color: '#4caf7d', rgba: 'rgba(76, 175, 125, 0.15)' },
  { key: 'vocabulary', canvasId: 'skill-chart-vocabulary', label: 'Vocabulario', color: '#b388ff', rgba: 'rgba(179, 136, 255, 0.15)' }
];

function renderProgress() {
  // Solo sesiones de práctica con puntuaciones, en orden cronológico
  let practiceSessions = loadHistory()
    .filter((e) => e.scores)
    .slice() // copia
    .reverse(); // más antiguas primero

  // Filtro por nivel
  const levelFilter = progressLevelFilter.value;
  if (levelFilter !== 'all') {
    practiceSessions = practiceSessions.filter((e) => e.level === levelFilter);
  }

  if (!practiceSessions.length || typeof Chart === 'undefined') {
    progressSummary.innerHTML = '';
    progressChartCanvas.parentElement.style.display = 'none';
    progressEmpty.style.display = 'block';
    return;
  }

  progressChartCanvas.parentElement.style.display = 'block';
  progressEmpty.style.display = 'none';

  // Etiquetas: fecha corta de cada sesión
  const labels = practiceSessions.map((s) => {
    const d = new Date(s.date);
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  });

  const pronData = practiceSessions.map((s) => s.scores.pronunciation ?? null);
  const gramData = practiceSessions.map((s) => s.scores.grammar ?? null);
  const vocabData = practiceSessions.map((s) => s.scores.vocabulary ?? null);

  // Resumen: promedio de las primeras 3 vs últimas 3 sesiones
  const avg = (arr) => {
    const valid = arr.filter((v) => v != null);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  };

  const firstN = practiceSessions.slice(0, Math.min(3, practiceSessions.length));
  const lastN = practiceSessions.slice(-Math.min(3, practiceSessions.length));

  const stats = [
    { label: '🔊 Pronunciación', first: avg(firstN.map((s) => s.scores.pronunciation)), last: avg(lastN.map((s) => s.scores.pronunciation)) },
    { label: '📚 Gramática', first: avg(firstN.map((s) => s.scores.grammar)), last: avg(lastN.map((s) => s.scores.grammar)) },
    { label: '💡 Vocabulario', first: avg(firstN.map((s) => s.scores.vocabulary)), last: avg(lastN.map((s) => s.scores.vocabulary)) }
  ];

  progressSummary.innerHTML = '';
  stats.forEach((stat) => {
    const div = document.createElement('div');
    div.className = 'progress-stat';

    let deltaHtml = '';
    if (stat.first != null && stat.last != null) {
      const delta = stat.last - stat.first;
      if (delta > 0) {
        div.classList.add('stat-delta-up');
        deltaHtml = `<div class="stat-delta stat-delta-up">▲ +${delta} respecto al inicio</div>`;
      } else if (delta < 0) {
        deltaHtml = `<div class="stat-delta stat-delta-down">▼ ${delta} respecto al inicio</div>`;
      } else {
        deltaHtml = `<div class="stat-delta stat-delta-flat">— sin cambio</div>`;
      }
    }

    div.innerHTML = `
      <div class="stat-label">${stat.label}</div>
      <div class="stat-value">${stat.last ?? '--'}</div>
      ${deltaHtml}
    `;
    progressSummary.appendChild(div);
  });

  // Gráfico de líneas
  if (progressChart) progressChart.destroy();

  progressChart = new Chart(progressChartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pronunciación',
          data: pronData,
          borderColor: '#6c8cff',
          backgroundColor: 'rgba(108, 140, 255, 0.15)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Gramática',
          data: gramData,
          borderColor: '#4caf7d',
          backgroundColor: 'rgba(76, 175, 125, 0.15)',
          tension: 0.3,
          fill: true
        },
        {
          label: 'Vocabulario',
          data: vocabData,
          borderColor: '#b388ff',
          backgroundColor: 'rgba(179, 136, 255, 0.15)',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa3c0' },
          grid: { color: 'rgba(42, 48, 80, 0.5)' }
        },
        x: {
          ticks: { color: '#9aa3c0', maxRotation: 45 },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: '#e8eaf6' } }
      }
    }
  });

  // Gráficos individuales por habilidad (mismos datos y filtros)
  renderSkillCharts(practiceSessions, labels);

  // Gráficos de resultados de ejercicios (gramática/vocabulario)
  renderExerciseCharts();
}

// Ajustar el tamaño de los gráficos al abrir su subsección colapsable
// (Chart.js renderiza con tamaño 0 si el contenedor estaba oculto)
document.querySelectorAll('details.chart-collapse').forEach((details) => {
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    const canvas = details.querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart ? Chart.getChart(canvas) : null;
    if (chart) chart.resize();
  });
});

function renderSkillCharts(sessions, labels) {
  SKILL_CHART_DEFS.forEach((def) => {
    const canvas = document.getElementById(def.canvasId);
    if (!canvas) return;

    if (skillCharts[def.key]) skillCharts[def.key].destroy();

    const skillData = sessions.map((s) => (s.scores ? s.scores[def.key] ?? null : null));

    skillCharts[def.key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: def.label,
            data: skillData,
            borderColor: def.color,
            backgroundColor: def.rgba,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { color: '#9aa3c0' },
            grid: { color: 'rgba(42, 48, 80, 0.5)' }
          },
          x: {
            ticks: { color: '#9aa3c0', maxRotation: 45 },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  });
}

// ============================================================
// GRÁFICOS DE RESULTADOS DE EJERCICIOS (gramática/vocabulario)
// ============================================================

let exerciseSetChart = null;
let exerciseTopicChart = null;

function renderExerciseCharts() {
  const setCanvas = document.getElementById('exercise-set-chart');
  const topicCanvas = document.getElementById('exercise-topic-chart');
  if (!setCanvas || !topicCanvas) return;

  // Mismo filtro de nivel que el resto de gráficos de Progreso
  const levelFilter = progressLevelFilter ? progressLevelFilter.value : 'all';
  const all = loadExerciseResults();
  const results = levelFilter === 'all'
    ? all
    : all.filter((r) => r.level === levelFilter);

  // ---------- Por conjunto: media diaria por tipo ----------
  const byDate = {};
  results.forEach((r) => {
    const day = r.date.slice(0, 10);
    if (!byDate[day]) byDate[day] = { grammar: [], vocabulary: [] };
    if (byDate[day][r.type]) byDate[day][r.type].push(r.score);
  });
  const days = Object.keys(byDate).sort();
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const vocabularyData = days.map((day) => avg(byDate[day].vocabulary));
  const grammarData = days.map((day) => avg(byDate[day].grammar));

  if (exerciseSetChart) exerciseSetChart.destroy();
  exerciseSetChart = new Chart(setCanvas, {
    type: 'line',
    data: {
      labels: days.map((d) => new Date(d + 'T00:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })),
      datasets: [
        {
          label: '📐 Gramática',
          data: grammarData,
          borderColor: '#6c8cff',
          backgroundColor: 'rgba(108, 140, 255, 0.15)',
          tension: 0.3,
          fill: true,
          spanGaps: true
        },
        {
          label: '💡 Vocabulario',
          data: vocabularyData,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.15)',
          tension: 0.3,
          fill: true,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa3c0' },
          grid: { color: 'rgba(42, 48, 80, 0.5)' }
        },
        x: {
          ticks: { color: '#9aa3c0', maxRotation: 45 },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { labels: { color: '#e8eaf6' } }
      }
    }
  });

  // ---------- Por temática: media por tema (barras horizontales) ----------
  const byTopic = {};
  results.forEach((r) => {
    const key = r.type + '|' + r.topic;
    if (!byTopic[key]) byTopic[key] = { type: r.type, topic: r.topic, scores: [] };
    byTopic[key].topic = r.topic;
    byTopic[key].scores.push(r.score);
  });
  const topics = Object.values(byTopic)
    .map((t) => ({ ...t, avg: Math.round(t.scores.reduce((a, b) => a + b, 0) / t.scores.length) }))
    .sort((a, b) => b.avg - a.avg);

  if (exerciseTopicChart) exerciseTopicChart.destroy();
  exerciseTopicChart = new Chart(topicCanvas, {
    type: 'bar',
    data: {
      labels: topics.map((t) => (t.type === 'grammar' ? '📐 ' : '💡 ') + t.topic),
      datasets: [
        {
          label: 'Media',
          data: topics.map((t) => t.avg),
          backgroundColor: topics.map((t) => (t.type === 'grammar' ? 'rgba(108, 140, 255, 0.7)' : 'rgba(74, 222, 128, 0.7)')),
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: '#9aa3c0' },
          grid: { color: 'rgba(42, 48, 80, 0.5)' }
        },
        y: {
          ticks: { color: '#e8eaf6' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ============================================================
// DICCIONARIO
// ============================================================
const dictSearchInput = document.getElementById('dict-search');
const dictSearchBtn = document.getElementById('dict-search-btn');
const dictStatus = document.getElementById('dict-status');
const dictResultSection = document.getElementById('dict-result-section');
const dictWord = document.getElementById('dict-word');
const dictSpeakBtn = document.getElementById('dict-speak-btn');
const dictPracticeBtn = document.getElementById('dict-practice-btn');
const dictTranslation = document.getElementById('dict-translation');
const dictPos = document.getElementById('dict-pos');
const dictDefinition = document.getElementById('dict-definition');
const dictExamples = document.getElementById('dict-examples');
const dictRelated = document.getElementById('dict-related');
const dictSynonyms = document.getElementById('dict-synonyms');
const dictAntonyms = document.getElementById('dict-antonyms');

function setDictStatus(message, type = '') {
  dictStatus.textContent = message;
  dictStatus.className = 'status ' + type;
}

async function searchDictionary() {
  const key = getApiKey();
  const query = dictSearchInput.value.trim();

  if (!key) {
    showToast('Configura tu clave de API en Configuración para usar el diccionario.', 'warning');
    return;
  }
  if (!query) {
    setDictStatus('Escribe una palabra para buscar.', 'error');
    return;
  }

  dictSearchBtn.disabled = true;
  setDictStatus('⏳ Buscando…');

  try {
    const prompt = `You are an English dictionary assistant for Spanish-speaking students. ` +
      `Look up the English word or phrase: "${query}".\n\n` +
      `Reply ONLY with valid JSON with this exact structure:\n` +
      `{ "word": "...", "translation": "main translation to Spanish", ` +
      `"partOfSpeech": "noun|verb|adjective|adverb|phrase|...", ` +
      `"definition": "definition in simple English (1-2 sentences)", ` +
      `"examples": ["example sentence 1", "example sentence 2", "example sentence 3"], ` +
      `"synonyms": ["synonym 1", "synonym 2", "synonym 3"], ` +
      `"antonyms": ["antonym 1", "antonym 2"], ` +
      `"related": ["related word 1", "related word 2", "related word 3", "related word 4"] }\n\n` +
      `If the word has no common antonyms, return an empty array for "antonyms". ` +
      `If the query has multiple meanings, choose the most common one. Keep examples short and useful for a student.`;

    const text = await callGemini(prompt, key, { temperature: 0.1, jsonMode: true });
    const result = JSON.parse(text);

    dictWord.textContent = result.word || query;
    dictTranslation.textContent = result.translation || '—';
    dictPos.textContent = result.partOfSpeech || '—';
    dictDefinition.textContent = result.definition || '—';

    dictExamples.innerHTML = '';
    (result.examples || []).forEach((example) => {
      const li = document.createElement('li');
      li.textContent = example;
      dictExamples.appendChild(li);
    });

    dictRelated.innerHTML = '';
    (result.related || []).forEach((relatedWord) => {
      const chip = document.createElement('button');
      chip.className = 'btn chip';
      chip.textContent = relatedWord;
      chip.addEventListener('click', () => {
        dictSearchInput.value = relatedWord;
        searchDictionary();
      });
      dictRelated.appendChild(chip);
    });

    // Sinónimos y antónimos: chips clickeables que lanzan la búsqueda
    const renderWordChips = (container, words) => {
      container.innerHTML = '';
      if (!words || !words.length) {
        container.innerHTML = '<p class="hint">—</p>';
        return;
      }
      words.forEach((word) => {
        const chip = document.createElement('button');
        chip.className = 'btn chip';
        chip.textContent = word;
        chip.addEventListener('click', () => {
          dictSearchInput.value = word;
          searchDictionary();
        });
        container.appendChild(chip);
      });
    };
    renderWordChips(dictSynonyms, result.synonyms || []);
    renderWordChips(dictAntonyms, result.antonyms || []);

    dictResultSection.classList.remove('hidden');
    renderModelBadge(document.getElementById('dict-model-badge'));
    setDictStatus('');

    // Guardar en el historial de búsquedas
    addLookupEntry(DICT_HISTORY_KEY, {
      word: result.word || query,
      translation: result.translation || ''
    });
    renderDictHistory();
    recordActivitySession('dictionary');
  } catch (error) {
    setDictStatus('Error: ' + error.message, 'error');
  } finally {
    dictSearchBtn.disabled = false;
  }
}

dictSearchBtn.addEventListener('click', searchDictionary);
dictSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchDictionary();
});

// 🔊 Escuchar la palabra buscada
dictSpeakBtn.addEventListener('click', () => {
  const word = dictWord.textContent.trim();
  if (!word) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.rate = 0.9;
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  window.speechSynthesis.speak(utterance);
});

// 🎤 Enviar la palabra a la pestaña de Práctica
dictPracticeBtn.addEventListener('click', () => {
  const word = dictWord.textContent.trim();
  if (!word) return;

  targetText.value = `Practice the word: "${word}". Use it in a sentence.`;
  autoResizeTargetText();

  // Cambiar a la pestaña de Práctica
  activateTabByName('practice');
});

// ============================================================
// POPUP DE PALABRA: audio + traducción al hacer clic
// Funciona en Práctica (comparación de palabras), Conversación
// (mensajes del chat) y Traducción (resultado).
// ============================================================
const wordPopup = document.getElementById('word-popup');
const wordPopupWord = document.getElementById('word-popup-word');
const wordPopupSpeak = document.getElementById('word-popup-speak');
const wordPopupTranslateBtn = document.getElementById('word-popup-translate-btn');
const wordPopupDictBtn = document.getElementById('word-popup-dict-btn');
const wordPopupTranslation = document.getElementById('word-popup-translation');
const wordPopupClose = document.getElementById('word-popup-close');

let currentPopupWord = '';

function showWordPopup(word, anchorElement) {
  currentPopupWord = word;
  wordPopupWord.textContent = word;
  wordPopupTranslation.textContent = '';
  wordPopupTranslation.classList.add('hidden');
  wordPopup.classList.remove('hidden');

  // Posicionar el popup cerca de la palabra clickeada
  const rect = anchorElement.getBoundingClientRect();
  const popupWidth = 260;
  let left = rect.left + window.scrollX;
  left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 12));
  wordPopup.style.left = left + 'px';
  wordPopup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
}

// ---------- Selección de frase o párrafo ----------
// Además del clic en una palabra, permite seleccionar varias palabras,
// una frase o un párrafo completo y mostrar el popup con esa selección.
document.addEventListener('mouseup', (event) => {
  if (event.button !== 0) return;
  if (wordPopup.contains(event.target)) return;
  if (event.target.closest('button, input, select, textarea, #word-popup')) return;

  // Pequeño delay para que la selección esté asentada tras mouseup
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    // Solo frases/párrafos: al menos 2 palabras y máximo ~500 caracteres
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (!text || wordCount < 2 || text.length > 500) return;

    // Solo si la selección está dentro de una zona con palabras clickeables
    const anchorNode = selection.anchorNode;
    const anchorEl = anchorNode && (anchorNode.parentElement || anchorNode);
    if (!anchorEl || !anchorEl.closest('#conv-messages, #translate-result, #results-section, #dict-result-section, #target-text')) return;

    hideWordPopup();
    showWordPopup(text.replace(/\s+/g, ' '), anchorEl);
  }, 10);
});

function hideWordPopup() {
  wordPopup.classList.add('hidden');
  wordPopupTranslation.textContent = '';
  currentPopupWord = '';
}

wordPopupClose.addEventListener('click', hideWordPopup);

// Cerrar al hacer clic fuera del popup
document.addEventListener('click', (event) => {
  if (!wordPopup.classList.contains('hidden') &&
      !wordPopup.contains(event.target) &&
      !event.target.closest('.clickable-word')) {
    hideWordPopup();
  }
});

// 🔊 Escuchar la palabra con la voz configurada
wordPopupSpeak.addEventListener('click', () => {
  if (!currentPopupWord) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(currentPopupWord);
  utterance.rate = 0.9; // un poco lenta para apreciar la pronunciación
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  window.speechSynthesis.speak(utterance);
});

// 🌍 Traducir la palabra con Gemini
wordPopupTranslateBtn.addEventListener('click', async () => {
  const key = getApiKey();
  if (!key) {
    showToast('Configura tu clave de API en Configuración para traducir.', 'warning');
    return;
  }

  const word = currentPopupWord;
  const toLang = explanationLang.value === 'en' ? 'Spanish' : 'Spanish';
  wordPopupTranslation.textContent = '⏳ Traduciendo…';
  wordPopupTranslation.classList.remove('hidden');

  // ¿Es una sola palabra o una frase/párrafo?
  const isSingleWord = !word.includes(' ');

  try {
    const prompt = isSingleWord
      ? `Translate the English word "${word}" to ${toLang}. ` +
        `Reply ONLY with valid JSON: {"translation": "...", "partOfSpeech": "noun|verb|adjective|... or empty string", "example": "short example sentence in English with its translation"}`
      : `Translate the English text "${word}" to ${toLang}. ` +
        `It may be a phrase or a paragraph. Reply ONLY with valid JSON: {"translation": "...", "example": ""}`;
    const text = await callGemini(prompt, key, { temperature: 0.1, jsonMode: true });
    const result = JSON.parse(text);

    if (word !== currentPopupWord) return; // el popup cambió mientras esperábamos

    const parts = [];
    if (result.translation) parts.push(result.translation);
    if (result.partOfSpeech) parts.push('(' + result.partOfSpeech + ')');
    wordPopupTranslation.innerHTML =
      '<b>' + escapeHtml(parts.join(' ')) + '</b>' +
      (result.example ? '<br><span class="hint">' + escapeHtml(result.example) + '</span>' : '');

    // Enlace al Diccionario solo para palabras individuales
    if (isSingleWord) {
      const dictLink = document.createElement('a');
      dictLink.href = '#';
      dictLink.textContent = '📖 Ver en el Diccionario →';
      dictLink.addEventListener('click', (e) => {
        e.preventDefault();
        openDictionaryFor(word);
      });
      wordPopupTranslation.appendChild(document.createElement('br'));
      wordPopupTranslation.appendChild(dictLink);
    }
  } catch (error) {
    wordPopupTranslation.textContent = 'Error: ' + error.message;
  }
});

// 📖 Abrir el Diccionario con la palabra o frase seleccionada
wordPopupDictBtn.addEventListener('click', () => {
  if (!currentPopupWord) return;
  hideWordPopup();
  openDictionaryFor(currentPopupWord);
});

function openDictionaryFor(text) {
  dictSearchInput.value = text;
  searchDictionary();

  // Cambiar a la pestaña del Diccionario
  activateTabByName('dictionary');
}

// ---------- Hacer palabras clickeables ----------
// Envuelve las palabras de un nodo de texto en spans clickeables
function makeWordsClickable(textNode, container) {
  const words = textNode.textContent.split(/(\s+)/);
  const fragment = document.createDocumentFragment();

  words.forEach((word) => {
    if (/^\s+$/.test(word) || word === '') {
      fragment.appendChild(document.createTextNode(word));
    } else {
      const span = document.createElement('span');
      span.className = 'clickable-word';
      span.textContent = word;
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        showWordPopup(word.replace(/[.,!?;:"']/g, ''), span);
      });
      fragment.appendChild(span);
    }
  });

  textNode.replaceWith(fragment);
}

// Procesa todos los nodos de texto de un contenedor
function enableWordClicks(container) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement.closest('.clickable-word, button, .word-popup, #word-popup')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  });

  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => makeWordsClickable(node, container));
}

// ---------- Clic en el textarea de traducción ----------
// Los textarea no admiten spans, así que detectamos la palabra bajo el cursor
translateResult.addEventListener('click', () => {
  const text = translateResult.value;
  if (!text.trim()) return;

  const pos = translateResult.selectionStart;
  if (pos == null) return;

  // Expandir hacia ambos lados desde la posición del cursor
  let start = pos;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;
  let end = pos;
  while (end < text.length && !/\s/.test(text[end])) end++;

  const word = text.slice(start, end).replace(/[.,!?;:"']/g, '');
  if (word) {
    // Anclar el popup al textarea
    showWordPopup(word, translateResult);
  }
});

// ---------- Inicialización final ----------
// Renderizar el contador de uso de Gemini ahora que todos los modelos están declarados
renderGeminiUsage();


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

// ============================================================
// PALABRAS QUE MÁS FALLAS (top 10 del mazo SRS)
// ============================================================

const worstPracticeBtn = document.getElementById('worst-practice-btn');
const worstWordsList = document.getElementById('worst-words-list');
const worstPracticeResult = document.getElementById('worst-practice-result');

function renderWorstWords() {
  const deck = loadDeck();
  const worst = deck.slice().sort((a, b) => b.failures - a.failures).slice(0, 10);

  worstWordsList.innerHTML = '';
  if (!worst.length) {
    worstWordsList.innerHTML = '<p class="hint">Aún no hay palabras falladas. Haz una práctica y aparecerán aquí.</p>';
    return;
  }

  worst.forEach((card) => {
    const chip = document.createElement('button');
    chip.className = 'btn chip';
    chip.innerHTML = `${escapeHtml(card.word)} <b class="fail-count">×${card.failures}</b>`;
    chip.title = 'Clic para escuchar la palabra';
    chip.addEventListener('click', () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(card.word);
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
    worstWordsList.appendChild(chip);
  });
}

// Generar frases de práctica con las peores palabras usando Gemini
worstPracticeBtn.addEventListener('click', async () => {
  const key = getApiKey();
  if (!key) {
    showToast('Configura tu clave de API en Configuración para generar frases.', 'warning');
    return;
  }

  const deck = loadDeck();
  const worst = deck.slice().sort((a, b) => b.failures - a.failures).slice(0, 5);
  if (!worst.length) {
    showToast('Aún no hay palabras falladas.', 'warning');
    return;
  }

  worstPracticeBtn.disabled = true;
  worstPracticeResult.innerHTML = '<p class="hint">⏳ Generando frases de práctica…</p>';

  try {
    const words = worst.map((c) => c.word).join(', ');
    const prompt = `You are an English tutor for Spanish-speaking students at ${LEVEL_NAMES[difficultyLevel.value]} level. ` +
      `Write ONE short practice sentence (max 15 words) for EACH of these words: ${words}. ` +
      `Each sentence must use its word naturally and clearly. ` +
      `Reply ONLY with valid JSON: { "sentences": [ { "word": "...", "sentence": "..." } ] }`;

    const text = await callGemini(prompt, key, { temperature: 0.5, jsonMode: true });
    const result = JSON.parse(text);

    worstPracticeResult.innerHTML = '';
    (result.sentences || []).forEach((item) => {
      const div = document.createElement('div');
      div.className = 'vocab-suggestion';
      div.innerHTML = `
        <span class="better">${escapeHtml(item.word)}</span>
        <div class="hint">"${escapeHtml(item.sentence)}"</div>
      `;
      // Clic: enviar la frase a Práctica
      div.addEventListener('click', () => {
        targetText.value = item.sentence;
        autoResizeTargetText();
        activateTabByName('practice');
      });
      worstPracticeResult.appendChild(div);
    });
  } catch (error) {
    worstPracticeResult.innerHTML = `<p class="hint">Error: ${escapeHtml(error.message)}</p>`;
  } finally {
    worstPracticeBtn.disabled = false;
  }
});

// Redibujar la lista de peores palabras al abrir la pestaña Repaso
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'review') {
      renderReviewStats();
      renderWorstWords();
    }
  });
});

// ============================================================
// SHADOWING, DICTADO, GRABACIÓN DE VOZ Y ANÁLISIS DE RITMO
// ============================================================

// ---------- Modo shadowing ----------
// Reproduce la frase objetivo en bucle con pausas para que el
// usuario la repita simultáneamente (técnica de shadowing).
const shadowBtn = document.getElementById('shadow-btn');
let shadowActive = false;
let shadowTimeout = null;

function speakTargetTextRaw(rate) {
  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return null;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  window.speechSynthesis.speak(utterance);
  return utterance;
}

function stopShadowing() {
  shadowActive = false;
  clearTimeout(shadowTimeout);
  window.speechSynthesis.cancel();
  shadowBtn.textContent = '🎧 Shadowing';
}

shadowBtn.addEventListener('click', () => {
  if (shadowActive) {
    stopShadowing();
    return;
  }

  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }

  shadowActive = true;
  shadowBtn.textContent = '⏹ Detener shadowing';
  setStatus('🎧 Shadowing: repite la frase al mismo tiempo que la voz. Se repetirá 3 veces.', 'listening');

  let repetition = 0;
  const maxRepetitions = 3;

  function playShadowRound() {
    if (!shadowActive) return;
    if (repetition >= maxRepetitions) {
      stopShadowing();
      setStatus('Shadowing terminado ✔ Ahora pulsa el micrófono y evalúa tu pronunciación.');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = repetition === 0 ? 0.7 : 0.9; // primera vez más lenta
    const selectedVoice = getSelectedVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.onend = () => {
      if (!shadowActive) return;
      // Pausa para que el usuario repita la frase
      shadowTimeout = setTimeout(playShadowRound, 1500);
    };
    window.speechSynthesis.speak(utterance);
    repetition++;
  }

  playShadowRound();
});

// ---------- Modo dictado (listening) ----------
const dictationBtn = document.getElementById('dictation-btn');
const dictationBox = document.getElementById('dictation-box');
const dictationInput = document.getElementById('dictation-input');
const dictationCheckBtn = document.getElementById('dictation-check-btn');
const dictationReplayBtn = document.getElementById('dictation-replay-btn');
const dictationResult = document.getElementById('dictation-result');

dictationBtn.addEventListener('click', () => {
  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }
  dictationBox.classList.toggle('hidden');
  if (!dictationBox.classList.contains('hidden')) {
    dictationInput.value = '';
    dictationResult.innerHTML = '';
    // Reproducir la frase automáticamente al abrir el dictado
    setTimeout(() => speakTargetTextForDictation(), 300);
  }
});

function speakTargetTextForDictation() {
  const text = targetText.value.trim();
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = parseFloat(speechRateSelect.value) || 1;
  const selectedVoice = getSelectedVoice();
  if (selectedVoice) {
    utterance.voice = selectedVoice;
    utterance.lang = selectedVoice.lang;
  } else {
    utterance.lang = 'en-US';
  }
  window.speechSynthesis.speak(utterance);
}

dictationReplayBtn.addEventListener('click', speakTargetTextForDictation);

dictationCheckBtn.addEventListener('click', () => {
  const expected = targetText.value.trim();
  const written = dictationInput.value.trim();

  if (!expected) {
    showToast('Escribe o elige una frase objetivo primero.', 'warning');
    return;
  }
  if (!written) {
    dictationResult.innerHTML = '<p class="hint" style="color:var(--bad)">Escribe lo que escuchaste.</p>';
    return;
  }

  const alignment = alignWords(normalize(expected), normalize(written));
  const correct = alignment.filter((w) => w.status === 'ok').length;
  const score = Math.round((correct / Math.max(1, normalize(expected).length)) * 100);

  let html = `<div class="score-row">
    <div class="score-circle ${scoreClass(score)}">${score}</div>
    <div class="score-details"><p>`;
  html += score >= 90
    ? '¡Escucha excelente! 🎉'
    : score >= 60
      ? 'Bien, pero revisa las palabras marcadas.'
      : 'Escucha de nuevo con 🐢 velocidad lenta y reintenta.';
  html += '</p><div>';

  alignment.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'word ' + w.status;
    span.textContent = w.status === 'miss' && w.word === '—' ? w.expected : w.word;
    html += span.outerHTML;
  });

  html += '</div></div></div>';
  dictationResult.innerHTML = html;
});

// ---------- Grabación de voz (comparación de audio) ----------
const recordBtn = document.getElementById('record-btn');
const stopRecordBtn = document.getElementById('stop-record-btn');
const recordStatus = document.getElementById('record-status');
const audioCompare = document.getElementById('audio-compare');
const userAudioEl = document.getElementById('user-audio');
const ttsCompareBtn = document.getElementById('tts-compare-btn');
const evaluateWithAudioBtn = document.getElementById('evaluate-with-audio-btn');

let mediaStream = null;
let lastRecordedAudio = null; // blob de la última grabación (para evaluar con IA)

// ---------- Evaluación por audio con Gemini (multimodal) ----------
// Envía el audio grabado directamente a Gemini: transcribe y evalúa la
// pronunciación real (no depende de la transcripción del navegador).
const AUDIO_EVAL_PROMPT = (targetText, explanationLang, level) =>
  `You are an expert English pronunciation coach for Spanish-speaking students. ` +
  `The student read this target text aloud: "${targetText}". ` +
  `Listen to the attached audio recording of the student and:\n` +
  `1. Transcribe EXACTLY what you hear (word by word).\n` +
  `2. Compare it with the target text and identify which words were mispronounced ` +
  `(the student is a Spanish speaker at ${level} level).\n` +
  `3. Score pronunciation 0-100 based on how close the heard words are to the target words.\n` +
  `4. Give 2-3 short, actionable pronunciation tips.\n` +
  (explanationLang === 'en'
    ? `Write "tips" and "summary" in ENGLISH.`
    : `Write "tips" and "summary" in SPANISH.`) +
  `\nReply ONLY with valid JSON: {
  "transcript": "what you heard",
  "score": 0-100,
  "mispronounced": [{ "expected": "...", "heard": "...", "tip": "..." }],
  "tips": ["...", "..."]
}`;

async function callGeminiWithAudio(prompt, audioBlob, apiKey, options = {}) {
  const { temperature = 0.2, jsonMode = true } = options;

  // Convertir el blob a base64
  const base64Audio = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // quitar el prefijo "data:audio/webm;base64,"
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(audioBlob);
  });

  const modelsToTry = [GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey // la key va en el header, no en la URL
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: audioBlob.type || 'audio/wav', data: base64Audio } }
            ]
          }],
          generationConfig: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err.error?.message || `HTTP ${response.status}`;
        if (isHighDemandError(message) && model !== GEMINI_FALLBACK_MODEL) {
          showToast('⚠️ Modelo principal saturado. Usando modelo de respaldo…', 'warning');
          continue;
        }
        throw new Error(message);
      }

      const data = await response.json();
      recordGeminiUsage(model);
      setLastModelUsed(model);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } catch (error) {
      lastError = error;
      if (!isHighDemandError(error.message)) break;
    }
  }

  throw lastError || new Error('No se pudo contactar a Gemini con el audio.');
}

// Evaluar la pronunciación usando el audio grabado (botón opcional)
async function evaluateWithAudio() {
  const key = getApiKey();
  const target = targetText.value.trim();

  if (!key) {
    showToast('Configura tu clave de API en Configuración.', 'warning');
    return;
  }
  if (!target) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }
  if (!lastRecordedAudio) {
    showToast('Primero graba tu voz con ⏺ Grabar mi voz.', 'warning');
    return;
  }

  evaluateWithAudioBtn.disabled = true;
  recordStatus.textContent = '🤖 Enviando tu audio a Gemini…';

  try {
    const prompt = AUDIO_EVAL_PROMPT(target, explanationLang.value, difficultyLevel.value);
    const text = await callGeminiWithAudio(prompt, lastRecordedAudio, key, { temperature: 0.2, jsonMode: true });
    const result = JSON.parse(text);

    // Mostrar la transcripción de la IA y su puntuación de pronunciación
    const score = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
    pronScore.textContent = score;
    pronScore.className = 'score-circle ' + scoreClass(score);

    const mispronounced = result.mispronounced || [];
    pronSummary.textContent = mispronounced.length
      ? `IA escuchó: "${result.transcript}". Palabras a mejorar: ${mispronounced.map((m) => m.expected).join(', ')}.`
      : `IA escuchó: "${result.transcript}". ¡Pronunciación excelente!`;

    // Mostrar las palabras mal pronunciadas con sus consejos
    wordComparison.innerHTML = '';
    (result.mispronounced || []).forEach((m) => {
      const span = document.createElement('span');
      span.className = 'word miss';
      span.textContent = m.expected;
      span.title = `IA: dijiste algo parecido a "${m.heard || '?'}". ${m.tip || ''}`;
      wordComparison.appendChild(span);
    });

    // Alimentar el mazo SRS con las palabras que la IA detectó mal
    (result.mispronounced || []).forEach((m) => recordMissedWord(m.expected));

    resultsSection.classList.remove('hidden');
    renderModelBadge(resultsSection);
    recordStatus.textContent = '✔ Evaluación por audio completada.';
    setStatus('Evaluación por audio IA completada ✔');

    // Guardar en historial (solo pronunciación en práctica)
    addHistoryEntry({
      mode: 'práctica (audio IA)',
      text: target,
      level: difficultyLevel.value,
      scores: {
        pronunciation: score
      },
      corrections: null
    });
  } catch (error) {
    recordStatus.textContent = '❌ Error: ' + error.message;
  } finally {
    evaluateWithAudioBtn.disabled = false;
  }
}

evaluateWithAudioBtn.addEventListener('click', evaluateWithAudio);

// ---------- Medidor de nivel de micrófono en vivo ----------
// Muestra una barra con el volumen de entrada mientras se graba,
// para confirmar visualmente que el micrófono está captando la voz.
const micLevelWrap = document.getElementById('mic-level-wrap');
const micLevelFill = document.getElementById('mic-level-fill');
let micAudioContext = null;
let micAnalyser = null;
let micLevelRafId = null;

// ---------- Grabación con Web Audio API → WAV ----------
// Se reemplaza MediaRecorder (códec webm/opus, a veces problemático al
// reproducir) por captura directa de muestras y codificación WAV PCM,
// un formato que se reproduce en cualquier navegador.
let wavRecording = null; // { ctx, source, processor, chunks, sampleRate }

function encodeWavFromFloat32(samples, sampleRate) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Escribir cabecera RIFF/WAVE manualmente
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);        // tamaño del chunk fmt
  view.setUint16(20, 1, true);         // PCM
  view.setUint16(22, 1, true);         // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);         // block align
  view.setUint16(34, 16, true);        // bits por muestra
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Muestras PCM 16-bit little-endian
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function startMicLevelMeter() {
  if (!mediaStream || !wavRecording) return;
  try {
    micAudioContext = wavRecording.ctx; // reutilizar el contexto de grabación
    micAnalyser = micAudioContext.createAnalyser();
    micAnalyser.fftSize = 512;
    wavRecording.source.connect(micAnalyser);

    const buffer = new Uint8Array(micAnalyser.frequencyBinCount);
    micLevelWrap.classList.remove('hidden');

    const updateLevel = () => {
      if (!micAnalyser) return;
      micAnalyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const deviation = Math.abs(buffer[i] - 128);
        if (deviation > peak) peak = deviation;
      }
      const level = Math.min(100, Math.round((peak / 128) * 100));
      micLevelFill.style.width = level + '%';
      micLevelFill.className = level < 4 ? 'silent' : '';
      micLevelRafId = requestAnimationFrame(updateLevel);
    };
    micLevelRafId = requestAnimationFrame(updateLevel);
  } catch {
    // Si el AudioContext falla, simplemente no mostramos el medidor
    micLevelWrap.classList.add('hidden');
  }
}

function stopMicLevelMeter() {
  if (micLevelRafId) cancelAnimationFrame(micLevelRafId);
  micLevelRafId = null;
  micAnalyser = null;
  micLevelWrap.classList.add('hidden');
  micLevelFill.style.width = '0%';
  // El AudioContext se cierra en stopWavRecording
}

recordBtn.addEventListener('click', async () => {
  const text = targetText.value.trim();
  if (!text) {
    showToast('Escribe o elige una frase primero.', 'warning');
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(mediaStream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];

    processor.onaudioprocess = (e) => {
      // Copiar los samples (el buffer se reutiliza internamente)
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    // Conectar: source → processor → destino (gain 0 para evitar eco)
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    wavRecording = { ctx, source, processor, chunks, sampleRate: ctx.sampleRate };

    recordBtn.disabled = true;
    stopRecordBtn.disabled = false;
    recordStatus.textContent = '⏺ Grabando… lee el texto objetivo y detén al terminar.';
    startMicLevelMeter(); // medidor en vivo (reutiliza el mismo contexto)
  } catch (error) {
    recordStatus.textContent = '❌ No se pudo acceder al micrófono: ' + error.message;
  }
});

function stopWavRecording() {
  if (!wavRecording) return;
  const { ctx, source, processor, chunks, sampleRate } = wavRecording;
  wavRecording = null;

  try { processor.disconnect(); } catch { /* noop */ }
  try { source.disconnect(); } catch { /* noop */ }

  // Concatenar todos los chunks
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  // Detectar si el usuario no dijo nada (RMS ~ 0)
  let sumSquares = 0;
  for (let i = 0; i < merged.length; i++) sumSquares += merged[i] * merged[i];
  const rms = Math.sqrt(sumSquares / Math.max(1, merged.length));

  const blob = encodeWavFromFloat32(merged, sampleRate);
  lastRecordedAudio = blob; // para evaluación por audio IA (Gemini acepta WAV)

  if (blob.size <= 44 || rms < 0.001) {
    recordStatus.textContent = '❌ La grabación no captó sonido. Revisa que el micrófono correcto esté seleccionado y con volumen en Windows.';
    showToast('El micrófono no captó audio. Revisa el dispositivo de entrada.', 'warning');
  } else {
    userAudioEl.src = URL.createObjectURL(blob);
    audioCompare.classList.remove('hidden');
    const seconds = (merged.length / sampleRate).toFixed(1);
    recordStatus.textContent = `✔ Grabación lista (${seconds}s, ${(blob.size / 1024).toFixed(0)} KB). Compárala con la voz TTS o evalúala con IA.`;
  }

  stopMicLevelMeter();
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  try { ctx.close(); } catch { /* noop */ }
}

stopRecordBtn.addEventListener('click', () => {
  stopWavRecording();
  recordBtn.disabled = false;
  stopRecordBtn.disabled = true;
});

ttsCompareBtn.addEventListener('click', () => {
  speakTargetText();
});

// ---------- Análisis de ritmo y entonación ----------
// Aproximación local: compara la cantidad de palabras dichas vs esperadas,
// la duración estimada y la puntuación final para inferir pausas y entonación.
const rhythmAnalysisEl = document.getElementById('rhythm-analysis');

function analyzeRhythmAndIntonation(expectedText, saidText, listeningDurationMs) {
  const expectedWords = normalize(expectedText);
  const saidWords = normalize(saidText);

  if (!expectedWords.length || !saidWords.length) return null;

  const expectedEnd = expectedText.trim().slice(-1);
  const isQuestion = expectedEnd === '?';
  const saidEnd = saidText.trim().slice(-1);
  const saidIsQuestion = saidEnd === '?';

  // Duración estimada: ~2.5 palabras por segundo es un ritmo natural en inglés
  const expectedDurationSec = expectedWords.length / 2.5;
  const saidDurationSec = saidWords.length / 2.5;

  // Pausas: si el usuario dijo muchas menos palabras de las esperadas,
  // probablemente hizo pausas largas o se saltó partes.
  const completeness = saidWords.length / expectedWords.length;

  const tips = [];
  if (completeness < 0.7) {
    tips.push('Hiciste pausas largas u omitiste palabras. Practica leyendo la frase completa sin detenerte.');
  }
  if (completeness > 1.4) {
    tips.push('Dijiste palabras extra. Revisa el texto objetivo y practica de nuevo.');
  }
  if (isQuestion && !saidIsQuestion) {
    tips.push('La frase objetivo es una pregunta: la entonación debería subir al final.');
  }
  if (!isQuestion && saidIsQuestion) {
    tips.push('La frase objetivo es una afirmación: la entonación debería bajar al final.');
  }
  if (listeningDurationMs > 0) {
    const actualRate = expectedWords.length / (listeningDurationMs / 1000);
    if (actualRate < 1.5) {
      tips.push('Hablaste bastante lento. Intenta aumentar la velocidad gradualmente.');
    } else if (actualRate > 3.5) {
      tips.push('Hablaste muy rápido. Reduce la velocidad para ganar claridad.');
    } else {
      tips.push('Buen ritmo de habla. 👍');
    }
  }

  return { tips, isQuestion };
}

function renderRhythmAnalysis(analysis) {
  if (!analysis || !analysis.tips.length) {
    rhythmAnalysis.classList.add('hidden');
    return;
  }

  let html = '<div class="rhythm-title">🎵 Ritmo y entonación</div><ul>';
  analysis.tips.forEach((tip) => {
    html += `<li>${escapeHtml(tip)}</li>`;
  });
  html += '</ul>';
  rhythmAnalysis.innerHTML = html;
  rhythmAnalysis.classList.remove('hidden');
}

// Medir la duración de la escucha para el análisis de ritmo
let listeningStartTime = null;

// Envolver stopListening para medir la duración de la escucha
const _originalStopListening = stopListening;
stopListening = function () {
  const listeningDurationMs = listeningStartTime ? Date.now() - listeningStartTime : 0;
  _originalStopListening();

  const said = finalTranscript.trim();
  const target = targetText.value.trim();
  if (said && target) {
    const analysis = analyzeRhythmAndIntonation(target, said, listeningDurationMs);
    renderRhythmAnalysis(analysis);
  }
};

// Registrar el inicio de la escucha
const _originalStartListening = startListening;
startListening = function () {
  listeningStartTime = Date.now();
  _originalStartListening();
};

// ============================================================
// ESCENARIOS DE ROL Y MODO EXAMEN (Conversación)
// ============================================================

// ---------- Escenarios de rol ----------
const CONV_SCENARIOS = {
  airport: {
    label: '✈️ En el aeropuerto',
    hint: 'Estás en el aeropuerto: facturas tu equipaje, pasas seguridad o preguntas por tu vuelo. El tutor hace de agente.',
    role: 'You are an airport check-in agent. The student is a traveler who needs to check in, ask about their flight, or go through security. Stay in character, ask realistic questions (passport, bags, seat preference) and use airport vocabulary.',
    vocab: 'boarding pass, luggage, gate, delay, aisle seat, customs'
  },
  restaurant: {
    label: '🍽️ En el restaurante',
    hint: 'Pide en un restaurante: el tutor es el camarero. Pide el menú, pregunta por platos y pide la cuenta.',
    role: 'You are a waiter/waitress at a restaurant. The student is a customer. Take their order, recommend dishes, answer questions about the menu, and bring the bill. Stay in character.',
    vocab: 'menu, starter, main course, dessert, bill, rare, medium'
  },
  interview: {
    label: '💼 Entrevista de trabajo',
    hint: 'El tutor es un reclutador que te entrevista para un puesto. Habla de tu experiencia, fortalezas y por qué quieres el trabajo.',
    role: 'You are a job interviewer at a tech company. Interview the student for a position: ask about their experience, strengths, weaknesses and why they want the job. Stay professional and in character.',
    vocab: 'experience, skills, strengths, weaknesses, salary, team'
  },
  hotel: {
    label: '🏨 En el hotel',
    hint: 'El tutor es el recepcionista del hotel: check-in, problemas con la habitación, desayuno, wifi.',
    role: 'You are a hotel receptionist. The student is checking in. Handle check-in, room questions, complaints (wifi, hot water) and recommendations. Stay in character.',
    vocab: 'reservation, check-in, key card, amenities, checkout'
  },
  doctor: {
    label: '🩺 En el médico',
    hint: 'El tutor es un médico: describe tus síntomas y responde sus preguntas.',
    role: 'You are a doctor. The student is your patient. Ask about symptoms, give advice and explain treatments in simple terms. Stay in character.',
    vocab: 'symptoms, fever, prescription, appointment, pain'
  },
  shopping: {
    label: '🛍️ De compras',
    hint: 'El tutor es un vendedor de una tienda de ropa: tallas, colores, probadores y devoluciones.',
    role: 'You are a shop assistant in a clothing store. Help the student find items, sizes, colors, fitting rooms and returns. Stay in character.',
    vocab: 'size, fitting room, refund, discount, try on'
  }
};

const convScenarioSelect = document.getElementById('conv-scenario');
const convScenarioHint = document.getElementById('conv-scenario-hint');

// Poblar el selector de escenarios
Object.entries(CONV_SCENARIOS).forEach(([key, scenario]) => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = scenario.label;
  convScenarioSelect.appendChild(option);
});

function updateScenarioHint() {
  const key = convScenarioSelect.value;
  if (key === 'free') {
    convScenarioHint.textContent = '';
  } else {
    const scenario = CONV_SCENARIOS[key];
    convScenarioHint.textContent = scenario.vocab
      ? `Vocabulario clave: ${scenario.vocab}`
      : '';
  }
}

convScenarioSelect.addEventListener('change', () => {
  updateScenarioHint();
  // Reiniciar la conversación al cambiar de escenario
  conversationHistory = [];
  convMessages.innerHTML = '';
  convFinalTranscript = '';
  convTranscriptSection.classList.add('hidden');
  if (convScenarioSelect.value === 'free') {
    setConvStatus('Nueva conversación libre lista.');
  } else {
    setConvStatus(`Escenario activo: ${CONV_SCENARIOS[convScenarioSelect.value].label}. ¡Empieza a hablar!`);
  }
});

// ---------- Modo examen ----------
const EXAM_MODES = {
  describe: {
    label: 'Describe un tema (1 min)',
    instruction: 'Give the student a random everyday topic (e.g. "your favorite place", "a person you admire") and ask them to describe it for one minute. Give them the topic now and wait for their answer.'
  },
  opinion: {
    label: 'Opina sobre un tema (1 min)',
    instruction: 'Give the student a debatable question (e.g. "Is social media good for society?") and ask them to give their opinion with reasons for one minute. Give the topic now and wait for their answer.'
  },
  interview: {
    label: 'Simulacro de entrevista',
    instruction: 'Conduct a mock job interview in English. Ask one question at a time (experience, strengths, why this company...). After each answer, give brief feedback and ask the next question.'
  }
};

const examModeSelect = document.getElementById('exam-mode');
const examHint = document.getElementById('exam-hint');

examModeSelect.addEventListener('change', () => {
  const mode = examModeSelect.value;
  if (mode === 'off') {
    examHint.textContent = '';
    return;
  }
  const labels = {
    describe: 'Se te dará un tema para describirlo hablando ~1 minuto. La IA evaluará con rúbrica al terminar.',
    opinion: 'Recibirás un tema polémico y deberás dar tu opinión con argumentos durante ~1 minuto.',
    interview: 'Simulacro de entrevista de trabajo: responde pregunta por pregunta y recibe feedback.'
  };
  examHint.textContent = labels[mode] || '';

  // Al activar el modo examen, reiniciar la conversación y pedir el primer tema
  if (mode !== 'off') {
    conversationHistory = [];
    convMessages.innerHTML = '';
    convFinalTranscript = '';
    setConvStatus('📝 Modo examen activado. Pulsa el micrófono para empezar.');
  }
});

// ---------- Integración con el prompt de conversación ----------
// Extiende el prompt del tutor con el escenario y modo examen activos
const _originalSendConversationMessage = sendConversationMessage;
sendConversationMessage = async function (userText) {
  const scenarioKey = convScenarioSelect ? convScenarioSelect.value : 'free';
  const examMode = examModeSelect ? examModeSelect.value : 'off';

  // Inyectar instrucciones de escenario/examen en el historial como system-ish
  let scenarioInstruction = '';
  if (scenarioKey !== 'free' && CONV_SCENARIOS[scenarioKey]) {
    scenarioInstruction = `\nROLEPLAY SCENARIO (stay in character): ${CONV_SCENARIOS[scenarioKey].role}`;
  }
  if (examMode !== 'off') {
    scenarioInstruction += scenarioInstruction ? ' ' : '\n';
    scenarioInstruction += examModeInstruction(examMode);
  }

  if (scenarioInstruction) {
    // Añadir la instrucción como mensaje del sistema dentro del historial del prompt
    if (!conversationHistory.length || conversationHistory[0].role !== 'system') {
      conversationHistory.unshift({ role: 'system', text: scenarioInstruction });
    } else {
      conversationHistory[0].text = scenarioInstruction;
    }
  }

  await _originalSendConversationMessage(userText);
};

function examModeInstruction(mode) {
  if (mode === 'describe') {
    return 'EXAM MODE (describe): give the student a topic to describe for 1 minute, then evaluate fluency, vocabulary, grammar and pronunciation with a band score (like IELTS).';
  }
  if (mode === 'opinion') {
    return 'EXAM MODE (opinion): give the student a debatable question, ask for their opinion with reasons, then evaluate with a rubric and band score.';
  }
  return 'EXAM MODE (interview): conduct a mock job interview, one question at a time, with brief feedback after each answer.';
}

// ============================================================
// RACHAS Y METAS DIARIAS
// ============================================================

const STREAK_KEY = 'practice_streak';
const DAILY_GOAL = 3; // sesiones de práctica por día

function loadStreakData() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStreakData(data) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

// Registrar una sesión completada de una actividad.
// activity: 'practice' | 'conversation' | 'translate' | 'dictionary' | 'phonemes'
// La racha cuenta días con CUALQUIER actividad; el seguimiento es por actividad.
const ACTIVITY_LABELS = {
  practice: '📝 Práctica',
  conversation: '💬 Conversación',
  translate: '🌍 Traducción',
  dictionary: '📖 Diccionario',
  phonemes: '🔤 Fonemas',
  grammar: '📐 Gramática',
  vocabulary: '🧠 Vocabulario'
};

function recordActivitySession(activity) {
  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);

  if (!data.days) data.days = {};
  data.days[today] = (data.days[today] || 0) + 1;

  if (!data.activities) data.activities = {};
  if (!data.activities[activity]) data.activities[activity] = {};
  const act = data.activities[activity];
  act[today] = (act[today] || 0) + 1;

  // Calcular racha: días consecutivos con al menos 1 sesión de cualquier actividad
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (data.days[key] > 0) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  data.streak = streak;
  data.bestStreak = Math.max(data.bestStreak || 0, streak);

  saveStreakData(data);
  renderStreak();
  renderActivityTracking();
}

// Compatibilidad: la práctica sigue registrando con su nombre original
function recordPracticeSession() {
  recordActivitySession('practice');
}

// ---------- Panel de seguimiento por actividad ----------
function renderActivityTracking() {
  const container = document.getElementById('activity-tracking');
  if (!container) return;

  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);

  const rows = Object.keys(ACTIVITY_LABELS).map((activity) => {
    const days = (data.activities && data.activities[activity]) || {};
    const todayCount = days[today] || 0;

    // Total histórico y últimos 7 días
    let total = 0;
    for (const key in days) total += days[key];

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last7.push({ key, count: days[key] || 0, label: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] });
    }

    const marks = last7.map((d) => {
      const cls = d.count > 0 ? 'on' : '';
      const title = `${d.key}: ${d.count} sesión(es)`;
      return `<span class="day-mark ${cls}" title="${title}"></span>`;
    }).join('');

    return `
      <div class="activity-row">
        <span class="activity-name">${ACTIVITY_LABELS[activity]}</span>
        <span class="activity-count today">${todayCount} hoy</span>
        <span class="activity-count total">${total} total</span>
        <span class="activity-days">${marks}</span>
      </div>`;
  }).join('');

  container.innerHTML = rows || '<p class="hint">Aún no hay sesiones registradas.</p>';
}

function renderStreak() {
  const streakRow = document.getElementById('streak-row');
  const streakHint = document.getElementById('streak-hint');
  if (!streakRow) return;

  const data = loadStreakData();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = (data.days && data.days[today]) || 0;
  const streak = data.streak || 0;
  const best = data.bestStreak || 0;

  // Últimos 7 días
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7.push({ key, count: (data.days && data.days[key]) || 0, label: ['D', 'L', 'M', 'X', 'J', 'V', 'S'][d.getDay()] });
  }

  const daysHtml = last7.map((d) => {
    const done = d.count >= DAILY_GOAL;
    const started = d.count > 0;
    const cls = done ? 'done' : started ? 'started' : '';
    return `<div class="review-stat day-dot ${cls}">
      <div class="stat-value">${done ? '🔥' : started ? '·' : '–'}</div>
      <div class="stat-label">${d.label}</div>
    </div>`;
  }).join('');

  streakRow.innerHTML = `
    <div class="review-stat">
      <div class="stat-value fire">🔥 ${streak}</div>
      <div class="stat-label">días de racha</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">${todayCount}/${DAILY_GOAL}</div>
      <div class="stat-label">sesiones hoy</div>
    </div>
    <div class="review-stat">
      <div class="stat-value">🏆 ${best}</div>
      <div class="stat-label">mejor racha</div>
    </div>
    ${daysHtml}
  `;

  // Indicador compacto en el header (visible en todas las pestañas)
  const hsStreak = document.getElementById('hs-streak');
  const hsToday = document.getElementById('hs-today');
  const hsBest = document.getElementById('hs-best');
  if (hsStreak) hsStreak.textContent = streak;
  if (hsToday) hsToday.textContent = `${todayCount}/${DAILY_GOAL}`;
  if (hsBest) hsBest.textContent = best;
}

// Clic en la franja de racha del header: ir a Progreso
const headerStreak = document.getElementById('header-streak');
if (headerStreak) {
  headerStreak.addEventListener('click', () => activateTabByName('progress'));
}

// Enganchar el registro de sesión a la evaluación de pronunciación
const _originalEvaluatePronunciation = evaluatePronunciation;
evaluatePronunciation = function (...args) {
  const result = _originalEvaluatePronunciation(...args);
  recordPracticeSession();
  return result;
};

renderStreak();

// ============================================================
// INICIALIZACIÓN DE HISTORIALES (traducciones y diccionario)
// ============================================================

renderTranslateHistory();
renderDictHistory();
renderActivityTracking();

// Reflejar la pestaña activa en el desplegable de navegación
updateDropdownSummaries();

// Inicializar el dock de conversación según el modo guardado
updateConvDockForMode();

// Persistencia de la auto-evaluación de pronunciación en conversación
if (localStorage.getItem('conv_auto_eval') !== null) convAutoEval.checked = localStorage.getItem('conv_auto_eval') === '1';
convAutoEval.addEventListener('change', () => localStorage.setItem('conv_auto_eval', convAutoEval.checked ? '1' : '0'));

// ============================================================
// HISTORIAL DE CONVERSACIONES (persistente)
// - Auto-guardado de la conversación actual: se restaura al recargar
// - Conversaciones guardadas con nombre: se pueden retomar después
// ============================================================

const CONV_CURRENT_KEY = 'conv_current';
const CONV_SAVED_KEY = 'conv_saved_list';

const convSaveBtn = document.getElementById('conv-save-btn');
const convSavedSelect = document.getElementById('conv-saved-select');
const convLoadBtn = document.getElementById('conv-load-btn');
const convDeleteBtn = document.getElementById('conv-delete-btn');

function loadSavedConversations() {
  try {
    return JSON.parse(localStorage.getItem(CONV_SAVED_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSavedConversations(list) {
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
}

// Serializa la conversación actual (mensajes renderizados + historial del prompt)
function restoreConversation(snapshot) {
  if (!snapshot) return;

  conversationHistory = snapshot.history || [];
  convMessages.innerHTML = '';

  for (const m of snapshot.messages || []) {
    addMessage(
      m.role,
      m.text || '',
      m.corrections || [],
      m.scores && (m.scores.grammar || m.scores.vocabulary) ? m.scores : null
    );
  }

  // Restaurar escenario y modo examen si estaban activos
  if (snapshot.scenario && convScenarioSelect) convScenarioSelect.value = snapshot.scenario;
  if (snapshot.examMode && examModeSelect) examModeSelect.value = snapshot.examMode;
  updateScenarioHint();

  if (conversationHistory.length) {
    setConvStatus('Conversación restaurada. ¡Continúa donde la dejaste!');
  }
}

// ---------- Auto-guardado: la conversación actual sobrevive a recargas ----------
let convSaveTimer = null;
function autoSaveCurrentConversation() {
  clearTimeout(convSaveTimer);
  convSaveTimer = setTimeout(() => {
    if (!conversationHistory.length) return;
    localStorage.setItem(CONV_CURRENT_KEY, JSON.stringify(snapshotCurrentConversation()));
  }, 400);
}

function snapshotCurrentConversation() {
  const messages = [];
  convMessages.querySelectorAll('.message').forEach((div) => {
    const isUser = div.classList.contains('user');
    const textEl = div.querySelector('.message-text');
    const corrections = [];
    div.querySelectorAll('.message-corrections > div').forEach((c) => {
      corrections.push({
        original: c.querySelector('em')?.textContent || '',
        correction: c.querySelector('.suggestion')?.textContent || '',
        explanation: c.querySelector('.hint')?.textContent || ''
      });
    });
    const scores = {};
    div.querySelectorAll('.turn-score').forEach((chip) => {
      const g = chip.textContent.match(/Gramática:\s*(\d+)/);
      if (g) scores.grammar = { score: Number(g[1]) };
      const v = chip.textContent.match(/Vocabulario:\s*(\d+)/);
      if (v) scores.vocabulary = { score: Number(v[1]) };
    });
    messages.push({ role: isUser ? 'user' : 'assistant', text: textEl ? textEl.textContent : '', corrections, scores });
  });

  return {
    history: conversationHistory,
    messages,
    scenario: convScenarioSelect ? convScenarioSelect.value : 'free',
    examMode: examModeSelect ? examModeSelect.value : 'off',
    date: new Date().toISOString()
  };
}

function restoreCurrentConversation() {
  try {
    const snapshot = JSON.parse(localStorage.getItem(CONV_CURRENT_KEY) || 'null');
    if (snapshot && snapshot.messages && snapshot.messages.length) {
      restoreConversation(snapshot);
    }
  } catch { /* datos corruptos: empezar de cero */ }
}

// Guardar tras cada mensaje (con debounce)
const _originalAddMessage = addMessage;
addMessage = function (role, text, corrections, scores) {
  _originalAddMessage(role, text, corrections, scores);
  autoSaveCurrentConversation();
};

// ---------- Conversaciones guardadas con nombre ----------
function renderSavedConversations() {
  const list = loadSavedConversations();
  convSavedSelect.innerHTML = '<option value="">— Selecciona una conversación —</option>';
  list.forEach((item, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${item.name} (${item.dateLabel})`;
    convSavedSelect.appendChild(option);
  });
}

convSaveBtn.addEventListener('click', () => {
  if (!conversationHistory.length) {
    showToast('No hay conversación que guardar.', 'warning');
    return;
  }

  const name = prompt('Nombre para esta conversación:', `Conversación ${new Date().toLocaleDateString('es-ES')}`);
  if (!name) return;

  const list = loadSavedConversations();
  list.unshift({
    name,
    snapshot: snapshotCurrentConversation(),
    dateLabel: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  });
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
  renderSavedConversations();
  showToast('Conversación guardada. Podrás retomarla cuando quieras.', 'success');
});

convLoadBtn.addEventListener('click', () => {
  const index = convSavedSelect.value;
  if (index === '') {
    showToast('Selecciona una conversación de la lista.', 'warning');
    return;
  }
  const item = loadSavedConversations()[Number(index)];
  if (!item) return;

  restoreConversation(item.snapshot);
  showToast(`Conversación "${item.name}" cargada.`, 'info');
});

convDeleteBtn.addEventListener('click', () => {
  const index = convSavedSelect.value;
  if (index === '') {
    showToast('Selecciona una conversación de la lista.', 'warning');
    return;
  }
  const list = loadSavedConversations();
  const item = list[Number(index)];
  if (!item) return;
  if (!confirm(`¿Eliminar la conversación "${item.name}"?`)) return;

  list.splice(Number(index), 1);
  localStorage.setItem(CONV_SAVED_KEY, JSON.stringify(list));
  renderSavedConversations();
  showToast('Conversación eliminada.', 'info');
});

// Restaurar la conversación actual al cargar la página
restoreCurrentConversation();
renderSavedConversations();

// ============================================================
// NAVEGACIÓN DE CONVERSACIÓN LARGA (ir al inicio / último mensaje)
// ============================================================

const convNavButtons = document.getElementById('conv-nav-buttons');
const convTopBtn = document.getElementById('conv-top-btn');
const convBottomBtn = document.getElementById('conv-bottom-btn');

// Mostrar los botones solo cuando la conversación es larga (más de ~2 pantallas)
function updateConvNavButtons() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  convNavButtons.classList.toggle('hidden', scrollable < 600);
}

window.addEventListener('scroll', updateConvNavButtons, { passive: true });
window.addEventListener('resize', updateConvNavButtons);

convTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

convBottomBtn.addEventListener('click', () => {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
});

// Actualizar visibilidad al añadir mensajes
const _navOriginalAddMessage = addMessage;
addMessage = function (role, text, corrections, scores) {
  _navOriginalAddMessage(role, text, corrections, scores);
  updateConvNavButtons();
};

updateConvNavButtons();

// ============================================================
// PRÁCTICA DE GRAMÁTICA (ejercicios generados con IA)
// - Modo deficiencias: usa las últimas respuestas con correcciones
// - Modo tema: elige un tema del nivel seleccionado
// ============================================================

const GRAMMAR_TOPICS = {
  beginner: ['presente simple', 'artículos a/an/the', 'plurales', 'preposiciones básicas', 'pronombres personales'],
  intermediate: ['pasados simple y continuo', 'comparativos y superlativos', 'condicionales tipo 1 y 2', 'presente perfecto', 'verbo to be en pasado'],
  advanced: ['voz pasiva', 'condicionales mixtos', 'inversión', 'modales de probabilidad', 'estilo indirecto']
};

const grammarTopicSelect = document.getElementById('grammar-topic');
const grammarSpecificTopic = document.getElementById('grammar-specific-topic');
const grammarGenerateBtn = document.getElementById('grammar-generate-btn');
const grammarStatus = document.getElementById('grammar-status');
const grammarExerciseSection = document.getElementById('grammar-exercise-section');
const grammarTitle = document.getElementById('grammar-title');
const grammarQuestions = document.getElementById('grammar-questions');
const grammarCheckBtn = document.getElementById('grammar-check-btn');
const grammarNewBtn = document.getElementById('grammar-new-btn');
const grammarResult = document.getElementById('grammar-result');

let grammarExercise = null;

function setGrammarStatus(message, type = '') {
  grammarStatus.textContent = message;
  grammarStatus.className = 'status ' + type;
}

// Últimas respuestas del usuario con correcciones (para el modo deficiencias)
function getRecentWeaknessTexts() {
  return loadHistory()
    .filter((e) => e.corrections > 0 && e.text)
    .slice(0, 10)
    .map((e) => e.text);
}

function generateGrammarExercise() {
  const key = getApiKey();
  if (!key) {
    showToast('Configura tu clave de API en Configuración.', 'warning');
    return;
  }

  const mode = grammarTopicSelect.value;
  const level = difficultyLevel.value;
  const weakTexts = getRecentWeaknessTexts();

  if (mode === 'weaknesses' && !weakTexts.length) {
    setGrammarStatus('Aún no hay correcciones registradas. Practica en Conversación primero, o elige "Tema del nivel".', 'error');
    return;
  }

  const topic = mode === 'auto'
    ? GRAMMAR_TOPICS[level][Math.floor(Math.random() * GRAMMAR_TOPICS[level].length)]
    : mode === 'specific'
      ? grammarSpecificTopic.value
      : null;

  grammarGenerateBtn.disabled = true;
  setGrammarStatus('⏳ Generando ejercicio…');

  const prompt = `You are an English grammar teacher for Spanish-speaking students at ${level} level. ` +
    (mode === 'weaknesses'
      ? `The student recently made these mistakes in conversation (their English text): ${JSON.stringify(weakTexts)}. ` +
        `Identify the most common grammar problems in those texts and create the exercise about them.`
      : `Create the exercise about this topic: "${topic}". `) +
    `Create 5 fill-in-the-blank questions (use ___ for the blank).\n\n` +
    `Reply ONLY with valid JSON:\n` +
    `{ "title": "short topic title", "questions": [ { "sentence": "She ___ to the store every day.", ` +
    `"options": ["go", "goes", "going"], "answer": 1, "explanation": "why the answer is correct (in Spanish, brief)" } ] }\n\n` +
    `Each question must have exactly 3 options and "answer" is the index (0-2) of the correct option.`;

  callGemini(prompt, key, { temperature: 0.4, jsonMode: true })
    .then((text) => {
      const result = JSON.parse(text);
      if (!result.questions || !result.questions.length) throw new Error('Respuesta inválida de la IA');
      result.topic = topic || result.title || 'Deficiencias';
      grammarExercise = result;
      renderGrammarExercise();
      grammarExerciseSection.classList.remove('hidden');
      setGrammarStatus('');
    })
    .catch((error) => {
      setGrammarStatus('❌ Error: ' + error.message, 'error');
    })
    .finally(() => {
      grammarGenerateBtn.disabled = false;
    });
}

function renderGrammarExercise() {
  grammarTitle.textContent = '📐 ' + (grammarExercise.title || 'Ejercicio de gramática');
  grammarQuestions.innerHTML = '';
  grammarResult.textContent = '';

  grammarExercise.questions.forEach((q, qIndex) => {
    const div = document.createElement('div');
    div.className = 'exercise-question';

    const optionsHtml = (q.options || []).map((opt, i) =>
      `<button type="button" class="btn chip exercise-option" data-i="${i}">${escapeHtml(opt)}</button>`
    ).join('');

    div.innerHTML = `
      <p class="exercise-sentence">${escapeHtml(q.sentence)}</p>
      <div class="exercise-options">${optionsHtml}</div>
      <p class="exercise-explanation hidden"></p>
    `;
    grammarQuestions.appendChild(div);
  });

  // Selección de opciones (una por pregunta)
  grammarQuestions.querySelectorAll('.exercise-options').forEach((group) => {
    group.addEventListener('click', (event) => {
      if (group.classList.contains('checked')) return;
      const btn = event.target.closest('.exercise-option');
      if (!btn) return;
      group.querySelectorAll('.exercise-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
}

function checkGrammarExercise() {
  if (!grammarExercise) return;
  let correct = 0;

  grammarQuestions.querySelectorAll('.exercise-question').forEach((el, qIndex) => {
    const q = grammarExercise.questions[qIndex];
    const group = el.querySelector('.exercise-options');
    const selected = group.querySelector('.exercise-option.selected');
    const explanation = el.querySelector('.exercise-explanation');

    group.classList.add('checked');
    if (selected && Number(selected.dataset.i) === q.answer) {
      selected.classList.add('correct');
      correct++;
    } else {
      if (selected) selected.classList.add('wrong');
      group.querySelectorAll('.exercise-option')[q.answer].classList.add('correct');
    }
    explanation.textContent = q.explanation || '';
    explanation.classList.remove('hidden');
  });

  const score = Math.round((correct / grammarExercise.questions.length) * 100);
  grammarResult.textContent = `Puntuación: ${correct}/${grammarExercise.questions.length} (${score}%)`;
  grammarResult.className = 'status ' + (score === 100 ? 'success' : score >= 50 ? 'warning' : 'error');
  recordActivitySession('grammar');

  // Guardar resultado para los gráficos
  addExerciseResult({
    type: 'grammar',
    topic: grammarExercise.topic || 'Deficiencias',
    level: difficultyLevel.value,
    score,
    correct,
    total: grammarExercise.questions.length
  });
}

grammarGenerateBtn.addEventListener('click', generateGrammarExercise);
grammarCheckBtn.addEventListener('click', checkGrammarExercise);
grammarNewBtn.addEventListener('click', () => {
  grammarExerciseSection.classList.add('hidden');
  grammarExercise = null;
  generateGrammarExercise();
});

// Tema específico: poblar según nivel y mostrar solo en modo "specific"
function populateGrammarSpecificTopic() {
  const level = difficultyLevel.value;
  const current = grammarSpecificTopic.value;
  grammarSpecificTopic.innerHTML = GRAMMAR_TOPICS[level]
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join('');
  if (current && GRAMMAR_TOPICS[level].includes(current)) grammarSpecificTopic.value = current;
}

grammarTopicSelect.addEventListener('change', () => {
  const mode = grammarTopicSelect.value;
  grammarSpecificTopic.classList.toggle('hidden', mode !== 'specific');
  if (mode === 'specific') populateGrammarSpecificTopic();
});

populateGrammarSpecificTopic();

// ============================================================
// PRÁCTICA DE VOCABULARIO (ejercicios generados con IA)
// - Modo deficiencias: usa las palabras con más fallos del mazo SRS
// - Modo tema: elige un tema del nivel seleccionado
// ============================================================

const VOCAB_TOPICS = {
  beginner: ['familia', 'comida', 'trabajo y oficina', 'la ciudad', 'rutinas diarias'],
  intermediate: ['negocios', 'viajes', 'emociones y personalidad', 'phrasal verbs comunes', 'tecnología'],
  advanced: ['collocations avanzadas', 'idioms', 'vocabulario académico', 'expresiones formales', 'medio ambiente y sociedad']
};

const vocabularyTopicSelect = document.getElementById('vocabulary-topic');
const vocabularySpecificTopic = document.getElementById('vocabulary-specific-topic');
const vocabularyGenerateBtn = document.getElementById('vocabulary-generate-btn');
const vocabularyStatus = document.getElementById('vocabulary-status');
const vocabularyExerciseSection = document.getElementById('vocabulary-exercise-section');
const vocabularyExerciseTitle = document.getElementById('vocabulary-exercise-title');
const vocabularyQuestions = document.getElementById('vocabulary-questions');
const vocabularyCheckBtn = document.getElementById('vocabulary-check-btn');
const vocabularyNewBtn = document.getElementById('vocabulary-new-btn');
const vocabularyResult = document.getElementById('vocabulary-result');

let vocabularyExercise = null;

function setVocabularyStatus(message, type = '') {
  vocabularyStatus.textContent = message;
  vocabularyStatus.className = 'status ' + type;
}

// Palabras con más fallos del mazo SRS (para el modo deficiencias)
function getWorstSrsWords() {
  return loadDeck()
    .slice()
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 5)
    .map((c) => c.word);
}

function generateVocabularyExercise() {
  const key = getApiKey();
  if (!key) {
    showToast('Configura tu clave de API en Configuración.', 'warning');
    return;
  }

  const mode = vocabularyTopicSelect.value;
  const level = difficultyLevel.value;
  const worstWords = getWorstSrsWords();

  if (mode === 'weaknesses' && !worstWords.length) {
    setVocabularyStatus('Aún no hay palabras falladas. Practica pronunciación primero, o elige "Tema del nivel".', 'error');
    return;
  }

  const topic = mode === 'auto'
    ? VOCAB_TOPICS[level][Math.floor(Math.random() * VOCAB_TOPICS[level].length)]
    : mode === 'specific'
      ? vocabularySpecificTopic.value
      : null;

  vocabularyGenerateBtn.disabled = true;
  setVocabularyStatus('⏳ Generando ejercicio…');

  const prompt = `You are an English vocabulary teacher for Spanish-speaking students at ${level} level. ` +
    (mode === 'weaknesses'
      ? `The student struggles to pronounce these words: ${JSON.stringify(worstWords)}. ` +
        `Create the exercise with words related to or including those.`
      : `Create the exercise about this topic: "${topic}". `) +
    `Create 5 vocabulary questions where the student writes the missing word.\n\n` +
    `Reply ONLY with valid JSON:\n` +
    `{ "title": "short topic title", "questions": [ { "definition": "definition in simple English", ` +
    `"example": "example sentence with ___ where the word goes", "answer": "the word", "translation": "traducción al español" } ] }\n\n` +
    `Keep words appropriate for the level. If mode is weaknesses, reuse the student's problem words when possible.`;

  callGemini(prompt, key, { temperature: 0.5, jsonMode: true })
    .then((text) => {
      const result = JSON.parse(text);
      if (!result.questions || !result.questions.length) throw new Error('Respuesta inválida de la IA');
      result.topic = topic || result.title || 'Deficiencias';
      vocabularyExercise = result;
      renderVocabularyExercise();
      vocabularyExerciseSection.classList.remove('hidden');
      setVocabularyStatus('');
    })
    .catch((error) => {
      setVocabularyStatus('❌ Error: ' + error.message, 'error');
    })
    .finally(() => {
      vocabularyGenerateBtn.disabled = false;
    });
}

function renderVocabularyExercise() {
  vocabularyExerciseTitle.textContent = '🧠 ' + (vocabularyExercise.title || 'Ejercicio de vocabulario');
  vocabularyQuestions.innerHTML = '';
  vocabularyResult.textContent = '';

  vocabularyExercise.questions.forEach((q) => {
    const div = document.createElement('div');
    div.className = 'exercise-question';
    div.innerHTML = `
      <p class="exercise-sentence">💡 ${escapeHtml(q.definition)}</p>
      <input type="text" class="exercise-input" placeholder="Escribe la palabra en inglés" autocomplete="off">
      <p class="exercise-explanation hidden"></p>
    `;
    vocabularyQuestions.appendChild(div);
  });
}

function checkVocabularyExercise() {
  if (!vocabularyExercise) return;
  let correct = 0;

  vocabularyQuestions.querySelectorAll('.exercise-question').forEach((el, qIndex) => {
    const q = vocabularyExercise.questions[qIndex];
    const input = el.querySelector('input');
    const explanation = el.querySelector('.exercise-explanation');
    const userAnswer = (input.value || '').trim().toLowerCase();
    const expected = (q.answer || '').toLowerCase();

    el.classList.add('checked');
    if (userAnswer === expected) {
      input.classList.add('correct');
      correct++;
    } else {
      input.classList.add('wrong');
      explanation.textContent = `Respuesta: "${q.answer}" — ${q.translation || ''}. ${q.example || ''}`;
      explanation.classList.remove('hidden');
    }
  });

  const score = Math.round((correct / vocabularyExercise.questions.length) * 100);
  vocabularyResult.textContent = `Puntuación: ${correct}/${vocabularyExercise.questions.length} (${score}%)`;
  vocabularyResult.className = 'status ' + (score === 100 ? 'success' : score >= 50 ? 'warning' : 'error');
  recordActivitySession('vocabulary');

  // Guardar resultado para los gráficos
  addExerciseResult({
    type: 'vocabulary',
    topic: vocabularyExercise.topic || 'Deficiencias',
    level: difficultyLevel.value,
    score,
    correct,
    total: vocabularyExercise.questions.length
  });
}

vocabularyGenerateBtn.addEventListener('click', generateVocabularyExercise);
vocabularyCheckBtn.addEventListener('click', checkVocabularyExercise);
vocabularyNewBtn.addEventListener('click', () => {
  vocabularyExerciseSection.classList.add('hidden');
  vocabularyExercise = null;
  generateVocabularyExercise();
});

// Tema específico: poblar según nivel y mostrar solo en modo "specific"
function populateVocabularySpecificTopic() {
  const level = difficultyLevel.value;
  const current = vocabularySpecificTopic.value;
  vocabularySpecificTopic.innerHTML = VOCAB_TOPICS[level]
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join('');
  if (current && VOCAB_TOPICS[level].includes(current)) vocabularySpecificTopic.value = current;
}

vocabularyTopicSelect.addEventListener('change', () => {
  const mode = vocabularyTopicSelect.value;
  vocabularySpecificTopic.classList.toggle('hidden', mode !== 'specific');
  if (mode === 'specific') populateVocabularySpecificTopic();
});

populateVocabularySpecificTopic();

// ============================================================
// HISTORIAL DE FONEMAS (evaluaciones guardadas en localStorage)
// ============================================================

const PHONEME_HISTORY_KEY = 'phoneme_history';
const phonemeHistoryList = document.getElementById('phoneme-history-list');
const phonemeHistoryClearBtn = document.getElementById('phoneme-history-clear-btn');

function loadPhonemeHistory() {
  try {
    const raw = localStorage.getItem(PHONEME_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePhonemeHistory(list) {
  localStorage.setItem(PHONEME_HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
}

function addPhonemeHistoryEntry(entry) {
  const list = loadPhonemeHistory();
  list.unshift({ ...entry, date: new Date().toISOString() });
  savePhonemeHistory(list);
  renderPhonemeHistory();
}

function clearPhonemeHistory() {
  localStorage.removeItem(PHONEME_HISTORY_KEY);
  renderPhonemeHistory();
}

function renderPhonemeHistory() {
  if (!phonemeHistoryList) return;
  const list = loadPhonemeHistory();
  phonemeHistoryList.innerHTML = '';

  if (!list.length) {
    phonemeHistoryList.innerHTML = '<p class="hint">Aún no hay evaluaciones registradas. Practica un sonido y aparecerá aquí.</p>';
    return;
  }

  list.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'phoneme-history-row';
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' +
      date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const missed = entry.missed && entry.missed.length ? entry.missed.join(', ') : null;

    div.innerHTML = `
      <span class="ph-score ${scoreClass(entry.score)}">${entry.score}</span>
      <div class="phoneme-history-info">
        <span class="phoneme-history-name">${escapeHtml(entry.phoneme || '—')}</span>
        ${missed ? `<span class="phoneme-history-missed">Falladas: ${escapeHtml(missed)}</span>` : ''}
      </div>
      <span class="phoneme-history-date">${dateStr}</span>
    `;
    phonemeHistoryList.appendChild(div);
  });
}

phonemeHistoryClearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar el historial de fonemas?')) {
    clearPhonemeHistory();
    showToast('Historial de fonemas vaciado.', 'info');
  }
});

renderPhonemeHistory();

// ============================================================
// RESULTADOS DE EJERCICIOS (gramática y vocabulario) — datos
// ============================================================

const EXERCISE_RESULTS_KEY = 'exercise_results';

function loadExerciseResults() {
  try {
    const raw = localStorage.getItem(EXERCISE_RESULTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function addExerciseResult(entry) {
  const list = loadExerciseResults();
  list.unshift({ ...entry, date: new Date().toISOString() });
  localStorage.setItem(EXERCISE_RESULTS_KEY, JSON.stringify(list.slice(0, 200)));
}

// ============================================================
// RESPALDO DE DATOS (exportar / importar JSON)
// ============================================================

// Claves de datos (historiales, progreso, conversaciones). La clave de API
// y otras credenciales NO se exportan.
const DATA_BACKUP_KEYS = [
  'practice_history',
  'translate_history',
  'dict_history',
  'phoneme_history',
  'exercise_results',
  'conv_saved_list',
  'conv_current',
  'practice_streak',
  'srs_deck',
  'gemini_usage_counter',
  'difficulty_level',
  'explanation_lang',
  'speech_voice',
  'phoneme_level',
  'conv_auto_eval'
];

const dataExportBtn = document.getElementById('data-export-btn');
const dataImportBtn = document.getElementById('data-import-btn');
const dataImportFile = document.getElementById('data-import-file');
const dataBackupStatus = document.getElementById('data-backup-status');

function setDataBackupStatus(message, type = '') {
  if (!dataBackupStatus) return;
  dataBackupStatus.textContent = message;
  dataBackupStatus.className = 'hint ' + type;
}

dataExportBtn.addEventListener('click', () => {
  const payload = {
    app: 'evaluador-pronunciacion',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  DATA_BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        payload.data[key] = JSON.parse(raw);
      } catch {
        payload.data[key] = raw; // valor no-JSON: guardarlo tal cual
      }
    }
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo-evaluador-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  setDataBackupStatus(`✅ Copia exportada (${Object.keys(payload.data).length} secciones).`);
  showToast('Datos exportados.', 'success');
});

dataImportBtn.addEventListener('click', () => dataImportFile.click());

dataImportFile.addEventListener('change', () => {
  const file = dataImportFile.files && dataImportFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const data = parsed && parsed.data ? parsed.data : null;
      if (!data || typeof data !== 'object') {
        throw new Error('El archivo no tiene el formato esperado.');
      }

      const keys = Object.keys(data);
      if (!keys.length) {
        showToast('La copia está vacía.', 'warning');
        return;
      }

      if (!confirm(`¿Restaurar la copia? Se reemplazarán los datos actuales (${keys.length} secciones).`)) {
        return;
      }

      keys.forEach((key) => {
        const value = data[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });

      setDataBackupStatus(`✅ Copia restaurada (${keys.length} secciones). Recargando…`);
      showToast('Copia restaurada. Recargando…', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (error) {
      setDataBackupStatus('❌ Error al importar: ' + error.message);
      showToast('Error al importar la copia.', 'error');
    }
  };
  reader.readAsText(file);
  dataImportFile.value = '';
});


// ============================================================
// SINCRONIZACIÓN CON ARCHIVO (File System Access API)
// ============================================================

const fsSyncConnectBtn = document.getElementById('fs-sync-connect-btn');
const fsSyncNowBtn = document.getElementById('fs-sync-now-btn');
const fsSyncLoadBtn = document.getElementById('fs-sync-load-btn');
const fsSyncDisconnectBtn = document.getElementById('fs-sync-disconnect-btn');
const fsSyncStatus = document.getElementById('fs-sync-status');

const fsSyncSupported = typeof window.showSaveFilePicker === 'function';
let fsSyncHandle = null;
let fsSyncSaveTimer = null;

// --- Persistencia del handle en IndexedDB (no es serializable a JSON) ---
const FS_IDB_NAME = 'evaluador-fs-sync';
const FS_IDB_STORE = 'handles';
const FS_IDB_KEY = 'fs_sync_handle';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FS_IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FS_IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readwrite');
    tx.objectStore(FS_IDB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => tx.error;
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readonly');
    const request = tx.objectStore(FS_IDB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => request.error;
  });
}

async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readwrite');
    tx.objectStore(FS_IDB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => tx.error;
  });
}

function setFsSyncStatus(message, type = '') {
  if (!fsSyncStatus) return;
  fsSyncStatus.textContent = message;
  fsSyncStatus.className = 'hint ' + type;
}

function updateFsSyncButtons() {
  const connected = !!fsSyncHandle;
  fsSyncConnectBtn.classList.toggle('hidden', connected);
  fsSyncNowBtn.classList.toggle('hidden', !connected);
  fsSyncLoadBtn.classList.toggle('hidden', !connected);
  fsSyncDisconnectBtn.classList.toggle('hidden', !connected);
}

// Construye el mismo payload que la exportación manual
function buildBackupPayload() {
  const payload = {
    app: 'evaluador-pronunciacion',
    version: 1,
    profile: getActiveProfileName(),
    exportedAt: new Date().toISOString(),
    data: {}
  };
  DATA_BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        payload.data[key] = JSON.parse(raw);
      } catch {
        payload.data[key] = raw;
      }
    }
  });
  return payload;
}

async function writeSyncFile() {
  if (!fsSyncHandle) throw new Error('No hay archivo vinculado');
  const writable = await fsSyncHandle.createWritable();
  await writable.write(JSON.stringify(buildBackupPayload(), null, 2));
  await writable.close();
}

async function connectFsSync() {
  if (!fsSyncSupported) {
    setFsSyncStatus('❌ Tu navegador no soporta File System Access. Usa Chrome o Edge de escritorio.');
    showToast('Navegador no compatible con la sincronización.', 'error');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'evaluador-datos.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    fsSyncHandle = handle;
    await idbSet(FS_IDB_KEY, handle);
    await writeSyncFile();
    updateFsSyncButtons();
    setFsSyncStatus('✅ Vinculado: ' + handle.name + '. Guardado automático activo.');
    showToast('Archivo vinculado.', 'success');
  } catch (error) {
    if (error.name !== 'AbortError') setFsSyncStatus('❌ Error: ' + error.message);
  }
}

async function ensureFsSyncPermission() {
  if (!fsSyncHandle) return false;
  const opts = { mode: 'readwrite' };
  if ((await fsSyncHandle.queryPermission(opts)) === 'granted') return true;
  return (await fsSyncHandle.requestPermission(opts)) === 'granted';
}

async function loadFromSyncFile() {
  if (!fsSyncHandle) return;
  try {
    if (!(await ensureFsSyncPermission())) {
      showToast('Permiso denegado para leer el archivo.', 'warning');
      return;
    }
    const file = await fsSyncHandle.getFile();
    const parsed = JSON.parse(await file.text());
    if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Formato de archivo no válido.');
    }
    if (!confirm('¿Cargar los datos del archivo? Se reemplazarán los datos actuales.')) return;

    Object.keys(parsed.data).forEach((key) => {
      const value = parsed.data[key];
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    showToast('Datos cargados. Recargando…', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    if (error.name !== 'AbortError') setFsSyncStatus('❌ Error al cargar: ' + error.message);
  }
}

async function disconnectFsSync() {
  try {
    await idbDelete(FS_IDB_KEY);
  } catch { /* noop */ }
  fsSyncHandle = null;
  updateFsSyncButtons();
  setFsSyncStatus('Archivo desvinculado. Los datos siguen en el navegador.');
  showToast('Sincronización desvinculada.', 'info');
}

// --- Auto-guardado: detecta cambios en las claves de datos ---
let fsSyncSaving = false;

async function fsSyncSaveNow(reason) {
  if (!fsSyncHandle || fsSyncSaving) return;
  fsSyncSaving = true;
  try {
    await writeSyncFile();
    setFsSyncStatus('💾 Guardado automático: ' + new Date().toLocaleTimeString('es'));
  } catch {
    setFsSyncStatus('⚠️ No se pudo guardar automáticamente. Pulsa "Guardar ahora".', 'error');
  } finally {
    fsSyncSaving = false;
  }
}

function scheduleFsSyncSave() {
  if (!fsSyncHandle) return;
  clearTimeout(fsSyncSaveTimer);
  fsSyncSaveTimer = setTimeout(() => fsSyncSaveNow(), 800);
}

// Intercepta localStorage.setItem para detectar cambios en las claves de datos
const _originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  _originalSetItem.call(this, key, value);
  if (fsSyncHandle && DATA_BACKUP_KEYS.includes(key)) {
    scheduleFsSyncSave();
  }
};

// --- Botones ---
fsSyncConnectBtn.addEventListener('click', connectFsSync);
fsSyncNowBtn.addEventListener('click', async () => {
  try {
    await writeSyncFile();
    setFsSyncStatus('💾 Guardado manual completado.');
    showToast('Guardado en el archivo.', 'success');
  } catch (error) {
    setFsSyncStatus('❌ Error al guardar: ' + error.message);
  }
});
fsSyncLoadBtn.addEventListener('click', loadFromSyncFile);
fsSyncDisconnectBtn.addEventListener('click', disconnectFsSync);

// --- Inicialización: recuperar el handle vinculado en sesiones previas ---
(async () => {
  if (!fsSyncSupported) {
    setFsSyncStatus('⚠️ No disponible en este navegador. Usa Chrome o Edge de escritorio.');
    fsSyncConnectBtn.disabled = true;
    return;
  }

  const savedHandle = await idbGet(FS_IDB_KEY);
  if (!savedHandle) {
    setFsSyncStatus('Sin archivo vinculado. Pulsa "Vincular archivo" para empezar.');
    return;
  }

  // El permiso puede expirar entre sesiones: pedirlo de nuevo si hace falta
  const opts = { mode: 'readwrite' };
  if ((await savedHandle.queryPermission(opts)) === 'granted') {
    fsSyncHandle = savedHandle;
    updateFsSyncButtons();
    setFsSyncStatus('✅ Vinculado: ' + savedHandle.name + '. Guardado automático activo.');
  } else {
    fsSyncHandle = savedHandle;
    updateFsSyncButtons();
    setFsSyncStatus('⚠️ Archivo vinculado, pero el permiso expiró. Pulsa "Guardar ahora" para reautorizar.');
  }
})();

// ============================================================
// UI DE PERFILES (selector, crear, cambiar, eliminar)
// ============================================================

const profileSelect = document.getElementById('profile-select');
const profileSwitchBtn = document.getElementById('profile-switch-btn');
const profileNewName = document.getElementById('profile-new-name');
const profileCreateBtn = document.getElementById('profile-create-btn');
const profileDeleteBtn = document.getElementById('profile-delete-btn');
const profileRenameBtn = document.getElementById('profile-rename-btn');
const profileStatus = document.getElementById('profile-status');
const headerProfile = document.getElementById('header-profile');
const headerProfileName = document.getElementById('header-profile-name');

function setProfileStatus(message) {
  if (profileStatus) profileStatus.textContent = message;
}

function renderProfileSelect() {
  if (!profileSelect) return;
  const list = loadProfilesList();
  const active = getActiveProfileName();
  profileSelect.innerHTML = list
    .map((name) => `<option value="${escapeHtml(name)}"${name === active ? ' selected' : ''}>${escapeHtml(name)}${name === active ? ' (activo)' : ''}</option>`)
    .join('');
}

function renderHeaderProfile() {
  if (headerProfileName) headerProfileName.textContent = getActiveProfileName();
}

profileSwitchBtn.addEventListener('click', () => {
  const target = profileSelect.value;
  if (!target || target === getActiveProfileName()) {
    setProfileStatus('Ese perfil ya está activo.');
    return;
  }
  setActiveProfile(target);
  showToast('Perfil cambiado a "' + target + '". Recargando…', 'success');
  setTimeout(() => location.reload(), 800);
});

profileCreateBtn.addEventListener('click', () => {
  const name = (profileNewName.value || '').trim();
  if (!name) {
    setProfileStatus('Escribe un nombre para el nuevo perfil.');
    return;
  }
  const list = loadProfilesList();
  if (list.includes(name)) {
    setProfileStatus('Ya existe un perfil con ese nombre.');
    return;
  }
  list.push(name);
  saveProfilesList(list);
  profileNewName.value = '';
  renderProfileSelect();
  setProfileStatus(`✅ Perfil "${name}" creado. Pulsa "Cambiar a este perfil" para usarlo (empieza vacío).`);
  showToast('Perfil "' + name + '" creado.', 'success');
});

// Renombrar el perfil activo: mueve todas sus claves prefijadas al nuevo
// nombre y actualiza la lista de perfiles y el perfil activo.
profileRenameBtn.addEventListener('click', () => {
  const active = getActiveProfileName();
  const newName = (profileNewName.value || '').trim();

  if (!newName) {
    setProfileStatus('Escribe el nuevo nombre en el campo de arriba y pulsa "Renombrar".');
    return;
  }
  if (newName === active) {
    setProfileStatus('El perfil ya se llama así.');
    return;
  }
  const list = loadProfilesList();
  if (list.includes(newName)) {
    setProfileStatus(`Ya existe un perfil llamado "${newName}". Elige otro nombre.`);
    return;
  }
  if (!confirm(`¿Renombrar el perfil "${active}" a "${newName}"? Se conservan todos sus datos.`)) {
    return;
  }

  // Mover todas las claves prefijadas del perfil al nuevo nombre
  PROFILED_KEYS.forEach((key) => {
    const value = _profileGetItem.call(localStorage, active + '::' + key);
    if (value !== null) {
      _profileSetItem.call(localStorage, newName + '::' + key, value);
      _profileRemoveItem.call(localStorage, active + '::' + key);
    }
  });

  saveProfilesList(list.map((n) => (n === active ? newName : n)));
  writeRawStorage(ACTIVE_PROFILE_KEY, newName);
  showToast('Perfil renombrado a "' + newName + '". Recargando…', 'success');
  setTimeout(() => location.reload(), 800);
});

profileDeleteBtn.addEventListener('click', () => {
  const active = getActiveProfileName();
  const list = loadProfilesList();
  if (list.length <= 1) {
    setProfileStatus('No puedes eliminar el único perfil existente.');
    return;
  }
  if (!confirm(`¿Eliminar el perfil "${active}" y TODOS sus datos (historiales, progreso, rachas)? Esta acción no se puede deshacer.`)) {
    return;
  }

  // Borrar las claves prefijadas del perfil
  PROFILED_KEYS.forEach((key) => {
    removeRawStorage(active + '::' + key);
  });

  const remaining = list.filter((n) => n !== active);
  saveProfilesList(remaining);
  writeRawStorage(ACTIVE_PROFILE_KEY, remaining[0]);
  showToast('Perfil eliminado. Recargando…', 'info');
  setTimeout(() => location.reload(), 1200);
});

// Chip del header: ir a Configuración
if (headerProfile) {
  headerProfile.addEventListener('click', () => activateTabByName('settings'));
}

renderProfileSelect();
if (headerProfileName) headerProfileName.textContent = getActiveProfileName();

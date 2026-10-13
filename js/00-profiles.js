// ============================================================
// Evaluador de Pronunciación — js/00-profiles.js
// Perfiles de usuario: aislamiento de datos por persona
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


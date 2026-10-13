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


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



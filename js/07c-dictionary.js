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


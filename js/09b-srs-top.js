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


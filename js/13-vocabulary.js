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


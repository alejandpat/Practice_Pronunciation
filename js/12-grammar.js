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


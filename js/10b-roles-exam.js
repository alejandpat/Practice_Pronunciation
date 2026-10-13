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


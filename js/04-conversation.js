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
  convChatInput.style.height = 'auto'; // el textarea vuelve a una línea
  sendConversationMessage(text);
}

convChatSend.addEventListener('click', sendConvChat);
convChatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendConvChat();
  }
});

// Auto-expansión estilo WhatsApp: el textarea crece con el texto (hasta ~6 líneas)
function autoResizeConvChat() {
  convChatInput.style.height = 'auto';
  convChatInput.style.height = Math.min(convChatInput.scrollHeight, 180) + 'px';
}
convChatInput.addEventListener('input', autoResizeConvChat);

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


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


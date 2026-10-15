// Similitud entre dos palabras (0 a 1) usando distancia de Levenshtein
function wordSimilarity(a, b) {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // borrado
        dp[i][j - 1] + 1,       // inserción
        dp[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

// Umbral de similitud para contar una palabra como "casi bien"
const CLOSE_SIMILARITY_THRESHOLD = 0.75;

// Alineación de palabras (distancia de edición a nivel de palabra)
function alignWords(expected, actual) {
  const m = expected.length;
  const n = actual.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  const ops = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(''));

  for (let i = 0; i <= m; i++) { dp[i][0] = i; ops[i][0] = 'del'; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; ops[0][j] = 'ins'; }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1] === actual[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
        ops[i][j] = 'ok';
      } else {
        const del = dp[i - 1][j] + 1;
        const ins = dp[i][j - 1] + 1;
        // Sustitución "barata" si las palabras son casi iguales (fuzzy)
        const similarity = wordSimilarity(expected[i - 1], actual[j - 1]);
        const subCost = similarity >= CLOSE_SIMILARITY_THRESHOLD ? 0.4 : 1;
        const sub = dp[i - 1][j - 1] + subCost;
        const min = Math.min(del, ins, sub);
        dp[i][j] = min;
        ops[i][j] = min === sub ? 'sub' : min === del ? 'del' : 'ins';
      }
    }
  }

  // Reconstruir el camino óptimo
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    const op = ops[i][j];
    if (op === 'ok' || op === 'sub') {
      const similarity = wordSimilarity(expected[i - 1], actual[j - 1]);
      const status = op === 'ok'
        ? 'ok'
        : similarity >= CLOSE_SIMILARITY_THRESHOLD ? 'close' : 'miss';
      out.unshift({ word: actual[j - 1], expected: expected[i - 1], status, similarity });
      i--; j--;
    } else if (op === 'del') {
      out.unshift({ word: '—', expected: expected[i - 1], status: 'miss' });
      i--;
    } else {
      out.unshift({ word: actual[j - 1], expected: null, status: 'extra' });
      j--;
    }
  }
  return out;
}

// Elegir la interpretación (alternativa del reconocimiento) que mejor
// coincida con el texto objetivo. Devuelve el texto a evaluar.
function pickBestTranscript(expectedText, saidText, alternatives) {
  const expected = normalize(expectedText);
  if (!expected.length) return saidText;

  // Candidatos: la transcripción principal + todas las alternativas
  const candidates = [saidText];
  (alternatives || []).forEach((alts) => {
    alts.forEach((alt) => {
      if (alt && alt.trim()) candidates.push(alt.trim());
    });
  });

  let bestText = saidText;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const said = normalize(candidate);
    if (!said.length) continue;
    const alignment = alignWords(expected, said);
    // Puntuar: ok = 1, close = 0.6, extra penaliza
    let score = 0;
    alignment.forEach((w) => {
      if (w.status === 'ok') score += 1;
      else if (w.status === 'close') score += 0.6;
      else if (w.status === 'extra') score -= 0.5;
    });
    if (score > bestScore) {
      bestScore = score;
      bestText = candidate;
    }
  }
  return bestText;
}

function evaluatePronunciation(expectedText, saidText, alternatives = []) {
  const expected = normalize(expectedText);

  if (!expected.length) return;

  // Elegir la interpretación del reconocimiento que mejor coincida
  const bestSaidText = pickBestTranscript(expectedText, saidText, alternatives);
  const said = normalize(bestSaidText);

  if (!said.length) return;

  const alignment = alignWords(expected, said);
  const correct = alignment.filter((w) => w.status === 'ok').length;
  const close = alignment.filter((w) => w.status === 'close').length;
  const score = Math.round(((correct + close * 0.6) / expected.length) * 100);

  pronScore.textContent = score;
  pronScore.className = 'score-circle ' + scoreClass(score);

  const missed = alignment.filter((w) => w.status === 'miss').map((w) => w.expected);
  const closeWords = alignment.filter((w) => w.status === 'close').map((w) => w.expected);
  let summary;
  if (!missed.length && !closeWords.length) {
    summary = `¡Perfecto! Dijiste correctamente las ${expected.length} palabras.`;
  } else {
    const parts = [];
    if (closeWords.length) parts.push(`casi bien: ${closeWords.join(', ')}`);
    if (missed.length) parts.push(`con problemas: ${missed.join(', ')}`);
    summary = `Dijiste ${correct} de ${expected.length} palabras correctamente (${parts.join(' · ')}).`;
  }
  pronSummary.textContent = summary;

  // Alimentar el mazo de repaso (SRS): las "casi" no entran al mazo,
  // las falladas sí; las correctas suben de nivel.
  missed.forEach((word) => recordMissedWord(word));
  alignment.filter((w) => w.status === 'ok').forEach((w) => recordHitWord(w.expected));

  wordComparison.innerHTML = '';
  alignment.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'word ' + w.status;
    span.textContent = w.status === 'miss' && w.word === '—' ? w.expected : w.word;
    span.title =
      w.status === 'ok' ? 'Correcta' :
      w.status === 'close' ? `Casi: dijiste "${w.word}" (esperado: "${w.expected}")` :
      w.status === 'miss' ? (w.word === '—' ? `No dijiste: "${w.expected}"` : `Dijiste "${w.word}" en lugar de "${w.expected}"`) :
      `Palabra extra: "${w.word}"`;
    // Clic en la palabra: popup con audio y traducción
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      const clean = span.textContent.replace(/[.,!?;:"']/g, '');
      if (clean) showWordPopup(clean, span);
    });
    wordComparison.appendChild(span);
  });
}

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

// ---------- Evaluación con Gemini ----------
const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash-lite'; // modelo de respaldo (más ligero, disponible para proyectos nuevos)

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Detecta si un error es por alta demanda / saturación temporal
function isHighDemandError(message) {
  const msg = (message || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('try again later') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('429')
  );
}

// ---------- Insignia de modelo usado ----------
// Registra qué modelo respondió la última llamada a IA y muestra una
// insignia "🤖 Modelo: X" debajo del resultado de cada actividad.
let lastModelUsed = '';

function setLastModelUsed(model) {
  lastModelUsed = model;
}

function modelBadgeHtml() {
  if (!lastModelUsed) return '';
  return `<div class="model-badge">🤖 Modelo: ${escapeHtml(lastModelUsed)}</div>`;
}

// Inserta (o actualiza) la insignia de modelo dentro de un contenedor
function renderModelBadge(container) {
  if (!container) return;
  let badge = container.querySelector(':scope > .model-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'model-badge';
    container.appendChild(badge);
  }
  badge.textContent = '🤖 Modelo: ' + (lastModelUsed || 'desconocido');
}

// Llamada centralizada a Gemini con reintentos y modelo de respaldo.
// Si Gemini no está disponible (sin internet, saturado, etc.), intenta con Ollama local.
// options.youtubeUrl: URL de YouTube que se adjunta como file_data para que
// el modelo vea/escuche el video de verdad (no solo el texto del enlace).
// Devuelve el texto de respuesta y avisa (toast) si usó un respaldo.
async function callGemini(prompt, apiKey, options = {}) {
  const { temperature = 0.2, jsonMode = true, youtubeUrl = '' } = options;

  // Modo "Ollama directo": saltarse Gemini por completo
  if (ollamaDirectCheckbox.checked) {
    const ollama = getOllamaConfig();
    if (!ollama) {
      throw new Error('Ollama directo activado, pero falta configurar URL o modelo de Ollama.');
    }
    setLastModelUsed('Ollama: ' + ollama.model);
    return await callOllama(prompt, ollama, { temperature, jsonMode });
  }

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
              // Adjuntar el video de YouTube para que el modelo lo procese
              // de verdad (transcripción, idioma, contenido...).
              ...(youtubeUrl ? [{ file_data: { file_uri: youtubeUrl } }] : [])
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
        // Si es alta demanda, probar con el siguiente modelo (fallback)
        if (isHighDemandError(message) && model !== GEMINI_FALLBACK_MODEL) {
          showToast('⚠️ Modelo principal saturado. Usando modelo de respaldo…', 'warning');
          continue;
        }
        throw new Error(message);
      }

      const data = await response.json();
      recordGeminiUsage(model); // registrar uso para el contador de cuota
      setLastModelUsed(model);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } catch (error) {
      lastError = error;
      // Si no es error de alta demanda, no tiene sentido probar el fallback
      if (!isHighDemandError(error.message)) break;
    }
  }

  // Último recurso: Ollama local (funciona sin internet)
  const ollama = getOllamaConfig();
  if (ollama) {
    try {
      showToast('📴 Sin conexión con Gemini. Usando Ollama local…', 'warning');
      setLastModelUsed('Ollama: ' + ollama.model);
      return await callOllama(prompt, ollama, { temperature, jsonMode });
    } catch (ollamaError) {
      throw new Error(
        `Gemini: ${lastError?.message || 'no disponible'}. Ollama: ${ollamaError.message}`
      );
    }
  }

  throw lastError || new Error('No se pudo contactar a Gemini.');
}

// Llamada a Ollama local (API de chat en http://localhost:11434)
async function callOllama(prompt, { url, model }, { temperature = 0.2, jsonMode = true } = {}) {
  const response = await fetch(url + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: jsonMode ? 'json' : undefined,
      options: { temperature }
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.response || '';
}

const LEVEL_NAMES = { beginner: 'beginner (A1-A2)', intermediate: 'intermediate (B1-B2)', advanced: 'advanced (C1-C2)' };


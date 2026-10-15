// ============================================================
// Evaluador de Pronunciación — js/22-listening.js
// Listening con videos: completar-huecos y dictado por nivel
// ============================================================

// ---------- Referencias DOM ----------
const listeningVideoUrlInput = document.getElementById('listening-video-url');
const listeningLoadBtn = document.getElementById('listening-load-btn');
const listeningPlayerWrap = document.getElementById('listening-player-wrap');
const listeningPlayer = document.getElementById('listening-player');
const listeningTranscriptWrap = document.getElementById('listening-transcript-wrap');
const listeningToggleTranscriptBtn = document.getElementById('listening-toggle-transcript-btn');
const listeningTranscriptInput = document.getElementById('listening-transcript');
const listeningGenerateBtn = document.getElementById('listening-generate-btn');
const listeningManualBtn = document.getElementById('listening-manual-btn');
const listeningStatus = document.getElementById('listening-status');
const listeningExerciseSection = document.getElementById('listening-exercise-section');
const listeningExerciseTitle = document.getElementById('listening-exercise-title');
const listeningGapExercise = document.getElementById('listening-gap-exercise');
const listeningWordBank = document.getElementById('listening-word-bank');
const listeningGaps = document.getElementById('listening-gaps');

// ---------- Rueda de frases (carrusel junto al reproductor) ----------
const lpWheel = document.getElementById('lp-wheel');
const lpWheelCounter = document.getElementById('lp-wheel-counter');
const lpWheelPhrase = document.getElementById('lp-wheel-phrase');
const lpWheelPrevBtn = document.getElementById('lp-wheel-prev');
const lpWheelNextBtn = document.getElementById('lp-wheel-next');
const lpWheelModeSelect = document.getElementById('lp-wheel-mode');
const lpWheelWordBank = document.getElementById('lp-wheel-word-bank');
let lpWheelIndex = 0;
let lpWheelUseDropdown = true; // desplegable (true) o caja de texto (false)
const listeningCheckBtn = document.getElementById('listening-check-btn');
const listeningRevealBtn = document.getElementById('listening-reveal-btn');
const listeningDictation = document.getElementById('listening-dictation');
const listeningDictationInput = document.getElementById('listening-dictation-input');
const listeningDictationCheckBtn = document.getElementById('listening-dictation-check-btn');
const listeningResult = document.getElementById('listening-result');
const listeningScore = document.getElementById('listening-score');
const listeningSummary = document.getElementById('listening-summary');
const listeningComparison = document.getElementById('listening-comparison');

// ---------- Estado ----------
let listeningVideoId = null;
let languageCheck = null; // resultado de la validación de idioma {videoId, isEnglish}
let listeningVideoTitle = ''; // título del video para el historial
let listeningTranscriptText = '';
let listeningGapItems = []; // [{answer, before, after, input, time}]
let syncMode = false; // modo sincronizado con el video
let syncTimer = null;
let activeGapIndex = -1;
let lastSyncTime = 0; // tiempo del ciclo anterior de checkSyncPosition
let syncSuppressedUntil = 0; // pausa la supresión de pausas tras un seek (repetir hueco)

// Aviso si la app se abre con file:// (YouTube exige un origen HTTP
// para el reproductor embebido: sin Referer devuelve el error 153).
if (window.location.protocol === 'file:') {
  const fileWarning = document.getElementById('listening-file-warning');
  if (fileWarning) fileWarning.style.display = '';
}

// ---------- Utilidades ----------
function setListeningStatus(message, type = '') {
  listeningStatus.textContent = message;
  listeningStatus.className = 'status ' + type;
}

// Extrae el ID de video de varias formas de URL de YouTube
function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /youtu\.be\/([\w-]+)/,
    /youtube-nocookie\.com\/embed\/([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ---------- Buscador de YouTube (embebido) ----------
// Busca con la API de datos de YouTube usando la clave del usuario y
// muestra los resultados como tarjetas dentro de la página. Si la clave
// no tiene la API de YouTube habilitada, abre YouTube en una pestaña.
const listeningSearchInput = document.getElementById('listening-search-input');
const listeningSearchBtn = document.getElementById('listening-search-btn');
const listeningSearchResults = document.getElementById('listening-search-results');

async function searchYouTubeVideos() {
  const query = listeningSearchInput.value.trim();
  if (!query) {
    setListeningStatus('Escribe primero qué canción o video quieres buscar.', 'error');
    return;
  }

  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    setListeningStatus('La búsqueda embebida necesita tu clave de API (⚙️ Configuración).', 'error');
    return;
  }

  listeningSearchBtn.disabled = true;
  setListeningStatus('🔎 Buscando…', 'listening');

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&videoEmbeddable=true&q=${encodeURIComponent(query)}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      // API de YouTube no habilitada en la clave: abrir YouTube directamente
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank', 'noopener');
      setListeningStatus('⚠️ No se pudo buscar aquí (¿API de YouTube habilitada en tu clave?). Abriendo YouTube…', 'warning');
      return;
    }
    const data = await response.json();
    // Una nueva búsqueda oculta la barra de canción cargada
    const currentSong = document.getElementById('listening-current-song');
    if (currentSong) currentSong.classList.add('hidden');
    renderSearchResults((data.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url || ''
    })));
    setListeningStatus(`✅ ${data.items ? data.items.length : 0} resultados. Haz clic en uno para cargarlo.`, 'success');
  } catch (error) {
    setListeningStatus(`❌ ${error.message}`, 'error');
  } finally {
    listeningSearchBtn.disabled = false;
  }
}

function renderSearchResults(results) {
  listeningSearchResults.innerHTML = '';
  if (!results.length) {
    listeningSearchResults.classList.remove('hidden');
    listeningSearchResults.innerHTML = '<p class="hint">Sin resultados. Prueba con otra búsqueda.</p>';
    return;
  }
  results.forEach((item) => {
    const card = document.createElement('button');
    card.className = 'search-result-card';
    card.innerHTML = `
      <img src="${escapeHtml(item.thumbnail)}" alt="" loading="lazy">
      <div class="search-result-info">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="search-channel">${escapeHtml(item.channel)}</span>
      </div>`;
    card.addEventListener('click', () => loadSearchResult(item));
    listeningSearchResults.appendChild(card);
  });
  listeningSearchResults.classList.remove('hidden');
}

// Carga el video seleccionado en el reproductor embebido y genera la
// transcripción con el ejercicio automáticamente.
function loadSearchResult(item) {
  // Oculta el pool de resultados, la caja de búsqueda y muestra la barra
  listeningSearchResults.classList.add('hidden');
  const searchRow = document.getElementById('listening-search-row');
  if (searchRow) searchRow.classList.add('hidden');
  const currentSong = document.getElementById('listening-current-song');
  const currentTitle = document.getElementById('listening-current-title');
  if (currentSong && currentTitle) {
    currentSong.classList.remove('hidden');
    currentTitle.textContent = item.title || 'Canción cargada';
  }
  loadVideo(item.videoId, item.title);
  listeningVideoUrlInput.value = `https://www.youtube.com/watch?v=${item.videoId}`;
  listeningPlayerWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setListeningStatus('✅ Canción cargada. Generando transcripción y ejercicio con IA…', 'listening');
  generateListeningExercise();
}

// Botón "Cambiar canción": restaura el pool, la caja de búsqueda y oculta la barra
document.getElementById('listening-change-song-btn').addEventListener('click', () => {
  const currentSong = document.getElementById('listening-current-song');
  if (currentSong) currentSong.classList.add('hidden');
  const searchRow = document.getElementById('listening-search-row');
  if (searchRow) searchRow.classList.remove('hidden');
  if (listeningSearchResults.children.length) {
    listeningSearchResults.classList.remove('hidden');
  }
  listeningSearchInput.focus();
});

listeningSearchBtn.addEventListener('click', searchYouTubeVideos);
listeningSearchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') listeningSearchBtn.click();
});

// ---------- Selector de modo (buscar / pegar URL) ----------
const listeningModeBtns = document.querySelectorAll('.listening-mode-btn');
const listeningSearchMode = document.getElementById('listening-search-mode');
const listeningUrlMode = document.getElementById('listening-url-mode');

listeningModeBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    listeningModeBtns.forEach((b) => b.classList.toggle('active', b === btn));
    const mode = btn.dataset.mode;
    listeningSearchMode.classList.toggle('hidden', mode !== 'search');
    listeningUrlMode.classList.toggle('hidden', mode !== 'url');
  });
});

// ---------- Transcripción oculta por defecto ----------
listeningToggleTranscriptBtn.addEventListener('click', () => {
  const isHidden = listeningTranscriptWrap.classList.toggle('hidden');
  listeningToggleTranscriptBtn.textContent = isHidden ? '👁️ Mostrar transcripción' : '🙈 Ocultar transcripción';
});

// ---------- Reproductor (YouTube IFrame API) ----------
// La IFrame API permite pausar/reanudar y leer el tiempo de reproducción,
// necesario para el modo sincronizado.
let ytPlayer = null;
let ytApiReady = false;
let pendingVideoId = null;
let pendingPlayerVideoId = null; // video que llegó antes de que el player estuviera listo

function onYouTubeIframeApiReady() {
  ytApiReady = true;
  if (pendingVideoId) {
    createPlayer(pendingVideoId);
    pendingVideoId = null;
  }
}

function loadYouTubeIframeApi() {
  if (window.YT && window.YT.Player) { ytApiReady = true; return; }
  window.onYouTubeIframeAPIReady = onYouTubeIframeApiReady;
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function createPlayer(videoId) {
  if (!ytPlayer) {
    ytPlayer = new YT.Player('listening-player', {
      videoId,
      playerVars: { rel: 0, autoplay: 0 },
      events: {
        onReady: () => {
          listeningPlayerWrap.classList.remove('hidden');
          // Si llegó otro video mientras el player se preparaba, cárgalo ahora
          if (pendingPlayerVideoId && pendingPlayerVideoId !== videoId) {
            ytPlayer.loadVideoById(pendingPlayerVideoId);
          }
          pendingPlayerVideoId = null;
        }
      }
    });
  } else if (typeof ytPlayer.loadVideoById === 'function') {
    ytPlayer.loadVideoById(videoId);
    listeningPlayerWrap.classList.remove('hidden');
  } else {
    // El player existe pero la API aún no está lista (aún no dispara onReady):
    // guarda el video pendiente para cargarlo en onReady.
    pendingPlayerVideoId = videoId;
    listeningPlayerWrap.classList.remove('hidden');
  }
}

// ---------- Carga del video ----------
listeningLoadBtn.addEventListener('click', () => {
  const url = listeningVideoUrlInput.value.trim();
  if (!url) {
    setListeningStatus('Pega primero la URL del video.', 'error');
    return;
  }
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    setListeningStatus('No se pudo extraer el ID del video. Revisa la URL.', 'error');
    return;
  }
  loadVideo(videoId);
  setListeningStatus('✅ Video cargado. Ahora genera el ejercicio con IA o pega una transcripción.', 'success');
});

// ---------- Carga del video (única ruta para buscador y URL) ----------
// Muestra el panel, crea/carga el reproductor y activa el fallback si la
// IFrame API no está disponible (p. ej. bloqueadores de anuncios).
function loadVideo(videoId, title) {
  listeningVideoId = videoId;
  listeningVideoTitle = title || '';
  languageCheck = null; // video nuevo: invalidar la validación anterior
  listeningPlayerWrap.classList.remove('hidden');
  if (ytApiReady) {
    createPlayer(videoId);
  } else {
    pendingVideoId = videoId;
  }
  // Verificación automática de idioma (configurable en ⚙️ Configuración).
  // Usa ensureVideoIsEnglish para compartir la promesa con la generación
  // y no verificar dos veces el mismo video.
  if (autoLangCheckEnabled()) {
    ensureVideoIsEnglish();
  }
  // Red de seguridad: si en 3 s el reproductor no está activo (la IFrame API
  // no cargó o falló, p. ej. con bloqueadores de anuncios), embebe el video
  // directamente en el iframe. Se busca el iframe de nuevo porque YT.Player
  // reemplaza el nodo original en el DOM.
  setTimeout(() => {
    const frame = document.getElementById('listening-player');
    const playerOk = ytApiReady && ytPlayer && typeof ytPlayer.getPlayerState === 'function';
    // Actualiza el iframe también si ya tiene un video embebido (cambio de
    // canción): solo se salta si ya apunta al video solicitado.
    if (!playerOk && frame && !frame.src.includes(`embed/${videoId}`)) {
      frame.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1&enablejsapi=1`;
      lpStartListening();
    }
  }, 3000);
}

// Carga la API del reproductor al iniciar (requiere internet)
loadYouTubeIframeApi();

// ---------- Generación del ejercicio con IA ----------
// Pide a Gemini la transcripción del video (la API acepta URLs de YouTube
// como entrada) y un ejercicio adaptado al nivel del usuario.
async function generateListeningExercise() {
  const apiKey = getApiKey();
  if (!apiKey) {
    setListeningStatus('Primero configura tu clave de API en ⚙️ Configuración.', 'error');
    return;
  }
  if (!listeningVideoId && !listeningTranscriptText) {
    setListeningStatus('Carga primero un video o pega una transcripción.', 'error');
    return;
  }

  // Validar el idioma del video antes de generar (si no es inglés, no se genera)
  const isEnglish = await ensureVideoIsEnglish();
  if (!isEnglish) {
    setListeningStatus('⚠️ El video no está en inglés. Elige un video en inglés para practicar: no se generó el ejercicio.', 'warning');
    return;
  }

  setListeningStatus('✨ Generando ejercicio con IA…', 'listening');
  listeningGenerateBtn.disabled = true;

  try {
    const level = difficultyLevel.value;
    const levelNames = { beginner: 'beginner (A1-A2)', intermediate: 'intermediate (B1-B2)', advanced: 'advanced (C1-C2)' };
    const prompt = `You are an English listening teacher. Here is a YouTube video: https://www.youtube.com/watch?v=${listeningVideoId}

Watch/listen to the video and produce:
1. "transcript": the transcript of the spoken content in English (max ~120 words, only clear speech).
2. "gaps": an array of 8-12 gap-fill items for a ${levelNames[level]} student. Each item: {"answer": "the missing word", "before": "up to 6 words before the gap", "after": "up to 2 words after", "time": approximate seconds into the video when that word is spoken (integer)}.
${level === 'beginner' ? "Choose common, easy-to-hear words (nouns, verbs, numbers)." : level === 'intermediate' ? "Include some connected speech and less common words." : "Include contractions, weak forms and connected speech."}

Return ONLY valid JSON: {"transcript": "...", "gaps": [{"answer": "...", "before": "...", "after": "...", "time": 12}]}`;

    const response = await callGemini(prompt, getApiKey(), {
      temperature: 0.3,
      jsonMode: true,
      youtubeUrl: `https://www.youtube.com/watch?v=${listeningVideoId}`
    });
    const data = JSON.parse(response);

    if (!data.transcript || !Array.isArray(data.gapItems) && !Array.isArray(data.gaps)) {
      throw new Error('La IA no devolvió el formato esperado.');
    }

    listeningTranscriptText = data.transcript;
    // Copiar la transcripción al cuadro (oculto por defecto) para que
    // aparezca al pulsar "👁️ Mostrar transcripción".
    listeningTranscriptInput.value = data.transcript;
    buildGapExercise(data.gaps || []);
    setListeningStatus('✅ Ejercicio generado. ¡Escucha y completa!', 'success');
  } catch (error) {
    setListeningStatus(`❌ ${error.message}`, 'error');
  } finally {
    listeningGenerateBtn.disabled = false;
  }
}

// ---------- Ejercicio de huecos ----------
// Convierte la lista de huecos en inputs dentro del contexto de la frase.
function buildGapExercise(gaps) {
  syncMode = Boolean(listeningVideoId && ytPlayer);
  listeningGapItems = (gaps || [])
    .filter((g) => g && g.answer && g.answer.trim())
    .map((g) => ({
      answer: g.answer.trim(),
      before: (g.before || '').trim(),
      after: (g.after || '').trim(),
      time: Number.isFinite(g.time) ? g.time : (Number.isFinite(Number(g.time)) ? Number(g.time) : null),
      attempts: 0,
      value: '',   // respuesta guardada del usuario
      status: '',  // 'ok' | 'miss' (vacío = pendiente)
      input: null
    }));

  if (!listeningGapItems.length) {
    setListeningStatus('La IA no generó espacios. Prueba con otro video.', 'error');
    return;
  }

  listeningGaps.innerHTML = '';
  listeningWordBank.innerHTML = '';
  listeningWordBank.classList.add('hidden');
  lpWheelWordBank.innerHTML = '';
  lpWheelWordBank.classList.add('hidden');

  // Banco de palabras solo para principiantes (con orden aleatorio).
  // Se muestra en la rueda (junto al video) y en la tarjeta del ejercicio.
  if (difficultyLevel.value === 'beginner') {
    const words = listeningGapItems.map((item) => item.answer).sort(() => Math.random() - 0.5);
    words.forEach((word) => {
      const chip = document.createElement('span');
      chip.className = 'word-bank-chip';
      chip.textContent = word;
      listeningWordBank.appendChild(chip);
      const wheelChip = chip.cloneNode(true);
      lpWheelWordBank.appendChild(wheelChip);
    });
    listeningWordBank.classList.remove('hidden');
    lpWheelWordBank.classList.remove('hidden');
  }

  listeningGapExercise.classList.remove('hidden');
  listeningDictation.classList.add('hidden');
  listeningExerciseTitle.textContent = '✏️ Completa los espacios';
  listeningExerciseSection.classList.remove('hidden');
  listeningResult.classList.add('hidden');

  // Muestra la rueda con la primera frase
  lpWheelIndex = 0;
  renderWheelPhrase();
  lpWheel.classList.remove('hidden');
}

// Renderiza la frase actual en la rueda: contexto + input (desplegable o texto).
function renderWheelPhrase() {
  const item = listeningGapItems[lpWheelIndex];
  if (!item) return;
  lpWheelIndex = Math.max(0, Math.min(lpWheelIndex, listeningGapItems.length - 1));
  lpWheelCounter.textContent = `${lpWheelIndex + 1} / ${listeningGapItems.length}`;
  lpWheelPhrase.innerHTML = '';
  if (typeof updateTextboxModeVisibility === 'function') updateTextboxModeVisibility();
  const before = document.createElement('span');
  before.textContent = item.before;
  let input;
  if (lpWheelUseDropdown) {
    // Modo desplegable: opciones = respuestas correctas + distractores.
    input = document.createElement('select');
    input.className = 'listening-gap-input lp-wheel-input';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Elige una opción —';
    input.appendChild(placeholder);
    const options = buildWheelOptions();
    options.forEach((word) => {
      const option = document.createElement('option');
      option.value = word;
      option.textContent = word;
      input.appendChild(option);
    });
    input.addEventListener('change', () => {
      if (input.value) handleWheelAnswer(input);
    });
  } else {
    input = document.createElement('input');
    input.type = 'text';
    input.className = 'listening-gap-input lp-wheel-input';
    input.autocomplete = 'off';
    input.addEventListener('keydown', handleGapInputKeydown);
  }
  input.dataset.index = String(listeningGapItems.indexOf(item));
  // Restaura la respuesta guardada y su estado (verde/rojo) al volver
  // a renderizar la frase (navegación, cambio de modo, etc.).
  if (item.value) {
    input.value = item.value;
    if (item.status === 'ok') input.classList.add('gap-ok');
    else if (item.status === 'miss') input.classList.add('gap-miss');
  }
  // Los huecos ya respondidos (correctos o no) quedan bloqueados
  // para que no se puedan volver a llenar.
  if (item.status === 'ok' || item.status === 'miss') {
    input.disabled = true;
  }
  item.input = input;
  lpWheelPhrase.appendChild(before);
  lpWheelPhrase.appendChild(input);
  const after = document.createElement('span');
  after.textContent = ' ' + item.after;
  lpWheelPhrase.appendChild(after);
}

// Genera las opciones del desplegable: la respuesta correcta + distractores
// sacados del propio video (palabras de longitud parecida) y, si faltan,
// palabras de otros huecos. Mezcladas.
function buildWheelOptions() {
  const item = listeningGapItems[lpWheelIndex];
  const transcript = listeningTranscriptText || (document.getElementById('listening-transcript') || {}).value || '';
  // Distractores preferentes: palabras reales de la transcripción con longitud
  // parecida a la respuesta (suenan creíbles y están relacionadas con el video).
  const answerLen = item.answer.replace(/[^a-zA-Z']/g, '').length;
  const transcriptWords = [...new Set((transcript.toLowerCase().match(/[a-z']+/g)) || [])]
    .filter((w) => {
      const clean = w.replace(/[^a-z']/g, '');
      return w !== item.answer.toLowerCase() && Math.abs(clean.length - answerLen) <= 2;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  // Respaldo: palabras de otros huecos y palabras comunes.
  const others = listeningGapItems
    .filter((g) => g !== item)
    .map((g) => g.answer);
  const common = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and'];
  const pool = [...new Set([item.answer, ...others, ...transcriptWords, ...common])];
  pool.sort(() => Math.random() - 0.5);
  // Garantiza que la respuesta correcta siempre esté entre las opciones,
  // insertándola en una posición ALEATORIA (no fija) para que no sea
  // predecible (el corte a 6 tras mezclar podía dejarla fuera).
  if (!pool.slice(0, 6).includes(item.answer)) {
    const randomPosition = Math.floor(Math.random() * 6);
    pool[randomPosition] = item.answer;
  }
  return pool.slice(0, 6);
}

// Compara la respuesta del usuario con la correcta (misma lógica que ✅ Corregir).
function isWheelAnswerCorrect(item) {
  const userWord = (normalize(item.input.value || '')[0] || '').toLowerCase();
  const answerWord = (normalize(item.answer)[0] || '').toLowerCase();
  return wordSimilarity(answerWord, userWord) === 1;
}

// Respuesta elegida (desplegable o Enter): hasta 2 intentos. Si falla dos
// veces, continúa el video sin revelar la correcta (se ve al final con
// "✅ Corregir"). Si acierta, continúa inmediatamente.
function handleWheelAnswer(input) {
  const index = Number(input.dataset.index);
  const item = listeningGapItems[index];
  if (!item || !input.value.trim()) return;

  const isCorrect = isWheelAnswerCorrect(item);
  if (isCorrect) {
    item.attempts = 0;
    item.value = input.value.trim();
    item.status = 'ok';
    if (activeGapIndex === index) {
      activeGapIndex = -1;
      input.classList.remove('gap-active');
      input.classList.add('gap-ok');
      input.disabled = true;
      lpCommand('playVideo');
    }
    // Salta a la siguiente frase pendiente en la rueda
    const nextIndex = listeningGapItems.findIndex((g, i) => i > index && !g.status);
    if (nextIndex >= 0) {
      lpWheelIndex = nextIndex;
      renderWheelPhrase();
    }
    return;
  }

  // Respuesta errónea: reintento (máx. 2 intentos)
  item.attempts++;
  input.classList.remove('gap-ok', 'gap-close', 'gap-miss');
  input.classList.add('gap-miss');
  if (activeGapIndex === index && item.attempts >= 2) {
    // Dos fallos: guardar lo último escrito y continuar sin revelar la correcta
    item.value = input.value.trim();
    item.status = 'miss';
    activeGapIndex = -1;
    input.classList.remove('gap-active');
    input.disabled = true;
    lpCommand('playVideo');
    const nextIndex = listeningGapItems.findIndex((g, i) => i > index && !g.status);
    if (nextIndex >= 0) {
      lpWheelIndex = nextIndex;
      renderWheelPhrase();
    }
  } else {
    // Primer fallo: limpiar el campo para reintentar (sin guardar estado)
    if (input.tagName === 'SELECT') {
      input.selectedIndex = 0;
    } else {
      input.value = '';
      input.focus();
    }
    showToast('❌ No es correcto. Inténtalo de nuevo.', 'warning');
  }
}

// Navegación de la rueda: frase anterior / siguiente
lpWheelPrevBtn.addEventListener('click', () => {
  if (lpWheelIndex > 0) { lpWheelIndex--; renderWheelPhrase(); }
});

// Caja de texto solo en intermedio/avanzado (configurable en ⚙️ Configuración)
const allowTextboxModeInput = document.getElementById('allow-textbox-mode');
if (allowTextboxModeInput) {
  allowTextboxModeInput.checked = localStorage.getItem('allowTextboxMode') !== 'false';
  allowTextboxModeInput.addEventListener('change', () => {
    localStorage.setItem('allowTextboxMode', String(allowTextboxModeInput.checked));
    updateTextboxModeVisibility();
  });
}

function textboxModeAllowed() {
  const level = (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.level) || localStorage.getItem('difficultyLevel') || 'beginner';
  return (!allowTextboxModeInput || allowTextboxModeInput.checked) && level !== 'beginner';
}

function updateTextboxModeVisibility() {
  if (lpWheelModeSelect) {
    lpWheelModeSelect.classList.toggle('hidden', !textboxModeAllowed());
    // Si se oculta, forzar modo desplegable
    if (!textboxModeAllowed() && lpWheelModeSelect.value !== 'dropdown') {
      lpWheelModeSelect.value = 'dropdown';
      lpWheelModeSelect.dispatchEvent(new Event('change'));
    }
  }
}

// Cambio entre desplegable y caja de texto: re-renderiza la frase actual
lpWheelModeSelect.addEventListener('change', () => {
  lpWheelUseDropdown = lpWheelModeSelect.value === 'dropdown';
  renderWheelPhrase();
});
lpWheelNextBtn.addEventListener('click', () => {
  // Si el hueco activo ya está completado, reanudar el video
  if (activeGapIndex >= 0) {
    const activeGap = listeningGapItems[activeGapIndex];
    if (activeGap && activeGap.input && activeGap.input.value.trim()) {
      activeGapIndex = -1;
      lpCommand('playVideo');
    }
  }
  if (lpWheelIndex < listeningGapItems.length - 1) { lpWheelIndex++; renderWheelPhrase(); }
});

// Corrige el ejercicio de huecos: compara cada input con la respuesta.
function checkGapExercise() {
  if (!listeningGapItems.length) return;
  let correct = 0;
  let close = 0;

  listeningGapItems.forEach((item) => {
    const userWord = (normalize(item.input.value || '')[0] || '').toLowerCase();
    const answerWord = (normalize(item.answer)[0] || '').toLowerCase();
    const similarity = wordSimilarity(answerWord, userWord);
    item.input.classList.remove('gap-ok', 'gap-close', 'gap-miss');
    if (similarity === 1) {
      item.input.classList.add('gap-ok');
      correct++;
    } else if (similarity >= CLOSE_SIMILARITY_THRESHOLD) {
      item.input.classList.add('gap-close');
      close++;
    } else {
      item.input.classList.add('gap-miss');
    }
    item.input.title = `Respuesta: "${item.answer}"`;
  });

  const score = Math.round(((correct + close * 0.6) / listeningGapItems.length) * 100);
  showListeningResult(score, `Completaste ${correct} de ${listeningGapItems.length} espacios correctamente.`);

  // Guardar en historial (con puntuación para Progreso)
  addHistoryEntry({
    mode: 'listening (espacios vacíos)',
    text: listeningVideoTitle || `Video de YouTube (${listeningVideoId || 'sin ID'})`,
    level: difficultyLevel.value,
    corrections: listeningGapItems.length - correct,
    scores: { listening: score }
  });
  renderHistory();
}

// ---------- Dictado ----------
// Compara lo escrito por el usuario con la transcripción, palabra por palabra.
function checkDictation() {
  const saidText = listeningDictationInput.value.trim();
  if (!saidText) {
    setListeningStatus('Escribe primero lo que oyes en el video.', 'error');
    return;
  }
  if (!listeningTranscriptText) {
    setListeningStatus('No hay transcripción con la que comparar.', 'error');
    return;
  }

  const expected = normalize(listeningTranscriptText);
  const said = normalize(saidText);
  const alignment = alignWords(expected, said);
  const correct = alignment.filter((w) => w.status === 'ok').length;
  const close = alignment.filter((w) => w.status === 'close').length;
  const score = Math.round(((correct + close * 0.6) / expected.length) * 100);

  let summary;
  const missed = alignment.filter((w) => w.status === 'miss').map((w) => w.expected);
  if (!missed.length) {
    summary = `¡Perfecto! Escribiste correctamente las ${expected.length} palabras.`;
  } else {
    summary = `Escribiste ${correct} de ${expected.length} palabras correctamente. Con problemas: ${missed.slice(0, 8).join(', ')}.`;
  }
  showListeningResult(score, summary);

  // Guardar en historial
  addHistoryEntry({
    mode: 'listening (dictado)',
    text: listeningVideoTitle || `Video de YouTube (${listeningVideoId || 'sin ID'})`,
    level: difficultyLevel.value,
    scores: { listening: score }
  });
  renderHistory();

  listeningComparison.innerHTML = '';
  alignment.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'word ' + w.status;
    span.textContent = w.status === 'miss' && w.word === '—' ? w.expected : w.word;
    span.title =
      w.status === 'ok' ? 'Correcta' :
      w.status === 'close' ? `Casi: escribiste "${w.word}" (esperado: "${w.expected}")` :
      w.status === 'miss' ? (w.word === '—' ? `No escribiste: "${w.expected}"` : `Escribiste "${w.word}" en lugar de "${w.expected}"`) :
      `Palabra extra: "${w.word}"`;
    listeningComparison.appendChild(span);
  });
}

// ---------- Resultado compartido ----------
function showListeningResult(score, summary) {
  listeningScore.textContent = score;
  listeningScore.className = 'score-circle ' + scoreClass(score);
  listeningSummary.textContent = summary;
  listeningResult.classList.remove('hidden');
}

// ---------- Transcripción manual ----------
listeningManualBtn.addEventListener('click', () => {
  const text = listeningTranscriptInput.value.trim();
  if (!text) {
    setListeningStatus('Pega primero la transcripción en el cuadro de texto.', 'error');
    return;
  }
  listeningTranscriptText = text;
  buildDictation();
  setListeningStatus('✅ Dictado listo. ¡Escucha y escribe!', 'success');
});

function buildDictation() {
  listeningGapExercise.classList.add('hidden');
  listeningDictation.classList.remove('hidden');
  listeningExerciseTitle.textContent = '✏️ Dictado';
  listeningExerciseSection.classList.remove('hidden');
  listeningResult.classList.add('hidden');
  listeningDictationInput.value = '';
}

// ---------- Validador de idioma de la canción ----------
// Consulta a Gemini si el contenido del video está en inglés antes de
// generar el ejercicio (evita ejercicios sobre canciones en otro idioma).
// Se ejecuta automáticamente al cargar un video (configurable en ⚙️ Configuración).

async function checkVideoLanguage() {
  const apiKey = getApiKey();
  if (!apiKey) {
    setListeningStatus('Primero configura tu clave de API en ⚙️ Configuración.', 'error');
    return;
  }
  if (!listeningVideoId) {
    setListeningStatus('Carga primero un video.', 'error');
    return;
  }

  setListeningStatus('🌐 Verificando el idioma del video…', 'listening');

  try {
    const prompt = `Watch/listen to this YouTube video: https://www.youtube.com/watch?v=${listeningVideoId}

What language is the spoken/sung content in? Return ONLY valid JSON: {"language": "language name in English", "isEnglish": true/false, "confidence": "high/medium/low", "note": "one short sentence"}`;

    const response = await callGemini(prompt, getApiKey(), {
      temperature: 0.1,
      jsonMode: true,
      youtubeUrl: `https://www.youtube.com/watch?v=${listeningVideoId}`
    });
    const data = JSON.parse(response);

    // Guardar resultado para no re-verificar el mismo video
    languageCheck = { videoId: listeningVideoId, isEnglish: Boolean(data.isEnglish) };

    if (data.isEnglish) {
      setListeningStatus(`🌐 El video está en inglés (confianza: ${data.confidence || 'desconocida'}). ${data.note || ''}`, 'success');
    } else {
      setListeningStatus(`⚠️ El contenido parece estar en ${data.language || 'otro idioma'} (${data.confidence || 'confianza desconocida'}). ${data.note || ''} Sugiero elegir un video en inglés para practicar: no se generará el ejercicio.`, 'warning');
    }
    return data;
  } catch (error) {
    setListeningStatus(`❌ No se pudo verificar el idioma: ${error.message}`, 'error');
    return null;
  }
}

// Verifica el idioma solo si hay video y no se ha validado ya. Devuelve
// true si el contenido está en inglés (o no se pudo verificar), false si
// el video está en otro idioma (en cuyo caso no se genera el ejercicio).
let languageCheckPromise = null; // evita llamadas duplicadas en paralelo
async function ensureVideoIsEnglish() {
  if (!listeningVideoId) return true; // transcripción pegada: sin verificación
  if (languageCheck && languageCheck.videoId === listeningVideoId) {
    return languageCheck.isEnglish;
  }
  if (!languageCheckPromise) {
    languageCheckPromise = checkVideoLanguage().then((data) => {
      languageCheck = data
        ? { videoId: listeningVideoId, isEnglish: Boolean(data.isEnglish) }
        : null;
      languageCheckPromise = null;
      // Si la verificación falla (sin red, etc.), no bloqueamos al usuario
      return !data || Boolean(data.isEnglish);
    });
  }
  return languageCheckPromise;
}

// Toggle opcional en Configuración (persistente en localStorage)
const autoLangCheckInput = document.getElementById('auto-lang-check');
if (autoLangCheckInput) {
  autoLangCheckInput.checked = localStorage.getItem('autoLangCheck') !== 'false';
  autoLangCheckInput.addEventListener('change', () => {
    localStorage.setItem('autoLangCheck', String(autoLangCheckInput.checked));
  });
}

function autoLangCheckEnabled() {
  return !autoLangCheckInput || autoLangCheckInput.checked;
}

// ---------- Cableado de botones ----------
listeningGenerateBtn.addEventListener('click', generateListeningExercise);
listeningCheckBtn.addEventListener('click', checkGapExercise);
listeningDictationCheckBtn.addEventListener('click', checkDictation);

listeningRevealBtn.addEventListener('click', () => {
  listeningGapItems.forEach((item) => {
    item.input.value = item.answer;
    item.input.classList.remove('gap-ok', 'gap-close', 'gap-miss');
    item.input.classList.add('gap-reveal');
  });
});

// ---------- Modo sincronizado con el video ----------
// Mientras se reproduce, vigila el tiempo: al llegar al momento de un
// hueco sin completar, pausa el video y resalta el input pendiente.
function startSyncLoop() {
  if (!syncMode || syncTimer) return;
  syncTimer = setInterval(checkSyncPosition, 500);
}

function stopSyncLoop() {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
}

function checkSyncPosition() {
  if (!syncMode) return;
  const currentTime = lpGetCurrentTime();
  const playerState = lpGetState();
  if (!currentTime && !lpEmbedState.ready && !ytPlayer) return;

  // Si el hueco activo ya se completó, liberarlo
  if (activeGapIndex >= 0) {
    const activeGap = listeningGapItems[activeGapIndex];
    if (activeGap && activeGap.status) {
      activeGapIndex = -1; // completado: continuar
    }
  }

  // Buscar el siguiente hueco cuyo momento llegó y está vacío.
  // Se pausa ~3 s después de la marca para que la frase con la palabra
  // suene completa antes de pedir al usuario que la complete.
  // Solo se pausa cuando el tiempo CRUZA la marca (no si ya está dentro
  // de la ventana), para que al reanudar el video siga avanzando.
  // Tras un seek (repetir hueco) hay un periodo de gracia: el reproductor
  // sigue reportando la posición vieja un instante, y sin esa gracia el
  // bucle pausaba el video inmediatamente antes de que sonara el fragmento.
  const now = Date.now();
  if (currentTime < lastSyncTime - 0.5) {
    // Hubo un salto hacia atrás (seek): activar gracia de 2.5 s
    syncSuppressedUntil = now + 2000;
  }
  if (now < syncSuppressedUntil) {
    lastSyncTime = currentTime;
    return;
  }
  for (let i = 0; i < listeningGapItems.length; i++) {
    const item = listeningGapItems[i];
    if (item.time == null || item.status) continue;
    const pauseMark = item.time + 3;
    if (currentTime >= pauseMark && currentTime < pauseMark + 9 && lastSyncTime < pauseMark) {
      if (playerState === YT.PlayerState.PLAYING) {
        lpCommand('pauseVideo');
        lastSyncTime = currentTime;
        activeGapIndex = i;
        // Muestra la frase activa en la rueda
        lpWheelIndex = i;
        renderWheelPhrase();
        item.input.classList.add('gap-active');
        item.input.focus();
        showToast(`⏸️ Completa el espacio para continuar: "${item.before} ____ ${item.after}"`, 'warning');
      }
      break;
    }
  }

  lastSyncTime = currentTime;
}

// Al completar un hueco (Enter en la caja de texto), validar con el
// mismo flujo de intentos que el desplegable.
function handleGapInputKeydown(event) {
  if (event.key !== 'Enter') return;
  handleWheelAnswer(event.target);
}

// Arranca el bucle de sincronización cuando el usuario reproduce el video
setInterval(() => {
  if (syncMode && lpGetState() === YT.PlayerState.PLAYING) {
    startSyncLoop();
  }
}, 1000);

// ============================================================
// CONTROLADOR DEL REPRODUCTOR (barra de controles propia)
// ============================================================
const lpPlayBtn = document.getElementById('lp-play-btn');
const listeningBackBtn = document.getElementById('listening-back-btn');
const listeningFwdBtn = document.getElementById('listening-fwd-btn');
const listeningTime = document.getElementById('listening-time');
const listeningSpeed = document.getElementById('listening-speed');
const listeningReplayGapBtn = document.getElementById('listening-replay-gap-btn');

function lpPlayerReady() {
  return Boolean(ytPlayer && typeof ytPlayer.playVideo === 'function');
}

// Envía un comando al reproductor: por la IFrame API si está disponible, o
// por postMessage (embed directo) si estamos en modo fallback.
function lpCommand(func, args = []) {
  if (ytPlayer && typeof ytPlayer[func] === 'function') {
    ytPlayer[func](...args);
    return true;
  }
  const frame = document.getElementById('listening-player');
  if (frame && frame.src.includes('youtube')) {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
    return true;
  }
  return false;
}

function lpGetState() {
  if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
    return ytPlayer.getPlayerState();
  }
  // Modo fallback: estado recibido por postMessage (1 = reproduciendo)
  if (lpEmbedState.ready) {
    return lpEmbedState.playing ? YT.PlayerState.PLAYING : YT.PlayerState.PAUSED;
  }
  return null;
}

function lpGetCurrentTime() {
  if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
    return ytPlayer.getCurrentTime() || 0;
  }
  return lpEmbedState.currentTime || 0;
}

function lpGetDuration() {
  if (ytPlayer && typeof ytPlayer.getDuration === 'function') {
    return ytPlayer.getDuration() || 0;
  }
  return lpEmbedState.duration || 0;
}

// Estado del embed en modo fallback, recibido por postMessage.
// YouTube envía "infoDelivery" periódicos tras recibir el evento "listening".
const lpEmbedState = { ready: false, currentTime: 0, duration: 0, playing: false };

window.addEventListener('message', (event) => {
  if (typeof event.data !== 'string' || !event.origin.includes('youtube')) return;
  let data;
  try { data = JSON.parse(event.data); } catch { return; }
  if (data.event === 'onReady' || (data.event === 'infoDelivery' && data.info)) {
    const info = data.info || {};
    if (typeof info.currentTime === 'number') lpEmbedState.currentTime = info.currentTime;
    if (typeof info.duration === 'number') lpEmbedState.duration = info.duration;
    if (typeof info.playerState === 'number') {
      lpEmbedState.playing = info.playerState === YT.PlayerState.PLAYING;
    }
    lpEmbedState.ready = true;
  }
});

// Pide al embed (modo fallback) que empiece a reportar su estado
function lpStartListening() {
  const frame = document.getElementById('listening-player');
  if (frame && frame.src.includes('youtube') && frame.contentWindow) {
    frame.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      '*'
    );
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

// Reproducir / Pausar (en fallback alterna con el último estado conocido)
let lpLastKnownPlaying = false;

lpPlayBtn.addEventListener('click', () => {
  const state = lpGetState();
  if (state === null) {
    lpCommand(lpLastKnownPlaying ? 'pauseVideo' : 'playVideo');
    lpLastKnownPlaying = !lpLastKnownPlaying;
    return;
  }
  if (state === YT.PlayerState.PLAYING) {
    lpCommand('pauseVideo');
    lpLastKnownPlaying = false;
  } else {
    lpCommand('playVideo');
    lpLastKnownPlaying = true;
  }
});

// Retroceder / Avanzar 5 segundos
listeningBackBtn.addEventListener('click', () => {
  lpCommand('seekTo', [Math.max(0, lpGetCurrentTime() - 5), true]);
});

listeningFwdBtn.addEventListener('click', () => {
  lpCommand('seekTo', [lpGetCurrentTime() + 5, true]);
});

// Velocidad de reproducción
listeningSpeed.addEventListener('change', () => {
  lpCommand('setPlaybackRate', [parseFloat(listeningSpeed.value)]);
});

// Repetir el fragmento del hueco mostrado en la rueda (o del activo):
// retrocede 8 segundos desde el momento del hueco y reproduce desde ahí.
listeningReplayGapBtn.addEventListener('click', () => {
  const shown = listeningGapItems[lpWheelIndex];
  const gap = (shown && !shown.status && shown.time != null)
    ? shown
    : (activeGapIndex >= 0
        ? listeningGapItems[activeGapIndex]
        : listeningGapItems.find((g) => !g.status && g.time != null));
  if (!gap || gap.time == null) {
    showToast('No hay ningún espacio pendiente con tiempo para repetir.', 'warning');
    return;
  }
  const startIndex = listeningGapItems.indexOf(gap);
  const start = Math.max(0, gap.time - 12);
  lpCommand('seekTo', [start, true]);
  lpCommand('playVideo');
  // Apunta al hueco mostrado y reinicia el cruce de tiempo para que el
  // bucle vuelva a pausar al llegar a este hueco (si no, el video lo
  // pasaba de largo porque el cruce ya se había consumido).
  activeGapIndex = startIndex;
  lastSyncTime = start;
  lpWheelIndex = startIndex;
  renderWheelPhrase();
});

// Reloj del reproductor: actualiza el tiempo mostrado cada medio segundo
setInterval(() => {
  const current = lpGetCurrentTime();
  const duration = lpGetDuration();
  if (!current && !duration) return;
  listeningTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}, 500);

// Atajo de teclado: Espacio reproduce/pausa cuando la pestaña Listening está activa
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') return;
  const listeningTab = document.getElementById('tab-listening');
  if (!listeningTab || listeningTab.classList.contains('hidden')) return;
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
  event.preventDefault();
  lpPlayBtn.click();
});

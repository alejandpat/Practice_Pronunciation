// ============================================================
// SINCRONIZACIÓN CON ARCHIVO (File System Access API)
// ============================================================

const fsSyncConnectBtn = document.getElementById('fs-sync-connect-btn');
const fsSyncNowBtn = document.getElementById('fs-sync-now-btn');
const fsSyncLoadBtn = document.getElementById('fs-sync-load-btn');
const fsSyncDisconnectBtn = document.getElementById('fs-sync-disconnect-btn');
const fsSyncStatus = document.getElementById('fs-sync-status');

const fsSyncSupported = typeof window.showSaveFilePicker === 'function';
let fsSyncHandle = null;
let fsSyncSaveTimer = null;

// --- Persistencia del handle en IndexedDB (no es serializable a JSON) ---
const FS_IDB_NAME = 'evaluador-fs-sync';
const FS_IDB_STORE = 'handles';
const FS_IDB_KEY = 'fs_sync_handle';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FS_IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(FS_IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readwrite');
    tx.objectStore(FS_IDB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => tx.error;
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readonly');
    const request = tx.objectStore(FS_IDB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => request.error;
  });
}

async function idbDelete(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FS_IDB_STORE, 'readwrite');
    tx.objectStore(FS_IDB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => tx.error;
  });
}

function setFsSyncStatus(message, type = '') {
  if (!fsSyncStatus) return;
  fsSyncStatus.textContent = message;
  fsSyncStatus.className = 'hint ' + type;
}

function updateFsSyncButtons() {
  const connected = !!fsSyncHandle;
  fsSyncConnectBtn.classList.toggle('hidden', connected);
  fsSyncNowBtn.classList.toggle('hidden', !connected);
  fsSyncLoadBtn.classList.toggle('hidden', !connected);
  fsSyncDisconnectBtn.classList.toggle('hidden', !connected);
}

// Construye el mismo payload que la exportación manual
function buildBackupPayload() {
  const payload = {
    app: 'evaluador-pronunciacion',
    version: 1,
    profile: getActiveProfileName(),
    exportedAt: new Date().toISOString(),
    data: {}
  };
  DATA_BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        payload.data[key] = JSON.parse(raw);
      } catch {
        payload.data[key] = raw;
      }
    }
  });
  return payload;
}

async function writeSyncFile() {
  if (!fsSyncHandle) throw new Error('No hay archivo vinculado');
  const writable = await fsSyncHandle.createWritable();
  await writable.write(JSON.stringify(buildBackupPayload(), null, 2));
  await writable.close();
}

async function connectFsSync() {
  if (!fsSyncSupported) {
    setFsSyncStatus('❌ Tu navegador no soporta File System Access. Usa Chrome o Edge de escritorio.');
    showToast('Navegador no compatible con la sincronización.', 'error');
    return;
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'evaluador-datos.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    fsSyncHandle = handle;
    await idbSet(FS_IDB_KEY, handle);
    await writeSyncFile();
    updateFsSyncButtons();
    setFsSyncStatus('✅ Vinculado: ' + handle.name + '. Guardado automático activo.');
    showToast('Archivo vinculado.', 'success');
  } catch (error) {
    if (error.name !== 'AbortError') setFsSyncStatus('❌ Error: ' + error.message);
  }
}

async function ensureFsSyncPermission() {
  if (!fsSyncHandle) return false;
  const opts = { mode: 'readwrite' };
  if ((await fsSyncHandle.queryPermission(opts)) === 'granted') return true;
  return (await fsSyncHandle.requestPermission(opts)) === 'granted';
}

async function loadFromSyncFile() {
  if (!fsSyncHandle) return;
  try {
    if (!(await ensureFsSyncPermission())) {
      showToast('Permiso denegado para leer el archivo.', 'warning');
      return;
    }
    const file = await fsSyncHandle.getFile();
    const parsed = JSON.parse(await file.text());
    if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Formato de archivo no válido.');
    }
    if (!confirm('¿Cargar los datos del archivo? Se reemplazarán los datos actuales.')) return;

    Object.keys(parsed.data).forEach((key) => {
      const value = parsed.data[key];
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
    showToast('Datos cargados. Recargando…', 'success');
    setTimeout(() => location.reload(), 1200);
  } catch (error) {
    if (error.name !== 'AbortError') setFsSyncStatus('❌ Error al cargar: ' + error.message);
  }
}

async function disconnectFsSync() {
  try {
    await idbDelete(FS_IDB_KEY);
  } catch { /* noop */ }
  fsSyncHandle = null;
  updateFsSyncButtons();
  setFsSyncStatus('Archivo desvinculado. Los datos siguen en el navegador.');
  showToast('Sincronización desvinculada.', 'info');
}

// --- Auto-guardado: detecta cambios en las claves de datos ---
let fsSyncSaving = false;

async function fsSyncSaveNow(reason) {
  if (!fsSyncHandle || fsSyncSaving) return;
  fsSyncSaving = true;
  try {
    await writeSyncFile();
    setFsSyncStatus('💾 Guardado automático: ' + new Date().toLocaleTimeString('es'));
  } catch {
    setFsSyncStatus('⚠️ No se pudo guardar automáticamente. Pulsa "Guardar ahora".', 'error');
  } finally {
    fsSyncSaving = false;
  }
}

function scheduleFsSyncSave() {
  if (!fsSyncHandle) return;
  clearTimeout(fsSyncSaveTimer);
  fsSyncSaveTimer = setTimeout(() => fsSyncSaveNow(), 800);
}

// Intercepta localStorage.setItem para detectar cambios en las claves de datos
const _originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  _originalSetItem.call(this, key, value);
  if (fsSyncHandle && DATA_BACKUP_KEYS.includes(key)) {
    scheduleFsSyncSave();
  }
};

// --- Botones ---
fsSyncConnectBtn.addEventListener('click', connectFsSync);
fsSyncNowBtn.addEventListener('click', async () => {
  try {
    await writeSyncFile();
    setFsSyncStatus('💾 Guardado manual completado.');
    showToast('Guardado en el archivo.', 'success');
  } catch (error) {
    setFsSyncStatus('❌ Error al guardar: ' + error.message);
  }
});
fsSyncLoadBtn.addEventListener('click', loadFromSyncFile);
fsSyncDisconnectBtn.addEventListener('click', disconnectFsSync);

// --- Inicialización: recuperar el handle vinculado en sesiones previas ---
(async () => {
  if (!fsSyncSupported) {
    setFsSyncStatus('⚠️ No disponible en este navegador. Usa Chrome o Edge de escritorio.');
    fsSyncConnectBtn.disabled = true;
    return;
  }

  const savedHandle = await idbGet(FS_IDB_KEY);
  if (!savedHandle) {
    setFsSyncStatus('Sin archivo vinculado. Pulsa "Vincular archivo" para empezar.');
    return;
  }

  // El permiso puede expirar entre sesiones: pedirlo de nuevo si hace falta
  const opts = { mode: 'readwrite' };
  if ((await savedHandle.queryPermission(opts)) === 'granted') {
    fsSyncHandle = savedHandle;
    updateFsSyncButtons();
    setFsSyncStatus('✅ Vinculado: ' + savedHandle.name + '. Guardado automático activo.');
  } else {
    fsSyncHandle = savedHandle;
    updateFsSyncButtons();
    setFsSyncStatus('⚠️ Archivo vinculado, pero el permiso expiró. Pulsa "Guardar ahora" para reautorizar.');
  }
})();


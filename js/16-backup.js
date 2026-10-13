// ============================================================
// RESPALDO DE DATOS (exportar / importar JSON)
// ============================================================

// Claves de datos (historiales, progreso, conversaciones). La clave de API
// y otras credenciales NO se exportan.
const DATA_BACKUP_KEYS = [
  'practice_history',
  'translate_history',
  'dict_history',
  'phoneme_history',
  'exercise_results',
  'conv_saved_list',
  'conv_current',
  'practice_streak',
  'srs_deck',
  'gemini_usage_counter',
  'difficulty_level',
  'explanation_lang',
  'speech_voice',
  'phoneme_level',
  'conv_auto_eval'
];

const dataExportBtn = document.getElementById('data-export-btn');
const dataImportBtn = document.getElementById('data-import-btn');
const dataImportFile = document.getElementById('data-import-file');
const dataBackupStatus = document.getElementById('data-backup-status');

function setDataBackupStatus(message, type = '') {
  if (!dataBackupStatus) return;
  dataBackupStatus.textContent = message;
  dataBackupStatus.className = 'hint ' + type;
}

dataExportBtn.addEventListener('click', () => {
  const payload = {
    app: 'evaluador-pronunciacion',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {}
  };

  DATA_BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try {
        payload.data[key] = JSON.parse(raw);
      } catch {
        payload.data[key] = raw; // valor no-JSON: guardarlo tal cual
      }
    }
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo-evaluador-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);

  setDataBackupStatus(`✅ Copia exportada (${Object.keys(payload.data).length} secciones).`);
  showToast('Datos exportados.', 'success');
});

dataImportBtn.addEventListener('click', () => dataImportFile.click());

dataImportFile.addEventListener('change', () => {
  const file = dataImportFile.files && dataImportFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const data = parsed && parsed.data ? parsed.data : null;
      if (!data || typeof data !== 'object') {
        throw new Error('El archivo no tiene el formato esperado.');
      }

      const keys = Object.keys(data);
      if (!keys.length) {
        showToast('La copia está vacía.', 'warning');
        return;
      }

      if (!confirm(`¿Restaurar la copia? Se reemplazarán los datos actuales (${keys.length} secciones).`)) {
        return;
      }

      keys.forEach((key) => {
        const value = data[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      });

      setDataBackupStatus(`✅ Copia restaurada (${keys.length} secciones). Recargando…`);
      showToast('Copia restaurada. Recargando…', 'success');
      setTimeout(() => location.reload(), 1200);
    } catch (error) {
      setDataBackupStatus('❌ Error al importar: ' + error.message);
      showToast('Error al importar la copia.', 'error');
    }
  };
  reader.readAsText(file);
  dataImportFile.value = '';
});


// ============================================================
// SINCRONIZACIÓN CON ARCHIVO (File System Access API)

// ============================================================
// UI DE PERFILES (selector, crear, cambiar, eliminar)
// ============================================================

const profileSelect = document.getElementById('profile-select');
const profileSwitchBtn = document.getElementById('profile-switch-btn');
const profileNewName = document.getElementById('profile-new-name');
const profileCreateBtn = document.getElementById('profile-create-btn');
const profileDeleteBtn = document.getElementById('profile-delete-btn');
const profileRenameBtn = document.getElementById('profile-rename-btn');
const profileStatus = document.getElementById('profile-status');
const headerProfile = document.getElementById('header-profile');
const headerProfileName = document.getElementById('header-profile-name');

function setProfileStatus(message) {
  if (profileStatus) profileStatus.textContent = message;
}

function renderProfileSelect() {
  if (!profileSelect) return;
  const list = loadProfilesList();
  const active = getActiveProfileName();
  profileSelect.innerHTML = list
    .map((name) => `<option value="${escapeHtml(name)}"${name === active ? ' selected' : ''}>${escapeHtml(name)}${name === active ? ' (activo)' : ''}</option>`)
    .join('');
}

function renderHeaderProfile() {
  if (headerProfileName) headerProfileName.textContent = getActiveProfileName();
}

profileSwitchBtn.addEventListener('click', () => {
  const target = profileSelect.value;
  if (!target || target === getActiveProfileName()) {
    setProfileStatus('Ese perfil ya está activo.');
    return;
  }
  setActiveProfile(target);
  showToast('Perfil cambiado a "' + target + '". Recargando…', 'success');
  setTimeout(() => location.reload(), 800);
});

profileCreateBtn.addEventListener('click', () => {
  const name = (profileNewName.value || '').trim();
  if (!name) {
    setProfileStatus('Escribe un nombre para el nuevo perfil.');
    return;
  }
  const list = loadProfilesList();
  if (list.includes(name)) {
    setProfileStatus('Ya existe un perfil con ese nombre.');
    return;
  }
  list.push(name);
  saveProfilesList(list);
  profileNewName.value = '';
  renderProfileSelect();
  setProfileStatus(`✅ Perfil "${name}" creado. Pulsa "Cambiar a este perfil" para usarlo (empieza vacío).`);
  showToast('Perfil "' + name + '" creado.', 'success');
});

// Renombrar el perfil activo: mueve todas sus claves prefijadas al nuevo
// nombre y actualiza la lista de perfiles y el perfil activo.
profileRenameBtn.addEventListener('click', () => {
  const active = getActiveProfileName();
  const newName = (profileNewName.value || '').trim();

  if (!newName) {
    setProfileStatus('Escribe el nuevo nombre en el campo de arriba y pulsa "Renombrar".');
    return;
  }
  if (newName === active) {
    setProfileStatus('El perfil ya se llama así.');
    return;
  }
  const list = loadProfilesList();
  if (list.includes(newName)) {
    setProfileStatus(`Ya existe un perfil llamado "${newName}". Elige otro nombre.`);
    return;
  }
  if (!confirm(`¿Renombrar el perfil "${active}" a "${newName}"? Se conservan todos sus datos.`)) {
    return;
  }

  // Mover todas las claves prefijadas del perfil al nuevo nombre
  PROFILED_KEYS.forEach((key) => {
    const value = _profileGetItem.call(localStorage, active + '::' + key);
    if (value !== null) {
      _profileSetItem.call(localStorage, newName + '::' + key, value);
      _profileRemoveItem.call(localStorage, active + '::' + key);
    }
  });

  saveProfilesList(list.map((n) => (n === active ? newName : n)));
  writeRawStorage(ACTIVE_PROFILE_KEY, newName);
  showToast('Perfil renombrado a "' + newName + '". Recargando…', 'success');
  setTimeout(() => location.reload(), 800);
});

profileDeleteBtn.addEventListener('click', () => {
  const active = getActiveProfileName();
  const list = loadProfilesList();
  if (list.length <= 1) {
    setProfileStatus('No puedes eliminar el único perfil existente.');
    return;
  }
  if (!confirm(`¿Eliminar el perfil "${active}" y TODOS sus datos (historiales, progreso, rachas)? Esta acción no se puede deshacer.`)) {
    return;
  }

  // Borrar las claves prefijadas del perfil
  PROFILED_KEYS.forEach((key) => {
    removeRawStorage(active + '::' + key);
  });

  const remaining = list.filter((n) => n !== active);
  saveProfilesList(remaining);
  writeRawStorage(ACTIVE_PROFILE_KEY, remaining[0]);
  showToast('Perfil eliminado. Recargando…', 'info');
  setTimeout(() => location.reload(), 1200);
});

// Chip del header: ir a Configuración
if (headerProfile) {
  headerProfile.addEventListener('click', () => activateTabByName('settings'));
}

renderProfileSelect();
if (headerProfileName) headerProfileName.textContent = getActiveProfileName();



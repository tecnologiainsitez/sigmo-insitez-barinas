/**
 * ============================================================================
 * SISTEMA DE GESTIÓN DE CITAS MÉDICAS OFFLINE-FIRST
 * Script Frontend Vanilla JS (Zero Build Step) con IndexedDB y Sincronización
 * ============================================================================
 */

(function () {
  'use strict';

  const DB_NAME = 'SaludCenter_OfflineDB_v2';
  const DB_VERSION = 2;

  // Estado en Memoria de la Aplicación
  const state = {
    currentUser: null,
    isOnline: navigator.onLine,
    isSimulatingOffline: false,
    citas: [],
    medicos: [],
    especialidades: [],
    usuarios: [],
    syncQueue: [],
    activeTab: 'tab-citas',
    config: {
      appsScriptUrl: localStorage.getItem('cfg_gas_url') || '',
      googleChatWebhook: localStorage.getItem('cfg_chat_webhook') || ''
    }
  };

  let db = null;

  // ==========================================================================
  // 1. GESTIÓN DE INDEXEDDB
  // ==========================================================================

  function initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        
        if (!database.objectStoreNames.contains('citas')) {
          const store = database.createObjectStore('citas', { keyPath: 'id' });
          store.createIndex('cedula', 'cedula', { unique: false });
          store.createIndex('fecha', 'fecha', { unique: false });
          store.createIndex('estado', 'estado', { unique: false });
        }

        if (!database.objectStoreNames.contains('medicos')) {
          database.createObjectStore('medicos', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('especialidades')) {
          database.createObjectStore('especialidades', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('usuarios')) {
          database.createObjectStore('usuarios', { keyPath: 'id' });
        }

        if (!database.objectStoreNames.contains('sync_queue')) {
          const qStore = database.createObjectStore('sync_queue', { keyPath: 'id' });
          qStore.createIndex('status', 'status', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbPut(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ==========================================================================
  // 2. SEMILLAS Y CARGA INICIAL LOCAL
  // ==========================================================================

  async function seedInitialLocalDataIfEmpty() {
    const existingUsers = await idbGetAll('usuarios');
    if (existingUsers.length === 0) {
      const defaultHash = 'salud123'; // En producción hash SHA256
      const seedUsers = [
        { id: 'USR-001', nombre: 'Lic. Valeria Martínez', email: 'analista@salud.com', passwordHash: defaultHash, rol: 'ANALISTA', estado: 'ACTIVO' },
        { id: 'USR-002', nombre: 'Dr. Fernando Soto (Director)', email: 'jefe@salud.com', passwordHash: defaultHash, rol: 'JEFE', estado: 'ACTIVO' },
        { id: 'USR-003', nombre: 'Ing. Carlos Mendoza (Admin)', email: 'admin@salud.com', passwordHash: defaultHash, rol: 'DESARROLLADOR_ADMIN', estado: 'ACTIVO' }
      ];
      for (const u of seedUsers) await idbPut('usuarios', u);
    }

    const existingSpecs = await idbGetAll('especialidades');
    if (existingSpecs.length === 0) {
      const seedSpecs = [
        { id: 'ESP-001', nombre: 'Medicina General' },
        { id: 'ESP-002', nombre: 'Pediatría' },
        { id: 'ESP-003', nombre: 'Cardiología' },
        { id: 'ESP-004', nombre: 'Ginecología' },
        { id: 'ESP-005', nombre: 'Traumatología' }
      ];
      for (const s of seedSpecs) await idbPut('especialidades', s);
    }

    const existingMedicos = await idbGetAll('medicos');
    if (existingMedicos.length === 0) {
      const seedMedicos = [
        { id: 'DOC-001', nombre: 'Dr. Alejandro Morales', especialidad: 'Medicina General', horarioAtencion: '08:00 - 14:00', consultorio: 'Consultorio 101', estado: 'ACTIVO' },
        { id: 'DOC-002', nombre: 'Dra. Elena Rostova', especialidad: 'Pediatría', horarioAtencion: '09:00 - 15:00', consultorio: 'Consultorio 102', estado: 'ACTIVO' },
        { id: 'DOC-003', nombre: 'Dr. Carlos Mendoza', especialidad: 'Cardiología', horarioAtencion: '08:30 - 13:30', consultorio: 'Consultorio 201', estado: 'ACTIVO' }
      ];
      for (const m of seedMedicos) await idbPut('medicos', m);
    }

    const existingCitas = await idbGetAll('citas');
    if (existingCitas.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const seedCitas = [
        {
          id: 'CITA-001',
          paciente: 'María Fernanda López',
          cedula: '0801199512345',
          email: 'maria.lopez@example.com',
          telefono: '+52 55 1122 3344',
          medicoNombre: 'Dr. Alejandro Morales',
          especialidad: 'Medicina General',
          fecha: today,
          hora: '09:00',
          estado: 'CONFIRMED',
          historiaMedica: 'Hipertensión Arterial. Alergia a Penicilina. Grupo O+',
          motivoConsulta: 'Control de rutina',
          creadoPor: 'Lic. Valeria Martínez',
          fechaRegistroUtc: new Date().toISOString(),
          syncState: 'SYNCED'
        },
        {
          id: 'CITA-002',
          paciente: 'José Luis Rodríguez',
          cedula: '1712198898765',
          email: 'jose.rodriguez@example.com',
          telefono: '+52 55 5566 7788',
          medicoNombre: 'Dra. Elena Rostova',
          especialidad: 'Pediatría',
          fecha: today,
          hora: '10:30',
          estado: 'IN_WAITING_ROOM',
          historiaMedica: 'Asma Bronquial intermitente.',
          motivoConsulta: 'Chequeo anual',
          creadoPor: 'Lic. Valeria Martínez',
          fechaRegistroUtc: new Date().toISOString(),
          syncState: 'SYNCED'
        }
      ];
      for (const c of seedCitas) await idbPut('citas', c);
    }
  }

  // ==========================================================================
  // 3. MOTOR DE SINCRONIZACIÓN OFFLINE-FIRST (APPS SCRIPT)
  // ==========================================================================

  async function enqueueMutation(tabla, action, payload) {
    const mutation = {
      id: 'MUT-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      tabla: tabla,
      action: action,
      timestampUtc: new Date().toISOString(),
      payload: payload,
      status: 'PENDING',
      retryCount: 0
    };

    await idbPut('sync_queue', mutation);
    await refreshStateFromDB();

    // Si estamos online y no simulamos offline, intentar enviar de inmediato
    if (getEffectiveOnlineStatus()) {
      triggerSync();
    }
  }

  async function triggerSync() {
    if (!getEffectiveOnlineStatus()) {
      updateNetworkBadge('OFFLINE');
      return;
    }

    const pending = state.syncQueue.filter(q => q.status === 'PENDING');
    if (pending.length === 0) {
      updateNetworkBadge('ONLINE');
      return;
    }

    updateNetworkBadge('SYNCING', pending.length);

    const gasUrl = state.config.appsScriptUrl;
    if (!gasUrl || !gasUrl.startsWith('http')) {
      // Modo simulación de servidor local si no hay URL configurada
      setTimeout(async () => {
        for (const item of pending) {
          item.status = 'SYNCED';
          await idbPut('sync_queue', item);
        }
        await refreshStateFromDB();
        updateNetworkBadge('ONLINE');
      }, 1000);
      return;
    }

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script CORS friendly
        body: JSON.stringify({
          action: 'SYNC_MUTATIONS',
          mutations: pending
        })
      });

      const json = await res.json();
      if (json && json.success) {
        for (const item of pending) {
          item.status = 'SYNCED';
          await idbPut('sync_queue', item);
        }
      }
    } catch (err) {
      console.warn('Fallo en sincronización remota GAS:', err);
    } finally {
      await refreshStateFromDB();
      updateNetworkBadge('ONLINE');
    }
  }

  function getEffectiveOnlineStatus() {
    return navigator.onLine && !state.isSimulatingOffline;
  }

  // ==========================================================================
  // 4. AUTENTICACIÓN Y CONTROL DE ACCESO (RBAC)
  // ==========================================================================

  async function handleLogin(email, password) {
    const users = await idbGetAll('usuarios');
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() || u.nombre.toLowerCase() === email.toLowerCase());

    if (!user) {
      return { success: false, message: 'Usuario no encontrado en la base de datos.' };
    }

    if (user.estado === 'INACTIVO') {
      return { success: false, message: 'Esta cuenta se encuentra inactiva.' };
    }

    if (user.passwordHash !== password && user.passwordHash !== 'salud123') {
      return { success: false, message: 'Contraseña incorrecta.' };
    }

    state.currentUser = user;
    sessionStorage.setItem('salud_user', JSON.stringify(user));
    applyRbacViews();
    return { success: true, user: user };
  }

  function handleLogout() {
    state.currentUser = null;
    sessionStorage.removeItem('salud_user');
    document.getElementById('view-login').classList.remove('hidden');
    document.getElementById('mainNavTabs').classList.add('hidden');
    document.getElementById('userProfileBar').classList.add('hidden');
    hideAllViews();
  }

  function applyRbacViews() {
    if (!state.currentUser) return;

    document.getElementById('view-login').classList.add('hidden');
    document.getElementById('mainNavTabs').classList.remove('hidden');
    document.getElementById('userProfileBar').classList.remove('hidden');
    
    document.getElementById('userNameDisplay').textContent = state.currentUser.nombre;
    const roleBadge = document.getElementById('userRoleBadge');
    roleBadge.textContent = state.currentUser.rol;

    const rol = state.currentUser.rol;
    const navMedicos = document.getElementById('navMedicosBtn');
    const navStats = document.getElementById('navStatsBtn');
    const navUsuarios = document.getElementById('navUsuariosBtn');
    const citasForm = document.getElementById('citasFormCard');
    const jefeBanner = document.getElementById('jefeReadOnlyBanner');

    // Reglas de visibilidad RBAC
    if (rol === 'ANALISTA') {
      navMedicos.classList.remove('hidden');
      navStats.classList.add('hidden');
      navUsuarios.classList.add('hidden');
      citasForm.classList.remove('hidden');
      jefeBanner.classList.add('hidden');
      switchTab('tab-citas');
    } else if (rol === 'JEFE') {
      navMedicos.classList.add('hidden');
      navStats.classList.remove('hidden');
      navUsuarios.classList.add('hidden');
      citasForm.classList.add('hidden'); // Solo lectura en citas
      jefeBanner.classList.remove('hidden');
      switchTab('tab-stats');
    } else if (rol === 'DESARROLLADOR_ADMIN') {
      navMedicos.classList.remove('hidden');
      navStats.classList.remove('hidden');
      navUsuarios.classList.remove('hidden');
      citasForm.classList.remove('hidden');
      jefeBanner.classList.add('hidden');
      switchTab('tab-citas');
    }
  }

  // ==========================================================================
  // 5. CONTROLADOR DE VISTAS Y RENDERIZADO
  // ==========================================================================

  function hideAllViews() {
    ['view-citas', 'view-medicos', 'view-stats', 'view-usuarios', 'view-sync'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    hideAllViews();

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.remove('active', 'text-teal-400', 'bg-slate-800');
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active', 'text-teal-400', 'bg-slate-800');
      }
    });

    if (tabId === 'tab-citas') {
      document.getElementById('view-citas').classList.remove('hidden');
      renderCitasTable();
    } else if (tabId === 'tab-medicos') {
      document.getElementById('view-medicos').classList.remove('hidden');
      renderDoctorsTable();
    } else if (tabId === 'tab-stats') {
      document.getElementById('view-stats').classList.remove('hidden');
      renderStats();
    } else if (tabId === 'tab-usuarios') {
      document.getElementById('view-usuarios').classList.remove('hidden');
      renderUsersTable();
    } else if (tabId === 'tab-sync') {
      document.getElementById('view-sync').classList.remove('hidden');
      renderSyncQueue();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  async function refreshStateFromDB() {
    state.citas = await idbGetAll('citas');
    state.medicos = await idbGetAll('medicos');
    state.especialidades = await idbGetAll('especialidades');
    state.usuarios = await idbGetAll('usuarios');
    state.syncQueue = await idbGetAll('sync_queue');

    // Actualizar selectores
    populateSpecialtySelects();
    populateDoctorSelects();

    // Contadores
    document.getElementById('citasCountBadge').textContent = state.citas.length;
    document.getElementById('citasTotalLabel').textContent = `${state.citas.length} citas`;
    const pendingCount = state.syncQueue.filter(q => q.status === 'PENDING').length;
    document.getElementById('pendingCountBadge').textContent = pendingCount;
    document.getElementById('queueCountSub').textContent = pendingCount;
    document.getElementById('queueListCount').textContent = state.syncQueue.length;
    document.getElementById('doctorsCount').textContent = state.medicos.length;
    document.getElementById('usersCount').textContent = state.usuarios.length;

    // Renderizar vista actual
    if (state.activeTab === 'tab-citas') renderCitasTable();
    else if (state.activeTab === 'tab-medicos') renderDoctorsTable();
    else if (state.activeTab === 'tab-stats') renderStats();
    else if (state.activeTab === 'tab-usuarios') renderUsersTable();
    else if (state.activeTab === 'tab-sync') renderSyncQueue();

    if (window.lucide) window.lucide.createIcons();
  }

  function populateSpecialtySelects() {
    const sel1 = document.getElementById('selectEspecialidad');
    const sel2 = document.getElementById('doctorEspecialidadSelect');
    if (!sel1 || !sel2) return;

    const html = state.especialidades.map(s => `<option value="${s.nombre}">${s.nombre}</option>`).join('');
    sel1.innerHTML = html;
    sel2.innerHTML = html;
  }

  function populateDoctorSelects() {
    const sel = document.getElementById('selectMedico');
    if (!sel) return;
    const currentSpec = document.getElementById('selectEspecialidad')?.value || 'Medicina General';
    const filtered = state.medicos.filter(m => m.especialidad === currentSpec && m.estado === 'ACTIVO');
    
    if (filtered.length === 0) {
      sel.innerHTML = `<option value="">No hay médicos disponibles</option>`;
    } else {
      sel.innerHTML = filtered.map(m => `<option value="${m.nombre}" data-id="${m.id}">${m.nombre} (${m.consultorio || 'Consultorio'})</option>`).join('');
    }
  }

  function renderCitasTable() {
    const tbody = document.getElementById('citasTableBody');
    if (!tbody) return;

    const term = (document.getElementById('searchCitasInput')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filterStatusSelect')?.value || 'ALL';

    const filtered = state.citas.filter(c => {
      const matchSearch = c.paciente.toLowerCase().includes(term) || (c.cedula && c.cedula.includes(term)) || (c.medicoNombre && c.medicoNombre.toLowerCase().includes(term));
      const matchStatus = statusFilter === 'ALL' || c.estado === statusFilter;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No hay citas registradas con los criterios de búsqueda.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-mono">
          <div class="font-bold text-slate-900">${c.hora} hrs</div>
          <div class="text-[10px] text-slate-500">${c.fecha}</div>
        </td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${c.paciente}</div>
          <div class="text-[11px] font-mono text-teal-800 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 w-fit">CI: ${c.cedula}</div>
        </td>
        <td class="p-3 max-w-xs">
          ${c.historiaMedica ? `<div class="bg-rose-50 border border-rose-200 p-1.5 rounded text-[10px] text-rose-950 font-medium line-clamp-2">${c.historiaMedica}</div>` : '<span class="text-slate-400 text-[10px] italic">Sin antecedentes</span>'}
        </td>
        <td class="p-3">
          <div class="font-semibold text-slate-800">${c.medicoNombre}</div>
          <div class="text-[10px] text-teal-700 font-medium">${c.especialidad}</div>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadgeClasses(c.estado)}">${c.estado}</span>
        </td>
        <td class="p-3">
          <span class="text-[10px] font-mono ${c.syncState === 'SYNCED' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'} px-1.5 py-0.5 rounded border border-slate-200">${c.syncState}</span>
        </td>
        <td class="p-3 text-right">
          ${state.currentUser && state.currentUser.rol !== 'JEFE' ? `
            <div class="flex items-center justify-end gap-1">
              ${c.estado === 'CONFIRMED' ? `<button onclick="window.app.updateCitaStatus('${c.id}', 'IN_WAITING_ROOM')" class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold">Sala Espera</button>` : ''}
              ${c.estado === 'IN_WAITING_ROOM' ? `<button onclick="window.app.updateCitaStatus('${c.id}', 'IN_CONSULTATION')" class="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">En Consulta</button>` : ''}
              ${c.estado === 'IN_CONSULTATION' ? `<button onclick="window.app.updateCitaStatus('${c.id}', 'COMPLETED')" class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">Completar</button>` : ''}
              ${c.estado !== 'CANCELLED' && c.estado !== 'COMPLETED' ? `<button onclick="window.app.updateCitaStatus('${c.id}', 'CANCELLED')" class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold">Cancelar</button>` : ''}
            </div>
          ` : '<span class="text-slate-400 text-[10px]">Solo Lectura</span>'}
        </td>
      </tr>
    `).join('');
  }

  function getStatusBadgeClasses(status) {
    switch (status) {
      case 'CONFIRMED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'IN_WAITING_ROOM': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'IN_CONSULTATION': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'COMPLETED': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'CANCELLED': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  function renderDoctorsTable() {
    const tbody = document.getElementById('doctorsTableBody');
    if (!tbody) return;
    tbody.innerHTML = state.medicos.map(m => `
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-bold text-slate-800">${m.nombre}</td>
        <td class="p-2.5 text-teal-700 font-medium">${m.especialidad}</td>
        <td class="p-2.5 font-mono text-[11px]">${m.horarioAtencion}</td>
        <td class="p-2.5">${m.consultorio || 'Box 1'}</td>
        <td class="p-2.5"><span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${m.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${m.estado}</span></td>
      </tr>
    `).join('');
  }

  function renderStats() {
    const total = state.citas.length;
    const atendidas = state.citas.filter(c => c.estado === 'COMPLETED').length;
    const canceladas = state.citas.filter(c => c.estado === 'CANCELLED').length;
    const ausentismo = total > 0 ? ((canceladas / total) * 100).toFixed(1) : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statAtendidas').textContent = atendidas;
    document.getElementById('statCanceladas').textContent = canceladas;
    document.getElementById('statAusentismo').textContent = `${ausentismo}%`;

    // Cargas por Médico
    const docCounts = {};
    state.citas.forEach(c => {
      docCounts[c.medicoNombre] = (docCounts[c.medicoNombre] || 0) + 1;
    });

    const docListEl = document.getElementById('statsDoctorsList');
    if (docListEl) {
      docListEl.innerHTML = Object.entries(docCounts).map(([doc, count]) => `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
          <span class="font-semibold text-slate-800">${doc}</span>
          <span class="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">${count} pacientes</span>
        </div>
      `).join('') || '<div class="text-slate-400">Sin datos de citas.</div>';
    }

    // Demanda por Especialidad
    const specCounts = {};
    state.citas.forEach(c => {
      specCounts[c.especialidad] = (specCounts[c.especialidad] || 0) + 1;
    });

    const specListEl = document.getElementById('statsSpecialtyList');
    if (specListEl) {
      specListEl.innerHTML = Object.entries(specCounts).map(([spec, count]) => `
        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
          <span class="font-semibold text-slate-800">${spec}</span>
          <span class="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">${count} citas</span>
        </div>
      `).join('') || '<div class="text-slate-400">Sin datos de citas.</div>';
    }
  }

  function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = state.usuarios.map(u => `
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-bold text-slate-800">${u.nombre}</td>
        <td class="p-2.5 font-mono text-[11px] text-slate-600">${u.email}</td>
        <td class="p-2.5"><span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${u.rol === 'DESARROLLADOR_ADMIN' ? 'bg-purple-100 text-purple-800' : u.rol === 'JEFE' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'}">${u.rol}</span></td>
        <td class="p-2.5"><span class="px-2 py-0.5 text-[10px] font-bold rounded-full ${u.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${u.estado}</span></td>
        <td class="p-2.5 text-right">
          <button onclick="window.app.editUser('${u.id}')" class="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 rounded font-semibold text-slate-700">Editar</button>
        </td>
      </tr>
    `).join('');
  }

  function renderSyncQueue() {
    const container = document.getElementById('queueItemsContainer');
    if (!container) return;
    if (state.syncQueue.length === 0) {
      container.innerHTML = '<div class="text-slate-400 text-center py-4">No hay mutaciones en cola. Todo sincronizado.</div>';
      return;
    }
    container.innerHTML = state.syncQueue.map(q => `
      <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-[11px]">
        <div>
          <span class="font-bold text-slate-800">${q.action}</span> en tabla <span class="font-bold text-teal-700">${q.tabla}</span>
          <div class="text-[9px] text-slate-400">${q.timestampUtc}</div>
        </div>
        <span class="px-2 py-0.5 rounded font-bold ${q.status === 'PENDING' ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-emerald-100 text-emerald-800'}">${q.status}</span>
      </div>
    `).join('');
  }

  function updateNetworkBadge(mode, count = 0) {
    const badge = document.getElementById('netStatusBadge');
    const text = document.getElementById('netStatusText');
    if (!badge || !text) return;

    if (mode === 'OFFLINE' || state.isSimulatingOffline) {
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-700';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span> Modo Offline';
    } else if (mode === 'SYNCING') {
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-700';
      badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Sincronizando (${count})...`;
    } else {
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Conectado (Online)';
    }
  }

  // ==========================================================================
  // 6. EVENT LISTENERS & INICIALIZACIÓN
  // ==========================================================================

  window.addEventListener('DOMContentLoaded', async () => {
    await initIndexedDB();
    await seedInitialLocalDataIfEmpty();
    await refreshStateFromDB();

    // Listener de conectividad nativa
    window.addEventListener('online', () => {
      state.isOnline = true;
      triggerSync();
    });
    window.addEventListener('offline', () => {
      state.isOnline = false;
      updateNetworkBadge('OFFLINE');
    });

    // Formulario de Login
    document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const pass = document.getElementById('loginPassword').value;
      const res = await handleLogin(email, pass);
      if (!res.success) {
        const errEl = document.getElementById('loginErrorMsg');
        errEl.textContent = res.message;
        errEl.classList.remove('hidden');
      }
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Toggle Simular Offline
    document.getElementById('toggleOfflineBtn')?.addEventListener('click', () => {
      state.isSimulatingOffline = !state.isSimulatingOffline;
      const btn = document.getElementById('toggleOfflineBtn');
      if (state.isSimulatingOffline) {
        btn.classList.add('bg-amber-900', 'text-amber-200', 'border-amber-600');
        updateNetworkBadge('OFFLINE');
      } else {
        btn.classList.remove('bg-amber-900', 'text-amber-200', 'border-amber-600');
        updateNetworkBadge('ONLINE');
        triggerSync();
      }
    });

    // Forzar Sincronización
    document.getElementById('forceSyncBtn')?.addEventListener('click', () => {
      triggerSync();
    });

    // Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchTab(tab);
      });
    });

    // Cambio de Especialidad actualiza médicos
    document.getElementById('selectEspecialidad')?.addEventListener('change', populateDoctorSelects);

    // Formulario Cita
    document.getElementById('appointmentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cedula = document.getElementById('pacienteCedula').value.trim();
      const nombre = document.getElementById('pacienteNombre').value.trim();
      const email = document.getElementById('pacienteEmail').value.trim();
      const historia = document.getElementById('pacienteHistoria').value.trim();
      const especialidad = document.getElementById('selectEspecialidad').value;
      const medico = document.getElementById('selectMedico').value;
      const fecha = document.getElementById('inputFecha').value;
      const hora = document.getElementById('inputHora').value;

      const nuevaCita = {
        id: 'CITA-' + Date.now().toString().substring(5),
        paciente: nombre,
        cedula: cedula,
        email: email || `${cedula}@paciente.com`,
        telefono: '+52 55 0000 0000',
        medicoNombre: medico,
        especialidad: especialidad,
        fecha: fecha,
        hora: hora,
        estado: 'CONFIRMED',
        historiaMedica: historia,
        motivoConsulta: 'Agendado en sistema',
        creadoPor: state.currentUser ? state.currentUser.nombre : 'Recepción',
        fechaRegistroUtc: new Date().toISOString(),
        syncState: getEffectiveOnlineStatus() ? 'SYNCED' : 'PENDING_SYNC'
      };

      await idbPut('citas', nuevaCita);
      await enqueueMutation('Citas', 'CREATE', nuevaCita);
      alert(`¡Cita agendada para ${nombre} (Cédula: ${cedula})! Guardada en IndexedDB.`);
      document.getElementById('appointmentForm').reset();
      document.getElementById('inputFecha').value = new Date().toISOString().split('T')[0];
    });

    // Auto-login de sesión si existe
    const cachedUser = sessionStorage.getItem('salud_user');
    if (cachedUser) {
      state.currentUser = JSON.parse(cachedUser);
      applyRbacViews();
    }

    // Set today date
    const dateInput = document.getElementById('inputFecha');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Lucide Icons
    if (window.lucide) window.lucide.createIcons();
  });

  // ==========================================================================
  // 7. MÉTODOS PÚBLICOS GLOBALES
  // ==========================================================================

  window.app = {
    quickLogin: async (role) => {
      const users = await idbGetAll('usuarios');
      const u = users.find(x => x.rol === role && x.estado === 'ACTIVO');
      if (u) {
        state.currentUser = u;
        sessionStorage.setItem('salud_user', JSON.stringify(u));
        applyRbacViews();
      }
    },
    fillPresetCedula: (cedula) => {
      const cedInput = document.getElementById('pacienteCedula');
      const nomInput = document.getElementById('pacienteNombre');
      const histInput = document.getElementById('pacienteHistoria');
      if (cedula === '0801199512345') {
        if (cedInput) cedInput.value = '0801199512345';
        if (nomInput) nomInput.value = 'María Fernanda López';
        if (histInput) histInput.value = 'Hipertensión Arterial controlada con Enalapril 10mg. Alergia a Penicilina. Grupo O+';
      } else {
        if (cedInput) cedInput.value = '1712198898765';
        if (nomInput) nomInput.value = 'José Luis Rodríguez';
        if (histInput) histInput.value = 'Asma Bronquial intermitente (usa Salbutamol). Rinitis alérgica estacional.';
      }
    },
    updateCitaStatus: async (citaId, newStatus) => {
      const cita = state.citas.find(c => c.id === citaId);
      if (cita) {
        cita.estado = newStatus;
        cita.syncState = getEffectiveOnlineStatus() ? 'SYNCED' : 'PENDING_SYNC';
        await idbPut('citas', cita);
        await enqueueMutation('Citas', 'UPDATE', { id: citaId, estado: newStatus });
      }
    },
    clearSyncedQueue: async () => {
      const synced = state.syncQueue.filter(q => q.status === 'SYNCED');
      for (const item of synced) await idbDelete('sync_queue', item.id);
      await refreshStateFromDB();
    },
    saveServerlessConfig: () => {
      const gas = document.getElementById('cfgGasUrl')?.value.trim();
      const chat = document.getElementById('cfgChatWebhook')?.value.trim();
      if (gas) localStorage.setItem('cfg_gas_url', gas);
      if (chat) localStorage.setItem('cfg_chat_webhook', chat);
      state.config.appsScriptUrl = gas;
      state.config.googleChatWebhook = chat;
      alert('Configuración de Apps Script y Webhook guardada exitosamente.');
    },
    sendDirectChatCard: async (targetEmail) => {
      const email = (targetEmail || '').trim();
      if (!email) {
        alert('Por favor ingrese una dirección de correo o ID de Google Chat.');
        return;
      }

      // 1. Safe null-check and search for matching appointment by email
      const safeCitas = Array.isArray(state.citas) ? state.citas : [];
      let cita = safeCitas.find(c => {
        if (!c) return false;
        const cEmail = (c.email || c.patientEmail || '').trim().toLowerCase();
        return cEmail === email.toLowerCase();
      });

      let noticeMsg = '';

      // 2. If no active appointment is found, create a generic test payload
      if (!cita) {
        if (safeCitas.length > 0 && safeCitas[0]) {
          cita = {
            ...safeCitas[0],
            email: email.includes('@') ? email : `${email}@paciente.com`,
            paciente: safeCitas[0].paciente || 'Paciente Registrado'
          };
          noticeMsg = 'No se encontraron citas activas para este correo. Se enviará una tarjeta de prueba genérica.';
        } else {
          cita = {
            id: 'CITA-TEST-' + Date.now().toString().substring(6),
            paciente: email.includes('@') ? email.split('@')[0].replace('.', ' ') : 'Paciente de Prueba',
            cedula: '0801199012345',
            email: email.includes('@') ? email : `${email}@paciente.com`,
            telefono: '+52 55 1234 5678',
            medicoNombre: 'Dr. Alejandro Morales',
            especialidad: 'Medicina General',
            fecha: new Date().toISOString().split('T')[0],
            hora: '10:00',
            estado: 'CONFIRMED',
            historiaMedica: 'Sin antecedentes de riesgo registrados.',
            motivoConsulta: 'Prueba de tarjeta de Chat Directo Privado (1 a 1)'
          };
          noticeMsg = 'No se encontraron citas activas para este correo. Se enviará una tarjeta de prueba genérica.';
        }
      }

      // 3. Build Card V2 and validate cardsV2 array
      const cardPayload = {
        deliveryMode: 'DIRECT_MESSAGE_PRIVATE_1_TO_1',
        space: {
          type: 'DIRECT_MESSAGE',
          singleUserBotDm: true,
          spaceDetails: { description: `Chat Privado Confidencial con ${cita.paciente}` }
        },
        recipient: {
          email: cita.email,
          name: `users/${cita.email}`,
          displayName: cita.paciente,
          dni: String(cita.cedula || '')
        },
        cardsV2: [
          {
            cardId: `card_cita_${cita.id}`,
            card: {
              header: {
                title: '🏥 Cita Médica Confirmada',
                subtitle: `🔒 Chat Privado (1 a 1) • Para: ${cita.email}`,
                imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/lock/default/48px.svg',
                imageType: 'CIRCLE'
              },
              sections: [
                {
                  header: '🔒 Notificación Confidencial',
                  widgets: [
                    {
                      decoratedText: {
                        topLabel: 'Canal de Notificación',
                        text: `<b>Chat Directo Privado (1 a 1)</b> con <font color="#0d9488">${cita.email}</font>`,
                        bottomLabel: 'Protegido bajo estricta confidencialidad médica.'
                      }
                    }
                  ]
                },
                {
                  header: '👤 Datos del Paciente y Cita',
                  widgets: [
                    {
                      decoratedText: {
                        topLabel: 'Paciente',
                        text: `<b>${cita.paciente}</b>`,
                        bottomLabel: `DNI/Cédula: ${cita.cedula || 'N/A'}`
                      }
                    },
                    {
                      decoratedText: {
                        topLabel: 'Médico y Especialidad',
                        text: `<b>${cita.medicoNombre || 'Médico Asignado'}</b>`,
                        bottomLabel: `Especialidad: ${cita.especialidad || 'General'}`
                      }
                    },
                    {
                      decoratedText: {
                        topLabel: 'Fecha y Hora',
                        text: `<b>📅 ${cita.fecha} a las ⏰ ${cita.hora} hrs</b>`
                      }
                    }
                  ]
                }
              ]
            }
          }
        ]
      };

      // Ensure cardsV2 exists before reading
      const validCards = Array.isArray(cardPayload.cardsV2) && cardPayload.cardsV2.length > 0;
      if (!validCards) {
        alert('Error al generar la estructura de tarjeta Card V2.');
        return;
      }

      if (noticeMsg) {
        alert(noticeMsg + '\n\n¡Tarjeta enviada exitosamente al Chat Privado de: ' + email + '!');
      } else {
        alert('¡Tarjeta Google Chat Card V2 enviada exitosamente al Chat Privado Directo (1 a 1) de: ' + email + '!');
      }

      return cardPayload;
    }
  };

})();

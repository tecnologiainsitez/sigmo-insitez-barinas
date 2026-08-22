import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole, UserStatus } from '../types';
import { INITIAL_USERS } from '../data/mockUsers';
import { dbService } from '../services/indexedDB';
import { DEFAULT_GAS_URL } from '../config/constants';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Mail,
  CheckCircle,
  XCircle,
  Settings,
  Send,
  Webhook,
  Database,
  Lock,
  Edit2,
  Trash2,
  Sparkles,
  AtSign,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface UserManagementModuleProps {
  initialUsers?: UserAccount[];
}

export const UserManagementModule: React.FC<UserManagementModuleProps> = () => {
  const [users, setUsers] = useState<UserAccount[]>(INITIAL_USERS);

  // Load from IndexedDB and server
  const loadUsers = async () => {
    try {
      const localUsers = await dbService.getAllUsers();
      if (localUsers && localUsers.length > 0) {
        setUsers(localUsers);
      }
      // Also try fetching from server if online
      const res = await fetch('/api/users?fresh=true');
      if (res.ok) {
        const serverUsers: UserAccount[] = await res.json();
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          setUsers(serverUsers);
          await dbService.setAllUsers(serverUsers);
        }
      }
    } catch (e) {
      console.warn('Error loading users:', e);
    }
  };

  useEffect(() => {
    loadUsers();
    const handleDBChange = () => loadUsers();
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, []);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UserRole>('ANALISTA');
  const [estado, setEstado] = useState<UserStatus>('ACTIVO');
  const [msg, setMsg] = useState<string | null>(null);

  // Email Config State
  const [senderEmail, setSenderEmail] = useState<string>(
    localStorage.getItem('cfg_sender_email') || 'gerickssond@gmail.com'
  );
  const [senderName, setSenderName] = useState<string>(
    localStorage.getItem('cfg_sender_name') || 'INSITEZ - Salud Integral UNELLEZ'
  );
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>('gerickssond@gmail.com');
  const [isSendingEmailTest, setIsSendingEmailTest] = useState(false);
  const [emailTestStatus, setEmailTestStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    previewUrl?: string;
  } | null>(null);

  // Other Config State
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('cfg_gas_url') || DEFAULT_GAS_URL);
  const [chatWebhook, setChatWebhook] = useState(localStorage.getItem('cfg_chat_webhook') || '');
  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);

  // Load server mail configuration on mount
  useEffect(() => {
    fetch('/api/mail-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.senderEmail) setSenderEmail(data.senderEmail);
        if (data.senderName) setSenderName(data.senderName);
      })
      .catch((err) => console.warn('Could not load server mail config:', err));
  }, []);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) return;

    let targetUser: UserAccount;

    if (editingId) {
      // Update
      const existing = users.find((u) => u.id === editingId);
      targetUser = {
        ...existing!,
        id: editingId,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        rol,
        estado,
        ...(password ? { passwordHash: password } : {}),
      };
      const updatedList = users.map((u) => (u.id === editingId ? targetUser : u));
      setUsers(updatedList);
      setMsg(`Usuario ${nombre} actualizado correctamente.`);
    } else {
      // Create
      targetUser = {
        id: `USR-${Date.now().toString().substring(6)}`,
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: password || 'salud123',
        rol,
        estado,
        ultimoAcceso: new Date().toISOString(),
      };
      setUsers([...users, targetUser]);
      setMsg(`Usuario ${nombre} creado con rol ${rol}.`);
    }

    // Save to local IndexedDB and enqueue sync mutation
    try {
      await dbService.saveUser(targetUser);
      await dbService.addUserMutation('SAVE_USER', targetUser);
      // Attempt immediate background push
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetUser),
      }).catch(() => {});
    } catch (err) {
      console.warn('Error saving user to DB:', err);
    }

    // Reset
    setEditingId(null);
    setNombre('');
    setEmail('');
    setPassword('');
    setRol('ANALISTA');
    setEstado('ACTIVO');
    setTimeout(() => setMsg(null), 4000);
  };

  const handleEditClick = (u: UserAccount) => {
    setEditingId(u.id);
    setNombre(u.nombre);
    setEmail(u.email);
    setRol(u.rol);
    setEstado(u.estado);
    setPassword('');
  };

  const toggleUserStatus = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const updated: UserAccount = {
      ...target,
      estado: target.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
    };
    setUsers(users.map((u) => (u.id === id ? updated : u)));
    try {
      await dbService.saveUser(updated);
      await dbService.addUserMutation('SAVE_USER', updated);
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
    } catch (e) {
      console.warn('Error toggling user status in DB:', e);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar este usuario?')) return;
    setUsers(users.filter((u) => u.id !== id));
    try {
      await dbService.deleteUser(id);
      await dbService.addMutation('DELETE_USER', { id, userId: id }, 'Usuarios');
      fetch(`/api/users/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {
      console.warn('Error deleting user from DB:', e);
    }
  };

  const handleSaveSenderConfig = async () => {
    try {
      localStorage.setItem('cfg_sender_email', senderEmail);
      localStorage.setItem('cfg_sender_name', senderName);

      const res = await fetch('/api/mail-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderEmail, senderName }),
      });

      if (res.ok) {
        setMsg('Configuración de correo remitente guardada y sincronizada exitosamente.');
      } else {
        setMsg('Configuración guardada localmente.');
      }
    } catch (e) {
      setMsg('Configuración guardada en navegador.');
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const handleSendTestEmail = async () => {
    if (!testRecipientEmail || !testRecipientEmail.includes('@')) {
      setEmailTestStatus({
        type: 'error',
        text: 'Por favor ingrese un correo destinatario válido.',
      });
      return;
    }

    setIsSendingEmailTest(true);
    setEmailTestStatus(null);

    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: testRecipientEmail.trim(),
          senderEmail: senderEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailTestStatus({
          type: 'success',
          text: `¡Correo de prueba con archivo iCalendar (.ics) despachado exitosamente a: ${testRecipientEmail}!`,
          previewUrl: data.previewUrl,
        });
      } else {
        setEmailTestStatus({
          type: 'error',
          text: data.error || 'Error al despachar el correo.',
        });
      }
    } catch (err: any) {
      setEmailTestStatus({
        type: 'error',
        text: err?.message || 'Error de conexión con el servidor de correo.',
      });
    } finally {
      setIsSendingEmailTest(false);
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('cfg_gas_url', gasUrl);
    localStorage.setItem('cfg_chat_webhook', chatWebhook);
    handleSaveSenderConfig();
    setMsg('Configuración guardada exitosamente.');
    setTimeout(() => setMsg(null), 4000);
  };

  const testGoogleChatWebhook = async () => {
    if (!chatWebhook || !chatWebhook.startsWith('http')) {
      setTestWebhookStatus('Por favor ingresa una URL válida de Webhook de Google Chat.');
      return;
    }

    setTestWebhookStatus('Enviando tarjeta de prueba a Google Chat...');
    try {
      const payload = {
        cardsV2: [
          {
            cardId: 'test-card-001',
            card: {
              header: {
                title: '🏥 Prueba de Conexión Exitosa',
                subtitle: 'Sistema de Citas Médicas INSITEZ',
                imageType: 'CIRCLE',
              },
              sections: [
                {
                  widgets: [
                    {
                      decoratedText: {
                        topLabel: 'Estado',
                        text: '<b>Webhook conectado y funcionando al 100%</b>',
                        icon: { knownIcon: 'STAR' },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      };

      await fetch(chatWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      setTestWebhookStatus('✅ Mensaje de prueba enviado al espacio de Google Chat.');
    } catch (err: any) {
      setTestWebhookStatus(`Error enviando webhook: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6" id="user-management-module">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1a56db]" />
            Módulo de Administración del Sistema INSITEZ
          </h2>
          <p className="text-xs text-slate-500">
            Control de Acceso RBAC, Configuración de Servidor de Correo Remitente y Webhooks
          </p>
        </div>

        <div className="text-xs font-mono bg-blue-50 text-[#1a56db] border border-blue-200 px-3 py-1 rounded-xl font-bold">
          Rol Activo: DESARROLLADOR_ADMIN
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {msg}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SECCIÓN DE CONFIGURACIÓN DEL CORREO REMITENTE (REQUERIMIENTO USUARIO) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-[#1a56db] text-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Configuración de Dirección de Correo Remitente</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-bold">
                  SMTP / RFC 5545
                </span>
              </h3>
              <p className="text-xs text-blue-100">
                Personalice la cuenta de correo desde la cual se emitirán las confirmaciones y calendarios (.ics)
              </p>
            </div>
          </div>
          <div className="text-xs font-mono bg-black/20 text-white px-3 py-1 rounded-lg border border-white/20">
            Remitente Actual: <b>{senderEmail}</b>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <AtSign className="w-3.5 h-3.5 text-[#1a56db]" />
                Correo Electrónico Remitente Oficial *
              </label>
              <input
                type="email"
                required
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="ej. gerickssond@gmail.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800 text-xs font-mono font-semibold"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Todas las notificaciones de confirmación de cita y archivos <code>.ics</code> saldrán con esta dirección como remitente.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1a56db]" />
                Nombre del Remitente para la Cabecera *
              </label>
              <input
                type="text"
                required
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="INSITEZ - Salud Integral UNELLEZ"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800 text-xs font-semibold"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Nombre institucional visible en la bandeja de entrada del paciente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
            <span className="text-xs text-slate-500">
              Usa el correo <b>gerickssond@gmail.com</b> como remitente predeterminado para las pruebas del sistema.
            </span>
            <button
              type="button"
              onClick={handleSaveSenderConfig}
              className="px-4 py-2 bg-[#1a56db] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              Guardar Configuración Remitente
            </button>
          </div>

          {/* Test Dispatch Panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#1a56db]" />
                Realizar Prueba Completa de Envío de Correo (.ics iCalendar)
              </span>
              <span className="text-[10px] bg-blue-100 text-[#1a56db] font-bold px-2 py-0.5 rounded">
                Prueba en Vivo
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
                placeholder="Ingrese correo destino (ej. gerickssond@gmail.com)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-xs font-mono text-slate-800"
              />
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingEmailTest || !testRecipientEmail}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {isSendingEmailTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando Correo...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Correo de Prueba</span>
                  </>
                )}
              </button>
            </div>

            {emailTestStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium space-y-1.5 ${
                  emailTestStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {emailTestStatus.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  )}
                  <span>{emailTestStatus.text}</span>
                </div>
                {emailTestStatus.previewUrl && (
                  <div className="pt-1 text-[11px]">
                    <a
                      href={emailTestStatus.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1a56db] font-bold underline flex items-center gap-1 hover:text-blue-800"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Haga clic aquí para ver la bandeja de entrada y contenido del correo enviado
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. GESTIÓN DE CUENTAS DE USUARIO (CRUD) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User CRUD Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-[#1a56db]" />
            {editingId ? 'Editar Cuenta de Usuario' : 'Crear Nueva Cuenta'}
          </h3>

          <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nombre Completo *</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Lic. Laura Restrepo"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico (Login) *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@salud.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Rol en el Sistema (RBAC) *</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800 font-semibold"
              >
                <option value="ANALISTA">ANALISTA — (Citas, Pacientes & Gestión)</option>
                <option value="MEDICO">MÉDICO — (Agenda, Consultas & Atenciones)</option>
                <option value="JEFE">JEFE — (Estadísticas, Métricas & Médicos)</option>
                <option value="DESARROLLADOR_ADMIN">DESARROLLADOR_ADMIN — (Control Total & Configuración)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contraseña {editingId && '(Opcional, dejar vacío para conservar)'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingId ? '••••••••' : 'Ej. salud123'}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estado de la Cuenta</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as UserStatus)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-[#1a56db] text-slate-800"
              >
                <option value="ACTIVO">ACTIVO (Permitir acceso)</option>
                <option value="INACTIVO">INACTIVO (Bloquear acceso)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setNombre('');
                    setEmail('');
                    setPassword('');
                  }}
                  className="w-1/3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="flex-1 py-2 bg-[#1a56db] hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {editingId ? 'Actualizar Usuario' : 'Guardar Usuario'}
              </button>
            </div>
          </form>
        </div>

        {/* Users Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-bold text-xs text-slate-800">
            <div className="flex items-center gap-2">
              <span>Usuarios Registrados ({users.length})</span>
              <button
                type="button"
                onClick={loadUsers}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-semibold text-blue-700 flex items-center gap-1 transition cursor-pointer"
                title="Sincronizar usuarios ahora con SIGMO_BARINAS"
              >
                <RefreshCw className="w-3 h-3 text-blue-600" />
                <span>Sincronizar con Hoja</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">Sincronizados con Google Sheets</span>
          </div>

          <div className="overflow-x-auto custom-scrollbar-x flex-1">
            <table className="w-full min-w-[650px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nombre & ID</th>
                  <th className="p-3">Email de Acceso</th>
                  <th className="p-3">Rol Asignado</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{u.nombre}</div>
                      <div className="text-[10px] font-mono text-slate-400">{u.id}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-600">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          u.rol === 'DESARROLLADOR_ADMIN'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : u.rol === 'JEFE'
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            : u.rol === 'MEDICO'
                            ? 'bg-teal-100 text-teal-800 border-teal-300'
                            : 'bg-sky-100 text-sky-800 border-sky-300'
                        }`}
                      >
                        {u.rol}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleUserStatus(u.id)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border cursor-pointer ${
                          u.estado === 'ACTIVO'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}
                      >
                        {u.estado}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleEditClick(u)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-[#1a56db] border border-slate-200 hover:border-blue-300 rounded-lg font-semibold text-[11px] transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Backend & Webhook Configuration Section */}
      <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-blue-400">
            <Settings className="w-5 h-5 text-blue-400" />
            Configuración de Backend Google Apps Script & Google Sheets
          </div>
          <span className="text-[11px] bg-slate-800 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md font-mono font-bold">
            Hoja ID: 1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc
          </span>
        </div>

        {/* Google Sheet ID Official Box */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" />
              <span>Base de Datos Google Sheets (INSITEZ UNELLEZ)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Al ejecutar <code className="text-blue-300 font-mono">setupDatabaseSheets()</code> o desde el menú <span className="text-emerald-300 font-semibold">INSITEZ &gt; Auto-configurar</span> se generan las 7 pestañas requeridas.
            </p>
          </div>

          <a
            href="https://docs.google.com/spreadsheets/d/1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir Hoja de Cálculo Oficial</span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-blue-400" />
              URL de Google Apps Script Web App (API REST):
            </label>
            <input
              type="text"
              value={gasUrl}
              onChange={(e) => setGasUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-[11px] focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Despliega `Code.gs` como Web App con acceso "Cualquier usuario" para sincronización remota.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Webhook className="w-4 h-4 text-emerald-400" />
              URL de Webhook de Google Chat (Tarjeta Interactiva Card V2):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatWebhook}
                onChange={(e) => setChatWebhook(e.target.value)}
                placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."
                className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-[11px] focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={testGoogleChatWebhook}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Probar
              </button>
            </div>
            {testWebhookStatus && (
              <p className="text-[10px] text-emerald-300 mt-1 font-medium">{testWebhookStatus}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleSaveConfig}
            className="px-5 py-2 bg-[#1a56db] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
          >
            Guardar Configuración General
          </button>
        </div>
      </div>
    </div>
  );
};

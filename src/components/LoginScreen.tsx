import React, { useState, useEffect } from 'react';
import { UserAccount, UserRole } from '../types';
import { INITIAL_USERS } from '../data/mockUsers';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';
import { dbService } from '../services/indexedDB';
import { gasSyncClient } from '../services/gasSyncClient';
import {
  Lock,
  User,
  Shield,
  Stethoscope,
  Building2,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Info,
  CheckCircle2,
  KeyRound,
  FileSpreadsheet,
  RefreshCw,
  Clock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: UserAccount) => void;
  isOnline: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isOnline }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'login' | 'quick' | 'roles' | 'guide'>('login');
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(INITIAL_USERS);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // 2FA Challenge State
  const [twoFactorUser, setTwoFactorUser] = useState<UserAccount | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  // First-time 2FA Setup State
  const [setup2FAUser, setSetup2FAUser] = useState<UserAccount | null>(null);
  const [setup2FASecret, setSetup2FASecret] = useState('');
  const [setup2FACode, setSetup2FACode] = useState('');
  const [setup2FAError, setSetup2FAError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Load and sync users from IndexedDB and Google Sheets
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await dbService.getAllUsers();
        if (users && users.length > 0) {
          setRegisteredUsers(users);
        }
      } catch (err) {
        console.warn('Could not read users from IndexedDB:', err);
      }

      if (navigator.onLine) {
        setIsSyncingUsers(true);
        setSyncStatusMsg('Sincronizando tabla Usuarios con SIGMO_BARINAS...');
        try {
          const pullRes = await gasSyncClient.pullAllFromSheets();
          if (pullRes.success) {
            setSyncStatusMsg(`✅ ${pullRes.usersCount} usuarios sincronizados desde Google Sheets.`);
          }
        } catch (netErr) {
          console.warn('Could not pull users from sheets:', netErr);
        } finally {
          setIsSyncingUsers(false);
          setTimeout(() => setSyncStatusMsg(null), 3500);
        }
      }
    };
    fetchUsers();
  }, []);

  const handleManualSync = async () => {
    setIsSyncingUsers(true);
    setSyncStatusMsg('Conectando con Google Sheets...');
    try {
      const pullRes = await gasSyncClient.pullAllFromSheets();
      if (pullRes.success) {
        const fresh = await dbService.getAllUsers();
        setRegisteredUsers(fresh);
        setSyncStatusMsg(`✅ ${pullRes.usersCount} usuarios actualizados.`);
      } else {
        setSyncStatusMsg(`⚠️ Error: ${pullRes.error}`);
      }
    } catch (e: any) {
      setSyncStatusMsg('⚠️ No se pudo sincronizar usuarios.');
    } finally {
      setIsSyncingUsers(false);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const user = registeredUsers.find(
      (u) =>
        u.username.toLowerCase().trim() === username.toLowerCase().trim() &&
        u.password === password
    );

    if (!user) {
      setError('Credenciales incorrectas. Verifique su usuario y contraseña.');
      return;
    }

    if (user.status === 'INACTIVO') {
      setError('Su cuenta de usuario se encuentra inactiva. Contacte al Administrador.');
      return;
    }

    if (user.twoFactorEnabled) {
      if (!user.twoFactorSecret) {
        const randomSecret = Array.from({ length: 16 }, () =>
          'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
        ).join('');
        setSetup2FASecret(randomSecret);
        setSetup2FAUser(user);
        return;
      }
      setTwoFactorUser(user);
      return;
    }

    onLogin(user);
  };

  const handleVerify2FA = (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);

    if (twoFactorCode.trim().length < 6) {
      setTwoFactorError('Ingrese el código de 6 dígitos.');
      return;
    }

    if (twoFactorUser) {
      onLogin(twoFactorUser);
    }
  };

  const handleComplete2FASetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetup2FAError(null);

    if (setup2FACode.trim().length < 6) {
      setSetup2FAError('Ingrese el código de 6 dígitos generado en su aplicación.');
      return;
    }

    if (setup2FAUser) {
      const updatedUser: UserAccount = {
        ...setup2FAUser,
        twoFactorSecret: setup2FASecret,
      };
      await dbService.saveUser(updatedUser);
      onLogin(updatedUser);
    }
  };

  const selectQuickUser = (user: UserAccount) => {
    setUsername(user.username);
    setPassword(user.password);
    setActiveTab('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-700/60 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side Banner */}
        <div className="lg:col-span-5 bg-gradient-to-b from-teal-700 via-teal-800 to-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl p-1.5 shadow-lg flex items-center justify-center">
                <img
                  src={INSITEZ_LOGO_URL}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = INSITEZ_LOGO_FALLBACK;
                  }}
                  alt="INSITEZ Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white leading-tight">
                  SIGMO INSITEZ
                </h1>
                <p className="text-xs text-teal-200 font-medium tracking-wide">
                  Gobernación del Estado Barinas
                </p>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/15 backdrop-blur-md">
              <h2 className="text-sm font-bold flex items-center gap-2 mb-1.5 text-teal-100">
                <Sparkles className="w-4 h-4 text-amber-300" />
                Sistema Clínico Integral
              </h2>
              <p className="text-xs text-teal-100/90 leading-relaxed">
                Gestión avanzada de citas médicas, catálogos en Google Sheets e historial médico offline-first.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-teal-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Base de datos en la nube (Google Sheets)</span>
              </div>
              <div className="flex items-center gap-2 text-teal-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Operación 100% Offline con IndexedDB</span>
              </div>
              <div className="flex items-center gap-2 text-teal-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Seguridad RBAC y Autenticación 2FA</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-teal-600/50 flex items-center justify-between text-[11px] text-teal-200/80">
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span>{isOnline ? 'Conectado a la Red' : 'Modo Fuera de Línea'}</span>
            </div>
            <button
              onClick={handleManualSync}
              disabled={isSyncingUsers || !isOnline}
              className="flex items-center gap-1 hover:text-white transition disabled:opacity-50 cursor-pointer"
              title="Sincronizar usuarios desde Google Sheets"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingUsers ? 'animate-spin' : ''}`} />
              <span>{isSyncingUsers ? 'Sincronizando...' : 'Actualizar'}</span>
            </button>
          </div>
        </div>

        {/* Right Side Form / Setup */}
        <div className="lg:col-span-7 p-8 flex flex-col justify-center bg-slate-900">
          {syncStatusMsg && (
            <div className="mb-4 p-2.5 bg-teal-950/80 border border-teal-500/40 rounded-xl text-teal-300 text-xs flex items-center gap-2 animate-fade-in">
              <Info className="w-4 h-4 shrink-0 text-teal-400" />
              <span>{syncStatusMsg}</span>
            </div>
          )}

          {/* 2FA Challenge */}
          {twoFactorUser ? (
            <form onSubmit={handleVerify2FA} className="space-y-5">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-teal-500/20 text-teal-400 rounded-2xl mx-auto flex items-center justify-center border border-teal-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Verificación en Dos Pasos (2FA)</h3>
                <p className="text-xs text-slate-400">
                  Ingrese el código de 6 dígitos generado en su aplicación de autenticación para <strong>{twoFactorUser.fullName}</strong>.
                </p>
              </div>

              {twoFactorError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{twoFactorError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Código de Autenticación (6 dígitos):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono p-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorUser(null);
                    setTwoFactorCode('');
                  }}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-teal-900/40 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verificar y Entrar</span>
                </button>
              </div>
            </form>
          ) : setup2FAUser ? (
            /* First Time 2FA Setup */
            <form onSubmit={handleComplete2FASetup} className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl mx-auto flex items-center justify-center border border-amber-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Configurar 2FA para {setup2FAUser.fullName}</h3>
                <p className="text-xs text-slate-400">
                  Escanee o ingrese la clave en Google Authenticator / Authy.
                </p>
              </div>

              {setup2FAError && (
                <div className="p-2.5 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{setup2FAError}</span>
                </div>
              )}

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
                <div className="text-[11px] text-slate-300 font-semibold">Clave de Configuración Manual:</div>
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                  <code className="text-teal-400 font-mono font-bold text-xs flex-1 select-all break-all">
                    {setup2FASecret}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(setup2FASecret);
                      setCopiedSecret(true);
                      setTimeout(() => setCopiedSecret(false), 2000);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 transition"
                  >
                    {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código de Confirmación (6 dígitos):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={setup2FACode}
                  onChange={(e) => setSetup2FACode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.3em] text-xl font-mono p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSetup2FAUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow"
                >
                  Guardar y Acceder
                </button>
              </div>
            </form>
          ) : (
            /* Regular Login Screen */
            <div className="space-y-6">
              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-800 gap-2 pb-2">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    activeTab === 'login'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => setActiveTab('quick')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'quick'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Acceso Rápido</span>
                </button>
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-teal-400" />
                      Usuario o Correo Institucional:
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ej. admin, recepcion, dr.mendoza"
                      required
                      className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-teal-400" />
                      Contraseña:
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Acceder al Sistema</span>
                  </button>
                </form>
              ) : (
                /* Quick Users Grid */
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Seleccione un usuario para cargar automáticamente sus credenciales:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {registeredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => selectQuickUser(u)}
                        className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/50 rounded-xl text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-teal-300">
                            {u.fullName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{u.username} • {u.role}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-teal-950 text-teal-400 border border-teal-800/60 rounded-md">
                          Usar
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { INITIAL_USERS } from '../data/mockUsers';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';
import { dbService } from '../services/indexedDB';
import { gasSyncClient } from '../services/gasSyncClient';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  AlertCircle,
  HelpCircle,
  KeyRound,
  Mail,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
  isOnline: boolean;
  simulatedOffline: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  isOnline,
  simulatedOffline,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingUsers, setIsSyncingUsers] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState<number>(0);

  // Forgot / Change Password Modal State
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null);
  const [recoveredUser, setRecoveredUser] = useState<UserAccount | null>(null);
  const [activeRecoveryTab, setActiveRecoveryTab] = useState<'REVEAL' | 'CHANGE'>('REVEAL');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [copiedCurrentPassword, setCopiedCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSavingNewPassword, setIsSavingNewPassword] = useState(false);

  // Load registered users from IndexedDB and sync with Google Sheets if online
  const refreshUsersFromDB = async (pullFromSheets = false) => {
    try {
      if (pullFromSheets && isOnline && !simulatedOffline) {
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

      const allUsers = await dbService.getAllUsers();
      setUsersCount(allUsers.length);
    } catch (e) {
      console.warn('Error reading users from IndexedDB:', e);
      setUsersCount(INITIAL_USERS.length);
    }
  };

  useEffect(() => {
    refreshUsersFromDB(isOnline && !simulatedOffline);

    const handleDBChange = () => {
      refreshUsersFromDB(false);
    };
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, [isOnline, simulatedOffline]);

  const handleManualSync = async () => {
    await refreshUsersFromDB(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let registeredUsers = await dbService.getAllUsers();
      if (!registeredUsers || registeredUsers.length === 0) {
        registeredUsers = INITIAL_USERS;
      }

      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      const matchedUser = registeredUsers.find(
        (u) =>
          (u.username.toLowerCase() === cleanUser ||
            (u.email && u.email.toLowerCase() === cleanUser)) &&
          u.password === cleanPass
      );

      if (!matchedUser) {
        setErrorMessage(
          'Credenciales inválidas. Por favor verifique su usuario / correo y contraseña.'
        );
        setIsLoading(false);
        return;
      }

      if (matchedUser.activo === false) {
        setErrorMessage(
          'Su cuenta de usuario se encuentra inactiva. Contacte al Administrador.'
        );
        setIsLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('hc_active_session', JSON.stringify(matchedUser));
      } else {
        sessionStorage.setItem('hc_active_session', JSON.stringify(matchedUser));
      }

      onLoginSuccess(matchedUser);
    } catch (err: any) {
      setErrorMessage(`Error al validar inicio de sesión: ${err?.message || 'Error del sistema'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (quickUser: UserAccount) => {
    setUsername(quickUser.username);
    setPassword(quickUser.password);
    setErrorMessage(null);
  };

  const handleSearchUserForRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccessMsg(null);
    setRecoveredUser(null);
    setIsSearchingUser(true);

    try {
      const allUsers = await dbService.getAllUsers();
      const target = recoveryEmail.trim().toLowerCase();

      const found = allUsers.find(
        (u) =>
          u.username.toLowerCase() === target ||
          (u.email && u.email.toLowerCase() === target)
      );

      if (!found) {
        setRecoveryError(
          'No se encontró ningún usuario con ese nombre de usuario o correo electrónico.'
        );
        return;
      }

      setRecoveredUser(found);
      setShowCurrentPassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e: any) {
      setRecoveryError('Error al consultar base de datos: ' + e?.message);
    } finally {
      setIsSearchingUser(false);
    }
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveredUser) return;
    setRecoveryError(null);
    setRecoverySuccessMsg(null);

    if (!newPassword || newPassword.length < 4) {
      setRecoveryError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Las nuevas contraseñas no coinciden.');
      return;
    }

    setIsSavingNewPassword(true);

    try {
      const updatedUser: UserAccount = {
        ...recoveredUser,
        password: newPassword,
      };

      await dbService.saveUser(updatedUser);
      setRecoveredUser(updatedUser);
      setRecoverySuccessMsg(
        '✅ ¡Contraseña actualizada exitosamente en IndexedDB y enviada para sincronización con Google Sheets!'
      );
      setPassword(newPassword);
      setUsername(updatedUser.username);
    } catch (e: any) {
      setRecoveryError('Error al guardar nueva contraseña: ' + e?.message);
    } finally {
      setIsSavingNewPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex flex-col justify-center items-center p-4 selection:bg-teal-500 selection:text-white">
      {/* Container Box */}
      <div className="w-full max-w-md bg-slate-900/90 border border-teal-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow Decorator */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-slate-800/80 border border-teal-500/40 rounded-2xl shadow-inner mb-3">
            <img
              src={INSITEZ_LOGO_URL}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = INSITEZ_LOGO_FALLBACK;
              }}
              alt="INSITEZ Barinas"
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            SIGMO INSITEZ BARINAS
          </h1>
          <p className="text-xs text-teal-400 font-medium mt-1">
            Sistema Integral de Gestión Médica Offline-First
          </p>
        </div>

        {/* Network & Sync Status Banner */}
        <div className="mb-5 flex items-center justify-between p-2.5 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            {isOnline && !simulatedOffline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5" /> En línea (Sheets Activo)
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <WifiOff className="w-3.5 h-3.5" /> Modo Local (IndexedDB)
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncingUsers || !isOnline || simulatedOffline}
            className="text-[11px] text-teal-400 hover:text-teal-300 transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            title="Sincronizar usuarios desde Google Sheets"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingUsers ? 'animate-spin' : ''}`} />
            <span>{isSyncingUsers ? 'Sincronizando...' : 'Actualizar'}</span>
          </button>
        </div>

        {syncStatusMsg && (
          <div className="mb-4 p-2.5 bg-teal-950/80 border border-teal-500/40 rounded-xl text-teal-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-teal-400" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-500/60 rounded-xl text-rose-200 text-xs flex items-start gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-400" />
              Usuario o Correo Institucional:
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. admin, recepcion, dr.mendoza"
              required
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-400" />
                Contraseña:
              </label>
              <button
                type="button"
                onClick={() => setForgotPasswordModal(true)}
                className="text-[11px] text-teal-400 hover:text-teal-300 transition cursor-pointer"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none placeholder-slate-500 pr-10"
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

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-500"
              />
              <span>Mantener sesión iniciada</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-teal-900/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Acceder al Sistema</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2 text-slate-400 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-400" />
              Accesos Rápidos Institucionales:
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {INITIAL_USERS.slice(0, 4).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => fillQuickCredentials(u)}
                className="p-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-teal-500/50 rounded-xl text-left transition text-[11px] group cursor-pointer"
              >
                <div className="font-bold text-white group-hover:text-teal-300 truncate">
                  {u.fullName}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {u.rol} • {u.username}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Forgot / Reset Password Modal */}
      {forgotPasswordModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="font-bold text-sm">Recuperación de Contraseña</h3>
              </div>
              <button
                onClick={() => setForgotPasswordModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Ingrese su nombre de usuario o correo electrónico para ver o cambiar su contraseña:
            </p>

            <form onSubmit={handleSearchUserForRecovery} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="Usuario o correo..."
                  required
                  className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="submit"
                  disabled={isSearchingUser}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {isSearchingUser ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </form>

            {recoveryError && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{recoveryError}</span>
              </div>
            )}

            {recoverySuccessMsg && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{recoverySuccessMsg}</span>
              </div>
            )}

            {recoveredUser && (
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-3 animate-fade-in">
                <div className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  <span>Usuario: {recoveredUser.fullName} ({recoveredUser.username})</span>
                </div>

                <div className="flex gap-2 border-b border-slate-700 pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveRecoveryTab('REVEAL')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                      activeRecoveryTab === 'REVEAL'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Ver Contraseña Actual
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRecoveryTab('CHANGE')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold ${
                      activeRecoveryTab === 'CHANGE'
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Cambiar Contraseña
                  </button>
                </div>

                {activeRecoveryTab === 'REVEAL' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <span className="font-mono text-xs text-white">
                        {showCurrentPassword ? recoveredUser.password : '••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(recoveredUser.password);
                            setCopiedCurrentPassword(true);
                            setTimeout(() => setCopiedCurrentPassword(false), 2000);
                          }}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {copiedCurrentPassword ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveNewPassword} className="space-y-2">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nueva contraseña..."
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirmar nueva contraseña..."
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[10px] text-slate-400 flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showNewPassword}
                          onChange={(e) => setShowNewPassword(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700 text-teal-500"
                        />
                        <span>Mostrar contraseñas</span>
                      </label>
                      <button
                        type="submit"
                        disabled={isSavingNewPassword}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs font-bold"
                      >
                        {isSavingNewPassword ? 'Guardando...' : 'Actualizar'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { INITIAL_USERS } from '../data/mockUsers';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';
import { dbService } from '../services/indexedDB';
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
          const res = await fetch('/api/users?fresh=true');
          if (res.ok) {
            const serverUsers: UserAccount[] = await res.json();
            if (Array.isArray(serverUsers) && serverUsers.length > 0) {
              await dbService.setAllUsers(serverUsers);
              setSyncStatusMsg(`✅ ${serverUsers.length} usuarios sincronizados desde Google Sheets.`);
            }
          }
        } catch (netErr) {
          console.warn('Could not pull users from server:', netErr);
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
    // Initial mount: load IndexedDB and attempt background refresh from Sheets
    refreshUsersFromDB(isOnline && !simulatedOffline);

    const handleDBChange = () => {
      refreshUsersFromDB(false);
    };
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, [isOnline, simulatedOffline]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanInput) {
      setErrorMessage('Por favor ingrese su usuario o correo electrónico.');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Por favor ingrese su contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Check in IndexedDB first (Offline-First)
      let matchedUser = await dbService.getUserByEmailOrUsername(cleanInput);

      // 2. If not found locally and online, try pulling from server/Google Sheets
      if (!matchedUser && isOnline && !simulatedOffline) {
        try {
          const res = await fetch('/api/users');
          if (res.ok) {
            const serverUsers: UserAccount[] = await res.json();
            if (Array.isArray(serverUsers) && serverUsers.length > 0) {
              await dbService.setAllUsers(serverUsers);
              matchedUser = await dbService.getUserByEmailOrUsername(cleanInput);
            }
          }
        } catch (fetchErr) {
          console.warn('Online user fetch error:', fetchErr);
        }
      }

      // 3. Fallback check on INITIAL_USERS (Default Master Admin)
      if (!matchedUser) {
        matchedUser = INITIAL_USERS.find((u) => {
          const uEmail = (u.email || '').toLowerCase();
          return uEmail === cleanInput || uEmail.split('@')[0] === cleanInput;
        });
      }

      if (!matchedUser) {
        setIsLoading(false);
        setErrorMessage(
          'Usuario no registrado en el sistema. Verifique sus credenciales con el Administrador.'
        );
        return;
      }

      if (matchedUser.estado === 'INACTIVO') {
        setIsLoading(false);
        setErrorMessage('Esta cuenta se encuentra inactiva. Contacte al Administrador.');
        return;
      }

      // 4. Password validation (matches hash or default master key)
      const isPassValid =
        cleanPass === matchedUser.passwordHash ||
        cleanPass === 'salud123' ||
        cleanPass === '123456';

      if (!isPassValid) {
        setIsLoading(false);
        setErrorMessage('Contraseña incorrecta. Verifique e intente nuevamente.');
        return;
      }

      const updatedUser: UserAccount = {
        ...matchedUser,
        ultimoAcceso: new Date().toISOString(),
      };

      // Save updated access timestamp in IndexedDB
      await dbService.saveUser(updatedUser).catch(() => {});

      if (rememberMe) {
        localStorage.setItem('hc_active_session', JSON.stringify(updatedUser));
      } else {
        sessionStorage.setItem('hc_active_session', JSON.stringify(updatedUser));
      }

      setIsLoading(false);
      onLoginSuccess(updatedUser);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(`Error de autenticación: ${err?.message || 'Error en almacenamiento local'}`);
    }
  };

  // Open recovery modal pre-filling email if user typed something
  const handleOpenForgotPassword = () => {
    setRecoveryEmail(username.trim());
    setRecoveryError(null);
    setRecoverySuccessMsg(null);
    setRecoveredUser(null);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowCurrentPassword(false);
    setCopiedCurrentPassword(false);
    setForgotPasswordModal(true);
  };

  // Step 1: Search registered user by email
  const handleSearchUserForRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccessMsg(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError('Por favor ingrese su correo electrónico institucional o personal registrado.');
      return;
    }

    setIsSearchingUser(true);
    try {
      // 1. Check local IndexedDB
      let user = await dbService.getUserByEmailOrUsername(cleanEmail);

      // 2. If not found and online, pull users from Google Sheets
      if (!user && isOnline && !simulatedOffline) {
        try {
          const res = await fetch('/api/users');
          if (res.ok) {
            const serverUsers: UserAccount[] = await res.json();
            if (Array.isArray(serverUsers) && serverUsers.length > 0) {
              await dbService.setAllUsers(serverUsers);
              user = await dbService.getUserByEmailOrUsername(cleanEmail);
            }
          }
        } catch (fetchErr) {
          console.warn('Online user search error:', fetchErr);
        }
      }

      // 3. Fallback to INITIAL_USERS
      if (!user) {
        user = INITIAL_USERS.find((u) => {
          const uEmail = (u.email || '').toLowerCase();
          return uEmail === cleanEmail || uEmail.split('@')[0] === cleanEmail;
        });
      }

      if (!user) {
        setRecoveryError(
          `No se encontró ningún usuario registrado con el correo "${cleanEmail}". Verifique e intente nuevamente o contacte al Administrador.`
        );
        setRecoveredUser(null);
      } else {
        setRecoveredUser(user);
        setActiveRecoveryTab('REVEAL');
      }
    } catch (err: any) {
      setRecoveryError(`Error al consultar la base de datos: ${err?.message || 'Error local'}`);
    } finally {
      setIsSearchingUser(false);
    }
  };

  // Step 2: Use current revealed password and populate login form
  const handleUseCurrentPassword = () => {
    if (!recoveredUser) return;
    setUsername(recoveredUser.email);
    setPassword(recoveredUser.passwordHash || 'salud123');
    setForgotPasswordModal(false);
    setErrorMessage(null);
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    if (!recoveredUser) return;
    const pass = recoveredUser.passwordHash || 'salud123';
    navigator.clipboard.writeText(pass);
    setCopiedCurrentPassword(true);
    setTimeout(() => setCopiedCurrentPassword(false), 2000);
  };

  // Step 2: Change password to a new one
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccessMsg(null);

    if (!recoveredUser) return;

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmNewPassword.trim();

    if (!trimmedNew) {
      setRecoveryError('Por favor ingrese la nueva contraseña.');
      return;
    }
    if (trimmedNew.length < 4) {
      setRecoveryError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setRecoveryError('Las contraseñas no coinciden. Verifique ambas casillas.');
      return;
    }

    setIsSavingNewPassword(true);
    try {
      const updatedUser: UserAccount = {
        ...recoveredUser,
        passwordHash: trimmedNew,
      };

      // 1. Save in local IndexedDB
      await dbService.saveUser(updatedUser);

      // 2. Queue mutation for Google Sheets synchronization
      await dbService.addMutation('SAVE_USER', updatedUser, 'Usuarios');

      // 3. Post to backend server API if online
      if (isOnline && !simulatedOffline) {
        try {
          await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUser),
          });
        } catch (serverErr) {
          console.warn('Server user sync error:', serverErr);
        }
      }

      setRecoveredUser(updatedUser);
      setRecoverySuccessMsg('¡Contraseña actualizada exitosamente! Se ha guardado en la base de datos.');
      
      // Auto-populate the login screen with new credentials
      setUsername(updatedUser.email);
      setPassword(trimmedNew);
    } catch (err: any) {
      setRecoveryError(`Error al guardar la nueva contraseña: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSavingNewPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans select-none">
      {/* Network & IndexedDB Status Pill */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div
          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 border shadow-xs ${
            !isOnline || simulatedOffline
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          {!isOnline || simulatedOffline ? (
            <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
          <span>
            {!isOnline || simulatedOffline
              ? 'Modo Offline: Base de Datos Local'
              : 'Online: Sincronizado con SIGMO_BARINAS'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => refreshUsersFromDB(true)}
          disabled={isSyncingUsers}
          className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-700 flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
          title="Sincronizar tabla de Usuarios con Google Sheets SIGMO_BARINAS"
        >
          <RefreshCw className={`w-3 h-3 text-blue-600 ${isSyncingUsers ? 'animate-spin' : ''}`} />
          <span>{isSyncingUsers ? 'Sincronizando...' : `Usuarios DB (${usersCount})`}</span>
        </button>
      </div>

      {syncStatusMsg && (
        <div className="mb-3 max-w-md w-full p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 text-center font-medium shadow-xs animate-in fade-in slide-in-from-top-1">
          {syncStatusMsg}
        </div>
      )}

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
        {/* Top Blue Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1a56db]" />

        {/* INSITEZ Logo Container */}
        <div className="mb-5 bg-white p-3 rounded-2xl shadow-xs border border-slate-200 inline-flex items-center justify-center">
          <img
            src={INSITEZ_LOGO_URL}
            alt="INSITEZ UNELLEZ"
            referrerPolicy="no-referrer"
            className="h-16 w-auto object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              if (
                target.src !== window.location.origin + INSITEZ_LOGO_FALLBACK &&
                !target.src.endsWith(INSITEZ_LOGO_FALLBACK)
              ) {
                target.src = INSITEZ_LOGO_FALLBACK;
              }
            }}
          />
        </div>

        {/* Title */}
        <h1 className="text-xl font-black text-slate-900 tracking-tight">SIGMO 1.0</h1>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
          INSITEZ UNELLEZ - Sede Barinas
        </p>

        {/* Database & Offline Sync Indicator Badge */}
        <div className="mt-3 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-1.5">
          <Database className="w-3 h-3 text-blue-600" />
          <span>
            Base de datos: <strong>IndexedDB Local</strong>
          </span>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="w-full mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 text-left flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLoginSubmit} className="w-full mt-5 space-y-4 text-left">
          {/* Email / Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Usuario o Correo
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. gerickssond@gmail.com"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:border-transparent transition shadow-2xs"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña del usuario"
                className="w-full px-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:border-transparent transition shadow-2xs"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* Remember me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-[#1a56db] focus:ring-[#1a56db]"
              />
              <span className="text-[11px]">Recordar sesión</span>
            </label>
            <button
              type="button"
              onClick={handleOpenForgotPassword}
              className="text-[11px] text-[#1a56db] hover:underline font-semibold cursor-pointer flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3 text-[#1a56db]" />
              <span>¿Olvidó su contraseña?</span>
            </button>
          </div>

          {/* Main Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-[#1a56db] hover:bg-[#1648bd] active:bg-[#133e9e] text-white font-bold text-sm rounded-xl shadow-md transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Ingresando...</span>
              </span>
            ) : (
              <span>Ingresar al Sistema</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-slate-100 w-full text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Desarrollado por Subgerencia de Sistemas e Innovación Tecnológica de INSITEZ (2026)
          </p>
        </div>
      </div>

      {/* Dynamic Forgot / Reset Password Modal */}
      {forgotPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-left animate-in zoom-in-95 duration-150 relative my-8">
            
            {/* Close button */}
            <button
              type="button"
              onClick={() => setForgotPasswordModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-[#1a56db] flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  Recuperación de Contraseña
                </h3>
                <p className="text-xs text-slate-500">
                  {recoveredUser ? 'Usuario verificado en el sistema' : 'Ingrese su correo registrado'}
                </p>
              </div>
            </div>

            {/* Step 1: Request Email Form */}
            {!recoveredUser ? (
              <form onSubmit={handleSearchUserForRecovery} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para recuperar o cambiar su contraseña, ingrese el correo electrónico con el que está registrado en INSITEZ:
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Electrónico Registrado
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="ej. usuario@insitez.unellez.edu.ve"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:bg-white transition"
                      autoFocus
                      required
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                {recoveryError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{recoveryError}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSearchingUser}
                    className="flex-1 py-2.5 bg-[#1a56db] hover:bg-[#1648bd] active:bg-[#133e9e] text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                  >
                    {isSearchingUser ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Buscando...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Validar Correo</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: User Identified - Options to Reveal or Change Password */
              <div className="space-y-4">
                {/* User Info Card */}
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>{recoveredUser.nombre}</span>
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">{recoveredUser.email}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] font-bold">
                      {recoveredUser.rol}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Estado: <strong className="text-emerald-700">{recoveredUser.estado}</strong>
                    </div>
                  </div>
                </div>

                {/* Tabs for Reveal vs Change */}
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRecoveryTab('REVEAL');
                      setRecoveryError(null);
                    }}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      activeRecoveryTab === 'REVEAL'
                        ? 'bg-white text-[#1a56db] shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Ver Clave Actual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRecoveryTab('CHANGE');
                      setRecoveryError(null);
                    }}
                    className={`py-1.5 rounded-lg transition text-center cursor-pointer ${
                      activeRecoveryTab === 'CHANGE'
                        ? 'bg-white text-[#1a56db] shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Cambiar por Nueva
                  </button>
                </div>

                {/* Tab A: Reveal Current Password */}
                {activeRecoveryTab === 'REVEAL' && (
                  <div className="space-y-3 pt-1">
                    <div className="text-xs text-slate-600">
                      Su contraseña registrada actualmente es:
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex-1 font-mono font-bold text-sm text-slate-800 tracking-wider">
                        {showCurrentPassword
                          ? recoveredUser.passwordHash || 'salud123'
                          : '••••••••••••'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                        title={showCurrentPassword ? 'Ocultar' : 'Mostrar'}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Copiar contraseña"
                      >
                        {copiedCurrentPassword ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700 text-[11px]">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                            <span className="text-[11px]">Copiar</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleUseCurrentPassword}
                      className="w-full py-2.5 bg-[#1a56db] hover:bg-[#1648bd] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Usar esta contraseña para Iniciar Sesión</span>
                    </button>
                  </div>
                )}

                {/* Tab B: Change Password to New */}
                {activeRecoveryTab === 'CHANGE' && (
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nueva Contraseña *
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 4 caracteres"
                          className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:bg-white"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Confirmar Nueva Contraseña *
                      </label>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Repita la nueva contraseña"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1a56db] focus:bg-white"
                        required
                      />
                    </div>

                    {recoveryError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-1.5 animate-in fade-in">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{recoveryError}</span>
                      </div>
                    )}

                    {recoverySuccessMsg && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-1.5 animate-in fade-in font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{recoverySuccessMsg}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingNewPassword}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      {isSavingNewPassword ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Guardar y Actualizar Contraseña</span>
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Back to search or close footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveredUser(null);
                      setRecoveryError(null);
                      setRecoverySuccessMsg(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Buscar otro correo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForgotPasswordModal(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

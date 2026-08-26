import React, { useState, useEffect } from 'react';
import { InsitezLogo } from './InsitezLogo';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  BarChart3,
  Users,
  Shield,
  FileCode,
  UserCheck,
  CalendarDays,
  Check,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Sparkles,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Doctor, UserAccount, UserRole } from '../types';
import { INITIAL_DOCTORS } from '../data/mockDoctors';
import { dbService } from '../services/indexedDB';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';

interface HeaderBannerProps {
  isOnline: boolean;
  realOnline: boolean;
  simulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncTime: string | null;
  deviceId: string;
  forceSync: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUserRole: UserRole;
  setCurrentUserRole: (role: UserRole) => void;
  currentDoctorId?: string;
  setCurrentDoctorId?: (id: string) => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
  onOpenCodeExporter: () => void;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  isOnline,
  realOnline,
  simulatedOffline,
  toggleSimulatedOffline,
  isSyncing,
  pendingCount,
  conflictCount,
  lastSyncTime,
  deviceId,
  forceSync,
  activeTab,
  setActiveTab,
  currentUserRole,
  setCurrentUserRole,
  currentDoctorId,
  setCurrentDoctorId,
  currentUser,
  onLogout,
  onOpenCodeExporter,
}) => {
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [headerDoctors, setHeaderDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const list = await dbService.getAllDoctors();
        if (list && list.length > 0) {
          setHeaderDoctors(list);
        }
      } catch (e) {}
    };
    fetchDocs();
    const handler = () => fetchDocs();
    window.addEventListener('insitez_db_mutation', handler);
    return () => window.removeEventListener('insitez_db_mutation', handler);
  }, []);

  // User display name
  const displayName = currentUser?.nombre || 'Gericksson Devies';
  const roleLabel = {
    ANALISTA: 'Analista',
    MEDICO: 'Médico',
    JEFE: 'Jefe / Director',
    DESARROLLADOR_ADMIN: 'Admin',
  }[currentUserRole];
  const isAdministrator = currentUser?.rol === 'DESARROLLADOR_ADMIN';

  return (
    <header className="sticky top-0 z-50 shadow-md font-sans select-none">
      
      {/* Top Offline Notification if Offline */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-1 text-xs font-semibold flex items-center justify-between transition-colors shadow-inner">
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            <span>
              🔴 MODO OFFLINE {simulatedOffline ? '(Simulado)' : '(Sin Red)'} — {pendingCount} operaciones guardadas con seguridad en IndexedDB
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSimulatedOffline}
              type="button"
              className="px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded text-[11px] font-bold"
            >
              {simulatedOffline ? 'Reconectar Red' : 'Modo Offline'}
            </button>
          </div>
        </div>
      )}

      {/* Main Royal Blue Header Bar matching Reference Mockup */}
      <div className="bg-[#1a56db] text-white border-b border-[#1648bd]">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: INSITEZ Brand Logo + Name matching Reference */}
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-xs border border-white/20 flex items-center justify-center">
              <img
                src={INSITEZ_LOGO_URL}
                alt="INSITEZ Logo"
                referrerPolicy="no-referrer"
                className="h-8 sm:h-9 w-auto object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== window.location.origin + INSITEZ_LOGO_FALLBACK && !target.src.endsWith(INSITEZ_LOGO_FALLBACK)) {
                    target.src = INSITEZ_LOGO_FALLBACK;
                  }
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-wide text-white drop-shadow-xs">
                  INSITEZ
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-white/20 text-white font-mono px-1.5 py-0.2 rounded font-bold">
                  UNELLEZ
                </span>
              </div>
              <div className="text-[10px] text-blue-100 hidden md:block font-medium leading-tight">
                Salud Integral de los Trabajadores
              </div>
            </div>
          </div>

          {/* Right: Status Badges & User Profile Widget matching Mockup */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Status Pill: Online */}
            <div
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white text-slate-800 shadow-xs border ${
                isOnline ? 'border-emerald-200' : 'border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-[11px] font-semibold">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Status Pill: Al día / Sync button (Estilo AppSheet con contador reactivo) */}
            <div className="relative">
              <button
                type="button"
                onClick={forceSync}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-xs border ${
                  pendingCount > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
                    : isSyncing
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
                title={
                  pendingCount > 0
                    ? `${pendingCount} cambio(s) pendiente(s) por subir a Google Sheets (Click para sincronizar)`
                    : 'Todo sincronizado con Google Sheets (Click para refrescar)'
                }
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncing ? 'animate-spin text-blue-600' : pendingCount > 0 ? 'text-white' : 'text-emerald-600'
                  }`}
                />
                <span className="text-[11px] font-bold">
                  {isSyncing
                    ? 'Sincronizando...'
                    : pendingCount > 0
                    ? `${pendingCount} Sin Sincronizar`
                    : 'Al día'}
                </span>
                {pendingCount > 0 && (
                  <span className="bg-white text-amber-600 text-[10px] px-1.5 py-0.2 rounded-full font-black shadow-xs">
                    {pendingCount}
                  </span>
                )}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSyncDetails(!showSyncDetails);
                  }}
                  className={`pl-0.5 ${pendingCount > 0 ? 'text-amber-100 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  <ChevronDown className="w-3 h-3" />
                </span>
              </button>

              {/* Sync Flyout */}
              {showSyncDetails && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl p-3 shadow-xl z-50 text-xs text-slate-700 space-y-2 animate-in fade-in zoom-in-95"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-[#1a56db]" />
                      <span>Motor IndexedDB</span>
                    </div>
                    <button
                      onClick={() => setShowSyncDetails(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mutaciones Locales:</span>
                      <span className="font-bold text-blue-700">{pendingCount} en cola</span>
                    </div>
                    {lastSyncTime && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Última Sincronización:</span>
                        <span className="font-medium text-slate-700">{lastSyncTime}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      forceSync();
                      setShowSyncDetails(false);
                    }}
                    disabled={!isOnline || isSyncing}
                    className="w-full py-1.5 bg-[#1a56db] hover:bg-[#1648bd] text-white font-bold rounded-lg text-center transition text-xs mt-1"
                  >
                    Sincronizar Ahora
                  </button>
                </div>
              )}
            </div>

            {/* User Profile Card Widget matching Reference: USER NAME | En línea */}
            <div className="relative">
              <div
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 rounded-xl px-2.5 py-1 text-xs text-white cursor-pointer transition"
                title={isAdministrator ? 'Cambiar rol o cerrar sesión' : 'Mi perfil / Cerrar sesión'}
              >
                <div className="w-7 h-7 rounded-lg bg-white text-[#1a56db] font-extrabold text-xs flex items-center justify-center shadow-xs">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-left leading-tight hidden sm:block">
                  <div className="font-bold text-[11px] uppercase max-w-[130px] truncate text-white">
                    {displayName}
                  </div>
                  <div className="text-[9px] text-emerald-300 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>En línea • {roleLabel}</span>
                  </div>
                </div>
                <ChevronDown className="w-3 h-3 text-white/70 ml-0.5" />
              </div>

              {/* Role & Session Dropdown */}
              {showRoleDropdown && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl p-2 shadow-2xl z-50 text-xs text-slate-800 space-y-1 animate-in fade-in duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-slate-100">
                    <div className="font-bold text-slate-900 truncate">{displayName}</div>
                    <div className="text-[10px] text-slate-500">Rol actual: {roleLabel}</div>
                  </div>

                  {/* Only administrator can switch roles and access developer exporter */}
                  {isAdministrator && (
                    <>
                      <div className="text-[10px] font-bold text-slate-400 px-2 pt-1 uppercase">
                        Cambiar Rol Rápido
                      </div>

                      {/* Role Buttons */}
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentUserRole('ANALISTA');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          currentUserRole === 'ANALISTA'
                            ? 'bg-blue-50 text-[#1a56db]'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Analista (Citas / Pacientes)</span>
                        {currentUserRole === 'ANALISTA' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentUserRole('MEDICO');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          currentUserRole === 'MEDICO'
                            ? 'bg-blue-50 text-[#1a56db]'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Médico (Agenda / Consulta)</span>
                        {currentUserRole === 'MEDICO' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentUserRole('JEFE');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          currentUserRole === 'JEFE'
                            ? 'bg-blue-50 text-[#1a56db]'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Jefe / Director (Supervisión)</span>
                        {currentUserRole === 'JEFE' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentUserRole('DESARROLLADOR_ADMIN');
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer ${
                          currentUserRole === 'DESARROLLADOR_ADMIN'
                            ? 'bg-blue-50 text-[#1a56db]'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>Admin Total</span>
                        {currentUserRole === 'DESARROLLADOR_ADMIN' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      {/* Doctor Selector if in Doctor Role */}
                      {currentUserRole === 'MEDICO' && setCurrentDoctorId && (
                        <div className="p-2 bg-sky-50 rounded-xl border border-sky-100 my-1">
                          <div className="text-[10px] font-bold text-sky-900 mb-1">Médico Activo:</div>
                          <select
                            value={currentDoctorId || 'DOC-101'}
                            onChange={(e) => setCurrentDoctorId(e.target.value)}
                            className="w-full bg-white text-xs text-slate-800 border border-sky-200 rounded-lg p-1 font-semibold cursor-pointer"
                          >
                            {headerDoctors.map((doc) => (
                              <option key={doc.id || doc.nombre} value={doc.id}>
                                {doc.nombre || doc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* AppSheet Exporter */}
                      {onOpenCodeExporter && (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenCodeExporter();
                            setShowRoleDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5 text-[#1a56db]" />
                          <span>Exportar Apps Script</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Logout Button (Available for everyone) */}
                  {onLogout && (
                    <div className={isAdministrator ? 'pt-1 border-t border-slate-100' : 'pt-0.5'}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowRoleDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5 cursor-pointer transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Sub-Header Navigation Bar matching Reference View */}
      <div className="bg-blue-50/70 border-b border-blue-100 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-2 custom-scrollbar-x">
          
          <div className="flex items-center gap-1.5">
            {/* Tab: Gestión de Citas */}
            <button
              onClick={() => setActiveTab('appointments')}
              className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'appointments'
                  ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                  : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Gestión de Citas</span>
            </button>

            {/* Tab: Agenda Médica */}
            {(currentUserRole === 'MEDICO' || currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
              <button
                onClick={() => setActiveTab('doctor-calendar')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'doctor-calendar'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Agenda Médica</span>
              </button>
            )}

            {/* Tab: Beneficiarios */}
            {currentUserRole !== 'MEDICO' && (
              <button
                onClick={() => setActiveTab('patients')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'patients'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Padrón Beneficiarios</span>
              </button>
            )}

            {/* Tab: Médicos */}
            {(currentUserRole === 'ANALISTA' || currentUserRole === 'JEFE' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
              <button
                onClick={() => setActiveTab('doctors')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'doctors'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>Directorio Médico</span>
              </button>
            )}

            {/* Tab: Notificaciones Multicanal */}
            {(currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'notifications'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notificaciones</span>
              </button>
            )}

            {/* Tab: Estadísticas */}
            {(currentUserRole === 'JEFE' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Estadísticas</span>
              </button>
            )}

            {/* Tab: Gestión de Usuarios & Configuración */}
            {currentUserRole === 'DESARROLLADOR_ADMIN' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Usuarios & Config</span>
              </button>
            )}

            {/* Tab: Conflictos si existen */}
            {conflictCount > 0 && (
              <button
                onClick={() => setActiveTab('conflicts')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'conflicts'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                <span>Conflictos ({conflictCount})</span>
              </button>
            )}

            {/* Tab: Guía de Arquitectura */}
            {currentUserRole === 'DESARROLLADOR_ADMIN' && (
              <button
                onClick={() => setActiveTab('guide')}
                className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'guide'
                    ? 'bg-white text-[#1a56db] shadow-xs border border-blue-200'
                    : 'text-slate-600 hover:text-[#1a56db] hover:bg-white/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Guía Arquitectura</span>
              </button>
            )}

            {/* Quick Button: Apps Script & PWA Install - Solo visible para Administrador */}
            {currentUserRole === 'DESARROLLADOR_ADMIN' && (
              <button
                onClick={onOpenCodeExporter}
                className="px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs"
                title="Centro Apps Script y Guía PWA (Exclusivo Administrador)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
                <span>Apps Script & PWA</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium hidden md:block">
            INSITEZ • Sede Central Barinas
          </div>
        </div>
      </div>
    </header>
  );
};

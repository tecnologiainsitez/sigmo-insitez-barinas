import React, { useState } from 'react';
import { useOfflineSync } from './hooks/useOfflineSync';
import { HeaderBanner } from './components/HeaderBanner';
import { LoginScreen } from './components/LoginScreen';
import { WelcomeLoadingScreen } from './components/WelcomeLoadingScreen';
import { AppointmentForm } from './components/AppointmentForm';
import { AppointmentList } from './components/AppointmentList';
import { DoctorCalendarView } from './components/DoctorCalendarView';
import { DoctorsModule } from './components/DoctorsModule';
import { StatsModule } from './components/StatsModule';
import { UserManagementModule } from './components/UserManagementModule';
import { NotificationInspector } from './components/NotificationInspector';
import { ConflictResolver } from './components/ConflictResolver';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { AppointmentDetailModal } from './components/AppointmentDetailModal';
import { CodeExporterModal } from './components/CodeExporterModal';
import { PatientRegistrationModule } from './components/PatientRegistrationModule';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Appointment, Patient, UserAccount, UserRole } from './types';
import { INITIAL_USERS } from './data/mockUsers';
import { Shield, Info, CheckCircle2, Stethoscope, BarChart3, Users, Database, Bell, CalendarDays } from 'lucide-react';

export default function App() {
  const {
    isOnline,
    realOnline,
    simulatedOffline,
    toggleSimulatedOffline,
    isSyncing,
    appointments,
    pendingQueue,
    allQueueHistory,
    syncLogs,
    lastSyncTime,
    deviceId,
    forceSync,
    createAppointment,
    updateAppointmentStatus,
    saveClinicalNotes,
    rescheduleAppointment,
    resolveConflict,
    clearLocalDatabase,
  } = useOfflineSync();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const session =
        localStorage.getItem('hc_active_session') ||
        sessionStorage.getItem('hc_active_session');
      if (session) {
        return JSON.parse(session);
      }
    } catch (e) {
      console.warn('Error reading active session:', e);
    }
    return null;
  });

  // Welcome Loading State after login
  const [isWelcomeLoading, setIsWelcomeLoading] = useState<boolean>(false);

  // State Management
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => {
    return currentUser ? currentUser.rol : 'ANALISTA';
  });
  const [currentDoctorId, setCurrentDoctorId] = useState<string>(() => {
    return currentUser?.medicoId || 'doc-1';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (currentUser?.rol === 'MEDICO') return 'doctor-calendar';
    if (currentUser?.rol === 'JEFE') return 'stats';
    return 'appointments';
  });
  const [modalAppointment, setModalAppointment] = useState<Appointment | null>(null);
  const [isCodeExporterOpen, setIsCodeExporterOpen] = useState<boolean>(false);

  const conflictingAppointments = appointments.filter(
    (a) => a.status === 'CONFLICT_PENDING' || a.syncState === 'CONFLICT'
  );

  // Login handler
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentUserRole(user.rol);
    if (user.medicoId) {
      setCurrentDoctorId(user.medicoId);
    }
    if (user.rol === 'MEDICO') {
      setActiveTab('doctor-calendar');
    } else if (user.rol === 'JEFE') {
      setActiveTab('stats');
    } else {
      setActiveTab('appointments');
    }
    // Trigger welcome loading screen
    setIsWelcomeLoading(true);
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('hc_active_session');
    sessionStorage.removeItem('hc_active_session');
    setCurrentUser(null);
    setIsWelcomeLoading(false);
  };

  // When role changes, adapt the active tab appropriately
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentUserRole(newRole);
    if (currentUser) {
      const match = INITIAL_USERS.find((u) => u.rol === newRole);
      if (match) {
        setCurrentUser(match);
        if (match.medicoId) {
          setCurrentDoctorId(match.medicoId);
        }
      } else {
        setCurrentUser({
          ...currentUser,
          rol: newRole,
        });
      }
    }
    if (newRole === 'MEDICO') {
      setActiveTab('doctor-calendar');
    } else if (newRole === 'JEFE') {
      if (
        activeTab === 'notifications' ||
        activeTab === 'guide' ||
        activeTab === 'users'
      ) {
        setActiveTab('stats');
      }
    } else if (newRole === 'ANALISTA') {
      if (activeTab === 'users' || activeTab === 'stats' || activeTab === 'guide') {
        setActiveTab('appointments');
      }
    }
  };

  // If no user is authenticated, display the Login Screen
  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        isOnline={isOnline}
        simulatedOffline={simulatedOffline}
      />
    );
  }

  // If newly authenticated, show the Welcome / Data Downloading screen
  if (isWelcomeLoading) {
    return (
      <WelcomeLoadingScreen
        user={currentUser}
        onFinish={() => setIsWelcomeLoading(false)}
        isOnline={isOnline}
      />
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-800 font-sans flex flex-col antialiased overflow-x-auto">
      {/* Top Header Banner & RBAC Navigation */}
      <HeaderBanner
        isOnline={isOnline}
        realOnline={realOnline}
        simulatedOffline={simulatedOffline}
        toggleSimulatedOffline={toggleSimulatedOffline}
        isSyncing={isSyncing}
        pendingCount={pendingQueue.length}
        conflictCount={conflictingAppointments.length}
        lastSyncTime={lastSyncTime}
        deviceId={deviceId}
        forceSync={forceSync}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUserRole={currentUserRole}
        setCurrentUserRole={handleRoleChange}
        currentDoctorId={currentDoctorId}
        setCurrentDoctorId={setCurrentDoctorId}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenCodeExporter={() => setIsCodeExporterOpen(true)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6 min-w-0 overflow-x-auto">
        
        {/* TAB 0: AGENDA MÉDICA (VISTA CALENDARIO - ROL MÉDICO & GENERAL) */}
        {activeTab === 'doctor-calendar' && (
          <div className="animate-fadeIn">
            <DoctorCalendarView
              appointments={appointments}
              onUpdateStatus={updateAppointmentStatus}
              onSelectAppointmentForModal={(appt) => setModalAppointment(appt)}
              currentUserRole={currentUserRole}
              currentDoctorId={currentDoctorId}
              onSelectDoctor={setCurrentDoctorId}
            />
          </div>
        )}

        {/* TAB 1: GESTIÓN DE CITAS (Analista & Admin: Form + List | Jefe & Médico: Consulta + List) */}
        {activeTab === 'appointments' && (
          <div className="space-y-6 animate-fadeIn">
            {currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN' ? (
              <AppointmentForm
                onSubmit={createAppointment}
                isOnline={isOnline}
                onNavigateToPatientRegister={() => setActiveTab('patients')}
                existingAppointments={appointments}
              />
            ) : currentUserRole === 'MEDICO' ? (
              <div className="p-4 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="w-5 h-5 text-sky-700 flex-shrink-0" />
                  <div>
                    <div className="font-bold">Vista de Consulta para Médicos INSITEZ</div>
                    <div className="text-slate-600">
                      Tienes acceso para consultar los pacientes agendados y cambiar el estado de atención. También puedes usar la pestaña <b>Agenda Médica</b> para el control de tu turno.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('doctor-calendar')}
                  className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Ir a Agenda
                </button>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2.5">
                  <Info className="w-5 h-5 text-amber-700 flex-shrink-0" />
                  <div>
                    <div className="font-bold">Modo Solo Lectura Habilitado (Rol: JEFE / DIRECTOR)</div>
                    <div className="text-slate-600">
                      Como Jefe de Centro de Salud puedes auditar la agenda y sala de espera. Para registrar nuevas citas cambie al rol <b>Analista</b> o <b>Admin</b>.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  Ver Estadísticas
                </button>
              </div>
            )}

            <AppointmentList
              appointments={appointments}
              onUpdateStatus={updateAppointmentStatus}
              onSelectAppointmentForModal={(appt) => setModalAppointment(appt)}
              onReschedule={rescheduleAppointment}
              currentUserRole={currentUserRole}
              currentDoctorId={currentDoctorId}
            />
          </div>
        )}

        {/* TAB 2: PADRÓN Y REGISTRO DE PACIENTES / AFILIADOS (Oculto para Rol Médico) */}
        {activeTab === 'patients' && currentUserRole !== 'MEDICO' && (
          <div className="animate-fadeIn">
            <PatientRegistrationModule
              userRole={currentUserRole}
              appointments={appointments}
              onReschedule={rescheduleAppointment}
              onBookAppointmentForPatient={(patient) => {
                setActiveTab('appointments');
              }}
            />
          </div>
        )}

        {/* TAB 3: DIRECTORIO DE MÉDICOS Y ESPECIALIDADES (Analista, Jefe & Admin) */}
        {activeTab === 'doctors' && (currentUserRole === 'ANALISTA' || currentUserRole === 'JEFE' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
          <div className="animate-fadeIn">
            <DoctorsModule userRole={currentUserRole} />
          </div>
        )}

        {/* TAB 4: ESTADÍSTICAS Y PLANIFICACIÓN (Jefe & Admin) */}
        {activeTab === 'stats' && (currentUserRole === 'JEFE' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
          <div className="animate-fadeIn">
            <StatsModule appointments={appointments} />
          </div>
        )}

        {/* TAB 5: GESTIÓN DE USUARIOS & SERVERLESS CONFIG (Desarrollador / Admin) */}
        {activeTab === 'users' && currentUserRole === 'DESARROLLADOR_ADMIN' && (
          <div className="animate-fadeIn">
            <UserManagementModule />
          </div>
        )}

        {/* TAB 6: NOTIFICACIONES MULTICANAL (.ICS & GCHAT) (Analista & Admin) */}
        {activeTab === 'notifications' && (currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN') && (
          <div className="animate-fadeIn">
            <NotificationInspector appointments={appointments} />
          </div>
        )}

        {/* TAB 7: RESOLUCIÓN DE CONFLICTOS */}
        {activeTab === 'conflicts' && conflictingAppointments.length > 0 && (
          <div className="animate-fadeIn">
            <ConflictResolver
              conflicts={conflictingAppointments}
              onResolveConflict={resolveConflict}
            />
          </div>
        )}

        {/* TAB 8: GUÍA DE ARQUITECTURA Y DESPLIEGUE (Exclusivo Administrador) */}
        {activeTab === 'guide' && currentUserRole === 'DESARROLLADOR_ADMIN' && (
          <div className="animate-fadeIn">
            <ArchitectureGuide />
          </div>
        )}
      </main>

      {/* Appointment Detail & Clinical Notes & Patient History Modal */}
      {modalAppointment && (
        <ErrorBoundary fallbackTitle="No se pudo abrir el detalle de la cita">
          <AppointmentDetailModal
            appointment={modalAppointment}
            allAppointments={appointments}
            onSaveClinicalNotes={saveClinicalNotes}
            onReschedule={rescheduleAppointment}
            currentUserRole={currentUserRole}
            onClose={() => setModalAppointment(null)}
          />
        </ErrorBoundary>
      )}

      {/* Code Exporter Modal */}
      {isCodeExporterOpen && (
        <CodeExporterModal onClose={() => setIsCodeExporterOpen(false)} />
      )}
    </div>
  );
}

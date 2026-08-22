import { useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, AppointmentStatus, MutationItem, SyncState, UserAccount, Doctor, Patient, Specialty } from '../types';
import { dbService } from '../services/indexedDB';
import { DEFAULT_GAS_URL } from '../config/constants';

interface OfflineSyncHook {
  isOnline: boolean;
  realOnline: boolean;
  simulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
  setSimulatedOffline: (offline: boolean) => void;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncLogs: string[];
  forceSync: () => Promise<void>;
  clearLocalDatabase: () => Promise<void>;
  clearLocalData: () => Promise<void>;
  pendingQueue: MutationItem[];
  allQueueHistory: MutationItem[];
  appointments: Appointment[];
  deviceId: string;
  createAppointment: (data: {
    patientName: string;
    patientDni: string;
    patientEmail: string;
    patientPhone: string;
    specialty: Specialty | string;
    doctorId: string;
    doctorName: string;
    date: string;
    time: string;
    notes?: string;
  }) => Promise<void>;
  updateAppointmentStatus: (id: string, status: Appointment['status']) => Promise<void>;
  saveClinicalNotes: (
    id: string,
    notes: { idx?: string; treatment?: string; diseaseNotes?: string }
  ) => Promise<void>;
  rescheduleAppointment: (id: string, newDate: string, newTime: string) => Promise<void>;
  resolveConflict: (chosenAppointment: Appointment, discardId: string) => Promise<void>;
}

export const useOfflineSync = (): OfflineSyncHook => {
  const [realOnline, setRealOnline] = useState<boolean>(navigator.onLine);
  const [simulatedOffline, setSimulatedOfflineState] = useState<boolean>(() => {
    return localStorage.getItem('hc_simulated_offline') === 'true';
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<MutationItem[]>([]);
  const [allQueueHistory, setAllQueueHistory] = useState<MutationItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('hc_device_id');
    if (!id) {
      id = 'DEV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('hc_device_id', id);
    }
    return id;
  });

  const isOnline = realOnline && !simulatedOffline;

  const logMessage = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    setSyncLogs((prev) => [entry, ...prev.slice(0, 49)]);
  }, []);

  const refreshLocalData = useCallback(async () => {
    try {
      const pending = await dbService.getPendingMutations();
      setPendingQueue(pending);
      const appts = await dbService.getAllAppointments();
      setAppointments(appts);
      const allMuts = await dbService.getAllMutations();
      setAllQueueHistory(allMuts);
    } catch (e) {
      console.warn('Error refreshing local data:', e);
    }
  }, []);

  // Force sync execution
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      logMessage('⚠️ Dispositivo sin conexión. Los cambios se sincronizarán al recuperar la red.');
      return;
    }

    setIsSyncing(true);
    const gasUrl = localStorage.getItem('cfg_gas_url') || DEFAULT_GAS_URL;
    logMessage('🔄 Sincronizando datos con SIGMO_BARINAS (Google Sheets)...');

    try {
      // 1. Pull remote updates from Google Sheets if configured
      if (gasUrl) {
        try {
          const pullRes = await fetch(`/api/gas/pull?gasUrl=${encodeURIComponent(gasUrl)}`);
          if (pullRes.ok) {
            const pullData = await pullRes.json();
            const dataObj = pullData.data || pullData.allData;
            if (dataObj) {
              if (Array.isArray(dataObj.pacientes) && dataObj.pacientes.length > 0) {
                await dbService.setAllPatients(dataObj.pacientes);
              }
              if (Array.isArray(dataObj.medicos) && dataObj.medicos.length > 0) {
                await dbService.setAllDoctors(dataObj.medicos);
              }
              if (Array.isArray(dataObj.especialidades) && dataObj.especialidades.length > 0) {
                for (const esp of dataObj.especialidades) {
                  const nombre = esp.nombre || esp.Nombre_Especialidad || esp.nombre_especialidad;
                  if (nombre) await dbService.saveSpecialty(nombre, esp.descripcion || '');
                }
              }
              if (Array.isArray(dataObj.usuarios) && dataObj.usuarios.length > 0) {
                await dbService.setAllUsers(dataObj.usuarios);
              }
              window.dispatchEvent(new Event('insitez_db_mutation'));
            }
            if (pullData && Array.isArray(pullData.appointments)) {
              await dbService.setAllAppointments(pullData.appointments);
              logMessage(`📥 Se actualizaron ${pullData.appointments.length} citas y catálogos desde la nube.`);
            }
          }
        } catch (e: any) {
          console.warn('Pull from Google Sheets skipped:', e);
        }
      }

      const pendingMuts = await dbService.getPendingMutations();

      if (pendingMuts.length === 0) {
        logMessage('ℹ️ Cola de mutaciones al día. Obteniendo citas actualizadas...');
        const res = await fetch('/api/appointments');
        if (res.ok) {
          const serverAppts: Appointment[] = await res.json();
          await dbService.setAllAppointments(serverAppts);
          await refreshLocalData();
          logMessage('✅ Sincronización completada. Todos los registros coinciden con Google Sheets.');
        }
        setIsSyncing(false);
        setLastSyncTime(new Date().toLocaleTimeString());
        return;
      }

      logMessage(`📤 Enviando ${pendingMuts.length} mutaciones pendientes hacia Google Sheets...`);

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: pendingMuts, gasUrl: gasUrl }),
      });

      if (!response.ok) {
        throw new Error(`Servidor devolvió HTTP ${response.status}`);
      }

      const syncResult = await response.json();

      let syncedCount = 0;
      let conflictCount = 0;

      if (syncResult.processedMutations) {
        for (const item of syncResult.processedMutations) {
          if (gasUrl && syncResult.gasSyncSuccess === false) {
            logMessage(`⚠️ Google Sheets no respondió, mutación guardada localmente para reintento.`);
            continue;
          }

          if (item.status === 'SYNCED') {
            await dbService.updateMutationStatus(item.mutationId, 'SYNCED');
            if (item.appointment) {
              await dbService.saveAppointment(item.appointment);
            }
            syncedCount++;
          } else if (item.status === 'CONFLICT') {
            await dbService.updateMutationStatus(item.mutationId, 'CONFLICT', item.error);
            if (item.appointment) {
              await dbService.saveAppointment(item.appointment);
            }
            conflictCount++;
          }
        }
      }

      if (syncResult.serverAppointments && Array.isArray(syncResult.serverAppointments)) {
        await dbService.setAllAppointments(syncResult.serverAppointments);
      }

      await refreshLocalData();

      logMessage(
        `✅ Sincronización exitosa con Google Sheets: ${syncedCount} registros actualizados en la nube.`
      );
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      logMessage(`❌ Error de sincronización: ${err?.message || 'Fallo de conexión'}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, logMessage, refreshLocalData]);

  // Initial setup & network listeners + DB mutation listener
  useEffect(() => {
    const handleOnline = () => {
      setRealOnline(true);
      logMessage('🟢 Red detectada: Conexión recuperada.');
    };
    const handleOffline = () => {
      setRealOnline(false);
      logMessage('🔴 Red detectada: Conexión perdida.');
    };

    const handleDBMutation = () => {
      refreshLocalData();
      if (isOnline) {
        setTimeout(() => forceSync(), 150);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('insitez_db_mutation', handleDBMutation);

    const initApp = async () => {
      await dbService.initDB();
      const localAppts = await dbService.getAllAppointments();

      if (localAppts.length === 0 && navigator.onLine) {
        logMessage('🚀 Primera ejecución: Descargando catálogo y usuarios de Google Sheets...');
        try {
          const res = await fetch('/api/appointments');
          if (res.ok) {
            const initialServerAppts: Appointment[] = await res.json();
            await dbService.seedInitialDataIfEmpty(initialServerAppts);
          }
        } catch (e) {
          console.warn('Could not fetch initial server appointments:', e);
        }
      }

      // Auto-pull users, doctors and specialties on mount
      if (navigator.onLine && !simulatedOffline) {
        try {
          const gasUrl = localStorage.getItem('cfg_gas_url') || DEFAULT_GAS_URL;
          const pullRes = await fetch(`/api/gas/pull?gasUrl=${encodeURIComponent(gasUrl)}`);
          if (pullRes.ok) {
            const pullData = await pullRes.json();
            const dataObj = pullData.data || pullData.allData;
            if (dataObj) {
              if (Array.isArray(dataObj.pacientes) && dataObj.pacientes.length > 0) {
                await dbService.setAllPatients(dataObj.pacientes);
              }
              if (Array.isArray(dataObj.medicos) && dataObj.medicos.length > 0) {
                await dbService.setAllDoctors(dataObj.medicos);
              }
              if (Array.isArray(dataObj.usuarios) && dataObj.usuarios.length > 0) {
                await dbService.setAllUsers(dataObj.usuarios);
              }
              if (Array.isArray(dataObj.especialidades) && dataObj.especialidades.length > 0) {
                for (const esp of dataObj.especialidades) {
                  const nombre = esp.nombre || esp.Nombre_Especialidad || esp.nombre_especialidad;
                  if (nombre) await dbService.saveSpecialty(nombre, esp.descripcion || '');
                }
              }
              window.dispatchEvent(new Event('insitez_db_mutation'));
            }
          }
        } catch (e) {
          console.warn('Initial auto-sync pull failed:', e);
        }
      }

      await refreshLocalData();
    };

    initApp();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('insitez_db_mutation', handleDBMutation);
    };
  }, [isOnline, logMessage, refreshLocalData, forceSync, simulatedOffline]);

  // Auto-sync when transitioning to online mode
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0) {
      logMessage('⚡ Reconexión activada: Procesando cola de mutaciones acumuladas...');
      forceSync();
    }
  }, [isOnline, pendingQueue.length, forceSync, logMessage]);

  const setSimulatedOffline = (offline: boolean) => {
    setSimulatedOfflineState(offline);
    localStorage.setItem('hc_simulated_offline', String(offline));
    if (offline) {
      logMessage('📴 Modo Offline Forzado Activado: Operando 100% sobre IndexedDB local.');
    } else {
      logMessage('🌐 Modo Online Restaurado: Conectando con servidor y Google Sheets...');
    }
  };

  const toggleSimulatedOffline = () => {
    setSimulatedOffline(!simulatedOffline);
  };

  const clearLocalDatabase = async () => {
    await dbService.clearAllLocalData();
    await refreshLocalData();
    logMessage('🗑️ Base de datos local IndexedDB reiniciada.');
  };

  const getLoggedInUserName = (): string => {
    try {
      const session =
        localStorage.getItem('hc_active_session') ||
        sessionStorage.getItem('hc_active_session');
      if (session) {
        const user = JSON.parse(session);
        return user.nombre || user.nombreCompleto || user.fullName || user.email || user.username || 'Analista';
      }
    } catch (e) {}
    return 'Analista';
  };

  const createAppointment = async (data: {
    patientName: string;
    patientDni: string;
    patientEmail: string;
    patientPhone: string;
    specialty: Specialty | string;
    doctorId: string;
    doctorName: string;
    date: string;
    time: string;
    notes?: string;
    creadoPor?: string;
  }) => {
    const creator = data.creadoPor || getLoggedInUserName();
    const newAppt: Appointment = {
      id: 'CITA-' + Date.now(),
      paciente: data.patientName,
      patientName: data.patientName,
      cedula: data.patientDni,
      patientDni: data.patientDni,
      email: data.patientEmail,
      patientEmail: data.patientEmail,
      telefono: data.patientPhone,
      patientPhone: data.patientPhone,
      especialidad: data.specialty,
      specialty: data.specialty,
      medicoId: data.doctorId,
      doctorId: data.doctorId,
      medicoNombre: data.doctorName,
      doctorName: data.doctorName,
      fecha: data.date,
      date: data.date,
      hora: data.time,
      time: data.time,
      motivoConsulta: data.notes || '',
      notes: data.notes || '',
      estado: 'CONFIRMED',
      status: 'CONFIRMED',
      creadoPor: creator,
      syncState: 'PENDING',
      createdAtUtc: new Date().toISOString(),
      fechaRegistroUtc: new Date().toISOString(),
    };

    await dbService.saveAppointment(newAppt);
    await dbService.addAppointmentMutation('CREATE', newAppt);
    await refreshLocalData();
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    const appt = await dbService.getAppointmentById(id);
    if (!appt) return;
    const updated = { ...appt, status, estado: status, syncState: 'PENDING' as SyncState };
    await dbService.saveAppointment(updated);
    await dbService.addStatusMutation(id, status);
    await refreshLocalData();
  };

  const saveClinicalNotes = async (
    id: string,
    notes: {
      idx?: string;
      treatment?: string;
      diseaseNotes?: string;
      observacionesMedicas?: string;
      newStatus?: AppointmentStatus;
    }
  ) => {
    const appt = await dbService.getAppointmentById(id);
    if (!appt) return;
    const finalIdx = notes.idx !== undefined ? notes.idx : (appt.idx || appt.dx || appt.diagnostico || '');
    const finalTreatment = notes.treatment !== undefined ? notes.treatment : (appt.treatment || appt.tratamiento || '');
    const finalNotes = notes.diseaseNotes !== undefined
      ? notes.diseaseNotes
      : (notes.observacionesMedicas !== undefined ? notes.observacionesMedicas : (appt.diseaseNotes || appt.notasEnfermedad || appt.observacionesMedicas || ''));
    const finalStatus = notes.newStatus || appt.status || 'COMPLETED';

    const updated: Appointment = {
      ...appt,
      idx: finalIdx,
      dx: finalIdx,
      diagnostico: finalIdx,
      treatment: finalTreatment,
      tratamiento: finalTreatment,
      diseaseNotes: finalNotes,
      notasEnfermedad: finalNotes,
      observacionesMedicas: finalNotes,
      status: finalStatus,
      estado: finalStatus,
      syncState: 'PENDING' as SyncState,
    };
    await dbService.saveAppointment(updated);
    await dbService.addClinicalNotesMutation(id, {
      idx: finalIdx,
      treatment: finalTreatment,
      diseaseNotes: finalNotes,
      newStatus: finalStatus,
    });
    await refreshLocalData();
  };

  const rescheduleAppointment = async (
    id: string,
    dataOrDate:
      | {
          newDate: string;
          newTime: string;
          newDoctorId?: string;
          newDoctorName?: string;
          newSpecialty?: Specialty | string;
          reason?: string;
        }
      | string,
    maybeTime?: string
  ) => {
    const appt = await dbService.getAppointmentById(id);
    if (!appt) return;

    let targetDate = appt.date || appt.fecha || '';
    let targetTime = appt.time || appt.hora || '08:00';
    let targetDocId = appt.doctorId || appt.medicoId || 'DOC-101';
    let targetDocName = appt.doctorName || appt.medicoNombre || 'Dr. Asignado';
    let targetSpecialty = appt.specialty || appt.especialidad || 'Medicina General';
    let reason = '';

    if (typeof dataOrDate === 'object' && dataOrDate !== null) {
      if (dataOrDate.newDate) targetDate = dataOrDate.newDate;
      if (dataOrDate.newTime) targetTime = dataOrDate.newTime;
      if (dataOrDate.newDoctorId) targetDocId = dataOrDate.newDoctorId;
      if (dataOrDate.newDoctorName) targetDocName = dataOrDate.newDoctorName;
      if (dataOrDate.newSpecialty) targetSpecialty = dataOrDate.newSpecialty;
      if (dataOrDate.reason) reason = dataOrDate.reason;
    } else {
      if (dataOrDate) targetDate = String(dataOrDate);
      if (maybeTime) targetTime = String(maybeTime);
    }

    // Safety checks against stringified objects
    if (targetDate.startsWith('{') || targetDate.includes('newDate=')) {
      const match = targetDate.match(/newDate[=:]\s*([^,}\s]+)/);
      if (match) targetDate = match[1];
    }
    if (targetTime.startsWith('{') || targetTime.includes('newTime=')) {
      const match = targetTime.match(/newTime[=:]\s*([^,}\s]+)/);
      if (match) targetTime = match[1];
    }

    const updatedNote = reason
      ? appt.notes
        ? `${appt.notes} (Reprogramado: ${reason})`
        : `Reprogramado: ${reason}`
      : appt.notes || '';

    const updated: Appointment = {
      ...appt,
      date: targetDate,
      fecha: targetDate,
      time: targetTime,
      hora: targetTime,
      doctorId: targetDocId,
      medicoId: targetDocId,
      doctorName: targetDocName,
      medicoNombre: targetDocName,
      specialty: targetSpecialty,
      especialidad: targetSpecialty,
      notes: updatedNote,
      motivoConsulta: updatedNote,
      status: 'CONFIRMED',
      estado: 'CONFIRMED',
      syncState: 'PENDING' as SyncState,
      updatedAtUtc: new Date().toISOString(),
    };

    await dbService.saveAppointment(updated);
    await dbService.addRescheduleMutation(id, {
      newDate: targetDate,
      newTime: targetTime,
      newDoctorId: targetDocId,
      newDoctorName: targetDocName,
      newSpecialty: targetSpecialty,
      reason,
    });
    await refreshLocalData();
  };

  const resolveConflict = async (
    targetOrAppt: string | Appointment,
    actionOrDiscardId: 'ACCEPT_OVERRIDE' | 'RESCHEDULE' | 'CANCEL' | string,
    newDate?: string,
    newTime?: string
  ) => {
    if (typeof targetOrAppt === 'object' && targetOrAppt !== null) {
      const chosenAppointment = targetOrAppt;
      const discardId = actionOrDiscardId;
      await dbService.saveAppointment({ ...chosenAppointment, status: 'CONFIRMED', estado: 'CONFIRMED', syncState: 'PENDING' });
      await dbService.saveAppointment({ ...chosenAppointment, id: discardId, status: 'CANCELLED', estado: 'CANCELLED', syncState: 'PENDING' });
      await dbService.addStatusMutation(chosenAppointment.id, 'CONFIRMED');
      await dbService.addStatusMutation(discardId, 'CANCELLED');
      await refreshLocalData();
      return;
    }

    const appointmentId = typeof targetOrAppt === 'string' ? targetOrAppt : (targetOrAppt as Appointment).id;
    const action = actionOrDiscardId as 'ACCEPT_OVERRIDE' | 'RESCHEDULE' | 'CANCEL';
    const appt = await dbService.getAppointmentById(appointmentId);
    if (!appt) return;

    if (action === 'CANCEL') {
      await updateAppointmentStatus(appointmentId, 'CANCELLED');
    } else if (action === 'ACCEPT_OVERRIDE') {
      await updateAppointmentStatus(appointmentId, 'CONFIRMED');
    } else if (action === 'RESCHEDULE' && newDate) {
      await rescheduleAppointment(appointmentId, {
        newDate: newDate,
        newTime: newTime || appt.time || '12:00',
      });
    }
    await refreshLocalData();
  };

  return {
    isOnline,
    realOnline,
    simulatedOffline,
    toggleSimulatedOffline,
    setSimulatedOffline,
    pendingCount: pendingQueue.length,
    isSyncing,
    lastSyncTime,
    syncLogs,
    forceSync,
    clearLocalDatabase,
    clearLocalData: clearLocalDatabase,
    pendingQueue,
    allQueueHistory,
    appointments,
    deviceId,
    createAppointment,
    updateAppointmentStatus,
    saveClinicalNotes,
    rescheduleAppointment,
    resolveConflict,
  };
};

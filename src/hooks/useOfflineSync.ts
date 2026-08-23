import { useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, MutationItem, UserAccount, Specialty } from '../types';
import { dbService } from '../services/indexedDB';
import { DEFAULT_GAS_URL } from '../config/constants';
import { gasSyncClient } from '../services/gasSyncClient';

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
      // 1. Pull remote updates from Google Sheets using gasSyncClient
      const pullResult = await gasSyncClient.pullAllFromSheets(gasUrl);
      if (pullResult.success) {
        logMessage(
          `📥 Descarga completa: ${pullResult.appointmentsCount} citas, ${pullResult.patientsCount} pacientes y ${pullResult.doctorsCount} médicos.`
        );
      }

      // 2. Check pending mutations to push to cloud
      const pendingMuts = await dbService.getPendingMutations();

      if (pendingMuts.length === 0) {
        await refreshLocalData();
        logMessage('✅ Sincronización completada. Todos los registros coinciden con Google Sheets.');
        setIsSyncing(false);
        setLastSyncTime(new Date().toLocaleTimeString());
        return;
      }

      logMessage(`📤 Enviando ${pendingMuts.length} mutaciones pendientes hacia Google Sheets...`);

      const pushResult = await gasSyncClient.pushMutationsToSheets(pendingMuts, gasUrl);

      if (!pushResult.success) {
        throw new Error(pushResult.error || 'Error al enviar mutaciones a Google Sheets');
      }

      await refreshLocalData();

      logMessage(
        `✅ Sincronización exitosa con Google Sheets: ${pushResult.syncedCount} registros actualizados en la nube.`
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

      if (navigator.onLine && !simulatedOffline) {
        try {
          const gasUrl = localStorage.getItem('cfg_gas_url') || DEFAULT_GAS_URL;
          await gasSyncClient.pullAllFromSheets(gasUrl);
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

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0 && !isSyncing) {
      forceSync();
    }
  }, [isOnline, pendingQueue.length, isSyncing, forceSync]);

  const toggleSimulatedOffline = () => {
    const next = !simulatedOffline;
    setSimulatedOfflineState(next);
    localStorage.setItem('hc_simulated_offline', String(next));
    if (next) {
      logMessage('🔌 MODO OFFLINE SIMULADO ACTIVADO. Operando en IndexedDB local.');
    } else {
      logMessage('⚡ Modo normal restaurado. Reconectando...');
    }
  };

  const setSimulatedOffline = (offline: boolean) => {
    setSimulatedOfflineState(offline);
    localStorage.setItem('hc_simulated_offline', String(offline));
  };

  const clearLocalDatabase = async () => {
    await dbService.clearAll();
    await refreshLocalData();
    logMessage('🗑️ Base de datos local (IndexedDB) restablecida.');
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
  }) => {
    const newAppt: Appointment = {
      id: 'apt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      patientName: data.patientName,
      patientDni: data.patientDni,
      patientEmail: data.patientEmail,
      patientPhone: data.patientPhone,
      specialty: typeof data.specialty === 'string' ? data.specialty : (data.specialty?.nombre || data.specialty?.name || 'Medicina General'),
      doctorId: data.doctorId,
      doctorName: data.doctorName,
      date: data.date,
      time: data.time,
      status: 'PENDING',
      syncState: isOnline ? 'SYNCED' : 'PENDING_SYNC',
      notes: data.notes || '',
      updatedAt: new Date().toISOString(),
      version: 1,
      lastModifiedBy: deviceId,
    };

    await dbService.saveAppointment(newAppt);

    const mutation: MutationItem = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'CREATE',
      appointmentId: newAppt.id,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      appointmentData: newAppt,
      deviceId: deviceId,
      retries: 0,
    };

    await dbService.addMutation(mutation);
    logMessage(`📝 Cita creada localmente para ${data.patientName} (${newAppt.id})`);
    await refreshLocalData();

    if (isOnline) {
      forceSync();
    }
  };

  const updateAppointmentStatus = async (id: string, status: Appointment['status']) => {
    const existing = await dbService.getAppointmentById(id);
    if (!existing) return;

    const updated: Appointment = {
      ...existing,
      status: status,
      syncState: isOnline ? 'SYNCED' : 'PENDING_SYNC',
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
      lastModifiedBy: deviceId,
    };

    await dbService.saveAppointment(updated);

    const mutation: MutationItem = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'UPDATE_STATUS',
      appointmentId: id,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      appointmentData: updated,
      deviceId: deviceId,
      retries: 0,
    };

    await dbService.addMutation(mutation);
    logMessage(`🔄 Estado de cita ${id} cambiado a "${status}"`);
    await refreshLocalData();

    if (isOnline) {
      forceSync();
    }
  };

  const saveClinicalNotes = async (
    id: string,
    notes: { idx?: string; treatment?: string; diseaseNotes?: string }
  ) => {
    const existing = await dbService.getAppointmentById(id);
    if (!existing) return;

    const updated: Appointment = {
      ...existing,
      notes: notes.treatment ? `Tratamiento: ${notes.treatment}` : existing.notes,
      clinicalNotes: notes,
      status: 'ATTENDED',
      syncState: isOnline ? 'SYNCED' : 'PENDING_SYNC',
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
      lastModifiedBy: deviceId,
    };

    await dbService.saveAppointment(updated);

    const mutation: MutationItem = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'SAVE_NOTES',
      appointmentId: id,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      appointmentData: updated,
      deviceId: deviceId,
      retries: 0,
    };

    await dbService.addMutation(mutation);
    logMessage(`🩺 Historia clínica y notas guardadas para cita ${id}`);
    await refreshLocalData();

    if (isOnline) {
      forceSync();
    }
  };

  const rescheduleAppointment = async (id: string, newDate: string, newTime: string) => {
    const existing = await dbService.getAppointmentById(id);
    if (!existing) return;

    const updated: Appointment = {
      ...existing,
      date: newDate,
      time: newTime,
      status: 'RESCHEDULED',
      syncState: isOnline ? 'SYNCED' : 'PENDING_SYNC',
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
      lastModifiedBy: deviceId,
    };

    await dbService.saveAppointment(updated);

    const mutation: MutationItem = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'RESCHEDULE',
      appointmentId: id,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      appointmentData: updated,
      deviceId: deviceId,
      retries: 0,
    };

    await dbService.addMutation(mutation);
    logMessage(`📅 Cita ${id} reprogramada para ${newDate} a las ${newTime}`);
    await refreshLocalData();

    if (isOnline) {
      forceSync();
    }
  };

  const resolveConflict = async (chosenAppointment: Appointment, discardId: string) => {
    const resolved: Appointment = {
      ...chosenAppointment,
      syncState: 'SYNCED',
      updatedAt: new Date().toISOString(),
      version: (chosenAppointment.version || 1) + 1,
    };

    await dbService.saveAppointment(resolved);

    const mutation: MutationItem = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      type: 'RESOLVE_CONFLICT',
      appointmentId: chosenAppointment.id,
      timestamp: new Date().toISOString(),
      status: 'PENDING',
      appointmentData: resolved,
      deviceId: deviceId,
      retries: 0,
    };

    await dbService.addMutation(mutation);
    logMessage(`⚖️ Conflicto resuelto para cita ${chosenAppointment.id}`);
    await refreshLocalData();

    if (isOnline) {
      forceSync();
    }
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

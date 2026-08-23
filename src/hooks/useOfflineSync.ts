import { useState, useEffect, useCallback, useRef } from 'react';
import { Appointment, AppointmentStatus, MutationItem, SyncState, UserAccount, Doctor, Patient, Specialty } from '../types';
import { dbService } from '../services/indexedDB';
import { DEFAULT_GAS_URL } from '../config/constants';
import { gasSyncClient } from '../services/gasSyncClient';

interface OfflineSyncHook {
  isOnline: boolean;
  syncState: SyncState;
  appointments: Appointment[];
  doctors: Doctor[];
  patients: Patient[];
  specialties: Specialty[];
  pendingCount: number;
  lastSyncTime: string | null;
  syncLogs: string[];
  isSyncing: boolean;
  createAppointment: (appointmentData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => Promise<Appointment>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<Appointment>;
  cancelAppointment: (id: string, reason: string) => Promise<void>;
  markAsAttended: (id: string, notes?: string, medicalRecordData?: any) => Promise<void>;
  forceSync: () => Promise<void>;
  toggleSimulatedOffline: () => void;
  isSimulatedOffline: boolean;
}

export function useOfflineSync(): OfflineSyncHook {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  const effectiveIsOnline = isOnline && !simulatedOffline;

  const logMessage = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${msg}`;
    setSyncLogs((prev) => [formatted, ...prev.slice(0, 49)]);
  }, []);

  const refreshLocalData = useCallback(async () => {
    try {
      const [appts, docs, pts, specs, pendingMuts] = await Promise.all([
        dbService.getAllAppointments(),
        dbService.getAllDoctors(),
        dbService.getAllPatients(),
        dbService.getAllSpecialties(),
        dbService.getPendingMutations(),
      ]);

      setAppointments(appts);
      setDoctors(docs);
      setPatients(pts);
      setSpecialties(specs);
      setPendingCount(pendingMuts.length);
    } catch (err) {
      console.error('Error refreshing local data:', err);
    }
  }, []);

  const forceSync = useCallback(async () => {
    if (!effectiveIsOnline || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    const gasUrl = localStorage.getItem('cfg_gas_url') || DEFAULT_GAS_URL;
    logMessage('🔄 Sincronizando datos con SIGMO_BARINAS (Google Sheets)...');

    try {
      const pullResult = await gasSyncClient.pullAllFromSheets(gasUrl);
      if (pullResult.success) {
        logMessage(
          `📥 Descarga completa: ${pullResult.appointmentsCount} citas, ${pullResult.patientsCount} pacientes y ${pullResult.doctorsCount} médicos.`
        );
      }

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
      logMessage(`❌ Error en sincronización: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      await refreshLocalData();
    }
  }, [effectiveIsOnline, logMessage, refreshLocalData]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logMessage('📶 Conexión a Internet restablecida.');
    };

    const handleOffline = () => {
      setIsOnline(false);
      logMessage('⚠️ Sin conexión. Activando modo local IndexedDB offline-first.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleDBMutation = () => {
      refreshLocalData();
    };
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

  useEffect(() => {
    if (effectiveIsOnline && pendingCount > 0 && !isSyncingRef.current) {
      const timer = setTimeout(() => {
        forceSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [effectiveIsOnline, pendingCount, forceSync]);

  const toggleSimulatedOffline = useCallback(() => {
    setSimulatedOffline((prev) => {
      const next = !prev;
      logMessage(
        next
          ? '🔌 Modo Offline Simulado ACTIVADO. Todas las operaciones se guardarán localmente.'
          : '⚡ Modo Offline Simulado DESACTIVADO. Reconectando con servidor y Google Sheets...'
      );
      return next;
    });
  }, [logMessage]);

  const createAppointment = useCallback(
    async (data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<Appointment> => {
      const newAppt: Appointment = {
        ...data,
        id: `insitez-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'PENDING',
      };

      await dbService.saveAppointment(newAppt);

      const mutation: MutationItem = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        action: 'CREATE',
        entityType: 'APPOINTMENT',
        entityId: newAppt.id,
        payload: newAppt,
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
      };

      await dbService.addMutation(mutation);
      logMessage(`📝 Cita #${newAppt.id.slice(-6)} registrada en IndexedDB local.`);

      await refreshLocalData();

      if (effectiveIsOnline) {
        forceSync();
      }

      return newAppt;
    },
    [effectiveIsOnline, forceSync, logMessage, refreshLocalData]
  );

  const updateAppointment = useCallback(
    async (id: string, updates: Partial<Appointment>): Promise<Appointment> => {
      const existing = await dbService.getAppointmentById(id);
      if (!existing) throw new Error('Cita no encontrada en base local');

      const updated: Appointment = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
        syncStatus: 'PENDING',
      };

      await dbService.saveAppointment(updated);

      const mutation: MutationItem = {
        id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        action: 'UPDATE',
        entityType: 'APPOINTMENT',
        entityId: id,
        payload: updated,
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        retryCount: 0,
      };

      await dbService.addMutation(mutation);
      logMessage(`✏️ Cita #${id.slice(-6)} modificada localmente.`);

      await refreshLocalData();

      if (effectiveIsOnline) {
        forceSync();
      }

      return updated;
    },
    [effectiveIsOnline, forceSync, logMessage, refreshLocalData]
  );

  const cancelAppointment = useCallback(
    async (id: string, reason: string): Promise<void> => {
      await updateAppointment(id, {
        status: AppointmentStatus.CANCELLED,
        cancelReason: reason,
      });
      logMessage(`🚫 Cita #${id.slice(-6)} cancelada: "${reason}"`);
    },
    [updateAppointment, logMessage]
  );

  const markAsAttended = useCallback(
    async (id: string, notes?: string, medicalRecordData?: any): Promise<void> => {
      await updateAppointment(id, {
        status: AppointmentStatus.ATTENDED,
        notes: notes || undefined,
        medicalRecord: medicalRecordData || undefined,
      });
      logMessage(`🩺 Paciente atendido en Cita #${id.slice(-6)}.`);
    },
    [updateAppointment, logMessage]
  );

  const syncState: SyncState = effectiveIsOnline
    ? pendingCount > 0
      ? 'SYNCING'
      : 'ONLINE'
    : 'OFFLINE';

  return {
    isOnline: effectiveIsOnline,
    syncState,
    appointments,
    doctors,
    patients,
    specialties,
    pendingCount,
    lastSyncTime,
    syncLogs,
    isSyncing,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    markAsAttended,
    forceSync,
    toggleSimulatedOffline,
    isSimulatedOffline: simulatedOffline,
  };
}

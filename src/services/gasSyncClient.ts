import { dbService } from './indexedDB';
import { DEFAULT_GAS_URL } from '../config/constants';
import { Appointment, Doctor, MutationItem, Patient, UserAccount } from '../types';

export interface SyncPullResult {
  success: boolean;
  appointmentsCount: number;
  patientsCount: number;
  doctorsCount: number;
  usersCount: number;
  error?: string;
  source: 'DIRECT_GAS' | 'PROXY_API' | 'LOCAL_CACHE';
}

export interface SyncPushResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  error?: string;
}

export interface GasTestResult {
  success: boolean;
  message: string;
  details?: {
    citasCount: number;
    pacientesCount: number;
    medicosCount: number;
    usuariosCount: number;
    timestamp: string;
  };
}

export function getActiveGasUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cfg_gas_url');
    if (saved && saved.trim().startsWith('http')) {
      return saved.trim();
    }
  }
  return DEFAULT_GAS_URL;
}

export const gasSyncClient = {
  async pullAllFromSheets(customUrl?: string): Promise<SyncPullResult> {
    const gasUrl = customUrl || getActiveGasUrl();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      return {
        success: false,
        appointmentsCount: 0,
        patientsCount: 0,
        doctorsCount: 0,
        usersCount: 0,
        error: 'URL de Google Apps Script no configurada.',
        source: 'LOCAL_CACHE',
      };
    }

    let payloadData: any = null;
    let sourceUsed: 'DIRECT_GAS' | 'PROXY_API' = 'DIRECT_GAS';

    try {
      const directUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=GET_ALL_DATA&_t=${Date.now()}`;
      const res = await fetch(directUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (res.ok) {
        const json = await res.json();
        if (json && (json.success !== false || json.data || json.allData)) {
          payloadData = json.data || json.allData || json;
          sourceUsed = 'DIRECT_GAS';
        }
      }
    } catch (directErr) {
      console.warn('Direct GAS pull error, checking proxy fallback:', directErr);
    }

    if (!payloadData) {
      try {
        const proxyRes = await fetch(`/api/gas/pull?gasUrl=${encodeURIComponent(gasUrl)}&_t=${Date.now()}`);
        if (proxyRes.ok) {
          const proxyJson = await proxyRes.json();
          if (proxyJson && (proxyJson.data || proxyJson.allData || proxyJson.appointments)) {
            payloadData = proxyJson.data || proxyJson.allData || proxyJson;
            sourceUsed = 'PROXY_API';
          }
        }
      } catch (proxyErr) {
        console.warn('Proxy pull error:', proxyErr);
      }
    }

    if (!payloadData) {
      return {
        success: false,
        appointmentsCount: 0,
        patientsCount: 0,
        doctorsCount: 0,
        usersCount: 0,
        error: 'No se pudo conectar con Google Apps Script. Verifique su conexión a Internet o el despliegue del script.',
        source: 'LOCAL_CACHE',
      };
    }

    let apptsCount = 0;
    let ptsCount = 0;
    let docsCount = 0;
    let usrsCount = 0;

    const pts = payloadData.pacientes || payloadData.patients;
    if (Array.isArray(pts) && pts.length > 0) {
      await dbService.setAllPatients(pts);
      ptsCount = pts.length;
    }

    const docs = payloadData.medicos || payloadData.doctors;
    if (Array.isArray(docs) && docs.length > 0) {
      await dbService.setAllDoctors(docs);
      docsCount = docs.length;
    }

    const specs = payloadData.especialidades || payloadData.specialties;
    if (Array.isArray(specs) && specs.length > 0) {
      for (const sp of specs) {
        const name = typeof sp === 'string' ? sp : (sp.nombre || sp.Nombre_Especialidad || sp.name);
        const desc = typeof sp === 'object' ? (sp.descripcion || sp.description || '') : '';
        if (name) await dbService.saveSpecialty(name, desc);
      }
    }

    const usrs = payloadData.usuarios || payloadData.users;
    if (Array.isArray(usrs) && usrs.length > 0) {
      await dbService.setAllUsers(usrs);
      usrsCount = usrs.length;
    }

    const appts = payloadData.citas || payloadData.appointments;
    if (Array.isArray(appts) && appts.length > 0) {
      await dbService.setAllAppointments(appts);
      apptsCount = appts.length;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('insitez_db_mutation', { detail: { action: 'PULL_COMPLETED' } }));
    }

    return {
      success: true,
      appointmentsCount: apptsCount,
      patientsCount: ptsCount,
      doctorsCount: docsCount,
      usersCount: usrsCount,
      source: sourceUsed,
    };
  },

  async pushMutationsToSheets(mutations: MutationItem[], customUrl?: string): Promise<SyncPushResult> {
    if (!mutations || mutations.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    const gasUrl = customUrl || getActiveGasUrl();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: mutations.length,
        error: 'URL de Google Apps Script no configurada.',
      };
    }

    let syncResponseJson: any = null;
    let pushSuccess = false;

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'SYNC_MUTATIONS',
          mutations: mutations,
        }),
        redirect: 'follow',
      });

      if (res.ok) {
        syncResponseJson = await res.json();
        pushSuccess = true;
      }
    } catch (postErr) {
      console.warn('Direct POST sync failed, attempting GET fallback:', postErr);
    }

    if (!pushSuccess) {
      try {
        const payloadStr = encodeURIComponent(JSON.stringify({ mutations }));
        const getSyncUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=SYNC_MUTATIONS&payload=${payloadStr}&_t=${Date.now()}`;
        const getRes = await fetch(getSyncUrl, {
          method: 'GET',
          redirect: 'follow',
        });

        if (getRes.ok) {
          syncResponseJson = await getRes.json();
          pushSuccess = true;
        }
      } catch (getErr) {
        console.warn('Direct GET sync fallback failed:', getErr);
      }
    }

    if (!pushSuccess) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: mutations.length,
        error: 'No se pudo enviar los datos a Google Sheets. Los cambios permanecen en la cola local.',
      };
    }

    let syncedCount = 0;
    for (const m of mutations) {
      await dbService.updateMutationStatus(m.id, 'SYNCED');
      syncedCount++;
    }

    const remoteData = syncResponseJson?.allData || syncResponseJson?.data;
    if (remoteData) {
      if (Array.isArray(remoteData.citas)) await dbService.setAllAppointments(remoteData.citas);
      if (Array.isArray(remoteData.pacientes)) await dbService.setAllPatients(remoteData.pacientes);
      if (Array.isArray(remoteData.medicos)) await dbService.setAllDoctors(remoteData.medicos);
      if (Array.isArray(remoteData.usuarios)) await dbService.setAllUsers(remoteData.usuarios);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('insitez_db_mutation', { detail: { action: 'PUSH_COMPLETED' } }));
    }

    return { success: true, syncedCount, failedCount: 0 };
  },

  async testConnection(customUrl?: string): Promise<GasTestResult> {
    const gasUrl = customUrl || getActiveGasUrl();
    if (!gasUrl || !gasUrl.startsWith('http')) {
      return {
        success: false,
        message: 'Por favor ingrese una URL válida de Google Apps Script.',
      };
    }

    try {
      const testUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=GET_ALL_DATA&_t=${Date.now()}`;
      const res = await fetch(testUrl, {
        method: 'GET',
        redirect: 'follow',
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Google Apps Script respondió con estado HTTP ${res.status}. Asegúrese de desplegar con acceso "Cualquier usuario".`,
        };
      }

      const data = await res.json();
      const payload = data.data || data.allData || data;

      return {
        success: true,
        message: '¡Conexión exitosa con SIGMO_BARINAS! Hoja de cálculo conectada correctamente.',
        details: {
          citasCount: Array.isArray(payload?.citas) ? payload.citas.length : 0,
          pacientesCount: Array.isArray(payload?.pacientes) ? payload.pacientes.length : 0,
          medicosCount: Array.isArray(payload?.medicos) ? payload.medicos.length : 0,
          usuariosCount: Array.isArray(payload?.usuarios) ? payload.usuarios.length : 0,
          timestamp: new Date().toLocaleTimeString(),
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Error al conectar: ${err?.message || 'Error de red o CORS'}.`,
      };
    }
  },
};

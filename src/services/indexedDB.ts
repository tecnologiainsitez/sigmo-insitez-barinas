import { Appointment, Doctor, MutationItem, MutationAction, MutationPayload, Patient, UserAccount } from '../types';
import { INITIAL_PATIENTS } from '../data/mockPatients';
import { INITIAL_USERS } from '../data/mockUsers';
import { INITIAL_DOCTORS, SPECIALTIES_LIST } from '../data/mockDoctors';

const DB_NAME = 'HealthCenter_OfflineDB_v3';
const DB_VERSION = 4;

function isLaborConditionStr(val: string): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s.startsWith('docente') ||
    s.startsWith('administrativo') ||
    s.startsWith('obrero') ||
    s.startsWith('estudiante') ||
    s.startsWith('comunidad') ||
    s.startsWith('contratado') ||
    s.startsWith('jubilado') ||
    s.startsWith('pensionado') ||
    s.startsWith('fijo')
  );
}

export function parseCorruptedObjectString(str: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!str || typeof str !== 'string') return result;

  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {}

  const clean = str.replace(/^\{/, '').replace(/\}$/, '').trim();
  const pairs = clean.split(/,\s*(?=[a-zA-Z0-9_]+\s*[:=])/);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    const colonIdx = pair.indexOf(':');
    let splitIdx = -1;
    if (eqIdx !== -1 && colonIdx !== -1) {
      splitIdx = Math.min(eqIdx, colonIdx);
    } else if (eqIdx !== -1) {
      splitIdx = eqIdx;
    } else if (colonIdx !== -1) {
      splitIdx = colonIdx;
    }

    if (splitIdx !== -1) {
      const key = pair.slice(0, splitIdx).trim();
      let val = pair.slice(splitIdx + 1).trim();
      val = val.replace(/^["']|["']$/g, '');
      result[key] = val;
    }
  }

  return result;
}

export function sanitizeTimeString(rawTime: any): string {
  if (!rawTime) return '08:00';
  let str = String(rawTime).trim();
  if (str.startsWith('{') || str.includes('newTime=')) {
    const extracted = parseCorruptedObjectString(str);
    if (extracted.newTime) {
      return sanitizeTimeString(extracted.newTime);
    }
  }
  // Check if string contains standard HH:mm or HH:mm:ss or 1899 date string
  // Matches "08:30", "8:30", "Sat Dec 30 1899 08:30:00 GMT-0427 (Venezuela-Zeit)", "10:00:00"
  const match = str.match(/(?:^|\s|[T])(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    return `${hh}:${mm}`;
  }
  return str.length <= 5 && str.includes(':') ? str : '08:00';
}

export function sanitizeDateString(rawDate: any): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  let str = String(rawDate).trim();
  if (str.startsWith('{') || str.includes('newDate=') || str.includes('reason=')) {
    const extracted = parseCorruptedObjectString(str);
    if (extracted.newDate) {
      return sanitizeDateString(extracted.newDate);
    }
  }

  // 1. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...
  const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    if (isoMatch[1].startsWith('1899')) {
      return new Date().toISOString().split('T')[0];
    }
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY
  const latinMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (latinMatch) {
    const d = latinMatch[1].padStart(2, '0');
    const m = latinMatch[2].padStart(2, '0');
    const y = latinMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Date constructor fallback
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Ignore error
  }

  return new Date().toISOString().split('T')[0];
}

export function normalizeAppointmentEntity(raw: any): Appointment {
  if (!raw) return raw;
  const id = String(raw.id || raw.ID_Cita || 'CITA-' + Date.now());
  let date = String(raw.date || raw.fecha || raw.Fecha || '').trim();
  let time = String(raw.time || raw.hora || raw.Hora || '').trim();
  let doctorName = String(raw.doctorName || raw.medicoNombre || raw.medico || raw.Medico || '').trim();
  let doctorId = String(raw.doctorId || raw.medicoId || raw.ID_Medico || '').trim();
  let specialty = String(raw.specialty || raw.especialidad || raw.Especialidad || 'Medicina General').trim();
  let notes = String(raw.notes || raw.motivoConsulta || raw.MotivoConsulta || '').trim();

  // If date contains object string like {reason=..., newDate=...}
  if (date.startsWith('{') || date.includes('newDate=') || date.includes('reason=')) {
    const extracted = parseCorruptedObjectString(date);
    if (extracted.newDate) date = extracted.newDate;
    if (extracted.newTime) time = extracted.newTime;
    if (extracted.newDoctorId) doctorId = extracted.newDoctorId;
    if (extracted.newDoctorName) doctorName = extracted.newDoctorName;
    if (extracted.newSpecialty) specialty = extracted.newSpecialty;
    if (extracted.reason) {
      if (!notes.includes(extracted.reason)) {
        notes = notes ? `${notes} (Reprogramado: ${extracted.reason})` : `Reprogramado: ${extracted.reason}`;
      }
    }
  }

  // If time contains object string
  if (time.startsWith('{') || time.includes('newTime=')) {
    const extracted = parseCorruptedObjectString(time);
    if (extracted.newDate && !date) date = extracted.newDate;
    if (extracted.newTime) time = extracted.newTime;
    if (extracted.newDoctorId && !doctorId) doctorId = extracted.newDoctorId;
    if (extracted.newDoctorName && !doctorName) doctorName = extracted.newDoctorName;
    if (extracted.newSpecialty && !specialty) specialty = extracted.newSpecialty;
    if (extracted.reason) {
      if (!notes.includes(extracted.reason)) {
        notes = notes ? `${notes} (Reprogramado: ${extracted.reason})` : `Reprogramado: ${extracted.reason}`;
      }
    }
  }

  // Sanitize cleaned date and time strings
  date = sanitizeDateString(date);
  time = sanitizeTimeString(time);

  if (!time) time = '08:00';
  if (!doctorId) doctorId = raw.medicoId || raw.ID_Medico || '';
  if (!doctorName) doctorName = raw.medicoNombre || raw.medico || raw.Medico || '';

  const patientName = String(raw.patientName || raw.paciente || raw.Paciente || '').trim();
  const patientDni = String(raw.patientDni || raw.cedula || raw.Cedula || '').trim();
  const patientEmail = String(raw.patientEmail || raw.email || raw.Email || '').trim();
  const patientPhone = String(raw.patientPhone || raw.telefono || raw.Telefono || '').trim();

  return {
    ...raw,
    id,
    ID_Cita: id,
    paciente: patientName,
    patientName,
    cedula: patientDni,
    patientDni,
    email: patientEmail,
    patientEmail,
    telefono: patientPhone,
    patientPhone,
    medicoNombre: doctorName,
    doctorName,
    medicoId: doctorId,
    doctorId,
    especialidad: specialty,
    specialty,
    fecha: date,
    date,
    hora: time,
    time,
    estado: raw.estado || raw.status || raw.Estado || 'CONFIRMED',
    status: raw.status || raw.estado || raw.Estado || 'CONFIRMED',
    idx: raw.idx || raw.dx || raw.diagnostico || raw.IDx || '',
    dx: raw.idx || raw.dx || raw.diagnostico || raw.IDx || '',
    diagnostico: raw.idx || raw.dx || raw.diagnostico || raw.IDx || '',
    treatment: raw.treatment || raw.tratamiento || raw.Tratamiento || '',
    tratamiento: raw.treatment || raw.tratamiento || raw.Tratamiento || '',
    diseaseNotes: raw.diseaseNotes || raw.notasEnfermedad || raw.observacionesMedicas || raw.EvolucionMedica || '',
    notasEnfermedad: raw.diseaseNotes || raw.notasEnfermedad || raw.observacionesMedicas || raw.EvolucionMedica || '',
    observacionesMedicas: raw.diseaseNotes || raw.notasEnfermedad || raw.observacionesMedicas || raw.EvolucionMedica || '',
    motivoConsulta: notes,
    notes,
    creadoPor: raw.creadoPor || raw.CreadoPor || 'Analista',
    fechaRegistroUtc: raw.fechaRegistroUtc || raw.createdAtUtc || raw.Fecha_Registro_UTC || new Date().toISOString(),
    createdAtUtc: raw.createdAtUtc || raw.fechaRegistroUtc || new Date().toISOString(),
  };
}

function normalizePatientEntity(raw: any): Patient {
  if (!raw) return raw;
  const dni = String(raw.dni || raw.cedula || '').trim();
  let name = String(raw.name || raw.nombreApellido || raw.nombreCompleto || raw.nombre || '').trim();
  let exp = String(raw.expedienteNumber || raw.numeroExpediente || '').trim();
  let cond = String(raw.condition || raw.condicion || '').trim();

  // Smart fix for shifted legacy rows
  if (isLaborConditionStr(name) && exp && !exp.toUpperCase().startsWith('EXP-')) {
    if (!cond) cond = name;
    name = exp;
    exp = `EXP-${new Date().getFullYear()}-${dni || '0001'}`;
  }

  return {
    ...raw,
    dni,
    cedula: dni,
    expedienteNumber: exp,
    numeroExpediente: exp,
    name,
    nombreApellido: name,
    nombreCompleto: name,
    birthDate: raw.birthDate || raw.fechaNacimiento || '',
    fechaNacimiento: raw.fechaNacimiento || raw.birthDate || '',
    phone: String(raw.phone || raw.telefono || '').trim(),
    telefono: String(raw.telefono || raw.phone || '').trim(),
    email: String(raw.email || raw.correo || '').trim(),
    correo: String(raw.correo || raw.email || '').trim(),
    address: String(raw.address || raw.direccion || '').trim(),
    direccion: String(raw.direccion || raw.address || '').trim(),
    category: raw.category || raw.categoria || 'Titular',
    categoria: raw.categoria || raw.category || 'Titular',
    condition: cond,
    condicion: cond,
    titularData: raw.titularData || raw.datosTitular,
    datosTitular: raw.datosTitular || raw.titularData,
    guardianData: raw.guardianData || raw.representante,
    representante: raw.representante || raw.guardianData,
    antecedentes: raw.antecedentes || raw.medicalHistory || raw.historiaMedica || '',
    medicalHistory: raw.medicalHistory || raw.antecedentes || raw.historiaMedica || '',
    historiaMedica: raw.historiaMedica || raw.antecedentes || raw.medicalHistory || '',
    createdAtUtc: raw.createdAtUtc || raw.fechaRegistro || new Date().toISOString(),
  };
}

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private deviceId: string;

  constructor() {
    let devId = localStorage.getItem('hc_device_id');
    if (!devId) {
      devId = 'Recepción-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('hc_device_id', devId);
    }
    this.deviceId = devId;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        // Auto-seed default users and doctors if empty
        this.seedDefaultData().catch((e) => console.warn('Data seed note:', e));
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Appointments store
        if (!db.objectStoreNames.contains('appointments')) {
          const apptStore = db.createObjectStore('appointments', { keyPath: 'id' });
          apptStore.createIndex('date', 'date', { unique: false });
          apptStore.createIndex('doctorId', 'doctorId', { unique: false });
          apptStore.createIndex('patientDni', 'patientDni', { unique: false });
          apptStore.createIndex('status', 'status', { unique: false });
          apptStore.createIndex('syncState', 'syncState', { unique: false });
        }

        // Patients store
        if (!db.objectStoreNames.contains('patients')) {
          const patientStore = db.createObjectStore('patients', { keyPath: 'dni' });
          patientStore.createIndex('name', 'name', { unique: false });
        }

        // Doctors store
        if (!db.objectStoreNames.contains('doctors')) {
          const docStore = db.createObjectStore('doctors', { keyPath: 'id' });
          docStore.createIndex('nombre', 'nombre', { unique: false });
          docStore.createIndex('especialidad', 'especialidad', { unique: false });
        }

        // Specialties store
        if (!db.objectStoreNames.contains('specialties')) {
          const specStore = db.createObjectStore('specialties', { keyPath: 'nombre' });
        }

        // Users store (for offline-first authentication & sync with SIGMO_BARINAS)
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: false });
          userStore.createIndex('rol', 'rol', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          queueStore.createIndex('timestampUtc', 'timestampUtc', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
        }

        // System logs store
        if (!db.objectStoreNames.contains('system_logs')) {
          const logStore = db.createObjectStore('system_logs', { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // --- SEEDING ---
  public async seedDefaultData(): Promise<void> {
    try {
      await this.seedDefaultUsers();
      await this.seedDefaultSpecialties();
    } catch (e) {
      console.warn('Could not seed default data:', e);
    }
  }

  // --- USERS METHODS (OFFLINE AUTH & GOOGLE SHEETS SYNC) ---

  public async getAllUsers(): Promise<UserAccount[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('users', 'readonly');
        const store = tx.objectStore('users');
        const request = store.getAll();

        request.onsuccess = () => {
          const users: UserAccount[] = request.result || [];
          if (users.length === 0) {
            resolve(INITIAL_USERS);
          } else {
            resolve(users);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        resolve(INITIAL_USERS);
      }
    });
  }

  public async getUserByEmailOrUsername(cleanInput: string): Promise<UserAccount | undefined> {
    const users = await this.getAllUsers();
    const target = cleanInput.trim().toLowerCase();

    return users.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uName = (u.nombre || '').toLowerCase();
      const isEmailMatch = uEmail === target || uEmail.split('@')[0] === target;
      const isNameMatch = uName === target || uName.includes(target);
      const isAliasMatch =
        (target === 'admin' && (u.rol === 'DESARROLLADOR_ADMIN' || u.email.includes('admin'))) ||
        (target === 'gericksson' && (u.rol === 'DESARROLLADOR_ADMIN' || u.email.includes('gericksson')));

      return isEmailMatch || isNameMatch || isAliasMatch;
    });
  }

  public async saveUser(user: UserAccount): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.put(user);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async setAllUsers(users: UserAccount[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        if (!users || users.length === 0) {
          INITIAL_USERS.forEach((admin) => store.put(admin));
          return resolve();
        }

        let completed = 0;
        users.forEach((u) => {
          const req = store.put(u);
          req.onsuccess = () => {
            completed++;
            if (completed === users.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  }

  public async deleteUser(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async seedDefaultUsers(): Promise<void> {
    try {
      const users = await this.getAllUsers();
      if (!users || users.length === 0 || (users.length === 1 && !users[0].id)) {
        for (const admin of INITIAL_USERS) {
          await this.saveUser(admin);
        }
      }
    } catch (e) {
      console.warn('Could not seed default users:', e);
    }
  }

  // --- DOCTORS & SPECIALTIES METHODS ---

  public async getAllDoctors(): Promise<Doctor[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('doctors', 'readonly');
        const store = tx.objectStore('doctors');
        const request = store.getAll();

        request.onsuccess = () => {
          const docs: Doctor[] = request.result || [];
          resolve(docs);
        };
        request.onerror = () => reject(request.error);
      } catch (e) {
        resolve([]);
      }
    });
  }

  public async saveDoctor(doctor: Doctor): Promise<void> {
    const db = await this.initDB();
    const raw = doctor as any;
    const mppsVal = doctor.mpps || doctor.mppsNumber || raw.MPPS || raw.Mpps || '';
    const impresVal = doctor.impres || doctor.impresNumber || raw.IMPRES || raw.Impres || '';
    const docName = doctor.nombre || doctor.name || raw.Nombre || raw.Nombre_Medico || raw.medico || raw.Medico || 'Médico Asignado';
    const docSpec = doctor.especialidad || doctor.specialty || raw.Especialidad || 'Medicina General';
    const docHorario = doctor.horarioAtencion || doctor.schedule || raw.HorarioAtencion || raw.horario || '08:00 - 14:00';
    const docRoom = doctor.consultorio || doctor.room || raw.Consultorio || 'Consultorio 101';
    const docTel = doctor.telefono || doctor.phone || raw.Telefono || '';
    const docEmail = doctor.email || raw.Email || raw.Correo || '';
    const docEstado = doctor.estado || raw.Estado || (doctor.active === false ? 'INACTIVO' : 'ACTIVO');
    const docId = doctor.id || raw.ID_Medico || raw.id_medico || `DOC-${Date.now().toString().substring(5)}`;

    const docObj: Doctor = {
      ...doctor,
      id: docId,
      nombre: docName,
      name: docName,
      especialidad: docSpec,
      specialty: docSpec,
      horarioAtencion: docHorario,
      schedule: docHorario,
      consultorio: docRoom,
      room: docRoom,
      telefono: docTel,
      phone: docTel,
      email: docEmail,
      mpps: mppsVal,
      impres: impresVal,
      mppsNumber: mppsVal,
      impresNumber: impresVal,
      estado: docEstado,
      active: String(docEstado).toUpperCase() !== 'INACTIVO' && doctor.active !== false,
    };

    // Auto-save specialty if not in list
    if (docObj.especialidad) {
      await this.saveSpecialty(String(docObj.especialidad));
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('doctors', 'readwrite');
      const store = tx.objectStore('doctors');
      const request = store.put(docObj);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async setAllDoctors(doctors: Doctor[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('doctors', 'readwrite');
      const store = tx.objectStore('doctors');
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        if (!doctors || doctors.length === 0) {
          return resolve();
        }

        let completed = 0;
        doctors.forEach((d) => {
          const raw = d as any;
          const mppsVal = d.mpps || d.mppsNumber || raw.MPPS || raw.Mpps || '';
          const impresVal = d.impres || d.impresNumber || raw.IMPRES || raw.Impres || '';
          const docName = d.nombre || d.name || raw.Nombre || raw.Nombre_Medico || raw.medico || raw.Medico || 'Médico Asignado';
          const docSpec = d.especialidad || d.specialty || raw.Especialidad || 'Medicina General';
          const docHorario = d.horarioAtencion || d.schedule || raw.HorarioAtencion || raw.horario || '08:00 - 14:00';
          const docRoom = d.consultorio || d.room || raw.Consultorio || 'Consultorio 101';
          const docTel = d.telefono || d.phone || raw.Telefono || '';
          const docEmail = d.email || raw.Email || raw.Correo || '';
          const docEstado = d.estado || raw.Estado || (d.active === false ? 'INACTIVO' : 'ACTIVO');
          const docId = d.id || raw.ID_Medico || raw.id_medico || `DOC-${Date.now().toString().substring(5)}`;

          const docObj: Doctor = {
            ...d,
            id: docId,
            nombre: docName,
            name: docName,
            especialidad: docSpec,
            specialty: docSpec,
            horarioAtencion: docHorario,
            schedule: docHorario,
            consultorio: docRoom,
            room: docRoom,
            telefono: docTel,
            phone: docTel,
            email: docEmail,
            mpps: mppsVal,
            impres: impresVal,
            mppsNumber: mppsVal,
            impresNumber: impresVal,
            estado: docEstado,
            active: String(docEstado).toUpperCase() !== 'INACTIVO' && d.active !== false,
          };
          const req = store.put(docObj);
          req.onsuccess = () => {
            completed++;
            if (completed === doctors.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  }

  public async deleteDoctor(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('doctors', 'readwrite');
      const store = tx.objectStore('doctors');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async seedDefaultDoctors(): Promise<void> {
    // Doctors are maintained dynamically via Google Sheets sync or reception registrations.
    return Promise.resolve();
  }

  // --- SPECIALTIES METHODS (Dual mode: Select existing or Add manual custom) ---

  public async getAllSpecialties(): Promise<string[]> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('specialties', 'readonly');
        const store = tx.objectStore('specialties');
        const request = store.getAll();

        request.onsuccess = () => {
          const results: { nombre: string }[] = request.result || [];
          const specSet = new Set<string>(SPECIALTIES_LIST);
          results.forEach((r) => {
            if (r.nombre && r.nombre.trim()) specSet.add(r.nombre.trim());
          });
          resolve(Array.from(specSet));
        };
        request.onerror = () => resolve(SPECIALTIES_LIST);
      } catch (e) {
        resolve(SPECIALTIES_LIST);
      }
    });
  }

  public async saveSpecialty(nombre: string, descripcion = ''): Promise<void> {
    if (!nombre || !nombre.trim()) return;
    const cleanName = nombre.trim();
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction('specialties', 'readwrite');
        const store = tx.objectStore('specialties');
        const req = store.put({ nombre: cleanName, descripcion });
        req.onsuccess = () => resolve();
        req.onerror = () => resolve(); // Ignore duplicate
      } catch (e) {
        resolve();
      }
    });
  }

  public async seedDefaultSpecialties(): Promise<void> {
    try {
      for (const spec of SPECIALTIES_LIST) {
        await this.saveSpecialty(spec);
      }
    } catch (e) {
      console.warn('Could not seed default specialties:', e);
    }
  }

  // --- PATIENTS METHODS ---

  public async getPatientByDni(dni: string): Promise<Patient | undefined> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('patients', 'readonly');
      const store = tx.objectStore('patients');
      const request = store.get(dni.trim());

      request.onsuccess = () => {
        const res = request.result;
        resolve(res ? normalizePatientEntity(res) : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async savePatient(patient: Patient): Promise<void> {
    const db = await this.initDB();
    const normalizedPatient = normalizePatientEntity(patient);

    return new Promise((resolve, reject) => {
      const tx = db.transaction('patients', 'readwrite');
      const store = tx.objectStore('patients');
      const request = store.put(normalizedPatient);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllPatients(): Promise<Patient[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('patients', 'readonly');
      const store = tx.objectStore('patients');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result || []).map(normalizePatientEntity);
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async setAllPatients(patients: Patient[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('patients', 'readwrite');
      const store = tx.objectStore('patients');
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        if (!patients || patients.length === 0) return resolve();
        let completed = 0;
        patients.forEach((p) => {
          const normalized = normalizePatientEntity(p);
          const req = store.put(normalized);
          req.onsuccess = () => {
            completed++;
            if (completed === patients.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  }

  public async deletePatient(dni: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('patients', 'readwrite');
      const store = tx.objectStore('patients');
      const request = store.delete(dni.trim());

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- APPOINTMENTS METHODS ---

  public async getAllAppointments(): Promise<Appointment[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readonly');
      const store = tx.objectStore('appointments');
      const request = store.getAll();

      request.onsuccess = () => {
        const rawList = request.result || [];
        resolve(rawList.map(normalizeAppointmentEntity));
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async saveAppointment(appointment: Appointment): Promise<void> {
    const db = await this.initDB();
    const normalized = normalizeAppointmentEntity(appointment);

    if (normalized.patientDni || normalized.cedula) {
      const dni = normalized.patientDni || normalized.cedula;
      const existing = await this.getPatientByDni(dni);
      if (!existing) {
        await this.savePatient({
          name: normalized.patientName || normalized.paciente,
          dni: dni,
          email: normalized.patientEmail || normalized.email,
          phone: normalized.patientPhone || normalized.telefono,
          category: 'Titular',
          condition: 'Docente Activo',
          createdAtUtc: new Date().toISOString(),
        }).catch((e) => console.warn('Could not auto-save patient record:', e));
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      const request = store.put(normalized);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async saveMultipleAppointments(appointments: Appointment[]): Promise<void> {
    const db = await this.initDB();
    
    for (const raw of appointments) {
      const appt = normalizeAppointmentEntity(raw);
      const dni = appt.patientDni || appt.cedula;
      if (dni) {
        const existing = await this.getPatientByDni(dni);
        if (!existing) {
          await this.savePatient({
            name: appt.patientName || appt.paciente,
            dni: dni,
            email: appt.patientEmail || appt.email,
            phone: appt.patientPhone || appt.telefono,
            category: 'Titular',
            condition: 'Docente Activo',
            createdAtUtc: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      
      let count = 0;
      appointments.forEach((raw) => {
        const appt = normalizeAppointmentEntity(raw);
        store.put(appt);
        count++;
        if (count === appointments.length) {
          resolve();
        }
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  public async setAllAppointments(appointments: Appointment[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (appointments.length === 0) {
          return resolve();
        }
        let completed = 0;
        appointments.forEach((raw) => {
          const appt = normalizeAppointmentEntity(raw);
          const req = store.put(appt);
          req.onsuccess = () => {
            completed++;
            if (completed === appointments.length) resolve();
          };
          req.onerror = () => reject(req.error);
        });
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  }

  public async seedInitialDataIfEmpty(seedList: Appointment[]): Promise<void> {
    const appts = await this.getAllAppointments();
    if (appts.length === 0 && seedList.length > 0) {
      await this.saveMultipleAppointments(seedList);
    }
  }

  public async deleteAppointment(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readwrite');
      const store = tx.objectStore('appointments');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getAppointmentById(id: string): Promise<Appointment | undefined> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('appointments', 'readonly');
      const store = tx.objectStore('appointments');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result ? normalizeAppointmentEntity(request.result) : undefined);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- MUTATION QUEUE METHODS ---

  public async addMutation(
    action: MutationAction,
    payload: MutationPayload,
    tabla: 'Citas' | 'Medicos' | 'Especialidades' | 'Usuarios' | 'Pacientes' = 'Citas'
  ): Promise<MutationItem> {
    const db = await this.initDB();
    const nowIso = new Date().toISOString();
    const mutation: MutationItem = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      tabla: tabla as any,
      action,
      payload,
      timestampUtc: nowIso,
      timestamp_utc: nowIso,
      status: 'PENDING',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const request = store.add(mutation);

      request.onsuccess = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('insitez_db_mutation', { detail: mutation }));
        }
        resolve(mutation);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async addUserMutation(action: MutationAction, user: UserAccount): Promise<MutationItem> {
    return this.addMutation(action, user, 'Usuarios');
  }

  public async addDoctorMutation(action: MutationAction, doctor: Doctor): Promise<MutationItem> {
    return this.addMutation(action, doctor, 'Medicos');
  }

  public async addPatientMutation(action: MutationAction, patient: Patient): Promise<MutationItem> {
    return this.addMutation(action, patient, 'Pacientes');
  }

  public async addAppointmentMutation(action: MutationAction, appointment: Appointment): Promise<MutationItem> {
    return this.addMutation(action, { appointment: normalizeAppointmentEntity(appointment) }, 'Citas');
  }

  public async addStatusMutation(appointmentId: string, status: any): Promise<MutationItem> {
    return this.addMutation('UPDATE_STATUS', { appointmentId, newStatus: status }, 'Citas');
  }

  public async addClinicalNotesMutation(
    appointmentId: string,
    clinicalNotes: { idx?: string; treatment?: string; diseaseNotes?: string; newStatus?: string }
  ): Promise<MutationItem> {
    return this.addMutation('UPDATE', { appointmentId, clinicalNotes }, 'Citas');
  }

  public async addRescheduleMutation(
    appointmentId: string,
    rescheduleDataOrDate:
      | {
          newDate: string;
          newTime: string;
          newDoctorId?: string;
          newDoctorName?: string;
          newSpecialty?: string;
          reason?: string;
        }
      | string,
    maybeTime?: string
  ): Promise<MutationItem> {
    let payload: any;
    if (typeof rescheduleDataOrDate === 'object' && rescheduleDataOrDate !== null) {
      payload = {
        appointmentId,
        newDate: rescheduleDataOrDate.newDate,
        newTime: rescheduleDataOrDate.newTime,
        newDoctorId: rescheduleDataOrDate.newDoctorId,
        newDoctorName: rescheduleDataOrDate.newDoctorName,
        newSpecialty: rescheduleDataOrDate.newSpecialty,
        reason: rescheduleDataOrDate.reason,
      };
    } else {
      payload = {
        appointmentId,
        newDate: rescheduleDataOrDate,
        newTime: maybeTime,
      };
    }
    return this.addMutation('RESCHEDULE', payload, 'Citas');
  }

  public async getPendingMutations(): Promise<MutationItem[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const all: MutationItem[] = request.result || [];
        const pending = all
          .filter((m) => m.status === 'PENDING' || m.status === 'FAILED')
          .sort((a, b) => {
            const tA = new Date(a.timestampUtc || a.timestamp_utc || 0).getTime() || 0;
            const tB = new Date(b.timestampUtc || b.timestamp_utc || 0).getTime() || 0;
            return tA - tB;
          });
        resolve(pending);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllMutations(): Promise<MutationItem[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const all: MutationItem[] = request.result || [];
        all.sort((a, b) => {
          const tA = new Date(a.timestampUtc || a.timestamp_utc || 0).getTime() || 0;
          const tB = new Date(b.timestampUtc || b.timestamp_utc || 0).getTime() || 0;
          return tB - tA;
        });
        resolve(all);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async updateMutationStatus(
    id: string,
    status: 'SYNCED' | 'FAILED' | 'CONFLICT',
    errorMsg?: string
  ): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const mut: MutationItem = getReq.result;
        if (mut) {
          mut.status = status;
          if (errorMsg) mut.errorMessage = errorMsg;
          if (status === 'FAILED') mut.retryCount = (mut.retryCount || 0) + 1;
          const putReq = store.put(mut);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  public async clearSyncedMutations(): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: MutationItem[] = req.result || [];
        all.forEach((m) => {
          if (m.status === 'SYNCED') {
            store.delete(m.id);
          }
        });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async clearAllLocalData(): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['appointments', 'sync_queue', 'patients', 'doctors', 'specialties'], 'readwrite');
      tx.objectStore('appointments').clear();
      tx.objectStore('sync_queue').clear();
      tx.objectStore('patients').clear();
      tx.objectStore('doctors').clear();
      tx.objectStore('specialties').clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const dbService = new IndexedDBService();

export type UserRole = 'ANALISTA' | 'JEFE' | 'MEDICO' | 'DESARROLLADOR_ADMIN';

export type UserStatus = 'ACTIVO' | 'INACTIVO';

export interface UserAccount {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  rol: UserRole;
  estado: UserStatus;
  ultimoAcceso?: string;
  medicoId?: string; // If role is MEDICO, linked doctor profile ID
}

export type Specialty =
  | 'Medicina General'
  | 'Pediatría'
  | 'Cardiología'
  | 'Ginecología'
  | 'Traumatología'
  | 'Dermatología'
  | 'Oftalmología'
  | 'Odontología'
  | 'Neurología'
  | 'Psicología'
  | 'Nutrición y Dietética'
  | (string & {});

export interface SpecialtyItem {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface Doctor {
  id: string;
  nombre: string;
  name?: string;
  especialidad: Specialty | string;
  specialty?: Specialty | string;
  horarioAtencion: string;
  schedule?: string;
  consultorio: string;
  room?: string;
  telefono: string;
  phone?: string;
  email: string;
  mpps?: string; // Número de Registro MPPS
  impres?: string; // Número IMPRES / Colegio de Médicos
  mppsNumber?: string;
  impresNumber?: string;
  estado: 'ACTIVO' | 'INACTIVO';
  active?: boolean;
}

export type AppointmentStatus =
  | 'CONFIRMED'
  | 'IN_WAITING_ROOM'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'CONFLICT_PENDING';

export type SyncState = 'SYNCED' | 'PENDING_SYNC' | 'PENDING' | 'CONFLICT' | 'CONFLICT_ERROR' | 'FAILED';

export type PatientCategory = 'Titular' | 'Beneficiario' | 'Estudiante' | 'Comunidad';

export type PatientCondition =
  | 'Administrativo Activo'
  | 'Administrativo Contratado'
  | 'Administrativo Pensionado'
  | 'Administrativo Jubilado'
  | 'Docente Activo'
  | 'Docente Contratado'
  | 'Docente Pensionado'
  | 'Docente Jubilado'
  | 'Obrero Activo'
  | 'Obrero Contratado'
  | 'Obrero Pensionado'
  | 'Obrero Jubilado';

export type Kinship = 'Hijo/a' | 'Cónyuge/Pareja' | 'Padre/Madre' | 'Hermano/a' | 'Tutor Legal' | 'Abuelo/a' | 'Tío/a' | 'Otro';

export interface TitularData {
  cedula: string;
  nombreCompleto: string;
  condicion: PatientCondition | string;
  parentesco: Kinship | string;
}

export interface GuardianData {
  cedula: string;
  nombreCompleto: string;
  telefono: string;
  parentesco: Kinship | string;
}

export interface Patient {
  id?: string;
  dni: string; // Cédula
  cedula?: string;
  expedienteNumber?: string; // Número de Historia Médica o Expediente
  numeroExpediente?: string;
  name: string; // Nombre y apellido
  nombre?: string;
  nombreApellido?: string;
  nombreCompleto?: string;
  birthDate?: string; // Fecha de nacimiento
  fechaNacimiento?: string;
  phone: string; // Teléfono
  telefono?: string;
  email: string; // Correo electrónico
  correo?: string;
  address?: string; // Dirección
  direccion?: string;
  category?: PatientCategory;
  categoria?: PatientCategory;
  condition?: PatientCondition | string;
  condicion?: PatientCondition | string;
  titularData?: TitularData;
  datosTitular?: TitularData;
  guardianData?: GuardianData; // Representante en caso de Comunidad menor de 18 años
  representante?: GuardianData;
  medicalHistory?: string;
  historiaMedica?: string;
  antecedentes?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
}

export interface Appointment {
  id: string;
  paciente: string;
  patientName: string;
  cedula: string;
  patientDni: string;
  expedienteNumber?: string;
  numeroExpediente?: string;
  email: string;
  patientEmail: string;
  telefono: string;
  patientPhone: string;
  historiaMedica?: string;
  patientMedicalHistory?: string;
  medicoId: string;
  doctorId: string;
  medicoNombre: string;
  doctorName: string;
  especialidad: Specialty | string;
  specialty: Specialty | string;
  fecha: string;
  date: string;
  hora: string;
  time: string;
  estado: AppointmentStatus;
  status: AppointmentStatus;
  motivoConsulta?: string;
  notes?: string;
  creadoPor?: string;
  fechaRegistroUtc: string;
  createdAtUtc: string;
  updatedAtUtc?: string;
  syncState: SyncState;
  originDevice?: string;
  observacionesMedicas?: string;
  idx?: string; // Impresión Diagnóstica / Diagnóstico
  dx?: string;
  diagnostico?: string;
  treatment?: string; // Tratamiento / Plan Terapéutico
  tratamiento?: string;
  diseaseNotes?: string; // Notas respecto a la enfermedad y evolución
  notasEnfermedad?: string;
  conflictDetails?: any;
  durationMinutes?: number;
}

export type MutationAction =
  | 'CREATE'
  | 'UPDATE'
  | 'UPDATE_STATUS'
  | 'CANCEL'
  | 'RESCHEDULE'
  | 'DELETE_USER'
  | 'SAVE_USER'
  | 'SAVE_DOCTOR'
  | 'DELETE_DOCTOR'
  | 'SAVE_SPECIALTY'
  | 'SAVE_PATIENT';

export interface MutationItem {
  id: string;
  tabla: 'Citas' | 'Medicos' | 'Especialidades' | 'Usuarios' | 'Pacientes';
  action: MutationAction;
  timestampUtc: string;
  timestamp_utc?: string;
  payload: any;
  status: 'PENDING' | 'SYNCED' | 'FAILED' | 'CONFLICT';
  retryCount: number;
  errorMessage?: string;
  lastError?: string;
  originDevice?: string;
}

export interface MutationPayload {
  id?: string;
  [key: string]: any;
}

export interface SyncResponse {
  success: boolean;
  syncedCount?: number;
  processedMutations?: Array<{
    mutationId: string;
    status: 'SYNCED' | 'CONFLICT' | 'FAILED';
    appointment?: Appointment;
    error?: string;
  }>;
  serverAppointments?: Appointment[];
  notificationsGenerated?: number;
  errors?: string[];
  conflicts?: any[];
  gasSyncSuccess?: boolean;
  gasError?: string;
}

export interface NotificationLog {
  id: string;
  appointmentId: string;
  recipient: string;
  recipientEmail?: string;
  type: 'EMAIL_ICS' | 'GOOGLE_CHAT_CARD' | 'GOOGLE_CHAT_WEBHOOK';
  subjectOrTitle: string;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  payload: string;
  timestamp: string;
  details: string;
}

export interface AppConfig {
  appsScriptUrl: string;
  googleChatWebhook: string;
  googleSheetId: string;
  offlineSimulation: boolean;
  centroSaludNombre: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  module: string;
  message: string;
  details?: any;
}

export interface StatsSummary {
  totalCitas: number;
  atendidas: number;
  canceladas: number;
  enEspera: number;
  confirmadas: number;
  ausentismoTasa: number;
  cargasPorMedico: { medico: string; total: number; atendidas: number }[];
  cargasPorEspecialidad: { especialidad: string; total: number }[];
}

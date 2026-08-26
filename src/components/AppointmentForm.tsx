import React, { useState, useEffect, useMemo } from 'react';
import { Specialty, Patient, Appointment, Doctor } from '../types';
import { INITIAL_DOCTORS, SPECIALTIES_LIST } from '../data/mockDoctors';
import { dbService } from '../services/indexedDB';
import { generateDoctorTimeSlots, isTimeWithinDoctorSchedule } from '../utils/scheduleUtils';
import {
  Calendar,
  Clock,
  User,
  FileText,
  Phone,
  Mail,
  IdCard,
  Stethoscope,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserPlus,
  Tag,
  ShieldCheck,
  Lock,
  CalendarCheck,
  Building,
} from 'lucide-react';

function isLaborCondition(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return (
    lower.startsWith('docente') ||
    lower.startsWith('administrativo') ||
    lower.startsWith('obrero') ||
    lower.startsWith('estudiante') ||
    lower.startsWith('comunidad') ||
    lower.startsWith('contratado') ||
    lower.startsWith('jubilado') ||
    lower.startsWith('pensionado') ||
    lower.startsWith('fijo')
  );
}

function sanitizePatientData(raw: any): Patient {
  if (!raw) return raw;
  let name = (raw.name || raw.nombreCompleto || raw.nombreApellido || raw.nombre || '').trim();
  let expediente = (raw.expedienteNumber || raw.numeroExpediente || '').trim();
  let condition = (raw.condition || raw.condicion || '').trim();

  // Smart fix for shifted legacy rows where condition was stored in name and name in expediente
  if (isLaborCondition(name) && expediente && !expediente.toUpperCase().startsWith('EXP-')) {
    if (!condition) condition = name;
    name = expediente;
    expediente = `EXP-${new Date().getFullYear()}-${raw.dni || raw.cedula || '0001'}`;
  }

  return {
    ...raw,
    dni: (raw.dni || raw.cedula || '').trim(),
    cedula: (raw.cedula || raw.dni || '').trim(),
    name,
    nombreApellido: name,
    nombreCompleto: name,
    expedienteNumber: expediente,
    numeroExpediente: expediente,
    condition,
    condicion: condition,
  };
}

interface AppointmentFormProps {
  onSubmit: (data: {
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
  }) => Promise<void>;
  isOnline: boolean;
  onNavigateToPatientRegister?: () => void;
  existingAppointments?: Appointment[];
}

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  onSubmit,
  isOnline,
  onNavigateToPatientRegister,
  existingAppointments = [],
}) => {
  const today = new Date().toISOString().split('T')[0];

  // Primary Entry Field: Cédula de Identidad
  const [patientDni, setPatientDni] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');

  // Search status & patient details
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Dynamic Doctors & Specialties loaded from IndexedDB
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [allSpecialties, setAllSpecialties] = useState<string[]>(SPECIALTIES_LIST);

  // Appointment details
  const [specialty, setSpecialty] = useState<string>('Medicina General');
  const [doctorId, setDoctorId] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [time, setTime] = useState<string>('08:00');
  const [notes, setNotes] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load active doctors and specialties from IndexedDB
  const loadDoctorsAndSpecialties = async () => {
    try {
      let docs = await dbService.getAllDoctors();
      if (docs.length === 0 && navigator.onLine) {
        try {
          const res = await fetch('/api/doctors?fresh=true');
          if (res.ok) {
            const serverDocs: Doctor[] = await res.json();
            if (Array.isArray(serverDocs) && serverDocs.length > 0) {
              await dbService.setAllDoctors(serverDocs);
              docs = serverDocs;
            }
          }
        } catch (netErr) {
          console.warn('Could not pull doctors from server:', netErr);
        }
      }

      if (docs && docs.length > 0) {
        setAllDoctors(docs);
        // Select first active doctor if none selected
        const activeDocs = docs.filter((d) => d.active !== false && String(d.estado || (d as any).Estado || '').toUpperCase() !== 'INACTIVO');
        if (activeDocs.length > 0) {
          const matchingSpec = activeDocs.find((d) => {
            const s = (d.especialidad || d.specialty || (d as any).Especialidad || '').toLowerCase().trim();
            return s === specialty.toLowerCase().trim();
          });
          const chosen = matchingSpec || activeDocs[0];
          setDoctorId((prev) => (prev && activeDocs.some((d) => d.id === prev) ? prev : chosen.id));
          const docSpec = chosen.especialidad || chosen.specialty || (chosen as any).Especialidad;
          if (docSpec && !matchingSpec) {
            setSpecialty(docSpec);
          }
        }
      } else {
        setAllDoctors([]);
        setDoctorId('');
      }

      const specs = await dbService.getAllSpecialties();
      if (specs && specs.length > 0) {
        setAllSpecialties(specs);
      }
    } catch (e) {
      console.warn('Error loading dynamic doctors in form:', e);
    }
  };

  useEffect(() => {
    loadDoctorsAndSpecialties();
    const handleDBChange = () => loadDoctorsAndSpecialties();
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, []);

  // Filter doctors that belong to the selected specialty
  const specialtyDoctors = useMemo(() => {
    const normSpec = specialty.trim().toLowerCase();
    const activeDocs = allDoctors.filter((d) => {
      const isAct = d.active !== false && String(d.estado || (d as any).Estado || '').toUpperCase() !== 'INACTIVO';
      return isAct;
    });

    const matching = activeDocs.filter((d) => {
      const docSpec = (d.especialidad || d.specialty || (d as any).Especialidad || '').trim().toLowerCase();
      return docSpec === normSpec || docSpec.includes(normSpec) || normSpec.includes(docSpec);
    });

    return matching;
  }, [allDoctors, specialty]);

  // Selected Doctor object
  const selectedDoc = useMemo(() => {
    return allDoctors.find((d) => d.id === doctorId) || specialtyDoctors[0] || null;
  }, [allDoctors, specialtyDoctors, doctorId]);

  // Handle specialty selection -> Auto-link to first matching specialist
  const handleSpecialtyChange = (newSpec: string) => {
    setSpecialty(newSpec);
    const normSpec = newSpec.trim().toLowerCase();
    const matching = allDoctors.filter((d) => {
      const docSpec = (d.especialidad || d.specialty || (d as any).Especialidad || '').trim().toLowerCase();
      const isActive = d.active !== false && String(d.estado || (d as any).Estado || '').toUpperCase() !== 'INACTIVO';
      return (docSpec === normSpec || docSpec.includes(normSpec) || normSpec.includes(docSpec)) && isActive;
    });
    if (matching.length > 0) {
      setDoctorId(matching[0].id);
    } else {
      setDoctorId('');
    }
  };

  // Handle doctor selection -> Auto-link to specialist's specialty
  const handleDoctorChange = (newDocId: string) => {
    setDoctorId(newDocId);
    const doc = allDoctors.find((d) => d.id === newDocId);
    if (doc) {
      const docSpec = doc.especialidad || doc.specialty || (doc as any).Especialidad;
      if (docSpec && docSpec.trim().toLowerCase() !== specialty.trim().toLowerCase()) {
        setSpecialty(docSpec);
      }
    }
  };

  // Doctor Schedule String (e.g. "08:00 - 14:00")
  const doctorSchedule = selectedDoc?.schedule || selectedDoc?.horarioAtencion || (selectedDoc as any)?.HorarioAtencion || '08:00 - 14:00';

  // Allowed 30-min time slots strictly computed from the doctor's working schedule
  const doctorTimeSlots = useMemo(() => {
    return generateDoctorTimeSlots(doctorSchedule, 30);
  }, [doctorSchedule]);

  // Ensure doctorId matches available specialty doctors on initial load/change
  useEffect(() => {
    if (specialtyDoctors.length > 0) {
      const hasCurrent = specialtyDoctors.some((d) => d.id === doctorId);
      if (!hasCurrent) {
        setDoctorId(specialtyDoctors[0].id);
      }
    } else {
      setDoctorId('');
    }
  }, [specialty, specialtyDoctors, doctorId]);

  // Ensure selected time is strictly within the current doctor's schedule
  useEffect(() => {
    if (doctorTimeSlots.length > 0 && !doctorTimeSlots.includes(time)) {
      setTime(doctorTimeSlots[0]);
    }
  }, [doctorTimeSlots, time]);

  // Detect booked times for this doctor on the selected date
  const bookedTimesOnDate = useMemo(() => {
    const booked = new Set<string>();
    existingAppointments.forEach((a) => {
      const aDocId = a.doctorId || a.medicoId;
      const aDate = a.date || a.fecha;
      const aTime = a.time || a.hora;
      const aStatus = a.status || a.estado;
      if (aDocId === doctorId && aDate === date && aStatus !== 'CANCELLED' && aTime) {
        booked.add(aTime);
      }
    });
    return booked;
  }, [existingAppointments, doctorId, date]);

  // Handle live lookup when typing/editing Cédula with smart sanitize
  useEffect(() => {
    const cleanDni = patientDni.trim();
    if (!cleanDni || cleanDni.length < 4) {
      setFoundPatient(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rawFound = await dbService.getPatientByDni(cleanDni);
        if (rawFound) {
          const found = sanitizePatientData(rawFound);
          setFoundPatient(found);
          setPatientName(found.name || found.nombreApellido || found.nombreCompleto || '');
          setPatientEmail(found.email || found.correo || '');
          setPatientPhone(found.phone || found.telefono || '');
        } else {
          setFoundPatient(null);
        }
      } catch (err) {
        console.warn('Error querying patient by DNI:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientDni]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!patientDni.trim() || !patientName.trim() || !doctorId) {
      setErrorMsg('Por favor complete los campos obligatorios del paciente y especialista.');
      return;
    }

    // STRICT VALIDATION: Check if time is within doctor schedule
    if (!isTimeWithinDoctorSchedule(time, doctorSchedule, 30)) {
      setErrorMsg(
        `⛔ Horario no permitido: La hora ${time} hrs está fuera del horario de atención establecido para ${selectedDoc?.name || selectedDoc?.nombre || 'el médico'} (${doctorSchedule}).`
      );
      return;
    }

    // CHECK FOR APPOINTMENT CONFLICT ON SAME SLOT
    if (bookedTimesOnDate.has(time)) {
      setErrorMsg(
        `⚠️ El especialista ${selectedDoc?.name || selectedDoc?.nombre} ya tiene una cita agendada a las ${time} hrs para la fecha ${date}. Por favor elija otro turno disponible.`
      );
      return;
    }

    const doctorName = selectedDoc ? selectedDoc.name || selectedDoc.nombre : 'Dr. Asignado';

    let loggedInUser = 'Analista INSITEZ';
    try {
      const session = localStorage.getItem('hc_active_session') || sessionStorage.getItem('hc_active_session');
      if (session) {
        const u = JSON.parse(session);
        loggedInUser = u.nombre || u.nombreCompleto || u.fullName || u.email || u.username || 'Analista';
      }
    } catch (e) {}

    await onSubmit({
      patientName: patientName.trim(),
      patientDni: patientDni.trim(),
      patientEmail: patientEmail.trim() || `${patientDni.trim()}@paciente.com`,
      patientPhone: patientPhone.trim() || '+58 412 000 0000',
      specialty: specialty as Specialty,
      doctorId,
      doctorName,
      date,
      time,
      notes: notes.trim(),
      creadoPor: loggedInUser,
    });

    setSuccessMsg(
      `¡Cita agendada con éxito para ${patientName}! (Cédula: ${patientDni}) - ${specialty} con ${doctorName} a las ${time} hrs.`
    );

    // Reset form fields
    setPatientDni('');
    setPatientName('');
    setPatientEmail('');
    setPatientPhone('');
    setNotes('');
    setFoundPatient(null);

    setTimeout(() => setSuccessMsg(null), 6000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="appointment-form-container">
      {/* Header Banner */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1a56db]" />
            Agendar Nueva Cita Médica
          </h2>
          <p className="text-xs text-slate-500">
            Búsqueda por Cédula de Identidad con autocompletado de afiliado y persistencia Offline-First
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 animate-fadeIn shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION 1: CÉDULA DE IDENTIDAD (PRIMARY ENTRY POINT) */}
        <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900 uppercase tracking-wide">
              <IdCard className="w-4 h-4 text-teal-600" />
              1. Entrada Primaria: Cédula de Identidad del Paciente
            </div>

            {foundPatient ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Afiliado en Padrón: {foundPatient.category || 'Titular'}
                  {foundPatient.condition && ` (${foundPatient.condition})`}
                </span>
                {(foundPatient.expedienteNumber || foundPatient.numeroExpediente) && (
                  <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-900 border border-teal-300 px-2 py-0.5 rounded-full">
                    HC: {foundPatient.expedienteNumber || foundPatient.numeroExpediente}
                  </span>
                )}
              </div>
            ) : patientDni.trim().length >= 4 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" /> Paciente no registrado en Padrón
                </span>
                {onNavigateToPatientRegister && (
                  <button
                    type="button"
                    onClick={onNavigateToPatientRegister}
                    className="text-[11px] bg-teal-600 hover:bg-teal-700 text-white font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition shadow-xs"
                  >
                    <UserPlus className="w-3 h-3" /> Registrar en Padrón
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-teal-950 mb-1" htmlFor="input-cedula">
                Cédula del Paciente *
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-teal-600 absolute left-3 top-2.5" />
                <input
                  id="input-cedula"
                  type="text"
                  required
                  value={patientDni}
                  onChange={(e) => setPatientDni(e.target.value)}
                  placeholder="Ej. 12345678"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-teal-300 rounded-lg focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 bg-white placeholder:font-normal"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-nombre">
                Nombre Completo del Paciente *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="input-nombre"
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nombre y Apellidos"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-email">
                Correo Electrónico (Notificaciones Google Workspace)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="input-email"
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="paciente@correo.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-phone">
                Teléfono de Contacto
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="input-phone"
                  type="text"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+58 412 123 4567"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: APPOINTMENT DETAILS (SPECIALTY, DOCTOR, DATE, TIME) */}
        <div className="space-y-3 bg-slate-50/70 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              2. Especialidad Médica, Especialista y Horario Restringido
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Specialty */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Especialidad Médica *
              </label>
              <div className="relative">
                <select
                  value={specialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white font-medium shadow-2xs"
                >
                  {allSpecialties.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Doctor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Médico Especialista *
                </label>
                {specialtyDoctors.length > 0 && (
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                    {specialtyDoctors.length} {specialtyDoctors.length === 1 ? 'disponible' : 'disponibles'}
                  </span>
                )}
              </div>
              <select
                value={specialtyDoctors.some((d) => d.id === doctorId) ? doctorId : (specialtyDoctors[0]?.id || '')}
                onChange={(e) => handleDoctorChange(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white font-medium shadow-2xs"
              >
                {specialtyDoctors.length > 0 ? (
                  specialtyDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name || doc.nombre || 'Médico'} ({doc.consultorio || doc.room || 'Consultorio'} • {doc.schedule || doc.horarioAtencion || '08:00 - 14:00'})
                    </option>
                  ))
                ) : (
                  <option value="" disabled>
                    -- Sin especialistas registrados para {specialty} --
                  </option>
                )}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-fecha">
                Fecha de la Cita *
              </label>
              <input
                id="input-fecha"
                type="date"
                required
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white font-medium shadow-2xs"
              />
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Atención * (Intervalos de 30m)
              </label>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white font-medium shadow-2xs"
              >
                {doctorTimeSlots.map((slot) => {
                  const isBooked = bookedTimesOnDate.has(slot);
                  return (
                    <option key={slot} value={slot} disabled={isBooked}>
                      {slot} {isBooked ? '⛔ (Ocupado)' : '✅ (Disponible)'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: MOTIVO DE CONSULTA / NOTAS */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="input-motivo">
            Motivo de Consulta y Observaciones Médicas
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <textarea
              id="input-motivo"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describa brevemente la sintomatología o motivo del agendamiento..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* ACTION BUTTON */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 bg-[#1a56db] hover:bg-[#1546b3] text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
          >
            <CalendarCheck className="w-4 h-4" />
            Agendar y Confirmar Cita Médica
          </button>
        </div>
      </form>
    </div>
  );
};

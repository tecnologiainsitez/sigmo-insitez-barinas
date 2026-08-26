import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, Doctor, Specialty } from '../types';
import { INITIAL_DOCTORS, SPECIALTIES_LIST } from '../data/mockDoctors';
import { generateDoctorTimeSlots, isTimeWithinDoctorSchedule } from '../utils/scheduleUtils';
import { dbService } from '../services/indexedDB';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  X,
  CalendarCheck,
  AlertCircle,
  Save,
  CheckCircle2,
  Lock,
  MessageSquare,
  IdCard,
} from 'lucide-react';

interface RescheduleModalProps {
  appointment: Appointment | null;
  allAppointments: Appointment[];
  onClose: () => void;
  onReschedule: (
    appointmentId: string,
    rescheduleData: {
      newDate: string;
      newTime: string;
      newDoctorId?: string;
      newDoctorName?: string;
      newSpecialty?: Specialty;
      reason?: string;
    }
  ) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({
  appointment,
  allAppointments,
  onClose,
  onReschedule,
}) => {
  if (!appointment) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  const currentSpecialty = (appointment.specialty || appointment.especialidad || 'Medicina General') as Specialty;
  const currentDocId = appointment.doctorId || appointment.medicoId || 'DOC-101';
  const currentDate = appointment.date || appointment.fecha || todayStr;
  const currentTime = appointment.time || appointment.hora || '08:00';

  const [specialty, setSpecialty] = useState<Specialty>(currentSpecialty);
  const [doctorId, setDoctorId] = useState<string>(currentDocId);
  const [date, setDate] = useState<string>(currentDate);
  const [time, setTime] = useState<string>(currentTime);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dynamic doctors state
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const stored = await dbService.getAllDoctors();
        if (stored && stored.length > 0) {
          setDoctorsList(stored);
        }
      } catch (e) {
        console.warn('Error loading doctors in RescheduleModal:', e);
      }
    };
    loadDocs();
  }, []);

  // Merge with appointment's doctor
  const allMergedDoctors = useMemo(() => {
    const map = new Map<string, Doctor>();
    doctorsList.forEach((d) => {
      if (d.id) map.set(d.id, d);
    });

    // Ensure current appointment doctor is in list if it's a real doctor name
    const rawDocName = (appointment.doctorName || appointment.medicoNombre || '').trim();
    if (
      rawDocName &&
      rawDocName !== 'Dr. Asignado' &&
      rawDocName !== 'Dr. Especialista' &&
      !rawDocName.startsWith('{')
    ) {
      const docId = appointment.doctorId || appointment.medicoId || 'DOC-CURRENT';
      const docSpec = (appointment.specialty || appointment.especialidad || 'Medicina General') as Specialty;
      if (!map.has(docId)) {
        map.set(docId, {
          id: docId,
          nombre: rawDocName,
          name: rawDocName,
          especialidad: docSpec,
          specialty: docSpec,
          horarioAtencion: '08:00 - 14:00',
          schedule: '08:00 - 14:00',
          consultorio: 'Consultorio 101',
          room: 'Consultorio 101',
          telefono: '',
          phone: '',
          email: '',
          estado: 'ACTIVO',
          active: true,
        });
      }
    }

    return Array.from(map.values());
  }, [doctorsList, appointment]);

  // Available doctors for selected specialty
  const availableDoctors = useMemo(() => {
    const filtered = allMergedDoctors.filter((d) => {
      const docSpec = (d.specialty || d.especialidad || '').toLowerCase().trim();
      const targetSpec = specialty.toLowerCase().trim();
      const isActive = d.active !== false && d.estado !== 'INACTIVO';
      return isActive && docSpec === targetSpec;
    });

    if (filtered.length > 0) {
      return filtered;
    }
    // Fallback: If no doctor strictly matches the specialty, show all active doctors
    return allMergedDoctors.filter((d) => d.active !== false && d.estado !== 'INACTIVO');
  }, [allMergedDoctors, specialty]);

  // Selected doctor object
  const selectedDoc = useMemo(() => {
    const foundInAvailable = availableDoctors.find((d) => d.id === doctorId);
    if (foundInAvailable) return foundInAvailable;
    return availableDoctors[0] || allMergedDoctors[0] || null;
  }, [availableDoctors, allMergedDoctors, doctorId]);

  // Auto sync doctorId if current doctorId is not in available doctors
  useEffect(() => {
    if (availableDoctors.length > 0 && !availableDoctors.some((d) => d.id === doctorId)) {
      setDoctorId(availableDoctors[0].id);
    }
  }, [specialty, availableDoctors, doctorId]);

  // Handle specialty change explicitly
  const handleSpecialtyChange = (newSpec: Specialty) => {
    setSpecialty(newSpec);
    const targetSpec = newSpec.toLowerCase().trim();
    const docsInSpec = allMergedDoctors.filter((d) => {
      const docSpec = (d.specialty || d.especialidad || '').toLowerCase().trim();
      const isActive = d.active !== false && d.estado !== 'INACTIVO';
      return isActive && docSpec === targetSpec;
    });
    if (docsInSpec.length > 0) {
      setDoctorId(docsInSpec[0].id);
    }
  };

  // Doctor schedule
  const doctorSchedule = selectedDoc?.schedule || selectedDoc?.horarioAtencion || '08:00 - 14:00';

  // Allowed slots for this doctor
  const doctorTimeSlots = useMemo(() => {
    const slots = generateDoctorTimeSlots(doctorSchedule, 30);
    return slots.length > 0 ? slots : ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
  }, [doctorSchedule]);

  // Sync doctor when specialty changes
  useEffect(() => {
    if (availableDoctors.length > 0 && !availableDoctors.some((d) => d.id === doctorId)) {
      setDoctorId(availableDoctors[0].id);
    }
  }, [specialty, availableDoctors, doctorId]);

  // Sync time when doctor time slots change
  useEffect(() => {
    if (doctorTimeSlots.length > 0 && !doctorTimeSlots.includes(time)) {
      setTime(doctorTimeSlots[0]);
    }
  }, [doctorTimeSlots, time]);

  // Booked times for this doctor on the selected date
  const bookedTimesOnDate = useMemo(() => {
    const booked = new Set<string>();
    allAppointments.forEach((a) => {
      if (a.id === appointment.id) return; // ignore self
      const aDocId = a.doctorId || a.medicoId;
      const aDate = a.date || a.fecha;
      const aTime = a.time || a.hora;
      const aStatus = a.status || a.estado;
      if (aDocId === doctorId && aDate === date && aStatus !== 'CANCELLED' && aTime) {
        booked.add(aTime);
      }
    });
    return booked;
  }, [allAppointments, appointment.id, doctorId, date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation 1: Schedule bounds (warning check)
    if (!isTimeWithinDoctorSchedule(time, doctorSchedule, 30)) {
      setErrorMsg(
        `⛔ Horario fuera de jornada: La hora ${time} hrs no corresponde al horario de atención de ${selectedDoc?.name || selectedDoc?.nombre || 'el médico'} (${doctorSchedule}).`
      );
      return;
    }

    // Validation 2: Conflict check
    if (bookedTimesOnDate.has(time)) {
      setErrorMsg(
        `⚠️ El turno de las ${time} hrs el día ${date} ya se encuentra ocupado para el Dr. ${selectedDoc?.name || selectedDoc?.nombre}. Por favor seleccione otro turno.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const docName = selectedDoc && selectedDoc.name && selectedDoc.name !== 'Dr. Asignado'
        ? (selectedDoc.name || selectedDoc.nombre)
        : (appointment.doctorName || appointment.medicoNombre || 'Dr. Asignado');
      const docIdToSave = selectedDoc?.id || doctorId;

      await onReschedule(appointment.id, {
        newDate: date,
        newTime: time,
        newDoctorId: docIdToSave,
        newDoctorName: docName,
        newSpecialty: specialty,
        reason: reason.trim() || 'Reprogramación de cita',
      });

      setSuccessMsg('¡Cita reprogramada exitosamente!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(`Error al reprogramar cita: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      id="reschedule-modal"
    >
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-indigo-300">Reprogramar Cita Médica</h3>
              <p className="text-xs text-slate-400">
                Cambio de fecha, hora o especialista con validación de jornada laboral
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar-x">
          {/* Patient Card Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Paciente:</span>
              <div className="font-bold text-slate-900 text-sm">
                {appointment.patientName || appointment.paciente}
              </div>
              <div className="flex items-center gap-2 font-mono text-teal-800 text-[11px] font-semibold">
                <IdCard className="w-3 h-3 text-teal-600" />
                Cédula: {appointment.patientDni || appointment.cedula}
              </div>
            </div>

            <div className="text-right space-y-0.5 font-mono text-[11px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-sans">
                Horario Actual:
              </span>
              <div className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {appointment.date || appointment.fecha} • {appointment.time || appointment.hora} hrs
              </div>
              <div className="text-slate-500 font-medium">
                {appointment.doctorName || appointment.medicoNombre}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* New Schedule Selectors */}
          <div className="space-y-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
            <div className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Nuevos Parámetros de la Cita
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Specialty */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Especialidad Médica *
                </label>
                <select
                  value={specialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value as Specialty)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
                >
                  {SPECIALTIES_LIST.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Médico Especialista *
                </label>
                <select
                  value={selectedDoc?.id || doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
                >
                  {availableDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name || doc.nombre} ({doc.schedule || doc.horarioAtencion})
                    </option>
                  ))}
                </select>
              </div>

              {/* New Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nueva Fecha *
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800"
                />
              </div>

              {/* New Time (Strictly restricted) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Nueva Hora *</span>
                  <span className="text-[10px] text-indigo-700 font-mono">
                    {doctorSchedule}
                  </span>
                </label>
                <select
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white font-mono font-medium text-slate-800"
                >
                  {doctorTimeSlots.map((slot) => {
                    const isBooked = bookedTimesOnDate.has(slot);
                    return (
                      <option
                        key={slot}
                        value={slot}
                        className={isBooked ? 'text-rose-600 bg-rose-50 font-semibold' : 'text-slate-800'}
                      >
                        {slot} hrs {isBooked ? '— ⚠️ Ocupado' : '— Disponible'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Doctor working schedule badge */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
              <Lock className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <span>
                <b>Horario de atención:</b> {selectedDoc?.name || selectedDoc?.nombre || 'El especialista'} pasa consulta en el rango{' '}
                <span className="text-indigo-900 font-bold">{doctorSchedule}</span>
                {selectedDoc?.room || selectedDoc?.consultorio ? ` (${selectedDoc?.room || selectedDoc?.consultorio})` : ''}.
              </span>
            </div>
          </div>

          {/* Reason for Reschedule */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              Motivo o Justificación de la Reprogramación:
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Solicitud directa del paciente por motivos laborales / Cambio de turno autorizado por el analista..."
              className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2.5 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Guardando...' : 'Confirmar Reprogramación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

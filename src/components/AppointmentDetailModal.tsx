import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus, Specialty, UserRole } from '../types';
import { generateICS } from '../../server/icsGenerator';
import { RescheduleModal } from './RescheduleModal';
import { PrintMedicalRecordModal } from './PrintMedicalRecordModal';
import { dbService, normalizeAppointmentEntity, sanitizeDateString, sanitizeTimeString } from '../services/indexedDB';
import {
  Download,
  Calendar,
  Clock,
  Phone,
  Mail,
  IdCard,
  Activity,
  X,
  Stethoscope,
  Pill,
  FileText,
  History,
  CheckCircle2,
  Edit3,
  Save,
  Lock,
  CalendarClock,
  BarChart3,
  XCircle,
  CheckCircle,
  Hourglass,
  FolderHeart,
  Filter,
  ArrowRight,
  Sparkles,
  Printer,
} from 'lucide-react';

interface AppointmentDetailModalProps {
  appointment: Appointment | null;
  allAppointments?: Appointment[];
  onClose: () => void;
  onSaveClinicalNotes?: (
    appointmentId: string,
    clinicalData: {
      idx: string;
      treatment: string;
      diseaseNotes: string;
      observacionesMedicas?: string;
      newStatus?: AppointmentStatus;
    }
  ) => Promise<void>;
  onReschedule?: (
    appointmentId: string,
    rescheduleData:
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
  ) => Promise<void>;
  currentUserRole?: UserRole;
}

export const AppointmentDetailModal: React.FC<AppointmentDetailModalProps> = ({
  appointment: rawAppointment,
  allAppointments: rawAllAppointments = [],
  onClose,
  onSaveClinicalNotes,
  onReschedule,
  currentUserRole,
}) => {
  if (!rawAppointment) return null;
  const appointment = normalizeAppointmentEntity(rawAppointment);
  const allAppointments = useMemo(() => {
    return (rawAllAppointments || []).map(normalizeAppointmentEntity);
  }, [rawAllAppointments]);

  // Strict role check: IDx and clinical notes are exclusively available for MEDICO and DESARROLLADOR_ADMIN
  const isDoctorOrAdmin = currentUserRole === 'MEDICO' || currentUserRole === 'DESARROLLADOR_ADMIN';
  const canReschedule = currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN';

  // Reschedule modal toggle
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Edit Clinical Notes State
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [idxInput, setIdxInput] = useState(appointment.idx || appointment.dx || appointment.diagnostico || '');
  const [treatmentInput, setTreatmentInput] = useState(appointment.treatment || appointment.tratamiento || '');
  const [diseaseNotesInput, setDiseaseNotesInput] = useState(
    appointment.diseaseNotes || appointment.notasEnfermedad || appointment.observacionesMedicas || ''
  );
  const [statusSelect, setStatusSelect] = useState<AppointmentStatus>(appointment.status || 'COMPLETED');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const icsData = useMemo(() => {
    try {
      return generateICS(appointment);
    } catch {
      return '';
    }
  }, [appointment]);

  // Filter all patient appointments (including historical and current)
  const patientDni = (appointment.patientDni || appointment.cedula || '').trim();
  const patientAppointments = useMemo(() => {
    return allAppointments.filter((a) => {
      const aDni = (a.patientDni || a.cedula || '').trim();
      return aDni === patientDni;
    });
  }, [allAppointments, patientDni]);

  // Historical encounters (excluding this current appointment)
  const historicalAppointments = useMemo(() => {
    return patientAppointments
      .filter((a) => a.id !== appointment.id)
      .sort((a, b) => {
        const dStrA = sanitizeDateString(a.date || a.fecha);
        const tStrA = sanitizeTimeString(a.time || a.hora);
        const dStrB = sanitizeDateString(b.date || b.fecha);
        const tStrB = sanitizeTimeString(b.time || b.hora);
        const fullA = `${dStrA} ${tStrA}`;
        const fullB = `${dStrB} ${tStrB}`;
        return fullB.localeCompare(fullA);
      });
  }, [patientAppointments, appointment.id]);

  // Active filter for appointments drill-down
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | string>('ALL');
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);

  // Recuento estadístico de citas por especialidad, asistidas y canceladas
  const patientStats = useMemo(() => {
    const listToCount = patientAppointments.length > 0 ? patientAppointments : [appointment];
    let total = listToCount.length;
    let attended = 0;
    let cancelled = 0;
    let pending = 0;
    const specialtyMap: Record<string, number> = {};

    listToCount.forEach((a) => {
      const st = a.status || a.estado;
      if (st === 'COMPLETED') attended++;
      else if (st === 'CANCELLED') cancelled++;
      else pending++;

      const spec = (a.specialty || a.especialidad || 'Medicina General') as string;
      specialtyMap[spec] = (specialtyMap[spec] || 0) + 1;
    });

    return {
      total,
      attended,
      cancelled,
      pending,
      specialtyBreakdown: Object.entries(specialtyMap).map(([specialty, count]) => ({
        specialty,
        count,
      })),
    };
  }, [patientAppointments, appointment]);

  // Filtered appointments based on active clicked card / specialty badge
  const filteredAppointmentsList = useMemo(() => {
    const listToFilter = patientAppointments.length > 0 ? patientAppointments : [appointment];
    if (activeFilter === 'ALL') {
      return listToFilter;
    }
    if (activeFilter === 'COMPLETED') {
      return listToFilter.filter((a) => (a.status || a.estado) === 'COMPLETED');
    }
    if (activeFilter === 'CANCELLED') {
      return listToFilter.filter((a) => (a.status || a.estado) === 'CANCELLED');
    }
    if (activeFilter === 'PENDING') {
      return listToFilter.filter(
        (a) => (a.status || a.estado) !== 'COMPLETED' && (a.status || a.estado) !== 'CANCELLED'
      );
    }
    if (activeFilter.startsWith('SPECIALTY:')) {
      const specName = activeFilter.replace('SPECIALTY:', '');
      return listToFilter.filter((a) => (a.specialty || a.especialidad) === specName);
    }
    return listToFilter;
  }, [patientAppointments, appointment, activeFilter]);

  const handleSaveNotes = async () => {
    if (!onSaveClinicalNotes) return;
    setIsSaving(true);
    try {
      await onSaveClinicalNotes(appointment.id, {
        idx: idxInput,
        treatment: treatmentInput,
        diseaseNotes: diseaseNotesInput,
        observacionesMedicas: diseaseNotesInput,
        newStatus: statusSelect,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditingNotes(false);
      }, 1000);
    } catch (e) {
      console.error('Error saving clinical notes:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const currentIdx = appointment.idx || appointment.dx || appointment.diagnostico;
  const currentTreatment = appointment.treatment || appointment.tratamiento;
  const currentDiseaseNotes =
    appointment.diseaseNotes || appointment.notasEnfermedad || appointment.observacionesMedicas;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
        id="appointment-detail-modal"
      >
        <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Modal Header */}
          <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-between border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-teal-400 flex items-center gap-2">
                <FolderHeart className="w-5 h-5 text-teal-400" />
                Expediente y Atención Clínica del Paciente
              </h3>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Cita ID: {appointment.id}</span>
                {appointment.expedienteNumber && (
                  <span className="text-teal-300 font-bold bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-800">
                    HC: {appointment.expedienteNumber}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Imprimir IDx, Tratamiento y Evolución"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir IDx / Evolución</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar-x">
            {/* Patient & Doctor Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1.5">
                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  Datos del Paciente
                </div>
                <div className="font-bold text-slate-900 text-base">
                  {appointment.patientName || appointment.paciente}
                </div>
                <div className="flex items-center gap-1.5 font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 w-fit font-bold">
                  <IdCard className="w-3.5 h-3.5 text-teal-600" />
                  Cédula: {appointment.patientDni || appointment.cedula}
                </div>
                <div className="text-slate-600 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> {appointment.patientEmail || appointment.email}
                </div>
                <div className="text-slate-600 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {appointment.patientPhone || appointment.telefono}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">
                  Especialidad y Médico Asignado
                </div>
                <div className="font-bold text-teal-700 text-base">
                  {appointment.specialty || appointment.especialidad}
                </div>
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                  {appointment.doctorName || appointment.medicoNombre}
                </div>
                <div className="text-slate-600 flex items-center gap-1 mt-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {sanitizeDateString(appointment.date || appointment.fecha) || 'Fecha por definir'} a las{' '}
                  {sanitizeTimeString(appointment.time || appointment.hora)} hrs
                </div>
                {(appointment.notes || appointment.motivoConsulta) && (
                  <div className="text-slate-600 text-[11px] bg-white p-2 rounded border border-slate-200 mt-1">
                    <span className="font-semibold text-slate-700">Motivo de Consulta:</span>{' '}
                    {appointment.notes || appointment.motivoConsulta}
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECCIÓN 1: RECUENTO ESTADÍSTICO DE CITAS DE LA FICHA DEL PACIENTE         */}
            {/* ========================================================================= */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-600 text-white rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-teal-300">
                      Recuento de Citas Médicas del Paciente
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Historial acumulado en el Centro de Salud por especialidades, asistencias y cancelaciones
                    </p>
                  </div>
                </div>

                {/* Reprogramar Cita Action Button (Available to Analista and Admin) */}
                {canReschedule && onReschedule && appointment.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => setShowRescheduleModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>Reprogramar Cita</span>
                  </button>
                )}
              </div>

              {/* KPI Metrics - Interactive Drill-Down Cards */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Seleccione una tarjeta o especialidad para consultar el detalle de citas:</span>
                  {activeFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('ALL')}
                      className="text-teal-400 hover:text-teal-300 font-semibold underline text-[10px] cursor-pointer"
                    >
                      Limpiar filtro
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Card 1: Total Citas */}
                  <button
                    type="button"
                    onClick={() => setActiveFilter('ALL')}
                    className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                      activeFilter === 'ALL'
                        ? 'bg-slate-800 border-teal-400 ring-2 ring-teal-400/60 shadow-lg scale-[1.02]'
                        : 'bg-slate-800/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
                    }`}
                    title="Click para ver todas las citas del paciente"
                  >
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Citas</span>
                    <span className="text-xl font-bold text-white font-mono">{patientStats.total}</span>
                    <span className="text-[9px] text-teal-400 font-semibold block mt-0.5">
                      {activeFilter === 'ALL' ? '● Mostrando todas' : 'Ver detalle →'}
                    </span>
                  </button>

                  {/* Card 2: Asistió (Atendidas) */}
                  <button
                    type="button"
                    onClick={() => setActiveFilter(activeFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                    className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                      activeFilter === 'COMPLETED'
                        ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/60 shadow-lg scale-[1.02]'
                        : 'bg-emerald-950/80 border-emerald-700/60 hover:border-emerald-500 hover:bg-emerald-900/60'
                    }`}
                    title="Click para filtrar citas asistidas/atendidas"
                  >
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold block flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" /> Asistió (Atendidas)
                    </span>
                    <span className="text-xl font-bold text-emerald-300 font-mono">{patientStats.attended}</span>
                    <span className="text-[9px] text-emerald-400 font-semibold block mt-0.5">
                      {activeFilter === 'COMPLETED' ? '● Filtradas' : 'Ver detalle →'}
                    </span>
                  </button>

                  {/* Card 3: Canceló (Canceladas) */}
                  <button
                    type="button"
                    onClick={() => setActiveFilter(activeFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
                    className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                      activeFilter === 'CANCELLED'
                        ? 'bg-rose-950 border-rose-400 ring-2 ring-rose-400/60 shadow-lg scale-[1.02]'
                        : 'bg-rose-950/80 border-rose-700/60 hover:border-rose-500 hover:bg-rose-900/60'
                    }`}
                    title="Click para filtrar citas canceladas"
                  >
                    <span className="text-[10px] text-rose-400 uppercase font-semibold block flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3 text-rose-400" /> Canceló (Canceladas)
                    </span>
                    <span className="text-xl font-bold text-rose-300 font-mono">{patientStats.cancelled}</span>
                    <span className="text-[9px] text-rose-400 font-semibold block mt-0.5">
                      {activeFilter === 'CANCELLED' ? '● Filtradas' : 'Ver detalle →'}
                    </span>
                  </button>

                  {/* Card 4: Pendientes / En Turno */}
                  <button
                    type="button"
                    onClick={() => setActiveFilter(activeFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                    className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                      activeFilter === 'PENDING'
                        ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-400/60 shadow-lg scale-[1.02]'
                        : 'bg-sky-950/80 border-sky-700/60 hover:border-sky-500 hover:bg-sky-900/60'
                    }`}
                    title="Click para filtrar citas pendientes por atender"
                  >
                    <span className="text-[10px] text-sky-400 uppercase font-semibold block flex items-center justify-center gap-1">
                      <Hourglass className="w-3 h-3 text-sky-400" /> Pendientes / En Turno
                    </span>
                    <span className="text-xl font-bold text-sky-300 font-mono">{patientStats.pending}</span>
                    <span className="text-[9px] text-sky-400 font-semibold block mt-0.5">
                      {activeFilter === 'PENDING' ? '● Filtradas' : 'Ver detalle →'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Specialty Breakdown Badges - Clickable */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Distribución por Especialidades Médicas (Click para filtrar citas):
                </span>
                <div className="flex flex-wrap gap-2">
                  {patientStats.specialtyBreakdown.map((item) => {
                    const isSelected = activeFilter === `SPECIALTY:${item.specialty}`;
                    return (
                      <button
                        key={item.specialty}
                        type="button"
                        onClick={() =>
                          setActiveFilter(isSelected ? 'ALL' : `SPECIALTY:${item.specialty}`)
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-teal-900/90 border-teal-400 text-teal-200 ring-2 ring-teal-400/50 shadow-md scale-[1.03]'
                            : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750 text-slate-300'
                        }`}
                        title={`Click para ver citas de ${item.specialty}`}
                      >
                        <span className={isSelected ? 'text-teal-200 font-bold' : 'text-teal-300 font-medium'}>
                          {item.specialty}:
                        </span>
                        <span className="font-bold text-white bg-slate-700 px-1.5 py-0.2 rounded font-mono text-[11px]">
                          {item.count} {item.count === 1 ? 'cita' : 'citas'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DETALLE EXPANDIBLE DE CITAS FILTRADAS */}
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                    <Filter className="w-3.5 h-3.5 text-teal-400" />
                    <span>
                      {activeFilter === 'ALL' && `Detalle de Todas las Citas (${filteredAppointmentsList.length})`}
                      {activeFilter === 'COMPLETED' && `Detalle de Citas Asistidas / Atendidas (${filteredAppointmentsList.length})`}
                      {activeFilter === 'CANCELLED' && `Detalle de Citas Canceladas (${filteredAppointmentsList.length})`}
                      {activeFilter === 'PENDING' && `Detalle de Citas Pendientes (${filteredAppointmentsList.length})`}
                      {activeFilter.startsWith('SPECIALTY:') &&
                        `Detalle de Citas en ${activeFilter.replace('SPECIALTY:', '')} (${filteredAppointmentsList.length})`}
                    </span>
                  </div>

                  {activeFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setActiveFilter('ALL')}
                      className="text-[11px] text-teal-300 hover:text-teal-200 underline font-semibold cursor-pointer"
                    >
                      Ver todas ({patientStats.total})
                    </button>
                  )}
                </div>

                {filteredAppointmentsList.length === 0 ? (
                  <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800 text-center text-xs text-slate-400">
                    No se encontraron citas con este filtro.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar-x">
                    {filteredAppointmentsList.map((appt) => {
                      const isCurrent = appt.id === appointment.id;
                      const isCompleted = (appt.status || appt.estado) === 'COMPLETED';
                      const isCancelled = (appt.status || appt.estado) === 'CANCELLED';

                      return (
                        <div
                          key={appt.id}
                          className={`p-2.5 rounded-xl border text-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                            isCurrent
                              ? 'bg-teal-950/70 border-teal-500/80 ring-1 ring-teal-500/40 shadow-sm'
                              : 'bg-slate-800/80 border-slate-700/70 hover:bg-slate-800'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Fecha y Hora */}
                              <span className="font-mono font-bold bg-slate-950 text-teal-300 px-2 py-0.5 rounded text-[11px] border border-slate-700 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-teal-400" />
                                {sanitizeDateString(appt.date || appt.fecha) || 'Fecha por definir'} • {sanitizeTimeString(appt.time || appt.hora)} hrs
                              </span>

                              {/* Especialidad */}
                              <span className="font-bold text-white flex items-center gap-1">
                                <span className="text-teal-300">Especialidad:</span> {appt.specialty || appt.especialidad}
                              </span>

                              {/* Estado */}
                              <span
                                className={`px-2 py-0.2 rounded-full font-bold text-[10px] ${
                                  isCompleted
                                    ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                                    : isCancelled
                                    ? 'bg-rose-900/80 text-rose-300 border border-rose-700'
                                    : 'bg-sky-900/80 text-sky-300 border border-sky-700'
                                }`}
                              >
                                {isCompleted
                                  ? 'Atendida / Asistió'
                                  : isCancelled
                                  ? 'Cancelada'
                                  : 'Pendiente / Programada'}
                              </span>

                              {isCurrent && (
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.2 rounded font-bold">
                                  Cita en Pantalla
                                </span>
                              )}
                            </div>

                            {/* Médico Asignado */}
                            <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                              <Stethoscope className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                              <span>
                                <strong className="text-slate-400">Médico:</strong> {appt.doctorName || appt.medicoNombre}
                              </span>
                            </div>

                            {/* Motivo de consulta si existe */}
                            {(appt.notes || appt.motivoConsulta) && (
                              <div className="text-[10px] text-slate-400 bg-slate-900/80 p-1.5 rounded border border-slate-700/60 max-w-xl">
                                <span className="text-slate-300 font-semibold">Motivo:</span> {appt.notes || appt.motivoConsulta}
                              </div>
                            )}
                          </div>

                          {/* Botón de Reprogramar (Analista y Admin) */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            {canReschedule && onReschedule && !isCompleted && !isCancelled && (
                              <button
                                type="button"
                                onClick={() => setAppointmentToReschedule(appt)}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition shadow-xs cursor-pointer"
                                title="Reprogramar esta cita"
                              >
                                <CalendarClock className="w-3 h-3" />
                                <span>Reprogramar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECCIÓN 2: ANOTACIONES CLÍNICAS (IDx, TRATAMIENTO) - SOLO MÉDICO & ADMIN  */}
            {/* ========================================================================= */}
            {isDoctorOrAdmin ? (
              <div className="bg-gradient-to-br from-teal-50/70 to-emerald-50/50 border-2 border-teal-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-teal-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-600 text-white rounded-xl shadow-xs">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-teal-950">Anotaciones de la Atención Médica</h4>
                      <p className="text-[11px] text-teal-800">
                        Registro de Diagnóstico (IDx), Plan Terapéutico y Notas de Evolución Clínica
                      </p>
                    </div>
                  </div>

                  {onSaveClinicalNotes && (
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(!isEditingNotes)}
                      className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isEditingNotes ? 'Cancelar Edición' : 'Editar / Anotar IDx'}
                    </button>
                  )}
                </div>

                {/* Editing Form for Doctor / Admin */}
                {isEditingNotes ? (
                  <div className="space-y-4 bg-white p-4 rounded-xl border border-teal-300 shadow-xs">
                    {/* IDx Input */}
                    <div>
                      <label className="block text-xs font-bold text-teal-950 mb-1 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-teal-600" />
                        IDx (Impresión Diagnóstica / CIE-10 / Diagnóstico Principal):
                      </label>
                      <input
                        type="text"
                        value={idxInput}
                        onChange={(e) => setIdxInput(e.target.value)}
                        placeholder="Ej. I10 - Hipertensión Primaria / J00 - Rinofaringitis Aguda"
                        className="w-full text-xs font-medium border border-teal-300 rounded-lg p-2.5 bg-teal-50/30 focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                      />
                      {/* Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold">Sugerencias rápidas:</span>
                        {[
                          'I10 - Hipertensión Esencial',
                          'E11 - Diabetes Mellitus 2',
                          'J00 - Rinofaringitis Aguda',
                          'M54.5 - Lumbago Mecánico',
                          'K29 - Gastritis Aguda',
                          'Z00.0 - Chequeo General Sano',
                        ].map((diag) => (
                          <button
                            key={diag}
                            type="button"
                            onClick={() => setIdxInput(diag)}
                            className="text-[10px] bg-slate-100 hover:bg-teal-100 text-slate-700 hover:text-teal-900 px-2 py-0.5 rounded-md transition"
                          >
                            {diag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Treatment Input */}
                    <div>
                      <label className="block text-xs font-bold text-teal-950 mb-1 flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5 text-teal-600" />
                        Tratamiento Prescrito y Plan Terapéutico:
                      </label>
                      <textarea
                        rows={3}
                        value={treatmentInput}
                        onChange={(e) => setTreatmentInput(e.target.value)}
                        placeholder="Medicamentos, dosis, pauta horaria, duración, indicaciones de reposo o dieta..."
                        className="w-full text-xs font-medium border border-teal-300 rounded-lg p-2.5 bg-teal-50/30 focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* Disease Notes / Evolution */}
                    <div>
                      <label className="block text-xs font-bold text-teal-950 mb-1 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Notas respecto a la Enfermedad, Examen Físico y Evolución:
                      </label>
                      <textarea
                        rows={3}
                        value={diseaseNotesInput}
                        onChange={(e) => setDiseaseNotesInput(e.target.value)}
                        placeholder="Anamnesis, signos vitales (PA, FC, Temp), hallazgos del examen físico, evolución clínica..."
                        className="w-full text-xs font-medium border border-teal-300 rounded-lg p-2.5 bg-teal-50/30 focus:ring-2 focus:ring-teal-500 focus:bg-white text-slate-900"
                      />
                    </div>

                    {/* State selector & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-slate-700">Estado de Atención:</span>
                        <select
                          value={statusSelect}
                          onChange={(e) => setStatusSelect(e.target.value as AppointmentStatus)}
                          className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
                        >
                          <option value="COMPLETED">✅ Atendido / Completado</option>
                          <option value="IN_CONSULTATION">🟣 En Consulta</option>
                          <option value="IN_WAITING_ROOM">🔵 En Sala de Espera</option>
                          <option value="CONFIRMED">🟢 Confirmada</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingNotes(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNotes}
                          disabled={isSaving}
                          className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'Guardando...' : saveSuccess ? '¡Guardado con Éxito!' : 'Guardar Anotaciones'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View Mode for Clinical Notes (Doctor / Admin) */
                  <div className="space-y-3">
                    {/* 1. IDx Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs">
                      <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <Activity className="w-3.5 h-3.5 text-teal-600" />
                        IDx (Impresión Diagnóstica):
                      </div>
                      {currentIdx ? (
                        <div className="text-xs font-bold text-slate-900 bg-teal-50/50 p-2.5 rounded-lg border border-teal-100">
                          {currentIdx}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Pendiente de registro por el médico tratante.
                        </p>
                      )}
                    </div>

                    {/* 2. Treatment Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs">
                      <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <Pill className="w-3.5 h-3.5 text-teal-600" />
                        Tratamiento Prescrito e Indicaciones:
                      </div>
                      {currentTreatment ? (
                        <div className="text-xs text-slate-900 font-medium bg-teal-50/50 p-2.5 rounded-lg border border-teal-100 whitespace-pre-line leading-relaxed">
                          {currentTreatment}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Sin prescripción de tratamiento registrada para esta cita.
                        </p>
                      )}
                    </div>

                    {/* 3. Disease Notes / Evolution Box */}
                    <div className="bg-white p-3.5 rounded-xl border border-teal-200 shadow-2xs">
                      <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                        <FileText className="w-3.5 h-3.5 text-teal-600" />
                        Notas respecto a la Enfermedad y Evolución Clínica:
                      </div>
                      {currentDiseaseNotes ? (
                        <div className="text-xs text-slate-800 bg-teal-50/50 p-2.5 rounded-lg border border-teal-100 whitespace-pre-line leading-relaxed">
                          {currentDiseaseNotes}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Sin observaciones de evolución registradas aún.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Notice for Analista role: IDx is restricted */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-600">
                <div className="p-2 bg-slate-200 rounded-lg text-slate-700">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 block">
                    Anotaciones Clínicas (IDx y Tratamiento Médico):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Por políticas de confidencialidad y secreto médico, la visualización y edición del diagnóstico (IDx) están reservadas exclusivamente para el personal Médico y Administrador.
                  </span>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SECCIÓN 3: HISTORIA MÉDICA Y ANTECEDENTES DE BASE DEL PACIENTE            */}
            {/* ========================================================================= */}
            <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wide">
                <Activity className="w-4 h-4 text-rose-600" />
                Historia Médica y Antecedentes de Base
              </div>
              <p className="text-xs text-rose-950 leading-relaxed font-medium bg-white p-2.5 rounded-lg border border-rose-200">
                {appointment.patientMedicalHistory ||
                  appointment.historiaMedica ||
                  'Sin antecedentes médicos previos registrados para este paciente.'}
              </p>
            </div>

            {/* ========================================================================= */}
            {/* SECCIÓN 4: REGISTRO HISTÓRICO DE ATENCIONES EN EL CENTRO DE SALUD         */}
            {/* ========================================================================= */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <History className="w-4 h-4 text-teal-600" />
                  <span>Registro Histórico de Atenciones en el Centro de Salud</span>
                </div>
                <span className="text-[11px] font-bold text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {historicalAppointments.length} atenciones previas
                </span>
              </div>

              {historicalAppointments.length === 0 ? (
                <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-teal-600 mx-auto opacity-70" />
                  <p className="font-semibold text-slate-700">Primera cita registrada para este paciente en el sistema.</p>
                  <p className="text-[11px] text-slate-400">
                    A medida que asista a consultas, su historial cronológico se consolidará aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historicalAppointments.map((histAppt, index) => {
                    const histIdx = histAppt.idx || histAppt.dx || histAppt.diagnostico;
                    const histTreatment = histAppt.treatment || histAppt.tratamiento;
                    const histNotes =
                      histAppt.diseaseNotes || histAppt.notasEnfermedad || histAppt.observacionesMedicas;

                    return (
                      <div
                        key={histAppt.id || index}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2 hover:border-teal-300 transition"
                      >
                        {/* Timeline Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-slate-900 text-teal-300 px-2 py-0.5 rounded">
                              📅 {sanitizeDateString(histAppt.date || histAppt.fecha) || 'Fecha por definir'} • {sanitizeTimeString(histAppt.time || histAppt.hora)} hrs
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {histAppt.specialty || histAppt.especialidad}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                            <span>{histAppt.doctorName || histAppt.medicoNombre}</span>
                          </div>
                        </div>

                        {/* Diagnostic & Treatment Summary (Only for Doctor and Admin) */}
                        {isDoctorOrAdmin ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div className="bg-teal-50/60 p-2.5 rounded-lg border border-teal-100">
                              <span className="font-bold text-teal-900 text-[10px] uppercase block">
                                IDx (Diagnóstico):
                              </span>
                              <span className="text-slate-800 font-semibold">
                                {histIdx || histAppt.notes || 'Consulta de rutina / Control'}
                              </span>
                            </div>

                            <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100">
                              <span className="font-bold text-emerald-900 text-[10px] uppercase block">
                                Tratamiento Indicado:
                              </span>
                              <span className="text-slate-800">
                                {histTreatment || 'Sin prescripción anotada'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-200">
                            Atención completada con el especialista. Detalles clínicos restringidos al rol médico.
                          </div>
                        )}

                        {isDoctorOrAdmin && histNotes && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-700">Notas de Evolución:</span> {histNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions Bar - Exportación a Calendario e Impresión */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50 border border-teal-200 p-3 rounded-xl">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir IDx, Tratamiento y Evolución</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsData)}`}
                  download={`cita_${appointment.id}.ics`}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar Archivo .ICS
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Medical Record Modal */}
      {showPrintModal && (
        <PrintMedicalRecordModal
          appointment={{
            ...appointment,
            idx: idxInput !== undefined ? idxInput : (appointment.idx || appointment.dx || appointment.diagnostico),
            treatment: treatmentInput !== undefined ? treatmentInput : (appointment.treatment || appointment.tratamiento),
            diseaseNotes: diseaseNotesInput !== undefined ? diseaseNotesInput : (appointment.diseaseNotes || appointment.notasEnfermedad || appointment.observacionesMedicas),
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Reschedule Modal */}
      {(showRescheduleModal || appointmentToReschedule) && onReschedule && (
        <RescheduleModal
          appointment={appointmentToReschedule || appointment}
          allAppointments={allAppointments}
          onClose={() => {
            setShowRescheduleModal(false);
            setAppointmentToReschedule(null);
          }}
          onReschedule={async (id, data) => {
            await onReschedule(id, data);
            setShowRescheduleModal(false);
            setAppointmentToReschedule(null);
          }}
        />
      )}
    </>
  );
};

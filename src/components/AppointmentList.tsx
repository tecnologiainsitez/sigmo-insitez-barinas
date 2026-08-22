import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus, Specialty, UserRole } from '../types';
import { RescheduleModal } from './RescheduleModal';
import { PrintMedicalRecordModal } from './PrintMedicalRecordModal';
import { normalizeAppointmentEntity, sanitizeDateString, sanitizeTimeString } from '../services/indexedDB';
import { safeParseDate, safeFormatISO, safeFormatLocaleDate } from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  ChevronRight,
  ChevronLeft,
  IdCard,
  Activity,
  CalendarDays,
  List,
  Hash,
  Stethoscope,
  Eye,
  Check,
  X,
  Play,
  FileSpreadsheet,
  CalendarClock,
  Printer,
} from 'lucide-react';

interface AppointmentListProps {
  appointments: Appointment[];
  onUpdateStatus: (id: string, newStatus: AppointmentStatus) => Promise<void>;
  onSelectAppointmentForModal: (appt: Appointment) => void;
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
  currentDoctorId?: string;
}

export const AppointmentList: React.FC<AppointmentListProps> = ({
  appointments: rawAppointments,
  onUpdateStatus,
  onSelectAppointmentForModal,
  onReschedule,
  currentUserRole,
  currentDoctorId,
}) => {
  const appointments = useMemo(() => {
    return (rawAppointments || []).map(normalizeAppointmentEntity);
  }, [rawAppointments]);

  const isDoctorRole = currentUserRole === 'MEDICO';
  const canReschedule = currentUserRole === 'ANALISTA' || currentUserRole === 'DESARROLLADOR_ADMIN';
  const todayStr = new Date().toISOString().split('T')[0];

  // Reschedule state
  const [apptToReschedule, setApptToReschedule] = useState<Appointment | null>(null);
  const [apptToPrint, setApptToPrint] = useState<Appointment | null>(null);

  // View state: 'TABLE' | 'CALENDAR'
  const [viewType, setViewType] = useState<'TABLE' | 'CALENDAR'>('CALENDAR');

  // Search and general filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Calendar / Date query filter
  const [queryDate, setQueryDate] = useState<string>(todayStr);
  const [doctorFilter, setDoctorFilter] = useState<string>('ALL');

  // Date navigation helpers
  const changeQueryDate = (offsetDays: number) => {
    const d = safeParseDate(queryDate);
    d.setDate(d.getDate() + offsetDays);
    setQueryDate(safeFormatISO(d));
  };

  const formatDateLabel = (dateString: string) => {
    return safeFormatLocaleDate(dateString, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Base appointments restricted by doctor if in MEDICO role
  const roleFilteredAppointments = useMemo(() => {
    if (isDoctorRole && currentDoctorId) {
      return appointments.filter(
        (a) => a.doctorId === currentDoctorId || a.medicoId === currentDoctorId
      );
    }
    return appointments;
  }, [appointments, isDoctorRole, currentDoctorId]);

  // Distinct doctors for filtering
  const distinctDoctors = useMemo(() => {
    const map = new Map<string, string>();
    roleFilteredAppointments.forEach((a) => {
      const id = a.doctorId || a.medicoId;
      const name = a.doctorName || a.medicoNombre;
      if (id && name) {
        map.set(id, name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [roleFilteredAppointments]);

  // Filtered appointments for Table View
  const filteredTable = useMemo(() => {
    return roleFilteredAppointments.filter((appt) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        appt.patientName.toLowerCase().includes(term) ||
        (appt.paciente && appt.paciente.toLowerCase().includes(term)) ||
        appt.patientDni.includes(term) ||
        appt.doctorName.toLowerCase().includes(term) ||
        (appt.expedienteNumber && appt.expedienteNumber.toLowerCase().includes(term)) ||
        (appt.patientMedicalHistory && appt.patientMedicalHistory.toLowerCase().includes(term)) ||
        (appt.notes && appt.notes.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || appt.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [roleFilteredAppointments, searchTerm, statusFilter]);

  // Filtered appointments for Calendar / Date Query View
  const filteredCalendar = useMemo(() => {
    return roleFilteredAppointments.filter((appt) => {
      const apptDate = appt.date || appt.fecha || todayStr;
      const matchesDate = apptDate === queryDate;

      const apptDocId = appt.doctorId || appt.medicoId;
      const matchesDoctor = isDoctorRole || doctorFilter === 'ALL' || apptDocId === doctorFilter;

      const matchesStatus = statusFilter === 'ALL' || appt.status === statusFilter;

      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        appt.patientName.toLowerCase().includes(term) ||
        appt.patientDni.includes(term) ||
        (appt.expedienteNumber && appt.expedienteNumber.toLowerCase().includes(term)) ||
        (appt.notes && appt.notes.toLowerCase().includes(term));

      return matchesDate && matchesDoctor && matchesStatus && matchesSearch;
    });
  }, [roleFilteredAppointments, queryDate, isDoctorRole, doctorFilter, statusFilter, searchTerm, todayStr]);

  // Sort calendar appointments chronologically
  const sortedCalendarAppts = useMemo(() => {
    return [...filteredCalendar].sort((a, b) => {
      const timeA = a.time || a.hora || '00:00';
      const timeB = b.time || b.hora || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [filteredCalendar]);

  // Group appointments by date count for calendar quick hints
  const appointmentCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((a) => {
      const d = a.date || a.fecha;
      if (d) {
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    return counts;
  }, [appointments]);

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300 rounded-full flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-sky-600" /> Confirmada
          </span>
        );
      case 'IN_WAITING_ROOM':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 rounded-full flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3 text-blue-600" /> Pendiente
          </span>
        );
      case 'IN_CONSULTATION':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-300 rounded-full flex items-center gap-1 w-fit">
            <Activity className="w-3 h-3 text-purple-600 animate-spin" /> En Consulta
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1 w-fit shadow-xs">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> Atendido
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 rounded-full flex items-center gap-1 w-fit">
            <XCircle className="w-3 h-3 text-rose-600" /> Cancelada
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-300 rounded-full flex items-center gap-1 w-fit">
            No Asistió
          </span>
        );
      case 'CONFLICT_PENDING':
        return (
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center gap-1 w-fit animate-pulse">
            <AlertCircle className="w-3 h-3 text-amber-600" /> Conflicto Pendiente
          </span>
        );
    }
  };

  const getSyncBadge = (syncState: string) => {
    if (syncState === 'SYNCED') {
      return (
        <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Servidor
        </span>
      );
    } else if (syncState === 'PENDING_SYNC') {
      return (
        <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-mono flex items-center gap-1">
          <Database className="w-3 h-3 text-amber-600" /> IndexedDB Local
        </span>
      );
    } else {
      return (
        <span className="text-[10px] bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded font-mono flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-600" /> Conflicto
        </span>
      );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="appointments-list-container">
      {/* Header and View Switcher */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-teal-600" />
            Gestión y Consulta de Citas Médicas
          </h2>
          <p className="text-xs text-slate-500">
            Registro de turnos, consulta por fecha/calendario y trazabilidad clínica por Cédula / N° Expediente
          </p>
        </div>

        {/* View Switcher Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 text-xs">
            <button
              onClick={() => setViewType('CALENDAR')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                viewType === 'CALENDAR'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-teal-600" />
              <span>Vista Calendario por Fecha</span>
            </button>
            <button
              onClick={() => setViewType('TABLE')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                viewType === 'TABLE'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-teal-600" />
              <span>Listado General ({appointments.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW TYPE 1: CALENDAR / DATE QUERY VIEW */}
      {viewType === 'CALENDAR' && (
        <div className="space-y-4 p-4">
          {/* Date Query Navigator Bar */}
          <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            {/* Quick Day Navigator */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-300 shadow-sm">
                <button
                  type="button"
                  onClick={() => changeQueryDate(-1)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
                  title="Día Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setQueryDate(todayStr)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    queryDate === todayStr ? 'bg-teal-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => changeQueryDate(1)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition"
                  title="Día Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Native Date Input */}
              <input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold border border-slate-300 bg-white rounded-xl focus:ring-2 focus:ring-teal-500 shadow-sm text-slate-800"
              />

              <div className="text-xs font-bold text-slate-800 capitalize">
                📅 {formatDateLabel(queryDate)}
              </div>
            </div>

            {/* Filters for Calendar View */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Doctor filter */}
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-700"
              >
                <option value="ALL">Todos los Médicos</option>
                {distinctDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-700"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="CONFIRMED">Confirmada / Pendiente</option>
                <option value="COMPLETED">Atendido</option>
                <option value="CANCELLED">Cancelada</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar en el día..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white w-36 sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* Daily KPI Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Pacientes Citados:</span>
              <span className="text-base font-bold text-slate-900">{sortedCalendarAppts.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-emerald-900">
              <span className="font-medium">Atendidos:</span>
              <span className="text-base font-bold">{sortedCalendarAppts.filter((a) => a.status === 'COMPLETED').length}</span>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between text-sky-900">
              <span className="font-medium">Confirmadas / Pendientes:</span>
              <span className="text-base font-bold">{sortedCalendarAppts.filter((a) => a.status === 'CONFIRMED' || a.status === 'IN_WAITING_ROOM' || a.status === 'IN_CONSULTATION').length}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-900">
              <span className="font-medium">Canceladas:</span>
              <span className="text-base font-bold">{sortedCalendarAppts.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW').length}</span>
            </div>
          </div>

          {/* Scheduled Appointments Cards */}
          {sortedCalendarAppts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 space-y-2">
              <CalendarIcon className="w-8 h-8 mx-auto opacity-40 text-teal-600" />
              <p className="text-sm font-semibold text-slate-600">
                No hay pacientes agendados para el {queryDate}
              </p>
              <p className="text-xs text-slate-400">
                Seleccione otra fecha en el calendario o utilice el formulario superior para agendar una nueva cita.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCalendarAppts.map((appt) => {
                const time = appt.time || appt.hora || '10:00';
                const exp = appt.expedienteNumber || appt.numeroExpediente;

                return (
                  <div
                    key={appt.id}
                    className={`bg-white border rounded-xl p-4 transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      appt.status === 'COMPLETED'
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : appt.status === 'CANCELLED'
                        ? 'border-rose-200 bg-rose-50/20 opacity-75'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Time & Patient Header */}
                    <div className="flex items-start gap-3.5">
                      <div className="bg-slate-900 text-teal-300 px-3 py-2 rounded-xl text-center font-mono font-bold text-xs shadow-inner min-w-[70px]">
                        <Clock className="w-3.5 h-3.5 mx-auto mb-0.5 text-teal-400" />
                        {time} hrs
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {appt.patientName || appt.paciente}
                          </span>
                          {getStatusBadge(appt.status)}
                          {getSyncBadge(appt.syncState)}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span className="font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded text-slate-800 flex items-center gap-1">
                            <IdCard className="w-3 h-3 text-slate-500" /> CI: {appt.patientDni || appt.cedula}
                          </span>

                          {exp && (
                            <span className="font-mono font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                              <Hash className="w-3 h-3 text-teal-600" /> HC: {exp}
                            </span>
                          )}

                          <span className="text-slate-500 flex items-center gap-1">
                            <Stethoscope className="w-3 h-3 text-teal-600" /> {appt.doctorName || appt.medicoNombre} ({appt.specialty || appt.especialidad})
                          </span>
                        </div>

                        {(appt.notes || appt.motivoConsulta || (appt as any).motivo) && (
                          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 max-w-xl">
                            <span className="font-semibold text-slate-700">Notas:</span> {appt.notes || appt.motivoConsulta || (appt as any).motivo}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap self-end md:self-center">
                      {/* Atendido Button */}
                      {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(appt.id, 'COMPLETED')}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                          title="Marcar cita como atendida"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Atendido</span>
                        </button>
                      )}

                      {/* Reprogramar Cita Button */}
                      {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() => setApptToReschedule(appt)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                          title="Reprogramar fecha/hora o médico de la cita"
                        >
                          <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Reprogramar</span>
                        </button>
                      )}

                      {/* Cancelar Button */}
                      {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(appt.id, 'CANCELLED')}
                          className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                          title="Cancelar cita médica"
                        >
                          Cancelar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setApptToPrint(appt)}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                        title="Imprimir IDx, Tratamiento y Evolución"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Imprimir</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onSelectAppointmentForModal(appt)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                        title="Ver detalle de cita y descarga .ICS"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ficha</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW TYPE 2: TABLE VIEW */}
      {viewType === 'TABLE' && (
        <div>
          {/* Table Header Filter Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600 font-semibold">
              Mostrando {filteredTable.length} citas registradas
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por Cédula, Expediente, paciente..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 bg-white w-64 shadow-sm"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs shadow-sm">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-700 outline-none cursor-pointer"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="CONFIRMED">Confirmada / Pendiente</option>
                  <option value="COMPLETED">Atendido</option>
                  <option value="CANCELLED">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto custom-scrollbar-x">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Hora / Fecha</th>
                  <th className="py-3 px-4">Cédula & Paciente</th>
                  <th className="py-3 px-4">N° Expediente / Antecedentes</th>
                  <th className="py-3 px-4">Especialidad & Médico</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Origen / Sync</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTable.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No se encontraron citas médicas registradas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredTable.map((appt) => {
                    const exp = appt.expedienteNumber || appt.numeroExpediente;

                    return (
                      <tr key={appt.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Time & Date */}
                        <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                            <Clock className="w-3.5 h-3.5 text-teal-600" />
                            {sanitizeTimeString(appt.time || appt.hora)} hrs
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal">{sanitizeDateString(appt.date || appt.fecha) || 'Fecha por definir'}</div>
                        </td>

                        {/* Patient & Cédula */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 font-bold text-slate-900 text-xs">
                            {appt.patientName}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 w-fit mt-0.5">
                            <IdCard className="w-3 h-3 text-teal-600" />
                            CI: {appt.patientDni}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{appt.patientPhone}</div>
                        </td>

                        {/* Expediente & Antecedentes Column */}
                        <td className="py-3 px-4 max-w-xs">
                          {exp && (
                            <div className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 w-fit mb-1 text-[11px]">
                              HC: {exp}
                            </div>
                          )}
                          {appt.patientMedicalHistory ? (
                            <div
                              className="bg-rose-50/60 border border-rose-200/80 p-1.5 rounded-lg text-[11px] text-rose-950 font-medium line-clamp-2"
                              title={appt.patientMedicalHistory}
                            >
                              {appt.patientMedicalHistory}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Sin antecedentes registrados</span>
                          )}
                        </td>

                        {/* Specialty & Doctor */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{appt.doctorName}</div>
                          <div className="text-[11px] text-teal-700 font-medium">{appt.specialty}</div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4">{getStatusBadge(appt.status)}</td>

                        {/* Sync Origin Badge */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            {getSyncBadge(appt.syncState)}
                            <span className="text-[10px] text-slate-400 font-mono">
                              {appt.originDevice || 'Recepción'}
                            </span>
                          </div>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Atendido Button */}
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'COMPLETED')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
                                title="Marcar cita como atendida"
                              >
                                <Check className="w-3 h-3" />
                                <span>Atendido</span>
                              </button>
                            )}

                            {/* Reprogramar Cita Button */}
                            {appt.status !== 'COMPLETED' && appt.status !== 'CANCELLED' && (
                              <button
                                onClick={() => setApptToReschedule(appt)}
                                className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded text-[11px] font-medium transition flex items-center gap-1"
                                title="Reprogramar fecha/hora o médico de la cita"
                              >
                                <CalendarClock className="w-3 h-3 text-indigo-600" />
                                <span>Reprog.</span>
                              </button>
                            )}

                            {/* Cancelar Button */}
                            {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                              <button
                                onClick={() => onUpdateStatus(appt.id, 'CANCELLED')}
                                className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded text-[11px] font-medium transition"
                                title="Cancelar cita médica"
                              >
                                Cancelar
                              </button>
                            )}

                            <button
                              onClick={() => setApptToPrint(appt)}
                              title="Imprimir IDx, Tratamiento y Evolución"
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onSelectAppointmentForModal(appt)}
                              title="Ver detalle de cita y descarga .ICS"
                              className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-slate-100 rounded-lg transition"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print Medical Record Modal */}
      {apptToPrint && (
        <PrintMedicalRecordModal
          appointment={apptToPrint}
          onClose={() => setApptToPrint(null)}
        />
      )}

      {/* Reschedule Modal */}
      {apptToReschedule && onReschedule && (
        <RescheduleModal
          appointment={apptToReschedule}
          allAppointments={appointments}
          onClose={() => setApptToReschedule(null)}
          onReschedule={onReschedule}
        />
      )}
    </div>
  );
};

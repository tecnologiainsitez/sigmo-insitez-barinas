import React, { useState, useMemo, useEffect } from 'react';
import { Appointment, AppointmentStatus, Doctor, Specialty, UserRole } from '../types';
import { INITIAL_DOCTORS } from '../data/mockDoctors';
import { dbService, normalizeAppointmentEntity, sanitizeDateString, sanitizeTimeString } from '../services/indexedDB';
import {
  safeParseDate,
  safeFormatISO,
  safeFormatLocaleDate,
  safeGetDayNum,
  safeGetMonthName,
  safeGetWeekdayName,
} from '../utils/dateUtils';
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  IdCard,
  Hash,
  Activity,
  Play,
  Check,
  X,
  Phone,
  Mail,
  FileText,
  Users,
  Eye,
  CalendarDays,
  Lock,
  ShieldCheck,
  Layers,
  Columns,
  ListFilter,
  ChevronDown,
  CalendarRange,
  Info,
  Sparkles,
  MapPin,
} from 'lucide-react';

interface DoctorCalendarViewProps {
  appointments: Appointment[];
  onUpdateStatus: (id: string, newStatus: AppointmentStatus) => Promise<void>;
  onSelectAppointmentForModal: (appt: Appointment) => void;
  currentUserRole: UserRole;
  currentDoctorId: string;
  onSelectDoctor?: (doctorId: string) => void;
}

type CalendarViewMode = 'DAY' | 'WEEK' | 'MONTH' | 'AGENDA';

// Doctor color palette for Google Calendar visual identification
const DOCTOR_COLORS: Record<string, { bg: string; border: string; text: string; lightBg: string; dot: string }> = {
  'doc-1': { bg: 'bg-teal-600', border: 'border-teal-500', text: 'text-teal-700', lightBg: 'bg-teal-50', dot: 'bg-teal-500' },
  'doc-2': { bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-indigo-700', lightBg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  'doc-3': { bg: 'bg-rose-600', border: 'border-rose-500', text: 'text-rose-700', lightBg: 'bg-rose-50', dot: 'bg-rose-500' },
  'doc-4': { bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-700', lightBg: 'bg-purple-50', dot: 'bg-purple-500' },
  'doc-5': { bg: 'bg-amber-600', border: 'border-amber-500', text: 'text-amber-700', lightBg: 'bg-amber-50', dot: 'bg-amber-500' },
  'doc-6': { bg: 'bg-emerald-600', border: 'border-emerald-500', text: 'text-emerald-700', lightBg: 'bg-emerald-50', dot: 'bg-emerald-500' },
};

const DEFAULT_DOCTOR_COLOR = {
  bg: 'bg-sky-600',
  border: 'border-sky-500',
  text: 'text-sky-700',
  lightBg: 'bg-sky-50',
  dot: 'bg-sky-500',
};

// Working hours for the Google Calendar daily/weekly grid
const TIME_SLOTS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

export const DoctorCalendarView: React.FC<DoctorCalendarViewProps> = ({
  appointments: rawAppointments,
  onUpdateStatus,
  onSelectAppointmentForModal,
  currentUserRole,
  currentDoctorId,
  onSelectDoctor,
}) => {
  const appointments = useMemo(() => {
    return (rawAppointments || []).map(normalizeAppointmentEntity);
  }, [rawAppointments]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('DAY');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Supervisor filter: If role is NOT MEDICO, allow selecting 'ALL' or a specific doctor
  // If role IS MEDICO, strict restriction to currentDoctorId!
  const [supervisorDoctorFilter, setSupervisorDoctorFilter] = useState<string>('ALL');

  // Mini-calendar month view offset (0 = current month of selectedDate)
  const [miniCalDate, setMiniCalDate] = useState<Date>(() => safeParseDate(todayStr));

  // Determine effective doctor filter based on RBAC rules
  const isDoctorRole = currentUserRole === 'MEDICO';
  const effectiveDoctorId = isDoctorRole ? currentDoctorId : supervisorDoctorFilter;

  // Dynamic doctors state
  const [allDoctors, setAllDoctors] = useState<Doctor[]>(INITIAL_DOCTORS);

  // Load doctors from IndexedDB
  const loadDoctors = async () => {
    try {
      const docs = await dbService.getAllDoctors();
      if (docs && docs.length > 0) {
        setAllDoctors(docs);
      }
    } catch (e) {
      console.warn('Error loading dynamic doctors in calendar:', e);
    }
  };

  useEffect(() => {
    loadDoctors();
    const handleDBChange = () => loadDoctors();
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, []);

  // Merge IndexedDB doctors with any doctor found in current appointments
  const allDynamicDoctors = useMemo(() => {
    const docMap = new Map<string, Doctor>();

    // 1. Initial & IndexedDB doctors
    allDoctors.forEach((d) => {
      if (d) {
        const key = d.id || d.nombre || d.name || '';
        if (key) docMap.set(key, d);
      }
    });

    // 2. Extract from appointments if not present
    appointments.forEach((a) => {
      const docId = a.doctorId || a.medicoId;
      const docName = a.doctorName || a.medicoNombre;
      const docSpec = (a.specialty || a.especialidad || 'Medicina General') as Specialty;
      if (docId && !docMap.has(docId)) {
        docMap.set(docId, {
          id: docId,
          nombre: docName || docId,
          name: docName || docId,
          especialidad: docSpec,
          specialty: docSpec,
          horarioAtencion: '08:00 - 14:00',
          schedule: '08:00 - 14:00',
          consultorio: 'Consultorio',
          room: 'Consultorio',
          telefono: '',
          phone: '',
          email: '',
          estado: 'ACTIVO',
          active: true,
        });
      }
    });

    return Array.from(docMap.values());
  }, [allDoctors, appointments]);

  // Information of the active doctor
  const activeDoctor = useMemo(() => {
    return (
      allDynamicDoctors.find((d) => d.id === currentDoctorId || d.nombre === currentDoctorId || d.name === currentDoctorId) ||
      allDynamicDoctors[0] ||
      INITIAL_DOCTORS[0]
    );
  }, [allDynamicDoctors, currentDoctorId]);

  // Selected doctor object in supervisor mode
  const selectedSupervisorDoc = useMemo(() => {
    if (effectiveDoctorId === 'ALL') return null;
    return (
      allDynamicDoctors.find((d) => d.id === effectiveDoctorId || d.nombre === effectiveDoctorId || d.name === effectiveDoctorId) ||
      null
    );
  }, [allDynamicDoctors, effectiveDoctorId]);

  // --- Strict Filtering based on RBAC & Parameters ---
  const accessibleAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      // 1. RBAC SECURITY RESTRICTION:
      // If role is MEDICO, strictly show only appointments belonging to this doctor!
      if (isDoctorRole) {
        const apptDocId = appt.doctorId || appt.medicoId;
        const apptDocName = appt.doctorName || appt.medicoNombre;
        if (apptDocId !== currentDoctorId && apptDocName !== currentDoctorId) {
          return false;
        }
      } else {
        // If role is Analista, Jefe, or Admin, apply supervisor filter if chosen
        if (supervisorDoctorFilter !== 'ALL') {
          const apptDocId = appt.doctorId || appt.medicoId;
          const apptDocName = appt.doctorName || appt.medicoNombre;
          if (apptDocId !== supervisorDoctorFilter && apptDocName !== supervisorDoctorFilter) {
            return false;
          }
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL' && appt.status !== statusFilter) {
        return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          (appt.patientName && appt.patientName.toLowerCase().includes(term)) ||
          (appt.paciente && appt.paciente.toLowerCase().includes(term)) ||
          (appt.patientDni && appt.patientDni.includes(term)) ||
          (appt.cedula && appt.cedula.includes(term)) ||
          (appt.doctorName && appt.doctorName.toLowerCase().includes(term)) ||
          (appt.medicoNombre && appt.medicoNombre.toLowerCase().includes(term)) ||
          (appt.expedienteNumber && appt.expedienteNumber.toLowerCase().includes(term)) ||
          (appt.notes && appt.notes.toLowerCase().includes(term)) ||
          (appt.specialty && appt.specialty.toLowerCase().includes(term));
        if (!matches) return false;
      }

      return true;
    });
  }, [appointments, isDoctorRole, currentDoctorId, supervisorDoctorFilter, statusFilter, searchTerm]);

  // Appointments grouped by date for fast lookup & mini calendar dot hints
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    accessibleAppointments.forEach((a) => {
      const d = sanitizeDateString(a.date || a.fecha);
      if (d) {
        if (!map[d]) map[d] = [];
        map[d].push(a);
      }
    });
    return map;
  }, [accessibleAppointments]);

  // Appointments for the selected day
  const dayAppointments = useMemo(() => {
    const validKey = safeFormatISO(selectedDate);
    const list = appointmentsByDate[validKey] || [];
    return [...list].sort((a, b) => {
      const timeA = a.time || a.hora || '00:00';
      const timeB = b.time || b.hora || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [appointmentsByDate, selectedDate]);

  // Calculate Week Days (Monday to Sunday) around selectedDate
  const weekDays = useMemo(() => {
    const curr = safeParseDate(selectedDate);
    // In JS, Sunday is 0. Make Monday 0:
    const dayOfWeek = (curr.getDay() + 6) % 7;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const days: { dateStr: string; dayName: string; dayNum: number; isToday: boolean; isSelected: boolean }[] = [];
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = safeFormatISO(d);
      days.push({
        dateStr,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }
    return days;
  }, [selectedDate, todayStr]);

  // Calculate Month Grid (Weeks and Days for current month of selectedDate)
  const monthGrid = useMemo(() => {
    const dObj = safeParseDate(selectedDate);
    const year = dObj.getFullYear();
    const month = dObj.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based first day offset
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDays = lastDayOfMonth.getDate();

    const calendarCells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      appointments: Appointment[];
    }[] = [];

    // Previous month filler days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = safeFormatISO(d);
      calendarCells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        appointments: appointmentsByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dateStr = safeFormatISO(d);
      calendarCells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        appointments: appointmentsByDate[dateStr] || [],
      });
    }

    // Next month filler days (fill up to 35 or 42 cells)
    const remaining = 35 - calendarCells.length;
    const needed = remaining < 0 ? 42 - calendarCells.length : remaining;
    for (let day = 1; day <= needed; day++) {
      const d = new Date(year, month + 1, day);
      const dateStr = safeFormatISO(d);
      calendarCells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        appointments: appointmentsByDate[dateStr] || [],
      });
    }

    return calendarCells;
  }, [selectedDate, todayStr, appointmentsByDate]);

  // Mini Calendar matrix generator
  const miniCalendarCells = useMemo(() => {
    const safeMini = safeParseDate(miniCalDate);
    const year = safeMini.getFullYear();
    const month = safeMini.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();

    const cells: { dateStr: string; dayNum: number; inMonth: boolean; hasAppts: boolean; isSelected: boolean; isToday: boolean }[] = [];

    // Prev month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const d = new Date(year, month - 1, day);
      const dateStr = safeFormatISO(d);
      cells.push({
        dateStr,
        dayNum: day,
        inMonth: false,
        hasAppts: !!appointmentsByDate[dateStr]?.length,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    // Current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = safeFormatISO(d);
      cells.push({
        dateStr,
        dayNum: day,
        inMonth: true,
        hasAppts: !!appointmentsByDate[dateStr]?.length,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    // Next month
    const total = 42;
    const remaining = total - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const dateStr = safeFormatISO(d);
      cells.push({
        dateStr,
        dayNum: day,
        inMonth: false,
        hasAppts: !!appointmentsByDate[dateStr]?.length,
        isSelected: dateStr === selectedDate,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [miniCalDate, appointmentsByDate, selectedDate, todayStr]);

  // Date Navigation Helpers
  const handlePrev = () => {
    const d = safeParseDate(selectedDate);
    if (viewMode === 'DAY') {
      d.setDate(d.getDate() - 1);
    } else if (viewMode === 'WEEK') {
      d.setDate(d.getDate() - 7);
    } else if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    const newStr = safeFormatISO(d);
    setSelectedDate(newStr);
    setMiniCalDate(safeParseDate(newStr));
  };

  const handleNext = () => {
    const d = safeParseDate(selectedDate);
    if (viewMode === 'DAY') {
      d.setDate(d.getDate() + 1);
    } else if (viewMode === 'WEEK') {
      d.setDate(d.getDate() + 7);
    } else if (viewMode === 'MONTH') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    const newStr = safeFormatISO(d);
    setSelectedDate(newStr);
    setMiniCalDate(safeParseDate(newStr));
  };

  const handleToday = () => {
    setSelectedDate(todayStr);
    setMiniCalDate(safeParseDate(todayStr));
  };

  // Google Calendar formatted header label
  const headerDateLabel = useMemo(() => {
    const d = safeParseDate(selectedDate);
    const monthName = safeGetMonthName(d, 'long');
    const capitalizedMonth = monthName ? monthName.charAt(0).toUpperCase() + monthName.slice(1) : '';
    const year = d.getFullYear();

    if (viewMode === 'DAY') {
      const weekday = safeGetWeekdayName(d, 'long');
      const capWeekday = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';
      return `${capWeekday}, ${d.getDate()} de ${monthName} de ${year}`;
    }

    if (viewMode === 'WEEK') {
      const first = weekDays[0] || { dayNum: 1 };
      const last = weekDays[6] || { dayNum: 28 };
      return `${first.dayNum} – ${last.dayNum} de ${capitalizedMonth} de ${year}`;
    }

    return `${capitalizedMonth} de ${year}`;
  }, [selectedDate, viewMode, weekDays]);

  // Turn KPIs
  const kpis = useMemo(() => {
    const total = dayAppointments.length;
    const inWaiting = dayAppointments.filter((a) => a.status === 'IN_WAITING_ROOM').length;
    const inConsult = dayAppointments.filter((a) => a.status === 'IN_CONSULTATION').length;
    const completed = dayAppointments.filter((a) => a.status === 'COMPLETED').length;
    const confirmed = dayAppointments.filter((a) => a.status === 'CONFIRMED').length;
    const noShow = dayAppointments.filter((a) => a.status === 'NO_SHOW' || a.status === 'CANCELLED').length;
    return { total, inWaiting, inConsult, completed, confirmed, noShow };
  }, [dayAppointments]);

  // Status Styling Badge
  const getStatusChip = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full inline-flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> Confirmada
          </span>
        );
      case 'IN_WAITING_ROOM':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 rounded-full inline-flex items-center gap-1 animate-pulse">
            <Clock className="w-2.5 h-2.5 text-blue-600" /> En Espera
          </span>
        );
      case 'IN_CONSULTATION':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 rounded-full inline-flex items-center gap-1 shadow-sm">
            <Activity className="w-2.5 h-2.5 text-purple-600 animate-spin" /> En Consulta
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-full inline-flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-slate-500" /> Atendido
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 rounded-full inline-flex items-center gap-1">
            <X className="w-2.5 h-2.5 text-rose-600" /> Cancelada
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-300 rounded-full inline-flex items-center gap-1">
            No Asistió
          </span>
        );
      case 'CONFLICT_PENDING':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full inline-flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5 text-amber-600" /> Conflicto
          </span>
        );
    }
  };

  // Helper for Doctor Card Color
  const getDocColor = (docId: string) => {
    return DOCTOR_COLORS[docId] || DEFAULT_DOCTOR_COLOR;
  };

  return (
    <div className="space-y-4 font-sans text-slate-800">
      
      {/* ========================================================================= */}
      {/* 1. RBAC SECURITY & CONFIDENTIALITY BANNER */}
      {/* ========================================================================= */}
      {isDoctorRole ? (
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white rounded-2xl p-4 shadow-md border border-teal-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-teal-500 text-slate-950 p-2.5 rounded-xl shadow-inner font-black flex items-center justify-center">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-teal-400" />
                  Agenda Privada: {activeDoctor.nombre || activeDoctor.name}
                </span>
                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-400/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  {activeDoctor.especialidad || activeDoctor.specialty}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  {activeDoctor.consultorio || activeDoctor.room}
                </span>
              </div>
              <p className="text-xs text-teal-200/90 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                <span>Restricción estricta de confidencialidad: Solo puede consultar sus propios pacientes asignados.</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <div className="text-left">
              <div className="text-[10px] text-slate-400 font-semibold">Sesión Médica Activa</div>
              <div className="text-xs text-teal-300 font-bold font-mono">{activeDoctor.nombre || activeDoctor.name}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 text-white rounded-2xl p-4 shadow-md border border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 text-white p-2.5 rounded-xl shadow-inner font-black">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  Agenda Médica General (Vista Supervisor: Rol {currentUserRole})
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 px-2 py-0.5 rounded-full font-mono font-semibold">
                  Acceso Total a Especialistas
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Puede consultar y coordinar las agendas y turnos de todos los médicos del Centro de Salud.
              </p>
            </div>
          </div>

          {/* Supervisor Doctor Filter */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 p-1.5 rounded-xl text-xs w-full sm:w-auto">
            <span className="text-slate-400 font-semibold px-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-400" /> Filtrar Médico:
            </span>
            <select
              value={supervisorDoctorFilter}
              onChange={(e) => setSupervisorDoctorFilter(e.target.value)}
              className="bg-slate-900 text-indigo-300 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">👥 Todos los Médicos ({allDynamicDoctors.length})</option>
              {allDynamicDoctors.map((doc) => (
                <option key={doc.id || doc.nombre} value={doc.id}>
                  🩺 {doc.nombre || doc.name} — {doc.especialidad || doc.specialty}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GOOGLE CALENDAR MAIN APPLICATION FRAME */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        
        {/* Google Calendar Top Control Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          
          {/* Left: Google Calendar Brand Icon, Today Button, Navigation Chevrons, Date Label */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Google Calendar Style Logo */}
            <div className="flex items-center gap-1.5 mr-1 sm:mr-2">
              <div className="w-8 h-8 rounded-lg bg-teal-600 flex flex-col items-center justify-center text-white shadow-sm font-bold">
                <span className="text-[8px] uppercase tracking-tighter leading-none text-teal-200">
                  {safeGetMonthName(selectedDate, 'short').slice(0, 3)}
                </span>
                <span className="text-xs font-extrabold leading-none">
                  {safeGetDayNum(selectedDate)}
                </span>
              </div>
              <span className="font-extrabold text-slate-800 text-sm hidden md:inline tracking-tight">
                Agenda Médica
              </span>
            </div>

            {/* "Hoy" Button (Google Calendar Style) */}
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition shadow-xs active:scale-95"
            >
              Hoy
            </button>

            {/* Navigation Chevrons */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-xs">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-l-lg transition"
                title="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-r-lg transition"
                title="Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Big Date Header */}
            <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight min-w-[180px]">
              {headerDateLabel}
            </h3>
          </div>

          {/* Right: Search, Status Filter, and Google Calendar View Switcher (Día, Semana, Mes, Agenda) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar paciente, CI, HC..."
                className="pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 w-36 sm:w-48 bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* View Mode Toggle Switcher (Google Calendar Style) */}
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300 text-xs font-bold shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('DAY')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'DAY'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Día (Línea de tiempo por horas)"
              >
                Día
              </button>
              <button
                type="button"
                onClick={() => setViewMode('WEEK')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'WEEK'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Semana (7 días con bloques horarios)"
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MONTH')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'MONTH'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Mes (Calendario mensual con eventos)"
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => setViewMode('AGENDA')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  viewMode === 'AGENDA'
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Agenda (Lista cronológica de turnos)"
              >
                Agenda
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CALENDAR BODY: SIDEBAR + MAIN GRID */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
          
          {/* LEFT SIDEBAR: Mini Calendar + Turn Counters + Status Legend */}
          <div className="lg:col-span-3 border-r border-slate-200 p-4 bg-slate-50/50 space-y-5">
            
            {/* MINI CALENDAR (Google Calendar Style) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 capitalize">
                  {safeFormatLocaleDate(miniCalDate, { month: 'long', year: 'numeric' })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const d = safeParseDate(miniCalDate);
                      d.setMonth(d.getMonth() - 1);
                      setMiniCalDate(d);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Mes Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = safeParseDate(miniCalDate);
                      d.setMonth(d.getMonth() + 1);
                      setMiniCalDate(d);
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Mes Siguiente"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 mb-1">
                <span>L</span>
                <span>M</span>
                <span>M</span>
                <span>J</span>
                <span>V</span>
                <span>S</span>
                <span>D</span>
              </div>

              {/* Mini Calendar Cells */}
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {miniCalendarCells.map((cell, idx) => {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                      }}
                      className={`relative h-6 w-6 mx-auto rounded-full flex flex-col items-center justify-center text-[11px] font-medium transition ${
                        cell.isSelected
                          ? 'bg-teal-600 text-white font-bold shadow-xs'
                          : cell.isToday
                          ? 'bg-teal-100 text-teal-800 font-bold border border-teal-400'
                          : cell.inMonth
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cell.dayNum}</span>
                      {cell.hasAppts && !cell.isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-teal-500"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TURN / CLINICAL STATUS KPI SUMMARY FOR SELECTED DATE */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Resumen del Turno ({selectedDate})</span>
                <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  {kpis.total} Citas
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  onClick={() => setStatusFilter(statusFilter === 'IN_WAITING_ROOM' ? 'ALL' : 'IN_WAITING_ROOM')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    statusFilter === 'IN_WAITING_ROOM'
                      ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-300'
                      : 'bg-blue-50/70 border-blue-200 hover:bg-blue-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-blue-800 font-semibold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-blue-600" /> En Espera
                    </span>
                    <span className="font-bold font-mono">{kpis.inWaiting}</span>
                  </div>
                </div>

                <div
                  onClick={() => setStatusFilter(statusFilter === 'IN_CONSULTATION' ? 'ALL' : 'IN_CONSULTATION')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    statusFilter === 'IN_CONSULTATION'
                      ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-300'
                      : 'bg-purple-50/70 border-purple-200 hover:bg-purple-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-purple-800 font-semibold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Activity className="w-3 h-3 text-purple-600 animate-spin" /> En Consulta
                    </span>
                    <span className="font-bold font-mono">{kpis.inConsult}</span>
                  </div>
                </div>

                <div
                  onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    statusFilter === 'COMPLETED'
                      ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300'
                      : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-emerald-800 font-semibold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Check className="w-3 h-3 text-emerald-600" /> Atendidos
                    </span>
                    <span className="font-bold font-mono">{kpis.completed}</span>
                  </div>
                </div>

                <div
                  onClick={() => setStatusFilter(statusFilter === 'CONFIRMED' ? 'ALL' : 'CONFIRMED')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    statusFilter === 'CONFIRMED'
                      ? 'bg-teal-100 border-teal-400 ring-2 ring-teal-300'
                      : 'bg-slate-100/80 border-slate-200 hover:bg-slate-200/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-slate-800 font-semibold">
                    <span className="flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" /> Próximas
                    </span>
                    <span className="font-bold font-mono">{kpis.confirmed}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DOCTOR DIRECTORY / MIS CALENDARIOS (Google Calendar Style) */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>{isDoctorRole ? 'Mi Consultorio' : 'Especialistas & Médicos'}</span>
                {!isDoctorRole && (
                  <span className="text-[10px] text-indigo-600 font-normal">Supervisión</span>
                )}
              </div>

              {isDoctorRole ? (
                // Doctor Solo Profile Card
                <div className="bg-white p-3 rounded-xl border border-teal-200 shadow-2xs space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-500"></div>
                    <span className="font-bold text-slate-800">{activeDoctor.nombre || activeDoctor.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 pl-4 space-y-0.5">
                    <div>🩺 {activeDoctor.especialidad || activeDoctor.specialty}</div>
                    <div>🚪 {activeDoctor.consultorio || activeDoctor.room}</div>
                    <div>⏰ Horario: {activeDoctor.horarioAtencion || activeDoctor.schedule}</div>
                  </div>
                </div>
              ) : (
                // Multi-Doctor Checkboxes / Selector for Supervisor Roles
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSupervisorDoctorFilter('ALL')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between transition ${
                      supervisorDoctorFilter === 'ALL'
                        ? 'bg-indigo-100 text-indigo-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                      Todos los Médicos
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {accessibleAppointments.length}
                    </span>
                  </button>

                  {allDynamicDoctors.map((doc) => {
                    const color = getDocColor(doc.id);
                    const isSel = supervisorDoctorFilter === doc.id;
                    const count = appointments.filter(
                      (a) =>
                        a.doctorId === doc.id ||
                        a.medicoId === doc.id ||
                        a.doctorName === doc.name ||
                        a.medicoNombre === doc.nombre
                    ).length;

                    return (
                      <button
                        key={doc.id || doc.nombre}
                        type="button"
                        onClick={() => setSupervisorDoctorFilter(doc.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                          isSel ? 'bg-slate-200 font-bold text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className={`w-2.5 h-2.5 rounded-full ${color.dot} flex-shrink-0`}></span>
                          <span className="truncate">{doc.nombre || doc.name}</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Status Filter Reset if Active */}
            {statusFilter !== 'ALL' && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="w-full py-1 text-xs text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold transition"
                >
                  ✕ Quitar filtro de estado
                </button>
              </div>
            )}
          </div>

          {/* ======================================================================= */}
          {/* MAIN CALENDAR CANVAS (DAY, WEEK, MONTH, AGENDA) */}
          {/* ======================================================================= */}
          <div className="lg:col-span-9 flex flex-col bg-white overflow-x-auto custom-scrollbar-x">
            
            {/* ------------------------------------------------------------------- */}
            {/* VIEW A: DAY VIEW (GOOGLE CALENDAR TIME-SLOT GRID) */}
            {/* ------------------------------------------------------------------- */}
            {viewMode === 'DAY' && (
              <div className="flex-1 flex flex-col overflow-x-auto custom-scrollbar-x">
                <div className="min-w-[360px] sm:min-w-full">
                  {/* Day Header */}
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {safeGetWeekdayName(selectedDate, 'long')}
                      </span>
                      <span className="text-sm font-extrabold text-teal-800">
                        {safeGetDayNum(selectedDate)} de{' '}
                        {safeGetMonthName(selectedDate, 'long')}
                      </span>
                      {selectedDate === todayStr && (
                        <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded-full font-bold">
                          HOY
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-semibold">
                      {dayAppointments.length} {dayAppointments.length === 1 ? 'paciente agendado' : 'pacientes agendados'}
                    </span>
                  </div>

                  {/* Day Time Slots Canvas */}
                  <div className="p-4 space-y-3 divide-y divide-slate-100">
                    {TIME_SLOTS.map((hour) => {
                      // Match appointments in this hour window (e.g. 08:00 matches 08:00 to 08:59)
                      const hourPrefix = hour.split(':')[0];
                      const slotAppts = dayAppointments.filter((a) => {
                        const time = a.time || a.hora || '00:00';
                        return time.startsWith(hourPrefix);
                      });

                      return (
                        <div key={hour} className="pt-3 first:pt-0 flex items-start gap-3 sm:gap-4 group">
                          {/* Time Label on Left */}
                          <div className="w-14 sm:w-16 flex-shrink-0 text-right text-xs font-mono font-bold text-slate-400 group-hover:text-teal-600 transition">
                            {hour}
                          </div>

                          {/* Slot Grid Line & Event Cards */}
                          <div className="flex-1 min-h-[44px] border-l-2 border-slate-200 pl-3 sm:pl-4 space-y-2 relative">
                            {/* Current time line if applicable */}
                            {selectedDate === todayStr &&
                              today.getHours().toString().padStart(2, '0') === hourPrefix && (
                                <div className="absolute -left-1.5 top-2 flex items-center z-10">
                                  <span className="w-3 h-3 rounded-full bg-rose-500 ring-2 ring-white"></span>
                                  <span className="h-[2px] w-full bg-rose-500 ml-1"></span>
                                </div>
                              )}

                            {slotAppts.length === 0 ? (
                              <div className="text-[11px] text-slate-300 py-2 italic font-mono">
                                — Sin citas agendadas —
                              </div>
                            ) : (
                              slotAppts.map((appt) => {
                                const docColor = getDocColor(appt.doctorId || appt.medicoId);
                                const exp = appt.expedienteNumber || appt.numeroExpediente;

                                return (
                                  <div
                                    key={appt.id}
                                    className={`p-3.5 rounded-xl border transition-all shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                      appt.status === 'IN_CONSULTATION'
                                        ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-400'
                                        : appt.status === 'IN_WAITING_ROOM'
                                        ? 'bg-blue-50 border-blue-300'
                                        : appt.status === 'COMPLETED'
                                        ? 'bg-slate-50 border-slate-200 opacity-80'
                                        : 'bg-white border-slate-200 hover:border-teal-400'
                                    }`}
                                  >
                                    {/* Left Event Info */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2 py-0.5 rounded">
                                          {appt.time || appt.hora}
                                        </span>
                                        <span className="font-bold text-slate-900 text-sm">
                                          {appt.patientName || appt.paciente}
                                        </span>
                                        {getStatusChip(appt.status)}
                                      </div>

                                      <div className="flex items-center gap-2.5 text-xs text-slate-600 flex-wrap">
                                        <span className="font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                                          <IdCard className="w-3 h-3 text-slate-400" /> CI: {appt.patientDni || appt.cedula}
                                        </span>

                                        {exp && (
                                          <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1 text-[11px]">
                                            <Hash className="w-3 h-3 text-teal-600" /> HC: {exp}
                                          </span>
                                        )}

                                        {!isDoctorRole && (
                                          <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                                            <span className={`w-2 h-2 rounded-full ${docColor.dot}`}></span>
                                            {appt.doctorName || appt.medicoNombre}
                                          </span>
                                        )}

                                        <span className="text-slate-500 text-[11px]">
                                          🩺 {appt.specialty || appt.especialidad}
                                        </span>
                                      </div>

                                      {(appt.notes || appt.motivoConsulta || (appt as any).motivo) && (
                                        <div className="text-xs text-slate-600 bg-slate-100/70 px-2.5 py-1 rounded-lg max-w-xl">
                                          <span className="font-semibold text-slate-700">Motivo:</span> {appt.notes || appt.motivoConsulta || (appt as any).motivo}
                                        </div>
                                      )}
                                    </div>

                                    {/* Right Clinical Actions */}
                                    <div className="flex items-center gap-1.5 flex-wrap self-end md:self-center">
                                      {/* Action: Llamar a Consulta */}
                                      {appt.status !== 'IN_CONSULTATION' && appt.status !== 'COMPLETED' && (
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStatus(appt.id, 'IN_CONSULTATION')}
                                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                                          title="Llamar paciente a consulta médica"
                                        >
                                          <Play className="w-3 h-3 fill-current" />
                                          <span>Llamar a Consulta</span>
                                        </button>
                                      )}

                                      {/* Action: Finalizar Consulta */}
                                      {appt.status === 'IN_CONSULTATION' && (
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStatus(appt.id, 'COMPLETED')}
                                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 animate-pulse"
                                          title="Finalizar atención médica"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Finalizar Atención</span>
                                        </button>
                                      )}

                                      {/* Action: Sala de Espera */}
                                      {appt.status === 'CONFIRMED' && (
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStatus(appt.id, 'IN_WAITING_ROOM')}
                                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-xs rounded-xl transition"
                                          title="Marcar en sala de espera"
                                        >
                                          <Clock className="w-3 h-3" />
                                          <span>Sala Espera</span>
                                        </button>
                                      )}

                                      {/* Ver Ficha y Anotaciones Clínicas */}
                                      <button
                                        type="button"
                                        onClick={() => onSelectAppointmentForModal(appt)}
                                        className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-xs active:scale-95"
                                        title="Hacer anotaciones médicas (IDx, Tratamiento, Notas) y ver historial"
                                      >
                                        <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                        <span>IDx / Anotación</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => onSelectAppointmentForModal(appt)}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1 transition"
                                        title="Ver Ficha y Datos Completos"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Ficha</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* VIEW B: WEEK VIEW (GOOGLE CALENDAR 7-DAY MATRIX) */}
            {/* ------------------------------------------------------------------- */}
            {viewMode === 'WEEK' && (
              <div className="flex-1 flex flex-col overflow-x-auto custom-scrollbar-x">
                <div className="min-w-[750px]">
                  {/* 7-Day Header */}
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center divide-x divide-slate-200">
                    {weekDays.map((wd) => (
                      <button
                        key={wd.dateStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(wd.dateStr);
                          setViewMode('DAY');
                        }}
                        className={`p-2.5 transition flex flex-col items-center hover:bg-slate-100 ${
                          wd.isSelected
                            ? 'bg-teal-50 text-teal-900 font-bold'
                            : wd.isToday
                            ? 'text-teal-700 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase text-slate-400">{wd.dayName}</span>
                        <span
                          className={`text-sm font-extrabold w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                            wd.isToday
                              ? 'bg-teal-600 text-white shadow-xs'
                              : wd.isSelected
                              ? 'bg-teal-200 text-teal-950'
                              : ''
                          }`}
                        >
                          {wd.dayNum}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {appointmentsByDate[wd.dateStr]?.length || 0} citas
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* 7-Day Week Columns with Appointments */}
                  <div className="grid grid-cols-7 divide-x divide-slate-200 min-h-[500px] p-2 bg-slate-50/30 gap-1">
                    {weekDays.map((wd) => {
                      const list = appointmentsByDate[wd.dateStr] || [];
                      const sorted = [...list].sort((a, b) => (a.time || a.hora || '').localeCompare(b.time || b.hora || ''));

                      return (
                        <div key={wd.dateStr} className="space-y-1.5 p-1 min-h-[400px]">
                          {sorted.length === 0 ? (
                            <div className="text-center text-[10px] text-slate-300 py-8 italic">
                              Sin citas
                            </div>
                          ) : (
                            sorted.map((appt) => {
                              const exp = appt.expedienteNumber || appt.numeroExpediente;
                              return (
                                <div
                                  key={appt.id}
                                  onClick={() => onSelectAppointmentForModal(appt)}
                                  className={`p-2 rounded-xl border text-left cursor-pointer transition hover:shadow-md hover:scale-[1.02] ${
                                    appt.status === 'IN_CONSULTATION'
                                      ? 'bg-purple-50 border-purple-300 text-purple-950'
                                      : appt.status === 'IN_WAITING_ROOM'
                                      ? 'bg-blue-50 border-blue-300 text-blue-950'
                                      : appt.status === 'COMPLETED'
                                      ? 'bg-slate-100 border-slate-200 text-slate-600'
                                      : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-teal-700">
                                    <span>{appt.time || appt.hora}</span>
                                    {appt.status === 'IN_WAITING_ROOM' && (
                                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                                    )}
                                  </div>
                                  <div className="font-bold text-xs truncate mt-0.5">
                                    {appt.patientName || appt.paciente}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    CI: {appt.patientDni || appt.cedula}
                                  </div>
                                  {exp && (
                                    <div className="text-[9px] font-mono text-teal-800 bg-teal-50/80 px-1 rounded w-fit mt-0.5">
                                      HC: {exp}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* VIEW C: MONTH VIEW (GOOGLE CALENDAR 35-CELL MONTH GRID) */}
            {/* ------------------------------------------------------------------- */}
            {viewMode === 'MONTH' && (
              <div className="flex-1 flex flex-col overflow-x-auto custom-scrollbar-x">
                <div className="min-w-[750px]">
                  {/* Month Day Names */}
                  <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center font-bold text-xs text-slate-500 py-2">
                    <span>LUNES</span>
                    <span>MARTES</span>
                    <span>MIÉRCOLES</span>
                    <span>JUEVES</span>
                    <span>VIERNES</span>
                    <span>SÁBADO</span>
                    <span>DOMINGO</span>
                  </div>

                  {/* 35/42 Grid */}
                  <div className="grid grid-cols-7 grid-rows-5 sm:grid-rows-6 divide-x divide-y divide-slate-200 min-h-[550px] bg-slate-100/50">
                    {monthGrid.map((cell, idx) => {
                      const hasAppts = cell.appointments.length > 0;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedDate(cell.dateStr);
                            setViewMode('DAY');
                          }}
                          className={`p-1.5 min-h-[90px] transition cursor-pointer hover:bg-teal-50/40 flex flex-col justify-between ${
                            cell.isSelected
                              ? 'bg-teal-50/80 ring-2 ring-teal-500'
                              : cell.isCurrentMonth
                              ? 'bg-white'
                              : 'bg-slate-50/60 text-slate-400'
                          }`}
                        >
                          {/* Day Number Header */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                                cell.isToday
                                  ? 'bg-teal-600 text-white font-extrabold shadow-xs'
                                  : cell.isCurrentMonth
                                  ? 'text-slate-800'
                                  : 'text-slate-400'
                              }`}
                            >
                              {cell.dayNum}
                            </span>
                            {hasAppts && (
                              <span className="text-[10px] font-mono font-bold bg-teal-100 text-teal-800 px-1.5 rounded-full">
                                {cell.appointments.length}
                              </span>
                            )}
                          </div>

                          {/* Event Chips (Google Calendar Style) */}
                          <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                            {cell.appointments.slice(0, 2).map((a) => (
                              <div
                                key={a.id}
                                className="text-[10px] font-medium truncate px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-900 flex items-center gap-1"
                              >
                                <span className="font-mono font-bold text-[9px]">{a.time || a.hora}</span>
                                <span className="truncate">{a.patientName || a.paciente}</span>
                              </div>
                            ))}

                            {cell.appointments.length > 2 && (
                              <div className="text-[9px] font-bold text-slate-500 pl-1">
                                +{cell.appointments.length - 2} más...
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* VIEW D: AGENDA / SCHEDULE LIST VIEW */}
            {/* ------------------------------------------------------------------- */}
            {viewMode === 'AGENDA' && (
              <div className="flex-1 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-teal-600" />
                    Lista de Programación y Turnos ({accessibleAppointments.length} citas registradas)
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">Orden cronológico</span>
                </div>

                {accessibleAppointments.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <CalendarIcon className="w-10 h-10 mx-auto text-teal-600 opacity-40" />
                    <p className="font-semibold text-slate-600 text-sm">No se encontraron citas agendadas.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group by Date */}
                    {Object.keys(appointmentsByDate)
                      .sort()
                      .map((dateKey) => {
                        const list = appointmentsByDate[dateKey];
                        const isDateToday = dateKey === todayStr;

                        return (
                          <div key={dateKey} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                            {/* Date Group Header */}
                            <div
                              className={`px-4 py-2.5 font-bold text-xs flex items-center justify-between ${
                                isDateToday ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span>📅 {safeFormatLocaleDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                {isDateToday && (
                                  <span className="bg-white text-teal-800 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                                    HOY
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs">{list.length} citas</span>
                            </div>

                            {/* Appointments under this date */}
                            <div className="divide-y divide-slate-100 bg-white">
                              {list.map((appt) => {
                                const exp = appt.expedienteNumber || appt.numeroExpediente;
                                return (
                                  <div
                                    key={appt.id}
                                    className="p-3.5 hover:bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="font-mono font-bold text-xs bg-slate-900 text-teal-300 px-2 py-1 rounded-lg">
                                        {appt.time || appt.hora}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-slate-900 text-sm">
                                            {appt.patientName || appt.paciente}
                                          </span>
                                          {getStatusChip(appt.status)}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap mt-0.5">
                                          <span>CI: {appt.patientDni || appt.cedula}</span>
                                          {exp && <span className="font-mono font-bold text-teal-700">HC: {exp}</span>}
                                          <span>• {appt.doctorName || appt.medicoNombre}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end md:self-center">
                                      {appt.status !== 'IN_CONSULTATION' && appt.status !== 'COMPLETED' && (
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStatus(appt.id, 'IN_CONSULTATION')}
                                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg flex items-center gap-1"
                                        >
                                          <Play className="w-3 h-3 fill-current" /> Llamar
                                        </button>
                                      )}
                                      {appt.status === 'IN_CONSULTATION' && (
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStatus(appt.id, 'COMPLETED')}
                                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1"
                                        >
                                          <Check className="w-3 h-3" /> Finalizar
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => onSelectAppointmentForModal(appt)}
                                        className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 font-bold text-xs rounded-lg flex items-center gap-1 transition"
                                        title="Hacer anotaciones médicas (IDx, Tratamiento, Notas) y ver historial"
                                      >
                                        <Stethoscope className="w-3 h-3 text-teal-600" />
                                        <span>IDx</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => onSelectAppointmentForModal(appt)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" /> Ficha
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

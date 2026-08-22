import React, { useState, useMemo } from 'react';
import { Appointment, AppointmentStatus } from '../types';
import { normalizeAppointmentEntity, sanitizeDateString } from '../services/indexedDB';
import { safeFormatISO, safeParseDate } from '../utils/dateUtils';
import {
  BarChart3,
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  TrendingDown,
  Clock,
  Activity,
  Filter,
  Download,
  Stethoscope,
  RotateCcw,
  CalendarRange,
  FileSpreadsheet,
  Search,
  X,
  ChevronRight,
  IdCard,
  Hash,
  Eye,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface StatsModuleProps {
  appointments: Appointment[];
}

type DatePreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

interface DetailModalConfig {
  type: 'SUMMARY_CARD' | 'DOCTOR' | 'SPECIALTY';
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeColor: string;
  filteredAppts: Appointment[];
}

export const StatsModule: React.FC<StatsModuleProps> = ({ appointments: rawAppointments }) => {
  const appointments = useMemo(() => {
    return (rawAppointments || []).map(normalizeAppointmentEntity);
  }, [rawAppointments]);

  const [datePreset, setDatePreset] = useState<DatePreset>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modal State for Detail Breakdown
  const [detailModal, setDetailModal] = useState<DetailModalConfig | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Helper date generators
  const todayStr = useMemo(() => safeFormatISO(new Date()), []);

  // Set preset ranges
  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'WEEK') {
      // Current week (Monday to Sunday)
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      setStartDate(safeFormatISO(monday));
      setEndDate(safeFormatISO(sunday));
    } else if (preset === 'MONTH') {
      // Current month
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      setStartDate(safeFormatISO(firstDay));
      setEndDate(safeFormatISO(lastDay));
    }
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    setDatePreset('CUSTOM');
    const sanitizedVal = val ? safeFormatISO(val) : '';
    if (type === 'start') {
      setStartDate(sanitizedVal);
    } else {
      setEndDate(sanitizedVal);
    }
  };

  const clearFilter = () => {
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
  };

  // Filter appointments based on range
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const apptDate = sanitizeDateString(appt.date || appt.fecha);
      if (!apptDate) return true;

      // If no start and no end date specified
      if (!startDate && !endDate) return true;

      if (startDate && endDate) {
        return apptDate >= startDate && apptDate <= endDate;
      }
      if (startDate) {
        return apptDate >= startDate;
      }
      if (endDate) {
        return apptDate <= endDate;
      }
      return true;
    });
  }, [appointments, startDate, endDate]);

  const total = filteredAppointments.length;
  const atendidas = filteredAppointments.filter(
    (a) => (a.status || a.estado) === 'COMPLETED'
  ).length;
  const canceladas = filteredAppointments.filter(
    (a) =>
      (a.status || a.estado) === 'CANCELLED' ||
      (a.status || a.estado) === 'NO_SHOW'
  ).length;
  const pendientes = filteredAppointments.filter(
    (a) =>
      (a.status || a.estado) === 'CONFIRMED' ||
      (a.status || a.estado) === 'IN_WAITING_ROOM' ||
      (a.status || a.estado) === 'IN_CONSULTATION'
  ).length;

  const tasaAusentismo = total > 0 ? ((canceladas / total) * 100).toFixed(1) : '0.0';
  const tasaAtencion = total > 0 ? ((atendidas / total) * 100).toFixed(1) : '0.0';

  // Group by Doctor
  const doctorLoad: { [key: string]: { total: number; atendidas: number; canceladas: number; appts: Appointment[] } } = {};
  filteredAppointments.forEach((a) => {
    const docName = a.doctorName || a.medicoNombre || 'Médico no asignado';
    if (!doctorLoad[docName]) {
      doctorLoad[docName] = { total: 0, atendidas: 0, canceladas: 0, appts: [] };
    }
    doctorLoad[docName].total += 1;
    doctorLoad[docName].appts.push(a);
    const st = a.status || a.estado;
    if (st === 'COMPLETED') doctorLoad[docName].atendidas += 1;
    if (st === 'CANCELLED' || st === 'NO_SHOW') doctorLoad[docName].canceladas += 1;
  });

  // Group by Specialty
  const specLoad: { [key: string]: { count: number; appts: Appointment[] } } = {};
  filteredAppointments.forEach((a) => {
    const spec = a.specialty || a.especialidad || 'General';
    if (!specLoad[spec]) {
      specLoad[spec] = { count: 0, appts: [] };
    }
    specLoad[spec].count += 1;
    specLoad[spec].appts.push(a);
  });

  // Export General Summary to CSV
  const exportStatsCSV = () => {
    const rows = [
      ['METRICA', 'VALOR'],
      ['Rango Filtrado', `${startDate || 'Inicio'} a ${endDate || 'Hoy'}`],
      ['Total Citas', total],
      ['Atendidas (Efectivas)', atendidas],
      ['Canceladas / Ausentes', canceladas],
      ['Confirmadas / Pendientes', pendientes],
      ['Tasa de Ausentismo', `${tasaAusentismo}%`],
      ['Tasa de Atencion', `${tasaAtencion}%`],
      [''],
      ['CARGA POR MEDICO', 'TOTAL CITAS', 'ATENDIDAS', 'CANCELADAS'],
      ...Object.entries(doctorLoad).map(([doc, s]) => [doc, s.total, s.atendidas, s.canceladas]),
      [''],
      ['DEMANDA POR ESPECIALIDAD', 'TOTAL CITAS'],
      ...Object.entries(specLoad).map(([sp, s]) => [sp, s.count]),
    ];

    downloadCSV(rows, `resumen_estadistico_${startDate || 'inicio'}_${endDate || 'actual'}.csv`);
  };

  // Export Modal Details to CSV
  const exportModalCSV = (config: DetailModalConfig) => {
    const header = [
      'FECHA',
      'HORA',
      'CEDULA_PACIENTE',
      'NOMBRE_PACIENTE',
      'NUMERO_EXPEDIENTE',
      'ESPECIALIDAD',
      'MEDICO',
      'ESTADO',
      'ANTECEDENTES_PACIENTE',
      'MOTIVO_CONSULTA',
    ];

    const dataRows = config.filteredAppts.map((a) => [
      a.date || a.fecha || '',
      a.time || a.hora || '',
      a.patientDni || a.cedula || '',
      `"${(a.patientName || a.paciente || '').replace(/"/g, '""')}"`,
      a.expedienteNumber || a.numeroExpediente || '',
      `"${(a.specialty || a.especialidad || '').replace(/"/g, '""')}"`,
      `"${(a.doctorName || a.medicoNombre || '').replace(/"/g, '""')}"`,
      a.status || a.estado || '',
      `"${(a.patientMedicalHistory || '').replace(/"/g, '""')}"`,
      `"${(a.notes || a.motivoConsulta || '').replace(/"/g, '""')}"`,
    ]);

    const rows = [header, ...dataRows];
    const safeTitle = config.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadCSV(rows, `detalle_${safeTitle}_${startDate || 'inicio'}_${endDate || 'actual'}.csv`);
  };

  const downloadCSV = (rows: (string | number)[][], filename: string) => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Modal Helpers
  const openSummaryModal = (
    type: 'TOTAL' | 'ATENDIDAS' | 'CANCELADAS' | 'PENDIENTES' | 'AUSENTISMO'
  ) => {
    setModalSearchTerm('');
    let appts: Appointment[] = [];
    let title = '';
    let subtitle = '';
    let badgeLabel = '';
    let badgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';

    if (type === 'TOTAL') {
      appts = filteredAppointments;
      title = 'Detalle de Todas las Citas Registradas';
      subtitle = 'Desglose completo de todas las consultas en el periodo seleccionado';
      badgeLabel = `${appts.length} Citas Totales`;
      badgeColor = 'bg-slate-100 text-slate-800 border-slate-300';
    } else if (type === 'ATENDIDAS') {
      appts = filteredAppointments.filter((a) => (a.status || a.estado) === 'COMPLETED');
      title = 'Detalle de Citas Atendidas (Efectivas)';
      subtitle = 'Pacientes que asistieron y completaron satisfactoriamente su consulta médica';
      badgeLabel = `${appts.length} Pacientes Atendidos (${tasaAtencion}%)`;
      badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    } else if (type === 'CANCELADAS' || type === 'AUSENTISMO') {
      appts = filteredAppointments.filter(
        (a) => (a.status || a.estado) === 'CANCELLED' || (a.status || a.estado) === 'NO_SHOW'
      );
      title = 'Detalle de Citas Canceladas y Ausencias';
      subtitle = 'Registro de consultas no concretadas o canceladas por el paciente/médico';
      badgeLabel = `${appts.length} Canceladas (${tasaAusentismo}%)`;
      badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
    } else if (type === 'PENDIENTES') {
      appts = filteredAppointments.filter(
        (a) =>
          (a.status || a.estado) === 'CONFIRMED' ||
          (a.status || a.estado) === 'IN_WAITING_ROOM' ||
          (a.status || a.estado) === 'IN_CONSULTATION'
      );
      title = 'Detalle de Citas Pendientes / Confirmadas';
      subtitle = 'Consultas agendadas pendientes de atención en el periodo';
      badgeLabel = `${appts.length} Citas Pendientes`;
      badgeColor = 'bg-sky-100 text-sky-800 border-sky-300';
    }

    setDetailModal({
      type: 'SUMMARY_CARD',
      title,
      subtitle,
      badgeLabel,
      badgeColor,
      filteredAppts: appts,
    });
  };

  const openDoctorModal = (docName: string) => {
    setModalSearchTerm('');
    const docData = doctorLoad[docName];
    const appts = docData ? docData.appts : [];

    setDetailModal({
      type: 'DOCTOR',
      title: `Detalle de Pacientes: ${docName}`,
      subtitle: `Listado de citas asignadas al médico en el periodo seleccionado`,
      badgeLabel: `${appts.length} Citas (${docData?.atendidas || 0} Atendidas, ${docData?.canceladas || 0} Canceladas)`,
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      filteredAppts: appts,
    });
  };

  const openSpecialtyModal = (specName: string) => {
    setModalSearchTerm('');
    const specData = specLoad[specName];
    const appts = specData ? specData.appts : [];

    setDetailModal({
      type: 'SPECIALTY',
      title: `Demanda de Especialidad: ${specName}`,
      subtitle: `Registro de pacientes y consultas agendadas para ${specName}`,
      badgeLabel: `${appts.length} Consultas (${total > 0 ? ((appts.length / total) * 100).toFixed(0) : 0}% Demanda)`,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      filteredAppts: appts,
    });
  };

  // Filtered Appointments inside Modal Search
  const modalAppointmentsList = useMemo(() => {
    if (!detailModal) return [];
    const term = modalSearchTerm.trim().toLowerCase();
    if (!term) return detailModal.filteredAppts;

    return detailModal.filteredAppts.filter((a) => {
      const pName = (a.patientName || a.paciente || '').toLowerCase();
      const pDni = (a.patientDni || a.cedula || '').toLowerCase();
      const exp = (a.expedienteNumber || a.numeroExpediente || '').toLowerCase();
      const dName = (a.doctorName || a.medicoNombre || '').toLowerCase();
      const spec = (a.specialty || a.especialidad || '').toLowerCase();
      const notes = (a.notes || a.motivoConsulta || '').toLowerCase();
      const status = (a.status || a.estado || '').toLowerCase();

      return (
        pName.includes(term) ||
        pDni.includes(term) ||
        exp.includes(term) ||
        dName.includes(term) ||
        spec.includes(term) ||
        notes.includes(term) ||
        status.includes(term)
      );
    });
  }, [detailModal, modalSearchTerm]);

  return (
    <div className="space-y-6" id="stats-module">
      {/* Header with Date Range Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Módulo de Estadísticas y Planificación Médica (Rol: Jefe / Admin)
            </h2>
            <p className="text-xs text-slate-500">
              Métricas consolidadas de demanda, ausentismo y distribución de carga médica en tiempo real
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportStatsCSV}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-sm cursor-pointer"
              title="Descargar resumen estadístico general en formato CSV"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Resumen General (CSV)</span>
            </button>
          </div>
        </div>

        {/* FILTRO POR RANGO DE FECHAS (PRESETS + SELECTOR DESDE / HASTA) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-indigo-600" />
              Filtrar Estadísticas por Rango de Fechas:
            </span>

            {(startDate || endDate || datePreset !== 'ALL') && (
              <button
                type="button"
                onClick={clearFilter}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpiar filtro (Ver Histórico)
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Presets Button Group */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-xs">
              <button
                type="button"
                onClick={() => applyPreset('ALL')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  datePreset === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Histórico Total
              </button>
              <button
                type="button"
                onClick={() => applyPreset('TODAY')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  datePreset === 'TODAY'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => applyPreset('WEEK')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  datePreset === 'WEEK'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Esta Semana
              </button>
              <button
                type="button"
                onClick={() => applyPreset('MONTH')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  datePreset === 'MONTH'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Este Mes
              </button>
            </div>

            {/* Custom Date Range Inputs: Desde & Hasta */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 font-bold">Desde:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-slate-500 font-bold">Hasta:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Active Range Information Badge */}
          <div className="text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2 pt-1">
            <span className="font-semibold text-indigo-900">
              {datePreset === 'ALL'
                ? `Mostrando todas las ${total} citas registradas en el historial.`
                : `Rango activo: ${startDate ? `Desde ${startDate}` : ''} ${
                    endDate ? `Hasta ${endDate}` : ''
                  } • ${total} citas encontradas.`}
            </span>
            <span className="text-slate-400 italic">
              💡 Haz clic en cualquier tarjeta, médico o especialidad para ver el detalle interactivo.
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - ALL INTERACTIVE AND CLICKABLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Appointments */}
        <button
          type="button"
          onClick={() => openSummaryModal('TOTAL')}
          className="text-left bg-white hover:bg-slate-50 p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 shadow-sm transition-all space-y-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Ver detalle completo de todas las citas"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-indigo-600 transition">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Total Citas</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-slate-500 group-hover:text-indigo-600" />
              <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{total}</div>
          <div className="text-[11px] text-indigo-600 font-medium flex items-center justify-between">
            <span>100% de la demanda</span>
            <span className="font-bold underline text-[10px]">Ver detalle ↗</span>
          </div>
        </button>

        {/* Atendidas / Completadas */}
        <button
          type="button"
          onClick={() => openSummaryModal('ATENDIDAS')}
          className="text-left bg-white hover:bg-emerald-50/40 p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-500 shadow-sm transition-all space-y-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
          title="Ver detalle de citas atendidas"
        >
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Atendidas</span>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <ExternalLink className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">{atendidas}</div>
          <div className="text-[11px] text-emerald-600 font-medium flex items-center justify-between">
            <span>{tasaAtencion}% efectividad de atención</span>
            <span className="font-bold underline text-[10px]">Ver detalle ↗</span>
          </div>
        </button>

        {/* Canceladas / No Show */}
        <button
          type="button"
          onClick={() => openSummaryModal('CANCELADAS')}
          className="text-left bg-white hover:bg-rose-50/40 p-4 rounded-xl border-2 border-rose-200 hover:border-rose-500 shadow-sm transition-all space-y-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500"
          title="Ver detalle de citas canceladas"
        >
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Canceladas</span>
            <div className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-rose-600" />
              <ExternalLink className="w-3 h-3 text-rose-500 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700">{canceladas}</div>
          <div className="text-[11px] text-rose-600 font-medium flex items-center justify-between">
            <span>{tasaAusentismo}% tasa de deserción</span>
            <span className="font-bold underline text-[10px]">Ver detalle ↗</span>
          </div>
        </button>

        {/* Tasa de Ausentismo */}
        <button
          type="button"
          onClick={() => openSummaryModal('AUSENTISMO')}
          className="text-left bg-white hover:bg-indigo-50/40 p-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 shadow-sm transition-all space-y-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          title="Ver detalle de ausentismo médico"
        >
          <div className="flex items-center justify-between text-indigo-600">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Tasa Ausentismo</span>
            <div className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-indigo-600" />
              <ExternalLink className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700">{tasaAusentismo}%</div>
          <div className="text-[11px] text-indigo-500 font-medium flex items-center justify-between">
            <span>Meta centro: &lt; 15%</span>
            <span className="font-bold underline text-[10px]">Ver detalle ↗</span>
          </div>
        </button>
      </div>

      {/* Breakdown Section: Doctors & Specialty Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors Workload */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              Carga de Pacientes por Médico
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Clic en el médico para ver detalle</span>
          </div>

          <div className="space-y-3">
            {Object.keys(doctorLoad).length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                No hay registros de citas en el rango seleccionado.
              </div>
            ) : (
              Object.entries(doctorLoad).map(([docName, stats]) => {
                const percent = total > 0 ? ((stats.total / total) * 100).toFixed(0) : 0;
                return (
                  <button
                    key={docName}
                    type="button"
                    onClick={() => openDoctorModal(docName)}
                    className="w-full text-left space-y-1.5 bg-slate-50 hover:bg-teal-50/50 p-3.5 rounded-xl border border-slate-200 hover:border-teal-300 transition-all cursor-pointer group shadow-xs"
                    title={`Ver pacientes y citas del ${docName}`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 group-hover:text-teal-900 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                        {docName}
                      </span>
                      <span className="font-mono font-bold text-teal-700 flex items-center gap-1">
                        <span>{stats.total} citas ({percent}%)</span>
                        <ChevronRight className="w-3.5 h-3.5 text-teal-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-2 transition-all"
                        style={{ width: `${(stats.atendidas / (stats.total || 1)) * 100}%` }}
                        title={`Atendidas: ${stats.atendidas}`}
                      />
                      <div
                        className="bg-rose-500 h-2 transition-all"
                        style={{ width: `${(stats.canceladas / (stats.total || 1)) * 100}%` }}
                        title={`Canceladas: ${stats.canceladas}`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
                      <span className="text-emerald-700 font-semibold">Atendidas: {stats.atendidas}</span>
                      <span className="text-rose-700 font-semibold">Canceladas: {stats.canceladas}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Specialty Demand */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Demanda por Especialidad Médica
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Clic en la especialidad para ver detalle</span>
          </div>

          <div className="space-y-2.5">
            {Object.keys(specLoad).length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">
                No hay registros de citas en el rango seleccionado.
              </div>
            ) : (
              Object.entries(specLoad).map(([spec, data]) => {
                const percent = total > 0 ? ((data.count / total) * 100).toFixed(0) : 0;
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => openSpecialtyModal(spec)}
                    className="w-full text-left p-3.5 bg-indigo-50/40 hover:bg-indigo-50 rounded-xl border border-indigo-100 hover:border-indigo-300 transition-all flex items-center justify-between cursor-pointer group shadow-xs"
                    title={`Ver pacientes y citas de la especialidad ${spec}`}
                  >
                    <div>
                      <div className="text-xs font-bold text-indigo-950 group-hover:text-indigo-700 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-indigo-600" />
                        {spec}
                      </div>
                      <div className="text-[10px] text-slate-500">{percent}% de la demanda global</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs font-black text-indigo-700 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-xs">
                        {data.count} citas
                      </div>
                      <ChevronRight className="w-4 h-4 text-indigo-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DETAILED DRILL-DOWN MODAL FOR STATS (CARDS, DOCTOR, SPECIALTY)            */}
      {/* ========================================================================= */}
      {detailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn"
          onClick={() => setDetailModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-teal-300 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-400" />
                    {detailModal.title}
                  </h3>
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${detailModal.badgeColor}`}>
                    {detailModal.badgeLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{detailModal.subtitle}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Modal Export Button */}
                <button
                  type="button"
                  onClick={() => exportModalCSV(detailModal)}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title="Descargar este listado en formato CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descargar Información</span>
                  <span className="sm:hidden">CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search & Filter bar inside modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={modalSearchTerm}
                  onChange={(e) => setModalSearchTerm(e.target.value)}
                  placeholder="Buscar por paciente, cédula, expediente, notas..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 bg-white text-slate-800 shadow-xs"
                />
              </div>

              <div className="text-xs font-semibold text-slate-600">
                Mostrando {modalAppointmentsList.length} de {detailModal.filteredAppts.length} citas
              </div>
            </div>

            {/* Modal Body - Appointment Table */}
            <div className="overflow-y-auto p-4 flex-1 custom-scrollbar-x space-y-3">
              {modalAppointmentsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Calendar className="w-10 h-10 mx-auto opacity-30 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-600">
                    No se encontraron citas con el criterio de búsqueda.
                  </p>
                  <p className="text-xs text-slate-400">
                    Pruebe ajustando el término de búsqueda o el rango de fechas.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Fecha & Hora</th>
                        <th className="py-2.5 px-3">Paciente & Cédula</th>
                        <th className="py-2.5 px-3">N° Expediente</th>
                        <th className="py-2.5 px-3">Especialidad & Médico</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Motivo / Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {modalAppointmentsList.map((appt) => {
                        const exp = appt.expedienteNumber || appt.numeroExpediente;
                        const st = appt.status || appt.estado;

                        return (
                          <tr key={appt.id} className="hover:bg-slate-50 transition-colors">
                            {/* Fecha & Hora */}
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                              <div className="font-bold text-slate-900">{appt.time || appt.hora} hrs</div>
                              <div className="text-[11px] text-slate-500">{appt.date || appt.fecha}</div>
                            </td>

                            {/* Paciente & Cédula */}
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{appt.patientName || appt.paciente}</div>
                              <div className="font-mono text-[11px] text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 w-fit mt-0.5">
                                CI: {appt.patientDni || appt.cedula}
                              </div>
                            </td>

                            {/* Expediente */}
                            <td className="py-2.5 px-3">
                              {exp ? (
                                <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                                  HC: {exp}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">N/A</span>
                              )}
                            </td>

                            {/* Especialidad & Médico */}
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">{appt.doctorName || appt.medicoNombre}</div>
                              <div className="text-[11px] text-teal-700">{appt.specialty || appt.especialidad}</div>
                            </td>

                            {/* Estado */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {st === 'COMPLETED' && (
                                <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1 w-fit">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" /> Atendido
                                </span>
                              )}
                              {(st === 'CONFIRMED' || st === 'IN_WAITING_ROOM' || st === 'IN_CONSULTATION') && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-300 rounded-full flex items-center gap-1 w-fit">
                                  <Clock className="w-3 h-3 text-sky-600" /> Confirmada
                                </span>
                              )}
                              {(st === 'CANCELLED' || st === 'NO_SHOW') && (
                                <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 rounded-full flex items-center gap-1 w-fit">
                                  <XCircle className="w-3 h-3 text-rose-600" /> Cancelada
                                </span>
                              )}
                            </td>

                            {/* Motivo / Notas */}
                            <td className="py-2.5 px-3 max-w-xs">
                              <span className="text-slate-600 line-clamp-2 text-[11px]">
                                {appt.notes || appt.motivoConsulta || <span className="text-slate-400 italic">Sin observaciones</span>}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-500">
                Total de registros en este detalle: <strong>{modalAppointmentsList.length}</strong>
              </span>

              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

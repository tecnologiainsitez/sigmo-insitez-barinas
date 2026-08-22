import React, { useState, useEffect, useMemo } from 'react';
import {
  Patient,
  PatientCategory,
  PatientCondition,
  Kinship,
  TitularData,
  GuardianData,
  UserRole,
  Appointment,
  Specialty,
} from '../types';
import { dbService, normalizeAppointmentEntity, sanitizeDateString, sanitizeTimeString } from '../services/indexedDB';
import { safeParseDate } from '../utils/dateUtils';
import { RescheduleModal } from './RescheduleModal';
import {
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  IdCard,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Tag,
  Briefcase,
  HeartHandshake,
  Trash2,
  Edit3,
  CalendarPlus,
  Sparkles,
  Filter,
  FileText,
  ShieldAlert,
  UserCheck,
  Hash,
  Info,
  FolderHeart,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  Stethoscope,
  CalendarClock,
  X,
  Hourglass,
  ClipboardList,
} from 'lucide-react';

interface PatientRegistrationModuleProps {
  userRole: UserRole;
  onBookAppointmentForPatient?: (patient: Patient) => void;
  appointments?: Appointment[];
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
}

const CATEGORIES: PatientCategory[] = ['Titular', 'Beneficiario', 'Estudiante', 'Comunidad'];

const CONDITIONS: PatientCondition[] = [
  'Administrativo Activo',
  'Administrativo Contratado',
  'Administrativo Pensionado',
  'Administrativo Jubilado',
  'Docente Activo',
  'Docente Contratado',
  'Docente Pensionado',
  'Docente Jubilado',
  'Obrero Activo',
  'Obrero Contratado',
  'Obrero Pensionado',
  'Obrero Jubilado',
];

const KINSHIPS: Kinship[] = [
  'Hijo/a',
  'Cónyuge/Pareja',
  'Padre/Madre',
  'Hermano/a',
  'Tutor Legal',
  'Abuelo/a',
  'Tío/a',
  'Otro',
];

export const PatientRegistrationModule: React.FC<PatientRegistrationModuleProps> = ({
  userRole,
  onBookAppointmentForPatient,
  appointments: rawAppointments = [],
  onReschedule,
}) => {
  const canReschedule = userRole === 'ANALISTA' || userRole === 'DESARROLLADOR_ADMIN';

  // Normalize incoming appointments
  const appointments = useMemo(() => {
    return (rawAppointments || []).map(normalizeAppointmentEntity);
  }, [rawAppointments]);

  // Patients list state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Active Patient for Dossier/Ficha Modal
  const [selectedPatientForFicha, setSelectedPatientForFicha] = useState<Patient | null>(null);
  const [fichaFilter, setFichaFilter] = useState<'ALL' | 'COMPLETED' | 'CANCELLED' | 'PENDING' | string>('ALL');

  // Appointment selected for rescheduling from within patient dossier
  const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);

  // Form State
  const [dni, setDni] = useState('');
  const [expedienteNumber, setExpedienteNumber] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [antecedentes, setAntecedentes] = useState('');
  const [category, setCategory] = useState<PatientCategory>('Titular');
  const [condition, setCondition] = useState<PatientCondition>('Docente Activo');

  // Beneficiary-specific Titular fields
  const [titularDni, setTitularDni] = useState('');
  const [titularName, setTitularName] = useState('');
  const [titularCondition, setTitularCondition] = useState<PatientCondition>('Docente Activo');
  const [titularKinship, setTitularKinship] = useState<Kinship>('Hijo/a');

  // Community Minor-specific Guardian/Representative fields
  const [guardianDni, setGuardianDni] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianKinship, setGuardianKinship] = useState<Kinship>('Padre/Madre');

  // UI state
  const [editingPatientDni, setEditingPatientDni] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'SUCCESS' | 'ERROR';
    text: string;
  } | null>(null);

  // Load patients from IndexedDB
  const loadPatients = async () => {
    try {
      const data = await dbService.getAllPatients();
      setPatients(data);
    } catch (err) {
      console.error('Error loading patients from IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // Calculate age helper safely
  const calculateAge = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const today = new Date();
      const birth = safeParseDate(dateString);
      if (isNaN(birth.getTime()) || birth.getFullYear() < 1900) return null;
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age >= 0 && !isNaN(age) ? age : null;
    } catch {
      return null;
    }
  };

  const patientAge = calculateAge(birthDate);
  const isCommunityMinor = category === 'Comunidad' && patientAge !== null && patientAge < 18;

  // Auto-generate Expediente number
  const handleGenerateExpediente = () => {
    const year = new Date().getFullYear();
    const count = patients.length + 1;
    const padded = String(count).padStart(4, '0');
    setExpedienteNumber(`EXP-${year}-${padded}`);
  };

  // Reset form
  const resetForm = () => {
    setDni('');
    setExpedienteNumber('');
    setName('');
    setBirthDate('');
    setPhone('');
    setEmail('');
    setAddress('');
    setAntecedentes('');
    setCategory('Titular');
    setCondition('Docente Activo');
    setTitularDni('');
    setTitularName('');
    setTitularCondition('Docente Activo');
    setTitularKinship('Hijo/a');
    setGuardianDni('');
    setGuardianName('');
    setGuardianPhone('');
    setGuardianKinship('Padre/Madre');
    setEditingPatientDni(null);
  };

  // Edit patient
  const handleEdit = (p: Patient) => {
    setEditingPatientDni(p.dni);
    setDni(p.dni);
    setExpedienteNumber(p.expedienteNumber || p.numeroExpediente || '');
    setName(p.name || p.nombreApellido || '');
    setBirthDate(p.birthDate || p.fechaNacimiento || '');
    setPhone(p.phone || p.telefono || '');
    setEmail(p.email || p.correo || '');
    setAddress(p.address || p.direccion || '');
    setAntecedentes(p.antecedentes || p.medicalHistory || p.historiaMedica || '');
    setCategory(p.category || 'Titular');
    setCondition((p.condition as PatientCondition) || 'Docente Activo');

    if (p.category === 'Beneficiario' && (p.titularData || p.datosTitular)) {
      const t = p.titularData || p.datosTitular;
      setTitularDni(t?.cedula || '');
      setTitularName(t?.nombreCompleto || '');
      setTitularCondition((t?.condicion as PatientCondition) || 'Docente Activo');
      setTitularKinship((t?.parentesco as Kinship) || 'Hijo/a');
    } else {
      setTitularDni('');
      setTitularName('');
      setTitularCondition('Docente Activo');
      setTitularKinship('Hijo/a');
    }

    if (p.guardianData || p.representante) {
      const g = p.guardianData || p.representante;
      setGuardianDni(g?.cedula || '');
      setGuardianName(g?.nombreCompleto || '');
      setGuardianPhone(g?.telefono || '');
      setGuardianKinship((g?.parentesco as Kinship) || 'Padre/Madre');
    } else {
      setGuardianDni('');
      setGuardianName('');
      setGuardianPhone('');
      setGuardianKinship('Padre/Madre');
    }

    const formElement = document.getElementById('patient-form-card');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auto-lookup titular
  const handleLookupTitular = (targetDni: string) => {
    setTitularDni(targetDni);
    const clean = targetDni.trim();
    if (clean.length >= 5) {
      const existing = patients.find((p) => p.dni === clean && p.category === 'Titular');
      if (existing) {
        setTitularName(existing.name || existing.nombreApellido || '');
        if (existing.condition) {
          setTitularCondition(existing.condition as PatientCondition);
        }
      }
    }
  };

  // Handle submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim() || !name.trim()) {
      setFeedbackMessage({
        type: 'ERROR',
        text: 'La Cédula y el Nombre Completo son obligatorios.',
      });
      return;
    }

    if (category === 'Beneficiario') {
      if (!titularDni.trim() || !titularName.trim()) {
        setFeedbackMessage({
          type: 'ERROR',
          text: 'Para la categoría "Beneficiario" debe indicar la Cédula y Nombre Completo del Titular.',
        });
        return;
      }
    }

    if (isCommunityMinor) {
      if (!guardianDni.trim() || !guardianName.trim() || !guardianPhone.trim()) {
        setFeedbackMessage({
          type: 'ERROR',
          text: 'Para pacientes menores de 18 años de la Comunidad, es obligatorio registrar la Cédula, Nombre Completo y Teléfono del Representante Legal.',
        });
        return;
      }
    }

    const titularInfo: TitularData | undefined =
      category === 'Beneficiario'
        ? {
            cedula: titularDni.trim(),
            nombreCompleto: titularName.trim(),
            condicion: titularCondition,
            parentesco: titularKinship,
          }
        : undefined;

    const guardianInfo: GuardianData | undefined = isCommunityMinor
      ? {
          cedula: guardianDni.trim(),
          nombreCompleto: guardianName.trim(),
          telefono: guardianPhone.trim(),
          parentesco: guardianKinship,
        }
      : undefined;

    const finalExpediente =
      expedienteNumber.trim() || `EXP-${new Date().getFullYear()}-${String(patients.length + 1).padStart(4, '0')}`;

    const patientRecord: Patient = {
      id: editingPatientDni ? undefined : 'pat_' + Date.now(),
      dni: dni.trim(),
      cedula: dni.trim(),
      expedienteNumber: finalExpediente,
      numeroExpediente: finalExpediente,
      name: name.trim(),
      nombreApellido: name.trim(),
      birthDate: birthDate || undefined,
      fechaNacimiento: birthDate || undefined,
      phone: phone.trim(),
      telefono: phone.trim(),
      email: email.trim(),
      correo: email.trim(),
      address: address.trim(),
      direccion: address.trim(),
      antecedentes: antecedentes.trim(),
      medicalHistory: antecedentes.trim(),
      historiaMedica: antecedentes.trim(),
      category,
      categoria: category,
      condition,
      condicion: condition,
      titularData: titularInfo,
      datosTitular: titularInfo,
      guardianData: guardianInfo,
      representante: guardianInfo,
      updatedAtUtc: new Date().toISOString(),
      createdAtUtc: editingPatientDni
        ? patients.find((p) => p.dni === editingPatientDni)?.createdAtUtc || new Date().toISOString()
        : new Date().toISOString(),
    };

    try {
      await dbService.savePatient(patientRecord);
      await dbService.addPatientMutation(editingPatientDni ? 'UPDATE' : 'CREATE', patientRecord);
      await loadPatients();
      setFeedbackMessage({
        type: 'SUCCESS',
        text: `¡Paciente ${name.trim()} (Expediente: ${finalExpediente}) guardado y sincronizado exitosamente!`,
      });
      resetForm();
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage({
        type: 'ERROR',
        text: `Error al guardar en IndexedDB: ${err?.message || 'Error desconocido'}`,
      });
    }
  };

  // Delete patient
  const handleDelete = async (patientDni: string, patientName: string) => {
    if (window.confirm(`¿Está seguro de eliminar al paciente "${patientName}" (Cédula: ${patientDni}) del padrón?`)) {
      try {
        await dbService.deletePatient(patientDni);
        await loadPatients();
        setFeedbackMessage({
          type: 'SUCCESS',
          text: `Paciente "${patientName}" eliminado del padrón.`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } catch (err: any) {
        setFeedbackMessage({
          type: 'ERROR',
          text: `Error al eliminar paciente: ${err?.message}`,
        });
      }
    }
  };

  // Helper: calculate patient stats from appointment list
  const getPatientAppointmentStats = (patientDni: string) => {
    const cleanDni = (patientDni || '').trim();
    const patientAppts = appointments.filter((a) => {
      const aDni = (a.patientDni || a.cedula || '').trim();
      return aDni === cleanDni;
    });

    let attended = 0;
    let cancelled = 0;
    let pending = 0;
    const specialtyMap: Record<string, number> = {};

    patientAppts.forEach((a) => {
      const st = a.status || a.estado;
      if (st === 'COMPLETED') attended++;
      else if (st === 'CANCELLED') cancelled++;
      else pending++;

      const spec = (a.specialty || a.especialidad || 'Medicina General') as string;
      specialtyMap[spec] = (specialtyMap[spec] || 0) + 1;
    });

    return {
      appointments: patientAppts,
      total: patientAppts.length,
      attended,
      cancelled,
      pending,
      specialtyBreakdown: Object.entries(specialtyMap).map(([specialty, count]) => ({
        specialty,
        count,
      })),
    };
  };

  // Filtered patients
  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.dni.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.name || p.nombreApellido || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.expedienteNumber || p.numeroExpediente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.phone || p.telefono || '').includes(searchTerm);

    const matchesCategory = filterCategory === 'ALL' || (p.category || 'Titular') === filterCategory;

    return matchesSearch && matchesCategory;
  });

  // Category counts
  const totalTitulares = patients.filter((p) => p.category === 'Titular').length;
  const totalBeneficiarios = patients.filter((p) => p.category === 'Beneficiario').length;
  const totalEstudiantes = patients.filter((p) => p.category === 'Estudiante').length;
  const totalComunidad = patients.filter((p) => p.category === 'Comunidad').length;

  // Selected patient stats for Ficha Modal
  const selectedPatientStats = useMemo(() => {
    if (!selectedPatientForFicha) return null;
    return getPatientAppointmentStats(selectedPatientForFicha.dni);
  }, [selectedPatientForFicha, appointments]);

  // Filtered appointments inside Patient Ficha Modal
  const filteredFichaAppointments = useMemo(() => {
    if (!selectedPatientStats) return [];
    const appts = selectedPatientStats.appointments;
    if (fichaFilter === 'ALL') return appts;
    if (fichaFilter === 'COMPLETED') return appts.filter((a) => (a.status || a.estado) === 'COMPLETED');
    if (fichaFilter === 'CANCELLED') return appts.filter((a) => (a.status || a.estado) === 'CANCELLED');
    if (fichaFilter === 'PENDING') {
      return appts.filter(
        (a) => (a.status || a.estado) !== 'COMPLETED' && (a.status || a.estado) !== 'CANCELLED'
      );
    }
    if (fichaFilter.startsWith('SPECIALTY:')) {
      const spec = fichaFilter.replace('SPECIALTY:', '');
      return appts.filter((a) => (a.specialty || a.especialidad) === spec);
    }
    return appts;
  }, [selectedPatientStats, fichaFilter]);

  return (
    <div className="space-y-6" id="patient-registration-container">
      {/* Module Title Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600 text-white p-3 rounded-xl shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Padrón y Registro de Pacientes / Afiliados
              <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full font-semibold">
                IndexedDB Local
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Gestión de Fichas Médicas con Recuento de Citas por Especialidad, Asistencias, Cancelaciones y Reprogramación
            </p>
          </div>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-fadeIn ${
            feedbackMessage.type === 'SUCCESS'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMessage.type === 'SUCCESS' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* SECTION 1: REGISTRATION & EDITING FORM */}
      <div id="patient-form-card" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-sm text-slate-800">
              {editingPatientDni ? 'Modificar Paciente del Padrón' : 'Nuevo Registro de Paciente en el Padrón'}
            </h3>
          </div>
          {editingPatientDni && (
            <span className="text-xs bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
              Editando CI: {editingPatientDni}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Cédula */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="patient-dni">
                Cédula / Documento de Identidad *
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="patient-dni"
                  type="text"
                  required
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  placeholder="Ej. 0801198544321"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Expediente / Historia Médica */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="expediente-num">
                N° de Expediente / Historia Médica
              </label>
              <div className="flex gap-1.5">
                <input
                  id="expediente-num"
                  type="text"
                  value={expedienteNumber}
                  onChange={(e) => setExpedienteNumber(e.target.value)}
                  placeholder="Ej. EXP-2024-0012"
                  className="w-full px-3 py-2 text-xs font-mono font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
                />
                <button
                  type="button"
                  onClick={handleGenerateExpediente}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition whitespace-nowrap"
                  title="Generar correlativo automático"
                >
                  Auto
                </button>
              </div>
            </div>

            {/* Nombre y Apellido */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="patient-name">
                Nombre Completo y Apellidos *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="patient-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. María Elena Fernández Silva"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Fecha de Nacimiento */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="birth-date">
                Fecha de Nacimiento
              </label>
              <input
                id="birth-date"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
              />
              {patientAge !== null && (
                <span className="text-[11px] text-teal-700 font-semibold mt-0.5 block">
                  Edad Calculada: {patientAge} años
                </span>
              )}
            </div>

            {/* Teléfono */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="patient-phone">
                Teléfono de Contacto
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="patient-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 412 123 4567"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Correo Electrónico */}
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="patient-email">
                Correo Electrónico (para notificaciones Google Chat/.ICS)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="patient-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="paciente@correo.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Categoría */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría de Afiliación *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PatientCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white font-semibold"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Condición */}
            <div className="md:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Condición Laboral / Académica *
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as PatientCondition)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>

            {/* Dirección */}
            <div className="md:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="patient-address">
                Dirección Residencial
              </label>
              <input
                id="patient-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Principal, Edificio Central, Apto 4-B"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white"
              />
            </div>

            {/* Antecedentes Médicos / Personales y Familiares */}
            <div className="md:col-span-12">
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between" htmlFor="patient-antecedentes">
                <span className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ClipboardList className="w-3.5 h-3.5 text-teal-600" />
                  Antecedentes Médicos, Patológicos, Quirúrgicos, Alérgicos y Familiares
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  (Historial clínico base del afiliado/paciente)
                </span>
              </label>
              <textarea
                id="patient-antecedentes"
                rows={2}
                value={antecedentes}
                onChange={(e) => setAntecedentes(e.target.value)}
                placeholder="Ej. Hipertensión arterial en tratamiento (Enalapril 20mg/d), Alergia a Penicilina / Sulfas, Asma intermitente, Cirugía de apendicectomía previa, Antecedentes familiares de Diabetes..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-900 bg-white shadow-inner resize-y"
              />
            </div>
          </div>

          {/* CONDITIONAL SECTION 1: DATOS DEL TITULAR (SI CATEGORIA === 'Beneficiario') */}
          {category === 'Beneficiario' && (
            <div className="bg-amber-50/80 border-2 border-amber-300 rounded-xl p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wide">
                <HeartHandshake className="w-4 h-4 text-amber-600" />
                Datos del Titular Asociado (Requerido para Beneficiarios)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-amber-950 mb-1" htmlFor="titular-dni">
                    Cédula del Titular *
                  </label>
                  <input
                    id="titular-dni"
                    type="text"
                    required
                    value={titularDni}
                    onChange={(e) => handleLookupTitular(e.target.value)}
                    placeholder="Ej. 0801198544321"
                    className="w-full px-3 py-2 text-xs font-mono font-medium border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 shadow-sm"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-amber-950 mb-1" htmlFor="titular-name">
                    Nombre Completo del Titular *
                  </label>
                  <input
                    id="titular-name"
                    type="text"
                    required
                    value={titularName}
                    onChange={(e) => setTitularName(e.target.value)}
                    placeholder="Ej. Prof. Carlos Alberto Mendoza"
                    className="w-full px-3 py-2 text-xs border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-amber-950 mb-1">
                    Condición del Titular *
                  </label>
                  <select
                    value={titularCondition}
                    onChange={(e) => setTitularCondition(e.target.value as PatientCondition)}
                    className="w-full px-3 py-2 text-xs border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900"
                  >
                    {CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-amber-950 mb-1">
                    Parentesco / Vínculo *
                  </label>
                  <select
                    value={titularKinship}
                    onChange={(e) => setTitularKinship(e.target.value as Kinship)}
                    className="w-full px-3 py-2 text-xs border border-amber-300 bg-white rounded-lg focus:ring-2 focus:ring-amber-500 text-slate-900 font-semibold"
                  >
                    {KINSHIPS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* CONDITIONAL SECTION 2: DATOS DEL REPRESENTANTE (SI MENOR DE 18 DE LA COMUNIDAD) */}
          {isCommunityMinor && (
            <div className="bg-rose-50/80 border-2 border-rose-300 rounded-xl p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-900 uppercase tracking-wide">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Datos del Representante Legal / Tutor (Menor de 18 Años - Comunidad)
                </div>
                <span className="text-[11px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded font-semibold">
                  Menor de Edad ({patientAge} años)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-rose-900 mb-1" htmlFor="guardian-dni">
                    Cédula del Representante *
                  </label>
                  <input
                    id="guardian-dni"
                    type="text"
                    required
                    value={guardianDni}
                    onChange={(e) => setGuardianDni(e.target.value)}
                    placeholder="Ej. 1244556677889"
                    className="w-full px-3 py-2 text-xs font-mono font-medium border border-rose-300 bg-white rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900 shadow-sm"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-rose-900 mb-1" htmlFor="guardian-name">
                    Nombre Completo del Representante *
                  </label>
                  <input
                    id="guardian-name"
                    type="text"
                    required
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Ej. Lucía Elena Benítez de Suárez"
                    className="w-full px-3 py-2 text-xs border border-rose-300 bg-white rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-rose-900 mb-1" htmlFor="guardian-phone">
                    Teléfono del Representante *
                  </label>
                  <input
                    id="guardian-phone"
                    type="text"
                    required
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="+58 412 334 5566"
                    className="w-full px-3 py-2 text-xs border border-rose-300 bg-white rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-rose-900 mb-1">
                    Parentesco / Vínculo *
                  </label>
                  <select
                    value={guardianKinship}
                    onChange={(e) => setGuardianKinship(e.target.value as Kinship)}
                    className="w-full px-3 py-2 text-xs border border-rose-300 bg-white rounded-lg focus:ring-2 focus:ring-rose-500 text-slate-900 font-semibold"
                  >
                    {KINSHIPS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 flex-wrap gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Limpiar Formulario
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingPatientDni ? 'Actualizar Paciente en Padrón' : 'Guardar Paciente / Afiliado'}
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: PATIENTS DIRECTORY / PADRÓN */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header & Search/Filters */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Directorio del Padrón de Pacientes ({filteredPatients.length})
            </h3>
            <p className="text-xs text-slate-500">
              Búsqueda en tiempo real, acceso a Fichas de Paciente con recuento de citas y reprogramaciones
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar Cédula, Expediente, Nombre..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white w-56 sm:w-64"
              />
            </div>

            {/* Filter Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Todas las Categorías</option>
              <option value="Titular">Titulares ({totalTitulares})</option>
              <option value="Beneficiario">Beneficiarios ({totalBeneficiarios})</option>
              <option value="Estudiante">Estudiantes ({totalEstudiantes})</option>
              <option value="Comunidad">Comunidad ({totalComunidad})</option>
            </select>
          </div>
        </div>

        {/* Patients Table */}
        <div className="overflow-x-auto custom-scrollbar-x">
          <table className="w-full min-w-[950px] text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3.5">Cédula / Expediente</th>
                <th className="p-3.5">Nombre y Apellido</th>
                <th className="p-3.5">Categoría / Condición</th>
                <th className="p-3.5">Recuento de Citas</th>
                <th className="p-3.5">Titular / Representante</th>
                <th className="p-3.5">Contacto</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No se encontraron pacientes que coincidan con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => {
                  const titular = p.titularData || p.datosTitular;
                  const guardian = p.guardianData || p.representante;
                  const cat = p.category || 'Titular';
                  const cond = p.condition || p.condicion || 'Docente Activo';
                  const exp = p.expedienteNumber || p.numeroExpediente;

                  // Patient appointment metrics
                  const stats = getPatientAppointmentStats(p.dni);

                  return (
                    <tr key={p.dni} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cédula & Expediente */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800">{p.dni}</div>
                        {exp && (
                          <div className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 w-fit mt-0.5 flex items-center gap-1">
                            <Hash className="w-2.5 h-2.5" /> {exp}
                          </div>
                        )}
                      </td>

                      {/* Nombre y Edad */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{p.name || p.nombreApellido}</div>
                        {(p.birthDate || p.fechaNacimiento) && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <span>Nac: {p.birthDate || p.fechaNacimiento}</span>
                            {calculateAge(p.birthDate || p.fechaNacimiento) !== null && (
                              <span className="font-medium">
                                ({calculateAge(p.birthDate || p.fechaNacimiento)} años)
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Categoría & Condición */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            cat === 'Titular'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : cat === 'Beneficiario'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : cat === 'Estudiante'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-purple-100 text-purple-800 border border-purple-300'
                          }`}
                        >
                          {cat}
                        </span>
                        <div className="text-[11px] text-slate-600 font-medium mt-0.5">{cond}</div>
                      </td>

                      {/* Recuento de Citas Summary Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPatientForFicha(p)}
                          className="bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg p-1.5 text-left transition space-y-1 block group"
                          title="Click para abrir Ficha y Recuento Completo"
                        >
                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-800 group-hover:text-teal-900">
                            <BarChart3 className="w-3.5 h-3.5 text-teal-600" />
                            <span>{stats.total} {stats.total === 1 ? 'Cita' : 'Citas'} Agendadas</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1 py-0.2 rounded">
                              ✅ {stats.attended} Asistió
                            </span>
                            <span className="text-rose-700 font-bold bg-rose-100/70 px-1 py-0.2 rounded">
                              ❌ {stats.cancelled} Canceló
                            </span>
                          </div>
                        </button>
                      </td>

                      {/* Titular Details or Guardian Details */}
                      <td className="p-3.5">
                        {cat === 'Beneficiario' && titular ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-950 space-y-0.5 min-w-[180px]">
                            <div className="font-bold flex items-center justify-between">
                              <span className="truncate max-w-[120px]">{titular.nombreCompleto}</span>
                              <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                {titular.parentesco}
                              </span>
                            </div>
                            <div className="text-slate-600 font-mono text-[10px]">
                              CI: {titular.cedula}
                            </div>
                          </div>
                        ) : guardian ? (
                          <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-950 space-y-0.5 min-w-[180px]">
                            <div className="font-bold flex items-center justify-between">
                              <span className="truncate max-w-[120px]">{guardian.nombreCompleto}</span>
                              <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                {guardian.parentesco}
                              </span>
                            </div>
                            <div className="text-slate-600 font-mono text-[10px]">
                              CI: {guardian.cedula} • 📞 {guardian.telefono}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Contact Details */}
                      <td className="p-3.5 text-slate-600 text-[11px] whitespace-nowrap">
                        {(p.phone || p.telefono) && <div>📞 {p.phone || p.telefono}</div>}
                        {(p.email || p.correo) && <div className="text-slate-500">✉️ {p.email || p.correo}</div>}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ficha & Estadísticas */}
                          <button
                            type="button"
                            onClick={() => setSelectedPatientForFicha(p)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-teal-300 rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-xs"
                            title="Ver Ficha Médica y Recuento de Citas del Paciente"
                          >
                            <FolderHeart className="w-3.5 h-3.5 text-teal-400" />
                            <span>Ficha</span>
                          </button>

                          {/* Book Appointment Shortcut */}
                          {onBookAppointmentForPatient && (
                            <button
                              type="button"
                              onClick={() => onBookAppointmentForPatient(p)}
                              className="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg font-bold text-[11px] flex items-center gap-1 transition shadow-sm"
                              title="Agendar Cita para este Paciente"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              <span>Cita</span>
                            </button>
                          )}

                          {/* Edit Patient */}
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                            title="Editar Datos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Patient */}
                          <button
                            type="button"
                            onClick={() => handleDelete(p.dni, p.name || p.nombreApellido || p.dni)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Eliminar Paciente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* MODAL 1: FICHA COMPLETA DEL PACIENTE CON RECUENTO DE CITAS POR ESPECIALIDAD */}
      {/* ========================================================================= */}
      {selectedPatientForFicha && selectedPatientStats && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          id="patient-ficha-modal"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-600 text-white rounded-xl shadow-xs">
                  <FolderHeart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-teal-300">
                    Ficha del Paciente / Expediente Clínico
                  </h3>
                  <p className="text-xs text-slate-400">
                    Recuento de Citas por Especialidad, Estado de Asistencia y Gestión de Turnos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientForFicha(null)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar-x">
              {/* Patient Basic Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Nombre Completo:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedPatientForFicha.name || selectedPatientForFicha.nombreApellido}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Cédula & Expediente:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                    <span>CI: {selectedPatientForFicha.dni}</span>
                    {selectedPatientForFicha.expedienteNumber && (
                      <span className="text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 text-[11px]">
                        HC: {selectedPatientForFicha.expedienteNumber}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Categoría & Condición:</span>
                  <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                    {selectedPatientForFicha.category || 'Titular'} • {selectedPatientForFicha.condition || 'Activo'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Contacto Telefónico:</span>
                  <span className="font-mono text-slate-700 font-medium">
                    📞 {selectedPatientForFicha.phone || selectedPatientForFicha.telefono || 'Sin teléfono'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Correo Electrónico:</span>
                  <span className="text-slate-700 truncate block">
                    ✉️ {selectedPatientForFicha.email || selectedPatientForFicha.correo || 'Sin correo'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Dirección:</span>
                  <span className="text-slate-600 truncate block" title={selectedPatientForFicha.address}>
                    📍 {selectedPatientForFicha.address || 'Sin dirección registrada'}
                  </span>
                </div>
              </div>

              {/* Antecedentes Médicos / Personales y Familiares */}
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                  <ClipboardList className="w-4 h-4 text-amber-700" />
                  <span>Antecedentes Médicos, Quirúrgicos, Alérgicos y Familiares</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  {selectedPatientForFicha.antecedentes ||
                    selectedPatientForFicha.medicalHistory ||
                    selectedPatientForFicha.historiaMedica ||
                    'Sin antecedentes patológicos, quirúrgicos o alérgicos registrados.'}
                </p>
              </div>

              {/* RECUENTO ESTADÍSTICO DE CITAS EN LA FICHA */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-teal-600 text-white rounded-lg">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-teal-300">
                        Recuento Estadístico de Citas del Paciente
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Consolidado oficial de consultas en las diferentes especialidades médicas
                      </p>
                    </div>
                  </div>

                  {onBookAppointmentForPatient && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientForFicha(null);
                        onBookAppointmentForPatient(selectedPatientForFicha);
                      }}
                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>Agendar Nueva Cita</span>
                    </button>
                  )}
                </div>

                {/* 4 KPI Metrics - Clickable Drill-Down Cards */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Click en las tarjetas o especialidades para filtrar el detalle:</span>
                    {fichaFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setFichaFilter('ALL')}
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
                      onClick={() => setFichaFilter('ALL')}
                      className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                        fichaFilter === 'ALL'
                          ? 'bg-slate-800 border-teal-400 ring-2 ring-teal-400/60 shadow-lg scale-[1.02]'
                          : 'bg-slate-800/90 border-slate-700/80 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                      title="Click para ver todas las citas del paciente"
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Citas</span>
                      <span className="text-xl font-bold text-white font-mono">{selectedPatientStats.total}</span>
                      <span className="text-[9px] text-teal-400 font-semibold block mt-0.5">
                        {fichaFilter === 'ALL' ? '● Mostrando todas' : 'Ver detalle →'}
                      </span>
                    </button>

                    {/* Card 2: Asistió (Atendidas) */}
                    <button
                      type="button"
                      onClick={() => setFichaFilter(fichaFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
                      className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                        fichaFilter === 'COMPLETED'
                          ? 'bg-emerald-950 border-emerald-400 ring-2 ring-emerald-400/60 shadow-lg scale-[1.02]'
                          : 'bg-emerald-950/80 border-emerald-700/60 hover:border-emerald-500 hover:bg-emerald-900/60'
                      }`}
                      title="Click para filtrar citas asistidas"
                    >
                      <span className="text-[10px] text-emerald-400 uppercase font-semibold block flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> Asistió (Atendidas)
                      </span>
                      <span className="text-xl font-bold text-emerald-300 font-mono">
                        {selectedPatientStats.attended}
                      </span>
                      <span className="text-[9px] text-emerald-400 font-semibold block mt-0.5">
                        {fichaFilter === 'COMPLETED' ? '● Filtradas' : 'Ver detalle →'}
                      </span>
                    </button>

                    {/* Card 3: Canceló (Canceladas) */}
                    <button
                      type="button"
                      onClick={() => setFichaFilter(fichaFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
                      className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                        fichaFilter === 'CANCELLED'
                          ? 'bg-rose-950 border-rose-400 ring-2 ring-rose-400/60 shadow-lg scale-[1.02]'
                          : 'bg-rose-950/80 border-rose-700/60 hover:border-rose-500 hover:bg-rose-900/60'
                      }`}
                      title="Click para filtrar citas canceladas"
                    >
                      <span className="text-[10px] text-rose-400 uppercase font-semibold block flex items-center justify-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-400" /> Canceló (Canceladas)
                      </span>
                      <span className="text-xl font-bold text-rose-300 font-mono">
                        {selectedPatientStats.cancelled}
                      </span>
                      <span className="text-[9px] text-rose-400 font-semibold block mt-0.5">
                        {fichaFilter === 'CANCELLED' ? '● Filtradas' : 'Ver detalle →'}
                      </span>
                    </button>

                    {/* Card 4: Pendientes / Por Atender */}
                    <button
                      type="button"
                      onClick={() => setFichaFilter(fichaFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                      className={`rounded-xl p-2.5 text-center transition-all cursor-pointer border ${
                        fichaFilter === 'PENDING'
                          ? 'bg-sky-950 border-sky-400 ring-2 ring-sky-400/60 shadow-lg scale-[1.02]'
                          : 'bg-sky-950/80 border-sky-700/60 hover:border-sky-500 hover:bg-sky-900/60'
                      }`}
                      title="Click para filtrar citas pendientes por atender"
                    >
                      <span className="text-[10px] text-sky-400 uppercase font-semibold block flex items-center justify-center gap-1">
                        <Hourglass className="w-3 h-3 text-sky-400" /> Pendientes / Por Atender
                      </span>
                      <span className="text-xl font-bold text-sky-300 font-mono">
                        {selectedPatientStats.pending}
                      </span>
                      <span className="text-[9px] text-sky-400 font-semibold block mt-0.5">
                        {fichaFilter === 'PENDING' ? '● Filtradas' : 'Ver detalle →'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Recuento por Especialidades - Clickable */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    Citas Agendadas por Especialidad (Click para filtrar citas):
                  </span>
                  {selectedPatientStats.specialtyBreakdown.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No hay citas registradas para este paciente.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedPatientStats.specialtyBreakdown.map((item) => {
                        const isSelected = fichaFilter === `SPECIALTY:${item.specialty}`;
                        return (
                          <button
                            key={item.specialty}
                            type="button"
                            onClick={() =>
                              setFichaFilter(isSelected ? 'ALL' : `SPECIALTY:${item.specialty}`)
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-teal-900/90 border-teal-400 text-teal-200 ring-2 ring-teal-400/50 shadow-md scale-[1.03]'
                                : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750 text-slate-300'
                            }`}
                            title={`Click para filtrar citas de ${item.specialty}`}
                          >
                            <span className={isSelected ? 'text-teal-200 font-bold' : 'text-teal-300 font-medium'}>
                              {item.specialty}:
                            </span>
                            <span className="font-bold text-white bg-slate-700 px-2 py-0.5 rounded font-mono text-xs">
                              {item.count} {item.count === 1 ? 'cita' : 'citas'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* LISTA HISTÓRICA DE CITAS Y REPROGRAMACIÓN */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>
                      {fichaFilter === 'ALL' &&
                        `Historial Detallado de Citas del Paciente (${filteredFichaAppointments.length})`}
                      {fichaFilter === 'COMPLETED' &&
                        `Citas Asistidas / Atendidas (${filteredFichaAppointments.length})`}
                      {fichaFilter === 'CANCELLED' &&
                        `Citas Canceladas (${filteredFichaAppointments.length})`}
                      {fichaFilter === 'PENDING' &&
                        `Citas Pendientes / Por Atender (${filteredFichaAppointments.length})`}
                      {fichaFilter.startsWith('SPECIALTY:') &&
                        `Citas en Especialidad: ${fichaFilter.replace('SPECIALTY:', '')} (${filteredFichaAppointments.length})`}
                    </span>
                  </div>

                  {fichaFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setFichaFilter('ALL')}
                      className="text-xs text-teal-700 hover:text-teal-900 font-semibold underline cursor-pointer"
                    >
                      Mostrar todas ({selectedPatientStats.total})
                    </button>
                  )}
                </div>

                {filteredFichaAppointments.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                    No se encontraron citas con el filtro seleccionado.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredFichaAppointments.map((appt) => {
                      const isCompleted = (appt.status || appt.estado) === 'COMPLETED';
                      const isCancelled = (appt.status || appt.estado) === 'CANCELLED';

                      return (
                        <div
                          key={appt.id}
                          className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition ${
                            isCompleted
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : isCancelled
                              ? 'bg-rose-50/50 border-rose-200'
                              : 'bg-white border-slate-200 shadow-xs'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Fecha y Hora */}
                              <span className="font-mono font-bold bg-slate-900 text-teal-300 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-teal-400" />
                                {sanitizeDateString(appt.date || appt.fecha) || 'Fecha por definir'} • {sanitizeTimeString(appt.time || appt.hora)} hrs
                              </span>

                              {/* Especialidad */}
                              <span className="font-bold text-slate-900 flex items-center gap-1">
                                <span className="text-slate-500 font-medium">Especialidad:</span>{' '}
                                {appt.specialty || appt.especialidad}
                              </span>

                              {/* Estado */}
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  isCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isCancelled
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isCompleted
                                  ? 'Atendida / Asistió'
                                  : isCancelled
                                  ? 'Cancelada'
                                  : 'Pendiente / Programada'}
                              </span>
                            </div>

                            {/* Médico */}
                            <div className="text-slate-700 flex items-center gap-1.5 text-xs">
                              <Stethoscope className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                              <span>
                                <strong>Médico:</strong> {appt.doctorName || appt.medicoNombre}
                              </span>
                            </div>

                            {/* Motivo de consulta si existe */}
                            {(appt.notes || appt.motivoConsulta) && (
                              <div className="text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-200/80 max-w-xl">
                                <span className="font-semibold text-slate-800">Motivo:</span>{' '}
                                {appt.notes || appt.motivoConsulta}
                              </div>
                            )}
                          </div>

                          {/* Reprogramar Option for Analista & Admin */}
                          {canReschedule && onReschedule && !isCompleted && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => setAppointmentToReschedule(appt)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm self-end sm:self-center cursor-pointer"
                              title="Reprogramar esta cita"
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              <span>Reprogramar</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPatientForFicha(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REPROGRAMACIÓN DE CITA DESDE LA FICHA DEL PACIENTE               */}
      {/* ========================================================================= */}
      {appointmentToReschedule && onReschedule && (
        <RescheduleModal
          appointment={appointmentToReschedule}
          allAppointments={appointments}
          onClose={() => setAppointmentToReschedule(null)}
          onReschedule={async (id, data) => {
            await onReschedule(id, data);
            setAppointmentToReschedule(null);
          }}
        />
      )}
    </div>
  );
};

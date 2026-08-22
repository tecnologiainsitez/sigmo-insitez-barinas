import React, { useState, useEffect } from 'react';
import { Doctor, Specialty } from '../types';
import { INITIAL_DOCTORS, SPECIALTIES_LIST } from '../data/mockDoctors';
import { dbService } from '../services/indexedDB';
import {
  Stethoscope,
  UserPlus,
  Phone,
  Mail,
  Clock,
  MapPin,
  CheckCircle,
  ShieldAlert,
  PlusCircle,
  ListFilter,
  Sparkles,
  Edit2,
  X,
} from 'lucide-react';

interface DoctorsModuleProps {
  userRole: string;
}

export const DoctorsModule: React.FC<DoctorsModuleProps> = ({ userRole }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialtiesList, setSpecialtiesList] = useState<string[]>(SPECIALTIES_LIST);

  // Form states
  const [nombre, setNombre] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('Medicina General');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [horario, setHorario] = useState('08:00 - 14:00');
  const [consultorio, setConsultorio] = useState('Consultorio 101');
  const [telefono, setTelefono] = useState('+58 412 000 0000');
  const [email, setEmail] = useState('');
  const [mpps, setMpps] = useState('');
  const [impres, setImpres] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterSpecialty, setFilterSpecialty] = useState<string>('TODAS');

  const isReadOnly = userRole === 'MEDICO';

  // Load doctors and specialties from IndexedDB and server
  const loadDoctorsAndSpecialties = async () => {
    try {
      let allDocs = await dbService.getAllDoctors();
      
      // If local DB has no doctors or only mock doctors, pull real doctors from server
      if (allDocs.length === 0 && navigator.onLine) {
        try {
          const res = await fetch('/api/doctors?fresh=true');
          if (res.ok) {
            const serverDocs: Doctor[] = await res.json();
            if (Array.isArray(serverDocs) && serverDocs.length > 0) {
              await dbService.setAllDoctors(serverDocs);
              allDocs = serverDocs;
            }
          }
        } catch (netErr) {
          console.warn('Could not pull doctors from server:', netErr);
        }
      }

      setDoctors(allDocs);

      const allSpecs = await dbService.getAllSpecialties();
      setSpecialtiesList(allSpecs);
      if (allSpecs.length > 0 && !selectedSpecialty) {
        setSelectedSpecialty(allSpecs[0]);
      }
    } catch (e) {
      console.warn('Error loading doctors/specialties:', e);
    }
  };

  useEffect(() => {
    loadDoctorsAndSpecialties();

    const handleDBChange = () => {
      loadDoctorsAndSpecialties();
    };
    window.addEventListener('insitez_db_mutation', handleDBChange);
    return () => window.removeEventListener('insitez_db_mutation', handleDBChange);
  }, []);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    // Determine final specialty
    const finalSpecialty = isCustomMode && customSpecialty.trim()
      ? customSpecialty.trim()
      : selectedSpecialty || 'Medicina General';

    const newDocId = `DOC-${Date.now().toString().substring(5)}`;
    const newDoc: Doctor = {
      id: newDocId,
      nombre: nombre.trim(),
      name: nombre.trim(),
      especialidad: finalSpecialty,
      specialty: finalSpecialty,
      horarioAtencion: horario.trim() || '08:00 - 14:00',
      schedule: horario.trim() || '08:00 - 14:00',
      consultorio: consultorio.trim() || 'Consultorio 101',
      room: consultorio.trim() || 'Consultorio 101',
      telefono: telefono.trim(),
      phone: telefono.trim(),
      email: email.trim() || `${nombre.toLowerCase().replace(/[^a-z0-9]/g, '.')}@insitez.unellez.edu.ve`,
      mpps: mpps.trim() || '',
      impres: impres.trim() || '',
      mppsNumber: mpps.trim() || '',
      impresNumber: impres.trim() || '',
      estado: 'ACTIVO',
      active: true,
    };

    try {
      // 1. Save in local IndexedDB
      await dbService.saveDoctor(newDoc);
      // 2. Enqueue mutation for Google Sheets background sync
      await dbService.addDoctorMutation('CREATE', newDoc);
      // 3. Save specialty if custom
      if (isCustomMode && customSpecialty.trim()) {
        await dbService.saveSpecialty(customSpecialty.trim());
      }

      await loadDoctorsAndSpecialties();
      setSuccessMsg(`¡Médico ${nombre} registrado con éxito y sincronizado con Google Sheets!`);
      setNombre('');
      setEmail('');
      setMpps('');
      setImpres('');
      setCustomSpecialty('');
      setIsCustomMode(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving doctor:', err);
    }
  };

  const toggleStatus = async (id: string) => {
    if (isReadOnly) return;
    const target = doctors.find((d) => d.id === id);
    if (!target) return;

    const newEstado = target.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const updatedDoc: Doctor = {
      ...target,
      estado: newEstado,
      active: newEstado === 'ACTIVO',
    };

    try {
      await dbService.saveDoctor(updatedDoc);
      await dbService.addDoctorMutation('UPDATE', updatedDoc);
      await loadDoctorsAndSpecialties();
    } catch (e) {
      console.warn('Error toggling doctor status:', e);
    }
  };

  const filteredDoctors = filterSpecialty === 'TODAS'
    ? doctors
    : doctors.filter((d) => (d.especialidad || d.specialty) === filterSpecialty);

  return (
    <div className="space-y-6" id="doctors-module">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            Directorio de Médicos y Especialidades ({doctors.length})
          </h2>
          <p className="text-xs text-slate-500">
            Control de disponibilidad, consultorios asignados, especialidades dinámicas y sincronización bidireccional
          </p>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg font-medium">
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
            Modo Consulta
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form to add doctor (Only Analista & Admin) */}
        {!isReadOnly && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-teal-600" /> Registrar Nuevo Médico
              </h3>
            </div>

            <form onSubmit={handleAddDoctor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Dra. María Auxiliadora Gómez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800"
                />
              </div>

              {/* DUAL SPECIALTY SELECTOR: Existing vs Manual Input (like AppSheet) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Especialidad Médica *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline"
                  >
                    {isCustomMode ? (
                      <>
                        <ListFilter className="w-3 h-3" /> Seleccionar existente
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-3 h-3" /> + Nueva especialidad manual
                      </>
                    )}
                  </button>
                </div>

                {!isCustomMode ? (
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800 font-medium"
                  >
                    {specialtiesList.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      value={customSpecialty}
                      onChange={(e) => setCustomSpecialty(e.target.value)}
                      placeholder="Escriba la nueva especialidad (ej. Fisioterapia, Nutrición...)"
                      className="w-full px-3 py-2 border border-teal-400 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800 font-medium placeholder:font-normal"
                    />
                    <p className="text-[10px] text-teal-700 font-medium">
                      ✨ Modo AppSheet: Se agregará automáticamente al catálogo de especialidades.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Horario de Atención *</label>
                <input
                  type="text"
                  required
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  placeholder="Ej. 08:00 - 14:00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Consultorio / Box</label>
                <input
                  type="text"
                  value={consultorio}
                  onChange={(e) => setConsultorio(e.target.value)}
                  placeholder="Ej. Consultorio 104"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+58 412..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Correo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="medico@insitez.unellez.edu.ve"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">N° Registro MPPS</label>
                  <input
                    type="text"
                    value={mpps}
                    onChange={(e) => setMpps(e.target.value)}
                    placeholder="Ej. 84920"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">N° IMPRES / Colegio</label>
                  <input
                    type="text"
                    value={impres}
                    onChange={(e) => setImpres(e.target.value)}
                    placeholder="Ej. 12048"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 text-slate-800 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" /> Guardar y Sincronizar Médico
              </button>
            </form>
          </div>
        )}

        {/* Doctors Grid / Directory */}
        <div className={`${isReadOnly ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
          {/* Specialty Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto text-xs">
            <span className="font-bold text-slate-600 whitespace-nowrap">Filtrar:</span>
            <button
              type="button"
              onClick={() => setFilterSpecialty('TODAS')}
              className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                filterSpecialty === 'TODAS'
                  ? 'bg-teal-600 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todas ({doctors.length})
            </button>
            {specialtiesList.map((spec) => {
              const count = doctors.filter((d) => (d.especialidad || d.specialty) === spec).length;
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setFilterSpecialty(spec)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                    filterSpecialty === spec
                      ? 'bg-teal-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {spec} ({count})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredDoctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-teal-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{doc.nombre || doc.name}</h4>
                      <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block mt-0.5">
                        {doc.especialidad || doc.specialty}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleStatus(doc.id)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border transition ${
                        doc.estado === 'ACTIVO'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                      }`}
                    >
                      {doc.estado}
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 mt-2 border-t border-slate-100 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Horario: {doc.horarioAtencion || doc.schedule}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ubicación: {doc.consultorio || doc.room}</span>
                    </div>
                    {(doc.mpps || doc.impres || doc.mppsNumber || doc.impresNumber) && (
                      <div className="flex items-center gap-2 text-[11px] font-mono text-teal-900 bg-teal-50 px-2 py-1 rounded border border-teal-200">
                        {(doc.mpps || doc.mppsNumber) && <span><b>MPPS:</b> {doc.mpps || doc.mppsNumber}</span>}
                        {(doc.impres || doc.impresNumber) && <span><b>IMPRES:</b> {doc.impres || doc.impresNumber}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" /> {doc.telefono || doc.phone || 'N/A'}
                      <span className="mx-1">•</span>
                      <Mail className="w-3 h-3 text-slate-400" /> {doc.email || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-50">
                  <span>ID: {doc.id}</span>
                  <span className="text-teal-600 font-medium">Sincronizado</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Appointment, Doctor } from '../types';
import { INSITEZ_LOGO_URL, INSITEZ_LOGO_FALLBACK } from '../config/constants';
import { dbService, sanitizeDateString, sanitizeTimeString } from '../services/indexedDB';
import { Printer, X, FileText, ShieldCheck, Stethoscope, Pill, Activity, User } from 'lucide-react';

interface PrintMedicalRecordModalProps {
  appointment: Appointment;
  onClose: () => void;
}

export const PrintMedicalRecordModal: React.FC<PrintMedicalRecordModalProps> = ({
  appointment,
  onClose,
}) => {
  const [doctorInfo, setDoctorInfo] = useState<Doctor | null>(null);

  useEffect(() => {
    const normalizeName = (s: string) => {
      return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(dra?|doctora?)\b\.?/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    const fetchDoc = async () => {
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
            console.warn('Could not fetch doctors for print modal:', netErr);
          }
        }

        const docId = appointment.doctorId || appointment.medicoId;
        const rawDocName = (appointment.doctorName || appointment.medicoNombre || '').trim();
        const normDocName = normalizeName(rawDocName);

        const found = docs.find((d) => {
          if (docId && d.id === docId) return true;
          if (!normDocName) return false;
          const normDName = normalizeName(d.nombre || d.name || '');
          return (
            normDName === normDocName ||
            normDName.includes(normDocName) ||
            normDocName.includes(normDName)
          );
        });

        if (found) {
          setDoctorInfo(found);
        }
      } catch (e) {
        console.warn('Could not load doctor details for printing:', e);
      }
    };
    fetchDoc();
  }, [appointment]);

  const patientName = appointment.patientName || appointment.paciente || 'PACIENTE NO ESPECIFICADO';
  const patientDni = appointment.patientDni || appointment.cedula || 'N/A';
  const doctorName = appointment.doctorName || appointment.medicoNombre || doctorInfo?.nombre || doctorInfo?.name || 'Médico Especialista';
  const specialty = appointment.specialty || appointment.especialidad || doctorInfo?.especialidad || doctorInfo?.specialty || 'Medicina General';
  const date = sanitizeDateString(appointment.date || appointment.fecha);
  const time = sanitizeTimeString(appointment.time || appointment.hora);
  
  const doctorMpps = (appointment as any).mpps || (appointment as any).mppsNumber || (appointment as any).MPPS || doctorInfo?.mpps || doctorInfo?.mppsNumber || (doctorInfo as any)?.MPPS || '';
  const doctorImpres = (appointment as any).impres || (appointment as any).impresNumber || (appointment as any).IMPRES || doctorInfo?.impres || doctorInfo?.impresNumber || (doctorInfo as any)?.IMPRES || '';
  const consultorio = (appointment as any).consultorio || doctorInfo?.consultorio || doctorInfo?.room || 'Consultorio 101';

  const idx = (appointment.idx || appointment.dx || appointment.diagnostico || '').trim();
  const treatment = (appointment.treatment || appointment.tratamiento || '').trim();
  const diseaseNotes = (
    appointment.diseaseNotes ||
    appointment.notasEnfermedad ||
    appointment.observacionesMedicas ||
    appointment.motivoConsulta ||
    appointment.notes ||
    ''
  ).trim();

  const medicalHistory = appointment.patientMedicalHistory || appointment.historiaMedica || 'Afiliado INSITEZ UNELLEZ';
  const phone = appointment.patientPhone || appointment.telefono || 'No registrado';
  const email = appointment.patientEmail || appointment.email || 'No registrado';

  const handlePrint = () => {
    window.print();
  };

  const modalJSX = (
    <div
      id="print-medical-record-portal"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:m-0 print:bg-white print:static print:overflow-visible print:block"
    >
      {/* Modal Card with Printable Container ID */}
      <div 
        id="printable-medical-record-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col my-4 print:my-0 print:border-none print:shadow-none print:max-w-none print:w-full print:overflow-visible"
      >
        
        {/* Modal Toolbar (hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-sm">Impresión de Evolución Médica, IDx y Récipe</h3>
              <p className="text-[11px] text-slate-300">INSITEZ UNELLEZ - Sede Central Barinas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="p-6 sm:p-8 bg-white text-slate-900 print:p-0 print:m-0 space-y-5" id="printable-medical-record">
          
          {/* Institutional Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="bg-white p-1 rounded-xl border border-slate-300 inline-flex items-center justify-center flex-shrink-0">
                <img
                  src={INSITEZ_LOGO_URL}
                  alt="INSITEZ Logo"
                  referrerPolicy="no-referrer"
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src !== window.location.origin + INSITEZ_LOGO_FALLBACK && !target.src.endsWith(INSITEZ_LOGO_FALLBACK)) {
                      target.src = INSITEZ_LOGO_FALLBACK;
                    }
                  }}
                />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                  INSITEZ UNELLEZ
                </h1>
                <p className="text-xs font-bold text-slate-800 leading-tight">
                  Instituto de Salud Integral de los Trabajadores de la UNELLEZ
                </p>
                <p className="text-[11px] text-slate-600">
                  Universidad Nacional Experimental de los Llanos Occidentales &ldquo;Ezequiel Zamora&rdquo;
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  Sede Central Barinas, Venezuela • RIF: G-20000080-0
                </p>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="inline-block border border-slate-900 px-3 py-1.5 rounded-lg bg-slate-50 text-right">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Folio / Cita N°</div>
                <div className="text-xs font-black font-mono text-slate-900">{appointment.id || 'CITA-INSITEZ'}</div>
                <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                  Fecha: <span className="font-bold">{date}</span> | {time} hrs
                </div>
              </div>
            </div>
          </div>

          {/* Subheader Document Title */}
          <div className="text-center bg-slate-100 py-1.5 px-4 rounded-lg border border-slate-200">
            <h2 className="text-xs sm:text-sm font-black tracking-wider uppercase text-slate-800">
              INFORME CLÍNICO DE ATENCIÓN MÉDICA, EVOLUCIÓN Y TRATAMIENTO
            </h2>
          </div>

          {/* Patient and Doctor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
            {/* Patient Box */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Datos del Paciente</span>
              </div>
              <div><span className="text-slate-500 font-medium">Nombre y Apellido:</span> <strong className="text-slate-900 uppercase">{patientName}</strong></div>
              <div><span className="text-slate-500 font-medium">Cédula de Identidad:</span> <strong className="font-mono text-slate-900">{patientDni}</strong></div>
              <div><span className="text-slate-500 font-medium">Historia Médica / Condición:</span> <span className="text-slate-800 font-medium">{medicalHistory}</span></div>
              <div><span className="text-slate-500 font-medium">Teléfono:</span> <span className="text-slate-800">{phone}</span></div>
              {email !== 'No registrado' && (
                <div><span className="text-slate-500 font-medium">Correo:</span> <span className="text-slate-800">{email}</span></div>
              )}
            </div>

            {/* Doctor Box */}
            <div className="space-y-1.5">
              <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                <span>Datos del Especialista Tratante</span>
              </div>
              <div><span className="text-slate-500 font-medium">Médico:</span> <strong className="text-slate-900">{doctorName}</strong></div>
              <div><span className="text-slate-500 font-medium">Especialidad:</span> <strong className="text-emerald-800">{specialty}</strong></div>
              <div>
                <span className="text-slate-500 font-medium">Registro Sanitario:</span>{' '}
                <strong className="font-mono text-slate-900">
                  MPPS: {doctorMpps || 'No reg.'} {doctorImpres ? `• IMPRES: ${doctorImpres}` : ''}
                </strong>
              </div>
              <div><span className="text-slate-500 font-medium">Ubicación / Consultorio:</span> <span className="text-slate-800">{consultorio}</span></div>
              <div><span className="text-slate-500 font-medium">Estado de Consulta:</span> <span className="font-bold text-emerald-700 font-mono">{appointment.status === 'COMPLETED' ? 'ATENDIDO / REGISTRADO' : (appointment.status || 'CONFIRMADO')}</span></div>
            </div>
          </div>

          {/* Section 1: IDx (Diagnóstico) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Impresión Diagnóstica (IDx / Diagnóstico Clínico)</span>
            </div>
            <div className="p-3.5 bg-white">
              {idx ? (
                <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {idx}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No se registró impresión diagnóstica específica para esta consulta.
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Evolución Médica */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>2. Evolución Clínica y Notas Médicas</span>
            </div>
            <div className="p-3.5 bg-white">
              {diseaseNotes ? (
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {diseaseNotes}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Sin notas de evolución o sintomatología reportadas en la ficha.
                </p>
              )}
            </div>
          </div>

          {/* Section 3: Tratamiento e Indicaciones (Récipe) */}
          <div className="border-2 border-emerald-600 rounded-xl overflow-hidden">
            <div className="bg-emerald-700 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-white" />
                <span>3. Plan Terapéutico, Tratamiento e Indicaciones Médicas (Récipe)</span>
              </div>
              <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded font-mono">INSITEZ FARMACIA</span>
            </div>
            <div className="p-3.5 bg-emerald-50/30">
              {treatment ? (
                <div className="text-xs sm:text-sm text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                  {treatment}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No se prescribieron medicamentos o indicaciones terapéuticas adicionales.
                </p>
              )}
            </div>
          </div>

          {/* Signature and Stamp Footer */}
          <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 items-end text-center">
            {/* Verification Badge */}
            <div className="text-left text-[10px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Documento Oficial SIGMO_BARINAS</span>
              </div>
              <p>Registro emitido conforme a las normativas de salud integral de la UNELLEZ.</p>
              <p className="font-mono text-[9px] text-slate-400">UUID: {appointment.id} • Emisión: {new Date().toLocaleString()}</p>
            </div>

            {/* Doctor Signature Line */}
            <div className="flex flex-col items-center">
              <div className="w-52 border-b-2 border-slate-900 mb-1.5"></div>
              <div className="text-xs font-bold text-slate-900">{doctorName}</div>
              <div className="text-[10px] text-slate-600 font-medium">{specialty}</div>
              <div className="text-[9px] font-mono text-slate-700 font-semibold">
                MPPS N°: {doctorMpps || 'N/A'} {doctorImpres ? `| IMPRES: ${doctorImpres}` : ''}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">Firma y Sello del Especialista</div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions (hidden on print) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500">
            Presione <strong>Imprimir</strong> para generar en papel o exportar como archivo PDF.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#1a56db] hover:bg-[#1648bd] text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Documento</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalJSX, document.body);
};

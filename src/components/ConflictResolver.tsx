import React, { useState } from 'react';
import { Appointment } from '../types';
import { AlertTriangle, Clock, Calendar, User, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

interface ConflictResolverProps {
  conflictingAppointments?: Appointment[];
  conflicts?: Appointment[];
  onResolveConflict: (
    appointmentId: any,
    action: any,
    newDate?: string,
    newTime?: string
  ) => Promise<void>;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflictingAppointments = [],
  conflicts = [],
  onResolveConflict,
}) => {
  const items = conflictingAppointments.length > 0 ? conflictingAppointments : conflicts;
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('12:00');

  if (items.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center shadow-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">¡Sin Conflictos de Agenda!</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Todas las mutaciones agendadas offline han sido procesadas o resueltas atómicamente por el servidor central sin colisiones de horario.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce" />
            Resolución de Conflictos de Horario ({conflictingAppointments.length})
          </h2>
          <p className="text-xs text-amber-800">
            Citas agendadas offline que colisionaron con citas previas del mismo médico al sincronizar
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {conflictingAppointments.map((appt) => (
          <div key={appt.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded">
                  COLISIÓN DETECTADA
                </span>
                <span className="text-xs font-mono text-slate-400">ID: {appt.id}</span>
              </div>

              <div className="text-sm font-bold text-slate-900">{appt.patientName}</div>
              <div className="text-xs text-slate-600">
                Especialidad: <span className="font-semibold text-teal-700">{appt.specialty}</span> ({appt.doctorName})
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-3 pt-1 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> {appt.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {appt.time} hrs
                </span>
              </div>

              {appt.conflictDetails && (
                <div className="bg-amber-100/60 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900 font-medium mt-2">
                  ⚠️ {appt.conflictDetails}
                </div>
              )}
            </div>

            {/* Actions for conflict */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              <button
                onClick={() => {
                  setSelectedAppt(appt);
                  setNewDate(appt.date);
                  setNewTime('12:00');
                }}
                className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reprogramar Cita
              </button>

              <button
                onClick={() => onResolveConflict(appt.id, 'ACCEPT_OVERRIDE')}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                Forzar Sobrecupo
              </button>

              <button
                onClick={() => onResolveConflict(appt.id, 'CANCEL')}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancelar Cita
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reschedule Modal */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-teal-600" />
              Reprogramar Cita: {selectedAppt.patientName}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nueva Fecha</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nueva Hora</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedAppt(null)}
                className="px-3 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onResolveConflict(selectedAppt.id, 'RESCHEDULE', newDate, newTime);
                  setSelectedAppt(null);
                }}
                className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                Guardar y Re-Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

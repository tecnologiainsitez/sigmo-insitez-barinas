import React, { useState } from 'react';
import { MutationItem } from '../types';
import {
  Database,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertOctagon,
  Trash2,
  Code2,
  Terminal,
  Activity,
  Layers,
} from 'lucide-react';

interface SyncQueueInspectorProps {
  pendingQueue: MutationItem[];
  allQueueHistory: MutationItem[];
  isOnline: boolean;
  isSyncing: boolean;
  forceSync: () => void;
  clearLocalDatabase: () => void;
  syncLogs: string[];
}

export const SyncQueueInspector: React.FC<SyncQueueInspectorProps> = ({
  pendingQueue,
  allQueueHistory,
  isOnline,
  isSyncing,
  forceSync,
  clearLocalDatabase,
  syncLogs,
}) => {
  const [selectedMutation, setSelectedMutation] = useState<MutationItem | null>(null);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Mutaciones Pendientes</div>
            <div className="text-2xl font-extrabold text-amber-600 mt-0.5">
              {pendingQueue.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Encoladas en IndexedDB</div>
          </div>
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Histórico en Cola Local</div>
            <div className="text-2xl font-extrabold text-slate-800 mt-0.5">
              {allQueueHistory.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Sincronizadas o procesadas</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-medium">Estado de Sincronización</div>
            <div className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
              {isOnline ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Listo para Sincronizar
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertOctagon className="w-4 h-4" /> Guardando en Local
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {isOnline ? 'Conexión activa con /api/sync' : 'Red desconectada'}
            </div>
          </div>
          <div className="bg-teal-50 p-3 rounded-xl border border-teal-200 text-teal-600">
            <Database className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Queue Inspector Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />
              Inspector de la Cola de Mutaciones (IndexedDB `sync_queue`)
            </h2>
            <p className="text-xs text-slate-500">
              Estructura real del motor de cola offline procesada en orden cronológico (created_at UTC)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={forceSync}
              disabled={!isOnline || isSyncing}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Drenar Cola Manualmente
            </button>

            <button
              onClick={() => {
                if (confirm('¿Limpiar toda la base de datos IndexedDB local?')) {
                  clearLocalDatabase();
                }
              }}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar IndexedDB
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID Mutación</th>
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Paciente & Cita</th>
                <th className="py-3 px-4">Timestamp UTC</th>
                <th className="py-3 px-4">Estado en Cola</th>
                <th className="py-3 px-4 text-right">Ver Payload JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allQueueHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No hay mutaciones registradas en la cola de IndexedDB.
                  </td>
                </tr>
              ) : (
                allQueueHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {item.id}
                      <div className="text-[10px] text-slate-400">Dev: {item.originDevice}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          item.action === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.action === 'CANCEL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        {item.action}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {item.payload?.appointment?.patientName || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.payload?.appointment?.specialty} ({item.payload?.appointment?.time} hrs)
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {item.timestamp_utc}
                    </td>

                    <td className="py-3 px-4">
                      {item.status === 'PENDING' ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full flex items-center gap-1 w-fit">
                          <Clock className="w-3 h-3 text-amber-600" /> PENDING
                        </span>
                      ) : item.status === 'SYNCED' ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3 text-emerald-600" /> SYNCED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-800 border border-red-300 rounded-full flex items-center gap-1 w-fit">
                          <AlertOctagon className="w-3 h-3 text-red-600" /> CONFLICT
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedMutation(item)}
                        className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-slate-100 rounded transition flex items-center gap-1 ml-auto"
                      >
                        <Code2 className="w-4 h-4" />
                        <span className="text-[11px] font-medium">Inspeccionar</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Event Console Log */}
      <div className="bg-slate-900 rounded-xl p-4 text-slate-200 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-teal-400">
            <Terminal className="w-4 h-4" />
            Consola de Sincronización en Tiempo Real (`useOfflineSync`)
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Logs de evento del cliente</span>
        </div>

        <div className="font-mono text-[11px] space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {syncLogs.length === 0 ? (
            <div className="text-slate-600 italic">Esperando eventos de sincronización...</div>
          ) : (
            syncLogs.map((log, index) => (
              <div key={index} className="text-slate-300 hover:text-teal-300 transition">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* JSON Payload Modal */}
      {selectedMutation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 text-white rounded-xl max-w-2xl w-full border border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2 text-teal-400">
                <Code2 className="w-4 h-4" />
                Objeto Mutación ID: {selectedMutation.id}
              </h3>
              <button
                onClick={() => setSelectedMutation(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 bg-slate-800 rounded"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="p-4">
              <pre className="font-mono text-xs text-teal-300 bg-slate-950 p-4 rounded-lg overflow-x-auto max-h-96 border border-slate-800">
                {JSON.stringify(selectedMutation, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

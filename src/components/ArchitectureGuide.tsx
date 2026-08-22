import React from 'react';
import { Database, Server, Wifi, RefreshCw, Bell, ShieldCheck, Terminal, ArrowRight } from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Intro Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 rounded-2xl shadow-lg border border-slate-800">
        <h2 className="text-xl font-extrabold text-teal-400 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-teal-400" />
          Arquitectura Offline-First y Notificaciones Multicanal
        </h2>
        <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
          Prototipo funcional (PoC) para la gestión de citas en centros de salud con disponibilidad crítica. Permite la continuidad operativa ininterrumpida en recepción incluso en fallos de conectividad mediante persistencia en IndexedDB y cola de mutaciones asíncrona.
        </p>
      </div>

      {/* 4 Pillars of Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="bg-teal-50 text-teal-700 p-2.5 rounded-lg w-fit">
            <Database className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            1. Escritura Optimista
          </h3>
          <p className="text-xs text-slate-600 leading-normal">
            Cualquier agendamiento o cambio de estado se persiste instantáneamente en la base de datos IndexedDB local (`appointments` store) y se refleja de inmediato en la UI sin esperar confirmación del servidor.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="bg-amber-50 text-amber-700 p-2.5 rounded-lg w-fit">
            <RefreshCw className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            2. Cola de Mutaciones
          </h3>
          <p className="text-xs text-slate-600 leading-normal">
            Cada operación genera un objeto en `sync_queue`: <br />
            <code className="text-[10px] bg-slate-100 p-1 rounded font-mono block mt-1">
              {'{ id, action, payload, timestamp_utc, status }'}
            </code>
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="bg-indigo-50 text-indigo-700 p-2.5 rounded-lg w-fit">
            <Server className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            3. Resolución de Conflictos
          </h3>
          <p className="text-xs text-slate-600 leading-normal">
            El backend procesa atómicamente la cola en orden cronológico (<code className="text-[10px]">timestamp_utc ASC</code>). Si hay colisión de médico y horario, la marca UTC más antigua prevalece. La otra se marca como `CONFLICT_PENDING`.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg w-fit">
            <Bell className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            4. Worker Multicanal
          </h3>
          <p className="text-xs text-slate-600 leading-normal">
            Al confirmar una cita, el backend genera dinámicamente un archivo iCalendar (.ics) RFC 5545 y construye la tarjeta interactiva JSON Card V2 para el Webhook de Google Chat.
          </p>
        </div>
      </div>

      {/* Step-by-Step Test Guide */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-600" />
          Instrucciones para Probar la Simulación Offline/Online
        </h3>

        <ol className="space-y-3 text-xs text-slate-700 list-decimal list-inside leading-relaxed">
          <li className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Paso 1 - Activar Modo Offline:</strong> En la barra superior, active el interruptor{' '}
            <span className="bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded">
              "Simular Modo Offline"
            </span>{' '}
            o desconecte su red en DevTools (pestaña Network -&gt; Offline).
          </li>

          <li className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Paso 2 - Crear Citas Sin Conexión:</strong> En la pestaña "Agendamiento y Citas", complete el formulario para un paciente y haga clic en "Confirmar Cita". Observará que la cita aparece instantáneamente en la tabla con el badge <span className="bg-amber-100 text-amber-900 px-1 py-0.5 font-mono text-[10px] rounded">IndexedDB Local</span>.
          </li>

          <li className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Paso 3 - Inspeccionar la Cola Local:</strong> Diríjase a la pestaña "Cola IndexedDB (Sync Queue)" para verificar las mutaciones pendientes guardadas en IndexedDB.
          </li>

          <li className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Paso 4 - Reconectar y Sincronizar:</strong> Desactive el interruptor de modo offline o presione "Forzar Sincronización". La cola se drenará automáticamente en orden cronológico hacia <code className="bg-slate-200 px-1 rounded font-mono text-[11px]">POST /api/sync</code>.
          </li>

          <li className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Paso 5 - Verificar Notificaciones:</strong> En la pestaña "Notificaciones", examine los correos con adjuntos <code className="bg-slate-200 px-1 rounded font-mono text-[11px]">.ics</code> y la tarjeta interactiva <code className="bg-slate-200 px-1 rounded font-mono text-[11px]">Google Chat Card V2</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { NotificationLog, Appointment } from '../types';
import { safeParseDate } from '../utils/dateUtils';
import {
  Bell,
  Mail,
  MessageSquare,
  Download,
  Send,
  Code,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Shield,
  ShieldCheck,
  Lock,
  UserCheck,
  Info,
  Sparkles,
} from 'lucide-react';

interface NotificationInspectorProps {
  appointments?: Appointment[];
  serverAppointments?: Appointment[];
}

export const NotificationInspector: React.FC<NotificationInspectorProps> = ({
  appointments = [],
  serverAppointments = [],
}) => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [copied, setCopied] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('maria.lopez@example.com');
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingTestWebhook, setSendingTestWebhook] = useState(false);

  const fetchNotificationLogs = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return; // Skip polling while offline
    }
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
          if (data.length > 0 && !selectedLog) {
            setSelectedLog(data[0]);
          }
        }
      }
    } catch (err) {
      // Quiet fail during server restart or offline transitions
      console.warn('[NotificationInspector] Sincronizando registros en próximo ciclo.');
    }
  };

  useEffect(() => {
    fetchNotificationLogs();
    const interval = setInterval(fetchNotificationLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyPayload = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestDirectChat = async () => {
    const emailToTest = (recipientEmail || '').trim();
    if (!emailToTest) return;
    setSendingTestWebhook(true);
    setWebhookStatusMsg(null);

    try {
      // 1. Check if appointments array is defined and search for patient by email
      const safeAppointments = Array.isArray(serverAppointments) ? serverAppointments : [];
      let targetAppt = safeAppointments.find((a) => {
        if (!a) return false;
        const apptEmail = (a.patientEmail || a.email || '').trim().toLowerCase();
        return apptEmail === emailToTest.toLowerCase();
      });

      let infoNotice = '';

      // 2. If no appointment is found for that email, generate a generic test appointment payload
      if (!targetAppt) {
        if (safeAppointments.length > 0 && safeAppointments[0]) {
          targetAppt = {
            ...safeAppointments[0],
            patientEmail: emailToTest.includes('@') ? emailToTest : `${emailToTest}@paciente.com`,
          };
          infoNotice = ' (No se encontraron citas activas para este correo. Se enviará una tarjeta de prueba genérica).';
        } else {
          // Complete fallback generic test appointment object
          const patientDisplayName = emailToTest.includes('@')
            ? emailToTest.split('@')[0].replace('.', ' ')
            : 'Paciente de Prueba';
          const patientSafeEmail = emailToTest.includes('@') ? emailToTest : `${emailToTest}@paciente.com`;
          const today = new Date().toISOString().split('T')[0];
          const nowUtc = new Date().toISOString();

          targetAppt = {
            id: 'appt_test_' + Date.now().toString().substring(6),
            paciente: patientDisplayName,
            patientName: patientDisplayName,
            cedula: '0801199012345',
            patientDni: '0801199012345',
            email: patientSafeEmail,
            patientEmail: patientSafeEmail,
            telefono: '+52 55 1234 5678',
            patientPhone: '+52 55 1234 5678',
            medicoId: 'DOC-001',
            doctorId: 'DOC-001',
            medicoNombre: 'Dr. Alejandro Morales',
            doctorName: 'Dr. Alejandro Morales',
            especialidad: 'Medicina General',
            specialty: 'Medicina General',
            fecha: today,
            date: today,
            hora: '10:00',
            time: '10:00',
            durationMinutes: 30,
            estado: 'CONFIRMED',
            status: 'CONFIRMED',
            motivoConsulta: 'Prueba de envío de Card V2 a Chat Directo Privado (1 a 1)',
            notes: 'Prueba de envío de Card V2 a Chat Directo Privado (1 a 1)',
            historiaMedica: 'Sin antecedentes clínicos de riesgo reportados.',
            patientMedicalHistory: 'Sin antecedentes clínicos de riesgo reportados.',
            creadoPor: 'Sistema Notificaciones',
            fechaRegistroUtc: nowUtc,
            createdAtUtc: nowUtc,
            originDevice: 'Inspector de Notificaciones',
            syncState: 'SYNCED',
          };
          infoNotice = ' (No se encontraron citas activas para este correo. Se enviará una tarjeta de prueba genérica).';
        }
      }

      const res = await fetch('/api/test-google-chat-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: emailToTest, appointment: targetAppt }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setWebhookStatusMsg({
          type: 'success',
          text: `¡Tarjeta Google Chat Card V2 enviada exitosamente al Chat Privado Directo (1 a 1) de: ${emailToTest}!${infoNotice}`,
        });
      } else {
        setWebhookStatusMsg({
          type: 'error',
          text: result?.error || 'Error al procesar envío al Chat Privado.',
        });
      }
    } catch (err: any) {
      setWebhookStatusMsg({
        type: 'error',
        text: err?.message || 'Error de conexión con el servidor',
      });
    } finally {
      setSendingTestWebhook(false);
      fetchNotificationLogs();
    }
  };

  // Render Google Chat Card Preview visually
  const renderGoogleChatCardVisual = (jsonPayloadString: string) => {
    try {
      if (!jsonPayloadString || typeof jsonPayloadString !== 'string') {
        return <div className="text-slate-400 text-xs">Sin contenido de payload.</div>;
      }

      const cardData = JSON.parse(jsonPayloadString);
      // 3. Ensure cardsV2 array is defined before accessing [0]
      const cardsList = Array.isArray(cardData?.cardsV2) ? cardData.cardsV2 : [];
      const card = cardsList.length > 0 && cardsList[0] ? cardsList[0].card : null;

      if (!card) {
        return (
          <div className="text-slate-400 text-xs p-3 bg-slate-900 rounded-lg">
            No se encontró definición de Card V2 en este payload.
          </div>
        );
      }

      const header = card.header;
      const sections = Array.isArray(card.sections) ? card.sections : [];
      const recipient = cardData?.recipient?.email || cardData?.recipient?.name || 'paciente@salud.com';

      return (
        <div className="bg-[#1f1f1f] text-white rounded-2xl border border-slate-700/80 p-4 max-w-lg shadow-xl font-sans space-y-3">
          {/* Direct Message Security Pill */}
          <div className="bg-teal-950/80 border border-teal-700/60 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-teal-300 font-semibold">
              <Lock className="w-3.5 h-3.5 text-teal-400" />
              <span>Chat Directo Privado (1 a 1)</span>
            </div>
            <span className="text-[11px] font-mono text-teal-200 bg-teal-900/60 px-2 py-0.5 rounded">
              {recipient}
            </span>
          </div>

          {/* Card Header */}
          <div className="flex items-start gap-3 pb-3 border-b border-slate-700">
            <div className="bg-teal-600/30 text-teal-300 p-2 rounded-full border border-teal-500/40">
              <span className="text-xl">🏥</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{header?.title || 'Cita Médica'}</div>
              <div className="text-xs text-slate-400">{header?.subtitle || 'Centro de Salud Central'}</div>
            </div>
          </div>

          {/* Card Sections */}
          <div className="py-2 space-y-3">
            {sections.map((sec: any, idx: number) => (
              <div key={idx} className="space-y-2">
                {sec.header && (
                  <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                    {sec.header}
                  </div>
                )}

                {sec.widgets?.map((w: any, widx: number) => {
                  if (w.decoratedText) {
                    const dt = w.decoratedText;
                    return (
                      <div key={widx} className="bg-[#2a2a2a] p-2.5 rounded-lg border border-slate-800 text-xs">
                        {dt.topLabel && <div className="text-[10px] text-slate-400">{dt.topLabel}</div>}
                        <div
                          className="text-slate-100 font-medium"
                          dangerouslySetInnerHTML={{ __html: dt.text }}
                        />
                        {dt.bottomLabel && <div className="text-[10px] text-slate-400">{dt.bottomLabel}</div>}
                      </div>
                    );
                  }

                  if (w.buttonList) {
                    return (
                      <div key={widx} className="flex flex-wrap gap-2 pt-2">
                        {w.buttonList.buttons.map((btn: any, bidx: number) => (
                          <a
                            key={bidx}
                            href={btn.onClick?.openLink?.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                          >
                            {btn.text}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ))}
          </div>
        </div>
      );
    } catch (e) {
      return <div className="text-slate-400 text-xs">JSON inviabilidad de formateo.</div>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Privacy Banner Note */}
      <div className="bg-gradient-to-r from-teal-950/90 via-slate-900 to-indigo-950/90 border border-teal-800/60 rounded-2xl p-4 sm:p-5 text-white shadow-md">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Garantía de Confidencialidad Médica (Google Chat Directo 1 a 1)</span>
              <span className="text-[10px] bg-teal-900/90 text-teal-300 border border-teal-700 px-2 py-0.5 rounded-full font-mono">
                Privado & Seguro
              </span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              A diferencia de los Espacios o Canales compartidos de Google Chat donde otros miembros podrían visualizar datos clínicos protegidos, este módulo enruta las tarjetas interactivas <b>Card V2 exclusivamente al Mensaje Directo Privado (1 a 1)</b> del paciente o usuario. Esto asegura el estricto cumplimiento del <b>secreto médico y la privacidad de la historia clínica</b>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Generated Notifications */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                Historial de Notificaciones ({logs.length})
              </h2>
              <p className="text-xs text-slate-500">Correos .ics y Mensajes Directos Google Chat</p>
            </div>
            <button
              onClick={fetchNotificationLogs}
              className="p-1.5 text-slate-500 hover:text-teal-600 rounded transition"
              title="Actualizar lista"
            >
              🔄
            </button>
          </div>

          <div className="divide-y divide-slate-200 overflow-y-auto max-h-[600px]">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No se han emitido notificaciones aún. Registre una cita médica para disparar el worker.
              </div>
            ) : (
              logs.map((log) => {
                const isChat = log.type === 'GOOGLE_CHAT_CARD' || log.type === 'GOOGLE_CHAT_WEBHOOK';
                const recipientEmailDisplay = log.recipient || 'paciente@salud.com';

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      selectedLog?.id === log.id ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1 ${
                          log.type === 'EMAIL_ICS'
                            ? 'bg-sky-100 text-sky-800 border border-sky-300'
                            : 'bg-teal-100 text-teal-900 border border-teal-300'
                        }`}
                      >
                        {log.type === 'EMAIL_ICS' ? (
                          <Mail className="w-3 h-3" />
                        ) : (
                          <Lock className="w-3 h-3 text-teal-700" />
                        )}
                        {log.type === 'EMAIL_ICS'
                          ? 'EMAIL (.ICS)'
                          : `GOOGLE CHAT DIRECTO (PRIVADO) - ${recipientEmailDisplay}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {safeParseDate(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-slate-800 mt-1.5 line-clamp-1">
                      {isChat ? `GOOGLE CHAT DIRECTO (PRIVADO) - ${recipientEmailDisplay}` : log.subjectOrTitle}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      {isChat && <Lock className="w-3 h-3 text-teal-600 flex-shrink-0" />}
                      <span>Para: <span className="font-mono text-slate-700 font-medium">{log.recipient}</span></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Inspector & Direct Chat Tester */}
        <div className="lg:col-span-7 space-y-6">
          {/* Live Direct Chat Message Tester Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-teal-600" />
                Probar Envío de Tarjeta a Google Chat Privado (1 a 1)
              </h3>
              <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Chat Privado
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Ingrese la dirección de correo o ID de Google Chat del paciente para simular o despachar la tarjeta interactiva directamente a su conversación confidencial:
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Dirección de Correo Electrónico o ID de Google Chat del Destinatario (Chat Privado):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="ej. paciente.maria@gmail.com o users/maria.lopez@salud.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-slate-800 font-mono"
                  />
                </div>
                <button
                  onClick={handleSendTestDirectChat}
                  disabled={!recipientEmail.trim() || sendingTestWebhook}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:bg-slate-300 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer whitespace-nowrap"
                >
                  {sendingTestWebhook ? (
                    <>
                      <span>Despachando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Enviar al Chat Privado</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick autofill sample patient chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[11px] text-slate-400">Ejemplos rápidos:</span>
                <button
                  type="button"
                  onClick={() => setRecipientEmail('gerickssond@gmail.com')}
                  className="text-[10px] bg-blue-50 hover:bg-blue-100 text-[#1a56db] font-bold px-2 py-0.5 rounded border border-blue-200 transition font-mono"
                >
                  gerickssond@gmail.com
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientEmail('maria.lopez@example.com')}
                  className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition font-mono"
                >
                  maria.lopez@example.com
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientEmail('jose.rodriguez@example.com')}
                  className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition font-mono"
                >
                  jose.rodriguez@example.com
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientEmail('ana.gomez@example.com')}
                  className="text-[10px] bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 px-2 py-0.5 rounded border border-slate-200 transition font-mono"
                >
                  ana.gomez@example.com
                </button>
              </div>
            </div>

            {webhookStatusMsg && (
              <div
                className={`mt-3 p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  webhookStatusMsg.type === 'success'
                    ? 'bg-teal-50 text-teal-900 border border-teal-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {webhookStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-teal-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                )}
                <span>{webhookStatusMsg.text}</span>
              </div>
            )}
          </div>

          {/* Payload Detail & Visual Rendering */}
          {selectedLog ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-600" />
                    Inspección de Payload: {selectedLog.type === 'EMAIL_ICS' ? 'Correo con .ICS' : 'Google Chat Privado (Card V2)'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">Destinatario: {selectedLog.recipient}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyPayload(selectedLog.payload)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? '¡Copiado!' : 'Copiar Payload'}
                  </button>

                  {selectedLog.type === 'EMAIL_ICS' && (
                    <a
                      href={`data:text/calendar;charset=utf-8,${encodeURIComponent(selectedLog.payload)}`}
                      download="cita_medica.ics"
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium rounded-lg flex items-center gap-1 transition shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar .ICS
                    </a>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Visual Interactive Rendering for Google Chat */}
                {(selectedLog.type === 'GOOGLE_CHAT_CARD' || selectedLog.type === 'GOOGLE_CHAT_WEBHOOK') && (
                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-teal-600" />
                      <span>Vista Previa Interactiva de la Tarjeta (Entregada en Chat Privado 1 a 1):</span>
                    </div>
                    {renderGoogleChatCardVisual(selectedLog.payload)}
                  </div>
                )}

                {/* Raw Payload Inspector */}
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-1">
                    Código Raw de Salida ({selectedLog.type === 'EMAIL_ICS' ? 'Standard RFC 5545 iCalendar .ics' : 'JSON Card V2 Payload con Metadatos de Chat Privado'}):
                  </div>
                  <pre className="font-mono text-xs text-teal-300 bg-slate-900 p-4 rounded-xl overflow-x-auto max-h-80 border border-slate-800">
                    {selectedLog.payload}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
              Seleccione una notificación a la izquierda para inspeccionar su payload.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


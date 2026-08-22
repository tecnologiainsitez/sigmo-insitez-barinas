import { Appointment } from '../src/types';

/**
 * Generates an iCalendar (.ics) string according to RFC 5545 standard
 * for transactional email appointment invitations.
 * Bulletproof against missing, invalid, or malformed date and time strings.
 */
export function generateICS(appointment: Partial<Appointment>): string {
  if (!appointment) return '';

  const dateStr = String(appointment.date || (appointment as any).fecha || '').trim();
  const timeStr = String(appointment.time || (appointment as any).hora || '08:00').trim();

  // Extract year, month, day safely
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;
  let day = new Date().getDate();

  const isoMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const latinMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (latinMatch) {
    day = parseInt(latinMatch[1], 10);
    month = parseInt(latinMatch[2], 10);
    year = parseInt(latinMatch[3], 10);
  }

  // Extract hours and minutes safely
  let hours = 8;
  let minutes = 0;
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
  }

  let startDate: Date;
  try {
    startDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    if (isNaN(startDate.getTime())) {
      startDate = new Date();
    }
  } catch {
    startDate = new Date();
  }

  const duration = Number(appointment.durationMinutes) || 30;
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

  const formatDate = (date: Date): string => {
    try {
      if (isNaN(date.getTime())) {
        date = new Date();
      }
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    } catch {
      const now = new Date();
      return now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }
  };

  const dtStart = formatDate(startDate);
  const dtEnd = formatDate(endDate);
  const dtStamp = formatDate(new Date());

  const summary = `Cita Médica: ${appointment.specialty || (appointment as any).especialidad || 'Consulta'} - ${appointment.doctorName || (appointment as any).medicoNombre || 'Médico'}`;
  const description = `Confirmación de Cita Médica para Centro de Salud Central.\\n` +
    `Paciente: ${appointment.patientName || (appointment as any).paciente || 'Paciente'}\\n` +
    `Cédula de Identidad: ${appointment.patientDni || (appointment as any).cedula || 'N/A'}\\n` +
    `Historia Médica / Antecedentes: ${appointment.patientMedicalHistory || (appointment as any).historiaMedica || 'Sin antecedentes registrados'}\\n` +
    `Especialidad: ${appointment.specialty || (appointment as any).especialidad || 'Medicina General'}\\n` +
    `Médico: ${appointment.doctorName || (appointment as any).medicoNombre || 'Médico Especialista'}\\n` +
    `Estado: ${appointment.status || (appointment as any).estado || 'CONFIRMED'}\\n` +
    `Motivo de Consulta: ${appointment.notes || (appointment as any).motivoConsulta || 'Sin observaciones'}`;

  const location = `Centro de Salud Central - ${appointment.specialty || (appointment as any).especialidad || 'Barinas'}`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Centro de Salud Central//Sistema de Citas v1.0//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:cita-${appointment.id || '0000'}@centrosalud.gob.ve`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:${appointment.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
    'ORGANIZER;CN=Centro de Salud Central:mailto:citas@centrosalud.gob.ve',
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${appointment.patientName || 'Paciente'}:mailto:${appointment.patientEmail || 'paciente@salud.com'}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio de Cita Médica en 1 hora',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}


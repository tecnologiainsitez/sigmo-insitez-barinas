import { Appointment } from '../src/types';

/**
 * Builds an interactive Google Chat Card V2 JSON payload
 * configured for Private Direct Messaging (1-to-1 DM) with the patient.
 */
export function buildGoogleChatCardV2(appointment: Appointment, appUrl: string = 'http://localhost:3000') {
  const isCancelled = appointment.status === 'CANCELLED';
  const isConflict = appointment.status === 'CONFLICT_PENDING';

  let headerColor = '#0d9488'; // Teal for confirmed
  let statusText = 'CONFIRMADA';

  if (isCancelled) {
    headerColor = '#dc2626'; // Red for cancelled
    statusText = 'CANCELADA';
  } else if (isConflict) {
    headerColor = '#d97706'; // Amber for conflict
    statusText = 'CONFLICTO PENDIENTE DE REVISIÓN';
  } else if (appointment.status === 'IN_WAITING_ROOM') {
    headerColor = '#2563eb';
    statusText = 'EN SALA DE ESPERA';
  } else if (appointment.status === 'COMPLETED') {
    headerColor = '#16a34a';
    statusText = 'COMPLETADA';
  }

  const patientEmail =
    appointment.patientEmail ||
    appointment.email ||
    `${(appointment.patientName || 'paciente').toLowerCase().replace(/\s+/g, '.')}@paciente.com`;

  const patientDni = appointment.patientDni || appointment.cedula || 'N/A';

  const cardPayload = {
    // Google Chat Direct Message (1-to-1 Private Chat) Routing Metadata
    deliveryMode: 'DIRECT_MESSAGE_PRIVATE_1_TO_1',
    space: {
      type: 'DIRECT_MESSAGE',
      singleUserBotDm: true,
      spaceDetails: {
        description: `Chat Privado Confidencial con Paciente ${appointment.patientName}`,
      },
    },
    recipient: {
      email: patientEmail,
      name: `users/${patientEmail}`,
      displayName: appointment.patientName,
      dni: patientDni,
      confidentialityLevel: 'PROTECTED_HEALTH_INFORMATION',
    },
    thread: {
      threadKey: `dm_med_appt_${appointment.id}`,
    },
    cardsV2: [
      {
        cardId: `card_appt_${appointment.id}`,
        card: {
          header: {
            title: `🏥 Cita Médica ${statusText}`,
            subtitle: `🔒 Mensaje Privado Confidencial (1 a 1) • Para: ${patientEmail}`,
            imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/lock/default/48px.svg',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: '🔒 Notificación Confidencial de Cita Médica',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Canal de Notificación',
                    text: `<b>Chat Directo Privado (1 a 1)</b> con <font color="#0d9488">${patientEmail}</font>`,
                    icon: { knownIcon: 'DESCRIPTION' },
                    bottomLabel: 'Protegido bajo estricta confidencialidad médica y secreto profesional.',
                  },
                },
              ],
            },
            {
              header: '👤 Datos del Paciente y Cita',
              widgets: [
                {
                  decoratedText: {
                    icon: { knownIcon: 'PERSON' },
                    topLabel: 'Paciente',
                    text: `<b>${appointment.patientName}</b>`,
                    bottomLabel: `DNI/Cédula: ${patientDni} | Tel: ${appointment.patientPhone || appointment.telefono || 'N/A'}`,
                  },
                },
                {
                  decoratedText: {
                    icon: { knownIcon: 'MEMBERSHIP' },
                    topLabel: 'Médico y Especialidad Asignada',
                    text: `<b>${appointment.doctorName || appointment.medicoNombre}</b>`,
                    bottomLabel: `Especialidad: ${appointment.specialty || appointment.especialidad}`,
                  },
                },
                {
                  decoratedText: {
                    icon: { knownIcon: 'CLOCK' },
                    topLabel: 'Fecha y Hora Agendada',
                    text: `<b>📅 ${appointment.date || appointment.fecha} a las ⏰ ${appointment.time || appointment.hora} hrs</b>`,
                    bottomLabel: `Duración estimada: ${appointment.durationMinutes || 30} min`,
                  },
                },
                {
                  decoratedText: {
                    icon: { knownIcon: 'DESCRIPTION' },
                    topLabel: 'Motivo de Consulta / Indicaciones',
                    text: appointment.notes || appointment.motivoConsulta || 'Sin observaciones adicionales.',
                  },
                },
                ...(appointment.patientMedicalHistory || appointment.historiaMedica
                  ? [
                      {
                        decoratedText: {
                          icon: { knownIcon: 'TICKET' },
                          topLabel: '🩺 Historia Médica & Antecedentes Clínicos (Privado)',
                          text: `<b>${appointment.patientMedicalHistory || appointment.historiaMedica}</b>`,
                          bottomLabel: 'Visible únicamente en su chat privado personal.',
                        },
                      },
                    ]
                  : []),
              ],
            },
            {
              header: '⚙️ Estado de Sincronización y Registro',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Origen y Registro UTC',
                    text: `Dispositivo Emisor: <code>${appointment.originDevice || 'Recepción Central'}</code>`,
                    bottomLabel: `Registrado en UTC: ${appointment.createdAtUtc || appointment.fechaRegistroUtc || new Date().toISOString()}`,
                  },
                },
                ...(appointment.conflictDetails
                  ? [
                      {
                        decoratedText: {
                          icon: { knownIcon: 'NONE' },
                          topLabel: 'Detalle de Conflicto Detectado',
                          text: `<font color="#dc2626"><b>⚠️ ${appointment.conflictDetails}</b></font>`,
                        },
                      },
                    ]
                  : []),
              ],
            },
            {
              widgets: [
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Ver en Sistema de Recepción',
                        onClick: {
                          openLink: {
                            url: `${appUrl}?apptId=${appointment.id}`,
                          },
                        },
                        color: {
                          red: 0.05,
                          green: 0.58,
                          blue: 0.53,
                          alpha: 1.0,
                        },
                      },
                      {
                        text: 'Descargar .ICS iCalendar',
                        onClick: {
                          openLink: {
                            url: `${appUrl}/api/appointments/${appointment.id}/ics`,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  return cardPayload;
}


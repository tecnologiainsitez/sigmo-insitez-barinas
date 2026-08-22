import { Appointment, NotificationLog } from '../src/types';
import { generateICS } from './icsGenerator';
import { buildGoogleChatCardV2 } from './googleChat';
import { centralDB } from './db';
import { mailService } from './mailService';

/**
 * Asynchronous Background Worker (Simulates Redis + BullMQ queue processing)
 * Handles post-sync notifications: Real Email with .ics iCalendar and Google Chat Card V2 Webhooks.
 */
export class BackgroundNotificationWorker {
  private queue: Appointment[] = [];
  private isProcessing = false;

  public enqueueAppointmentEvent(appointment: Appointment) {
    this.queue.push(appointment);
    this.processNext();
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const appointment = this.queue.shift();
    if (!appointment) {
      this.isProcessing = false;
      return;
    }

    try {
      // Task 1: Generate .ics and send REAL Email with attachment via MailService
      const recipient = appointment.patientEmail || appointment.email || 'gerickssond@gmail.com';
      const emailResult = await mailService.sendAppointmentEmail(appointment, recipient);
      
      const emailLog: NotificationLog = {
        id: 'notif_email_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        appointmentId: appointment.id,
        type: 'EMAIL_ICS',
        recipient: recipient,
        subjectOrTitle: `Confirmación de Cita Médica - ${appointment.specialty || appointment.especialidad} (${appointment.date || appointment.fecha} ${appointment.time || appointment.hora})`,
        status: emailResult.success ? 'SENT' : 'FAILED',
        payload: generateICS(appointment),
        timestamp: new Date().toISOString(),
        details: emailResult.success
          ? `Correo electrónico enviado desde ${mailService.getSenderEmail()} con adjunto iCalendar (.ics). ${emailResult.previewUrl ? `Vista previa: ${emailResult.previewUrl}` : ''}`
          : `Error al enviar correo: ${emailResult.error}`,
      };
      centralDB.addNotificationLog(emailLog);

      // Task 2: Build Google Chat Card V2 JSON and trigger Direct Message / Webhook
      const patientEmail =
        appointment.patientEmail ||
        appointment.email ||
        recipient;

      const chatCardPayload = buildGoogleChatCardV2(appointment);
      const cardJsonString = JSON.stringify(chatCardPayload, null, 2);

      const chatWebhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
      let webhookStatus: 'SENT' | 'SIMULATED' | 'FAILED' = 'SIMULATED';
      let webhookDetails = `Tarjeta interactiva Card V2 configurada para Chat Directo Privado (1 a 1) con ${patientEmail}.`;

      if (chatWebhookUrl) {
        try {
          const res = await fetch(chatWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: cardJsonString,
          });
          if (res.ok) {
            webhookStatus = 'SENT';
            webhookDetails = `Tarjeta enviada exitosamente al Chat Directo Privado del paciente (${patientEmail}).`;
          } else {
            webhookStatus = 'FAILED';
            webhookDetails = `API devolvió código HTTP ${res.status}`;
          }
        } catch (err: any) {
          webhookStatus = 'FAILED';
          webhookDetails = `Error al conectar con API Google Chat: ${err?.message || err}`;
        }
      }

      const chatLog: NotificationLog = {
        id: 'notif_gchat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        appointmentId: appointment.id,
        type: 'GOOGLE_CHAT_CARD',
        recipient: patientEmail,
        subjectOrTitle: `GOOGLE CHAT DIRECTO (PRIVADO) - ${patientEmail}`,
        status: webhookStatus,
        payload: cardJsonString,
        timestamp: new Date().toISOString(),
        details: webhookDetails,
      };
      centralDB.addNotificationLog(chatLog);
    } catch (error) {
      console.error('Error processing notification job:', error);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.processNext();
      }
    }
  }
}

export const notificationWorker = new BackgroundNotificationWorker();


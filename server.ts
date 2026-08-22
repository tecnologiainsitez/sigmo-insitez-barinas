import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { centralDB } from './server/db';
import { notificationWorker } from './server/queueWorker';
import { generateICS } from './server/icsGenerator';
import { buildGoogleChatCardV2 } from './server/googleChat';
import { mailService } from './server/mailService';
import { MutationItem, NotificationLog } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get sender email configuration
  app.get('/api/mail-config', (req, res) => {
    res.json({
      senderEmail: mailService.getSenderEmail(),
      senderName: mailService.getSenderName(),
    });
  });

  // Update sender email configuration
  app.post('/api/mail-config', (req, res) => {
    const { senderEmail, senderName } = req.body;
    if (senderEmail) {
      mailService.setSenderEmail(senderEmail, senderName);
    }
    res.json({
      success: true,
      senderEmail: mailService.getSenderEmail(),
      senderName: mailService.getSenderName(),
      message: 'Configuración de correo remitente actualizada exitosamente.',
    });
  });

  // Send test email with .ics attachment
  app.post('/api/send-test-email', async (req, res) => {
    try {
      const { recipientEmail, senderEmail, appointment } = req.body;
      const targetRecipient = (recipientEmail || 'gerickssond@gmail.com').trim();
      
      if (senderEmail && senderEmail.trim()) {
        mailService.setSenderEmail(senderEmail.trim());
      }

      const baseAppt = appointment || centralDB.getAllAppointments()[0] || {
        id: 'appt-test-email-' + Date.now().toString().substring(6),
        patientName: 'Gericksson Devies',
        patientEmail: targetRecipient,
        patientDni: '0801199012345',
        patientPhone: '+58 412 123 4567',
        specialty: 'Medicina General',
        doctorName: 'Dr. Alejandro Morales',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        status: 'CONFIRMED',
        notes: 'Prueba completa de despacho de correo con archivo .ics adjunto',
        patientMedicalHistory: 'Paciente de prueba INSITEZ UNELLEZ',
      };

      const result = await mailService.sendAppointmentEmail(baseAppt, targetRecipient);

      // Register in notification history log
      const emailLog: NotificationLog = {
        id: 'notif_test_email_' + Date.now(),
        appointmentId: baseAppt.id,
        type: 'EMAIL_ICS',
        recipient: targetRecipient,
        subjectOrTitle: `[PRUEBA] Confirmación de Cita Médica - ${baseAppt.specialty || 'General'} (${baseAppt.date} ${baseAppt.time})`,
        status: result.success ? 'SENT' : 'FAILED',
        payload: generateICS(baseAppt),
        timestamp: new Date().toISOString(),
        details: result.success
          ? `Correo despachado exitosamente a ${targetRecipient} desde remitente oficial ${mailService.getSenderEmail()}. ${result.previewUrl ? `[Ver correo en línea: ${result.previewUrl}]` : ''}`
          : `Fallo en el despacho: ${result.error}`,
      };
      centralDB.addNotificationLog(emailLog);

      res.json(result);
    } catch (err: any) {
      console.error('Error in /api/send-test-email:', err);
      res.status(500).json({ success: false, error: err?.message || 'Error al enviar correo' });
    }
  });

  // Helper to fetch live data from GAS and merge into central in-memory store
  const syncWithGoogleAppsScript = async () => {
    const gasUrl = centralDB.getGasUrl();
    if (!gasUrl) return null;
    try {
      const fetchUrl = gasUrl.includes('?') ? `${gasUrl}&action=GET_ALL_DATA` : `${gasUrl}?action=GET_ALL_DATA`;
      const response = await fetch(fetchUrl);
      if (!response.ok) return null;
      const data: any = await response.json();
      if (data && (data.data || data.allData)) {
        centralDB.mergeRemoteData(data.data || data.allData);
        return data.data || data.allData;
      }
    } catch (e: any) {
      console.warn('[INSITEZ] Fallo al consultar Google Apps Script:', e?.message);
    }
    return null;
  };

  // Get catalog of doctors (supports fresh=true or cold boot to pull latest from Sheets)
  app.get('/api/doctors', async (req, res) => {
    const currentDocs = centralDB.getDoctors();
    const isMock = currentDocs.some((d) => d.id === 'DOC-101');
    if (req.query.fresh === 'true' || currentDocs.length === 0 || isMock) {
      await syncWithGoogleAppsScript();
    }
    res.json(centralDB.getDoctors());
  });

  // Get catalog of users (synced with SIGMO_BARINAS)
  app.get('/api/users', async (req, res) => {
    if (req.query.fresh === 'true' || centralDB.getAllUsers().length <= 1) {
      await syncWithGoogleAppsScript();
    }
    res.json(centralDB.getAllUsers());
  });

  // Initial pull on server boot
  syncWithGoogleAppsScript().then((data) => {
    if (data) console.log('[INSITEZ] Sincronización inicial exitosa con Google Sheets (SIGMO_BARINAS)');
  });

  // Save / Update User (and forward to Google Sheets if connected)
  app.post('/api/users', async (req, res) => {
    const user = req.body;
    if (!user || (!user.email && !user.id)) {
      return res.status(400).json({ success: false, error: 'Datos de usuario inválidos.' });
    }
    centralDB.saveUser(user);

    // Forward to GAS if available via SYNC_MUTATIONS
    const gasUrl = centralDB.getGasUrl();
    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SYNC_MUTATIONS',
            mutations: [
              {
                id: 'mut_usr_' + Date.now(),
                action: 'SAVE_USER',
                tabla: 'Usuarios',
                timestampUtc: new Date().toISOString(),
                status: 'PENDING',
                payload: user,
              },
            ],
          }),
        });
      } catch (err: any) {
        console.warn('Could not forward user to GAS:', err?.message);
      }
    }

    res.json({ success: true, user, users: centralDB.getAllUsers() });
  });

  // Delete User
  app.delete('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    centralDB.deleteUser(userId);

    const gasUrl = centralDB.getGasUrl();
    if (gasUrl) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SYNC_MUTATIONS',
            mutations: [
              {
                id: 'mut_del_usr_' + Date.now(),
                action: 'DELETE_USER',
                tabla: 'Usuarios',
                timestampUtc: new Date().toISOString(),
                status: 'PENDING',
                payload: { id: userId, userId: userId },
              },
            ],
          }),
        });
      } catch (err: any) {
        console.warn('Could not forward delete user to GAS:', err?.message);
      }
    }

    res.json({ success: true, id: userId, users: centralDB.getAllUsers() });
  });

  // Get central appointments
  app.get('/api/appointments', (req, res) => {
    res.json(centralDB.getAllAppointments());
  });

  // Download .ics for an appointment
  app.get('/api/appointments/:id/ics', (req, res) => {
    const appt = centralDB.getAppointmentById(req.params.id);
    if (!appt) {
      return res.status(404).send('Cita no encontrada');
    }
    const icsContent = generateICS(appt);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cita_${appt.id}.ics"`);
    res.send(icsContent);
  });

  // Main Sync Endpoint: Process array of pending mutations from client IndexedDB queue
  app.post('/api/sync', async (req, res) => {
    try {
      const mutations: MutationItem[] = req.body.mutations || [];
      const incomingGasUrl = (req.body.gasUrl || centralDB.getGasUrl() || '').trim();

      if (!Array.isArray(mutations)) {
        return res.status(400).json({ error: 'Formato inválido. Se esperaba arreglo de mutaciones.' });
      }

      // Execute atomic sync process with conflict resolution locally
      const syncResult = centralDB.processMutationQueue(mutations);

      // Trigger background jobs for each successfully processed appointment mutation
      let notificationCount = 0;
      for (const processed of syncResult.processedMutations) {
        if (processed.status === 'SYNCED' && processed.appointment) {
          notificationWorker.enqueueAppointmentEvent(processed.appointment);
          notificationCount++;
        }
      }

      syncResult.notificationsGenerated = notificationCount;

      // Forward to Google Apps Script if URL configured
      if (incomingGasUrl && mutations.length > 0) {
        try {
          const gasRes = await fetch(incomingGasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'SYNC_MUTATIONS',
              mutations: mutations,
            }),
          });
          if (gasRes.ok) {
            const gasData: any = await gasRes.json();
            if (gasData && gasData.allData) {
              centralDB.mergeRemoteData(gasData.allData);
            }
            syncResult.gasSyncSuccess = true;
          } else {
            syncResult.gasSyncSuccess = false;
            syncResult.gasError = `HTTP ${gasRes.status}`;
          }
        } catch (gasErr: any) {
          console.warn('Background sync to Google Apps Script note:', gasErr?.message);
          syncResult.gasSyncSuccess = false;
          syncResult.gasError = gasErr?.message;
        }
      }

      res.json(syncResult);
    } catch (err: any) {
      console.error('Error during /api/sync execution:', err);
      res.status(500).json({ error: 'Internal Server Error during sync', details: err?.message });
    }
  });

  // Google Apps Script Proxy and Config Routes
  app.get('/api/gas/config', (req, res) => {
    res.json({
      gasUrl: centralDB.getGasUrl(),
      spreadsheetId: centralDB.getSpreadsheetId(),
      isConnected: !!centralDB.getGasUrl(),
    });
  });

  app.post('/api/gas/config', (req, res) => {
    const { gasUrl, spreadsheetId } = req.body;
    if (gasUrl !== undefined) centralDB.setGasUrl(gasUrl);
    if (spreadsheetId !== undefined) centralDB.setSpreadsheetId(spreadsheetId);
    res.json({
      success: true,
      gasUrl: centralDB.getGasUrl(),
      spreadsheetId: centralDB.getSpreadsheetId(),
    });
  });

  // Direct Proxy to Google Apps Script (Bypasses Browser CORS / 302 Redirect constraints)
  app.post('/api/proxy-gas', async (req, res) => {
    const targetGasUrl = (req.body.gasUrl || centralDB.getGasUrl() || '').trim();
    if (!targetGasUrl) {
      return res.status(400).json({
        success: false,
        error: 'URL de Google Apps Script Web App no configurada. Configure la URL en la barra de sincronización.',
      });
    }

    try {
      const response = await fetch(targetGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body.payload || req.body),
      });

      const responseText = await response.text();
      let responseJson: any;
      try {
        responseJson = JSON.parse(responseText);
      } catch (parseErr) {
        responseJson = { rawResponse: responseText };
      }

      // If returned data contains Google Sheets data, merge it into central in-memory store
      if (responseJson && responseJson.data) {
        centralDB.mergeRemoteData(responseJson.data);
      } else if (responseJson && responseJson.allData) {
        centralDB.mergeRemoteData(responseJson.allData);
      }

      res.json(responseJson);
    } catch (proxyErr: any) {
      console.error('Error in /api/proxy-gas:', proxyErr);
      res.status(500).json({
        success: false,
        error: `Fallo al conectar con Google Sheets (Apps Script): ${proxyErr?.message || 'Error de red'}`,
      });
    }
  });

  // Pull all data directly from Google Sheets
  app.get('/api/gas/pull', async (req, res) => {
    const targetGasUrl = (req.query.gasUrl as string || centralDB.getGasUrl() || '').trim();
    if (!targetGasUrl) {
      return res.json({
        success: false,
        error: 'URL de Google Apps Script Web App no configurada.',
        appointments: centralDB.getAllAppointments(),
      });
    }

    try {
      const fetchUrl = targetGasUrl.includes('?') ? `${targetGasUrl}&action=GET_ALL_DATA` : `${targetGasUrl}?action=GET_ALL_DATA`;
      const response = await fetch(fetchUrl);
      const data: any = await response.json();

      if (data && (data.data || data.allData)) {
        centralDB.mergeRemoteData(data.data || data.allData);
      }

      res.json({
        success: true,
        data: data.data || data,
        appointments: centralDB.getAllAppointments(),
      });
    } catch (pullErr: any) {
      res.status(500).json({
        success: false,
        error: pullErr?.message,
        appointments: centralDB.getAllAppointments(),
      });
    }
  });

  // Get notification logs history
  app.get('/api/notifications', (req, res) => {
    res.json(centralDB.getNotificationLogs());
  });

  app.get('/api/notifications/logs', (req, res) => {
    res.json(centralDB.getNotificationLogs());
  });

  // Test Google Chat Direct Message (1-to-1 Private Chat) dispatch
  app.post('/api/test-google-chat-webhook', async (req, res) => {
    const { webhookUrl, recipientEmail, appointment } = req.body;
    const targetRecipient = (recipientEmail || webhookUrl || '').trim();

    if (!targetRecipient) {
      return res.status(400).json({ error: 'Dirección de correo o ID de Google Chat del destinatario requerido.' });
    }

    try {
      const baseAppt = appointment || centralDB.getAllAppointments()[0] || {
        id: 'appt-demo-test',
        patientName: 'Paciente de Prueba',
        patientEmail: targetRecipient.includes('@') ? targetRecipient : 'paciente@salud.com',
        patientDni: '0801199012345',
        patientPhone: '+52 55 1234 5678',
        specialty: 'Medicina General',
        doctorName: 'Dr. Alejandro Morales',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        status: 'CONFIRMED',
        notes: 'Prueba de envío de Card V2 a Chat Directo Privado (1 a 1)',
        patientMedicalHistory: 'Sin antecedentes clínicos de riesgo.',
      };

      const customAppt = {
        ...baseAppt,
        patientEmail: targetRecipient.includes('@') ? targetRecipient : baseAppt.patientEmail,
      };

      const cardPayload = buildGoogleChatCardV2(customAppt);
      const cardJsonString = JSON.stringify(cardPayload, null, 2);

      let isLiveHttp = targetRecipient.startsWith('http://') || targetRecipient.startsWith('https://');

      if (isLiveHttp) {
        const response = await fetch(targetRecipient, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: cardJsonString,
        });

        if (response.ok) {
          const logItem: NotificationLog = {
            id: 'notif_test_' + Date.now(),
            appointmentId: customAppt.id,
            type: 'GOOGLE_CHAT_CARD',
            recipient: customAppt.patientEmail,
            subjectOrTitle: `GOOGLE CHAT DIRECTO (PRIVADO) - ${customAppt.patientEmail}`,
            status: 'SENT',
            payload: cardJsonString,
            timestamp: new Date().toISOString(),
            details: `Tarjeta Card V2 despachada vía endpoint de chat directo al destinatario: ${customAppt.patientEmail}`,
          };
          centralDB.addNotificationLog(logItem);

          return res.json({
            success: true,
            message: `¡Tarjeta Google Chat Card V2 enviada exitosamente al Chat Privado de ${customAppt.patientEmail}!`,
          });
        } else {
          return res.status(response.status).json({
            success: false,
            error: `Respuesta HTTP ${response.status} de la API de Google Chat.`,
          });
        }
      } else {
        // Direct private 1:1 message simulation / Gas pipeline dispatch
        const logItem: NotificationLog = {
          id: 'notif_test_' + Date.now(),
          appointmentId: customAppt.id,
          type: 'GOOGLE_CHAT_CARD',
          recipient: targetRecipient,
          subjectOrTitle: `GOOGLE CHAT DIRECTO (PRIVADO) - ${targetRecipient}`,
          status: 'SENT',
          payload: cardJsonString,
          timestamp: new Date().toISOString(),
          details: `Tarjeta confidencial Card V2 despachada al Chat Privado Directo (1 a 1) del usuario: ${targetRecipient}`,
        };
        centralDB.addNotificationLog(logItem);

        return res.json({
          success: true,
          message: `¡Tarjeta Card V2 despachada exitosamente al Chat Privado Directo (1 a 1) de ${targetRecipient}!`,
        });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Error al conectar con Google Chat' });
    }
  });

  // Reset demo data
  app.post('/api/reset-demo', (req, res) => {
    centralDB.resetDemoData();
    res.json({ success: true, message: 'Datos del servidor reiniciados' });
  });

  // --- VITE MIDDLEWARE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor de Citas Médicas] Escuchando en http://0.0.0.0:${PORT}`);
  });
}

startServer();

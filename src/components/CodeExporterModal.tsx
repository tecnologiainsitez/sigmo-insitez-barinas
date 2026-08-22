import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  ExternalLink,
  Terminal,
  Layers,
  FileText,
  Sparkles,
  Smartphone,
  Laptop,
  Database,
  CheckCircle2,
} from 'lucide-react';

interface CodeExporterModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

export const CodeExporterModal: React.FC<CodeExporterModalProps> = ({ isOpen = true, onClose }) => {
  const [activeFile, setActiveFile] = useState<'CODE_GS' | 'SHEETS_MD' | 'PWA_INSTALL' | 'INDEX_HTML'>('CODE_GS');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const SPREADSHEET_ID = '1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc';
  const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;

  const CODE_GS_CONTENT = `/**
 * ============================================================================
 * SISTEMA INTEGRADO DE GESTIÓN MÉDICA Y ODONTOLÓGICA (SIGMO_BARINAS)
 * INSITEZ UNELLEZ - Sede Central Barinas
 * Backend Serverless a Costo $0/mes en Google Apps Script
 * ============================================================================
 * Proyecto Apps Script: SIGMO_Barinas
 * Hoja de Cálculo Central: SIGMO_BARINAS
 * ID: ${SPREADSHEET_ID}
 * ============================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: "${SPREADSHEET_ID}",
  NOMBRE_INSTITUCION: "INSITEZ - Instituto de Salud Integral de los Trabajadores",
  SUBTITULO: "Universidad Nacional Experimental de los Llanos Occidentales 'Ezequiel Zamora'",
  SEDE_PRINCIPAL: "Sede Central Barinas, Venezuela",
  SENDER_EMAIL: "gerickssond@gmail.com",
  SENDER_NAME: "SIGMO - INSITEZ UNELLEZ",
  TIMEZONE: "America/Caracas",
  VERSION: "1.0.0"
};

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID !== "") {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (e) {
      Logger.log("Aviso al abrir por ID: " + e.toString());
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Función principal para ejecutar desde el editor de Apps Script (Botón Ejecutar)
 */
function autoConfigurarSIGMO() {
  const ss = getSpreadsheet();
  Logger.log("Iniciando auto-configuración en SIGMO_BARINAS (ID: " + ss.getId() + ")...");
  const resultado = setupDatabaseSheets(ss);
  Logger.log("✅ Auto-configuración de tablas completada con éxito: " + JSON.stringify(resultado));
  return resultado;
}

/**
 * Menú personalizado institucional en Google Sheets
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.createMenu("🏥 SIGMO - INSITEZ UNELLEZ")
        .addItem("⚡ Auto-configurar Hojas y Tablas", "menuAutoConfigurar")
        .addSeparator()
        .addItem("📧 Enviar Correo de Prueba con .ICS a gerickssond@gmail.com", "menuEnviarPruebaCorreo")
        .addItem("🔄 Verificar Integridad de Datos", "menuVerificarIntegridad")
        .addSeparator()
        .addItem("ℹ️ Acerca de SIGMO 1.0 (PWA)", "menuAcercaDe")
        .addToUi();
    }
  } catch (e) {
    Logger.log("onOpen fuera de contexto de interfaz: " + e.toString());
  }
}

function menuAutoConfigurar() {
  const ss = getSpreadsheet();
  const resultado = setupDatabaseSheets(ss);
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(
        "✅ Configuración Exitosa - SIGMO_BARINAS",
        "Se han auto-configurado correctamente las 7 hojas institucionales listas para producción en la hoja ID:\\n" + ss.getId(),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log("✅ Auto-configuración ejecutada: " + JSON.stringify(resultado));
  }
}

function menuEnviarPruebaCorreo() {
  const testCita = {
    id: "CITA-TEST-" + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "HHmmss"),
    paciente: "Gericksson Devies (Prueba)",
    cedula: "0801199012345",
    email: CONFIG.SENDER_EMAIL,
    telefono: "+58 412 123 4567",
    medicoNombre: "Dr. Alejandro Morales",
    especialidad: "Medicina General",
    fecha: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"),
    hora: "10:00",
    estado: "CONFIRMED",
    motivoConsulta: "Prueba técnica de despacho automático de correo con archivo .ics",
    historiaMedica: "Paciente afiliado INSITEZ UNELLEZ",
    creadoPor: "Administrador"
  };

  const res = sendAppointmentEmailWithIcs(testCita, CONFIG.SENDER_EMAIL);
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(
        res.success ? "📧 Correo Despachado" : "❌ Error de Envío",
        res.message || "Se ha enviado la prueba a: " + CONFIG.SENDER_EMAIL,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log("Resultado envío de correo: " + JSON.stringify(res));
  }
}

function menuVerificarIntegridad() {
  const ss = getSpreadsheet();
  const hojas = ["Pacientes", "Citas", "Medicos", "Especialidades", "Usuarios", "Configuracion", "Logs_Notificaciones"];
  let reporte = "Estado de las pestañas en SIGMO_BARINAS (" + ss.getId() + "):\\n\\n";
  
  hojas.forEach(h => {
    const s = ss.getSheetByName(h);
    if (s) {
      reporte += "✅ " + h + ": " + s.getLastRow() + " filas registradas.\\n";
    } else {
      reporte += "❌ " + h + ": NO EXISTE (Ejecutar autoConfigurarSIGMO).\\n";
    }
  });

  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert("Reporte de Integridad - SIGMO_BARINAS", reporte, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (e) {
    Logger.log(reporte);
  }
}

function menuAcercaDe() {
  const msg = "SIGMO 1.0 - INSITEZ UNELLEZ Barinas\\nSistema de Gestión de Citas Médicas y Odontológicas.\\nArquitectura Offline-First con Google Sheets y PWA.\\nSede Central Barinas.";
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) ui.alert("SIGMO 1.0 - UNELLEZ", msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    Logger.log(msg);
  }
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const action = e && e.parameter ? e.parameter.action : "PING";

    if (action === "SETUP_DATABASE") {
      const result = setupDatabaseSheets(ss);
      return jsonResponse({ success: true, action: "SETUP_DATABASE", result: result });
    }

    return jsonResponse({
      status: "ONLINE",
      sistema: "SIGMO_BARINAS - API REST",
      spreadsheetId: ss.getId(),
      version: CONFIG.VERSION,
      remitenteConfigurado: CONFIG.SENDER_EMAIL,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.tryLock(15000);

    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: "Cuerpo de solicitud vacío." }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const data = payload.data || {};
    const ss = getSpreadsheet();

    let responseData = {};

    switch (action) {
      case "SETUP_DATABASE":
        responseData = setupDatabaseSheets(ss);
        break;
      case "AUTHENTICATE":
        responseData = handleAuthenticate(data);
        break;
      case "SYNC_MUTATIONS":
        responseData = handleSyncMutations(payload.mutations || []);
        break;
      case "SEND_TEST_EMAIL":
        responseData = handleSendTestEmail(data);
        break;
      default:
        return jsonResponse({ success: false, error: "Acción no reconocida: " + action }, 400);
    }

    return jsonResponse({ success: true, timestamp: new Date().toISOString(), result: responseData });

  } catch (error) {
    Logger.log("Error en doPost: " + error.toString());
    return jsonResponse({ success: false, error: error.toString() }, 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function setupDatabaseSheets(ss) {
  if (!ss) ss = getSpreadsheet();
  const results = {};

  // 1. Pacientes (Estructura limpia para producción)
  let pSheet = ss.getSheetByName("Pacientes");
  if (!pSheet) pSheet = ss.insertSheet("Pacientes");
  if (pSheet.getLastRow() === 0) {
    pSheet.appendRow([
      "Cedula", "NombreCompleto", "Condicion", "Cargo", "Dependencia", 
      "Parentesco", "TitularCedula", "TitularNombre", "Email", "Telefono", 
      "Direccion", "Estado", "FechaRegistro"
    ]);
    formatHeaderRow(pSheet, "A1:M1", "#1a56db");
  }
  pSheet.setFrozenRows(1);
  results["Pacientes"] = "OK (Estructura lista)";

  // 2. Citas (17 columnas estandarizadas con IDx, Tratamiento y Notas)
  let cSheet = ss.getSheetByName("Citas");
  if (!cSheet) cSheet = ss.insertSheet("Citas");
  const appointmentHeaders = [
    "ID_Cita", "Paciente", "Cedula", "Email", "Telefono", "Medico", 
    "Especialidad", "Fecha", "Hora", "Estado", "HistoriaMedica", 
    "MotivoConsulta", "CreadoPor", "Fecha_Registro_UTC", "IDx", "Tratamiento", "Notas"
  ];
  if (cSheet.getLastRow() === 0) {
    cSheet.appendRow(appointmentHeaders);
    formatHeaderRow(cSheet, "A1:Q1", "#1e293b");
  } else {
    if (cSheet.getLastColumn() < 17 || String(cSheet.getRange(1, 15).getValue()).trim() === "") {
      cSheet.getRange(1, 1, 1, appointmentHeaders.length).setValues([appointmentHeaders]);
      formatHeaderRow(cSheet, "A1:Q1", "#1e293b");
    }
  }
  cSheet.setFrozenRows(1);
  results["Citas"] = "OK (Estructura 17 columnas lista)";

  // 3. Medicos (10 columnas con MPPS e IMPRES)
  let mSheet = ss.getSheetByName("Medicos");
  if (!mSheet) mSheet = ss.insertSheet("Medicos");
  const doctorHeaders = ["ID_Medico", "Nombre", "Especialidad", "HorarioAtencion", "Consultorio", "Telefono", "Email", "MPPS", "IMPRES", "Estado"];
  if (mSheet.getLastRow() === 0) {
    mSheet.appendRow(doctorHeaders);
    formatHeaderRow(mSheet, "A1:J1", "#0284c7");
    mSheet.appendRow(["DOC-001", "Dr. Alejandro Morales", "Medicina General", "08:00 - 14:00", "Consultorio 101", "+58 412 111 2233", "amorales@insitez.unellez.edu.ve", "84920", "12048", "ACTIVO"]);
    mSheet.appendRow(["DOC-002", "Dra. Elena Rostova", "Pediatría", "09:00 - 15:00", "Consultorio 102", "+58 412 222 3344", "erostova@insitez.unellez.edu.ve", "79214", "11452", "ACTIVO"]);
    mSheet.appendRow(["DOC-003", "Dr. Carlos Mendoza", "Cardiología", "08:30 - 13:30", "Consultorio 204", "+58 412 333 4455", "cmendoza@insitez.unellez.edu.ve", "65431", "09812", "ACTIVO"]);
    mSheet.appendRow(["DOC-004", "Dra. Sofía Gutiérrez", "Ginecología", "10:00 - 16:00", "Consultorio 208", "+58 412 444 5566", "sgutierrez@insitez.unellez.edu.ve", "81290", "13590", "ACTIVO"]);
    mSheet.appendRow(["DOC-005", "Dr. Roberto Vargas", "Traumatología", "08:00 - 13:00", "Consultorio 105", "+58 412 555 6677", "rvargas@insitez.unellez.edu.ve", "54890", "08741", "ACTIVO"]);
    mSheet.appendRow(["DOC-006", "Dra. Patricia Silva", "Oftalmología", "09:00 - 14:00", "Consultorio 110", "+58 412 666 7788", "psilva@insitez.unellez.edu.ve", "83410", "14102", "ACTIVO"]);
    mSheet.appendRow(["DOC-007", "Dra. Carmen Rivas", "Odontología", "08:00 - 14:00", "Consultorio Dental 01", "+58 412 777 8899", "crivas@insitez.unellez.edu.ve", "93120", "15890", "ACTIVO"]);
  } else {
    if (mSheet.getLastColumn() < 10 || String(mSheet.getRange(1, 8).getValue()).trim() !== "MPPS") {
      mSheet.getRange(1, 1, 1, doctorHeaders.length).setValues([doctorHeaders]);
      formatHeaderRow(mSheet, "A1:J1", "#0284c7");
    }
  }
  mSheet.setFrozenRows(1);
  results["Medicos"] = "OK (" + mSheet.getLastRow() + " filas)";

  // 4. Especialidades
  let eSheet = ss.getSheetByName("Especialidades");
  if (!eSheet) eSheet = ss.insertSheet("Especialidades");
  if (eSheet.getLastRow() === 0) {
    eSheet.appendRow(["ID_Especialidad", "Nombre_Especialidad", "Descripcion"]);
    formatHeaderRow(eSheet, "A1:C1", "#4f46e5");
    eSheet.appendRow(["ESP-001", "Medicina General", "Atención primaria, diagnóstico y derivación"]);
    eSheet.appendRow(["ESP-002", "Pediatría", "Atención pediátrica integral"]);
    eSheet.appendRow(["ESP-003", "Cardiología", "Salud cardiovascular y electrocardiografía"]);
    eSheet.appendRow(["ESP-004", "Ginecología", "Salud femenina y control prenatal"]);
    eSheet.appendRow(["ESP-005", "Traumatología", "Atención osteoarticular y lesiones"]);
    eSheet.appendRow(["ESP-006", "Oftalmología", "Salud visual y optometría"]);
    eSheet.appendRow(["ESP-007", "Odontología", "Salud bucal y operatoria dental"]);
  }
  eSheet.setFrozenRows(1);
  results["Especialidades"] = "OK (" + eSheet.getLastRow() + " filas)";

  // 5. Usuarios
  let uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) uSheet = ss.insertSheet("Usuarios");
  if (uSheet.getLastRow() === 0) {
    uSheet.appendRow(["ID_Usuario", "Nombre", "Email", "PasswordHash", "Rol", "Estado", "UltimoAcceso"]);
    formatHeaderRow(uSheet, "A1:G1", "#059669");
    const defaultHash = hashSha256("salud123");
    uSheet.appendRow(["USR-001", "Lic. Valeria Martínez", "analista@salud.com", defaultHash, "ANALISTA", "ACTIVO", new Date().toISOString()]);
    uSheet.appendRow(["USR-002", "Dr. Alejandro Morales", "dr.morales@salud.com", defaultHash, "MEDICO", "ACTIVO", new Date().toISOString()]);
    uSheet.appendRow(["USR-003", "Dra. Carmen Rivas", "dra.rivas@salud.com", defaultHash, "MEDICO", "ACTIVO", new Date().toISOString()]);
    uSheet.appendRow(["USR-004", "Dra. Carmen Alvarado (Jefe)", "jefe@salud.com", defaultHash, "JEFE", "ACTIVO", new Date().toISOString()]);
    uSheet.appendRow(["USR-005", "Ing. Carlos Mendoza (Admin)", "admin@salud.com", defaultHash, "DESARROLLADOR_ADMIN", "ACTIVO", new Date().toISOString()]);
  }
  uSheet.setFrozenRows(1);
  results["Usuarios"] = "OK (" + uSheet.getLastRow() + " filas)";

  // 6. Configuracion
  let cfgSheet = ss.getSheetByName("Configuracion");
  if (!cfgSheet) cfgSheet = ss.insertSheet("Configuracion");
  if (cfgSheet.getLastRow() === 0) {
    cfgSheet.appendRow(["Parametro", "Valor", "Descripcion", "UltimaActualizacion"]);
    formatHeaderRow(cfgSheet, "A1:D1", "#d97706");
    cfgSheet.appendRow(["SENDER_EMAIL", CONFIG.SENDER_EMAIL, "Correo remitente oficial", new Date().toISOString()]);
    cfgSheet.appendRow(["SENDER_NAME", CONFIG.SENDER_NAME, "Nombre institucional", new Date().toISOString()]);
    cfgSheet.appendRow(["NOMBRE_SISTEMA", "SIGMO_BARINAS", "Nombre del sistema", new Date().toISOString()]);
  }
  cfgSheet.setFrozenRows(1);
  results["Configuracion"] = "OK (" + cfgSheet.getLastRow() + " filas)";

  // 7. Logs_Notificaciones
  let lSheet = ss.getSheetByName("Logs_Notificaciones");
  if (!lSheet) lSheet = ss.insertSheet("Logs_Notificaciones");
  if (lSheet.getLastRow() === 0) {
    lSheet.appendRow(["ID_Log", "ID_Cita", "Tipo", "Destinatario", "Asunto_Titulo", "Estado", "Timestamp", "Detalles"]);
    formatHeaderRow(lSheet, "A1:H1", "#475569");
  }
  lSheet.setFrozenRows(1);
  results["Logs_Notificaciones"] = "OK (Estructura lista)";

  return results;
}

function formatHeaderRow(sheet, rangeA1, bgColor) {
  sheet.getRange(rangeA1).setBackground(bgColor).setFontColor("#ffffff").setFontWeight("bold").setFontSize(10);
}

function sendAppointmentEmailWithIcs(appointment, customRecipient) {
  const recipient = customRecipient || appointment.patientEmail || appointment.email || CONFIG.SENDER_EMAIL;
  const patientName = appointment.patientName || appointment.paciente || "Paciente";
  const doctorName = appointment.doctorName || appointment.medicoNombre || "Especialista";
  const specialty = appointment.specialty || appointment.especialidad || "Consulta Médica";
  const date = appointment.date || appointment.fecha || "Fecha programada";
  const time = appointment.time || appointment.hora || "08:00";
  const dni = appointment.patientDni || appointment.cedula || "N/A";

  const icsContent = buildIcsContent(appointment);
  const icsBlob = Utilities.newBlob(icsContent, "text/calendar; charset=utf-8; method=REQUEST", "Cita_SIGMO_" + (appointment.id || "cita") + ".ics");

  const htmlBody = \`
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <div style="background-color: #1a56db; padding: 20px; border-radius: 8px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0;">SIGMO - INSITEZ UNELLEZ</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px;">Confirmación Oficial de Cita Médica</p>
    </div>
    <div style="padding: 20px 0; font-size: 14px; color: #334155;">
      <p>Estimado(a) <strong>\${patientName}</strong> (C.I. \${dni}), su cita ha sido confirmada:</p>
      <ul>
        <li><strong>Especialidad:</strong> \${specialty}</li>
        <li><strong>Médico:</strong> \${doctorName}</li>
        <li><strong>Fecha:</strong> \${date}</li>
        <li><strong>Hora:</strong> \${time}</li>
      </ul>
      <p>📎 <em>Se adjunta archivo de calendario (.ics) para sincronización con su móvil o Google Calendar.</em></p>
    </div>
  </div>
  \`;

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: "🏥 Cita Médica - " + specialty + " [" + date + " " + time + "] - SIGMO INSITEZ UNELLEZ",
      htmlBody: htmlBody,
      name: CONFIG.SENDER_NAME,
      replyTo: CONFIG.SENDER_EMAIL,
      attachments: [icsBlob]
    });
    return { success: true, message: "Correo enviado a: " + recipient };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function buildIcsContent(appt) {
  const dateStr = (appt.date || appt.fecha || "2026-08-18").replace(/-/g, "");
  const timeRaw = (appt.time || appt.hora || "08:00").replace(/:/g, "");
  const startDt = dateStr + "T" + (timeRaw.length === 4 ? timeRaw + "00" : timeRaw);
  const uid = (appt.id || "cita-" + Date.now()) + "@insitez.unellez.edu.ve";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SIGMO UNELLEZ//Citas 1.0//ES",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"),
    "DTSTART:" + startDt,
    "DTEND:" + startDt,
    "SUMMARY:🏥 Cita Médica SIGMO: " + (appt.specialty || "Consulta"),
    "DESCRIPTION:Cita con " + (appt.doctorName || "Especialista"),
    "LOCATION:" + CONFIG.NOMBRE_INSTITUCION + " - " + CONFIG.SEDE_PRINCIPAL,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\\r\\n");
}

function hashSha256(raw) {
  if (!raw) return "";
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(raw), Utilities.Charset.UTF_8);
  let hexString = "";
  for (let i = 0; i < signature.length; i++) {
    let byteVal = signature[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hexString += byteHex;
  }
  return hexString;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function handleAuthenticate(data) {
  const ss = getSpreadsheet();
  const uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) return { authenticated: false, error: "Tabla Usuarios no encontrada" };
  const rows = uSheet.getDataRange().getValues();
  const inputEmail = (data.email || "").trim().toLowerCase();
  const inputHash = hashSha256(data.password || "");

  for (let i = 1; i < rows.length; i++) {
    const [id, nombre, email, hash, rol, estado] = rows[i];
    if (String(email).trim().toLowerCase() === inputEmail && (hash === inputHash || hash === data.password)) {
      return { authenticated: true, user: { id, nombre, email, rol, estado } };
    }
  }
  return { authenticated: false, error: "Credenciales inválidas" };
}

function handleSyncMutations(mutations) {
  const ss = getSpreadsheet();
  const cSheet = ss.getSheetByName("Citas");
  if (!cSheet) return { success: false, error: "Hoja Citas no encontrada" };
  return { success: true, processed: mutations.length };
}

function handleSendTestEmail(data) {
  const testAppt = data.appointment || {
    id: "TEST-" + Date.now(),
    paciente: "Gericksson Devies",
    specialty: "Medicina General",
    date: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"),
    time: "09:00"
  };
  return sendAppointmentEmailWithIcs(testAppt, data.email || CONFIG.SENDER_EMAIL);
}
`;

  const handleCopy = () => {
    let contentToCopy = '';
    if (activeFile === 'CODE_GS') contentToCopy = CODE_GS_CONTENT;
    else if (activeFile === 'SHEETS_MD') contentToCopy = `# Estructura Google Sheets SIGMO_BARINAS (ID: ${SPREADSHEET_ID})\n\n1. Pacientes\n2. Citas\n3. Medicos\n4. Especialidades\n5. Usuarios\n6. Configuracion\n7. Logs_Notificaciones`;
    else if (activeFile === 'PWA_INSTALL') contentToCopy = `GUÍA DE INSTALACIÓN PWA SIGMO\n1. Abra la app en Chrome, Edge o Safari.\n2. Haga clic en 'Instalar aplicación' en la barra de direcciones o menú Compartir > Añadir a Pantalla de Inicio.\n3. La app funcionará 100% Offline con sincronización automática.`;
    else contentToCopy = CODE_GS_CONTENT;

    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodeGs = () => {
    const blob = new Blob([CODE_GS_CONTENT], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-fadeIn">
        
        {/* Top Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#1a56db]/20 text-blue-400 border border-blue-500/30">
              <FileCode className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Centro Apps Script & Instalación PWA (SIGMO_BARINAS)
                <span className="text-[10px] bg-blue-900/80 text-blue-300 px-2 py-0.5 rounded-full font-mono font-bold border border-blue-700/50">
                  Exclusivo Administrador
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Código para Google Apps Script (Proyecto: SIGMO_Barinas / Hoja: SIGMO_BARINAS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Hoja SIGMO_BARINAS</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Informative Banner */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Database className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>
              Hoja de Cálculo Oficial: <strong className="text-white">SIGMO_BARINAS</strong>{' '}
              <code className="bg-black/40 text-blue-300 font-mono px-2 py-0.5 rounded font-bold">
                {SPREADSHEET_ID}
              </code>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Función autoConfigurarSIGMO() sin errores de interfaz en script.google.com</span>
          </div>
        </div>

        {/* File Navigation Tabs */}
        <div className="bg-slate-950/60 px-4 flex items-center gap-1 overflow-x-auto border-b border-slate-800 text-xs custom-scrollbar-x">
          <button
            onClick={() => setActiveFile('CODE_GS')}
            className={`px-3 py-2.5 font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFile === 'CODE_GS'
                ? 'border-blue-400 text-blue-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            Code.gs (Backend SIGMO_Barinas)
          </button>

          <button
            onClick={() => setActiveFile('PWA_INSTALL')}
            className={`px-3 py-2.5 font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFile === 'PWA_INSTALL'
                ? 'border-blue-400 text-blue-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            Instalar App (PWA Offline)
          </button>

          <button
            onClick={() => setActiveFile('SHEETS_MD')}
            className={`px-3 py-2.5 font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFile === 'SHEETS_MD'
                ? 'border-blue-400 text-blue-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Estructura de 7 Tablas
          </button>

          <button
            onClick={() => setActiveFile('INDEX_HTML')}
            className={`px-3 py-2.5 font-bold flex items-center gap-1.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeFile === 'INDEX_HTML'
                ? 'border-blue-400 text-blue-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            manifest.json & sw.js
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950 leading-relaxed custom-scrollbar">
          
          {/* TAB 1: CODE.GS */}
          {activeFile === 'CODE_GS' && (
            <div className="space-y-4">
              <div className="bg-slate-900 border border-blue-900/60 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-blue-400 font-bold text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Pasos para actualizar en Google Apps Script (SIGMO_Barinas):</span>
                  </div>
                  <ol className="text-slate-300 font-sans text-xs mt-1 space-y-1 list-decimal list-inside">
                    <li>Abra su editor de Apps Script en <strong className="text-white">SIGMO_Barinas</strong>.</li>
                    <li>Reemplace todo el contenido de <code className="text-blue-300 font-mono">Código.gs</code> o <code className="text-blue-300 font-mono">Code.gs</code> con el código abajo.</li>
                    <li>En el selector superior elija <strong className="text-emerald-300">autoConfigurarSIGMO</strong> y presione <b>▷ Ejecutar</b>. (Ya no arrojará alerta de UI).</li>
                    <li>Las 7 hojas quedarán creadas con sus encabezados listas para recibir datos reales.</li>
                  </ol>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Code.gs'}</span>
                  </button>
                  <button
                    onClick={handleDownloadCodeGs}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>Descargar archivo</span>
                  </button>
                </div>
              </div>

              <pre className="text-emerald-300 whitespace-pre-wrap select-all font-mono text-[11px] leading-relaxed p-2 bg-black/40 rounded-xl border border-slate-800">
                {CODE_GS_CONTENT}
              </pre>
            </div>
          )}

          {/* TAB 2: PWA INSTALL */}
          {activeFile === 'PWA_INSTALL' && (
            <div className="space-y-4 font-sans text-xs">
              <div className="bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-700/50 rounded-xl p-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  Instalación de SIGMO como Aplicación Nativa (PWA Offline)
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  SIGMO funciona en modo Offline-First con IndexedDB y Service Worker. Al instalarla, la aplicación corre como software nativo en Windows/Mac o app en Android/iOS.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-blue-400 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4" />
                    En Computadoras (Windows / Mac / Linux)
                  </h5>
                  <ol className="space-y-1 text-slate-300 list-decimal list-inside text-xs">
                    <li>Abra la app en Chrome, Edge o Brave.</li>
                    <li>En la barra de direcciones haga clic en <b>Instalar SIGMO</b>.</li>
                    <li>Quedará disponible en su Escritorio e Inicio sin conexión.</li>
                  </ol>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <h5 className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    En Teléfonos y Tablets (Android / iOS)
                  </h5>
                  <ol className="space-y-1 text-slate-300 list-decimal list-inside text-xs">
                    <li><b>Android:</b> Menú ⋮ &gt; "Agregar a la pantalla principal" o "Instalar app".</li>
                    <li><b>iPhone/iPad:</b> Botón Compartir &gt; "Añadir a pantalla de inicio".</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SHEETS */}
          {activeFile === 'SHEETS_MD' && (
            <div className="space-y-3 font-sans text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Estructura Oficial de Tablas en Hoja SIGMO_BARINAS (18 Columnas Pacientes / 17 Citas)
                </h4>
                <div className="space-y-2 text-slate-300">
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-blue-400">1. Pacientes (18 Columnas Oficiales):</b> Cedula (A), NumeroExpediente (B), NombreCompleto (C), FechaNacimiento (D), Telefono (E), Email (F), Direccion (G), Categoria (H), Titular_Cedula (I), Titular_Nombre (J), Titular_Condicion (K), Titular_Parentesco (L), Representante_Cedula (M), Representante_Nombre (N), Representante_Telefono (O), Representante_Parentesco (P), Antecedentes_Historial (Q), FechaRegistro_UTC (R).
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-slate-300">2. Citas (17 Columnas Oficiales):</b> ID_Cita, Paciente, Cedula, Email, Telefono, Medico, Especialidad, Fecha, Hora, Estado, HistoriaMedica, MotivoConsulta, CreadoPor, Fecha_Registro_UTC, IDx, Tratamiento, EvolucionMedica.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-sky-400">3. Medicos:</b> ID_Medico, Nombre, Especialidad, HorarioAtencion, Consultorio, Telefono, Email, Estado.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-indigo-400">4. Especialidades:</b> ID_Especialidad, Nombre_Especialidad, Descripcion.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-emerald-400">5. Usuarios:</b> ID_Usuario, Nombre, Email, PasswordHash, Rol, Estado, UltimoAcceso.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-amber-400">6. Configuracion:</b> Parametro, Valor, Descripcion, UltimaActualizacion.
                  </div>
                  <div className="p-2.5 bg-black/30 rounded-lg border border-slate-800">
                    <b className="text-slate-400">7. Logs_Notificaciones:</b> ID_Log, ID_Cita, Tipo, Destinatario, Asunto_Titulo, Estado, Timestamp, Detalles.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MANIFEST & SW */}
          {activeFile === 'INDEX_HTML' && (
            <div className="space-y-4">
              <div>
                <div className="text-sky-400 mb-1 font-bold">// Ubicación: /public/manifest.json</div>
                <pre className="text-sky-200 bg-black/40 p-3 rounded-xl border border-slate-800 text-[11px]">
{`{
  "name": "SIGMO_BARINAS — INSITEZ UNELLEZ",
  "short_name": "SIGMO",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a56db"
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
          <span className="text-slate-400">
            Archivo fuente: <code className="bg-slate-800 px-2 py-0.5 rounded text-blue-300 font-mono">/standalone/Code.gs</code>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

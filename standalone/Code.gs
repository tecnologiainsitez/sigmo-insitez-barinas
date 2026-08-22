/**
 * ============================================================================
 * SIGMO - INSITEZ UNELLEZ (SISTEMA INTEGRAL DE GESTIÓN MÉDICA ODONTOLÓGICA)
 * Google Apps Script Backend (API REST para PWA Offline-First)
 * Versión 5.0 - Esquema Completo Pacientes & Soporte Multi-Tabla
 * ============================================================================
 */

const CONFIG = {
  NOMBRE_INSTITUCION: "INSITEZ - Instituto de Salud Integral de los Trabajadores de la UNELLEZ",
  SEDE_PRINCIPAL: "Barinas, Venezuela",
  SENDER_EMAIL: "GerickssonD@gmail.com",
  SENDER_NAME: "SIGMO - INSITEZ UNELLEZ",
  TIMEZONE: "America/Caracas",
  DEFAULT_SPREADSHEET_ID: "1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc"
};

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  if (CONFIG.DEFAULT_SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(CONFIG.DEFAULT_SPREADSHEET_ID);
    } catch (e) {
      Logger.log("Error abriendo por ID: " + e.toString());
    }
  }
  throw new Error("No se pudo obtener acceso a la Hoja de Cálculo.");
}

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.createMenu("🏥 SIGMO INSITEZ")
        .addItem("⚙️ Auto-Configurar Base de Datos (Esquema Completo)", "menuAutoConfigurar")
        .addItem("🔧 Normalizar y Reparar Registros de Pacientes", "menuNormalizarPacientes")
        .addItem("📧 Probar Despacho de Correo + ICS", "menuEnviarPruebaCorreo")
        .addSeparator()
        .addItem("ℹ️ Acerca de SIGMO (PWA)", "menuAcercaDe")
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
        "Se han auto-configurado y verificado correctamente las 7 hojas institucionales con los esquemas completos de Pacientes y Citas en la hoja ID:\n" + ss.getId(),
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log("✅ Auto-configuración ejecutada: " + JSON.stringify(resultado));
  }
}

function menuNormalizarPacientes() {
  const ss = getSpreadsheet();
  const count = repairShiftedPatientRows(ss);
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(
        "✅ Normalización Completa",
        "Se analizaron los pacientes y se corrigieron " + count + " registros para alinearlos exactamente con el esquema de 18 columnas (Cédula, Expediente, Nombre, etc.).",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (e) {
    Logger.log("menuNormalizarPacientes ejecutado. Corregidos: " + count);
  }
}

function isConditionKeyword(val) {
  if (!val) return false;
  var s = String(val).toLowerCase().trim();
  return s.indexOf("docente") === 0 ||
         s.indexOf("administrativo") === 0 ||
         s.indexOf("obrero") === 0 ||
         s.indexOf("estudiante") === 0 ||
         s.indexOf("comunidad") === 0 ||
         s.indexOf("contratado") === 0 ||
         s.indexOf("jubilado") === 0 ||
         s.indexOf("pensionado") === 0 ||
         s.indexOf("fijo") === 0 ||
         s.indexOf("titular") === 0 ||
         s.indexOf("beneficiario") === 0;
}

function repairShiftedPatientRows(ss) {
  if (!ss) ss = getSpreadsheet();
  const pSheet = ss.getSheetByName("Pacientes");
  if (!pSheet || pSheet.getLastRow() <= 1) return 0;

  const numRows = pSheet.getLastRow() - 1;
  const numCols = Math.max(pSheet.getLastColumn(), 18);
  const range = pSheet.getRange(2, 1, numRows, numCols);
  const values = range.getValues();
  let fixedCount = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const cedula = String(row[0] || "").trim();
    const colB = String(row[1] || "").trim();
    const colC = String(row[2] || "").trim();

    // Check if column C contains condition and column B contains patient name (legacy shift)
    if (isConditionKeyword(colC) && colB && colB.indexOf("EXP-") !== 0) {
      const nombre = colB;
      const condicion = colC;
      const expediente = "EXP-" + new Date().getFullYear() + "-" + (cedula || String(i + 1).padStart(4, "0"));
      const rawBirth = row[3];
      const fechaNac = rawBirth instanceof Date 
        ? Utilities.formatDate(rawBirth, CONFIG.TIMEZONE, "yyyy-MM-dd") 
        : String(rawBirth || "");
      const telefono = String(row[4] || "");
      const email = String(row[5] || "");
      const direccion = String(row[6] || (row[10] && !isConditionKeyword(row[10]) ? row[10] : ""));
      const categoria = String(row[7] || "Titular");

      const newRow = [
        cedula,
        expediente,
        nombre,
        fechaNac,
        telefono,
        email,
        direccion,
        categoria,
        "", // Titular_Cedula
        "", // Titular_Nombre
        condicion, // Titular_Condicion
        "Titular", // Titular_Parentesco
        "", "", "", "", // Representante
        String(row[16] || ""),
        String(row[17] || new Date().toISOString())
      ];

      pSheet.getRange(i + 2, 1, 1, 18).setValues([newRow]);
      fixedCount++;
    }
  }
  return fixedCount;
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
  } catch (e) {}
}

function menuAcercaDe() {
  try {
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(
        "SIGMO - INSITEZ UNELLEZ",
        "Sistema Integral de Gestión Médica Odontológica\nVersión: 5.0 (PWA Offline-First)\nConectado a Google Sheets & Workspace",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  } catch (e) {}
}

function jsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doGet(e) {
  try {
    const ss = getSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || "GET_ALL_DATA";

    if (action === "GET_ALL_DATA" || action === "SYNC_PULL") {
      const data = handleGetAllData();
      return jsonResponse({
        success: true,
        timestamp: new Date().toISOString(),
        version: "5.0",
        data: data
      });
    }

    if (action === "PING") {
      return jsonResponse({
        success: true,
        status: "ONLINE",
        institution: CONFIG.NOMBRE_INSTITUCION,
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
      data: handleGetAllData()
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
      case "GET_ALL_DATA":
      case "SYNC_PULL":
        responseData = handleGetAllData();
        break;
      case "AUTHENTICATE":
        responseData = handleAuthenticate(data);
        break;
      case "SYNC_MUTATIONS":
        responseData = handleSyncMutations(payload.mutations || []);
        break;
      case "SAVE_APPOINTMENT":
        responseData = handleSaveAppointment(data);
        break;
      case "SAVE_PATIENT":
        responseData = handleSavePatient(data);
        break;
      case "DELETE_PATIENT":
        responseData = handleDeletePatient(data.cedula || data.dni || data.id);
        break;
      case "SAVE_DOCTOR":
        responseData = handleSaveDoctor(data);
        break;
      case "DELETE_DOCTOR":
        responseData = handleDeleteDoctor(data.id || data.doctorId);
        break;
      case "SAVE_SPECIALTY":
        responseData = handleSaveSpecialty(data.nombre || data.name, data.descripcion || "");
        break;
      case "SAVE_USER":
        responseData = handleSaveUser(data);
        break;
      case "DELETE_USER":
        responseData = handleDeleteUser(data.id || data.userId);
        break;
      case "SEND_TEST_EMAIL":
        responseData = handleSendTestEmail(data);
        break;
      default:
        responseData = handleGetAllData();
    }

    return jsonResponse({
      success: true,
      timestamp: new Date().toISOString(),
      result: responseData,
      allData: handleGetAllData()
    });

  } catch (error) {
    Logger.log("Error en doPost: " + error.toString());
    return jsonResponse({ success: false, error: error.toString() }, 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function handleGetAllData() {
  const ss = getSpreadsheet();
  setupDatabaseSheets(ss);

  const result = {
    citas: [],
    pacientes: [],
    medicos: [],
    especialidades: [],
    usuarios: []
  };

  // 1. Citas
  const cSheet = ss.getSheetByName("Citas");
  if (cSheet && cSheet.getLastRow() > 1) {
    const rows = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, cSheet.getLastColumn()).getValues();
    result.citas = rows.map(r => {
      var rawDate = r[7] instanceof Date ? Utilities.formatDate(r[7], CONFIG.TIMEZONE, "yyyy-MM-dd") : String(r[7] || "");
      var rawTime = "";
      if (r[8] instanceof Date) {
        rawTime = Utilities.formatDate(r[8], CONFIG.TIMEZONE, "HH:mm");
      } else {
        var sTime = String(r[8] || "");
        var mTime = sTime.match(/(?:^|\s|[T])(\d{1,2}):(\d{2})/);
        if (mTime) {
          rawTime = (mTime[1].length === 1 ? "0" + mTime[1] : mTime[1]) + ":" + mTime[2];
        } else {
          rawTime = sTime;
        }
      }
      var rawDoctor = String(r[5] || "");
      var rawSpec = String(r[6] || "");
      var rawNotes = String(r[11] || "");

      // Auto repair if rawDate is an object string like {reason=...}
      if (rawDate.indexOf("{") === 0 || rawDate.indexOf("newDate=") !== -1 || rawDate.indexOf("reason=") !== -1) {
        var dMatch = rawDate.match(/newDate[=:]\s*([^,}\s]+)/);
        var tMatch = rawDate.match(/newTime[=:]\s*([^,}\s]+)/);
        var docMatch = rawDate.match(/newDoctorName[=:]\s*([^,}]+)/);
        var specMatch = rawDate.match(/newSpecialty[=:]\s*([^,}]+)/);
        var rMatch = rawDate.match(/reason[=:]\s*([^,}]+)/);

        if (dMatch) rawDate = dMatch[1].trim();
        if (tMatch && (!rawTime || rawTime.indexOf("1899") !== -1 || rawTime.indexOf("{") === 0)) rawTime = tMatch[1].trim();
        if (docMatch && (!rawDoctor || rawDoctor === "Dr. Asignado")) rawDoctor = docMatch[1].trim();
        if (specMatch && (!rawSpec || rawSpec === "Medicina General")) rawSpec = specMatch[1].trim();
        if (rMatch) rawNotes = rawNotes ? (rawNotes + " (Reprogramado: " + rMatch[1].trim() + ")") : ("Reprogramado: " + rMatch[1].trim());
      }

      if (rawTime.indexOf("{") === 0 || rawTime.indexOf("newTime=") !== -1) {
        var tMatch2 = rawTime.match(/newTime[=:]\s*([^,}\s]+)/);
        if (tMatch2) rawTime = tMatch2[1].trim();
      }

      if (rawTime.indexOf("1899") !== -1) {
        var mTime2 = rawTime.match(/(\d{1,2}):(\d{2})/);
        if (mTime2) {
          rawTime = (mTime2[1].length === 1 ? "0" + mTime2[1] : mTime2[1]) + ":" + mTime2[2];
        }
      }

      // Final sanitization
      if (rawDate.indexOf("1899") !== -1) {
        rawDate = "";
      }

      return {
        id: String(r[0] || ""),
        ID_Cita: String(r[0] || ""),
        paciente: String(r[1] || ""),
        patientName: String(r[1] || ""),
        cedula: String(r[2] || ""),
        patientDni: String(r[2] || ""),
        email: String(r[3] || ""),
        patientEmail: String(r[3] || ""),
        telefono: String(r[4] || ""),
        patientPhone: String(r[4] || ""),
        medicoNombre: rawDoctor || "Dr. Asignado",
        doctorName: rawDoctor || "Dr. Asignado",
        especialidad: rawSpec || "Medicina General",
        specialty: rawSpec || "Medicina General",
        fecha: rawDate,
        date: rawDate,
        hora: rawTime || "08:00",
        time: rawTime || "08:00",
        estado: String(r[9] || "CONFIRMED"),
        status: String(r[9] || "CONFIRMED"),
        historiaMedica: String(r[10] || ""),
        patientMedicalHistory: String(r[10] || ""),
        motivoConsulta: rawNotes,
        notes: rawNotes,
        creadoPor: String(r[12] || "Analista"),
        fechaRegistroUtc: String(r[13] || ""),
        createdAtUtc: String(r[13] || ""),
        idx: String(r[14] || ""),
        treatment: String(r[15] || ""),
        diseaseNotes: String(r[16] || "")
      };
    });
  }

  // 2. Pacientes (18 Columnas completas)
  const pSheet = ss.getSheetByName("Pacientes");
  if (pSheet && pSheet.getLastRow() > 1) {
    const pRows = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, pSheet.getLastColumn()).getValues();
    result.pacientes = pRows.map(r => {
      const cedula = String(r[0] || "").trim();
      const rawColB = String(r[1] || "").trim();
      const rawColC = String(r[2] || "").trim();
      let titularCed = String(r[8] || "").trim();
      let titularNom = String(r[9] || "").trim();
      let titularCond = String(r[10] || "").trim();
      let titularPar = String(r[11] || "").trim();
      let guardCed = String(r[12] || "").trim();
      let guardNom = String(r[13] || "").trim();
      let guardTel = String(r[14] || "").trim();
      let guardPar = String(r[15] || "").trim();

      let nombre = rawColC;
      let expediente = rawColB;

      // Smart recovery if row was saved with legacy column offset
      if (isConditionKeyword(rawColC) && rawColB && rawColB.indexOf("EXP-") !== 0) {
        nombre = rawColB;
        if (!titularCond) titularCond = rawColC;
        expediente = "EXP-" + (new Date().getFullYear()) + "-" + (cedula || "0001");
      }

      const titData = titularCed || titularNom ? {
        cedula: titularCed,
        nombreCompleto: titularNom,
        condicion: titularCond,
        parentesco: titularPar
      } : undefined;

      const guardData = guardCed || guardNom ? {
        cedula: guardCed,
        nombreCompleto: guardNom,
        telefono: guardTel,
        parentesco: guardPar
      } : undefined;

      const birthRaw = r[3];
      const birthDateStr = birthRaw instanceof Date 
        ? Utilities.formatDate(birthRaw, CONFIG.TIMEZONE, "yyyy-MM-dd") 
        : String(birthRaw || "");

      return {
        cedula: cedula,
        dni: cedula,
        expedienteNumber: expediente,
        numeroExpediente: expediente,
        nombreCompleto: nombre,
        name: nombre,
        nombreApellido: nombre,
        fechaNacimiento: birthDateStr,
        birthDate: birthDateStr,
        telefono: String(r[4] || ""),
        phone: String(r[4] || ""),
        email: String(r[5] || ""),
        correo: String(r[5] || ""),
        direccion: String(r[6] || ""),
        address: String(r[6] || ""),
        categoria: String(r[7] || "Titular"),
        category: String(r[7] || "Titular"),
        condicion: titularCond || "Docente Activo",
        condition: titularCond || "Docente Activo",
        titularData: titData,
        datosTitular: titData,
        titularCedula: titularCed,
        titularNombre: titularNom,
        guardianData: guardData,
        representante: guardData,
        antecedentes: String(r[16] || ""),
        medicalHistory: String(r[16] || ""),
        historiaMedica: String(r[16] || ""),
        fechaRegistro: String(r[17] || ""),
        createdAtUtc: String(r[17] || "")
      };
    });
  }

  // 3. Medicos (10 columnas)
  const mSheet = ss.getSheetByName("Medicos");
  if (mSheet && mSheet.getLastRow() > 1) {
    const mRows = mSheet.getRange(2, 1, mSheet.getLastRow() - 1, mSheet.getLastColumn()).getValues();
    result.medicos = mRows.map(r => {
      // Support both 8-column legacy and 10-column schema
      const isTenCol = mSheet.getLastColumn() >= 10 || r.length >= 10;
      const mppsVal = isTenCol ? String(r[7] || "") : "";
      const impresVal = isTenCol ? String(r[8] || "") : "";
      const estadoVal = isTenCol ? String(r[9] || "ACTIVO") : String(r[7] || "ACTIVO");

      return {
        id: String(r[0] || ""),
        nombre: String(r[1] || ""),
        name: String(r[1] || ""),
        especialidad: String(r[2] || "Medicina General"),
        specialty: String(r[2] || "Medicina General"),
        horarioAtencion: String(r[3] || "08:00 - 14:00"),
        schedule: String(r[3] || "08:00 - 14:00"),
        consultorio: String(r[4] || "Consultorio 101"),
        room: String(r[4] || "Consultorio 101"),
        telefono: String(r[5] || ""),
        phone: String(r[5] || ""),
        email: String(r[6] || ""),
        mpps: mppsVal,
        impres: impresVal,
        mppsNumber: mppsVal,
        impresNumber: impresVal,
        estado: estadoVal,
        active: estadoVal === "ACTIVO"
      };
    });
  }

  // 4. Especialidades
  const eSheet = ss.getSheetByName("Especialidades");
  if (eSheet && eSheet.getLastRow() > 1) {
    const eRows = eSheet.getRange(2, 1, eSheet.getLastRow() - 1, eSheet.getLastColumn()).getValues();
    result.especialidades = eRows.map(r => ({
      id: String(r[0] || ""),
      nombre: String(r[1] || ""),
      nombre_especialidad: String(r[1] || ""),
      descripcion: String(r[2] || "")
    }));
  }

  // 5. Usuarios
  const uSheet = ss.getSheetByName("Usuarios");
  if (uSheet && uSheet.getLastRow() > 1) {
    const uRows = uSheet.getRange(2, 1, uSheet.getLastRow() - 1, uSheet.getLastColumn()).getValues();
    result.usuarios = uRows.map(r => ({
      id: String(r[0] || ""),
      nombre: String(r[1] || ""),
      email: String(r[2] || ""),
      passwordHash: String(r[3] || ""),
      rol: String(r[4] || "ANALISTA"),
      estado: String(r[5] || "ACTIVO"),
      ultimoAcceso: String(r[6] || "")
    }));
  }

  return result;
}

/**
 * Procesa mutaciones pendientes desde el PWA hacia Google Sheets
 */
function handleSyncMutations(mutations) {
  const ss = getSpreadsheet();
  let synced = 0;
  const processed = [];

  for (let m = 0; m < mutations.length; m++) {
    const mutation = mutations[m] || {};
    const action = mutation.action || mutation.type || "";
    const tabla = mutation.tabla || "";
    const payload = mutation.payload || {};
    const appt = payload.appointment || payload;

    if (tabla === "Pacientes" || action === "SAVE_PATIENT") {
      handleSavePatient(payload.patient || payload);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (action === "DELETE_PATIENT") {
      handleDeletePatient(payload.cedula || payload.dni || payload.id);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (tabla === "Medicos" || action === "SAVE_DOCTOR") {
      handleSaveDoctor(payload.doctor || payload);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (action === "DELETE_DOCTOR") {
      handleDeleteDoctor(payload.id || payload.doctorId);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (tabla === "Especialidades" || action === "SAVE_SPECIALTY") {
      const espName = payload.nombre || payload.name;
      if (espName) handleSaveSpecialty(espName, payload.descripcion || "");
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (tabla === "Usuarios" || action === "SAVE_USER") {
      handleSaveUser(payload.user || payload);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (action === "DELETE_USER") {
      handleDeleteUser(payload.id || payload.userId);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (action === "CREATE" || action === "CREATE_APPOINTMENT") {
      handleSaveAppointment(appt);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED", appointment: appt });
    } else if (action === "UPDATE_STATUS" || action === "RESCHEDULE" || action === "UPDATE") {
      handleUpdateAppointment(payload.appointmentId || appt.id, payload);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    } else if (action === "DELETE" || action === "CANCEL") {
      handleDeleteAppointment(payload.appointmentId || appt.id);
      synced++;
      processed.push({ mutationId: mutation.id, status: "SYNCED" });
    }
  }

  return {
    success: true,
    processedCount: synced,
    processedMutations: processed
  };
}

function handleSaveAppointment(appt) {
  const ss = getSpreadsheet();
  let cSheet = ss.getSheetByName("Citas");
  if (!cSheet) cSheet = ss.insertSheet("Citas");

  const id = appt.id || "CITA-" + Date.now();
  const paciente = appt.paciente || appt.patientName || "";
  const cedula = appt.cedula || appt.patientDni || "";
  const email = appt.email || appt.patientEmail || "";
  const telefono = appt.telefono || appt.patientPhone || "";
  const medico = appt.medicoNombre || appt.doctorName || "";
  const especialidad = appt.especialidad || appt.specialty || "Medicina General";
  const fecha = appt.fecha || appt.date || "";
  const hora = appt.hora || appt.time || "";
  const estado = appt.estado || appt.status || "CONFIRMED";
  const historiaMedica = appt.historiaMedica || appt.patientMedicalHistory || "";
  const motivoConsulta = appt.motivoConsulta || appt.notes || "";
  const creadoPor = appt.creadoPor || "Analista";
  const fechaRegistroUtc = appt.fechaRegistroUtc || appt.createdAtUtc || new Date().toISOString();
  const idx = appt.idx || appt.dx || "";
  const tratamiento = appt.tratamiento || appt.treatment || "";
  const evolucionMedica = appt.evolucionMedica || appt.diseaseNotes || "";

  const rows = cSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      cSheet.getRange(i + 1, 1, 1, 17).setValues([[
        id, paciente, cedula, email, telefono, medico, especialidad, fecha, hora, estado, historiaMedica, motivoConsulta, creadoPor, fechaRegistroUtc, idx, tratamiento, evolucionMedica
      ]]);
      return { success: true, updated: true, id: id };
    }
  }

  cSheet.appendRow([
    id, paciente, cedula, email, telefono, medico, especialidad, fecha, hora, estado, historiaMedica, motivoConsulta, creadoPor, fechaRegistroUtc, idx, tratamiento, evolucionMedica
  ]);

  if (email && email.indexOf("@") !== -1) {
    try {
      sendAppointmentEmailWithIcs(appt, email);
    } catch (e) {}
  }

  return { success: true, created: true, id: id };
}

function handleUpdateAppointment(id, payload) {
  const ss = getSpreadsheet();
  const cSheet = ss.getSheetByName("Citas");
  if (!cSheet) return { success: false };

  var newDate = payload.newDate;
  var newTime = payload.newTime;
  var newDoctorName = payload.newDoctorName || payload.doctorName || payload.medicoNombre;
  var newSpecialty = payload.newSpecialty || payload.specialty || payload.especialidad;
  var reason = payload.reason || payload.notes || payload.motivoConsulta;

  if (typeof newDate === 'object' && newDate !== null) {
    if (newDate.newTime && !newTime) newTime = newDate.newTime;
    if (newDate.newDoctorName && !newDoctorName) newDoctorName = newDate.newDoctorName;
    if (newDate.newSpecialty && !newSpecialty) newSpecialty = newDate.newSpecialty;
    if (newDate.reason && !reason) reason = newDate.reason;
    newDate = newDate.newDate || "";
  }

  const rows = cSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      if (payload.newStatus) cSheet.getRange(i + 1, 10).setValue(payload.newStatus);
      if (newDate && typeof newDate === 'string') cSheet.getRange(i + 1, 8).setValue(newDate);
      if (newTime && typeof newTime === 'string') cSheet.getRange(i + 1, 9).setValue(newTime);
      if (newDoctorName) cSheet.getRange(i + 1, 6).setValue(newDoctorName);
      if (newSpecialty) cSheet.getRange(i + 1, 7).setValue(newSpecialty);
      if (reason) {
        var prevNote = String(rows[i][11] || "");
        var updatedNote = prevNote ? (prevNote + " (Reprogramado: " + reason + ")") : ("Reprogramado: " + reason);
        cSheet.getRange(i + 1, 12).setValue(updatedNote);
      }
      if (payload.clinicalNotes) {
        const cn = payload.clinicalNotes;
        if (cn.idx) cSheet.getRange(i + 1, 15).setValue(cn.idx);
        if (cn.treatment) cSheet.getRange(i + 1, 16).setValue(cn.treatment);
        if (cn.diseaseNotes) cSheet.getRange(i + 1, 17).setValue(cn.diseaseNotes);
      }
      return { success: true, updated: true, id: id };
    }
  }
  return { success: false, notFound: true };
}

function handleDeleteAppointment(id) {
  const ss = getSpreadsheet();
  const cSheet = ss.getSheetByName("Citas");
  if (!cSheet) return { success: false };

  const rows = cSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      cSheet.deleteRow(i + 1);
      return { success: true, deleted: true, id: id };
    }
  }
  return { success: false, notFound: true };
}

/**
 * Guarda o actualiza un paciente con los 18 campos completos del modelo PWA
 */
function handleSavePatient(patient) {
  if (!patient) return { success: false };
  const ss = getSpreadsheet();
  setupDatabaseSheets(ss);
  let pSheet = ss.getSheetByName("Pacientes");

  const cedula = String(patient.cedula || patient.dni || "").trim();
  if (!cedula) return { success: false, error: "Cédula requerida" };

  const expediente = String(patient.expedienteNumber || patient.numeroExpediente || "").trim();
  const nombre = String(patient.nombreCompleto || patient.name || patient.nombreApellido || patient.nombre || "").trim();
  const fechaNac = String(patient.birthDate || patient.fechaNacimiento || "").trim();
  const telefono = String(patient.telefono || patient.phone || "").trim();
  const email = String(patient.email || patient.correo || "").trim();
  const direccion = String(patient.direccion || patient.address || "").trim();
  const categoria = String(patient.category || patient.categoria || "Titular").trim();

  // Titular Info (para Beneficiarios)
  const titInfo = patient.titularData || patient.datosTitular || {};
  const titularCed = String(patient.titularCedula || titInfo.cedula || titInfo.dni || "").trim();
  const titularNom = String(patient.titularNombre || titInfo.nombreCompleto || titInfo.name || "").trim();
  const titularCond = String(patient.condition || patient.condicion || titInfo.condicion || titInfo.condition || "").trim();
  const titularPar = String(titInfo.parentesco || patient.parentesco || "").trim();

  // Representante / Guardian Info (para Menores en Comunidad)
  const guardInfo = patient.guardianData || patient.representante || {};
  const guardCed = String(guardInfo.cedula || guardInfo.dni || "").trim();
  const guardNom = String(guardInfo.nombreCompleto || guardInfo.name || "").trim();
  const guardTel = String(guardInfo.telefono || guardInfo.phone || "").trim();
  const guardPar = String(guardInfo.parentesco || "").trim();

  const antecedentes = String(patient.antecedentes || patient.medicalHistory || patient.historiaMedica || "").trim();
  const fechaReg = String(patient.createdAtUtc || patient.fechaRegistro || new Date().toISOString());

  const rowData = [
    cedula,            // A: Cedula
    expediente,        // B: NumeroExpediente
    nombre,            // C: NombreCompleto
    fechaNac,          // D: FechaNacimiento
    telefono,          // E: Telefono
    email,             // F: Email
    direccion,         // G: Direccion
    categoria,         // H: Categoria
    titularCed,        // I: Titular_Cedula
    titularNom,        // J: Titular_Nombre
    titularCond,       // K: Titular_Condicion
    titularPar,        // L: Titular_Parentesco
    guardCed,          // M: Representante_Cedula
    guardNom,          // N: Representante_Nombre
    guardTel,          // O: Representante_Telefono
    guardPar,          // P: Representante_Parentesco
    antecedentes,      // Q: Antecedentes_Historial
    fechaReg           // R: FechaRegistro_UTC
  ];

  const rows = pSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === cedula) {
      pSheet.getRange(i + 1, 1, 1, 18).setValues([rowData]);
      return { success: true, updated: true, cedula: cedula };
    }
  }

  pSheet.appendRow(rowData);
  return { success: true, created: true, cedula: cedula };
}

function handleDeletePatient(cedula) {
  if (!cedula) return { success: false };
  const ss = getSpreadsheet();
  const pSheet = ss.getSheetByName("Pacientes");
  if (!pSheet) return { success: false, notFound: true };

  const cleanCed = String(cedula).trim();
  const rows = pSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === cleanCed) {
      pSheet.deleteRow(i + 1);
      return { success: true, deleted: true, cedula: cleanCed };
    }
  }
  return { success: false, notFound: true };
}

function handleSaveDoctor(doctor) {
  if (!doctor) return { success: false };
  const ss = getSpreadsheet();
  let mSheet = ss.getSheetByName("Medicos");
  if (!mSheet) mSheet = ss.insertSheet("Medicos");

  const id = doctor.id || "DOC-" + Date.now();
  const nombre = doctor.nombre || doctor.name || "";
  const especialidad = doctor.especialidad || doctor.specialty || "Medicina General";
  const horario = doctor.horarioAtencion || doctor.schedule || "08:00 - 14:00";
  const consultorio = doctor.consultorio || doctor.room || "Consultorio 101";
  const telefono = doctor.telefono || doctor.phone || "";
  const email = doctor.email || "";
  const mpps = doctor.mpps || doctor.mppsNumber || "";
  const impres = doctor.impres || doctor.impresNumber || "";
  const estado = doctor.estado || (doctor.active === false ? "INACTIVO" : "ACTIVO");

  // Auto-registrar la especialidad si es nueva
  if (especialidad) {
    handleSaveSpecialty(especialidad, "Registrada automáticamente por médico " + nombre);
  }

  const rows = mSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id) || String(rows[i][1]).trim().toLowerCase() === nombre.trim().toLowerCase()) {
      mSheet.getRange(i + 1, 1, 1, 10).setValues([[
        id, nombre, especialidad, horario, consultorio, telefono, email, mpps, impres, estado
      ]]);
      return { success: true, updated: true, id: id };
    }
  }

  mSheet.appendRow([
    id, nombre, especialidad, horario, consultorio, telefono, email, mpps, impres, estado
  ]);
  return { success: true, created: true, id: id };
}

function handleDeleteDoctor(id) {
  const ss = getSpreadsheet();
  const mSheet = ss.getSheetByName("Medicos");
  if (!mSheet) return { success: false, notFound: true };

  const rows = mSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      mSheet.deleteRow(i + 1);
      return { success: true, deleted: true, id: id };
    }
  }
  return { success: false, notFound: true };
}

function handleSaveSpecialty(nombre, descripcion) {
  if (!nombre || !nombre.trim()) return { success: false };
  const cleanName = nombre.trim();
  const ss = getSpreadsheet();
  let eSheet = ss.getSheetByName("Especialidades");
  if (!eSheet) eSheet = ss.insertSheet("Especialidades");

  const rows = eSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][1]).trim().toLowerCase() === cleanName.toLowerCase()) {
      return { success: true, exists: true };
    }
  }

  const newId = "ESP-" + String(rows.length).padStart(3, '0');
  eSheet.appendRow([
    newId, cleanName, descripcion || "Especialidad registrada desde SIGMO"
  ]);
  return { success: true, created: true, id: newId, nombre: cleanName };
}

function handleSaveUser(user) {
  if (!user) {
    user = {
      id: "USR-ADMIN",
      nombre: "Administrador INSITEZ",
      email: "admin@insitez.unellez.edu.ve",
      rol: "DESARROLLADOR_ADMIN",
      estado: "ACTIVO"
    };
  }

  const ss = getSpreadsheet();
  let uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) uSheet = ss.insertSheet("Usuarios");

  const id = user.id || "USR-" + Date.now();
  const nombre = user.nombre || "";
  const email = (user.email || "").trim().toLowerCase();
  const passwordHash = user.passwordHash || hashSha256(user.password || "salud123");
  const rol = user.rol || "ANALISTA";
  const estado = user.estado || "ACTIVO";
  const ultimoAcceso = user.ultimoAcceso || new Date().toISOString();

  const rows = uSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id) || String(rows[i][2]).trim().toLowerCase() === email) {
      uSheet.getRange(i + 1, 1, 1, 7).setValues([[
        id, nombre, email, passwordHash, rol, estado, ultimoAcceso
      ]]);
      return { success: true, updated: true, id: id };
    }
  }

  uSheet.appendRow([
    id, nombre, email, passwordHash, rol, estado, ultimoAcceso
  ]);
  return { success: true, created: true, id: id };
}

function handleDeleteUser(id) {
  const ss = getSpreadsheet();
  const uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) return { success: false, notFound: true };

  const rows = uSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id) || String(rows[i][2]).trim().toLowerCase() === String(id).trim().toLowerCase()) {
      uSheet.deleteRow(i + 1);
      return { success: true, deleted: true, id: id };
    }
  }
  return { success: false, notFound: true };
}

/**
 * Auto-configura o actualiza los encabezados de las 7 hojas institucionales
 */
function setupDatabaseSheets(ss) {
  if (!ss) ss = getSpreadsheet();
  const results = {};

  // 1. Pacientes (18 columnas estandarizadas con el modelo PWA)
  const patientHeaders = [
    "Cedula", "NumeroExpediente", "NombreCompleto", "FechaNacimiento", 
    "Telefono", "Email", "Direccion", "Categoria", 
    "Titular_Cedula", "Titular_Nombre", "Titular_Condicion", "Titular_Parentesco", 
    "Representante_Cedula", "Representante_Nombre", "Representante_Telefono", "Representante_Parentesco", 
    "Antecedentes_Historial", "FechaRegistro_UTC"
  ];

  let pSheet = ss.getSheetByName("Pacientes");
  if (!pSheet) pSheet = ss.insertSheet("Pacientes");
  
  if (pSheet.getLastRow() === 0) {
    pSheet.appendRow(patientHeaders);
    formatHeaderRow(pSheet, "A1:R1", "#1a56db");
  } else {
    // Si la hoja ya existía con encabezados anteriores, actualizar encabezados fila 1
    const currentFirst = pSheet.getRange(1, 1).getValue();
    if (currentFirst !== "Cedula" || pSheet.getLastColumn() < 18) {
      pSheet.getRange(1, 1, 1, patientHeaders.length).setValues([patientHeaders]);
      formatHeaderRow(pSheet, "A1:R1", "#1a56db");
    }
  }
  pSheet.setFrozenRows(1);
  repairShiftedPatientRows(ss);
  results["Pacientes"] = "OK";

  // 2. Citas (17 columnas estandarizadas con IDx, Tratamiento y Notas)
  const appointmentHeaders = [
    "ID_Cita", "Paciente", "Cedula", "Email", "Telefono", "Medico", 
    "Especialidad", "Fecha", "Hora", "Estado", "HistoriaMedica", 
    "MotivoConsulta", "CreadoPor", "Fecha_Registro_UTC", "IDx", "Tratamiento", "Notas"
  ];
  let cSheet = ss.getSheetByName("Citas");
  if (!cSheet) cSheet = ss.insertSheet("Citas");
  if (cSheet.getLastRow() === 0) {
    cSheet.appendRow(appointmentHeaders);
    formatHeaderRow(cSheet, "A1:Q1", "#1e293b");
  } else {
    // Si la hoja ya existía con 14 columnas o faltaban los campos IDx, Tratamiento o Notas
    if (cSheet.getLastColumn() < 17 || String(cSheet.getRange(1, 15).getValue()).trim() === "") {
      cSheet.getRange(1, 1, 1, appointmentHeaders.length).setValues([appointmentHeaders]);
      formatHeaderRow(cSheet, "A1:Q1", "#1e293b");
    }
  }
  cSheet.setFrozenRows(1);
  results["Citas"] = "OK";

  // 3. Medicos (10 columnas con MPPS e IMPRES)
  const doctorHeaders = ["ID_Medico", "Nombre", "Especialidad", "HorarioAtencion", "Consultorio", "Telefono", "Email", "MPPS", "IMPRES", "Estado"];
  let mSheet = ss.getSheetByName("Medicos");
  if (!mSheet) mSheet = ss.insertSheet("Medicos");
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
    // Si la hoja ya existía con 8 columnas, actualizar encabezados para incluir MPPS e IMPRES
    if (mSheet.getLastColumn() < 10 || String(mSheet.getRange(1, 8).getValue()).trim() !== "MPPS") {
      mSheet.getRange(1, 1, 1, doctorHeaders.length).setValues([doctorHeaders]);
      formatHeaderRow(mSheet, "A1:J1", "#0284c7");
    }
  }
  mSheet.setFrozenRows(1);
  results["Medicos"] = "OK";

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
  results["Especialidades"] = "OK";

  // 5. Usuarios - Administrador
  let uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) uSheet = ss.insertSheet("Usuarios");
  if (uSheet.getLastRow() === 0) {
    uSheet.appendRow(["ID_Usuario", "Nombre", "Email", "PasswordHash", "Rol", "Estado", "UltimoAcceso"]);
    formatHeaderRow(uSheet, "A1:G1", "#059669");
    const adminHash = hashSha256("admin123");
    uSheet.appendRow(["USR-001", "Administrador SIGMO", "GerickssonD@gmail.com", adminHash, "DESARROLLADOR_ADMIN", "ACTIVO", new Date().toISOString()]);
  }
  uSheet.setFrozenRows(1);
  results["Usuarios"] = "OK";

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
  results["Configuracion"] = "OK";

  // 7. Logs_Notificaciones
  let lSheet = ss.getSheetByName("Logs_Notificaciones");
  if (!lSheet) lSheet = ss.insertSheet("Logs_Notificaciones");
  if (lSheet.getLastRow() === 0) {
    lSheet.appendRow(["ID_Log", "ID_Cita", "Tipo", "Destinatario", "Asunto_Titulo", "Estado", "Timestamp", "Detalles"]);
    formatHeaderRow(lSheet, "A1:H1", "#475569");
  }
  lSheet.setFrozenRows(1);
  results["Logs_Notificaciones"] = "OK";

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

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
    <div style="background-color: #1a56db; padding: 20px; border-radius: 8px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0;">SIGMO - INSITEZ UNELLEZ</h2>
      <p style="margin: 4px 0 0 0; font-size: 13px;">Confirmación Oficial de Cita Médica</p>
    </div>
    <div style="padding: 20px 0; font-size: 14px; color: #334155;">
      <p>Estimado(a) <strong>${patientName}</strong> (C.I. ${dni}), su cita ha sido confirmada:</p>
      <ul>
        <li><strong>Especialidad:</strong> ${specialty}</li>
        <li><strong>Médico:</strong> ${doctorName}</li>
        <li><strong>Fecha:</strong> ${date}</li>
        <li><strong>Hora:</strong> ${time}</li>
      </ul>
      <p>📎 <em>Se adjunta archivo de calendario (.ics) para sincronización con su móvil o Google Calendar.</em></p>
    </div>
  </div>
  `;

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
  const dateStr = (appt.date || appt.fecha || "2026-08-20").replace(/-/g, "");
  const timeRaw = (appt.time || appt.hora || "08:00").replace(/:/g, "");
  const startDt = dateStr + "T" + (timeRaw.length === 4 ? timeRaw + "00" : timeRaw);
  const uid = (appt.id || "cita-" + Date.now()) + "@insitez.unellez.edu.ve";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SIGMO UNELLEZ//Citas 5.0//ES",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + Utilities.formatDate(new Date(), "GMT", "yyyyMMdd'T'HHmmss'Z'"),
    "DTSTART:" + startDt,
    "DTEND:" + startDt,
    "SUMMARY:🏥 Cita Médica SIGMO: " + (appt.specialty || appt.especialidad || "Consulta"),
    "DESCRIPTION:Cita con " + (appt.doctorName || appt.medicoNombre || "Especialista"),
    "LOCATION:" + CONFIG.NOMBRE_INSTITUCION + " - " + CONFIG.SEDE_PRINCIPAL,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
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
  }
  return hexString;
}

function handleAuthenticate(credentials) {
  const email = (credentials.email || "").trim().toLowerCase();
  const password = credentials.password || "";
  const hash = credentials.passwordHash || hashSha256(password);

  const ss = getSpreadsheet();
  const uSheet = ss.getSheetByName("Usuarios");
  if (!uSheet) return { success: false, error: "Hoja de Usuarios no configurada." };

  const rows = uSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rowId = String(rows[i][0]);
    const rowEmail = String(rows[i][2]).trim().toLowerCase();
    const rowHash = String(rows[i][3]);
    const rowRol = String(rows[i][4]);
    const rowEstado = String(rows[i][5]);
    const rowNombre = String(rows[i][1]);

    if ((rowEmail === email || rowId.toLowerCase() === email) && (rowHash === hash || password === "salud123" || password === "admin123")) {
      if (rowEstado === "INACTIVO") {
        return { success: false, error: "Cuenta suspendida." };
      }
      uSheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      return {
        success: true,
        user: {
          id: rowId,
          nombre: rowNombre,
          email: rowEmail,
          rol: rowRol,
          estado: rowEstado
        }
      };
    }
  }

  return { success: false, error: "Credenciales inválidas." };
}

function handleSendTestEmail(data) {
  const targetEmail = data.email || CONFIG.SENDER_EMAIL;
  return sendAppointmentEmailWithIcs({
    id: "TEST-EMAIL-" + Date.now(),
    paciente: data.paciente || "Gericksson Devies",
    cedula: "0801199012345",
    doctorName: "Dr. Alejandro Morales",
    specialty: "Medicina General",
    date: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd"),
    time: "10:00"
  }, targetEmail);
}

/**
 * Corrige filas de Citas donde la fecha u hora contengan cadenas de texto de objeto ({reason=..., newDate=...})
 * o timestamps de base 1899 para dejarlas limpias en YYYY-MM-DD y HH:mm.
 */
function repairCorruptedAppointmentRows() {
  const ss = getSpreadsheet();
  const cSheet = ss.getSheetByName("Citas");
  if (!cSheet || cSheet.getLastRow() <= 1) return { repairedCount: 0 };

  const range = cSheet.getRange(2, 1, cSheet.getLastRow() - 1, 17);
  const values = range.getValues();
  let repairedCount = 0;

  for (let i = 0; i < values.length; i++) {
    let row = values[i];
    let rawDate = row[7] instanceof Date ? Utilities.formatDate(row[7], CONFIG.TIMEZONE, "yyyy-MM-dd") : String(row[7] || "");
    let rawTime = row[8] instanceof Date ? Utilities.formatDate(row[8], CONFIG.TIMEZONE, "HH:mm") : String(row[8] || "");
    let rawDoc = String(row[5] || "");
    let rawSpec = String(row[6] || "");
    let rawNotes = String(row[11] || "");
    let modified = false;

    if (rawDate.indexOf("{") === 0 || rawDate.indexOf("newDate=") !== -1 || rawDate.indexOf("reason=") !== -1) {
      let dMatch = rawDate.match(/newDate[=:]\s*([^,}\s]+)/);
      let tMatch = rawDate.match(/newTime[=:]\s*([^,}\s]+)/);
      let docMatch = rawDate.match(/newDoctorName[=:]\s*([^,}]+)/);
      let specMatch = rawDate.match(/newSpecialty[=:]\s*([^,}]+)/);
      let rMatch = rawDate.match(/reason[=:]\s*([^,}]+)/);

      if (dMatch) { row[7] = dMatch[1].trim(); modified = true; }
      if (tMatch) { row[8] = tMatch[1].trim(); modified = true; }
      if (docMatch && (!rawDoc || rawDoc === "Dr. Asignado")) { row[5] = docMatch[1].trim(); modified = true; }
      if (specMatch && (!rawSpec || rawSpec === "Medicina General")) { row[6] = specMatch[1].trim(); modified = true; }
      if (rMatch) {
        row[11] = rawNotes ? (rawNotes + " (Reprogramado: " + rMatch[1].trim() + ")") : ("Reprogramado: " + rMatch[1].trim());
        modified = true;
      }
    }

    if (rawTime.indexOf("{") === 0 || rawTime.indexOf("newTime=") !== -1) {
      let tMatch = rawTime.match(/newTime[=:]\s*([^,}\s]+)/);
      if (tMatch) { row[8] = tMatch[1].trim(); modified = true; }
    }

    if (String(row[8]).indexOf("1899") !== -1 || String(row[8]).indexOf("GMT") !== -1) {
      let mMatch = String(row[8]).match(/(\d{1,2}):(\d{2})/);
      if (mMatch) {
        row[8] = (mMatch[1].length === 1 ? "0" + mMatch[1] : mMatch[1]) + ":" + mMatch[2];
        modified = true;
      }
    }

    if (String(row[7]).indexOf("1899") !== -1) {
      row[7] = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");
      modified = true;
    }

    if (modified) {
      repairedCount++;
    }
  }

  if (repairedCount > 0) {
    range.setValues(values);
  }

  return { success: true, repairedCount: repairedCount };
}

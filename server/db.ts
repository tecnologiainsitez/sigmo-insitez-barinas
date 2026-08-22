import { Appointment, Doctor, MutationItem, NotificationLog, Patient, SyncResponse, UserAccount } from '../src/types';
import { INITIAL_DOCTORS } from '../src/data/mockDoctors';
import { INITIAL_USERS } from '../src/data/mockUsers';

// Central Server State (In-Memory Data Store with Google Sheets Sync)
class CentralDatabase {
  private appointments: Map<string, Appointment> = new Map();
  private doctors: Doctor[] = [...INITIAL_DOCTORS];
  private patients: Map<string, Patient> = new Map();
  private specialties: Set<string> = new Set([
    'Medicina General',
    'Pediatría',
    'Cardiología',
    'Ginecología',
    'Traumatología',
    'Dermatología',
    'Oftalmología',
    'Odontología',
    'Neurología',
  ]);
  private users: UserAccount[] = [...INITIAL_USERS];
  private notificationLogs: NotificationLog[] = [];
  private syncAuditQueue: MutationItem[] = [];
  private gasUrl: string = process.env.VITE_GAS_URL || 'https://script.google.com/macros/s/AKfycbwL_-XPii5q2DOQamje1fbqHlHajFORPucZTzltwLtVQRDTHBQBsrjKidiwF7uYz_hpPQ/exec';
  private spreadsheetId: string = '1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc';

  constructor() {
    this.seedInitialAppointments();
  }

  private seedInitialAppointments() {
    this.appointments.clear();
    this.notificationLogs = [];
    this.users = [...INITIAL_USERS];
  }

  public getGasUrl(): string {
    return this.gasUrl;
  }

  public setGasUrl(url: string) {
    this.gasUrl = url ? url.trim() : '';
  }

  public getSpreadsheetId(): string {
    return this.spreadsheetId;
  }

  public setSpreadsheetId(id: string) {
    if (id && id.trim()) this.spreadsheetId = id.trim();
  }

  public getDoctors(): Doctor[] {
    return this.doctors;
  }

  public saveDoctor(doctor: Doctor) {
    const docObj: Doctor = {
      ...doctor,
      id: doctor.id || `DOC-${Date.now()}`,
      nombre: doctor.nombre || doctor.name || '',
      name: doctor.nombre || doctor.name || '',
      especialidad: doctor.especialidad || doctor.specialty || 'Medicina General',
      specialty: doctor.especialidad || doctor.specialty || 'Medicina General',
      horarioAtencion: doctor.horarioAtencion || doctor.schedule || '08:00 - 14:00',
      schedule: doctor.horarioAtencion || doctor.schedule || '08:00 - 14:00',
      consultorio: doctor.consultorio || doctor.room || 'Consultorio 101',
      room: doctor.consultorio || doctor.room || 'Consultorio 101',
      telefono: doctor.telefono || doctor.phone || '',
      phone: doctor.telefono || doctor.phone || '',
      email: doctor.email || '',
      estado: doctor.estado || (doctor.active === false ? 'INACTIVO' : 'ACTIVO'),
      active: doctor.estado === 'ACTIVO' || doctor.active !== false,
    };
    if (docObj.especialidad) {
      this.specialties.add(String(docObj.especialidad));
    }
    const idx = this.doctors.findIndex((d) => d.id === docObj.id);
    if (idx >= 0) {
      this.doctors[idx] = { ...this.doctors[idx], ...docObj };
    } else {
      this.doctors.unshift(docObj);
    }
  }

  public deleteDoctor(id: string) {
    this.doctors = this.doctors.filter((d) => d.id !== id);
  }

  public getSpecialties(): string[] {
    return Array.from(this.specialties);
  }

  public addSpecialty(name: string) {
    if (name && name.trim()) this.specialties.add(name.trim());
  }

  public getPatients(): Patient[] {
    return Array.from(this.patients.values());
  }

  public savePatient(patient: Patient) {
    const dni = patient.dni || patient.cedula || '';
    if (!dni) return;
    const normalized: Patient = {
      ...patient,
      dni,
      cedula: dni,
      name: patient.name || patient.nombreApellido || (patient as any).nombreCompleto || '',
      nombreApellido: patient.nombreApellido || patient.name || (patient as any).nombreCompleto || '',
      phone: patient.phone || patient.telefono || '',
      telefono: patient.telefono || patient.phone || '',
      email: patient.email || patient.correo || '',
      correo: patient.correo || patient.email || '',
      address: patient.address || patient.direccion || '',
      direccion: patient.direccion || patient.address || '',
    };
    this.patients.set(dni, normalized);
  }

  public getAllUsers(): UserAccount[] {
    return this.users;
  }

  public saveUser(user: UserAccount) {
    const idx = this.users.findIndex((u) => u.id === user.id || u.email === user.email);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], ...user };
    } else {
      this.users.push(user);
    }
  }

  public deleteUser(id: string) {
    this.users = this.users.filter((u) => u.id !== id);
  }

  public getAllAppointments(): Appointment[] {
    return Array.from(this.appointments.values()).sort(
      (a, b) =>
        new Date(`${a.date || a.fecha}T${a.time || a.hora}`).getTime() -
        new Date(`${b.date || b.fecha}T${b.time || b.hora}`).getTime()
    );
  }

  public getAppointmentById(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  public getNotificationLogs(): NotificationLog[] {
    return this.notificationLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public addNotificationLog(log: NotificationLog) {
    this.notificationLogs.push(log);
  }

  /**
   * Reemplaza completamente el estado en memoria con los datos reales de Google Sheets.
   */
  public replaceRemoteData(remoteData: { citas?: any[]; pacientes?: any[]; medicos?: any[]; especialidades?: any[]; usuarios?: any[] }) {
    this.appointments.clear();

    if (Array.isArray(remoteData.medicos) && remoteData.medicos.length > 0) {
      this.doctors = remoteData.medicos.map((m: any) => {
        const mppsVal = m.mpps || m.MPPS || m.mppsNumber || m.Mpps || '';
        const impresVal = m.impres || m.IMPRES || m.impresNumber || m.Impres || '';
        const estadoVal = m.estado || m.Estado || 'ACTIVO';
        return {
          id: m.id || m.ID_Medico || `doc-${Date.now()}`,
          nombre: m.nombre || m.Nombre || '',
          name: m.nombre || m.Nombre || '',
          especialidad: m.especialidad || m.Especialidad || 'Medicina General',
          specialty: m.especialidad || m.Especialidad || 'Medicina General',
          consultorio: m.consultorio || m.Consultorio || 'Consultorio 101',
          room: m.consultorio || m.Consultorio || 'Consultorio 101',
          horarioAtencion: m.horarioAtencion || m.HorarioAtencion || '08:00 - 14:00',
          schedule: m.horarioAtencion || m.HorarioAtencion || '08:00 - 14:00',
          telefono: m.telefono || m.Telefono || '',
          phone: m.telefono || m.Telefono || '',
          email: m.email || m.Email || '',
          mpps: mppsVal,
          impres: impresVal,
          mppsNumber: mppsVal,
          impresNumber: impresVal,
          estado: estadoVal,
          active: estadoVal === 'ACTIVO',
        };
      });
      this.doctors.forEach((d) => {
        if (d.especialidad) this.specialties.add(String(d.especialidad));
      });
    }

    if (Array.isArray(remoteData.especialidades) && remoteData.especialidades.length > 0) {
      remoteData.especialidades.forEach((e: any) => {
        const name = e.nombre || e.Nombre_Especialidad || e.nombre_especialidad;
        if (name) this.specialties.add(name);
      });
    }

    if (Array.isArray(remoteData.pacientes) && remoteData.pacientes.length > 0) {
      remoteData.pacientes.forEach((p: any) => {
        const dni = String(p.cedula || p.dni || p.Cedula || '').trim();
        if (dni) {
          let name = String(p.nombreCompleto || p.name || p.nombre || p.NombreCompleto || '').trim();
          let exp = String(p.expedienteNumber || p.numeroExpediente || p.NumeroExpediente || '').trim();
          let cond = String(p.condition || p.condicion || p.Condicion || '').trim();

          const isCond = (val: string) => {
            const s = val.toLowerCase().trim();
            return (
              s.startsWith('docente') ||
              s.startsWith('administrativo') ||
              s.startsWith('obrero') ||
              s.startsWith('estudiante') ||
              s.startsWith('comunidad') ||
              s.startsWith('contratado') ||
              s.startsWith('jubilado') ||
              s.startsWith('pensionado') ||
              s.startsWith('fijo')
            );
          };

          if (isCond(name) && exp && !exp.toUpperCase().startsWith('EXP-')) {
            if (!cond) cond = name;
            name = exp;
            exp = `EXP-${new Date().getFullYear()}-${dni}`;
          }

          this.patients.set(dni, {
            dni,
            cedula: dni,
            expedienteNumber: exp,
            numeroExpediente: exp,
            name,
            nombreApellido: name,
            nombreCompleto: name,
            birthDate: p.birthDate || p.fechaNacimiento || p.FechaNacimiento || '',
            fechaNacimiento: p.birthDate || p.fechaNacimiento || p.FechaNacimiento || '',
            phone: p.telefono || p.phone || '',
            telefono: p.telefono || p.phone || '',
            email: p.email || p.correo || '',
            correo: p.email || p.correo || '',
            address: p.direccion || p.address || '',
            direccion: p.direccion || p.address || '',
            category: p.category || p.categoria || p.Categoria || 'Titular',
            categoria: p.category || p.categoria || p.Categoria || 'Titular',
            condition: cond,
            condicion: cond,
            titularData: p.titularData || p.datosTitular,
            datosTitular: p.titularData || p.datosTitular,
            guardianData: p.guardianData || p.representante,
            representante: p.guardianData || p.representante,
            antecedentes: p.antecedentes || p.medicalHistory || p.historiaMedica || '',
            medicalHistory: p.antecedentes || p.medicalHistory || p.historiaMedica || '',
            historiaMedica: p.antecedentes || p.medicalHistory || p.historiaMedica || '',
            createdAtUtc: p.fechaRegistro || p.createdAtUtc || new Date().toISOString(),
          });
        }
      });
    }

    if (Array.isArray(remoteData.usuarios) && remoteData.usuarios.length > 0) {
      this.users = remoteData.usuarios.map((u: any) => ({
        id: u.id || u.ID_Usuario || `usr-${Date.now()}`,
        nombre: u.nombre || u.Nombre || '',
        email: u.email || u.Email || '',
        passwordHash: u.passwordHash || u.PasswordHash || 'salud123',
        rol: u.rol || u.Rol || 'ANALISTA',
        estado: u.estado || u.Estado || 'ACTIVO',
        ultimoAcceso: u.ultimoAcceso || u.UltimoAcceso || new Date().toISOString(),
      }));
    }

    let importedCitas = 0;
    if (Array.isArray(remoteData.citas)) {
      for (const row of remoteData.citas) {
        if (!row.id && !row.paciente && !row.patientName && !row.ID_Cita) continue;
        const id = String(row.id || row.ID_Cita || 'CITA-' + Date.now());
        const appt: Appointment = {
          id: id,
          paciente: row.paciente || row.patientName || row.Paciente || '',
          patientName: row.patientName || row.paciente || row.Paciente || '',
          cedula: row.cedula || row.patientDni || row.Cedula || '',
          patientDni: row.patientDni || row.cedula || row.Cedula || '',
          email: row.email || row.patientEmail || row.Email || '',
          patientEmail: row.patientEmail || row.email || row.Email || '',
          telefono: row.telefono || row.patientPhone || row.Telefono || '',
          patientPhone: row.patientPhone || row.telefono || row.Telefono || '',
          medicoNombre: row.medicoNombre || row.doctorName || row.Medico || '',
          doctorName: row.doctorName || row.medicoNombre || row.Medico || '',
          medicoId: row.medicoId || row.doctorId || 'doc-1',
          doctorId: row.doctorId || row.medicoId || 'doc-1',
          especialidad: row.especialidad || row.specialty || row.Especialidad || 'Medicina General',
          specialty: row.specialty || row.especialidad || row.Especialidad || 'Medicina General',
          fecha: row.fecha || row.date || row.Fecha || '',
          date: row.date || row.fecha || row.Fecha || '',
          hora: row.hora || row.time || row.Hora || '',
          time: row.time || row.hora || row.Hora || '',
          estado: row.estado || row.status || row.Estado || 'CONFIRMED',
          status: row.status || row.estado || row.Estado || 'CONFIRMED',
          historiaMedica: row.historiaMedica || row.patientMedicalHistory || row.HistoriaMedica || '',
          patientMedicalHistory: row.patientMedicalHistory || row.historiaMedica || row.HistoriaMedica || '',
          motivoConsulta: row.motivoConsulta || row.notes || row.MotivoConsulta || '',
          notes: row.notes || row.motivoConsulta || row.MotivoConsulta || '',
          idx: row.idx || row.IDx || '',
          dx: row.idx || row.IDx || '',
          treatment: row.treatment || row.tratamiento || row.Tratamiento || '',
          tratamiento: row.treatment || row.tratamiento || row.Tratamiento || '',
          diseaseNotes: row.diseaseNotes || row.evolucionMedica || row.EvolucionMedica || '',
          notasEnfermedad: row.diseaseNotes || row.evolucionMedica || row.EvolucionMedica || '',
          creadoPor: row.creadoPor || row.CreadoPor || 'Google Sheets',
          fechaRegistroUtc: row.fechaRegistroUtc || row.Fecha_Registro_UTC || new Date().toISOString(),
          createdAtUtc: row.createdAtUtc || row.fechaRegistroUtc || new Date().toISOString(),
          syncState: 'SYNCED',
        };
        this.appointments.set(id, appt);
        importedCitas++;
      }
    }

    return { importedCitas, total: this.appointments.size };
  }

  /**
   * Fusiona datos obtenidos de Google Sheets
   */
  public mergeRemoteData(remoteData: { citas?: any[]; pacientes?: any[]; medicos?: any[]; especialidades?: any[]; usuarios?: any[] }) {
    return this.replaceRemoteData(remoteData);
  }

  /**
   * ATOMIC SYNC PROCESSING WITH CONFLICT RESOLUTION
   */
  public processMutationQueue(mutations: MutationItem[]): SyncResponse {
    const sortedMutations = [...mutations].sort(
      (a, b) =>
        new Date(a.timestampUtc || a.timestamp_utc || 0).getTime() -
        new Date(b.timestampUtc || b.timestamp_utc || 0).getTime()
    );

    const processedMutations: NonNullable<SyncResponse['processedMutations']> = [];
    const conflicts: NonNullable<SyncResponse['conflicts']> = [];

    for (const mut of sortedMutations) {
      this.syncAuditQueue.push(mut);

      // 1. Handle User Mutations
      if (mut.tabla === 'Usuarios' || mut.action === 'SAVE_USER') {
        const userObj: UserAccount = mut.payload.user || mut.payload;
        if (userObj && (userObj.id || userObj.email)) {
          this.saveUser(userObj);
          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
          });
        }
        continue;
      }

      if (mut.action === 'DELETE_USER') {
        const userId = mut.payload.id || mut.payload.userId;
        if (userId) {
          this.deleteUser(userId);
          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
          });
        }
        continue;
      }

      // 2. Handle Doctor Mutations
      if (mut.tabla === 'Medicos' || mut.action === 'SAVE_DOCTOR') {
        const docObj: Doctor = mut.payload.doctor || mut.payload;
        if (docObj && (docObj.id || docObj.nombre || docObj.name)) {
          this.saveDoctor(docObj);
          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
          });
        }
        continue;
      }

      if (mut.action === 'DELETE_DOCTOR') {
        const docId = mut.payload.id || mut.payload.doctorId;
        if (docId) {
          this.deleteDoctor(docId);
          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
          });
        }
        continue;
      }

      // 3. Handle Patient Mutations
      if (mut.tabla === 'Pacientes' || mut.action === 'SAVE_PATIENT') {
        const patObj: Patient = mut.payload.patient || mut.payload;
        if (patObj && (patObj.dni || patObj.cedula)) {
          this.savePatient(patObj);
          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
          });
        }
        continue;
      }

      // 4. Handle Appointment Creations & Conflict Detection
      if (mut.action === 'CREATE') {
        const newAppt = { ...mut.payload.appointment };
        const mutTimeStr = mut.timestampUtc || mut.timestamp_utc || new Date().toISOString();

        const existingCollision = Array.from(this.appointments.values()).find((existing) => {
          return (
            (existing.doctorId === newAppt.doctorId || existing.medicoId === newAppt.medicoId) &&
            (existing.date === newAppt.date || existing.fecha === newAppt.fecha) &&
            (existing.time === newAppt.time || existing.hora === newAppt.hora) &&
            existing.status !== 'CANCELLED' &&
            existing.id !== newAppt.id
          );
        });

        if (existingCollision) {
          const newTime = new Date(mutTimeStr).getTime();
          const existingTime = new Date(existingCollision.createdAtUtc || existingCollision.fechaRegistroUtc).getTime();

          if (newTime < existingTime) {
            existingCollision.status = 'CONFLICT_PENDING';
            existingCollision.estado = 'CONFLICT_PENDING';
            existingCollision.syncState = 'CONFLICT';
            existingCollision.conflictDetails = `Desplazada por cita agendada anteriormente (${newAppt.patientName || newAppt.paciente} el ${mutTimeStr}).`;
            this.appointments.set(existingCollision.id, existingCollision);

            newAppt.status = 'CONFIRMED';
            newAppt.estado = 'CONFIRMED';
            newAppt.syncState = 'SYNCED';
            this.appointments.set(newAppt.id, newAppt);

            processedMutations.push({
              mutationId: mut.id,
              status: 'SYNCED',
              appointment: newAppt,
            });
          } else {
            newAppt.status = 'CONFLICT_PENDING';
            newAppt.estado = 'CONFLICT_PENDING';
            newAppt.syncState = 'CONFLICT';
            newAppt.conflictDetails = `Colisión de horario: El ${newAppt.doctorName || newAppt.medicoNombre} ya tenía la cita '${existingCollision.patientName || existingCollision.paciente}' agendada a las ${newAppt.time || newAppt.hora} hrs.`;
            this.appointments.set(newAppt.id, newAppt);

            conflicts.push({
              mutationId: mut.id,
              conflictingAppointment: existingCollision,
              details: newAppt.conflictDetails,
            });

            processedMutations.push({
              mutationId: mut.id,
              status: 'CONFLICT',
              appointment: newAppt,
              error: newAppt.conflictDetails,
            });
          }
        } else {
          newAppt.status = newAppt.status === 'CONFLICT_PENDING' ? 'CONFIRMED' : newAppt.status;
          newAppt.estado = newAppt.status;
          newAppt.syncState = 'SYNCED';
          this.appointments.set(newAppt.id, newAppt);

          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
            appointment: newAppt,
          });
        }
      } else if (
        mut.action === 'UPDATE' ||
        mut.action === 'UPDATE_STATUS' ||
        mut.action === 'CANCEL' ||
        (mut.action as string) === 'RESCHEDULE'
      ) {
        const apptId = mut.payload.appointmentId || mut.payload.id || mut.payload.appointment?.id;
        const targetAppt = this.appointments.get(apptId);

        if (targetAppt) {
          if (mut.action === 'CANCEL') {
            targetAppt.status = 'CANCELLED';
            targetAppt.estado = 'CANCELLED';
          } else if ((mut.action as string) === 'RESCHEDULE') {
            const newDate = mut.payload.newDate || targetAppt.date || targetAppt.fecha;
            const newTime = mut.payload.newTime || targetAppt.time || targetAppt.hora;
            targetAppt.date = newDate;
            targetAppt.fecha = newDate;
            targetAppt.time = newTime;
            targetAppt.hora = newTime;
            if (mut.payload.newDoctorId) {
              targetAppt.doctorId = mut.payload.newDoctorId;
              targetAppt.medicoId = mut.payload.newDoctorId;
            }
            if (mut.payload.newDoctorName) {
              targetAppt.doctorName = mut.payload.newDoctorName;
              targetAppt.medicoNombre = mut.payload.newDoctorName;
            }
            if (mut.payload.newSpecialty) {
              targetAppt.specialty = mut.payload.newSpecialty;
              targetAppt.especialidad = mut.payload.newSpecialty;
            }
            if (mut.payload.reason) {
              targetAppt.notes = targetAppt.notes
                ? `${targetAppt.notes} (Reprogramado: ${mut.payload.reason})`
                : `Reprogramado: ${mut.payload.reason}`;
              targetAppt.motivoConsulta = targetAppt.notes;
            }
            targetAppt.status = 'CONFIRMED';
            targetAppt.estado = 'CONFIRMED';
          } else {
            if (mut.payload.newStatus) {
              targetAppt.status = mut.payload.newStatus;
              targetAppt.estado = mut.payload.newStatus;
            }
            if (mut.payload.appointment) {
              Object.assign(targetAppt, mut.payload.appointment);
            }
            if (mut.payload.clinicalNotes) {
              const cn = mut.payload.clinicalNotes;
              if (cn.idx) {
                targetAppt.idx = cn.idx;
                targetAppt.dx = cn.idx;
              }
              if (cn.treatment) {
                targetAppt.treatment = cn.treatment;
                targetAppt.tratamiento = cn.treatment;
              }
              if (cn.diseaseNotes) {
                targetAppt.diseaseNotes = cn.diseaseNotes;
                targetAppt.notasEnfermedad = cn.diseaseNotes;
              }
            }
          }
          targetAppt.updatedAtUtc = new Date().toISOString();
          targetAppt.syncState = 'SYNCED';
          this.appointments.set(apptId, targetAppt);

          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
            appointment: targetAppt,
          });
        } else if (apptId) {
          const newAppt: Appointment = {
            id: apptId,
            paciente: mut.payload.appointment?.paciente || 'Paciente',
            patientName: mut.payload.appointment?.patientName || 'Paciente',
            cedula: mut.payload.appointment?.cedula || '',
            patientDni: mut.payload.appointment?.patientDni || '',
            email: mut.payload.appointment?.email || '',
            patientEmail: mut.payload.appointment?.patientEmail || '',
            telefono: mut.payload.appointment?.telefono || '',
            patientPhone: mut.payload.appointment?.patientPhone || '',
            medicoNombre: mut.payload.newDoctorName || mut.payload.appointment?.medicoNombre || 'Dr. Asignado',
            doctorName: mut.payload.newDoctorName || mut.payload.appointment?.doctorName || 'Dr. Asignado',
            medicoId: mut.payload.newDoctorId || mut.payload.appointment?.medicoId || 'DOC-101',
            doctorId: mut.payload.newDoctorId || mut.payload.appointment?.doctorId || 'DOC-101',
            especialidad: mut.payload.newSpecialty || mut.payload.appointment?.especialidad || 'Medicina General',
            specialty: mut.payload.newSpecialty || mut.payload.appointment?.specialty || 'Medicina General',
            fecha: mut.payload.newDate || mut.payload.appointment?.fecha || '',
            date: mut.payload.newDate || mut.payload.appointment?.date || '',
            hora: mut.payload.newTime || mut.payload.appointment?.hora || '08:00',
            time: mut.payload.newTime || mut.payload.appointment?.time || '08:00',
            estado: mut.action === 'CANCEL' ? 'CANCELLED' : mut.payload.newStatus || 'CONFIRMED',
            status: mut.action === 'CANCEL' ? 'CANCELLED' : mut.payload.newStatus || 'CONFIRMED',
            motivoConsulta: mut.payload.reason || mut.payload.appointment?.motivoConsulta || '',
            notes: mut.payload.reason || mut.payload.appointment?.notes || '',
            creadoPor: mut.payload.appointment?.creadoPor || 'Analista',
            fechaRegistroUtc: new Date().toISOString(),
            createdAtUtc: new Date().toISOString(),
            syncState: 'SYNCED',
          };
          this.appointments.set(apptId, newAppt);

          processedMutations.push({
            mutationId: mut.id,
            status: 'SYNCED',
            appointment: newAppt,
          });
        }
      }
    }

    return {
      success: true,
      processedMutations,
      serverAppointments: this.getAllAppointments(),
      conflicts,
      notificationsGenerated: 0,
    };
  }

  public resetDemoData() {
    this.appointments.clear();
    this.notificationLogs = [];
    this.syncAuditQueue = [];
    this.seedInitialAppointments();
  }
}

export const centralDB = new CentralDatabase();

import { UserAccount } from '../types';

/**
 * Catálogo base de usuarios del sistema SIGMO_BARINAS.
 * Los usuarios adicionales se crean dinámicamente o se sincronizan
 * desde la hoja 'Usuarios' de Google Sheets.
 */
export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'USR-ADMIN-001',
    nombre: 'Gericksson Devies (Admin)',
    email: 'gerickssond@gmail.com',
    passwordHash: 'salud123',
    rol: 'DESARROLLADOR_ADMIN',
    estado: 'ACTIVO',
    ultimoAcceso: new Date().toISOString(),
  },
];

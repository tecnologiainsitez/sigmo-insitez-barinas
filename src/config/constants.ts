import { INSITEZ_LOGO_DATA_URI } from './logoBase64';

/**
 * Constantes institucionales SIGMO - INSITEZ UNELLEZ
 */

export const SPREADSHEET_ID = '1imBh1z83rce_CyWl_9jIxe7vY6gGN2M6G5DkOhbcGKc';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
export const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbwL_-XPii5q2DOQamje1fbqHlHajFORPucZTzltwLtVQRDTHBQBsrjKidiwF7uYz_hpPQ/exec';

// ID oficial del archivo de imagen en Google Drive
export const INSITEZ_LOGO_DRIVE_ID = '1tHx04f2CqaSoOtxvudfJqomNu2mKPrtX';

// 1. Primera opción: URL directa oficial lh3.googleusercontent.com
export const INSITEZ_LOGO_URL = `https://lh3.googleusercontent.com/d/${INSITEZ_LOGO_DRIVE_ID}`;

// 2. Segunda opción: Respaldo embebido base64 para modo offline y prevención de fallos
export const INSITEZ_LOGO_FALLBACK = INSITEZ_LOGO_DATA_URI;

export const INSTITUTION_INFO = {
  name: 'INSITEZ',
  fullName: 'Instituto de Salud Integral de los Trabajadores de la UNELLEZ',
  university: 'Universidad Nacional Experimental de los Llanos Occidentales "Ezequiel Zamora"',
  campus: 'Sede Central Barinas, Venezuela',
  systemName: 'SIGMO_BARINAS',
  systemVersion: '1.2.0',
};

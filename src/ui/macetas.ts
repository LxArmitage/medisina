/**
 * El color de la maceta según su material. Pura estética, pero ayuda a
 * reconocer la planta: "la del barro" y "la de la maceta blanca" son dos.
 */

import type { MaterialMaceta } from '../dominio/tipos';

export function colorDeMaceta(material?: MaterialMaceta): string {
  switch (material) {
    case 'plastico':
      return '#4A5A52';
    case 'ceramica':
      return '#E4DCCB';
    case 'tela':
      return '#5E5A4E';
    case 'metal':
      return '#9AA3A8';
    default:
      return '#B8683F';
  }
}

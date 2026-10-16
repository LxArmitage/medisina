/**
 * Cómo se le dice a la gente lo que la planta necesita.
 *
 * "Crítico" y "Encharcado" describen el estado del sustrato, que es exacto pero
 * no dice qué hacer. En la guardería, donde la gente pasa de reojo, lo que
 * importa es la acción: riégame, no me riegues, déjame en paz.
 *
 * El nivel técnico sigue existiendo en el expediente, donde sí hay espacio para
 * explicarlo.
 */

import type { AccionRiego, Recomendacion } from '../dominio/balanceHidrico';

export interface EtiquetaAccion {
  texto: string;
  /** true cuando pide que hagas algo hoy. */
  pideAtencion: boolean;
}

export function etiquetaAccion(
  accion: AccionRiego,
  urgencia: Recomendacion['urgencia'],
): EtiquetaAccion {
  switch (accion) {
    case 'regar':
      return {
        texto: urgencia === 'alta' ? 'Riégame ya' : 'Riégame hoy',
        pideAtencion: true,
      };
    case 'suspender_riego':
      return { texto: 'No me riegues', pideAtencion: true };
    case 'cambiar_agua':
      return { texto: 'Cámbiame el agua', pideAtencion: true };
    case 'esperar_lluvia':
      return { texto: 'Ya va a llover', pideAtencion: false };
    case 'no_regar':
    default:
      return { texto: 'Estoy bien', pideAtencion: false };
  }
}

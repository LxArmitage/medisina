/**
 * Contraste entre lo que la persona ve y lo que el modelo calcula.
 *
 * Aquí está el valor real de pedir medidas al escanear. Un síntoma solo no dice
 * gran cosa: las hojas amarillas caben en media docena de causas. Pero un
 * síntoma **cruzado con el estado hídrico** descarta la mitad de ellas.
 *
 * El caso que más vale: hojas amarillas con el agua en su punto. La gente
 * asume que amarillo = falta de agua y riega más, que es exactamente lo que no
 * hay que hacer. Si el balance dice que el agua está bien, el amarillo viene de
 * otro lado — y decirlo cambia lo que la persona hace esa tarde.
 *
 * Nada de esto diagnostica enfermedades: son deducciones de descarte sobre dos
 * datos que ya tenemos. El diagnóstico por imagen es Fase 2.
 */

import type { EstadoHidrico } from './balanceHidrico';
import type { Especie, MedidasObservadas } from './tipos';

export type Severidad = 'informativo' | 'atencion' | 'urgente';

export interface Hallazgo {
  clave: string;
  titulo: string;
  explicacion: string;
  severidad: Severidad;
}

export interface EntradaContraste {
  medidas?: MedidasObservadas;
  estado: EstadoHidrico;
  especie: Especie;
  /** Para avisar cuando las medidas ya envejecieron. */
  hoy?: Date;
}

/** Pasado este tiempo, lo medido ya no describe a la planta. */
const MESES_VIGENCIA_MEDIDAS = 6;

export function contrastarObservacion(entrada: EntradaContraste): Hallazgo[] {
  const { medidas, estado, especie } = entrada;
  if (!medidas) return [];

  const hallazgos: Hallazgo[] = [];
  const aguaBien = estado.nivel === 'optimo' || estado.nivel === 'humedo';
  const aguaFalta = estado.nivel === 'seco' || estado.nivel === 'critico';
  const aguaSobra = estado.nivel === 'encharcado';

  switch (medidas.danoVisible) {
    case 'hojas_amarillas':
      if (aguaBien) {
        hallazgos.push({
          clave: 'amarillo_sin_sed',
          titulo: 'Amarillea, pero no es sed',
          explicacion:
            'Viste hojas amarillas y el agua está en su punto, así que regarla más no la va a arreglar. Con el agua bien, el amarillo suele ser falta de nitrógeno o de hierro, o demasiada luz directa para lo que aguanta.',
          severidad: 'atencion',
        });
      } else if (aguaSobra) {
        hallazgos.push({
          clave: 'amarillo_por_ahogo',
          titulo: 'El amarillo cuadra con el exceso de agua',
          explicacion:
            'Las hojas amarillas y el sustrato encharcado cuentan la misma historia: la raíz lleva días sin oxígeno y ya no sube nutrientes. Deja de regar y revisa el drenaje.',
          severidad: 'urgente',
        });
      } else {
        hallazgos.push({
          clave: 'amarillo_por_sed',
          titulo: 'El amarillo cuadra con la sed',
          explicacion:
            'El sustrato está seco y eso explica las hojas amarillas. Riégala y dale unos días antes de buscar otra causa.',
          severidad: 'atencion',
        });
      }
      break;

    case 'hojas_secas':
      if (aguaFalta) {
        hallazgos.push({
          clave: 'secas_por_sed',
          titulo: 'Las puntas secas cuadran con la sed',
          explicacion:
            'Con el sustrato en este nivel, las hojas secas son consecuencia directa. Ajusta el riego y vigila las nuevas.',
          severidad: 'atencion',
        });
      } else {
        hallazgos.push({
          clave: 'secas_sin_sed',
          titulo: 'Se secan sin que falte agua',
          explicacion:
            'El agua está bien, así que las puntas secas apuntan a otra cosa: aire muy seco, sol directo que le pega de más, o sales acumuladas de fertilizante. Enjuagar el sustrato con agua abundante descarta lo último.',
          severidad: 'atencion',
        });
      }
      break;

    case 'manchas':
      if (aguaSobra) {
        hallazgos.push({
          clave: 'manchas_con_encharcamiento',
          titulo: 'Manchas con el sustrato encharcado',
          explicacion:
            'Es la combinación que más favorece a los hongos: humedad permanente y poco aire en la raíz. Corrige el drenaje antes de pensar en cualquier tratamiento.',
          severidad: 'urgente',
        });
      } else {
        hallazgos.push({
          clave: 'manchas_sin_encharcamiento',
          titulo: 'Manchas con el agua en orden',
          explicacion:
            'Sin exceso de agua, las manchas pueden ser quemadura de sol, salpicadura al regar de noche, o una enfermedad que no se distingue sin verla de cerca. Toma una foto de una hoja afectada para el expediente.',
          severidad: 'atencion',
        });
      }
      break;

    case 'plaga':
      hallazgos.push({
        clave: 'plaga_declarada',
        titulo: 'Plaga a la vista',
        explicacion: aguaFalta
          ? 'Reportaste plaga y además está pasando sed. Una planta estresada se defiende peor, así que corrige primero el riego: es parte del tratamiento, no algo aparte.'
          : 'Reportaste plaga. Revisa el envés de las hojas y las axilas, que es donde se esconden, y aísla la planta de las demás mientras la tratas.',
        severidad: 'urgente',
      });
      break;

    default:
      break;
  }

  // Una cactácea en sustrato húmedo es una alarma aunque nada se vea todavía.
  if (especie.perfilHidrico === 'xerico' && aguaSobra) {
    hallazgos.push({
      clave: 'xerica_encharcada',
      titulo: 'Una planta de desierto en sustrato encharcado',
      explicacion:
        'Esta especie está hecha para secarse entre riegos. El daño por exceso tarda en verse y cuando se nota ya es pudrición. No esperes a que se marchite.',
      severidad: 'urgente',
    });
  }

  const vencidas = medidasVencidas(medidas, entrada.hoy ?? new Date());
  if (vencidas) {
    hallazgos.push({
      clave: 'medidas_viejas',
      titulo: 'Sus medidas ya tienen tiempo',
      explicacion: `Lo que mediste fue hace ${vencidas} meses y las plantas crecen. Vuelve a escanearla para que el dibujo la siga pareciendo.`,
      severidad: 'informativo',
    });
  }

  return hallazgos;
}

/** Meses transcurridos si ya pasó la vigencia; null si siguen frescas. */
export function medidasVencidas(medidas: MedidasObservadas, hoy: Date): number | null {
  const desde = new Date(medidas.fecha);
  const meses = Math.floor((hoy.getTime() - desde.getTime()) / (30.44 * 86_400_000));
  return meses >= MESES_VIGENCIA_MEDIDAS ? meses : null;
}

export const OPCIONES_DANO: Array<{
  valor: NonNullable<MedidasObservadas['danoVisible']>;
  etiqueta: string;
}> = [
  { valor: 'ninguno', etiqueta: 'Se ve bien' },
  { valor: 'hojas_amarillas', etiqueta: 'Hojas amarillas' },
  { valor: 'hojas_secas', etiqueta: 'Puntas secas' },
  { valor: 'manchas', etiqueta: 'Manchas' },
  { valor: 'plaga', etiqueta: 'Bichos' },
];

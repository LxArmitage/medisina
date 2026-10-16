/**
 * Qué dice cada parte de la planta cuando la tocas.
 *
 * La gracia no es etiquetar ("esto es una hoja"). Es que la misma parte diga
 * cosas distintas según el estado: una hoja caída por sed y una caída por
 * ahogo se ven casi igual, y la diferencia es lo único que importa para saber
 * qué hacer.
 *
 * Puro y probable, como todo en `src/dominio`.
 */

import type { EstadoHidrico } from './balanceHidrico';
import type { Morfologia } from './morfologia';
import type { Especie } from './tipos';

export type TipoParte = 'hoja' | 'tallo' | 'brote' | 'flor' | 'fruto' | 'sustrato' | 'raiz';

export interface ParteGemelo {
  tipo: TipoParte;
  /** Para partes repetidas, cuál de ellas. */
  indice?: number;
}

export interface ExplicacionParte {
  titulo: string;
  texto: string;
  /** Dato duro que respalda lo dicho, cuando existe. */
  dato?: string;
}

export interface ContextoParte {
  morfologia: Morfologia;
  estado: EstadoHidrico;
  especie: Especie;
  /** Sólo para esquejes en frasco. */
  diasSinCambioAgua?: number | null;
  enFrasco?: boolean;
}

// ---------------------------------------------------------------------------

export function explicarParte(parte: ParteGemelo, ctx: ContextoParte): ExplicacionParte {
  switch (parte.tipo) {
    case 'hoja':
      return explicarHoja(ctx);
    case 'tallo':
      return explicarTallo(ctx);
    case 'brote':
      return {
        titulo: 'Brote nuevo',
        texto:
          'Estás en su temporada de crecimiento. Los brotes salen más claros y tiernos, y se endurecen con las semanas. Es el mejor momento para abonarla.',
        dato: `${ctx.morfologia.brotes} ${ctx.morfologia.brotes === 1 ? 'brote' : 'brotes'} dibujados`,
      };
    case 'flor':
      return {
        titulo: 'Flor',
        texto:
          'Está en temporada de floración según su calendario. Florecer cuesta energía: si la ves floja estos días, es normal.',
      };
    case 'fruto':
      return {
        titulo: 'Fruto',
        texto:
          'Le toca fructificar. El fruto compite por recursos con las hojas nuevas, así que el crecimiento se frena mientras dura.',
      };
    case 'sustrato':
      return explicarSustrato(ctx);
    case 'raiz':
      return explicarRaiz(ctx);
    default:
      return { titulo: 'Parte', texto: 'Sin información para esta parte.' };
  }
}

// ---------------------------------------------------------------------------

function explicarHoja(ctx: ContextoParte): ExplicacionParte {
  const pct = Math.round(ctx.estado.fraccionDisponible * 100);

  if (ctx.morfologia.senal === 'ahogo') {
    return {
      titulo: 'Hoja caída, pero no de sed',
      texto:
        'Se ve marchita aunque al sustrato le sobre agua. La raíz lleva días sin oxígeno y ya no puede subir agua a la hoja: por eso se cae igual que si tuviera sed. Regarla más la empeora.',
      dato: `Sustrato al ${pct} %, ${ctx.estado.diasConsecutivosEncharcado} días encharcado`,
    };
  }

  if (ctx.morfologia.senal === 'sed') {
    return {
      titulo: 'Hoja sin turgencia',
      texto:
        'Las células de la hoja se sostienen con la presión del agua que tienen dentro. Cuando falta, la hoja se dobla. Se recupera en horas si la riegas a tiempo.',
      dato: `Sustrato al ${pct} %, sufre por debajo del ${Math.round(ctx.especie.umbralEstres * 100)} %`,
    };
  }

  return {
    titulo: 'Hoja sana',
    texto:
      'Erguida y con buen color. Es donde la planta fabrica su alimento con la luz, así que quitarle hojas sanas la debilita más de lo que parece.',
    dato: `Sustrato al ${pct} %`,
  };
}

function explicarTallo(ctx: ContextoParte): ExplicacionParte {
  if (ctx.morfologia.arquetipo === 'cactacea') {
    return {
      titulo: 'Tallo suculento',
      texto:
        'En un cactus el tallo es el que hace fotosíntesis y además almacena el agua. Por eso aguanta la sequía erguido: no se dobla, se adelgaza. Si lo ves arrugado, es que lleva mucho tiempo sin beber.',
      dato: `Aguanta hasta el ${Math.round(ctx.especie.umbralEstres * 100)} % de humedad sin sufrir`,
    };
  }
  return {
    titulo: 'Tallo',
    texto:
      'Lleva el agua de la raíz a las hojas. Si el tallo está firme y las hojas caídas, el problema está abajo — en la raíz o en el sustrato, no en la hoja.',
  };
}

function explicarSustrato(ctx: ContextoParte): ExplicacionParte {
  const pct = Math.round(ctx.estado.fraccionDisponible * 100);
  const umbral = Math.round(ctx.especie.umbralEstres * 100);

  if (ctx.estado.nivel === 'encharcado') {
    return {
      titulo: 'Sustrato encharcado',
      texto:
        'Por encima de capacidad de campo: los poros que deberían tener aire están llenos de agua. La raíz se asfixia y empieza la pudrición. Revisa que la maceta drene.',
      dato: `${pct} % de capacidad · ${ctx.estado.diasConsecutivosEncharcado} días así`,
    };
  }

  return {
    titulo: 'Sustrato',
    texto: `Aquí es donde se mide todo. Se calcula día con día restando lo que la planta transpira y sumando lo que riegas y lo que llueve. Esta especie empieza a sufrir por debajo del ${umbral} %.`,
    dato: `${pct} % de capacidad útil`,
  };
}

function explicarRaiz(ctx: ContextoParte): ExplicacionParte {
  if (!ctx.enFrasco) {
    return {
      titulo: 'Raíz',
      texto:
        'No se ve, pero es donde empieza casi todo problema. Necesita agua y aire a la vez: por eso el exceso de riego la mata, no por el agua en sí sino por la falta de oxígeno.',
    };
  }

  const dias = ctx.diasSinCambioAgua;
  return {
    titulo: 'Raíz en agua',
    texto:
      'En frasco la raíz toma el oxígeno disuelto en el agua. Conforme el agua se estanca ese oxígeno se acaba, y ahí empieza la pudrición. Cambiarla es lo único que hay que hacer.',
    dato:
      dias === null || dias === undefined
        ? 'Sin cambios de agua registrados'
        : `${dias} ${dias === 1 ? 'día' : 'días'} desde el último cambio`,
  };
}

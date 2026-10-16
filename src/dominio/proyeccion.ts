/**
 * Proyección: cómo se vería con el tiempo, si la cuidas bien.
 *
 * Esto sí se puede afirmar, a diferencia de reconstruir su forma real desde una
 * foto. Sabemos la especie, su ritmo de crecimiento, su altura de madurez y su
 * calendario fenológico. Con eso se puede decir qué tan alta estará en marzo y
 * si para entonces le tocará florecer.
 *
 * Lo que la proyección NO es: una promesa. Asume cuidado correcto — riego en su
 * punto, luz adecuada, sin plagas. Esa condición se dice en pantalla, porque
 * media proyección sin su supuesto es un engaño.
 */

import { formaDe } from './forma';
import { alturaRelativa, calcularMorfologia, crecerCm } from './morfologia';
import type { Morfologia } from './morfologia';
import { proximosEventos } from './fenologia';
import type { Fenomeno } from './fenologia';
import type { EstadoHidrico } from './balanceHidrico';
import type { Especie, MedidasObservadas } from './tipos';

/** Estado hídrico ideal: es el supuesto de la proyección. */
const ESTADO_IDEAL: EstadoHidrico = {
  fecha: '',
  aguaDisponibleMm: 0,
  fraccionDisponible: 0.7,
  demandaMm: 0,
  aporteMm: 0,
  diasConsecutivosEncharcado: 0,
  diasConsecutivosEnEstres: 0,
  nivel: 'optimo',
  esPronostico: true,
};

export interface PasoProyeccion {
  /** Meses hacia adelante desde hoy. 0 es el presente. */
  meses: number;
  etiqueta: string;
  /** Fecha a la que corresponde. */
  fecha: Date;
  alturaCm: number;
  /**
   * Cuántas veces su tamaño de hoy. El dibujo se escala con esto —y la maceta
   * no—: así se ve crecer contra su maceta, como pasa de verdad.
   */
  crecimiento: number;
  /**
   * Con la proporción de hoy y la estructura de esa fecha: más ramas, tronco
   * más grueso, fruta si ya le toca. El tamaño va aparte, en `crecimiento`.
   */
  morfologia: Morfologia;
  /** Qué le estará pasando en esa fecha, según su calendario. */
  fenomenos: Fenomeno[];
}

/** Tope de lo que se agranda el dibujo: más, y la de hoy sería un punto. */
const CRECIMIENTO_MAXIMO = 4;

/** Crecimiento hacia su altura de madurez (logístico: ver `crecerCm`). */
export function proyectarAltura(especie: Especie, alturaCm: number, meses: number): number {
  return Math.round(crecerCm(especie, alturaCm, meses));
}

export interface EntradaProyeccion {
  especie: Especie;
  /** Altura de partida. Si no hay medida, se estima por edad. */
  alturaCm: number;
  elementos?: number;
  zonaClimatica?: string;
  hoy?: Date;
  /** Meses a proyectar. Por defecto: hoy, 3, 6, 12 y 24. */
  hitos?: number[];
}

export function proyectarCrecimiento(entrada: EntradaProyeccion): PasoProyeccion[] {
  const hoy = entrada.hoy ?? new Date();
  const hitos = entrada.hitos ?? [0, 3, 6, 12, 24];
  // Acotada a su especie: si alguien midió de más, se parte del tamaño adulto.
  const alturaHoy = Math.max(1, proyectarAltura(entrada.especie, entrada.alturaCm, 0));
  // La proporción del dibujo es la de hoy en todos los pasos; lo que cambia es
  // el tamaño (`crecimiento`) y la estructura (`desarrollo`). Si cada paso
  // trajera su propia proporción, crecer también la "encogería" en el dibujo.
  const proporcionHoy = alturaRelativa(alturaHoy);
  // Las que cuelgan (potos, cola de burro) no crecen hacia arriba: alargan sus
  // guías. Escalarlas enteras las despegaría de la orilla de la maceta; en
  // ellas crecer es que la proporción misma se estire. Las que flotan crecen
  // en número de hojas, no en tamaño.
  const porte = formaDe(entrada.especie.id).porte;
  const alarga = porte === 'colgante' || porte === 'trepadora';
  const escala = !alarga && porte !== 'flotante';

  return hitos.map((meses) => {
    const fecha = new Date(hoy.getTime());
    fecha.setUTCMonth(fecha.getUTCMonth() + meses);

    const alturaCm = proyectarAltura(entrada.especie, entrada.alturaCm, meses);

    // Las hojas acompañan al tamaño: una planta más grande tiene más follaje.
    const factor = alturaCm / Math.max(1, entrada.alturaCm);
    const elementos = entrada.elementos
      ? Math.max(1, Math.min(14, Math.round(entrada.elementos * Math.sqrt(factor))))
      : undefined;

    const relativo = Math.round(Math.min(CRECIMIENTO_MAXIMO, alturaCm / alturaHoy) * 1000) / 1000;

    const eventos = proximosEventos({
      especie: entrada.especie,
      zonaClimatica: entrada.zonaClimatica,
      hoy: fecha,
    });
    const fenomenosActivos = eventos.filter((e) => e.enCurso);

    const morfologia = calcularMorfologia({
      especie: entrada.especie,
      estado: ESTADO_IDEAL,
      fenologia: eventos,
      medidas: {
        fecha: fecha.toISOString(),
        alturaCm,
        elementos,
        danoVisible: 'ninguno',
      } satisfies MedidasObservadas,
    });

    return {
      meses,
      etiqueta: etiquetaDeHito(meses),
      fecha,
      alturaCm,
      crecimiento: escala ? relativo : 1,
      morfologia: { ...morfologia, altura: alarga ? Math.min(2.2, proporcionHoy * relativo) : proporcionHoy },
      fenomenos: fenomenosActivos.map((e) => e.fenomeno),
    };
  });
}

function etiquetaDeHito(meses: number): string {
  if (meses === 0) return 'Hoy';
  if (meses === 12) return 'En un año';
  if (meses % 12 === 0) return `En ${meses / 12} años`;
  return `En ${meses} meses`;
}

/**
 * Cuánto va a crecer, en palabras.
 * Devuelve null cuando el cambio es tan chico que no vale la pena presumirlo.
 */
export function resumirCrecimiento(pasos: PasoProyeccion[]): string | null {
  if (pasos.length < 2) return null;
  const inicio = pasos[0];
  // Se habla del año: es el plazo que uno se imagina. Si no hay paso de un
  // año, del último que haya.
  const fin = pasos.find((p) => p.meses === 12) ?? pasos[pasos.length - 1];
  const plazo = fin.meses === 12 ? 'en un año' : fin.etiqueta.toLowerCase();
  const ganancia = fin.alturaCm - inicio.alturaCm;

  if (ganancia < 2) {
    return `Crece muy despacio: ${plazo} no la vas a ver muy distinta, y eso es normal en su especie.`;
  }
  return `Si la cuidas bien, pasa de ${inicio.alturaCm} a unos ${fin.alturaCm} cm ${plazo}.`;
}

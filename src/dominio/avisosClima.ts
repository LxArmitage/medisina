/**
 * El clima de los próximos días, y qué planta conviene mover por él.
 *
 * El riego ya mira el clima (la lluvia y la evaporación entran al balance de
 * agua). Lo que faltaba es lo que el riego no arregla: una ola de calor que
 * quema a una planta de sombra puesta al sol, una helada para una planta
 * tropical que vive afuera, o un aguacero sobre una suculenta sin techo. Para
 * eso no hay que regar ni dejar de regar: hay que moverla. Y avisar con un día
 * de anticipación es la diferencia entre moverla y enterarse tarde.
 *
 * Los límites de cada especie (temperatura mínima y máxima que aguanta) salen
 * de su ficha de conocimiento, no de un número general: una sina aguanta 45 °C
 * al sol; un helecho, no.
 */

import type { BandaLuz, DiaClima, PerfilHidrico } from './tipos';

export type Cielo = 'sol' | 'nubes' | 'lluvia' | 'tormenta';

export interface DiaPronostico {
  /** YYYY-MM-DD */
  fecha: string;
  tMaxC: number;
  tMinC: number;
  lluviaMm: number;
  cielo: Cielo;
  /** "Hoy", "Mañana", "Jue"… */
  nombre: string;
}

export type Destino = 'sombra' | 'adentro' | 'techo' | 'mas_luz' | 'menos_luz';
export type MotivoMover = 'calor' | 'frio' | 'lluvia' | 'luz';

export interface AvisoMover {
  plantaId: string;
  apodo: string;
  motivo: MotivoMover;
  destino: Destino;
  /** El día del que se habla. */
  fecha: string;
  texto: string;
  /** Días que faltan: 0 hoy, 1 mañana. Para ordenar. */
  enDias: number;
}

export interface PlantaParaClima {
  id: string;
  apodo: string;
  exposicion: BandaLuz;
  interior: boolean;
  techado: boolean;
  enAgua: boolean;
  perfilHidrico: PerfilHidrico;
  /** La primera es la que prefiere. */
  bandasToleradas: BandaLuz[];
  temperaturaMinC: number;
  temperaturaMaxC: number;
}

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_LARGO = ['el domingo', 'el lunes', 'el martes', 'el miércoles', 'el jueves', 'el viernes', 'el sábado'];

function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diasEntre(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

function diaSemana(fecha: string): number {
  return new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10))).getUTCDay();
}

/** Cómo decirle al día en una frase: "hoy", "mañana", "el jueves". */
export function nombrarDia(fecha: string, hoy: Date = new Date()): string {
  const n = diasEntre(fechaLocal(hoy), fecha);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'mañana';
  return DIAS_LARGO[diaSemana(fecha)];
}

export function cieloDe(d: Pick<DiaClima, 'lluviaMm' | 'et0Mm'>): Cielo {
  if (d.lluviaMm >= 12) return 'tormenta';
  if (d.lluviaMm >= 1.5) return 'lluvia';
  // Sin lluvia, la evaporación dice cuánto sol hubo: poca es día nublado.
  return d.et0Mm < 3 ? 'nubes' : 'sol';
}

/** Hoy y los días que siguen, listos para mostrarse. */
export function pronosticoCorto(
  serie: { historico: DiaClima[]; pronostico: DiaClima[] },
  hoy: Date = new Date(),
  dias = 5,
): DiaPronostico[] {
  const clave = fechaLocal(hoy);
  const todos = [...serie.historico, ...serie.pronostico].filter((d) => d.fecha >= clave);
  const vistos = new Set<string>();
  const salida: DiaPronostico[] = [];
  for (const d of todos) {
    if (vistos.has(d.fecha) || salida.length >= dias) continue;
    vistos.add(d.fecha);
    const n = diasEntre(clave, d.fecha);
    salida.push({
      fecha: d.fecha,
      tMaxC: Math.round(d.tMaxC),
      tMinC: Math.round(d.tMinC),
      lluviaMm: Math.round(d.lluviaMm * 10) / 10,
      cielo: cieloDe(d),
      nombre: n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : DIAS[diaSemana(d.fecha)],
    });
  }
  return salida;
}

const NOMBRE_BANDA: Record<BandaLuz, string> = {
  sol_pleno: 'sol directo',
  semisol: 'media sombra',
  sombra: 'sombra',
  interior_luminoso: 'interior con mucha luz',
  interior_bajo: 'interior con poca luz',
};

const ORDEN_LUZ: BandaLuz[] = ['interior_bajo', 'interior_luminoso', 'sombra', 'semisol', 'sol_pleno'];

/**
 * Qué planta conviene mover y por qué, de la más urgente a la menos.
 *
 * Una sola vez por planta y motivo: si van a ser tres días de calor, se avisa
 * del primero —que es cuando hay que moverla— y se dice cuántos son.
 */
export function avisosDeClima(plantas: PlantaParaClima[], dias: DiaPronostico[], hoy: Date = new Date()): AvisoMover[] {
  const avisos: AvisoMover[] = [];
  const clave = fechaLocal(hoy);

  for (const p of plantas) {
    const afuera = !p.interior;
    const tMax = Number.isFinite(p.temperaturaMaxC) ? p.temperaturaMaxC : 38;
    const tMin = Number.isFinite(p.temperaturaMinC) ? p.temperaturaMinC : 5;

    // Calor: sólo pega si le da el sol. A la sombra se aguanta más.
    if (afuera && (p.exposicion === 'sol_pleno' || p.exposicion === 'semisol')) {
      const limite = Math.max(34, tMax - (p.exposicion === 'sol_pleno' ? 2 : 0));
      const calurosos = dias.filter((d) => d.tMaxC >= limite);
      if (calurosos.length > 0) {
        const d = calurosos[0];
        const cuantos = calurosos.length > 1 ? ` (y ${calurosos.length - 1} ${calurosos.length === 2 ? 'día más' : 'días más'})` : '';
        avisos.push({
          plantaId: p.id,
          apodo: p.apodo,
          motivo: 'calor',
          destino: 'sombra',
          fecha: d.fecha,
          enDias: diasEntre(clave, d.fecha),
          texto: `${mayuscula(nombrarDia(d.fecha, hoy))} llega a ${d.tMaxC} °C${cuantos}, y a ${p.apodo} más de ${limite} °C al sol la quema. Pásala a la sombra en las horas fuertes.`,
        });
      }
    }

    // Frío: la noche más fría manda.
    if (afuera) {
      // Un grado de margen: el pronóstico se equivoca, y la helada no avisa.
      const frios = dias.filter((d) => d.tMinC <= tMin + 1);
      if (frios.length > 0) {
        const d = frios.reduce((a, b) => (b.tMinC < a.tMinC ? b : a));
        avisos.push({
          plantaId: p.id,
          apodo: p.apodo,
          motivo: 'frio',
          destino: 'adentro',
          fecha: d.fecha,
          enDias: diasEntre(clave, d.fecha),
          texto: `${mayuscula(nombrarDia(d.fecha, hoy))} en la noche baja a ${d.tMinC} °C, y ${p.apodo} aguanta hasta ${tMin} °C. Métela a la casa esa noche.`,
        });
      }
    }

    // Aguacero sobre una que odia el agua de más, sin techo.
    if (afuera && !p.techado && !p.enAgua && (p.perfilHidrico === 'xerico' || p.perfilHidrico === 'bajo')) {
      const lluviosos = dias.filter((d) => d.lluviaMm >= 15);
      if (lluviosos.length > 0) {
        const d = lluviosos[0];
        avisos.push({
          plantaId: p.id,
          apodo: p.apodo,
          motivo: 'lluvia',
          destino: 'techo',
          fecha: d.fecha,
          enDias: diasEntre(clave, d.fecha),
          texto: `${mayuscula(nombrarDia(d.fecha, hoy))} se esperan ${Math.round(d.lluviaMm)} mm de lluvia. A ${p.apodo} el agua de más le pudre la raíz: ponla bajo techo.`,
        });
      }
    }

    // Luz: no es del clima de mañana, pero es lo que más plantas mata despacio.
    const prefiere = p.bandasToleradas[0];
    if (prefiere && !p.bandasToleradas.includes(p.exposicion)) {
      const masLuz = ORDEN_LUZ.indexOf(prefiere) > ORDEN_LUZ.indexOf(p.exposicion);
      avisos.push({
        plantaId: p.id,
        apodo: p.apodo,
        motivo: 'luz',
        destino: masLuz ? 'mas_luz' : 'menos_luz',
        fecha: clave,
        enDias: 7,
        texto: `Donde está le da ${NOMBRE_BANDA[p.exposicion]}, y ${p.apodo} prefiere ${NOMBRE_BANDA[prefiere]}. ${masLuz ? 'Acércala a más luz' : 'Aléjala del sol directo'} y la vas a ver cambiar en semanas.`,
      });
    }
  }

  const peso: Record<MotivoMover, number> = { frio: 0, calor: 1, lluvia: 2, luz: 3 };
  return avisos.sort((a, b) => a.enDias - b.enDias || peso[a.motivo] - peso[b.motivo]);
}

function mayuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

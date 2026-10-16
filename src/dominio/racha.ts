/**
 * La racha de cuidado, y la salud del patio.
 *
 * CÓMO CUENTA, que es lo que la gente tiene que entender en un segundo: un día
 * suma cuando registras CUALQUIER cuidado — un riego, "la revisé", una foto, un
 * brote, una poda. Igual que en Duolingo: haces tu parte del día y el número
 * sube en ese momento, no mañana ni cuando lo decida una simulación.
 *
 * Antes contaba otra cosa —los días en que las plantas amanecían en rango— y
 * era más correcta agronómicamente, pero no se entendía: subía sola, sin que la
 * persona hiciera nada, y cuando no subía nadie sabía qué hacer para moverla.
 * Un contador que no responde a lo que haces se deja de mirar.
 *
 * EL RIESGO DE ESTE DISEÑO, y cómo se contiene. Si sólo regar sumara, la racha
 * enseñaría a regar todos los días, y regar de más es la primera causa de
 * muerte de una planta de casa — de una sansevieria, sobre todo. Por eso "la
 * revisé" (un evento `observacion`) cuenta exactamente igual que un riego: en
 * los días en que la planta no quiere agua, mantener la racha no cuesta echarle
 * una gota. Y la salud sigue midiéndose aparte (`salud`, más abajo): una maceta
 * encharcada se sigue señalando aunque la racha vaya perfecta.
 *
 * EL PROTECTOR. Un día que se te olvide no borra la racha: lo cubre el
 * protector, igual que el congelador de Duolingo. Hay uno, y se recarga cada
 * siete días seguidos. Perder tres semanas por un fin de semana fuera hace que
 * la gente abandone; un protector infinito haría que la racha no significara
 * nada.
 *
 * LOS DÍAS SON LOCALES. Un riego a las nueve de la noche en Culiacán son las
 * tres de la mañana del día siguiente en UTC. Si el día se contara en UTC, ese
 * riego se apuntaría a mañana y hoy aparecería como olvidado. Aquí el día es el
 * del reloj del teléfono.
 */

import type { EstadoHidrico } from './balanceHidrico';
import type { TipoEvento } from './tipos';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Un cuidado registrado: lo que mueve la racha. */
export interface Cuidado {
  /** ISO 8601, como se guarda el evento. */
  fecha: string;
  plantaId: string;
  apodo: string;
  tipo: TipoEvento;
}

export type EstadoDelDia =
  /** Registraste al menos un cuidado. */
  | 'cuidado'
  /** No registraste nada y el protector lo cubrió: no suma, no rompe. */
  | 'protegido'
  /** No registraste nada y no había protector: aquí se rompió la racha. */
  | 'perdido'
  /** Hoy, todavía sin nada. No es un fallo: el día no ha terminado. */
  | 'pendiente'
  /** Antes de tu primer cuidado. No cuenta ni para bien ni para mal. */
  | 'antes';

export interface DiaDeRacha {
  /** AAAA-MM-DD, día local. */
  fecha: string;
  /** Inicial del día de la semana, para pintar la fila: D L M M J V S. */
  letra: string;
  estado: EstadoDelDia;
  /** Cuántos cuidados se registraron ese día. */
  cuidados: number;
  esHoy: boolean;
}

export interface Logro {
  clave: string;
  titulo: string;
  detalle: string;
  logrado: boolean;
  /** De 0 a 1. Sirve para pintar cuánto falta. */
  avance: number;
  /** Para los logros por días: cuántos faltan. */
  faltan?: number;
}

/** Por qué una planta está fuera de rango hoy. */
export type MotivoFallo = 'sed' | 'ahogo';

export interface FalloDelDia {
  plantaId: string;
  apodo: string;
  motivo: MotivoFallo;
}

/** Un día de salud: cómo amanecieron las plantas. Es lo que guarda el diario. */
export interface DiaDeCuidado {
  fecha: string;
  enVerde: number;
  total: number;
  fallos: FalloDelDia[];
  bueno: boolean;
  perdonado: boolean;
}

export interface PlantaEnRacha {
  id: string;
  apodo: string;
  /** La serie diaria que devuelve `simularBalance`, en orden. */
  estados: EstadoHidrico[];
}

export interface Racha {
  /** Los días de la racha. Incluye hoy si hoy ya cuenta. */
  dias: number;
  mejor: number;
  /** Hoy ya registraste algo: el fuego está encendido. */
  hoyCuenta: boolean;
  /**
   * Hay racha y hoy todavía no cuenta. Si el día se acaba así, se gasta el
   * protector o, si no hay, se pierde.
   */
  enPeligro: boolean;
  /** Protectores disponibles ahora mismo (0 o 1). */
  protectores: number;
  /** Los últimos siete días, terminando hoy. La fila de la tarjeta. */
  semana: DiaDeRacha[];
  /** Las últimas cinco semanas, para el calendario. */
  calendario: DiaDeRacha[];
  logros: Logro[];
  /** El siguiente logro por días, con cuánto falta. null si ya están todos. */
  siguienteMeta: Logro | null;
  /**
   * Qué hacer para mover el número, en una frase.
   *
   * Sin esto, un cero es un misterio: quien lo ve no sabe si la app está rota
   * o qué se espera de él. Y un contador que uno no entiende se deja de mirar.
   */
  explicacion: string;

  // --- Salud: aparte de la racha, y a propósito. ---------------------------

  /** Plantas fuera de rango hoy. Lo que de verdad hay que atender. */
  paraSalvarla: FalloDelDia[];
  salud: { enVerde: number; total: number };
  /** Días de salud recién calculados, para que quien llame los apunte. */
  paraApuntar: DiaDeCuidado[];
}

export interface EntradaRacha {
  cuidados: Cuidado[];
  hoy?: Date;
  /** Para la salud: la simulación de cada planta. Opcional. */
  plantas?: PlantaEnRacha[];
  /** Días de salud ya apuntados. La simulación manda donde alcanza. */
  diario?: DiaDeCuidado[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Cada cuántos días seguidos se recarga el protector. */
export const DIAS_PARA_PROTECTOR = 7;

/** Protectores como máximo. Uno: más harían que la racha no costara nada. */
const PROTECTORES_MAXIMOS = 1;

/** Cuántos días de calendario se devuelven para pintar. */
const DIAS_DE_CALENDARIO = 35;

const LETRAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const METAS = [
  { clave: 'tres', dias: 3, titulo: 'Tres seguidos', detalle: 'Tres días sin soltarlas. Ya no es casualidad.' },
  { clave: 'semana', dias: 7, titulo: 'Primera semana', detalle: 'Siete días seguidos cuidándolas.' },
  { clave: 'quincena', dias: 15, titulo: 'Quince días', detalle: 'Ya es costumbre, no suerte.' },
  { clave: 'mes', dias: 30, titulo: 'Un mes', detalle: 'Un mes entero sin dejarlas solas.' },
  { clave: 'cien', dias: 100, titulo: 'Cien días', detalle: 'A esto ya se le llama tener mano.' },
];

// ---------------------------------------------------------------------------
// La racha
// ---------------------------------------------------------------------------

export function calcularRacha({
  cuidados,
  hoy = new Date(),
  plantas = [],
  diario = [],
}: EntradaRacha): Racha {
  const hoyLocal = diaLocal(hoy);
  const porDia = contarPorDia(cuidados, hoyLocal);
  const recorrido = recorrer(porDia, hoyLocal);

  const salud = calcularSalud(plantas, hoy, diario);
  const logros = calcularLogros(recorrido.dias, salud.calendario);
  const siguienteMeta = logros.find((l) => l.faltan !== undefined && !l.logrado) ?? null;

  return {
    dias: recorrido.dias,
    mejor: recorrido.mejor,
    hoyCuenta: recorrido.hoyCuenta,
    enPeligro: recorrido.dias > 0 && !recorrido.hoyCuenta,
    protectores: recorrido.protectores,
    semana: recorrido.calendario.slice(-7),
    calendario: recorrido.calendario.slice(-DIAS_DE_CALENDARIO),
    logros,
    siguienteMeta,
    explicacion: explicar(recorrido, cuidados.length > 0),
    paraSalvarla: salud.hoy?.fallos ?? [],
    salud: { enVerde: salud.hoy?.enVerde ?? 0, total: salud.hoy?.total ?? 0 },
    paraApuntar: salud.simulados,
  };
}

/** Cuántos cuidados hubo cada día local. Lo del futuro no cuenta. */
function contarPorDia(cuidados: Cuidado[], hoyLocal: string): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const cuidado of cuidados) {
    const instante = new Date(cuidado.fecha);
    if (Number.isNaN(instante.getTime())) continue;
    const fecha = diaLocal(instante);
    if (fecha > hoyLocal) continue;
    porDia.set(fecha, (porDia.get(fecha) ?? 0) + 1);
  }
  return porDia;
}

interface Recorrido {
  dias: number;
  mejor: number;
  hoyCuenta: boolean;
  protectores: number;
  /** Todos los días desde el primer cuidado (o una semana, si hay menos). */
  calendario: DiaDeRacha[];
  /** Si ayer se gastó un protector: cambia lo que hay que decir. */
  protegidoAyer: boolean;
  /** Si la racha se rompió ayer: también. */
  perdidoAyer: boolean;
}

/**
 * Se recorre de adelante hacia atrás en el tiempo — del primer cuidado a hoy —
 * y no al revés, a propósito.
 *
 * Contar hacia atrás desde hoy parece más simple, pero reescribe el pasado: un
 * olvido de hace dos semanas que el protector cubrió EN SU MOMENTO se
 * convertiría en ruptura en cuanto hubiera un olvido nuevo, y la racha caería
 * de treinta a diez de golpe. Recorriendo hacia adelante, cada día se decide
 * con lo que había ese día, como pasó de verdad.
 */
function recorrer(porDia: Map<string, number>, hoyLocal: string): Recorrido {
  const fechas = [...porDia.keys()].sort();
  const primero = fechas[0];

  // Siempre se devuelve al menos una semana, para que la fila tenga siete
  // casillas aunque la racha empiece hoy.
  const inicioCalendario = menorDe(primero ?? hoyLocal, sumarDias(hoyLocal, -6));

  let racha = 0;
  let mejor = 0;
  let protectores = PROTECTORES_MAXIMOS;
  const calendario: DiaDeRacha[] = [];
  let hoyCuenta = false;
  let protegidoAyer = false;
  let perdidoAyer = false;

  for (let fecha = inicioCalendario; fecha <= hoyLocal; fecha = sumarDias(fecha, 1)) {
    const cuantos = porDia.get(fecha) ?? 0;
    const esHoy = fecha === hoyLocal;
    let estado: EstadoDelDia;

    if (!primero || fecha < primero) {
      estado = esHoy ? 'pendiente' : 'antes';
    } else if (cuantos > 0) {
      estado = 'cuidado';
      racha += 1;
      if (racha % DIAS_PARA_PROTECTOR === 0) protectores = PROTECTORES_MAXIMOS;
      if (esHoy) hoyCuenta = true;
    } else if (esHoy) {
      // Hoy sin nada todavía: no se decide hasta que se acabe el día.
      estado = 'pendiente';
    } else if (racha > 0 && protectores > 0) {
      estado = 'protegido';
      protectores -= 1;
    } else {
      estado = 'perdido';
      racha = 0;
    }

    if (racha > mejor) mejor = racha;
    if (fecha === sumarDias(hoyLocal, -1)) {
      protegidoAyer = estado === 'protegido';
      perdidoAyer = estado === 'perdido';
    }

    calendario.push({ fecha, letra: letraDe(fecha), estado, cuidados: cuantos, esHoy });
  }

  return { dias: racha, mejor, hoyCuenta, protectores, calendario, protegidoAyer, perdidoAyer };
}

/**
 * La frase que explica el número.
 *
 * Siempre termina diciendo qué hacer, porque es lo único que le sirve a quien
 * la lee: "llevas 12" no mueve a nadie; "riega o revisa una planta y llegas a
 * 13" sí.
 */
function explicar(r: Recorrido, algunaVez: boolean): string {
  const siguiente = r.dias + 1;
  const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

  if (!algunaVez) {
    return 'Riega, revisa o registra cualquier avance de una planta y tu racha empieza hoy.';
  }
  if (r.hoyCuenta) {
    return r.dias === 1
      ? 'Hoy ya cuenta. Mañana registra algo otra vez y van dos.'
      : `Hoy ya cuenta: ${dias(r.dias)} seguidos. Mañana vuelve y suman ${dias(siguiente)}.`;
  }
  if (r.dias === 0) {
    return r.perdidoAyer
      ? 'Ayer se cortó la racha. Registra un riego o una revisión hoy y empieza de nuevo.'
      : 'Riega o revisa una planta hoy y tu racha empieza.';
  }
  if (r.protegidoAyer) {
    return `Ayer se te pasó y el protector te cubrió. Hoy riega o revisa una planta, o la racha de ${dias(r.dias)} vuelve a cero.`;
  }
  return `Llevas ${dias(r.dias)}. Riega o revisa cualquier planta hoy y llegas a ${dias(siguiente)}.`;
}

// ---------------------------------------------------------------------------
// Logros
// ---------------------------------------------------------------------------

function calcularLogros(dias: number, salud: DiaDeCuidado[]): Logro[] {
  const logros: Logro[] = METAS.map((meta) => ({
    clave: meta.clave,
    titulo: meta.titulo,
    detalle: meta.detalle,
    logrado: dias >= meta.dias,
    avance: Math.min(1, dias / meta.dias),
    faltan: Math.max(0, meta.dias - dias),
  }));

  // Estos dos miran la SALUD, no la racha, y están aquí por lo que se dijo
  // arriba: la racha premia aparecer; éstos premian hacerlo bien. Juntos
  // evitan que alguien suba la racha regando de más sin enterarse.
  const ultimos30 = salud.slice(-30);
  const ahogos = ultimos30.filter((d) => d.fallos.some((f) => f.motivo === 'ahogo')).length;
  logros.push({
    clave: 'mano_ligera',
    titulo: 'Mano ligera',
    detalle: 'Treinta días sin encharcar una sola maceta.',
    logrado: ultimos30.length >= 30 && ahogos === 0,
    avance: ultimos30.length === 0 ? 0 : Math.min(1, ultimos30.length / 30) * (ahogos === 0 ? 1 : 0),
  });

  const rescate = huboRescate(salud);
  logros.push({
    clave: 'rescate',
    titulo: 'Rescate',
    detalle: 'Una planta pasó de estar en problemas a estar en verde.',
    logrado: rescate,
    avance: rescate ? 1 : 0,
  });

  return logros;
}

/** Un día con fallos seguido, en la semana, de tres días limpios. */
function huboRescate(calendario: DiaDeCuidado[]): boolean {
  for (let i = 0; i < calendario.length - 3; i += 1) {
    if (calendario[i].bueno) continue;
    const siguientes = calendario.slice(i + 1, i + 4);
    if (siguientes.length === 3 && siguientes.every((d) => d.bueno)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Salud: cómo amanecieron las plantas
// ---------------------------------------------------------------------------

/**
 * La salud del patio, día por día, sacada de la simulación hídrica.
 *
 * Ya no mueve la racha, pero sigue siendo lo que dice si las plantas están
 * bien: alimenta a "Mano ligera", al rescate y al aviso de cuáles están fuera
 * de rango hoy. Los días viejos vienen del diario, que la simulación sola no
 * alcanza a cubrir (sólo tiene catorce días de clima).
 */
export function calcularSalud(
  plantas: PlantaEnRacha[],
  hoy: Date,
  diario: DiaDeCuidado[],
): { calendario: DiaDeCuidado[]; simulados: DiaDeCuidado[]; hoy: DiaDeCuidado | null } {
  const simulados = armarCalendarioDeSalud(plantas, hoy.toISOString().slice(0, 10));
  const calendario = fundir(diario, simulados);
  return { calendario, simulados, hoy: simulados[simulados.length - 1] ?? null };
}

/** El diario primero, la simulación encima: el clima real le gana al apunte. */
function fundir(diario: DiaDeCuidado[], simulados: DiaDeCuidado[]): DiaDeCuidado[] {
  const porFecha = new Map<string, DiaDeCuidado>();
  for (const dia of diario) porFecha.set(dia.fecha, { ...dia, perdonado: false });
  for (const dia of simulados) porFecha.set(dia.fecha, dia);
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Un día por fecha, con lo que le pasó a cada planta.
 *
 * Sólo cuentan las plantas que ya existían: una planta que registraste ayer no
 * puede echar a perder el mes pasado.
 */
function armarCalendarioDeSalud(plantas: PlantaEnRacha[], hoy: string): DiaDeCuidado[] {
  const porFecha = new Map<string, DiaDeCuidado>();

  for (const planta of plantas) {
    for (const estado of planta.estados) {
      // El pronóstico no es historia.
      if (estado.esPronostico || estado.fecha > hoy) continue;

      const dia = porFecha.get(estado.fecha) ?? {
        fecha: estado.fecha,
        enVerde: 0,
        total: 0,
        fallos: [],
        bueno: true,
        perdonado: false,
      };
      dia.total += 1;

      const motivo = falloDe(estado);
      if (motivo) dia.fallos.push({ plantaId: planta.id, apodo: planta.apodo, motivo });
      else dia.enVerde += 1;

      porFecha.set(estado.fecha, dia);
    }
  }

  const dias = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const dia of dias) dia.bueno = dia.fallos.length === 0;
  return dias;
}

/**
 * "Seco" no es un fallo: toda planta se seca entre riego y riego. El fallo es
 * pasarse de la raya — quedarse sin agua de verdad o estar por encima de
 * capacidad de campo, que es cuando la raíz se asfixia.
 */
function falloDe(estado: EstadoHidrico): MotivoFallo | null {
  if (estado.nivel === 'critico') return 'sed';
  if (estado.nivel === 'encharcado') return 'ahogo';
  return null;
}

// ---------------------------------------------------------------------------
// Fechas locales
// ---------------------------------------------------------------------------

/** AAAA-MM-DD según el reloj del teléfono, no según UTC. */
export function diaLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Suma días a una fecha AAAA-MM-DD.
 *
 * Se hace con el constructor local y a mediodía: sumando milisegundos, el día
 * del cambio de horario tiene 23 o 25 horas y la fecha se corre.
 */
function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + n, 12));
}

function letraDe(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return LETRAS[new Date(a, m - 1, d, 12).getDay()];
}

function menorDe(a: string, b: string): string {
  return a < b ? a : b;
}

/** De un evento guardado a un cuidado que la racha entiende. */
export function cuidadoDe(evento: { fecha: string; plantaId: string; tipo: TipoEvento }, apodo: string): Cuidado {
  return { fecha: evento.fecha, plantaId: evento.plantaId, apodo, tipo: evento.tipo };
}

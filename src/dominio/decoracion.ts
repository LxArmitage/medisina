/**
 * Cómo decoró cada quien su patio, su casa y su rincón de sombra, y la
 * maceta de cada planta.
 *
 * El jardín de la app se sentía de todos y de nadie: el mismo pasto, la misma
 * cerca, la misma sala. Un patio mexicano tiene su barda pintada de rosa o de
 * añil, su papel picado, su hamaca; una sala tiene su tapete y su gato. Esto
 * guarda esas decisiones. Es puro: el dibujo vive en `ui/adornos.tsx` y el
 * guardado en `servicios/decoracion.ts`.
 *
 * Todo lo que viene de guardado se limpia (`limpiarDecoracion`): un valor que
 * ya no existe no puede romper la escena, se cambia por el de siempre.
 */

export type Barda = 'madera' | 'blanca' | 'rosa' | 'amarilla' | 'anil' | 'terracota' | 'verde';
export type PisoPatio = 'pasto' | 'tierra' | 'ladrillo' | 'piedra' | 'madera';
export type AdornoPatio = 'papelPicado' | 'foquitos' | 'banca' | 'fuente' | 'hamaca' | 'faroles' | 'perrito' | 'bebedero';

export type Pared = 'crema' | 'blanca' | 'rosa' | 'azul' | 'verde' | 'amarilla';
export type Cortina = 'terracota' | 'azul' | 'verde' | 'amarilla' | 'rosa';
export type PisoCasa = 'duela' | 'talavera' | 'barro' | 'cemento';
export type Tapete = 'rojo' | 'azul' | 'verde' | 'sarape' | 'ninguno';
export type AdornoCasa = 'gato' | 'sillon' | 'reloj' | 'guitarra' | 'jaula' | 'pinata';

export type PisoSombra = 'pasto' | 'hojarasca' | 'grava';
export type AdornoSombra = 'hongos' | 'columpio' | 'farolitos' | 'banca' | 'bebedero' | 'ranita';

export type EstiloMaceta = 'barro' | 'talavera' | 'blanca' | 'negra' | 'rosa' | 'turquesa' | 'amarilla' | 'concreto';

export interface Decoracion {
  patio: { barda: Barda; piso: PisoPatio; adornos: AdornoPatio[] };
  casa: { pared: Pared; cortina: Cortina; piso: PisoCasa; tapete: Tapete; adornos: AdornoCasa[] };
  sombra: { piso: PisoSombra; adornos: AdornoSombra[] };
}

/** Como se veía antes de poder decorar: nadie encuentra su patio cambiado. */
export const DECORACION_INICIAL: Decoracion = {
  patio: { barda: 'madera', piso: 'pasto', adornos: [] },
  casa: { pared: 'crema', cortina: 'terracota', piso: 'duela', tapete: 'rojo', adornos: ['gato'] },
  sombra: { piso: 'pasto', adornos: ['hongos'] },
};

export interface Opcion<T extends string> {
  valor: T;
  nombre: string;
  /** El color con que se muestra la opción (y con que se pinta, si es un color). */
  color: string;
}

export interface OpcionAdorno<T extends string> {
  valor: T;
  nombre: string;
  /** Un icono de Ionicons para el botón. */
  icono: string;
}

export const BARDAS: Opcion<Barda>[] = [
  { valor: 'madera', nombre: 'Cerca de madera', color: '#E6D6B4' },
  { valor: 'blanca', nombre: 'Blanca', color: '#F1ECE2' },
  { valor: 'rosa', nombre: 'Rosa mexicano', color: '#E0508C' },
  { valor: 'amarilla', nombre: 'Amarilla', color: '#F0C14A' },
  { valor: 'anil', nombre: 'Azul añil', color: '#3E64B0' },
  { valor: 'terracota', nombre: 'Terracota', color: '#C9643E' },
  { valor: 'verde', nombre: 'Verde', color: '#4E9A6A' },
];

export const PISOS_PATIO: Opcion<PisoPatio>[] = [
  { valor: 'pasto', nombre: 'Pasto', color: '#7DBB5E' },
  { valor: 'tierra', nombre: 'Tierra', color: '#B98F5E' },
  { valor: 'ladrillo', nombre: 'Ladrillo', color: '#C4673F' },
  { valor: 'piedra', nombre: 'Piedra', color: '#A4A69C' },
  { valor: 'madera', nombre: 'Terraza de madera', color: '#B6875A' },
];

export const ADORNOS_PATIO: OpcionAdorno<AdornoPatio>[] = [
  { valor: 'papelPicado', nombre: 'Papel picado', icono: 'flag' },
  { valor: 'foquitos', nombre: 'Foquitos', icono: 'bulb' },
  { valor: 'banca', nombre: 'Banca', icono: 'albums' },
  { valor: 'fuente', nombre: 'Fuente', icono: 'water' },
  { valor: 'hamaca', nombre: 'Hamaca', icono: 'bed' },
  { valor: 'faroles', nombre: 'Faroles', icono: 'flashlight' },
  { valor: 'perrito', nombre: 'Perrito', icono: 'paw' },
  { valor: 'bebedero', nombre: 'Bebedero de pájaros', icono: 'egg' },
];

export const PAREDES: Opcion<Pared>[] = [
  { valor: 'crema', nombre: 'Crema', color: '#F2E6CE' },
  { valor: 'blanca', nombre: 'Blanca', color: '#F6F3EC' },
  { valor: 'rosa', nombre: 'Rosa', color: '#F2C6CF' },
  { valor: 'azul', nombre: 'Azul cielo', color: '#BFD8EC' },
  { valor: 'verde', nombre: 'Verde menta', color: '#CBE6D2' },
  { valor: 'amarilla', nombre: 'Amarilla', color: '#F6E0A0' },
];

export const CORTINAS: Opcion<Cortina>[] = [
  { valor: 'terracota', nombre: 'Terracota', color: '#C7704F' },
  { valor: 'azul', nombre: 'Azul', color: '#4F74B8' },
  { valor: 'verde', nombre: 'Verde', color: '#4E8E5E' },
  { valor: 'amarilla', nombre: 'Amarilla', color: '#E3B23C' },
  { valor: 'rosa', nombre: 'Rosa', color: '#D8608C' },
];

export const PISOS_CASA: Opcion<PisoCasa>[] = [
  { valor: 'duela', nombre: 'Duela', color: '#C8935E' },
  { valor: 'talavera', nombre: 'Talavera', color: '#E8ECF2' },
  { valor: 'barro', nombre: 'Barro', color: '#C0673F' },
  { valor: 'cemento', nombre: 'Cemento pulido', color: '#B8B6B0' },
];

export const TAPETES: Opcion<Tapete>[] = [
  { valor: 'rojo', nombre: 'Rojo', color: '#A8473A' },
  { valor: 'azul', nombre: 'Azul', color: '#3E5E9E' },
  { valor: 'verde', nombre: 'Verde', color: '#4E7E4E' },
  { valor: 'sarape', nombre: 'Sarape', color: '#E0508C' },
  { valor: 'ninguno', nombre: 'Sin tapete', color: '#FFFFFF' },
];

export const ADORNOS_CASA: OpcionAdorno<AdornoCasa>[] = [
  { valor: 'gato', nombre: 'Gato', icono: 'paw' },
  { valor: 'sillon', nombre: 'Sillón', icono: 'bed' },
  { valor: 'reloj', nombre: 'Reloj', icono: 'time' },
  { valor: 'guitarra', nombre: 'Guitarra', icono: 'musical-notes' },
  { valor: 'jaula', nombre: 'Pajarito', icono: 'egg' },
  { valor: 'pinata', nombre: 'Piñata', icono: 'star' },
];

export const PISOS_SOMBRA: Opcion<PisoSombra>[] = [
  { valor: 'pasto', nombre: 'Pasto', color: '#4E8A45' },
  { valor: 'hojarasca', nombre: 'Hojarasca', color: '#B8793A' },
  { valor: 'grava', nombre: 'Grava', color: '#A8A49A' },
];

export const ADORNOS_SOMBRA: OpcionAdorno<AdornoSombra>[] = [
  { valor: 'hongos', nombre: 'Hongos', icono: 'umbrella' },
  { valor: 'columpio', nombre: 'Columpio', icono: 'git-merge' },
  { valor: 'farolitos', nombre: 'Farolitos', icono: 'flashlight' },
  { valor: 'banca', nombre: 'Banca', icono: 'albums' },
  { valor: 'bebedero', nombre: 'Bebedero de pájaros', icono: 'egg' },
  { valor: 'ranita', nombre: 'Ranita de barro', icono: 'happy' },
];

export const MACETAS: Opcion<EstiloMaceta>[] = [
  { valor: 'barro', nombre: 'Barro', color: '#B8683F' },
  { valor: 'talavera', nombre: 'Talavera', color: '#2F4FA0' },
  { valor: 'blanca', nombre: 'Blanca', color: '#EDE8DD' },
  { valor: 'negra', nombre: 'Negra', color: '#3A3A38' },
  { valor: 'rosa', nombre: 'Rosa mexicano', color: '#D84A86' },
  { valor: 'turquesa', nombre: 'Turquesa', color: '#2FA3A0' },
  { valor: 'amarilla', nombre: 'Amarilla', color: '#E8B53A' },
  { valor: 'concreto', nombre: 'Concreto', color: '#9C9A94' },
];

// ---------------------------------------------------------------------------

function uno<T extends string>(valor: unknown, opciones: Array<{ valor: T }>, respaldo: T): T {
  return opciones.some((o) => o.valor === valor) ? (valor as T) : respaldo;
}

function varios<T extends string>(valor: unknown, opciones: Array<{ valor: T }>, respaldo: T[]): T[] {
  if (!Array.isArray(valor)) return [...respaldo];
  const validos = new Set(opciones.map((o) => o.valor));
  return [...new Set(valor.filter((v): v is T => typeof v === 'string' && validos.has(v as T)))];
}

function objeto(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

/** Lo que venga de guardado, convertido en una decoración que no puede romper la escena. */
export function limpiarDecoracion(x: unknown): Decoracion {
  const d = objeto(x);
  const patio = objeto(d.patio);
  const casa = objeto(d.casa);
  const sombra = objeto(d.sombra);
  const I = DECORACION_INICIAL;
  return {
    patio: {
      barda: uno(patio.barda, BARDAS, I.patio.barda),
      piso: uno(patio.piso, PISOS_PATIO, I.patio.piso),
      adornos: varios(patio.adornos, ADORNOS_PATIO, I.patio.adornos),
    },
    casa: {
      pared: uno(casa.pared, PAREDES, I.casa.pared),
      cortina: uno(casa.cortina, CORTINAS, I.casa.cortina),
      piso: uno(casa.piso, PISOS_CASA, I.casa.piso),
      tapete: uno(casa.tapete, TAPETES, I.casa.tapete),
      adornos: varios(casa.adornos, ADORNOS_CASA, I.casa.adornos),
    },
    sombra: {
      piso: uno(sombra.piso, PISOS_SOMBRA, I.sombra.piso),
      adornos: varios(sombra.adornos, ADORNOS_SOMBRA, I.sombra.adornos),
    },
  };
}

/** Las macetas elegidas, planta por planta, limpias. */
export function limpiarMacetas(x: unknown): Record<string, EstiloMaceta> {
  const salida: Record<string, EstiloMaceta> = {};
  for (const [id, estilo] of Object.entries(objeto(x))) {
    if (MACETAS.some((m) => m.valor === estilo)) salida[id] = estilo as EstiloMaceta;
  }
  return salida;
}

/** Pone o quita un adorno de la lista. */
export function alternar<T extends string>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

/**
 * Dónde va cada adorno a lo largo de la escena: repartidos parejo, cada uno
 * en su lugar, para que no se encimen. Devuelve la x del centro de cada uno.
 */
export function lugaresDeAdornos(ancho: number, cuantos: number): number[] {
  if (cuantos <= 0 || !Number.isFinite(ancho) || ancho <= 0) return [];
  return Array.from({ length: cuantos }, (_, i) => Math.round((ancho * (i + 0.5)) / cuantos));
}

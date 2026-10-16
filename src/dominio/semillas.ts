/**
 * Identificar una semilla, y sembrarla.
 *
 * POR QUÉ ESTO NO ES UNA FOTO. Pl@ntNet identifica hojas, flores, frutos y
 * corteza: no identifica semillas, y ningún clasificador de imágenes de uso
 * general lo hace bien. La razón es física — una semilla son tres o cuatro
 * milímetros de color liso, y las de familias enteras se ven idénticas en una
 * foto de teléfono. Poner una cámara aquí sería fingir una capacidad que no
 * existe, y con semillas eso se paga caro: alguien siembra durante meses algo
 * que no era.
 *
 * Lo que SÍ funciona, y es como se hace de verdad en botánica, es una clave por
 * rasgos: se mide, se mira el color y la forma, y se va descartando. Tres
 * preguntas eliminan casi todo. Y son preguntas que cualquiera puede contestar
 * con la semilla en la mano y una regla.
 *
 * LA OTRA MITAD, que importa más de lo que parece: para varias plantas de casa
 * la respuesta correcta es "de semilla no". Un potos no da semilla y un helecho
 * no tiene semillas, tiene esporas. Decirlo evita meses de maceta vacía.
 */

import { ESPECIES, buscarEspecie } from './catalogo';
import type { Especie } from './tipos';

// ---------------------------------------------------------------------------
// Rasgos, con referencias que se pueden ver sin instrumentos
// ---------------------------------------------------------------------------

export type Tamano = 'diminuta' | 'chica' | 'mediana' | 'grande';
export type Forma = 'redonda' | 'alargada' | 'aplanada' | 'de_gota' | 'con_ala' | 'irregular';
export type Color = 'negra' | 'cafe' | 'clara' | 'verde' | 'gris';

export interface Rasgos {
  tamano?: Tamano;
  forma?: Forma;
  color?: Color;
}

/**
 * Las opciones con una referencia de cocina al lado.
 *
 * "2 a 5 mm" no le dice nada a nadie sin una regla enfrente; "como un grano de
 * arroz" se contesta en un segundo y con la misma precisión.
 */
export const OPCIONES_TAMANO: Array<{ valor: Tamano; etiqueta: string; referencia: string }> = [
  { valor: 'diminuta', etiqueta: 'Diminuta', referencia: 'Menos de 2 mm — como polvo grueso' },
  { valor: 'chica', etiqueta: 'Chica', referencia: 'De 2 a 5 mm — como un grano de arroz' },
  { valor: 'mediana', etiqueta: 'Mediana', referencia: 'De 5 a 10 mm — como una pepita de calabaza' },
  { valor: 'grande', etiqueta: 'Grande', referencia: 'Más de 10 mm — como un frijol' },
];

export const OPCIONES_FORMA: Array<{ valor: Forma; etiqueta: string; referencia: string }> = [
  { valor: 'redonda', etiqueta: 'Redonda', referencia: 'Igual de ancha que de larga' },
  { valor: 'alargada', etiqueta: 'Alargada', referencia: 'Más larga que ancha, como un granito' },
  { valor: 'aplanada', etiqueta: 'Aplanada', referencia: 'Como un disco o una escama' },
  { valor: 'de_gota', etiqueta: 'De gota', referencia: 'Puntiaguda de un lado' },
  { valor: 'con_ala', etiqueta: 'Con ala o borde', referencia: 'Tiene una membrana alrededor' },
  { valor: 'irregular', etiqueta: 'Irregular', referencia: 'Con esquinas, sin forma clara' },
];

export const OPCIONES_COLOR: Array<{ valor: Color; etiqueta: string }> = [
  { valor: 'negra', etiqueta: 'Negra' },
  { valor: 'cafe', etiqueta: 'Café' },
  { valor: 'clara', etiqueta: 'Clara o crema' },
  { valor: 'verde', etiqueta: 'Verde' },
  { valor: 'gris', etiqueta: 'Gris' },
];

// ---------------------------------------------------------------------------
// Siembra
// ---------------------------------------------------------------------------

export interface Siembra {
  /** A qué profundidad. 0 = a la superficie, sin tapar. */
  profundidadCm: number;
  diasMin: number;
  diasMax: number;
  /** Lo que hay que hacerle antes de sembrarla, o 'ninguno'. */
  tratamiento: string;
  /** Meses buenos para sembrar en México (1 = enero). */
  meses: number[];
}

export interface PerfilSemilla {
  especieId: string;
  /** Falso cuando esa planta no se multiplica por semilla en casa. */
  deSemilla: boolean;
  /** Qué hacer en su lugar, cuando `deSemilla` es falso. */
  enLugarDe?: string;
  largoMmMin: number;
  largoMmMax: number;
  tamano: Tamano;
  forma: Forma;
  color: Color;
  /** El rasgo que la delata cuando ya se llegó a dos o tres candidatas. */
  senal: string;
  siembra: Siembra;
}

/**
 * Perfiles de semilla de las especies del catálogo.
 *
 * Sólo están las que se pueden tener en la mano. Una especie sin perfil no se
 * propone nunca como candidata: es preferible "no la reconozco" a un parecido.
 */
const PERFILES: PerfilSemilla[] = [
  {
    especieId: 'ocimum-basilicum',
    deSemilla: true,
    largoMmMin: 1,
    largoMmMax: 1.8,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'negra',
    senal: 'mojada suelta una baba transparente y se pone gelatinosa. Ninguna otra de esta lista hace eso',
    siembra: { profundidadCm: 0.5, diasMin: 5, diasMax: 10, tratamiento: 'ninguno', meses: [3, 4, 5, 6, 7, 8] },
  },
  {
    especieId: 'lophocereus-schottii',
    deSemilla: true,
    largoMmMin: 1.5,
    largoMmMax: 2.5,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'negra',
    senal: 'negra y brillante, como una cuentita de azabache; sale de la pulpa roja del fruto',
    siembra: {
      profundidadCm: 0,
      diasMin: 7,
      diasMax: 21,
      tratamiento: 'a la superficie, sin tapar, y con el sustrato siempre húmedo y tibio',
      meses: [4, 5, 6, 7, 8],
    },
  },
  {
    especieId: 'nymphaea-mexicana',
    deSemilla: true,
    largoMmMin: 2,
    largoMmMax: 3,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'cafe',
    senal: 'viene envuelta en una gelatina que la hace flotar unos días antes de hundirse',
    siembra: {
      profundidadCm: 0,
      diasMin: 10,
      diasMax: 30,
      tratamiento: 'se siembra en un vaso con tierra pesada, sumergido en agua a 20 cm',
      meses: [4, 5, 6],
    },
  },
  {
    especieId: 'hibiscus-rosa-sinensis',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 4.5,
    tamano: 'chica',
    forma: 'redonda',
    color: 'cafe',
    senal: 'café con pelillos finos, en forma de riñón',
    siembra: {
      profundidadCm: 1,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'remojar 12 horas en agua tibia',
      meses: [4, 5, 6, 7],
    },
  },
  {
    especieId: 'rosa-hybrida',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'irregular',
    color: 'clara',
    senal: 'con esquinas y pelillos, varias juntas dentro del escaramujo rojo',
    siembra: {
      profundidadCm: 1,
      diasMin: 30,
      diasMax: 90,
      tratamiento:
        'frío obligatorio: de 6 a 10 semanas en el refrigerador, en sustrato húmedo, antes de sembrar',
      meses: [12, 1, 2],
    },
  },
  {
    especieId: 'opuntia-ficus-indica',
    deSemilla: true,
    largoMmMin: 4,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'aplanada',
    color: 'clara',
    senal: 'plana como un disco y dura como una piedrita; son las que uno escupe al comer tuna',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 21,
      diasMax: 60,
      tratamiento: 'lijar un costado o remojar 24 horas: la cáscara es durísima',
      meses: [3, 4, 5, 6, 7],
    },
  },
  {
    especieId: 'aloe-vera',
    deSemilla: true,
    largoMmMin: 4,
    largoMmMax: 6,
    tamano: 'chica',
    forma: 'con_ala',
    color: 'gris',
    senal: 'gris oscura y plana, con un borde de papel alrededor',
    siembra: {
      profundidadCm: 0,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'a la superficie sobre sustrato mineral; de hijuelo es mucho más rápido',
      meses: [3, 4, 5],
    },
  },
  {
    especieId: 'dracaena-trifasciata',
    deSemilla: true,
    largoMmMin: 5,
    largoMmMax: 7,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'clara',
    senal: 'sale de una baya naranja; en casa casi nunca florece, así que es rara de conseguir',
    siembra: {
      profundidadCm: 1,
      diasMin: 30,
      diasMax: 60,
      tratamiento: 'ninguno, pero tarda; por división de mata tienes planta en semanas',
      meses: [3, 4, 5],
    },
  },
  {
    especieId: 'citrus-limon',
    deSemilla: true,
    largoMmMin: 8,
    largoMmMax: 12,
    tamano: 'grande',
    forma: 'de_gota',
    color: 'clara',
    senal: 'crema, lisa, puntiaguda de un lado; de una sola salen a veces dos plantitas',
    siembra: {
      profundidadCm: 1.5,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'sembrarla recién sacada del limón: seca pierde poder en días',
      meses: [3, 4, 5, 6, 7, 8, 9],
    },
  },
  {
    especieId: 'monstera-deliciosa',
    deSemilla: true,
    largoMmMin: 10,
    largoMmMax: 13,
    tamano: 'grande',
    forma: 'redonda',
    color: 'verde',
    senal: 'verde pálida y blanda, no dura como las demás; se echa a perder en días',
    siembra: {
      profundidadCm: 1,
      diasMin: 14,
      diasMax: 40,
      tratamiento: 'sembrarla el mismo día: no se puede guardar',
      meses: [4, 5, 6, 7, 8],
    },
  },

  // --- Las que NO se hacen de semilla. Están aquí para poder decirlo. ---
  {
    especieId: 'epipremnum-aureum',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo con dos nudos, en un vaso con agua',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en casa no florece nunca, así que no hay semilla que buscar',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'nephrolepis-exaltata',
    deSemilla: false,
    enLugarDe: 'división de mata, o los estolones que echa por fuera de la maceta',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal:
      'los helechos no tienen semillas: tienen esporas, que son los puntitos café del envés de la fronda',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'ficus-benjamina',
    deSemilla: false,
    enLugarDe: 'esqueje de punta, dejando escurrir el látex antes de plantarlo',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'su higo sólo cuaja con una avispa que no vive aquí, así que la semilla no es viable',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'bougainvillea-glabra',
    deSemilla: false,
    enLugarDe: 'esqueje semileñoso de 15 cm con hormona de enraizado',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'las variedades de jardín casi nunca cuajan semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'jasminum-sambac',
    deSemilla: false,
    enLugarDe: 'esqueje semileñoso o acodo de una rama baja',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en cultivo rara vez fructifica',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'zamioculcas-zamiifolia',
    deSemilla: false,
    enLugarDe: 'se multiplica por división de rizomas o enterrando una hoja entera por la base',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'cafe',
    senal: 'casi nunca fructifica en casa; si alguien te ofrece semilla de ZZ, desconfía',
    siembra: { profundidadCm: 1, diasMin: 30, diasMax: 90, tratamiento: 'ninguno', meses: [4, 5, 6, 7, 8] },
  },
  {
    especieId: 'chlorophytum-comosum',
    deSemilla: false,
    enLugarDe: 'se multiplica con los hijos que cuelgan de las varas: se cortan y se plantan',
    largoMmMin: 2,
    largoMmMax: 3,
    tamano: 'chica',
    forma: 'irregular',
    color: 'negra',
    senal: 'negra y con esquinas, dentro de una cápsula de tres gajos; sale poquísimo en casa',
    siembra: { profundidadCm: 0.5, diasMin: 14, diasMax: 30, tratamiento: 'ninguno', meses: [3, 4, 5] },
  },
  {
    especieId: 'spathiphyllum-wallisii',
    deSemilla: false,
    enLugarDe: 'se multiplica dividiendo la mata al trasplantar, con raíces en cada trozo',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'redonda',
    color: 'cafe',
    senal: 'no cuaja semilla en interior; la vela blanca se seca sin fruto',
    siembra: { profundidadCm: 0.5, diasMin: 20, diasMax: 60, tratamiento: 'ninguno', meses: [4, 5, 6] },
  },
  {
    especieId: 'echeveria-elegans',
    deSemilla: true,
    largoMmMin: 0.3,
    largoMmMax: 0.8,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'cafe',
    senal: 'polvo café clarísimo, casi invisible; se confunde con tierra y por eso se siembra sin tapar',
    siembra: {
      profundidadCm: 0,
      diasMin: 14,
      diasMax: 28,
      tratamiento: 'a la superficie, tapada con vidrio o plástico y sin regar por encima',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'sedum-morganianum',
    deSemilla: false,
    enLugarDe: 'se multiplica con las hojitas que se caen solas: se dejan sobre el sustrato y enraízan',
    largoMmMin: 0.3,
    largoMmMax: 0.6,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'cafe',
    senal: 'raro que florezca en casa; por hoja es tan fácil que nadie usa semilla',
    siembra: { profundidadCm: 0, diasMin: 14, diasMax: 30, tratamiento: 'a la superficie', meses: [4, 5, 6] },
  },
  {
    especieId: 'crassula-ovata',
    deSemilla: false,
    enLugarDe: 'se multiplica por esqueje de tallo u hoja, dejando cicatrizar el corte dos días',
    largoMmMin: 0.5,
    largoMmMax: 1,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'cafe',
    senal: 'sólo florece de vieja y en frío; el esqueje prende en dos semanas',
    siembra: { profundidadCm: 0, diasMin: 14, diasMax: 30, tratamiento: 'a la superficie', meses: [3, 4, 5] },
  },
  {
    especieId: 'agave-americana',
    deSemilla: false,
    enLugarDe: 'se multiplica con los hijuelos de la base, que salen de sobra',
    largoMmMin: 5,
    largoMmMax: 8,
    tamano: 'mediana',
    forma: 'aplanada',
    color: 'negra',
    senal: 'negra, plana y en forma de media luna, apilada en columnas dentro de la cápsula',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 10,
      diasMax: 30,
      tratamiento: 'ninguno, pero sólo hay semilla si floreció, y florece una vez en la vida',
      meses: [4, 5, 6, 7],
    },
  },
  {
    especieId: 'beaucarnea-recurvata',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'redonda',
    color: 'clara',
    senal: 'crema y arrugada, dentro de una cápsula papelosa de tres alas',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 21,
      diasMax: 60,
      tratamiento: 'remojo de veinticuatro horas en agua tibia',
      meses: [4, 5, 6, 7],
    },
  },
  {
    especieId: 'euphorbia-pulcherrima',
    deSemilla: false,
    enLugarDe: 'se multiplica por esqueje de tallo, cortando el látex con agua fría antes de plantar',
    largoMmMin: 4,
    largoMmMax: 6,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'gris',
    senal: 'gris moteada; la cápsula revienta sola y las lanza, así que casi nunca se recoge',
    siembra: { profundidadCm: 1, diasMin: 14, diasMax: 30, tratamiento: 'ninguno', meses: [4, 5, 6] },
  },
  {
    especieId: 'tagetes-erecta',
    deSemilla: true,
    largoMmMin: 8,
    largoMmMax: 12,
    tamano: 'grande',
    forma: 'alargada',
    color: 'negra',
    senal: 'aguja negra con un penacho de pelillos dorados en un extremo: no hay otra igual en esta lista',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 4,
      diasMax: 10,
      tratamiento: 'ninguno; germina tan rápido que se ve a los cuatro días',
      meses: [6, 7],
    },
  },
  {
    especieId: 'salvia-rosmarinus',
    deSemilla: true,
    largoMmMin: 1,
    largoMmMax: 2,
    tamano: 'diminuta',
    forma: 'de_gota',
    color: 'cafe',
    senal: 'café clara y diminuta, y germina fatal: de diez, brotan dos. Por eso se hace por esqueje',
    siembra: {
      profundidadCm: 0.3,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'ninguno, pero cuenta con que casi no nazca: siembra de más',
      meses: [3, 4, 9, 10],
    },
  },
  {
    especieId: 'mentha-spicata',
    deSemilla: false,
    enLugarDe: 'se multiplica poniendo un tallo en un vaso de agua: echa raíz en una semana',
    largoMmMin: 0.5,
    largoMmMax: 1,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'cafe',
    senal: 'la hierbabuena de semilla no sale igual a la madre; por eso siempre se hace por esqueje',
    siembra: { profundidadCm: 0, diasMin: 10, diasMax: 20, tratamiento: 'a la superficie', meses: [3, 4, 5] },
  },
  {
    especieId: 'coriandrum-sativum',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'redonda',
    color: 'clara',
    senal: 'bolita café clara con costillas, que es la misma semilla de coriandro de la cocina; se parte en dos mitades',
    siembra: {
      profundidadCm: 1,
      diasMin: 7,
      diasMax: 18,
      tratamiento: 'partirla en dos apretándola suave, y remojarla medio día',
      meses: [1, 2, 3, 9, 10, 11, 12],
    },
  },
  {
    especieId: 'capsicum-annuum',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'aplanada',
    color: 'clara',
    senal: 'disco amarillo pálido y plano, como una moneda diminuta; sale del propio chile',
    siembra: {
      profundidadCm: 1,
      diasMin: 7,
      diasMax: 21,
      tratamiento: 'lavarla y secarla a la sombra; le urge calor para nacer',
      meses: [2, 3, 4],
    },
  },
  {
    especieId: 'persea-americana',
    deSemilla: true,
    largoMmMin: 30,
    largoMmMax: 55,
    tamano: 'grande',
    forma: 'redonda',
    color: 'cafe',
    senal: 'el hueso del aguacate: no hay forma de confundirlo con nada de esta lista',
    siembra: {
      profundidadCm: 3,
      diasMin: 21,
      diasMax: 60,
      tratamiento: 'quitarle la piel café fina y ponerlo con la punta hacia arriba, a medias en agua o tierra',
      meses: [3, 4, 5, 6, 7, 8],
    },
  },
  {
    especieId: 'solanum-lycopersicum',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 4,
    tamano: 'chica',
    forma: 'aplanada',
    color: 'clara',
    senal: 'plana, en forma de lágrima y con pelitos que la hacen ver afelpada',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 5,
      diasMax: 10,
      tratamiento: 'ninguno',
      meses: [1, 2, 3, 4, 8],
    },
  },
  {
    especieId: 'catharanthus-roseus',
    deSemilla: true,
    largoMmMin: 1.5,
    largoMmMax: 2.5,
    tamano: 'chica',
    forma: 'alargada',
    color: 'negra',
    senal: 'negra, alargada y con surcos; sale de unas vainas delgadas como ejotitos',
    siembra: {
      profundidadCm: 0.3,
      diasMin: 10,
      diasMax: 20,
      tratamiento: 'taparla bien: germina en la oscuridad',
      meses: [2, 3, 4, 5],
    },
  },
  {
    especieId: 'portulaca-grandiflora',
    deSemilla: true,
    largoMmMin: 0.5,
    largoMmMax: 0.8,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'gris',
    senal: 'diminuta, gris metálica y brillante, como polvo de grafito',
    siembra: {
      profundidadCm: 0,
      diasMin: 7,
      diasMax: 14,
      tratamiento: 'sin tapar: necesita luz para germinar',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'coleus-scutellarioides',
    deSemilla: true,
    largoMmMin: 0.8,
    largoMmMax: 1.2,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'cafe',
    senal: 'diminuta y café claro; casi siempre se compra en sobre, porque la planta se cultiva por la hoja',
    siembra: {
      profundidadCm: 0,
      diasMin: 10,
      diasMax: 20,
      tratamiento: 'sin tapar: necesita luz para germinar',
      meses: [3, 4, 5],
    },
  },
  {
    especieId: 'pelargonium-hortorum',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'alargada',
    color: 'cafe',
    senal: 'café, con una colita en espiral que se enrosca y desenrosca con la humedad',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 7,
      diasMax: 21,
      tratamiento: 'lijar apenas la cubierta ayuda a que germine parejo',
      meses: [1, 2, 3, 9, 10],
    },
  },
  {
    especieId: 'mammillaria',
    deSemilla: true,
    largoMmMin: 0.8,
    largoMmMax: 1.2,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'negra',
    senal: 'negra y diminuta; sale de frutitos rojos, como chilitos, entre las espinas',
    siembra: {
      profundidadCm: 0,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'sobre arena húmeda, sin tapar, dentro de una bolsa que guarde la humedad',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'chamaedorea-elegans',
    deSemilla: true,
    largoMmMin: 5,
    largoMmMax: 7,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'negra',
    senal: 'redonda y dura; sale de frutitos negros en racimos',
    siembra: {
      profundidadCm: 1,
      diasMin: 60,
      diasMax: 180,
      tratamiento: 'remojarla dos días; tarda meses en brotar, con paciencia',
      meses: [3, 4, 5, 6, 7],
    },
  },
  {
    especieId: 'mangifera-indica',
    deSemilla: true,
    largoMmMin: 40,
    largoMmMax: 80,
    tamano: 'grande',
    forma: 'aplanada',
    color: 'clara',
    senal: 'el hueso fibroso del mango; adentro trae la semilla, como un frijol enorme',
    siembra: {
      profundidadCm: 2,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'quitarle la cáscara dura al hueso y sembrar la semilla de canto',
      meses: [5, 6, 7, 8],
    },
  },
  {
    especieId: 'ficus-elastica',
    deSemilla: false,
    enLugarDe: 'esqueje de punta o acodo aéreo en el tallo',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en casa no da higos con semilla: la avispa que la poliniza no vive aquí',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'dracaena-fragrans',
    deSemilla: false,
    enLugarDe: 'trozo de tronco de pie en agua o tierra húmeda',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta casi nunca florece, y de su semilla tarda años en hacerse planta',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'dypsis-lutescens',
    deSemilla: false,
    enLugarDe: 'división de la mata con sus hijuelos',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'la semilla existe pero tarda meses y en casa no la da',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'kalanchoe-blossfeldiana',
    deSemilla: false,
    enLugarDe: 'esqueje de hoja o de tallo, secado un día',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'las de tienda son híbridos: de su semilla no sale igual',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'phalaenopsis',
    deSemilla: false,
    enLugarDe: 'los keikis, hijitos que salen de la vara',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'su semilla es un polvo que sólo germina en laboratorio',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'anthurium-andraeanum',
    deSemilla: false,
    enLugarDe: 'división de mata o hijuelos con raíz',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'para dar semilla necesita polinización a mano y tarda un año',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'tradescantia-zebrina',
    deSemilla: false,
    enLugarDe: 'esqueje de punta en agua',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'casi nunca hace semilla; se multiplica sola por esqueje',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'dieffenbachia-seguine',
    deSemilla: false,
    enLugarDe: 'trozo de tallo con un nudo, con guantes',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en casa no florece: se multiplica por tallo',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'syngonium-podophyllum',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo con un nudo en agua',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta no florece: se multiplica por esqueje',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'philodendron-hederaceum',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo con dos nudos en agua',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta no florece: se multiplica por esqueje',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'codiaeum-variegatum',
    deSemilla: false,
    enLugarDe: 'esqueje de punta con hormona de enraizado',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'de semilla sale verde y sin los colores de la madre',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'schefflera-arboricola',
    deSemilla: false,
    enLugarDe: 'esqueje semileñoso o acodo aéreo',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta casi nunca florece',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'aglaonema-commutatum',
    deSemilla: false,
    enLugarDe: 'división de mata al trasplantar',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'la semilla existe pero es rara en casa',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'euphorbia-milii',
    deSemilla: false,
    enLugarDe: 'esqueje de punta, lavando el látex y dejándolo secar',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'hace semilla muy rara vez en maceta',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'nerium-oleander',
    deSemilla: false,
    enLugarDe: 'esqueje de 15 cm en agua',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'hace vainas con semillas peludas, pero el esqueje es mucho más rápido (y todo es tóxico)',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'tradescantia-spathacea',
    deSemilla: false,
    enLugarDe: 'hijuelos de la base',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'se multiplica sola por hijuelos; la semilla casi no se usa',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'plumeria-rubra',
    deSemilla: false,
    enLugarDe: 'esqueje de rama secado dos semanas',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'de semilla sale distinta a la madre y tarda años en florear',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'cycas-revoluta',
    deSemilla: false,
    enLugarDe: 'hijuelos de la base',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'la semilla es naranja, grande como un huevo de codorniz, sólo la dan las hembras y es muy tóxica',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'generica-suculenta',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo o de hoja, secado unos días',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'no sé qué especie es, así que no te puedo decir cómo es su semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'generica-interior',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo en agua o división de mata',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'no sé qué especie es, así que no te puedo decir cómo es su semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'generica-flor',
    deSemilla: false,
    enLugarDe: 'esqueje de punta, o la semilla de sus flores secas',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'no sé qué especie es, así que no te puedo decir cómo es su semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'generica-huerto',
    deSemilla: false,
    enLugarDe: 'semilla o esqueje, según la planta',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'no sé qué especie es, así que no te puedo decir cómo es su semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'generica-arbusto',
    deSemilla: false,
    enLugarDe: 'esqueje semileñoso con hormona',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'chica',
    forma: 'irregular',
    color: 'cafe',
    senal: 'no sé qué especie es, así que no te puedo decir cómo es su semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'selenicereus-undatus',
    deSemilla: true,
    largoMmMin: 2,
    largoMmMax: 3,
    tamano: 'chica',
    forma: 'de_gota',
    color: 'negra',
    senal: 'negritas y brillantes como las del kiwi, y salen por cientos de la pulpa de la fruta',
    siembra: {
      profundidadCm: 0.2,
      diasMin: 7,
      diasMax: 14,
      tratamiento: 'lavarlas bien de la pulpa y dejarlas secar un día a la sombra',
      meses: [3, 4, 5, 6, 7],
    },
  },
  {
    especieId: 'ficus-lyrata',
    deSemilla: false,
    enLugarDe: 'esqueje de punta con dos o tres hojas, o acodo aéreo en el tronco',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en casa no florece ni da higos, así que no hay semilla que buscar',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'strelitzia-reginae',
    deSemilla: true,
    largoMmMin: 8,
    largoMmMax: 10,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'negra',
    senal: 'negra y redonda, con un copete de pelos naranja brillante pegado: ninguna otra de esta lista lo tiene',
    siembra: {
      profundidadCm: 1,
      diasMin: 30,
      diasMax: 90,
      tratamiento: 'quitarle el copete naranja y remojarla dos días en agua tibia',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'lavandula',
    deSemilla: true,
    largoMmMin: 1.5,
    largoMmMax: 2,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'cafe',
    senal: 'ovaladitas, café oscuro y brillantes; se sacan sacudiendo las espigas secas',
    siembra: {
      profundidadCm: 0,
      diasMin: 14,
      diasMax: 30,
      tratamiento: 'una o dos semanas en el refrigerador antes de sembrar, y apenas taparlas',
      meses: [2, 3, 4, 9, 10],
    },
  },
  {
    especieId: 'cymbopogon-citratus',
    deSemilla: false,
    enLugarDe: 'dividir la mata, o poner en agua un tallo del mercado hasta que eche raíz',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'alargada',
    color: 'cafe',
    senal: 'cultivado casi nunca florece, así que no da semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'ruta-graveolens',
    deSemilla: true,
    largoMmMin: 1.5,
    largoMmMax: 2.2,
    tamano: 'chica',
    forma: 'irregular',
    color: 'negra',
    senal: 'negras y angulosas, como riñoncitos; salen de unas cápsulas de cuatro o cinco gajos',
    siembra: { profundidadCm: 0.3, diasMin: 10, diasMax: 20, tratamiento: 'ninguno', meses: [2, 3, 4] },
  },
  {
    especieId: 'echinocactus-grusonii',
    deSemilla: true,
    largoMmMin: 1.2,
    largoMmMax: 1.8,
    tamano: 'diminuta',
    forma: 'redonda',
    color: 'negra',
    senal: 'negras y brillantes; salen de entre la lana amarilla de la corona',
    siembra: {
      profundidadCm: 0,
      diasMin: 7,
      diasMax: 21,
      tratamiento: 'sin taparlas, sobre arena húmeda y en un lugar tibio',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'pilea-peperomioides',
    deSemilla: false,
    enLugarDe: 'separar los hijitos que salen de la tierra junto a ella',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'casi nunca florece en casa: se multiplica sola, con hijitos',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'dracaena-marginata',
    deSemilla: false,
    enLugarDe: 'la punta cortada con su penacho en agua, o un trozo de tronco de pie en tierra',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta casi nunca florece, así que no hay semilla que buscar',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'helianthus-annuus',
    deSemilla: true,
    largoMmMin: 10,
    largoMmMax: 15,
    tamano: 'grande',
    forma: 'de_gota',
    color: 'negra',
    senal: 'la pipa: plana, en forma de lágrima, negra o con rayas grises',
    siembra: { profundidadCm: 2.5, diasMin: 7, diasMax: 10, tratamiento: 'ninguno', meses: [3, 4, 5, 6] },
  },
  {
    especieId: 'hoya-carnosa',
    deSemilla: false,
    enLugarDe: 'esqueje de tallo con dos nudos, en agua o en tierra ligera',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en casa florece, pero casi nunca da las vainas con semilla',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'gardenia-jasminoides',
    deSemilla: false,
    enLugarDe: 'esqueje de punta con hormona de enraizamiento, tapado para que no se seque',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'cafe',
    senal: 'en maceta rara vez da fruto, y de semilla tarda años en florecer',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
  {
    especieId: 'carica-papaya',
    deSemilla: true,
    largoMmMin: 5,
    largoMmMax: 7,
    tamano: 'mediana',
    forma: 'redonda',
    color: 'negra',
    senal: 'negras y rugosas como pimientas, cada una envuelta en una bolsita transparente',
    siembra: {
      profundidadCm: 1,
      diasMin: 10,
      diasMax: 21,
      tratamiento: 'lavarlas, quitarles la bolsita gelatinosa y dejarlas secar un día',
      meses: [3, 4, 5, 6, 7],
    },
  },
  {
    especieId: 'psidium-guajava',
    deSemilla: true,
    largoMmMin: 3,
    largoMmMax: 5,
    tamano: 'chica',
    forma: 'irregular',
    color: 'clara',
    senal: 'duras como piedritas y color crema; salen muchísimas de cada guayaba',
    siembra: {
      profundidadCm: 0.5,
      diasMin: 20,
      diasMax: 40,
      tratamiento: 'remojarlas un día en agua tibia',
      meses: [3, 4, 5, 6],
    },
  },
  {
    especieId: 'musa',
    deSemilla: false,
    enLugarDe: 'un hijuelo de hojas angostas, separado con un buen pedazo de raíz',
    largoMmMin: 0,
    largoMmMax: 0,
    tamano: 'diminuta',
    forma: 'irregular',
    color: 'negra',
    senal: 'los plátanos de casa no tienen semillas: los puntitos negros de adentro no germinan',
    siembra: { profundidadCm: 0, diasMin: 0, diasMax: 0, tratamiento: 'no aplica', meses: [] },
  },
];

// ---------------------------------------------------------------------------

export interface CandidataSemilla {
  perfil: PerfilSemilla;
  especie: Especie;
  /** De 0 a 1: qué tanto encajan los rasgos que se contestaron. */
  encaje: number;
  /** En qué coincidió y en qué no. Sirve para explicar, no sólo para ordenar. */
  coincide: string[];
  difiere: string[];
}

/**
 * Las candidatas, ordenadas.
 *
 * Se puntúa sólo sobre los rasgos CONTESTADOS. Así la clave sirve desde la
 * primera respuesta y va afinando, en vez de exigir el cuestionario completo
 * antes de decir nada.
 *
 * Las que no se hacen de semilla entran igual en el resultado. Si alguien tiene
 * en la mano algo que cree que es semilla de helecho, lo útil es decírselo, no
 * dejarlo fuera de la lista.
 */
export function identificarSemilla(rasgos: Rasgos): CandidataSemilla[] {
  const preguntados = Object.values(rasgos).filter((v) => v !== undefined).length;
  if (preguntados === 0) return [];

  const candidatas: CandidataSemilla[] = [];

  for (const perfil of PERFILES) {
    const especie = buscarEspecie(perfil.especieId);
    if (!especie) continue;

    const coincide: string[] = [];
    const difiere: string[] = [];

    if (rasgos.tamano) {
      (perfil.tamano === rasgos.tamano ? coincide : difiere).push(
        etiqueta(OPCIONES_TAMANO, perfil.tamano),
      );
    }
    if (rasgos.forma) {
      (perfil.forma === rasgos.forma ? coincide : difiere).push(
        etiqueta(OPCIONES_FORMA, perfil.forma),
      );
    }
    if (rasgos.color) {
      (perfil.color === rasgos.color ? coincide : difiere).push(
        etiqueta(OPCIONES_COLOR, perfil.color),
      );
    }

    const encaje = coincide.length / preguntados;
    // Una sola coincidencia de tres no es un parecido, es una casualidad.
    if (encaje > 0) candidatas.push({ perfil, especie, encaje, coincide, difiere });
  }

  return candidatas.sort((a, b) => b.encaje - a.encaje);
}

/** Cuándo se puede afirmar algo y cuándo sólo se puede sugerir. */
export function confianzaDeClave(candidatas: CandidataSemilla[]): 'clara' | 'dudosa' | 'ninguna' {
  if (candidatas.length === 0) return 'ninguna';
  const mejor = candidatas[0];
  if (mejor.encaje < 1) return 'dudosa';
  // Encaje perfecto pero empatado con otra: no alcanza para nombrarla.
  const empatadas = candidatas.filter((c) => c.encaje === mejor.encaje).length;
  return empatadas === 1 ? 'clara' : 'dudosa';
}

/**
 * Qué pregunta descarta más.
 *
 * Es lo que hace útil una clave: en vez de pedir todo, se pide primero lo que
 * más separa a las candidatas que siguen en pie.
 */
export function siguientePregunta(rasgos: Rasgos, candidatas: CandidataSemilla[]): keyof Rasgos | null {
  const pendientes: Array<keyof Rasgos> = (['tamano', 'forma', 'color'] as const).filter(
    (r) => rasgos[r] === undefined,
  );
  if (pendientes.length === 0 || candidatas.length <= 1) return null;

  const vivas = candidatas.filter((c) => c.encaje === candidatas[0].encaje);
  let mejor: keyof Rasgos = pendientes[0];
  let mejorReparto = -1;
  for (const rasgo of pendientes) {
    const valores = new Set(vivas.map((c) => c.perfil[rasgo as 'tamano' | 'forma' | 'color']));
    if (valores.size > mejorReparto) {
      mejorReparto = valores.size;
      mejor = rasgo;
    }
  }
  return mejor;
}

/** Cuántos días desde hoy hasta que asome, si se siembra hoy. */
export function fechaEsperada(siembra: Siembra, hoy = new Date()): { desde: string; hasta: string } {
  const dia = (n: number) => new Date(hoy.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return { desde: dia(siembra.diasMin), hasta: dia(siembra.diasMax) };
}

/** Si el mes de hoy es buena época para esa semilla. */
export function esBuenaEpoca(siembra: Siembra, hoy = new Date()): boolean {
  return siembra.meses.includes(hoy.getMonth() + 1);
}

export function perfilDeSemilla(especieId: string): PerfilSemilla | undefined {
  return PERFILES.find((p) => p.especieId === especieId);
}

/** Todas las que sí se pueden sembrar, para poder listarlas. */
export function semillasSembrables(): PerfilSemilla[] {
  return PERFILES.filter((p) => p.deSemilla);
}

// ---------------------------------------------------------------------------

function etiqueta<T extends string>(
  opciones: Array<{ valor: T; etiqueta: string }>,
  valor: T,
): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Cuántas especies del catálogo tienen perfil de semilla. Para ser claros. */
export const ESPECIES_CON_SEMILLA = PERFILES.length;
export const ESPECIES_EN_CATALOGO = ESPECIES.length;

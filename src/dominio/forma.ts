/**
 * Cómo es cada especie por fuera: su porte, su hoja, su flor y su fruto.
 *
 * Antes el gemelo salía de siete "arquetipos" por familia, así que una sábila
 * se dibujaba como un cactus de columnas y un potos igual que una monstera.
 * Un gemelo que no se parece a la planta que tienes enfrente deja de ser tu
 * planta. Aquí cada especie del catálogo tiene su forma, y de ella se arma el
 * modelo en 3D (`src/ui/tresd`).
 *
 * Los colores son los de la especie sana. El estado (sed, agua de más) y lo
 * que se midió en la foto del escaneo se aplican encima, en `aparienciaDe`.
 */

import type { Morfologia } from './morfologia';
import type { AparienciaObservada } from './tipos';

export type Porte =
  /** Hojas desde el centro: lengua de suegra, sábila, agave, echeveria, cinta. */
  | 'roseta'
  /** Cactus de columnas: la sina. */
  | 'columnas'
  /** Palas apiladas: el nopal. */
  | 'pencas'
  /** Muchos tallitos con hojas chicas: albahaca, hierbabuena, romero, chile. */
  | 'mata'
  /** Arbusto leñoso de hoja mediana: hibisco, rosal, nochebuena, bugambilia. */
  | 'arbusto'
  /** Tronco con copa: limón, ficus, aguacate, árbol de jade. */
  | 'arbol'
  /** Guías que caen por la orilla de la maceta: potos. */
  | 'trepadora'
  /** Pecíolos largos con hojas grandes hendidas. */
  | 'monstera'
  /** Frondas arqueadas de foliolos: helecho. */
  | 'fronda'
  /** Tallos erguidos con folíolos en pares: planta ZZ. */
  | 'zz'
  /** Tronco de botella con penacho: pata de elefante. */
  | 'palma'
  /** Tallos colgantes de hojitas gordas: cola de burro. */
  | 'colgante'
  /** Hojas redondas sobre el agua: nenúfar. */
  | 'flotante'
  /** Cactus de bola con tubérculos: biznaga. */
  | 'bola'
  /** Caña con penacho de hojas: palo de Brasil, galatea, hule. */
  | 'cana'
  /** Cactus trepador en su poste, con los tallos cayendo en cascada: pitahaya. */
  | 'poste'
  /** Hojas enormes como remos: ave del paraíso (desde el suelo), plátano (en su falso tronco). */
  | 'remos'
  /** Un tronco sin ramas con una corona de hojas palmeadas y los frutos pegados abajo: papayo. */
  | 'papayo'
  /** Un tallo alto con hojas alternas y una flor grande en la punta: girasol. */
  | 'vara'
  /** Hojas redondas como monedas en pecíolos largos, desde un tallito: pilea. */
  | 'sombrillas';

export type TipoHoja =
  | 'espada'
  | 'cinta'
  | 'lanceolada'
  | 'ovalada'
  | 'corazon'
  | 'monstera'
  | 'aguja'
  | 'penca'
  | 'pala'
  | 'redonda'
  | 'foliolo'
  /** Ancha arriba, con cintura: el ficus lira. */
  | 'violin'
  /** Larga y de puntas romas, como remo: plátano, ave del paraíso. */
  | 'remo'
  /** Una mano abierta de lóbulos hondos: papayo. */
  | 'palmeada';

/** Cómo se reparte el color en la hoja. */
export type Patron = 'liso' | 'bandas' | 'bordes' | 'manchas' | 'variegado' | 'franja';

export type TipoFlor =
  | 'copa'
  | 'rosa'
  | 'bractea'
  | 'estrella'
  | 'pompon'
  | 'espata'
  | 'nenufar'
  | 'espiga'
  | 'mariposa'
  /** La de la pitahaya: enorme, blanca, de noche, con sépalos largos verdes. */
  | 'reina'
  /** La cabeza de pájaro del ave del paraíso: pico verde, cresta naranja y lengua azul. */
  | 'ave'
  /** Disco café lleno de semillas y una corona de pétalos amarillos. */
  | 'girasol'
  /** Una bola de estrellitas de cera: flor de cera. */
  | 'umbela';
export type TipoFruto =
  | 'esfera'
  | 'chile'
  | 'pera'
  /** Rosa, con escamas de punta verde. */
  | 'pitahaya'
  /** Racimo de plátanos con su bellota morada al final. */
  | 'racimo';

export interface FormaEspecie {
  porte: Porte;
  hoja: {
    tipo: TipoHoja;
    /** Largo relativo al alto de la planta (0-1). */
    largo: number;
    /** Ancho relativo a su largo. */
    ancho: number;
    /** Qué tan doblada va por la vena: 0 plana, 0.4 canal hondo (sábila). */
    pliegue: number;
    /** 0 mate, 1 muy brillante. */
    brillo: number;
    /** Qué tan erguida sale de fábrica, en grados desde la vertical. */
    inclinacion: number;
    /** Tendencia a arquearse aunque esté sana (cinta, helecho): 0-1. */
    arco: number;
  };
  patron: Patron;
  colores: {
    hoja: string;
    hojaOscura: string;
    /** Bandas, bordes, manchas o variegado. */
    acento?: string;
    tallo: string;
  };
  flor?: { tipo: TipoFlor; color: string; centro: string; tamano: number };
  fruto?: { tipo: TipoFruto; color: string; tamano: number };
  /** Para columnas y bolas: cuántas costillas. */
  costillas?: number;
  /** Para caña: qué tramo de arriba lleva hojas (0.15 penacho, 0.6 a lo largo). */
  reparto?: number;
  /** Para remos: qué parte del alto es falso tronco (0 = las hojas salen del suelo). */
  tronco?: number;
  /** Las flores salen en varas largas por encima del follaje: lavanda. */
  varas?: boolean;
  /** Frondas de palma (paradas, con pecíolo pelón), no de helecho: camedor, areca, cica. */
  palmera?: boolean;
}

const F: Record<string, FormaEspecie> = {
  'lophocereus-schottii': {
    porte: 'columnas',
    hoja: { tipo: 'espada', largo: 1, ancho: 0.18, pliegue: 0, brillo: 0.15, inclinacion: 6, arco: 0 },
    patron: 'liso',
    colores: { hoja: '#5F8F52', hojaOscura: '#3E6A38', acento: '#D8CFB0', tallo: '#5F8F52' },
    flor: { tipo: 'estrella', color: '#F3C9D6', centro: '#F7E7A1', tamano: 0.07 },
    fruto: { tipo: 'esfera', color: '#D7404A', tamano: 0.05 },
    costillas: 7,
  },
  'opuntia-ficus-indica': {
    porte: 'pencas',
    hoja: { tipo: 'pala', largo: 0.42, ancho: 0.62, pliegue: 0, brillo: 0.2, inclinacion: 10, arco: 0 },
    patron: 'manchas',
    colores: { hoja: '#6E9F55', hojaOscura: '#4C7C3C', acento: '#E4DAB0', tallo: '#6E9F55' },
    flor: { tipo: 'copa', color: '#F6CE33', centro: '#C9A227', tamano: 0.08 },
    fruto: { tipo: 'pera', color: '#C4406E', tamano: 0.06 },
  },
  'aloe-vera': {
    porte: 'roseta',
    hoja: { tipo: 'penca', largo: 0.8, ancho: 0.3, pliegue: 0.22, brillo: 0.25, inclinacion: 24, arco: 0.12 },
    patron: 'manchas',
    colores: { hoja: '#8BAE7C', hojaOscura: '#5F8756', acento: '#D2E0C3', tallo: '#6E9163' },
    flor: { tipo: 'espiga', color: '#F2A93B', centro: '#E0892A', tamano: 0.05 },
  },
  'monstera-deliciosa': {
    porte: 'monstera',
    hoja: { tipo: 'monstera', largo: 0.5, ancho: 0.95, pliegue: 0.08, brillo: 0.6, inclinacion: 30, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#23803F', hojaOscura: '#16602D', tallo: '#3F8A3E' },
  },
  'epipremnum-aureum': {
    porte: 'trepadora',
    hoja: { tipo: 'corazon', largo: 0.2, ancho: 0.72, pliegue: 0.1, brillo: 0.55, inclinacion: 60, arco: 0.4 },
    patron: 'variegado',
    colores: { hoja: '#3F9A46', hojaOscura: '#2A7434', acento: '#E6D56A', tallo: '#5E9E4A' },
  },
  'dracaena-trifasciata': {
    porte: 'roseta',
    hoja: { tipo: 'espada', largo: 0.95, ancho: 0.13, pliegue: 0.12, brillo: 0.35, inclinacion: 9, arco: 0.04 },
    patron: 'bandas',
    colores: { hoja: '#3F6D3B', hojaOscura: '#203F24', acento: '#9CBC86', tallo: '#3F6D3B' },
  },
  'citrus-limon': {
    porte: 'arbol',
    hoja: { tipo: 'ovalada', largo: 0.14, ancho: 0.45, pliegue: 0.1, brillo: 0.7, inclinacion: 60, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#2F7D34', hojaOscura: '#1F5E25', tallo: '#7A6048' },
    flor: { tipo: 'estrella', color: '#FFFFFF', centro: '#F5E28A', tamano: 0.04 },
    fruto: { tipo: 'esfera', color: '#F2D23C', tamano: 0.065 },
  },
  'bougainvillea-glabra': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.13, ancho: 0.55, pliegue: 0.06, brillo: 0.3, inclinacion: 55, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#3E8A3A', hojaOscura: '#2A6A2A', tallo: '#6E5A45' },
    flor: { tipo: 'bractea', color: '#D2277E', centro: '#F4F0E6', tamano: 0.07 },
  },
  'ocimum-basilicum': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.2, ancho: 0.58, pliegue: 0.22, brillo: 0.45, inclinacion: 62, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4DAE4E', hojaOscura: '#2F8235', tallo: '#6FA255' },
    flor: { tipo: 'espiga', color: '#FFFFFF', centro: '#E8E2F5', tamano: 0.035 },
  },
  'nephrolepis-exaltata': {
    porte: 'fronda',
    hoja: { tipo: 'foliolo', largo: 0.9, ancho: 0.1, pliegue: 0.05, brillo: 0.2, inclinacion: 34, arco: 0.42 },
    patron: 'liso',
    colores: { hoja: '#5DAE4B', hojaOscura: '#3B8A34', tallo: '#4E8D3C' },
  },
  'hibiscus-rosa-sinensis': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.16, ancho: 0.62, pliegue: 0.1, brillo: 0.65, inclinacion: 55, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#2E7D32', hojaOscura: '#1E5B23', tallo: '#6A5642' },
    flor: { tipo: 'copa', color: '#E3333A', centro: '#F7D64A', tamano: 0.12 },
  },
  'jasminum-sambac': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.13, ancho: 0.6, pliegue: 0.12, brillo: 0.5, inclinacion: 58, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#3C8C3C', hojaOscura: '#276A2B', tallo: '#6B7B4A' },
    flor: { tipo: 'rosa', color: '#FFFFFF', centro: '#F4F1DE', tamano: 0.05 },
  },
  'rosa-hybrida': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.12, ancho: 0.6, pliegue: 0.1, brillo: 0.45, inclinacion: 55, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#3B7D34', hojaOscura: '#285C24', tallo: '#4F6B34' },
    flor: { tipo: 'rosa', color: '#E0415C', centro: '#B82843', tamano: 0.09 },
  },
  'ficus-benjamina': {
    porte: 'arbol',
    hoja: { tipo: 'lanceolada', largo: 0.13, ancho: 0.42, pliegue: 0.08, brillo: 0.7, inclinacion: 70, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#3F8E3A', hojaOscura: '#276B28', tallo: '#8A7358' },
  },
  'nymphaea-mexicana': {
    porte: 'flotante',
    hoja: { tipo: 'redonda', largo: 0.36, ancho: 1, pliegue: 0, brillo: 0.5, inclinacion: 88, arco: 0 },
    patron: 'liso',
    colores: { hoja: '#4F9A3F', hojaOscura: '#3A7A2F', tallo: '#4F9A3F' },
    flor: { tipo: 'nenufar', color: '#F7DC4A', centro: '#E8A92A', tamano: 0.11 },
  },
  'zamioculcas-zamiifolia': {
    porte: 'zz',
    hoja: { tipo: 'foliolo', largo: 0.85, ancho: 0.42, pliegue: 0.05, brillo: 0.85, inclinacion: 18, arco: 0.12 },
    patron: 'liso',
    colores: { hoja: '#2A6B2E', hojaOscura: '#1A4D20', tallo: '#4C7A3A' },
  },
  'chlorophytum-comosum': {
    porte: 'roseta',
    hoja: { tipo: 'cinta', largo: 0.8, ancho: 0.1, pliegue: 0.1, brillo: 0.35, inclinacion: 32, arco: 0.6 },
    patron: 'franja',
    colores: { hoja: '#4E9E47', hojaOscura: '#357A33', acento: '#F1F3DC', tallo: '#6FAE5C' },
    flor: { tipo: 'estrella', color: '#FFFFFF', centro: '#F2EFC8', tamano: 0.035 },
  },
  'spathiphyllum-wallisii': {
    porte: 'roseta',
    hoja: { tipo: 'lanceolada', largo: 0.8, ancho: 0.34, pliegue: 0.12, brillo: 0.65, inclinacion: 30, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#2B6E35', hojaOscura: '#1B5225', tallo: '#3C7F3F' },
    flor: { tipo: 'espata', color: '#F8F8F1', centro: '#EDE3B8', tamano: 0.12 },
  },
  'echeveria-elegans': {
    porte: 'roseta',
    hoja: { tipo: 'penca', largo: 0.44, ancho: 0.5, pliegue: 0.28, brillo: 0.2, inclinacion: 60, arco: 0.05 },
    patron: 'bordes',
    colores: { hoja: '#93BBAA', hojaOscura: '#6E9A8A', acento: '#E6A7B4', tallo: '#93BBAA' },
    flor: { tipo: 'espiga', color: '#F08A6E', centro: '#F6C046', tamano: 0.035 },
  },
  'sedum-morganianum': {
    porte: 'colgante',
    hoja: { tipo: 'penca', largo: 0.06, ancho: 0.55, pliegue: 0.3, brillo: 0.25, inclinacion: 90, arco: 0.9 },
    patron: 'liso',
    colores: { hoja: '#86B99F', hojaOscura: '#5F9478', tallo: '#86B99F' },
  },
  'crassula-ovata': {
    porte: 'arbol',
    hoja: { tipo: 'ovalada', largo: 0.1, ancho: 0.62, pliegue: 0.2, brillo: 0.55, inclinacion: 45, arco: 0 },
    patron: 'bordes',
    colores: { hoja: '#4F8F4A', hojaOscura: '#356B33', acento: '#C4504B', tallo: '#6F7E55' },
  },
  'agave-americana': {
    porte: 'roseta',
    hoja: { tipo: 'penca', largo: 0.85, ancho: 0.28, pliegue: 0.3, brillo: 0.2, inclinacion: 40, arco: 0.15 },
    patron: 'bordes',
    colores: { hoja: '#7FA1A6', hojaOscura: '#5A7E84', acento: '#DCD29E', tallo: '#7FA1A6' },
  },
  'beaucarnea-recurvata': {
    porte: 'palma',
    hoja: { tipo: 'cinta', largo: 0.62, ancho: 0.05, pliegue: 0.05, brillo: 0.3, inclinacion: 45, arco: 0.8 },
    patron: 'liso',
    colores: { hoja: '#4F8F4A', hojaOscura: '#356B33', tallo: '#8C7155' },
  },
  'euphorbia-pulcherrima': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.17, ancho: 0.55, pliegue: 0.1, brillo: 0.35, inclinacion: 55, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#2F6B2F', hojaOscura: '#1F4E21', tallo: '#5E6B3E' },
    flor: { tipo: 'bractea', color: '#D4202B', centro: '#F2D04A', tamano: 0.12 },
  },
  'tagetes-erecta': {
    porte: 'mata',
    hoja: { tipo: 'foliolo', largo: 0.16, ancho: 0.3, pliegue: 0.05, brillo: 0.25, inclinacion: 50, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#3E7F35', hojaOscura: '#2A5E25', tallo: '#577F3A' },
    flor: { tipo: 'pompon', color: '#F59A1C', centro: '#E27A10', tamano: 0.09 },
  },
  'salvia-rosmarinus': {
    porte: 'mata',
    hoja: { tipo: 'aguja', largo: 0.07, ancho: 0.14, pliegue: 0.1, brillo: 0.3, inclinacion: 60, arco: 0.1 },
    patron: 'liso',
    colores: { hoja: '#557F5A', hojaOscura: '#3A5E40', tallo: '#6E6A4E' },
    flor: { tipo: 'estrella', color: '#9AAEE8', centro: '#7A8AD0', tamano: 0.025 },
  },
  'mentha-spicata': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.14, ancho: 0.6, pliegue: 0.18, brillo: 0.3, inclinacion: 62, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4FAB55', hojaOscura: '#347F3B', tallo: '#6E9A58' },
    flor: { tipo: 'espiga', color: '#E6D2F0', centro: '#C9A9DC', tamano: 0.03 },
  },
  'coriandrum-sativum': {
    porte: 'mata',
    hoja: { tipo: 'foliolo', largo: 0.14, ancho: 0.7, pliegue: 0.05, brillo: 0.3, inclinacion: 55, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#4FA84A', hojaOscura: '#347D33', tallo: '#7DAF5E' },
    flor: { tipo: 'estrella', color: '#FFFFFF', centro: '#F2E8F2', tamano: 0.025 },
  },
  'capsicum-annuum': {
    porte: 'arbusto',
    hoja: { tipo: 'lanceolada', largo: 0.15, ancho: 0.4, pliegue: 0.1, brillo: 0.5, inclinacion: 55, arco: 0.25 },
    patron: 'liso',
    colores: { hoja: '#2F7D32', hojaOscura: '#1F5B24', tallo: '#4E7A3A' },
    flor: { tipo: 'estrella', color: '#FFFFFF', centro: '#F2E38A', tamano: 0.03 },
    fruto: { tipo: 'chile', color: '#D8302E', tamano: 0.09 },
  },
  'persea-americana': {
    porte: 'arbol',
    hoja: { tipo: 'lanceolada', largo: 0.2, ancho: 0.42, pliegue: 0.08, brillo: 0.45, inclinacion: 60, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#2E6B2E', hojaOscura: '#1E4F20', tallo: '#7A6048' },
    flor: { tipo: 'estrella', color: '#E9EFB5', centro: '#D8DF8E', tamano: 0.025 },
    fruto: { tipo: 'pera', color: '#3B5E2B', tamano: 0.08 },
  },
  'ficus-elastica': {
    porte: 'cana',
    hoja: { tipo: 'ovalada', largo: 0.3, ancho: 0.5, pliegue: 0.06, brillo: 0.85, inclinacion: 58, arco: 0.12 },
    patron: 'liso',
    colores: { hoja: '#24552E', hojaOscura: '#12361C', tallo: '#6A7A4A' },
    reparto: 0.7,
  },
  'dracaena-fragrans': {
    porte: 'cana',
    hoja: { tipo: 'cinta', largo: 0.52, ancho: 0.13, pliegue: 0.08, brillo: 0.45, inclinacion: 42, arco: 0.45 },
    patron: 'franja',
    colores: { hoja: '#3E7A36', hojaOscura: '#285A25', acento: '#C9CF62', tallo: '#6E8A45' },
    reparto: 0.18,
  },
  'chamaedorea-elegans': {
    porte: 'fronda',
    hoja: { tipo: 'foliolo', largo: 0.85, ancho: 0.2, pliegue: 0.05, brillo: 0.35, inclinacion: 28, arco: 0.5 },
    patron: 'liso',
    colores: { hoja: '#3C8A3E', hojaOscura: '#28692C', tallo: '#4E8A3E' },
    flor: { tipo: 'espiga', color: '#F2B233', centro: '#E08A1A', tamano: 0.03 },
    palmera: true,
  },
  'dypsis-lutescens': {
    porte: 'fronda',
    hoja: { tipo: 'foliolo', largo: 1, ancho: 0.12, pliegue: 0.05, brillo: 0.4, inclinacion: 18, arco: 0.4 },
    patron: 'liso',
    colores: { hoja: '#5A9E45', hojaOscura: '#3E7F33', tallo: '#B5AE4A' },
    palmera: true,
  },
  'pelargonium-hortorum': {
    porte: 'mata',
    hoja: { tipo: 'redonda', largo: 0.17, ancho: 0.95, pliegue: 0.15, brillo: 0.25, inclinacion: 60, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4E8E3A', hojaOscura: '#33682A', tallo: '#6E8A45' },
    flor: { tipo: 'pompon', color: '#E8384F', centro: '#C42A3E', tamano: 0.085 },
  },
  'kalanchoe-blossfeldiana': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.24, ancho: 0.78, pliegue: 0.18, brillo: 0.65, inclinacion: 52, arco: 0.1 },
    patron: 'bordes',
    colores: { hoja: '#3E7F3A', hojaOscura: '#2A5E28', acento: '#9A3A3A', tallo: '#5E8A45' },
    flor: { tipo: 'pompon', color: '#F2643A', centro: '#E0482A', tamano: 0.06 },
  },
  phalaenopsis: {
    porte: 'roseta',
    hoja: { tipo: 'ovalada', largo: 0.32, ancho: 0.42, pliegue: 0.14, brillo: 0.65, inclinacion: 74, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#3E7A3A', hojaOscura: '#285A28', tallo: '#4E6A3A' },
    flor: { tipo: 'mariposa', color: '#F8D6E8', centro: '#C8307A', tamano: 0.075 },
  },
  'anthurium-andraeanum': {
    porte: 'monstera',
    hoja: { tipo: 'corazon', largo: 0.36, ancho: 0.62, pliegue: 0.1, brillo: 0.78, inclinacion: 35, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#1F6A34', hojaOscura: '#124A22', tallo: '#3F7A3A' },
    flor: { tipo: 'espata', color: '#D8202E', centro: '#F2D04A', tamano: 0.1 },
  },
  'tradescantia-zebrina': {
    porte: 'trepadora',
    hoja: { tipo: 'ovalada', largo: 0.16, ancho: 0.52, pliegue: 0.12, brillo: 0.5, inclinacion: 60, arco: 0.45 },
    patron: 'franja',
    colores: { hoja: '#5E5A86', hojaOscura: '#3B2E5A', acento: '#D8D6EA', tallo: '#7A4E86' },
  },
  'dieffenbachia-seguine': {
    porte: 'cana',
    hoja: { tipo: 'lanceolada', largo: 0.42, ancho: 0.44, pliegue: 0.1, brillo: 0.5, inclinacion: 48, arco: 0.3 },
    patron: 'manchas',
    colores: { hoja: '#3F7F3A', hojaOscura: '#285E28', acento: '#E4ECC4', tallo: '#7A9A5A' },
    reparto: 0.4,
  },
  'syngonium-podophyllum': {
    porte: 'monstera',
    hoja: { tipo: 'corazon', largo: 0.3, ancho: 0.62, pliegue: 0.08, brillo: 0.5, inclinacion: 40, arco: 0.35 },
    patron: 'variegado',
    colores: { hoja: '#4E8E45', hojaOscura: '#326B30', acento: '#DDEBCB', tallo: '#6E9E5A' },
  },
  'philodendron-hederaceum': {
    porte: 'trepadora',
    hoja: { tipo: 'corazon', largo: 0.19, ancho: 0.76, pliegue: 0.08, brillo: 0.62, inclinacion: 62, arco: 0.4 },
    patron: 'liso',
    colores: { hoja: '#2F8A3A', hojaOscura: '#1E6A2A', tallo: '#5E8E45' },
  },
  'codiaeum-variegatum': {
    porte: 'arbusto',
    hoja: { tipo: 'lanceolada', largo: 0.2, ancho: 0.36, pliegue: 0.1, brillo: 0.82, inclinacion: 55, arco: 0.2 },
    patron: 'manchas',
    colores: { hoja: '#3E6B2E', hojaOscura: '#8A2A2A', acento: '#EAB02A', tallo: '#6A5A3A' },
  },
  'coleus-scutellarioides': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.19, ancho: 0.7, pliegue: 0.15, brillo: 0.3, inclinacion: 58, arco: 0.2 },
    patron: 'bordes',
    colores: { hoja: '#8E2A5A', hojaOscura: '#5E1A3A', acento: '#A8C83A', tallo: '#8A4A5A' },
    flor: { tipo: 'espiga', color: '#8C7AC8', centro: '#6A5AAA', tamano: 0.03 },
  },
  'schefflera-arboricola': {
    porte: 'arbol',
    hoja: { tipo: 'ovalada', largo: 0.12, ancho: 0.45, pliegue: 0.08, brillo: 0.78, inclinacion: 60, arco: 0.25 },
    patron: 'liso',
    colores: { hoja: '#2F7A2F', hojaOscura: '#1E5A20', tallo: '#7A8A5A' },
  },
  'aglaonema-commutatum': {
    porte: 'monstera',
    hoja: { tipo: 'lanceolada', largo: 0.42, ancho: 0.52, pliegue: 0.1, brillo: 0.45, inclinacion: 28, arco: 0.25 },
    patron: 'manchas',
    colores: { hoja: '#3E6F4A', hojaOscura: '#264F32', acento: '#C9D8C4', tallo: '#6E8A5A' },
  },
  'catharanthus-roseus': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.14, ancho: 0.45, pliegue: 0.1, brillo: 0.72, inclinacion: 58, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#2F7A34', hojaOscura: '#1E5A24', tallo: '#5E7A45' },
    flor: { tipo: 'estrella', color: '#F07AAE', centro: '#C8325F', tamano: 0.05 },
  },
  'portulaca-grandiflora': {
    porte: 'mata',
    hoja: { tipo: 'aguja', largo: 0.08, ancho: 0.28, pliegue: 0.2, brillo: 0.45, inclinacion: 70, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#6FAE4A', hojaOscura: '#4E8A35', tallo: '#A04A4A' },
    flor: { tipo: 'rosa', color: '#F24A7A', centro: '#F7C33A', tamano: 0.055 },
  },
  'solanum-lycopersicum': {
    porte: 'arbusto',
    hoja: { tipo: 'foliolo', largo: 0.2, ancho: 0.45, pliegue: 0.08, brillo: 0.3, inclinacion: 58, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#3E8A3A', hojaOscura: '#2A6A2A', tallo: '#5E8A45' },
    flor: { tipo: 'estrella', color: '#F4D84A', centro: '#E8B42A', tamano: 0.03 },
    fruto: { tipo: 'esfera', color: '#D8352A', tamano: 0.075 },
  },
  'cycas-revoluta': {
    porte: 'fronda',
    hoja: { tipo: 'foliolo', largo: 0.7, ancho: 0.08, pliegue: 0.05, brillo: 0.7, inclinacion: 48, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#2F5E2A', hojaOscura: '#1E4420', tallo: '#6A5A3A' },
    palmera: true,
    tronco: 0.18,
  },
  'euphorbia-milii': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.1, ancho: 0.5, pliegue: 0.1, brillo: 0.5, inclinacion: 55, arco: 0.1 },
    patron: 'liso',
    colores: { hoja: '#4E8A3A', hojaOscura: '#33682A', tallo: '#5E5A50' },
    flor: { tipo: 'bractea', color: '#E0303A', centro: '#F2D04A', tamano: 0.045 },
  },
  'nerium-oleander': {
    porte: 'arbusto',
    hoja: { tipo: 'lanceolada', largo: 0.22, ancho: 0.2, pliegue: 0.1, brillo: 0.35, inclinacion: 38, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#3E6E3A', hojaOscura: '#285028', tallo: '#6E7A55' },
    flor: { tipo: 'estrella', color: '#F28AB0', centro: '#F7D0DF', tamano: 0.06 },
  },
  mammillaria: {
    porte: 'bola',
    hoja: { tipo: 'espada', largo: 0.3, ancho: 0.2, pliegue: 0, brillo: 0.15, inclinacion: 0, arco: 0 },
    patron: 'liso',
    colores: { hoja: '#5E8F5A', hojaOscura: '#3E6A3C', acento: '#F4F1E6', tallo: '#5E8F5A' },
    flor: { tipo: 'estrella', color: '#E8559A', centro: '#F7D0E4', tamano: 0.03 },
    fruto: { tipo: 'chile', color: '#D8302E', tamano: 0.025 },
    costillas: 13,
  },
  'tradescantia-spathacea': {
    porte: 'roseta',
    hoja: { tipo: 'lanceolada', largo: 0.62, ancho: 0.2, pliegue: 0.16, brillo: 0.5, inclinacion: 36, arco: 0.2 },
    patron: 'bordes',
    colores: { hoja: '#3E5E3A', hojaOscura: '#283E26', acento: '#8A3A8A', tallo: '#6A3A6A' },
    flor: { tipo: 'espata', color: '#7A3A7A', centro: '#F4F1E6', tamano: 0.05 },
  },
  'mangifera-indica': {
    porte: 'arbol',
    hoja: { tipo: 'lanceolada', largo: 0.2, ancho: 0.26, pliegue: 0.08, brillo: 0.6, inclinacion: 62, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#2A5E2A', hojaOscura: '#1A421C', tallo: '#6B5040' },
    flor: { tipo: 'espiga', color: '#E9E3B0', centro: '#D8C98A', tamano: 0.03 },
    fruto: { tipo: 'pera', color: '#F2A02A', tamano: 0.08 },
  },
  'plumeria-rubra': {
    porte: 'arbol',
    hoja: { tipo: 'lanceolada', largo: 0.24, ancho: 0.3, pliegue: 0.1, brillo: 0.5, inclinacion: 45, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#3E7A3A', hojaOscura: '#285A28', tallo: '#8A8070' },
    flor: { tipo: 'estrella', color: '#FFFFFF', centro: '#F6D13A', tamano: 0.07 },
  },
  'selenicereus-undatus': {
    porte: 'poste',
    hoja: { tipo: 'espada', largo: 0.5, ancho: 0.12, pliegue: 0, brillo: 0.25, inclinacion: 10, arco: 0.6 },
    patron: 'liso',
    colores: { hoja: '#5E9E4C', hojaOscura: '#3B7433', acento: '#C9C2A0', tallo: '#8C6A48' },
    flor: { tipo: 'reina', color: '#FBF8EE', centro: '#F2E6A2', tamano: 0.13 },
    fruto: { tipo: 'pitahaya', color: '#E2336E', tamano: 0.095 },
    costillas: 3,
  },
  'ficus-lyrata': {
    porte: 'cana',
    hoja: { tipo: 'violin', largo: 0.34, ancho: 0.66, pliegue: 0.12, brillo: 0.62, inclinacion: 50, arco: 0.1 },
    patron: 'liso',
    colores: { hoja: '#3E7C35', hojaOscura: '#275C22', tallo: '#8C8668' },
    reparto: 0.72,
  },
  'strelitzia-reginae': {
    porte: 'remos',
    hoja: { tipo: 'remo', largo: 0.44, ancho: 0.3, pliegue: 0.14, brillo: 0.3, inclinacion: 20, arco: 0.1 },
    patron: 'liso',
    colores: { hoja: '#55907A', hojaOscura: '#386A56', tallo: '#6A9478' },
    flor: { tipo: 'ave', color: '#F58A1F', centro: '#3552C8', tamano: 0.1 },
  },
  lavandula: {
    porte: 'mata',
    hoja: { tipo: 'aguja', largo: 0.12, ancho: 0.12, pliegue: 0.1, brillo: 0.12, inclinacion: 38, arco: 0.1 },
    patron: 'liso',
    colores: { hoja: '#93AE98', hojaOscura: '#6B8872', tallo: '#809070' },
    flor: { tipo: 'espiga', color: '#8A6CC9', centro: '#6C4FB0', tamano: 0.04 },
    varas: true,
  },
  'cymbopogon-citratus': {
    porte: 'roseta',
    hoja: { tipo: 'cinta', largo: 0.98, ancho: 0.045, pliegue: 0.18, brillo: 0.3, inclinacion: 16, arco: 0.6 },
    patron: 'liso',
    colores: { hoja: '#84B25C', hojaOscura: '#5C8C40', tallo: '#D8D4B0' },
  },
  'ruta-graveolens': {
    porte: 'mata',
    hoja: { tipo: 'foliolo', largo: 0.1, ancho: 0.6, pliegue: 0.06, brillo: 0.12, inclinacion: 50, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#84A894', hojaOscura: '#5C806C', tallo: '#7C8C6A' },
    flor: { tipo: 'estrella', color: '#E9D64C', centro: '#C9B02A', tamano: 0.03 },
  },
  'echinocactus-grusonii': {
    porte: 'bola',
    hoja: { tipo: 'espada', largo: 0.3, ancho: 0.2, pliegue: 0, brillo: 0.15, inclinacion: 0, arco: 0 },
    patron: 'liso',
    colores: { hoja: '#4C8A48', hojaOscura: '#2E6630', acento: '#EAC24C', tallo: '#4C8A48' },
    flor: { tipo: 'estrella', color: '#F4D03C', centro: '#D8A62A', tamano: 0.03 },
    costillas: 22,
  },
  'pilea-peperomioides': {
    porte: 'sombrillas',
    hoja: { tipo: 'redonda', largo: 0.2, ancho: 1, pliegue: 0.05, brillo: 0.5, inclinacion: 60, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4E9C46', hojaOscura: '#357A33', tallo: '#7A9C5A' },
  },
  'dracaena-marginata': {
    porte: 'cana',
    hoja: { tipo: 'cinta', largo: 0.42, ancho: 0.07, pliegue: 0.05, brillo: 0.4, inclinacion: 40, arco: 0.3 },
    patron: 'bordes',
    colores: { hoja: '#3F6F3A', hojaOscura: '#294E27', acento: '#A8323E', tallo: '#8A7A62' },
    reparto: 0.14,
  },
  'helianthus-annuus': {
    porte: 'vara',
    hoja: { tipo: 'corazon', largo: 0.2, ancho: 0.8, pliegue: 0.1, brillo: 0.2, inclinacion: 62, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#4F8F3A', hojaOscura: '#33692A', tallo: '#6E8C45' },
    flor: { tipo: 'girasol', color: '#F6C51B', centro: '#5A3A1E', tamano: 0.14 },
  },
  'hoya-carnosa': {
    porte: 'trepadora',
    hoja: { tipo: 'ovalada', largo: 0.17, ancho: 0.5, pliegue: 0.16, brillo: 0.8, inclinacion: 55, arco: 0.35 },
    patron: 'liso',
    colores: { hoja: '#3E7A3E', hojaOscura: '#285A2A', tallo: '#7A6A55' },
    flor: { tipo: 'umbela', color: '#F6D8E0', centro: '#B0304A', tamano: 0.07 },
  },
  'gardenia-jasminoides': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.13, ancho: 0.45, pliegue: 0.14, brillo: 0.85, inclinacion: 55, arco: 0.15 },
    patron: 'liso',
    colores: { hoja: '#24602A', hojaOscura: '#16461C', tallo: '#6A6A4A' },
    flor: { tipo: 'rosa', color: '#FBF8EE', centro: '#F2EBC8', tamano: 0.08 },
  },
  'carica-papaya': {
    porte: 'papayo',
    hoja: { tipo: 'palmeada', largo: 0.34, ancho: 1, pliegue: 0.1, brillo: 0.35, inclinacion: 60, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#4E9A3E', hojaOscura: '#357A2E', tallo: '#A6A07A' },
    flor: { tipo: 'estrella', color: '#F8F3DA', centro: '#EEE3A0', tamano: 0.035 },
    fruto: { tipo: 'pera', color: '#EFA33A', tamano: 0.085 },
  },
  'psidium-guajava': {
    porte: 'arbol',
    hoja: { tipo: 'ovalada', largo: 0.14, ancho: 0.5, pliegue: 0.16, brillo: 0.3, inclinacion: 60, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4C8C3A', hojaOscura: '#2F6627', tallo: '#B98B63' },
    flor: { tipo: 'pompon', color: '#FFFFFF', centro: '#F2E9C0', tamano: 0.045 },
    fruto: { tipo: 'esfera', color: '#CAD65C', tamano: 0.06 },
  },
  musa: {
    porte: 'remos',
    hoja: { tipo: 'remo', largo: 0.62, ancho: 0.34, pliegue: 0.08, brillo: 0.3, inclinacion: 38, arco: 0.4 },
    patron: 'liso',
    colores: { hoja: '#6CAE4A', hojaOscura: '#4A8A35', tallo: '#7E9C58' },
    fruto: { tipo: 'racimo', color: '#A4C44C', tamano: 0.07 },
    tronco: 0.5,
  },
  'generica-suculenta': {
    porte: 'roseta',
    hoja: { tipo: 'penca', largo: 0.36, ancho: 0.48, pliegue: 0.26, brillo: 0.2, inclinacion: 44, arco: 0.05 },
    patron: 'liso',
    colores: { hoja: '#86AE8A', hojaOscura: '#5E8A66', tallo: '#86AE8A' },
  },
  'generica-interior': {
    porte: 'monstera',
    hoja: { tipo: 'lanceolada', largo: 0.4, ancho: 0.45, pliegue: 0.1, brillo: 0.55, inclinacion: 38, arco: 0.3 },
    patron: 'liso',
    colores: { hoja: '#2F7A3A', hojaOscura: '#1E5A28', tallo: '#5E8A45' },
  },
  'generica-flor': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.16, ancho: 0.55, pliegue: 0.12, brillo: 0.35, inclinacion: 58, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#3F8A3E', hojaOscura: '#2A6A2A', tallo: '#5E8A45' },
    flor: { tipo: 'estrella', color: '#F2A0C0', centro: '#F2D04A', tamano: 0.05 },
  },
  'generica-huerto': {
    porte: 'mata',
    hoja: { tipo: 'ovalada', largo: 0.18, ancho: 0.58, pliegue: 0.2, brillo: 0.4, inclinacion: 60, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#4DAE4E', hojaOscura: '#2F8235', tallo: '#6FA255' },
  },
  'generica-arbusto': {
    porte: 'arbusto',
    hoja: { tipo: 'ovalada', largo: 0.14, ancho: 0.55, pliegue: 0.08, brillo: 0.45, inclinacion: 55, arco: 0.2 },
    patron: 'liso',
    colores: { hoja: '#3A7F36', hojaOscura: '#285E26', tallo: '#6E5A45' },
  },
};

/** Para especies que no estén aquí: una mata genérica, que es lo menos engañoso. */
const GENERICA: FormaEspecie = {
  porte: 'mata',
  hoja: { tipo: 'ovalada', largo: 0.18, ancho: 0.55, pliegue: 0.12, brillo: 0.4, inclinacion: 55, arco: 0.2 },
  patron: 'liso',
  colores: { hoja: '#3F9A46', hojaOscura: '#2A7434', tallo: '#5E8A44' },
};

export function formaDe(especieId: string): FormaEspecie {
  return F[especieId] ?? GENERICA;
}

/** Qué especies tienen forma propia. Para la prueba que cuida el catálogo. */
export function especiesConForma(): string[] {
  return Object.keys(F);
}

// ---------------------------------------------------------------------------
// Colores finales: especie + escaneo + estado
// ---------------------------------------------------------------------------

export interface Apariencia {
  hoja: string;
  hojaOscura: string;
  acento?: string;
  tallo: string;
  /** Color de la punta de la hoja: se tuesta con la sed. */
  punta: string;
  /** Hojas de abajo amarillas: pasa con el agua de más. */
  hojaVieja: string;
}

/**
 * Los colores con que se dibuja ESTA planta.
 *
 * Tres capas, en orden: el color de la especie; encima, el que se midió en la
 * foto del escaneo (si lo hay, manda: es SU verde); y encima, el estado de hoy.
 * La sed amarillea y tuesta las puntas; el agua de más apaga el verde y
 * amarillea las hojas viejas de abajo. Así el color dice lo mismo que la
 * postura, y se nota aunque no leas nada.
 */
export function aparienciaDe(
  forma: FormaEspecie,
  morfologia: Pick<Morfologia, 'senal' | 'vigor'>,
  observada?: AparienciaObservada,
): Apariencia {
  const base = {
    hoja: observada?.hoja ?? forma.colores.hoja,
    hojaOscura: observada?.hojaOscura ?? forma.colores.hojaOscura,
    acento: observada?.acento ?? forma.colores.acento,
    tallo: forma.colores.tallo,
  };
  const vigor = Number.isFinite(morfologia.vigor) ? Math.max(0, Math.min(1, morfologia.vigor)) : 1;
  // Poco vigor = color lavado. Nunca del todo: una planta en crisis sigue siendo verde.
  const lavar = (c: string) => mezclar(c, '#9A9A7A', (1 - vigor) * 0.35);

  let hoja = lavar(base.hoja);
  let hojaOscura = lavar(base.hojaOscura);
  let punta = hoja;
  let hojaVieja = hojaOscura;

  if (morfologia.senal === 'sed') {
    hoja = mezclar(hoja, '#C9A23A', 0.3);
    hojaOscura = mezclar(hojaOscura, '#9A7A2A', 0.25);
    punta = mezclar(hoja, '#9C6B33', 0.65);
    hojaVieja = mezclar(hojaOscura, '#B8913A', 0.5);
  } else if (morfologia.senal === 'ahogo') {
    hoja = mezclar(hoja, '#7FA7A0', 0.25);
    hojaOscura = mezclar(hojaOscura, '#557F7A', 0.2);
    punta = hoja;
    hojaVieja = mezclar(hoja, '#D9C24A', 0.55);
  }

  return { hoja, hojaOscura, acento: base.acento, tallo: base.tallo, punta, hojaVieja };
}

// ---------------------------------------------------------------------------

export function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbAHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mezcla dos colores: t = 0 da el primero, 1 el segundo. */
export function mezclar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexARgb(a);
  const [r2, g2, b2] = hexARgb(b);
  const k = Math.max(0, Math.min(1, t));
  return rgbAHex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
}

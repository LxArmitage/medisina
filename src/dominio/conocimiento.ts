/**
 * Lo que se sabe de cada especie, más allá del agua.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. El asistente contestaba "de eso no sé" a casi
 * todo, y no era culpa del modelo de lenguaje: era que la app no TENÍA la
 * respuesta. El catálogo guarda los números que alimentan el balance hídrico
 * —Kc, agua útil, umbral de estrés— y nada más. Así que cualquier pregunta que
 * no fuera de riego se quedaba sin datos con los que contestar.
 *
 * Aquí van los hechos que la gente pregunta de verdad: si es tóxica para el
 * gato, cómo sacarle un esqueje, si aguanta el frío de enero, qué plaga le
 * pega, cuándo podarla. Hacerla más lista no era entrenar más; era darle más
 * cosas ciertas que decir.
 *
 * Va aparte del catálogo a propósito: son dos cosas con ritmos distintos. Los
 * parámetros del modelo se ajustan midiendo; estos hechos se corrigen leyendo.
 *
 * REGLA DE CONTENIDO: nada de usos medicinales para personas. La app no es un
 * consejo de salud y hay una verificación que lo bloquea. Que una planta sea
 * comestible sí se dice, porque es un dato de cultivo.
 */

import type { Especie } from './tipos';

/** A quién le hace daño y por qué. */
export interface Toxicidad {
  /** Lo que importa a quien tiene perro o gato en casa. */
  mascotas: 'toxica' | 'irritante' | 'segura';
  personas: 'toxica' | 'irritante' | 'segura' | 'comestible';
  /** La sustancia o la parte, en una frase. Sin esto, "tóxica" no enseña nada. */
  detalle: string;
}

export type Dificultad = 'facil' | 'media' | 'dificil';

export interface Propagacion {
  metodo: string;
  /** Cuándo conviene intentarlo. */
  cuando: string;
  dificultad: Dificultad;
}

export interface ConocimientoEspecie {
  origen: string;
  toxicidad: Toxicidad;
  propagacion: Propagacion;
  /** Qué podar y cuándo. En plantas que no se podan, se dice también. */
  poda: string;
  /** Rango en el que vive. Por debajo del mínimo hay daño por frío. */
  temperaturaMinC: number;
  temperaturaMaxC: number;
  /** Ambiente que prefiere. En casa mexicana casi todo es "media" o "seca". */
  humedad: 'seca' | 'media' | 'alta';
  /** Las plagas que de verdad le salen a ESTA especie. */
  plagas: string[];
  trasplanteCadaAnos: number;
  sustrato: string;
}

// ---------------------------------------------------------------------------

const SIN_DATOS: ConocimientoEspecie = {
  origen: 'no registrado',
  toxicidad: {
    mascotas: 'irritante',
    personas: 'irritante',
    detalle:
      'no tengo su toxicidad registrada, así que trátala como si lo fuera: fuera del alcance de mascotas y niños',
  },
  propagacion: {
    metodo: 'no registrado',
    cuando: 'no registrado',
    dificultad: 'media',
  },
  poda: 'no tengo su poda registrada',
  temperaturaMinC: 5,
  temperaturaMaxC: 38,
  humedad: 'media',
  plagas: [],
  trasplanteCadaAnos: 2,
  sustrato: 'no registrado',
};

/**
 * Por especie. Lo que no está aquí cae en `SIN_DATOS`, que dice que no sabe en
 * vez de inventar un promedio — un promedio de toxicidad no le sirve a nadie
 * que tenga un gato.
 */
const CONOCIMIENTO: Record<string, ConocimientoEspecie> = {
  'lophocereus-schottii': {
    origen: 'Sonora, Sinaloa y Baja California',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'su fruto rojo se come; las espinas son el único riesgo',
    },
    propagacion: {
      metodo: 'esqueje de columna: se corta un brazo, se deja cicatrizar una semana y se planta',
      cuando: 'primavera y verano, con calor',
      dificultad: 'facil',
    },
    poda: 'no se poda; sólo se quitan brazos dañados, y el corte debe secar al aire antes de nada',
    temperaturaMinC: -2,
    temperaturaMaxC: 48,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'escama'],
    trasplanteCadaAnos: 4,
    sustrato: 'mineral y muy drenante: arena gruesa, tezontle y poca materia orgánica',
  },

  'opuntia-ficus-indica': {
    origen: 'centro de México',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'comestible',
      detalle: 'las pencas tiernas y las tunas se comen; los ahuates se clavan y son el problema',
    },
    propagacion: {
      metodo: 'penca completa: se corta por la unión, cicatriza dos semanas y se entierra un tercio',
      cuando: 'de marzo a septiembre',
      dificultad: 'facil',
    },
    poda: 'se quitan pencas viejas o enfermas por la unión, nunca por la mitad',
    temperaturaMinC: -5,
    temperaturaMaxC: 50,
    humedad: 'seca',
    plagas: ['cochinilla del carmín', 'picudo del nopal'],
    trasplanteCadaAnos: 4,
    sustrato: 'arenoso, pobre y suelto; le hace daño la tierra rica',
  },

  'aloe-vera': {
    origen: 'península arábiga, naturalizada en México',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle:
        'el látex amarillo bajo la piel de la hoja es purgante y le hace daño a perros y gatos',
    },
    propagacion: {
      metodo: 'hijuelos: los brotes de la base se separan con raíz propia',
      cuando: 'todo el año, mejor en primavera',
      dificultad: 'facil',
    },
    poda: 'no se poda; se cortan hojas exteriores desde la base cuando se necesitan',
    temperaturaMinC: 2,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['cochinilla', 'pudrición por exceso de riego'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas: dos partes de mineral por una de orgánico',
  },

  'monstera-deliciosa': {
    origen: 'selvas del sur de México y Centroamérica',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle:
        'toda la planta lleva cristales de oxalato de calcio que queman la boca; sólo el fruto maduro es comestible',
    },
    propagacion: {
      metodo: 'esqueje de tallo con un nudo y su raíz aérea, en agua o directo a sustrato',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'se cortan hojas viejas al ras del tallo; las raíces aéreas no se cortan, se guían',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'alta',
    plagas: ['araña roja', 'cochinilla algodonosa', 'trips'],
    trasplanteCadaAnos: 2,
    sustrato: 'aireado con corteza, perlita y fibra de coco; no tierra sola',
  },

  'epipremnum-aureum': {
    origen: 'islas de la Polinesia; naturalizada en el trópico',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio en hojas y tallo: quema la boca de perros y gatos que la muerden',
    },
    propagacion: {
      metodo: 'esqueje de tallo con dos nudos, en agua; enraíza en dos semanas',
      cuando: 'todo el año en interior',
      dificultad: 'facil',
    },
    poda: 'se despunta para que engrose; los tallos pelones se cortan arriba de un nudo',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla algodonosa', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'suelto y con perlita; aguanta casi cualquier tierra con buen drenaje',
  },

  'dracaena-trifasciata': {
    origen: 'África occidental',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'saponinas: provocan vómito y babeo en perros y gatos',
    },
    propagacion: {
      metodo: 'división de mata con rizoma, o trozo de hoja enterrado un tercio',
      cuando: 'primavera; por hoja tarda meses',
      dificultad: 'facil',
    },
    poda: 'no se poda; se cortan hojas dañadas desde el rizoma, al ras',
    temperaturaMinC: 8,
    temperaturaMaxC: 40,
    humedad: 'seca',
    plagas: ['cochinilla', 'pudrición de rizoma'],
    trasplanteCadaAnos: 4,
    sustrato: 'de cactáceas; le queda bien estar apretada en la maceta',
  },

  'citrus-limon': {
    origen: 'Asia; cultivado en todo México',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'comestible',
      detalle: 'el fruto se come; los aceites de la cáscara y la hoja irritan a perros y gatos',
    },
    propagacion: {
      metodo: 'injerto sobre patrón, o esqueje semileñoso; de semilla sale distinto al padre',
      cuando: 'primavera',
      dificultad: 'dificil',
    },
    poda: 'después de cosechar: se quitan chupones, ramas cruzadas y todo lo que salga bajo el injerto',
    temperaturaMinC: -2,
    temperaturaMaxC: 42,
    humedad: 'media',
    plagas: ['minador de los cítricos', 'pulgón', 'mosca blanca', 'escama'],
    trasplanteCadaAnos: 3,
    sustrato: 'franco y drenante, ligeramente ácido',
  },

  'bougainvillea-glabra': {
    origen: 'Brasil; aclimatada en todo México',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'la savia irrita la piel y las espinas hacen heridas que se infectan fácil',
    },
    propagacion: {
      metodo: 'esqueje semileñoso de 15 cm con hormona de enraizado',
      cuando: 'primavera y principio de verano',
      dificultad: 'media',
    },
    poda: 'fuerte al terminar la floración: florece en madera nueva, así que podarla la hace florear más',
    temperaturaMinC: 0,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['gusano enrollador', 'pulgón', 'cochinilla'],
    trasplanteCadaAnos: 3,
    sustrato: 'pobre y drenante; en tierra rica da hoja y no flor',
  },

  'ocimum-basilicum': {
    origen: 'Asia tropical',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'hoja de cocina; segura para perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje en agua de un tallo sin flor, o semilla',
      cuando: 'de marzo a agosto',
      dificultad: 'facil',
    },
    poda: 'se despunta cada dos semanas y se le quitan las flores: en cuanto florea, la hoja amarga',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['mosca blanca', 'pulgón', 'mildiu'],
    trasplanteCadaAnos: 1,
    sustrato: 'rico en materia orgánica y que retenga algo de humedad',
  },

  'nephrolepis-exaltata': {
    origen: 'América tropical',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'de los pocos que no son tóxicos para perros ni gatos',
    },
    propagacion: {
      metodo: 'división de mata, o los estolones que echa por fuera de la maceta',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'se cortan frondas secas desde la base; no se despunta',
    temperaturaMinC: 8,
    temperaturaMaxC: 32,
    humedad: 'alta',
    plagas: ['cochinilla', 'araña roja cuando el aire está seco'],
    trasplanteCadaAnos: 2,
    sustrato: 'que retenga humedad: turba o fibra de coco con perlita',
  },

  'hibiscus-rosa-sinensis': {
    origen: 'Asia tropical',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'la flor se come y no es tóxica para mascotas',
    },
    propagacion: {
      metodo: 'esqueje de punta de 12 cm, en sustrato húmedo y con calor',
      cuando: 'de abril a agosto',
      dificultad: 'media',
    },
    poda: 'a final de invierno se acorta un tercio: florece en brotes del año',
    temperaturaMinC: 4,
    temperaturaMaxC: 42,
    humedad: 'media',
    plagas: ['mosca blanca', 'pulgón', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'franco, rico y con buen drenaje',
  },

  'jasminum-sambac': {
    origen: 'sur de Asia',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica; la flor se usa para perfumar té',
    },
    propagacion: {
      metodo: 'esqueje semileñoso o acodo de una rama baja',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'ligera después de cada oleada de flor, para que ramifique',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['pulgón', 'cochinilla', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'rico y drenante, ligeramente ácido',
  },

  'rosa-hybrida': {
    origen: 'híbrido de cultivo, sin origen silvestre único',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'los pétalos se comen; lo único que lastima son las espinas',
    },
    propagacion: {
      metodo: 'esqueje de tallo leñoso o injerto de yema',
      cuando: 'invierno para esqueje leñoso; verano para injerto',
      dificultad: 'media',
    },
    poda: 'fuerte en reposo, dejando de tres a cinco yemas por rama y cortando en diagonal sobre una yema hacia afuera',
    temperaturaMinC: -10,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['pulgón', 'oídio', 'mancha negra', 'araña roja'],
    trasplanteCadaAnos: 3,
    sustrato: 'franco arcilloso, rico y con buen drenaje',
  },

  'ficus-benjamina': {
    origen: 'sur y sureste de Asia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'el látex blanco irrita la piel y la boca de perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje de punta; se deja escurrir el látex antes de plantarlo',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'a final de invierno para darle forma; tira hoja si lo mueves de lugar, y eso no es poda ni enfermedad',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'mosca blanca'],
    trasplanteCadaAnos: 3,
    sustrato: 'franco con perlita; no le gusta el cambio de maceta seguido',
  },

  'nymphaea-mexicana': {
    origen: 'México y sur de Estados Unidos',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica; vive en agua y el riesgo ahí es otro',
    },
    propagacion: {
      metodo: 'división de rizoma con al menos un brote',
      cuando: 'primavera, cuando arranca el crecimiento',
      dificultad: 'media',
    },
    poda: 'se cortan hojas y flores marchitas al ras del rizoma para que no pudran el agua',
    temperaturaMinC: 4,
    temperaturaMaxC: 38,
    humedad: 'alta',
    plagas: ['pulgón del nenúfar', 'algas por exceso de sol'],
    trasplanteCadaAnos: 2,
    sustrato: 'tierra pesada de estanque, cubierta con grava para que no enturbie',
  },
  'zamioculcas-zamiifolia': {
    origen: 'África oriental',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'cristales de oxalato de calcio en toda la planta: irritan boca y garganta',
    },
    propagacion: {
      metodo: 'división de rizomas, o una hoja entera enterrada por la base',
      cuando: 'primavera o verano; por hoja tarda de tres a seis meses',
      dificultad: 'facil',
    },
    poda: 'no se poda; se cortan al ras los tallos que amarillean enteros',
    temperaturaMinC: 12,
    temperaturaMaxC: 38,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pudrición de rizoma'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas con un tercio de perlita; odia quedar húmeda',
  },
  'chlorophytum-comosum': {
    origen: 'Sudáfrica',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica; a los gatos les gusta mordisquearla y no les pasa nada',
    },
    propagacion: {
      metodo: 'los hijos que cuelgan de las varas: se cortan y se ponen en agua o directo en tierra',
      cuando: 'todo el año, en cuanto el hijo tenga raicillas visibles',
      dificultad: 'facil',
    },
    poda: 'se cortan las varas florales agotadas y las hojas con la punta seca, en diagonal',
    temperaturaMinC: 7,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['araña roja', 'pulgón', 'cochinilla'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con un puño de perlita',
  },
  'spathiphyllum-wallisii': {
    origen: 'Centroamérica y Colombia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio: quema la boca y hace babear a perros y gatos',
    },
    propagacion: {
      metodo: 'división de mata al trasplantar, dejando raíces en cada trozo',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'se cortan desde la base las flores marchitas y las hojas amarillas',
    temperaturaMinC: 13,
    temperaturaMaxC: 35,
    humedad: 'alta',
    plagas: ['araña roja', 'cochinilla algodonosa', 'mosquita del sustrato'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con fibra de coco; que retenga sin encharcar',
  },
  'echeveria-elegans': {
    origen: 'México, Hidalgo y San Luis Potosí',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica, aunque no es para comer',
    },
    propagacion: {
      metodo: 'hoja completa arrancada de un tirón limpio, o los hijuelos de la base',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'no se poda; se quitan las hojas secas de abajo tirando con cuidado',
    temperaturaMinC: 2,
    temperaturaMaxC: 40,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pudrición de cuello'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas, muy arenoso; nunca agua en el centro de la roseta',
  },
  'sedum-morganianum': {
    origen: 'México, Veracruz',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica',
    },
    propagacion: {
      metodo: 'las hojitas que se caen solas: se dejan sobre el sustrato y enraízan',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'no se poda; los tallos se acortan sólo si se pelan por arriba',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pulgón'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas; colgada, para que los tallos cuelguen sin romperse',
  },
  'crassula-ovata': {
    origen: 'Sudáfrica',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'segura',
      detalle: 'provoca vómito y desánimo en perros y gatos; en personas no pasa nada',
    },
    propagacion: {
      metodo: 'esqueje de tallo o una hoja, dejando cicatrizar el corte dos días antes de plantar',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'se despunta para que ramifique y quede con forma de arbolito',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pudrición de raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas; maceta de barro, que respira',
  },
  'agave-americana': {
    origen: 'México',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'la savia irrita la piel y las espinas de la punta y el borde hieren de verdad',
    },
    propagacion: {
      metodo: 'hijuelos que salen de la base: se separan con raíz y se plantan aparte',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'no se poda; se cortan las hojas secas de abajo al ras del tronco',
    temperaturaMinC: -5,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['picudo del agave', 'cochinilla'],
    trasplanteCadaAnos: 4,
    sustrato: 'arenoso y pobre; en tierra abierta si se puede, porque se hace enorme',
  },
  'beaucarnea-recurvata': {
    origen: 'México, Veracruz y San Luis Potosí',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica',
    },
    propagacion: {
      metodo: 'hijuelos de la base; por semilla es lentísimo',
      cuando: 'primavera',
      dificultad: 'dificil',
    },
    poda: 'no se poda; se recortan las puntas secas siguiendo la forma de la hoja',
    temperaturaMinC: 5,
    temperaturaMaxC: 42,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'araña roja'],
    trasplanteCadaAnos: 4,
    sustrato: 'de cactáceas; maceta justa, que apretada engorda más el tronco',
  },
  'euphorbia-pulcherrima': {
    origen: 'México, Guerrero y Morelos',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'el látex blanco irrita piel y ojos; su fama de mortal es un mito, pero mejor lavarse',
    },
    propagacion: {
      metodo: 'esqueje de tallo de unos quince centímetros, cortando el látex con agua fría antes de plantar',
      cuando: 'primavera, después de la poda',
      dificultad: 'media',
    },
    poda: 'fuerte en febrero o marzo, dejando dos o tres yemas por rama',
    temperaturaMinC: 12,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['mosca blanca', 'cochinilla algodonosa', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal ligero y ácido, con corteza',
  },
  'tagetes-erecta': {
    origen: 'México',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'segura',
      detalle: 'el follaje puede irritar la piel; la flor es comestible y se usa como colorante',
    },
    propagacion: {
      metodo: 'semilla, que es de lo más fácil que hay',
      cuando: 'junio y julio, para que abra en octubre',
      dificultad: 'facil',
    },
    poda: 'se despunta de joven para que ramifique, y se van quitando las flores pasadas',
    temperaturaMinC: 5,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['araña roja', 'pulgón', 'caracol'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal; es anual, así que la tierra dura lo que dura la planta',
  },
  'salvia-rosmarinus': {
    origen: 'Mediterráneo',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'es comestible; en cantidades de cocina no tiene problema',
    },
    propagacion: {
      metodo: 'esqueje de punta de diez centímetros, quitando las hojas de abajo, en agua o en arena',
      cuando: 'primavera y otoño',
      dificultad: 'facil',
    },
    poda: 'ligera después de florecer, sin llegar nunca a la madera vieja: de ahí no rebrota',
    temperaturaMinC: -5,
    temperaturaMaxC: 40,
    humedad: 'seca',
    plagas: ['cochinilla', 'mosca blanca', 'pudrición de raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'arenoso con cal; lo peor que se le puede hacer es tierra que retiene',
  },
  'mentha-spicata': {
    origen: 'Europa y Asia',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'segura',
      detalle: 'comestible para personas; en cantidad puede caerle mal a perros y gatos',
    },
    propagacion: {
      metodo: 'un tallo en un vaso de agua echa raíz en una semana; también por división',
      cuando: 'todo el año en clima templado',
      dificultad: 'facil',
    },
    poda: 'se corta seguido por encima de un par de hojas: cuanto más se corta, más saca',
    temperaturaMinC: -5,
    temperaturaMaxC: 35,
    humedad: 'alta',
    plagas: ['roya de la menta', 'pulgón', 'araña roja'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal que retenga; siempre en maceta propia',
  },
  'coriandrum-sativum': {
    origen: 'Mediterráneo oriental',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'es comestible entero: hoja, tallo y semilla',
    },
    propagacion: {
      metodo: 'semilla directa donde va a quedarse: trasplantado se espiga',
      cuando: 'otoño e invierno en tierra caliente; primavera en clima templado',
      dificultad: 'facil',
    },
    poda: 'se cortan las hojas de afuera y se quita la vara floral en cuanto asome',
    temperaturaMinC: 2,
    temperaturaMaxC: 30,
    humedad: 'media',
    plagas: ['pulgón', 'mosquita blanca'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal suelto y hondo, que echa raíz pivotante',
  },
  'capsicum-annuum': {
    origen: 'México y Centroamérica',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'segura',
      detalle: 'la capsaicina del fruto irrita a perros y gatos; para personas es comida',
    },
    propagacion: {
      metodo: 'semilla del propio chile, lavada y secada a la sombra',
      cuando: 'febrero a abril en semillero, al sol cuando tenga cuatro hojas',
      dificultad: 'facil',
    },
    poda: 'se quita el primer botón floral para que engorde la mata, y los brotes de abajo del tronco',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['pulgón', 'mosca blanca', 'araña roja', 'gusano del fruto'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal con composta; maceta de veinte litros o más',
  },
  'persea-americana': {
    origen: 'México y Guatemala',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'segura',
      detalle: 'persina en hoja, corteza y hueso: peligrosa de verdad para aves, conejos y caballos',
    },
    propagacion: {
      metodo: 'el hueso en agua con palillos, o enterrado a medias en tierra',
      cuando: 'primavera y verano, con calor',
      dificultad: 'facil',
    },
    poda: 'se despunta al metro para que ramifique en vez de irse derecho al techo',
    temperaturaMinC: 4,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['araña roja', 'trips', 'barrenador'],
    trasplanteCadaAnos: 2,
    sustrato: 'suelto y muy drenante; es de las que más pronto pudre raíz',
  },

  'ficus-elastica': {
    origen: 'noreste de la India y Malasia',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'su látex blanco irrita la piel y, si la muerden, la boca y el estómago de perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje de punta con dos hojas, dejando escurrir el látex; o acodo aéreo en el tallo',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'se corta arriba de una hoja para que ramifique; sale látex, se limpia con un trapo húmedo',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['cochinilla', 'escama', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con perlita; que drene bien',
  },

  'dracaena-fragrans': {
    origen: 'África tropical',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'saponinas: a perros y gatos les da vómito, babeo y falta de apetito',
    },
    propagacion: {
      metodo: 'trozo de tronco de 15 cm, de pie en agua o en tierra húmeda; brota de los lados',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'se corta el tronco a la altura que quieras: brota justo debajo del corte',
    temperaturaMinC: 12,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla algodonosa', 'araña roja', 'trips'],
    trasplanteCadaAnos: 3,
    sustrato: 'universal suelto con perlita',
  },

  'chamaedorea-elegans': {
    origen: 'selvas húmedas del sur de México y Guatemala',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica para perros ni gatos: de las pocas palmas seguras para tener en casa',
    },
    propagacion: {
      metodo: 'de semilla, o separando los brotes de una maceta que traiga varios',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'sólo se quitan las hojas secas, cortando cerca del tallo',
    temperaturaMinC: 10,
    temperaturaMaxC: 32,
    humedad: 'alta',
    plagas: ['araña roja', 'cochinilla'],
    trasplanteCadaAnos: 3,
    sustrato: 'universal con fibra de coco; no le gusta el encharcamiento',
  },

  'dypsis-lutescens': {
    origen: 'Madagascar',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica para perros, gatos ni personas',
    },
    propagacion: {
      metodo: 'división de la mata con sus hijuelos, cada uno con raíz',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'se cortan las hojas secas y las cañas viejas al ras',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'alta',
    plagas: ['araña roja', 'cochinilla', 'escama'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal rico en materia orgánica y con buen drenaje',
  },

  'pelargonium-hortorum': {
    origen: 'Sudáfrica',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'sus aceites (geraniol) dan vómito y decaimiento a perros y gatos; a personas, irritación en la piel',
    },
    propagacion: {
      metodo: 'esqueje de punta de 10 cm, sin hojas abajo, directo a tierra seca-húmeda',
      cuando: 'primavera y otoño',
      dificultad: 'facil',
    },
    poda: 'se despunta para que se tupa y se quitan las flores marchitas; poda fuerte a finales del invierno',
    temperaturaMinC: 3,
    temperaturaMaxC: 35,
    humedad: 'seca',
    plagas: ['mosca blanca', 'gusano del geranio', 'roya'],
    trasplanteCadaAnos: 2,
    sustrato: 'suelto y drenante; con demasiado abono da hoja y no flor',
  },

  'kalanchoe-blossfeldiana': {
    origen: 'Madagascar',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'bufadienólidos: a perros y gatos les da vómito y, en cantidad, problemas del corazón',
    },
    propagacion: {
      metodo: 'esqueje de tallo o de hoja, dejándolo secar un día antes de plantarlo',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'al terminar la floración se cortan las varas secas y se despunta para que se compacte',
    temperaturaMinC: 8,
    temperaturaMaxC: 35,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pulgón'],
    trasplanteCadaAnos: 2,
    sustrato: 'de cactáceas o universal con mucha arena',
  },

  phalaenopsis: {
    origen: 'Sureste de Asia; las de tienda son híbridos',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica para perros, gatos ni personas',
    },
    propagacion: {
      metodo: 'los "keikis": hijitos que salen de la vara con raíces propias; se separan cuando tienen 3 raíces',
      cuando: 'después de la floración',
      dificultad: 'dificil',
    },
    poda: 'al secarse la vara, se corta arriba del segundo nudo: a veces vuelve a florear de ahí',
    temperaturaMinC: 14,
    temperaturaMaxC: 32,
    humedad: 'alta',
    plagas: ['cochinilla', 'escama', 'pudrición de raíz'],
    trasplanteCadaAnos: 2,
    sustrato: 'corteza de pino gruesa, nunca tierra: sus raíces necesitan aire',
  },

  'anthurium-andraeanum': {
    origen: 'Colombia y Ecuador',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio: quema la boca y hace babear a perros y gatos que la muerden',
    },
    propagacion: {
      metodo: 'división de mata, o los hijuelos que salen de la base con raíz',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'se cortan las flores viejas desde la base del tallo y las hojas amarillas',
    temperaturaMinC: 14,
    temperaturaMaxC: 32,
    humedad: 'alta',
    plagas: ['cochinilla', 'trips', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'aireado: corteza, fibra de coco y perlita',
  },

  'tradescantia-zebrina': {
    origen: 'sur de México y Centroamérica',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'su savia irrita la piel de perros y gatos que se echan encima, y la de algunas personas',
    },
    propagacion: {
      metodo: 'esqueje de punta en agua: enraíza en una semana',
      cuando: 'todo el año',
      dificultad: 'facil',
    },
    poda: 'se despunta seguido; los tallos largos y pelones se cortan y se replantan en la misma maceta',
    temperaturaMinC: 8,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['araña roja', 'pulgón'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal suelto',
  },

  'dieffenbachia-seguine': {
    origen: 'Caribe y Sudamérica tropical',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'oxalato de calcio en toda la planta: una mordida inflama la boca y la garganta hasta dificultar tragar',
    },
    propagacion: {
      metodo: 'trozo de tallo con un nudo, acostado sobre tierra húmeda; con guantes',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'cuando se pone larguirucha se corta el tallo a 15 cm: rebrota de abajo. Siempre con guantes',
    temperaturaMinC: 12,
    temperaturaMaxC: 32,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con perlita',
  },

  'syngonium-podophyllum': {
    origen: 'del sur de México a Bolivia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio: quema la boca de perros y gatos, y su savia irrita la piel',
    },
    propagacion: {
      metodo: 'esqueje de tallo con un nudo, en agua',
      cuando: 'todo el año en interior',
      dificultad: 'facil',
    },
    poda: 'se cortan las guías largas para que se quede compacto y con hoja de flecha',
    temperaturaMinC: 12,
    temperaturaMaxC: 32,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'pulgón'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal suelto con perlita',
  },

  'philodendron-hederaceum': {
    origen: 'del sur de México a Brasil',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio en hojas y tallo: quema la boca de perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje de tallo con dos nudos, en agua o sustrato húmedo',
      cuando: 'todo el año en interior',
      dificultad: 'facil',
    },
    poda: 'se despunta para que engrose; los tallos pelones se cortan arriba de un nudo',
    temperaturaMinC: 12,
    temperaturaMaxC: 32,
    humedad: 'media',
    plagas: ['cochinilla', 'pulgón', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'suelto con corteza y perlita',
  },

  'codiaeum-variegatum': {
    origen: 'Indonesia y Pacífico occidental',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'su látex y sus semillas dan vómito y diarrea; la savia irrita la piel',
    },
    propagacion: {
      metodo: 'esqueje de punta de 15 cm con hormona de enraizado y calor',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'en primavera, para darle forma; suelta látex, se limpia el corte',
    temperaturaMinC: 12,
    temperaturaMaxC: 38,
    humedad: 'alta',
    plagas: ['araña roja', 'cochinilla', 'trips'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal rico y bien drenado',
  },

  'coleus-scutellarioides': {
    origen: 'Sureste de Asia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'segura',
      detalle: 'sus aceites dan vómito y diarrea a perros y gatos; para personas no es peligrosa',
    },
    propagacion: {
      metodo: 'esqueje de punta en agua: enraíza en días',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'despunte constante y quitar las espigas de flor apenas salgan',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla algodonosa', 'mosca blanca', 'babosas'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal que retenga algo de humedad',
  },

  'schefflera-arboricola': {
    origen: 'Taiwán y sur de China',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio: irrita la boca y da vómito a perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje semileñoso de 15 cm, o acodo aéreo',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'aguanta podas fuertes: se corta arriba de un nudo para que ramifique',
    temperaturaMinC: 8,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'escama'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con perlita',
  },

  'aglaonema-commutatum': {
    origen: 'Filipinas y Sureste de Asia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'oxalato de calcio: quema la boca y hace babear a perros y gatos',
    },
    propagacion: {
      metodo: 'división de mata al trasplantar',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'sólo se quitan hojas amarillas desde la base',
    temperaturaMinC: 15,
    temperaturaMaxC: 32,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja'],
    trasplanteCadaAnos: 3,
    sustrato: 'universal suelto con perlita',
  },

  'catharanthus-roseus': {
    origen: 'Madagascar; naturalizada en todo México',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'sus alcaloides son venenosos si se comen: vómito, y en cantidad, daño serio',
    },
    propagacion: {
      metodo: 'de semilla (se resiembra sola) o esqueje de punta',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'despunte a principios de primavera para que se tupa',
    temperaturaMinC: 8,
    temperaturaMaxC: 42,
    humedad: 'seca',
    plagas: ['araña roja', 'pudrición de raíz'],
    trasplanteCadaAnos: 1,
    sustrato: 'suelto y drenante; nada de tierra pesada',
  },

  'portulaca-grandiflora': {
    origen: 'Sudamérica (Brasil, Argentina, Uruguay)',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'segura',
      detalle: 'contiene oxalatos: a perros y gatos que la comen en cantidad les cae mal',
    },
    propagacion: {
      metodo: 'esqueje de tallo directo a tierra, o de semilla (se resiembra sola)',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'no hace falta; se recorta si se sale de la maceta',
    temperaturaMinC: 10,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['pulgón', 'caracoles'],
    trasplanteCadaAnos: 1,
    sustrato: 'arenoso y pobre',
  },

  'solanum-lycopersicum': {
    origen: 'domesticado en México a partir de un jitomatito silvestre de los Andes',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'comestible',
      detalle: 'el fruto maduro se come; hojas, tallos y fruto verde tienen solanina, mala para perros y gatos',
    },
    propagacion: {
      metodo: 'de semilla en almácigo, o esqueje de un chupón en agua',
      cuando: 'de febrero a abril en casi todo México',
      dificultad: 'facil',
    },
    poda: 'se quitan los chupones que salen entre el tallo y cada rama; y las hojas de abajo que tocan la tierra',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['mosca blanca', 'gusano del fruto', 'tizón', 'pulgón'],
    trasplanteCadaAnos: 1,
    sustrato: 'rico en composta, profundo y con buen drenaje',
  },

  'cycas-revoluta': {
    origen: 'sur de Japón',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'cicasina en toda la planta, sobre todo en la semilla: daña el hígado; para perros puede ser mortal',
    },
    propagacion: {
      metodo: 'hijuelos de la base, separados con cuidado y secados unos días',
      cuando: 'primavera',
      dificultad: 'dificil',
    },
    poda: 'sólo se cortan las hojas amarillas o secas, al ras del tronco',
    temperaturaMinC: -2,
    temperaturaMaxC: 42,
    humedad: 'seca',
    plagas: ['escama', 'cochinilla'],
    trasplanteCadaAnos: 4,
    sustrato: 'muy drenante, con arena y tezontle',
  },

  'euphorbia-milii': {
    origen: 'Madagascar',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'su látex blanco irrita piel, boca y ojos; a perros y gatos les da vómito',
    },
    propagacion: {
      metodo: 'esqueje de punta, lavando el látex y dejándolo secar dos días',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'con guantes, en primavera; el corte suelta látex',
    temperaturaMinC: 8,
    temperaturaMaxC: 42,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pudrición de raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas',
  },

  'nerium-oleander': {
    origen: 'Mediterráneo y sur de Asia',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'glucósidos cardiacos en TODA la planta: una hoja puede ser grave; nunca quemar sus ramas',
    },
    propagacion: {
      metodo: 'esqueje de 15 cm en agua o en tierra; enraíza fácil',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'después de florecer, con guantes; florece en las puntas del año',
    temperaturaMinC: -5,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['pulgón amarillo', 'cochinilla', 'escama'],
    trasplanteCadaAnos: 3,
    sustrato: 'cualquiera que drene; aguanta suelo pobre y calcáreo',
  },

  mammillaria: {
    origen: 'México, casi todas',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxica; las espinas finas son el único riesgo',
    },
    propagacion: {
      metodo: 'hijuelos de la base, secados unos días antes de plantarlos',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'no se poda',
    temperaturaMinC: 0,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'cochinilla de raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'mineral: arena gruesa y tezontle, casi sin materia orgánica',
  },

  'tradescantia-spathacea': {
    origen: 'sur de México y Centroamérica',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'su savia irrita la piel y la boca',
    },
    propagacion: {
      metodo: 'hijuelos de la base o esqueje de tallo',
      cuando: 'todo el año en clima cálido',
      dificultad: 'facil',
    },
    poda: 'sólo se quitan hojas secas',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['cochinilla', 'caracoles'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal drenante',
  },

  'mangifera-indica': {
    origen: 'India; en México desde hace siglos',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'comestible',
      detalle: 'el fruto se come; la savia y la cáscara pueden dar alergia en la piel (pariente de la hiedra venenosa)',
    },
    propagacion: {
      metodo: 'de hueso para patrón; el que da fruto bueno es injertado',
      cuando: 'verano',
      dificultad: 'media',
    },
    poda: 'después de la cosecha, para abrir la copa y bajarle altura',
    temperaturaMinC: 4,
    temperaturaMaxC: 45,
    humedad: 'media',
    plagas: ['antracnosis', 'mosca de la fruta', 'escama'],
    trasplanteCadaAnos: 2,
    sustrato: 'profundo y muy drenante',
  },

  'plumeria-rubra': {
    origen: 'México y Centroamérica',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'su látex blanco irrita la piel y la boca',
    },
    propagacion: {
      metodo: 'esqueje de rama de 30 cm, secado dos semanas antes de plantarlo',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'a finales del invierno, sin hojas; cada corte se ramifica en dos o tres',
    temperaturaMinC: 5,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['roya', 'gusano cornudo', 'cochinilla'],
    trasplanteCadaAnos: 3,
    sustrato: 'arenoso y muy drenante',
  },

  'generica-suculenta': {
    origen: 'no sé la especie, así que tampoco su origen',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'no sé qué especie es: trátala como si pudiera ser tóxica, lejos de mascotas y niños',
    },
    propagacion: {
      metodo: 'la mayoría sale de un esqueje de tallo o de hoja, secado unos días antes de plantarlo',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'en general no se podan; sólo se quitan partes secas o dañadas',
    temperaturaMinC: 5,
    temperaturaMaxC: 42,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'pudrición de raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'de cactáceas: arena gruesa y tezontle',
  },

  'generica-interior': {
    origen: 'no sé la especie, así que tampoco su origen',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'no sé qué especie es, y muchas de hoja de interior son tóxicas: lejos de mascotas y niños',
    },
    propagacion: {
      metodo: 'muchas salen de un esqueje de tallo con un nudo en agua; otras, dividiendo la mata',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'se quitan hojas amarillas y se despunta si se pone larguirucha',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con perlita',
  },

  'generica-flor': {
    origen: 'no sé la especie, así que tampoco su origen',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'no sé qué especie es: trátala como si pudiera ser tóxica, lejos de mascotas y niños',
    },
    propagacion: {
      metodo: 'muchas salen de esqueje de punta o de semilla',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'quitar las flores marchitas hace que saque más',
    temperaturaMinC: 5,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['pulgón', 'mosca blanca', 'araña roja'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal con composta',
  },

  'generica-huerto': {
    origen: 'no sé la especie, así que tampoco su origen',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'no sé qué especie es: no te la comas hasta estar seguro de cuál es',
    },
    propagacion: {
      metodo: 'la mayoría del huerto se siembra de semilla; las hierbas, también de esqueje',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'se cosecha despuntando: así se tupe en vez de espigarse',
    temperaturaMinC: 5,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['pulgón', 'mosca blanca', 'gusanos'],
    trasplanteCadaAnos: 1,
    sustrato: 'rico en composta y con buen drenaje',
  },

  'generica-arbusto': {
    origen: 'no sé la especie, así que tampoco su origen',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'no sé qué especie es: trátala como si pudiera ser tóxica, lejos de mascotas y niños',
    },
    propagacion: {
      metodo: 'muchos salen de esqueje semileñoso con hormona de enraizado',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'después de florecer o a finales del invierno, para darle forma',
    temperaturaMinC: 0,
    temperaturaMaxC: 42,
    humedad: 'media',
    plagas: ['pulgón', 'cochinilla', 'escama'],
    trasplanteCadaAnos: 3,
    sustrato: 'franco y drenante',
  },

  'selenicereus-undatus': {
    origen: 'México y Centroamérica',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'su fruta se come con todo y semillas; la planta no es tóxica, pero sus aréolas tienen espinitas cortas',
    },
    propagacion: {
      metodo: 'un tramo de tallo de 30 cm, dejado secar una semana y enterrado de pie junto a su poste',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'después de la cosecha se quitan los tallos viejos que ya dieron fruta y los que se cruzan; se dejan los que cuelgan del poste',
    temperaturaMinC: 7,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['cochinilla', 'hormigas', 'caracoles'],
    trasplanteCadaAnos: 3,
    sustrato: 'para cactus con composta: más rico que el de un cactus del desierto, pero que drene rapidísimo',
  },

  'ficus-lyrata': {
    origen: 'oeste de África tropical',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'su látex blanco irrita la piel y, si la muerden, la boca y el estómago de perros y gatos',
    },
    propagacion: {
      metodo: 'esqueje de punta con dos o tres hojas, en agua o en tierra húmeda; o acodo aéreo en el tronco',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'se corta la punta arriba de una hoja para que ramifique; sale látex, se limpia con un trapo húmedo',
    temperaturaMinC: 12,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'escama'],
    trasplanteCadaAnos: 2,
    sustrato: 'universal con perlita y corteza; que drene bien',
  },

  'strelitzia-reginae': {
    origen: 'Sudáfrica',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'sus semillas y flores pueden darle a perros y gatos vómito y diarrea si se las comen',
    },
    propagacion: {
      metodo: 'dividiendo la mata con un cuchillo, cuidando que cada parte lleve raíces y tres hojas',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'sólo se quitan las hojas secas y las flores pasadas, cortando desde la base',
    temperaturaMinC: 5,
    temperaturaMaxC: 38,
    humedad: 'media',
    plagas: ['cochinilla', 'escama', 'caracoles'],
    trasplanteCadaAnos: 3,
    sustrato: 'universal rico en composta, con buen drenaje',
  },

  lavandula: {
    origen: 'la región del Mediterráneo',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'segura',
      detalle: 'su aceite puede caerle mal a perros y gatos si comen mucha; tocarla u olerla no les hace daño',
    },
    propagacion: {
      metodo: 'esqueje de punta de 10 cm sin flor, quitando las hojas de abajo, en tierra arenosa',
      cuando: 'primavera y otoño',
      dificultad: 'media',
    },
    poda: 'después de florear se cortan las varas y un tercio del follaje; nunca hasta la madera vieja, que ya no rebrota',
    temperaturaMinC: -5,
    temperaturaMaxC: 38,
    humedad: 'seca',
    plagas: ['pulgón', 'chicharrita espumosa'],
    trasplanteCadaAnos: 2,
    sustrato: 'arenoso y pobre, con grava; nada de tierra que se apelmace',
  },

  'cymbopogon-citratus': {
    origen: 'sur de Asia',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'comestible',
      detalle: 'se usa en la cocina; a perros y gatos que la mastican les puede dar vómito',
    },
    propagacion: {
      metodo: 'separando tallos con su base de la mata, o poniendo en agua un tallo del mercado hasta que eche raíz',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'se cortan las hojas secas y, a finales del invierno, toda la mata a un palmo del suelo para que rebrote',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['araña roja', 'roya'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal con composta',
  },

  'ruta-graveolens': {
    origen: 'sur de Europa',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'toxica',
      detalle: 'es tóxica si se come, y su savia con el sol causa quemaduras con ampollas en la piel',
    },
    propagacion: {
      metodo: 'esqueje de punta de 10 cm, o de semilla',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'con guantes: se despunta para que no se abra, y se quitan las flores pasadas',
    temperaturaMinC: -5,
    temperaturaMaxC: 38,
    humedad: 'seca',
    plagas: ['pulgón', 'araña roja'],
    trasplanteCadaAnos: 2,
    sustrato: 'suelto y calizo, con arena',
  },

  'echinocactus-grusonii': {
    origen: 'centro de México: Querétaro e Hidalgo',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no es tóxico, pero sus espinas duras lastiman: mejor lejos de donde juegan niños y mascotas',
    },
    propagacion: {
      metodo: 'de semilla, sobre arena húmeda y sin taparla; tarda años en hacerse una bola',
      cuando: 'primavera',
      dificultad: 'media',
    },
    poda: 'no se poda',
    temperaturaMinC: 5,
    temperaturaMaxC: 45,
    humedad: 'seca',
    plagas: ['cochinilla algodonosa', 'cochinilla de la raíz'],
    trasplanteCadaAnos: 3,
    sustrato: 'para cactus: mitad arena gruesa o tezontle',
  },

  'pilea-peperomioides': {
    origen: 'suroeste de China',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no se conoce que sea tóxica para perros, gatos ni personas',
    },
    propagacion: {
      metodo: 'separando los hijitos que salen de la tierra junto a ella, cuando tengan unas cuatro hojas',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'sólo se quitan las hojas de abajo que se ponen amarillas',
    temperaturaMinC: 10,
    temperaturaMaxC: 30,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'mosquita del sustrato'],
    trasplanteCadaAnos: 1,
    sustrato: 'universal con perlita',
  },

  'dracaena-marginata': {
    origen: 'Madagascar',
    toxicidad: {
      mascotas: 'toxica',
      personas: 'irritante',
      detalle: 'saponinas: a perros y gatos les da vómito, babeo y falta de apetito',
    },
    propagacion: {
      metodo: 'la punta cortada con su penacho, en agua; o un trozo de tronco de pie en tierra húmeda',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'se corta el tronco a la altura que quieras: brota justo debajo del corte',
    temperaturaMinC: 12,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla', 'araña roja', 'trips'],
    trasplanteCadaAnos: 3,
    sustrato: 'universal suelto con perlita',
  },

  'helianthus-annuus': {
    origen: 'Norteamérica, incluido el norte de México',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'no es tóxico, y sus semillas se comen',
    },
    propagacion: {
      metodo: 'de semilla, directo donde va a quedarse: no le gusta que la trasplanten',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'no se poda; se le pone un tutor si es de las altas',
    temperaturaMinC: 5,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['pulgón', 'gusano', 'pájaros que se comen las semillas'],
    trasplanteCadaAnos: 1,
    sustrato: 'tierra de jardín con composta, profunda',
  },

  'hoya-carnosa': {
    origen: 'este de Asia y Australia',
    toxicidad: {
      mascotas: 'segura',
      personas: 'segura',
      detalle: 'no se conoce que sea tóxica; su savia blanca puede irritar un poco la piel sensible',
    },
    propagacion: {
      metodo: 'esqueje de tallo con dos nudos, en agua o en tierra ligera',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'casi no se poda; nunca los tallitos donde ya floreció',
    temperaturaMinC: 10,
    temperaturaMaxC: 35,
    humedad: 'media',
    plagas: ['cochinilla algodonosa', 'pulgón'],
    trasplanteCadaAnos: 3,
    sustrato: 'para orquídea o cactus con corteza: muy aireado',
  },

  'gardenia-jasminoides': {
    origen: 'sur de China y Japón',
    toxicidad: {
      mascotas: 'irritante',
      personas: 'irritante',
      detalle: 'a perros y gatos les puede dar vómito y diarrea leves si la comen',
    },
    propagacion: {
      metodo: 'esqueje de punta de 10 cm con hormona de enraizamiento, tapado para que no se seque',
      cuando: 'primavera y verano',
      dificultad: 'dificil',
    },
    poda: 'se despunta al terminar la floración, nunca antes: las flores salen en las puntas',
    temperaturaMinC: 8,
    temperaturaMaxC: 32,
    humedad: 'alta',
    plagas: ['pulgón', 'mosquita blanca', 'cochinilla'],
    trasplanteCadaAnos: 2,
    sustrato: 'para plantas ácidas (azaleas), con turba o corteza de pino',
  },

  'carica-papaya': {
    origen: 'sur de México y Centroamérica',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'su fruta se come; el látex de la fruta verde y del tallo irrita la piel',
    },
    propagacion: {
      metodo: 'de semilla fresca, lavada y sin la bolsita gelatinosa que la envuelve',
      cuando: 'primavera',
      dificultad: 'facil',
    },
    poda: 'no se poda: sólo se quitan las hojas secas de abajo',
    temperaturaMinC: 12,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['mosquita blanca', 'araña roja', 'virus de la mancha anular'],
    trasplanteCadaAnos: 1,
    sustrato: 'tierra suelta con composta que no se encharque nunca',
  },

  'psidium-guajava': {
    origen: 'América tropical',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'su fruta se come con todo y cáscara y semillas',
    },
    propagacion: {
      metodo: 'de semilla, o acodo aéreo para que dé la misma guayaba',
      cuando: 'primavera y verano',
      dificultad: 'facil',
    },
    poda: 'después de la cosecha, para abrir el centro y bajar la altura; da fruta en las ramas nuevas',
    temperaturaMinC: 3,
    temperaturaMaxC: 40,
    humedad: 'media',
    plagas: ['mosca de la fruta', 'gusano de la guayaba', 'mosquita blanca'],
    trasplanteCadaAnos: 3,
    sustrato: 'tierra de jardín con composta',
  },

  musa: {
    origen: 'sureste de Asia',
    toxicidad: {
      mascotas: 'segura',
      personas: 'comestible',
      detalle: 'no es tóxico; su fruta se come',
    },
    propagacion: {
      metodo: 'separando un hijuelo de hojas angostas ("de espada") con un buen pedazo de raíz',
      cuando: 'primavera y verano',
      dificultad: 'media',
    },
    poda: 'se deja la planta madre y uno o dos hijos; el tallo que ya dio racimo se corta al cosechar',
    temperaturaMinC: 10,
    temperaturaMaxC: 38,
    humedad: 'alta',
    plagas: ['picudo del plátano', 'nematodos', 'sigatoka'],
    trasplanteCadaAnos: 2,
    sustrato: 'tierra profunda, rica en composta y húmeda sin encharcarse',
  },
};

// ---------------------------------------------------------------------------

export function conocimientoDe(especie: Especie): ConocimientoEspecie {
  return CONOCIMIENTO[especie.id] ?? SIN_DATOS;
}

/** Si de verdad se sabe algo de esta especie, o se está usando el respaldo. */
export function tieneConocimiento(especie: Especie): boolean {
  return especie.id in CONOCIMIENTO;
}

export function etiquetaToxicidad(nivel: Toxicidad['mascotas' | 'personas']): string {
  return {
    toxica: 'tóxica',
    irritante: 'irritante',
    segura: 'segura',
    comestible: 'comestible',
  }[nivel];
}

export function etiquetaDificultad(dificultad: Dificultad): string {
  return { facil: 'fácil', media: 'de dificultad media', dificil: 'difícil' }[dificultad];
}

export function etiquetaHumedad(humedad: ConocimientoEspecie['humedad']): string {
  return { seca: 'aire seco', media: 'humedad normal de casa', alta: 'aire húmedo' }[humedad];
}

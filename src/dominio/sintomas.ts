/**
 * Leer lo que la persona DESCRIBE, no sólo de qué habla.
 *
 * El clasificador de `src/ia` decide el tema: "se le están poniendo las puntas
 * cafés" es un síntoma. Hasta aquí todo bien — y hasta aquí llegaba la app,
 * que contestaba lo mismo para cualquier síntoma: "por el lado del agua estoy
 * bien, será otra cosa". Una respuesta correcta y completamente inútil.
 *
 * El problema es que en un síntoma LAS PALABRAS SON EL DIAGNÓSTICO. "Puntas
 * cafés y secas", "hojas de abajo amarillas", "la base está blanda y huele":
 * son tres cosas distintas, con tres causas y tres tratamientos distintos, y
 * reducirlas todas a la etiqueta `sintoma` tira justo la información que
 * importa. Este archivo recupera esa información.
 *
 * SON DOS PASOS SEPARADOS a propósito:
 *
 *   1. `leerSenales` saca de la frase QUÉ PARTE se ve MAL DE QUÉ MANERA. Es
 *      lectura de texto, no botánica.
 *   2. `causasProbables` cruza esas señales con el expediente y ordena las
 *      causas. Es botánica, no texto.
 *
 * LO QUE NO HACE, que es lo que lo mantiene honesto: no adivina. Una causa
 * sólo aparece si las señales la sostienen, y el expediente puede DESCARTARLA
 * —si el sustrato está al 80 %, no le falta agua, y eso no se discute— pero
 * nunca inventarla. Cuando no queda ninguna causa en pie, la lista sale vacía
 * y quien llama tiene que decir que no sabe. Con plantas, una causa equivocada
 * dicha con aplomo se paga con la planta.
 */

// ---------------------------------------------------------------------------
// Lo que se ve
// ---------------------------------------------------------------------------

export type Parte = 'punta' | 'borde' | 'hoja' | 'hojaVieja' | 'hojaNueva' | 'tallo' | 'base' | 'sustrato' | 'flor';

export type Aspecto =
  | 'cafe'
  | 'negra'
  | 'amarilla'
  | 'palida'
  | 'seca'
  | 'blanda'
  | 'caida'
  | 'arrugada'
  | 'manchas'
  | 'telarana'
  | 'algodon'
  | 'polvoBlanco'
  | 'pegajoso'
  | 'agujeros'
  | 'bichos'
  | 'olor'
  | 'estirada'
  | 'seCae';

export interface Senales {
  partes: Parte[];
  aspectos: Aspecto[];
  /** Nada reconocible en la frase. Quien llama no debería diagnosticar. */
  vacia: boolean;
}

/** Lo que el expediente ya sabe, y que puede confirmar o descartar una causa. */
export interface Contexto {
  nivel: 'encharcado' | 'humedo' | 'optimo' | 'seco' | 'critico';
  porcentajeSustrato: number;
  diasEncharcado: number;
  diasEnEstres: number;
  diasDesdeUltimoRiego: number | null;
  /** Como está registrada: "sol pleno", "interior luminoso", etc. */
  exposicion: string;
  interior: boolean;
  /** La que PIDE la especie, no la que hay en la casa. */
  humedadQuePrefiere: 'seca' | 'media' | 'alta';
  /** Las plagas que de verdad le salen a esta especie. */
  plagasDeLaEspecie: string[];
  /** Falso cuando se está usando el respaldo genérico del catálogo. */
  conocimientoDeSuEspecie: boolean;
}

export interface Causa {
  nombre: string;
  /** Por qué pasa, en una frase que se pueda leer en voz alta. */
  porque: string;
  /** Qué hacer hoy. Sin esto, saber la causa no sirve de nada. */
  queHacer: string;
  /** 0-1. Lo que el expediente respalda, no una probabilidad de verdad. */
  fuerza: number;
  /** El dato del expediente que la sostiene, si hay alguno. */
  respaldo?: string;
}

// ---------------------------------------------------------------------------
// Paso 1: leer la frase
// ---------------------------------------------------------------------------

/**
 * Sin acentos y en minúsculas.
 *
 * La gente escribe "cafes" y "café" y "cafés" y las tres son lo mismo. Pedirle
 * acentos a alguien que escribe con una mano mientras sostiene una maceta es
 * pedirle que la app no le sirva.
 */
function plano(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const PARTES: Array<[Parte, RegExp]> = [
  ['punta', /\bpunt(a|as|ita|itas)\b|\bpuntas?\b/],
  ['borde', /\bbord(e|es)\b|\borill(a|as)\b|\bfilos?\b|\bcanto/],
  ['hojaVieja', /hojas? de (abajo|mas abajo)|hojas? (viej|inferior|baj)|las de abajo/],
  ['hojaNueva', /hojas? (nuev|tiern|chiquit|reci[ée]n)|brotes? nuev|lo que sale nuevo/],
  ['base', /\bbase\b|\bcuello\b|al ras|donde sale de la tierra|\bpie\b|\brizoma/],
  ['tallo', /\btallo?s?\b|\bvara\b|\bca[nñ]a\b|\btronco\b/],
  ['sustrato', /\btierra\b|\bsustrato\b|\bmaceta\b|\bsuelo\b/],
  ['flor', /\bflor(es)?\b|\bcapull|\bboton(es)?\b/],
  ['hoja', /\bhojas?\b|\bpencas?\b|\bfollaje\b|\bhojita/],
];

const ASPECTOS: Array<[Aspecto, RegExp]> = [
  ['cafe', /\bcafe[s]?\b|\bmarron|\bquemad|\btostad|\bcanel|\bcobriz/],
  ['negra', /\bnegr[ao]s?\b|\bennegre/],
  ['amarilla', /\bamarill|\bamarrill/],
  ['palida', /\bpalid|destenid|descolorid|perdiendo (el )?color|\bblanquecin|sin color/],
  ['seca', /\bsec[ao]s?\b|\bcrujient|\btiesa|quebradiz|resquebraj|\bapergamin|como papel/],
  ['blanda', /\bbland[ao]s?\b|\baguad[ao]s?\b|\bchicle|\bpapilla|pudri|\bpodrid|se deshace|\bfloj[ao]s?\b|\bmushy\b|\bbabos[ao]/],
  ['caida', /\bcaid[ao]s?\b|\bcolgan|\bdoblad|\bvencid|\blaci[ao]|\bmarchit|\bmusti[ao]|\bdecaid|se me cae para/],
  ['arrugada', /\barrug|\bplieg|\bacanalad|\bhundid|\bchupad|\bapachurr/],
  ['manchas', /\bmanch(a|as|ita|itas)\b|\blunares\b|\bpint(a|as)\b/],
  ['telarana', /telara[nñ]|tela de ara[nñ]|hilitos/],
  ['algodon', /\balgodon|bolitas blancas|pelusa blanca|como pelusa/],
  ['polvoBlanco', /polvo blanco|polvill|\bceniz|\bharina|como talco/],
  ['pegajoso', /\bpegajos|\bmelaza\b|\bmelazo\b|pega(n|jos)|\bmiel\b|\bresina/],
  ['agujeros', /\bagujer|\bhoyos?\b|\bmordid|\bcomid|\broid|\bmordisque/],
  ['bichos', /\bbicho|\binsect|\bplaga|\banimalit|\bgusano|\bpulgon|\bcochinilla|\bmosquit|\bar[aá]ñ?a roja|\bescama|\bpuntitos? (rojo|negro|blanco|caf)/],
  ['olor', /\bhuele\b|\bolor\b|\bapesta|mal olor|\bhiede/],
  ['estirada', /\bestirad|\balargad|\bespigad|larguirucha|se estir|entrenudos? larg|\bdesgarbad|busca(ndo)? la (luz|ventana)/],
  ['seCae', /se le caen|se caen las|tirando (las )?hojas|\bdefoli|perdiendo hojas|se le cayeron/],
];

export function leerSenales(texto: string): Senales {
  const t = plano(texto);
  const partes = PARTES.filter(([, re]) => re.test(t)).map(([p]) => p);
  const aspectos = ASPECTOS.filter(([, re]) => re.test(t)).map(([a]) => a);

  // Una parte sin un aspecto no dice nada: "mira sus hojas" no es un síntoma.
  // Un aspecto sin parte sí: "está toda amarilla" se entiende perfectamente.
  return { partes, aspectos, vacia: aspectos.length === 0 };
}

// ---------------------------------------------------------------------------
// Paso 2: de las señales a las causas
// ---------------------------------------------------------------------------

interface Regla {
  nombre: string;
  porque: string;
  queHacer: string;
  /** Cuánto pesa antes de mirar el expediente. */
  base: number;
  /** Qué tiene que haberse visto para que la causa siquiera aparezca. */
  cuando: (s: Senales) => boolean;
  /**
   * Lo que dice el expediente. Suma, resta, o devuelve `null` para descartar
   * la causa: no es que sea poco probable, es que los datos la contradicen.
   */
  segunElExpediente?: (c: Contexto) => { delta: number; respaldo?: string } | null;
}

const tiene = (s: Senales, ...aspectos: Aspecto[]) => aspectos.every((a) => s.aspectos.includes(a));
const alguno = (s: Senales, ...aspectos: Aspecto[]) => aspectos.some((a) => s.aspectos.includes(a));
const en = (s: Senales, ...partes: Parte[]) => partes.some((p) => s.partes.includes(p));

/** Suelo mojado de verdad, no "regada hace poco". */
const empapado = (c: Contexto) => c.nivel === 'encharcado' || c.porcentajeSustrato >= 85;
const sediento = (c: Contexto) => c.nivel === 'seco' || c.nivel === 'critico';
const alSol = (c: Contexto) => /sol pleno|semisol/.test(c.exposicion);

const REGLAS: Regla[] = [
  // --- Lo que mata. Va primero porque si es esto, lo demás no importa. -----
  {
    nombre: 'Pudrición en la base',
    porque:
      'cuando la base se pone blanda y huele, la raíz o el rizoma ya se están pudriendo. Es lo que más mata a las plantas de interior, y avanza hacia arriba.',
    queHacer:
      'Sácala de la maceta hoy. Corta con cuchillo limpio todo lo blando hasta que salga tejido firme y claro, deja secar el corte un día al aire y replanta en sustrato nuevo y seco. No la riegues en dos semanas.',
    base: 0.95,
    cuando: (s) => (en(s, 'base', 'tallo') && alguno(s, 'blanda', 'olor', 'negra')) || tiene(s, 'blanda', 'olor'),
    segunElExpediente: (c) =>
      empapado(c) || c.diasEncharcado > 0
        ? { delta: 0.05, respaldo: `sustrato al ${c.porcentajeSustrato} %${c.diasEncharcado > 0 ? `, ${c.diasEncharcado} días encharcada` : ''}` }
        : { delta: 0 },
  },

  // --- Agua: de más y de menos. -------------------------------------------
  {
    nombre: 'Exceso de agua',
    porque:
      'la raíz ahogada deja de absorber, y la planta amarillea de abajo hacia arriba aunque la tierra esté mojada. Parece sed y es lo contrario.',
    queHacer:
      'No la riegues. Saca el plato de abajo, y si la maceta no drena, cámbiala. Vuelve a regar sólo cuando los primeros cinco centímetros estén secos al meter el dedo.',
    base: 0.8,
    cuando: (s) => alguno(s, 'amarilla', 'caida', 'blanda') && !en(s, 'punta'),
    segunElExpediente: (c) => {
      if (empapado(c)) {
        return { delta: 0.15, respaldo: `sustrato al ${c.porcentajeSustrato} %` };
      }
      if (sediento(c)) return null; // El expediente lo descarta.
      return { delta: -0.3 };
    },
  },
  {
    nombre: 'Le falta agua',
    porque:
      'sin presión adentro la hoja no se sostiene: primero se arruga, después se dobla, y las puntas son lo primero en secarse porque son lo más lejos de la raíz.',
    queHacer:
      'Riega despacio hasta que salga agua por abajo, y repite en diez minutos: la tierra muy seca la primera vez deja pasar el agua de largo sin mojarse.',
    base: 0.8,
    // Una planta con sed se vence ENTERA. Que esté seca sólo la punta es otra
    // cosa —sales, aire, frío— y aceptar ahí la palabra "seca" hacía que la
    // sed apareciera en toda descripción de puntas cafés, que es justo el
    // consejo que sobra: regar más no arregla una punta quemada por sales.
    cuando: (s) =>
      alguno(s, 'arrugada', 'caida') || (alguno(s, 'seca', 'amarilla') && !en(s, 'punta', 'borde')),
    segunElExpediente: (c) => {
      if (sediento(c)) {
        return {
          delta: 0.15,
          respaldo: `sustrato al ${c.porcentajeSustrato} %${c.diasEnEstres > 0 ? `, ${c.diasEnEstres} días en estrés` : ''}`,
        };
      }
      if (empapado(c)) return null; // No le falta agua, sobra.
      return { delta: -0.35 };
    },
  },

  // --- Puntas cafés: el síntoma más frecuente y el peor contestado. --------
  {
    nombre: 'Sales acumuladas en el sustrato',
    porque:
      'el agua de la llave trae cal y sales, y el fertilizante deja más. Se juntan en el sustrato y queman la punta de la hoja, que es donde termina el viaje del agua.',
    queHacer:
      'Lava el sustrato: agua a chorro lento por encima hasta que salga el triple por abajo, y tira esa agua. Repítelo cada tres o cuatro meses. Si puedes, riega con agua de lluvia o reposada.',
    base: 0.72,
    cuando: (s) => en(s, 'punta', 'borde') && alguno(s, 'cafe', 'seca', 'negra'),
    segunElExpediente: (c) =>
      empapado(c) ? { delta: -0.1 } : { delta: 0.08, respaldo: `sustrato al ${c.porcentajeSustrato} %` },
  },
  {
    nombre: 'Aire seco',
    porque:
      'la hoja pierde por el aire más de lo que la raíz alcanza a reponer, y lo primero que se paga es la punta.',
    queHacer:
      'Agrúpala con otras plantas y ponla lejos del aire acondicionado, del ventilador y de la puerta. Un plato con piedras y agua debajo —sin que la maceta toque el agua— ayuda más que rociarla.',
    base: 0.6,
    cuando: (s) => en(s, 'punta', 'borde') && alguno(s, 'cafe', 'seca'),
    segunElExpediente: (c) => {
      // A una especie de ambiente seco esto casi nunca le pasa: proponerlo
      // primero mandaría a alguien a humidificar una sansevieria.
      if (c.humedadQuePrefiere === 'seca') return { delta: -0.35 };
      if (c.humedadQuePrefiere === 'alta') return { delta: 0.2 };
      return { delta: 0 };
    },
  },
  {
    nombre: 'Golpe de frío',
    porque:
      'por debajo de su mínimo, el tejido de la hoja se rompe por dentro. Se ve días después, y casi siempre en la punta y en el borde.',
    queHacer:
      'Métela o apártala de la ventana por la noche. Lo dañado ya no se recupera: recórtalo siguiendo la forma de la hoja y vigila que no salga más.',
    base: 0.35,
    cuando: (s) => en(s, 'punta', 'borde') && alguno(s, 'cafe', 'negra'),
  },

  // --- Luz. ---------------------------------------------------------------
  {
    nombre: 'Le falta luz',
    porque:
      'estirarse es lo que hace una planta que busca la ventana: alarga el tallo, separa las hojas y las hace más chicas y pálidas para gastar menos.',
    queHacer:
      'Acércala a la ventana más clara que tengas. Gírala un cuarto de vuelta cada semana para que no se vaya toda hacia un lado. Lo ya estirado no se vuelve a compactar: lo nuevo saldrá bien.',
    base: 0.8,
    cuando: (s) => alguno(s, 'estirada', 'palida'),
    segunElExpediente: (c) =>
      alSol(c) && !c.interior ? { delta: -0.4, respaldo: `está en ${c.exposicion}` } : { delta: 0.1, respaldo: `está en ${c.exposicion}` },
  },
  {
    nombre: 'Quemadura de sol',
    porque:
      'el sol directo a través del vidrio concentra el calor en la hoja y la quema en seco. Las manchas quedan hundidas y pálidas justo en la cara que mira al sol.',
    queHacer:
      'Apártala del sol directo del mediodía o pon una cortina delgada. Si la cambiaste de lugar hace poco, devuélvela: una planta acostumbrada a la sombra se quema en dos días de sol.',
    base: 0.55,
    cuando: (s) => alguno(s, 'manchas', 'cafe') && !en(s, 'base') && !alguno(s, 'blanda', 'olor'),
    segunElExpediente: (c) => (alSol(c) ? { delta: 0.2, respaldo: `está en ${c.exposicion}` } : { delta: -0.3 }),
  },

  // --- Bichos. Se reconocen por lo que se ve, no por deducción. -----------
  {
    nombre: 'Araña roja',
    porque:
      'la telaraña fina entre las hojas es suya. Le encanta el aire seco y caliente, y chupa la hoja hasta dejarla moteada y mate.',
    queHacer:
      'Lávala con agua y jabón neutro, hoja por hoja y por el envés, que es donde viven. Repite cada cinco días tres veces: los huevos no mueren en la primera pasada.',
    base: 0.92,
    cuando: (s) => alguno(s, 'telarana'),
  },
  {
    nombre: 'Cochinilla algodonosa',
    porque:
      'esas bolitas de algodón son el insecto y su nido. Se meten en las axilas de las hojas y chupan la savia.',
    queHacer:
      'Quítalas una a una con un hisopo mojado en alcohol. Revisa a los cinco días y otra vez a los diez: siempre queda alguna escondida.',
    base: 0.92,
    cuando: (s) => alguno(s, 'algodon'),
  },
  {
    nombre: 'Pulgón o escama',
    porque:
      'lo pegajoso es melaza: lo que excretan al chupar la savia. Encima de la melaza suele salir un hongo negro que tapa la hoja.',
    queHacer:
      'Limpia la melaza con agua y jabón neutro y revisa el envés y los brotes tiernos, que es donde se juntan. Repite a los cinco días.',
    base: 0.88,
    cuando: (s) => alguno(s, 'pegajoso'),
  },
  {
    nombre: 'Cenicilla',
    porque:
      'el polvo blanco es un hongo. Aparece con humedad alta y poco aire moviéndose, y va tapando la hoja hasta que deja de trabajar.',
    queHacer:
      'Corta y tira las hojas más tomadas, separa la planta de las demás para que corra el aire y no le mojes las hojas al regar.',
    base: 0.88,
    cuando: (s) => alguno(s, 'polvoBlanco'),
  },
  {
    nombre: 'Algo se la está comiendo',
    porque:
      'los agujeros los hace algo que mastica: caracoles y babosas de noche, u orugas de día. Ninguna enfermedad hace agujeros limpios.',
    queHacer:
      'Revísala de noche con una linterna, por debajo de las hojas y en el borde de la maceta. Lo que encuentres, quítalo a mano.',
    base: 0.85,
    cuando: (s) => alguno(s, 'agujeros'),
  },
  {
    nombre: 'Tiene bichos',
    porque: 'lo que describes suena a plaga, y con plagas lo que importa es cuál, porque cada una se trata distinto.',
    queHacer:
      'Mírala de cerca por el envés de las hojas y en las axilas, que es donde se esconden casi todas. Tómale una foto de cerca y regístrala: con eso se puede afinar.',
    base: 0.5,
    cuando: (s) => alguno(s, 'bichos') && !alguno(s, 'telarana', 'algodon', 'pegajoso', 'polvoBlanco', 'agujeros'),
    segunElExpediente: (c) =>
      c.conocimientoDeSuEspecie && c.plagasDeLaEspecie.length > 0
        ? { delta: 0.15, respaldo: `a su especie le salen ${c.plagasDeLaEspecie.join(', ')}` }
        : { delta: 0 },
  },

  // --- Nutrientes. Última, porque es el diagnóstico al que se llega por
  //     descarte y el que más se usa para no decir "no sé". ----------------
  {
    nombre: 'Le faltan nutrientes',
    porque:
      'cuando el nitrógeno escasea, la planta se lo quita a las hojas viejas para dárselo a las nuevas. Por eso amarillea de abajo y lo nuevo sale chico.',
    queHacer:
      'Fertiliza a media dosis en la próxima temporada de crecimiento, no en invierno. Si lleva más de dos años en la misma tierra, cambiársela le sirve más que cualquier abono.',
    base: 0.5,
    cuando: (s) => alguno(s, 'amarilla', 'palida') && (en(s, 'hojaVieja') || en(s, 'hojaNueva') || s.partes.length === 0),
    segunElExpediente: (c) => (empapado(c) || sediento(c) ? { delta: -0.25 } : { delta: 0.1 }),
  },
];

/**
 * Las causas que las señales sostienen, de la más respaldada a la menos.
 *
 * Devuelve vacío cuando no hay nada que sostener. Esa lista vacía es una
 * respuesta: significa "no me alcanza para decirte", y es mejor que cualquier
 * cosa que se pudiera poner en su lugar.
 */
export function causasProbables(senales: Senales, contexto: Contexto, cuantas = 3): Causa[] {
  if (senales.vacia) return [];

  const causas: Causa[] = [];

  for (const regla of REGLAS) {
    if (!regla.cuando(senales)) continue;

    const ajuste = regla.segunElExpediente ? regla.segunElExpediente(contexto) : { delta: 0 };
    if (ajuste === null) continue; // El expediente la descarta.

    const fuerza = Math.max(0, Math.min(1, regla.base + ajuste.delta));
    if (fuerza < 0.3) continue; // Demasiado floja para decirla en voz alta.

    causas.push({
      nombre: regla.nombre,
      porque: regla.porque,
      queHacer: regla.queHacer,
      fuerza: Math.round(fuerza * 100) / 100,
      respaldo: ajuste.respaldo,
    });
  }

  return causas.sort((a, b) => b.fuerza - a.fuerza).slice(0, cuantas);
}

/**
 * La respuesta en palabras, para que quien llama no tenga que redactarla.
 *
 * Se dice UNA causa como principal y a lo más una segunda como alternativa.
 * Tres causas con sus tres tratamientos no es un diagnóstico, es un volado con
 * más opciones: quien lo lee acaba probando las tres a la vez.
 */
export function redactarCausas(causas: Causa[]): string {
  if (causas.length === 0) return '';

  const [primera, segunda] = causas;
  let texto = `Lo más probable es que sea ${primera.nombre.toLowerCase()}: ${primera.porque} ${primera.queHacer}`;

  // Sólo se ofrece la segunda si compite de verdad. Si la primera le saca
  // mucho, mencionarla siembra una duda que los datos no tienen.
  if (segunda && primera.fuerza - segunda.fuerza <= 0.15) {
    texto += ` Si eso no cuadra, la otra posibilidad es ${segunda.nombre.toLowerCase()}: ${segunda.queHacer}`;
  }

  return texto;
}

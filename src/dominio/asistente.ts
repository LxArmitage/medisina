/**
 * El asistente: la sina que te acompaña por toda la app.
 *
 * Es el MISMO modelo de intención que usa la ficha de cada planta, contestando
 * en otra escala. En la ficha, "¿cuándo te riego?" habla de esa planta; aquí
 * habla de todas: "hoy toca El Nopalito; a La Monstera ni la toques". Reusar
 * el modelo y cambiarle el alcance evitó tener que entrenar un segundo — y
 * evita que las dos partes de la app entiendan distinto la misma frase.
 *
 * LO QUE LO SEPARA DE UN CHATBOT DE RESPUESTAS FIJAS, que es lo que se pidió:
 *
 *   · Habla de TUS datos. Nombra tus plantas, tus días de racha, la que peor
 *     la está pasando. Dos personas con la misma pregunta reciben respuestas
 *     distintas porque tienen jardines distintos.
 *
 *   · Se ajusta a cómo cuidas. A quien riega de más le avisa antes de que
 *     pregunte; a quien lleva tres meses sin un susto no le explica qué es
 *     capacidad de campo.
 *
 *   · Tiene memoria corta. Si le vuelves a preguntar lo mismo, lo dice en vez
 *     de repetir la frase igualita, que es lo que delata a un árbol de
 *     respuestas.
 *
 *   · Varía. Cada rama tiene varias formas de decirse y se elige con una
 *     semilla que incluye cuántas veces han hablado hoy.
 *
 * Y sigue sin costar nada: todo esto son cuentas sobre el expediente.
 */

import { leerPregunta } from '../ia/conversacion';
import { nombrarDia } from './avisosClima';
import type { AvisoMover, DiaPronostico } from './avisosClima';
import { plantasMencionadas, sigueConLaDeAntes } from './menciones';
import { buscarSaber, temaDeSaber } from './saber';
import type { PlantaParaSaber } from './saber';
import { NOMBRE_INTENCION } from '../ia/intenciones';
import type { Intencion } from '../ia/intenciones';
import type { SnapshotGemelo } from './gemelo';
import type { PerfilDeCuidado } from './perfil';
import type { Racha } from './racha';
import { contextoDe as contextoDeSnapshot, responder } from './preguntas';
import { causasProbables, leerSenales, redactarCausas } from './sintomas';
import type { Especie } from './tipos';

export interface PlantaEnJardin {
  id: string;
  apodo: string;
  snapshot: SnapshotGemelo;
  especie: Especie;
}

export interface Jardin {
  /** Cómo se llama quien cuida, si lo dijo. Se usa con cuentagotas. */
  nombre?: string;
  perfil: PerfilDeCuidado;
  racha: Racha;
  plantas: PlantaEnJardin[];
  /** La planta que se está mirando, si el asistente se abrió desde su ficha. */
  enfoque?: string;
  /** El pronóstico de los próximos días y a quién hay que mover por él. */
  clima?: { dias: DiaPronostico[]; avisos: AvisoMover[] };
}

export interface Turno {
  mia: string;
  suya: Respuesta;
}

export interface Respuesta {
  texto: string;
  /** Dato duro que respalda lo dicho. Siempre sale del expediente. */
  dato?: string;
  intencion: Intencion;
  confianza: number;
  /** A qué planta lleva, para poder tocar la burbuja y abrirla. */
  irA?: { plantaId: string; apodo: string };
  /** Qué más se puede preguntar, según de qué se acaba de hablar. */
  seguir: string[];
  /**
   * Si la respuesta sale de lo que la sina sabe de jardinería en general
   * (`saber.ts`) y no del expediente: cuál tema. Sus números vienen de ahí.
   */
  saberId?: string;
}

// ---------------------------------------------------------------------------

/**
 * "Me llamo Alonso" → "Alonso".
 *
 * Es una regla, no el modelo, y es a propósito. El clasificador dice DE QUÉ se
 * habla; sacar un nombre propio de una frase es otra cosa — hay que copiar
 * literalmente lo que escribió la persona, y para eso una expresión regular es
 * exacta donde un modelo sería aproximado.
 *
 * Esto es todo el "inicio de sesión" que la app necesita hoy: sin cuenta, sin
 * correo y sin servidor. El nombre vive en el teléfono y sirve para que el
 * asistente hable con quien tiene enfrente.
 */
export function detectarNombre(texto: string): string | null {
  const marca =
    /(?:me\s+llamo|mi\s+nombre\s+es|soy|dime|ll[aá]mame)\s+([\p{L}][\p{L}'\-]{1,19})/iu.exec(
      texto.trim(),
    );
  if (!marca) return null;

  const crudo = marca[1];
  // "soy nueva", "soy de Culiacán": son frases sobre uno, no presentaciones.
  const NO_SON_NOMBRES = new Set([
    'de', 'la', 'el', 'un', 'una', 'nueva', 'nuevo', 'yo', 'tu', 'su',
    'bueno', 'buena', 'malo', 'mala', 'que', 'muy', 'mas', 'menos', 'quien',
  ]);
  const limpio = crudo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (NO_SON_NOMBRES.has(limpio)) return null;

  return crudo[0].toUpperCase() + crudo.slice(1);
}

export function responderEnJardin(
  pregunta: string,
  jardin: Jardin,
  historial: Turno[] = [],
): Respuesta {
  // Con una planta enfocada, el asistente es esa planta hablando. Es lo que
  // hace que picarle desde una ficha se sienta distinto que picarle desde
  // el inicio, sin tener dos asistentes.
  const previas = historial.map((t) => t.suya.intencion);

  const enfocada = jardin.plantas.find((p) => p.id === jardin.enfoque);
  if (enfocada) {
    const r = responder(pregunta, enfocada.snapshot, enfocada.especie, previas);
    return {
      texto: r.texto,
      dato: r.dato,
      intencion: r.intencion,
      confianza: r.confianza,
      seguir: seguimientosDe(r.intencion, jardin),
    };
  }

  // ¿Nombró a alguna? Entonces contesta ella, con sus datos. Antes aquí se
  // contestaba "eso depende de cuál" a preguntas que ya decían cuál.
  const mencionadas = plantasMencionadas(pregunta, jardin.plantas);
  const ultima = [...historial].reverse().find((t) => t.suya.irA)?.suya.irA;
  const deAntes =
    mencionadas.length === 0 && ultima && sigueConLaDeAntes(pregunta)
      ? jardin.plantas.find((p) => p.id === ultima.plantaId)
      : undefined;
  if (mencionadas.length === 1 || deAntes) {
    return responderComoPlanta(pregunta, mencionadas[0] ?? deAntes!, jardin, previas);
  }
  if (mencionadas.length > 1) {
    const varias = mencionadas.slice(0, 3).map((p) => responderComoPlanta(pregunta, p, jardin, previas));
    return {
      ...varias[0],
      texto: varias.map((r) => r.texto).join(' '),
      dato: varias.map((r) => r.dato).filter(Boolean).join(' · ') || undefined,
      saberId: varias.find((r) => r.saberId)?.saberId,
    };
  }

  const { principal: lectura, secundaria, heredada } = leerPregunta(pregunta, { previas });
  const semilla = `${lectura.intencion}-${historial.length}-${jardin.racha.dias}`;
  const repetida = seRepite(lectura.intencion, historial);

  // Lo que no es del expediente pero sí de jardinería: abono, plagas, viajes…
  // Si el modelo no entendió, o duda, y hay una respuesta que se parece de
  // verdad, se contesta con ella en vez de "no sé".
  const saber = buscarSaber(pregunta, paraSaber(jardin));
  const tema = saber ? temaDeSaber(saber.id) : undefined;
  // Lo que se contesta con TUS datos (riego de hoy, cómo vas, el clima) lo
  // contesta el expediente. Un tema que el modelo no tiene —el abono— lo
  // contesta lo que sabe la sina, aunque el modelo lo haya metido a la fuerza
  // en otro cajón.
  const deTusDatos = ['riego', 'estado', 'historial', 'clima', 'identidad', 'ayuda', 'sintoma'].includes(lectura.intencion);
  const temaAjeno = saber !== null && saber.puntaje >= 6 && tema !== lectura.intencion && !deTusDatos;
  if (
    saber &&
    jardin.plantas.length > 0 &&
    (lectura.intencion === 'desconocida' || (!lectura.segura && saber.puntaje >= 4.5) || temaAjeno)
  ) {
    return {
      texto: saber.respuesta,
      intencion: lectura.intencion,
      confianza: lectura.confianza,
      saberId: saber.id,
      seguir: ['¿Cuál necesita agua?', '¿Cuál va peor?', '¿Hay que mover alguna?'],
    };
  }

  const base = armarEnJardin(lectura.intencion, jardin, semilla, pregunta);
  let texto = base.texto;
  let saberId: string | undefined;
  // En los temas que se traslapan (plagas, poda, esquejes, frío…), lo de tus
  // plantas va primero y el "cómo se hace" general después.
  const deConocimiento = ['plaga', 'poda', 'propagacion', 'tolerancia', 'luz', 'sustrato'].includes(lectura.intencion);
  if (saber && deConocimiento && tema === lectura.intencion && saber.puntaje >= 5 && jardin.plantas.length > 1) {
    texto = `${texto} ${saber.respuesta}`;
    saberId = saber.id;
  }
  // Pregunta doble: las dos se contestan.
  if (secundaria) {
    const otra = armarEnJardin(secundaria.intencion, jardin, `${semilla}-2`, pregunta);
    texto = `${texto} Y de ${NOMBRE_INTENCION[secundaria.intencion]}: ${otra.texto}`;
  }
  if (heredada) texto = `Seguimos con ${NOMBRE_INTENCION[lectura.intencion]}. ${texto}`;
  if (repetida) texto = `${preludioDeRepeticion(semilla)} ${texto}`;
  // Igual que en la ficha: si duda, contesta y ofrece la otra lectura en vez
  // de afirmar a ciegas o dejar a la persona sin nada.
  if (!lectura.segura && lectura.alternativa && lectura.intencion !== 'desconocida') {
    texto = `Creo que va por ${NOMBRE_INTENCION[lectura.intencion]}; si era de ${NOMBRE_INTENCION[lectura.alternativa]}, dímelo. ${texto}`;
  }

  return {
    ...base,
    intencion: lectura.intencion,
    confianza: lectura.confianza,
    texto,
    saberId,
    seguir: seguimientosDe(lectura.intencion, jardin),
  };
}

// ---------------------------------------------------------------------------

type Armada = Omit<Respuesta, 'intencion' | 'confianza' | 'seguir'>;

function armarEnJardin(
  intencion: Intencion,
  jardin: Jardin,
  semilla: string,
  /** La frase tal como se escribió. La usa `sintoma` y sólo ese caso. */
  pregunta = '',
): Armada {
  const { plantas, racha, perfil } = jardin;

  if (plantas.length === 0) {
    return {
      texto:
        'Todavía no tienes ninguna planta registrada, así que no tengo de qué hablarte. Escanea una y desde ahí te cuento todo: cuándo regarla, por qué se ve como se ve y cuánto va a crecer.',
    };
  }

  switch (intencion) {
    case 'riego': {
      const sed = plantas.filter((p) => p.snapshot.hidrico.accionSugerida === 'regar');
      const alto = plantas.filter((p) => p.snapshot.hidrico.accionSugerida === 'suspender_riego');
      const agua = plantas.filter((p) => p.snapshot.hidrico.accionSugerida === 'cambiar_agua');

      if (sed.length === 0 && alto.length === 0 && agua.length === 0) {
        return {
          texto: variante(
            [
              `Hoy ninguna. Tus ${plantas.length} están dentro de rango, así que lo mejor que puedes hacer es no hacer nada.`,
              `Nada que regar hoy. Las ${plantas.length} andan bien de agua.`,
              `Hoy te toca descansar: ninguna de tus ${plantas.length} necesita agua.`,
            ],
            semilla,
          ),
          dato: `${plantas.length} en rango`,
        };
      }

      const partes: string[] = [];
      if (sed.length > 0) partes.push(`riega ${lista(sed.map((p) => p.apodo))}`);
      if (agua.length > 0) partes.push(`cámbiale el agua a ${lista(agua.map((p) => p.apodo))}`);
      if (alto.length > 0) {
        // Va al final y con énfasis: es el consejo que más cuesta seguir,
        // porque no hacer nada no se siente como cuidar. La "y" sólo cuando
        // hay algo antes — si no, sale "Hoy y a Verdoso ni te acerques".
        const enlace = partes.length > 0 ? 'y a' : 'a';
        partes.push(`${enlace} ${lista(alto.map((p) => p.apodo))} ni te acerques con la regadera`);
      }

      const primera = sed[0] ?? agua[0] ?? alto[0];
      return {
        texto: `Hoy ${partes.join(', ')}.`,
        dato: sed.length > 0 ? `${sed[0].snapshot.hidrico.mlSugeridos} ml a ${sed[0].apodo}` : undefined,
        irA: { plantaId: primera.id, apodo: primera.apodo },
      };
    }

    case 'sintoma': {
      // Si describió lo que ve Y sólo hay una planta, no hay ambigüedad que
      // resolver: se le contesta de esa. Mandarla a "escanéala" cuando tiene
      // una sola planta y acaba de decir qué le pasa es la clase de rodeo que
      // hace que una app se sienta tonta.
      const senales = leerSenales(pregunta);
      if (!senales.vacia && plantas.length === 1) {
        const unica = plantas[0];
        const causas = causasProbables(senales, contextoDeSnapshot(unica.snapshot));
        if (causas.length > 0) {
          return {
            texto: `${unica.apodo}: ${redactarCausas(causas)}`,
            dato: causas[0].respaldo,
            irA: { plantaId: unica.id, apodo: unica.apodo },
          };
        }
      }

      const enProblemas = plantas
        .filter((p) => p.snapshot.hidrico.nivel === 'critico' || p.snapshot.hidrico.nivel === 'encharcado')
        .sort((a, b) => a.snapshot.hidrico.porcentajeSustrato - b.snapshot.hidrico.porcentajeSustrato);

      if (enProblemas.length === 0) {
        return {
          texto: variante(
            [
              'Ninguna se ve mal por el lado del agua. Si notas algo raro en las hojas, escanéala y lo cruzo con su historial.',
              'Por el agua todas van bien. Lo que veas en las hojas ya es otro asunto: escanéala y lo reviso.',
            ],
            semilla,
          ),
        };
      }

      const peor = enProblemas[0];
      const h = peor.snapshot.hidrico;
      const causa =
        h.nivel === 'encharcado'
          ? `lleva ${h.diasEncharcado} días por encima de capacidad y la raíz no está respirando`
          : `su sustrato va al ${h.porcentajeSustrato} % y ya está sufriendo`;
      return {
        texto: `La que peor la está pasando es ${peor.apodo}: ${causa}.`,
        dato: `Sustrato al ${h.porcentajeSustrato} %`,
        irA: { plantaId: peor.id, apodo: peor.apodo },
      };
    }

    case 'historial':
    case 'estado':
      return armarEstado(jardin, semilla);

    case 'clima': {
      if (jardin.clima && jardin.clima.dias.length > 0) return armarClima(jardin);
      const conClima = plantas.find((p) => p.snapshot.clima);
      if (!conClima?.snapshot.clima) {
        return {
          texto:
            'No tengo el clima de tu zona. Si le das permiso de ubicación a la app, lo consulto y ajusto cuánta agua pierde cada planta al día.',
        };
      }
      const c = conClima.snapshot.clima;
      const lluvia =
        c.lluviaProximas48hMm > 0
          ? `Vienen ${c.lluviaProximas48hMm} mm de lluvia en dos días, así que aguanta antes de regar lo que esté afuera.`
          : 'No viene lluvia en dos días.';
      return {
        texto: `Hoy llega a ${c.tMaxHoyC} °C y se evaporan ${c.et0HoyMm} mm. ${lluvia}`,
        dato: `ET₀ ${c.et0HoyMm} mm`,
      };
    }

    case 'identidad':
      return {
        texto: variante(
          [
            `Soy la sina — Lophocereus schottii, el cactus que se cura solo en el desierto de Sonora. Llevo la cuenta de tus ${plantas.length} plantas.`,
            `Me llamo sina, como el cacto de Sonora que se cicatriza solo. Aquí me encargo de tus ${plantas.length} plantas.`,
          ],
          semilla,
        ),
        dato: `${plantas.length} en tu guardería`,
      };

    case 'ayuda':
      return {
        texto: `Desde aquí te digo cuál regar hoy, cuál va peor, cómo viene el clima y cómo va tu racha — llevas ${racha.dias}. Y si abres la ficha de una planta, te contesta ella: su poda, sus plagas, si es tóxica, cómo sacarle un esqueje, el frío que aguanta. Pregúntame con tus palabras.`,
        dato: `${plantas.length} ${plantas.length === 1 ? 'planta' : 'plantas'} en tu guardería`,
      };

    case 'crecimiento':
    case 'fenologia':
    case 'luz':
    case 'sustrato':
    case 'poda':
    case 'propagacion':
    case 'toxicidad':
    case 'tolerancia':
    case 'plaga': {
      // Son preguntas de una planta concreta: la poda de un rosal no tiene
      // nada que ver con la de un potos. Antes se contestaba "depende de cuál,
      // ábreme la ficha"; ahora se contesta de cada una, en corto, con sus
      // datos. Con una sola planta, contesta ella directo.
      if (plantas.length === 1) return responderComoPlanta(pregunta, plantas[0], jardin, []);
      return porCadaPlanta(intencion, plantas);
    }

    default:
      return armarNoEntendi(jardin, perfil, racha, semilla);
  }
}

/** Tus plantas, como las necesita la búsqueda de `saber` para personalizar. */
function paraSaber(jardin: Jardin): PlantaParaSaber[] {
  return jardin.plantas.map((p) => ({
    apodo: p.apodo,
    familia: p.especie.familiaFuncional,
    perfilHidrico: p.especie.perfilHidrico,
    interior: p.snapshot.planta.interior,
  }));
}

/**
 * Contesta una planta en concreto, con su voz y sus datos.
 *
 * Se dice quién habla ("Helecho Rulo dice: …") porque en el asistente general
 * la sina es la que conversa: así queda claro que esto sale del expediente de
 * esa planta y no de un promedio.
 */
function responderComoPlanta(pregunta: string, planta: PlantaEnJardin, jardin: Jardin, previas: Intencion[]): Respuesta {
  const r = responder(pregunta, planta.snapshot, planta.especie, previas);
  const irA = { plantaId: planta.id, apodo: planta.apodo };
  const nombres = jardin.plantas.filter((p) => p.id !== planta.id).slice(0, 1);
  const seguir = [
    `¿Y la poda de ${planta.apodo}?`,
    `¿${planta.apodo} es tóxica?`,
    ...(nombres.length > 0 ? [`¿Y ${nombres[0].apodo}?`] : ['¿Cómo voy?']),
  ];

  if (r.intencion === 'desconocida') {
    const saber = buscarSaber(pregunta, paraSaber({ ...jardin, plantas: [planta] }));
    if (saber) {
      return {
        texto: `De ${planta.apodo}: ${saber.respuesta}`,
        intencion: r.intencion,
        confianza: r.confianza,
        irA,
        saberId: saber.id,
        seguir,
      };
    }
  }
  const paso = siguientePaso(r.intencion, planta);
  return {
    texto: `${planta.apodo} dice: «${r.texto}»${paso ? ` ${paso}` : ''}`,
    dato: r.dato,
    intencion: r.intencion,
    confianza: r.confianza,
    irA,
    seguir,
  };
}

/** Lo que conviene hacer después, cuando hay algo concreto que hacer. */
function siguientePaso(intencion: Intencion, planta: PlantaEnJardin): string | null {
  const h = planta.snapshot.hidrico;
  if (intencion === 'riego' && h.accionSugerida === 'regar') {
    return 'Riégala despacio hasta que escurra por abajo y regístralo: así llevo la cuenta y sube tu racha.';
  }
  if (intencion === 'riego' && h.accionSugerida === 'suspender_riego') {
    return 'Si quieres sumar a tu racha hoy, dale "La revisé": revisarla también cuenta.';
  }
  if (intencion === 'sintoma') return 'Si me dices qué ves exactamente —color, dónde, desde cuándo— lo cruzo mejor.';
  return null;
}

/**
 * Una pregunta de planta concreta, contestada para cada una en corto.
 *
 * Sale de la ficha de conocimiento de cada especie: la poda de la sina no es
 * la del romero. Se contesta de hasta cuatro y se ofrece seguir con una.
 */
function porCadaPlanta(intencion: Intencion, plantas: PlantaEnJardin[]): Armada {
  const primeras = plantas.slice(0, 4);
  const k = (p: PlantaEnJardin) => p.snapshot.conocimiento;
  const cola = plantas.length > 4 ? ` (y ${plantas.length - 4} más; pregúntame por su nombre).` : '';

  switch (intencion) {
    case 'toxicidad': {
      const toxicas = plantas.filter((p) => k(p).toxicidadMascotas === 'tóxica');
      const irritantes = plantas.filter((p) => k(p).toxicidadMascotas === 'irritante');
      const seguras = plantas.filter((p) => k(p).toxicidadMascotas === 'segura' || k(p).toxicidadMascotas === 'comestible');
      const partes: string[] = [];
      if (toxicas.length) partes.push(`${lista(toxicas.map((p) => p.apodo))} ${toxicas.length === 1 ? 'es tóxica' : 'son tóxicas'} para perros y gatos: mejor fuera de su alcance`);
      if (irritantes.length) partes.push(`${lista(irritantes.map((p) => p.apodo))} ${irritantes.length === 1 ? 'irrita' : 'irritan'} la boca, sin ser grave`);
      if (seguras.length) partes.push(`${lista(seguras.map((p) => p.apodo))} ${seguras.length === 1 ? 'es segura' : 'son seguras'}`);
      return {
        texto: partes.length ? `${partes.join('; ')}.` : 'No tengo registrada la toxicidad de tus plantas: en la duda, trátalas como si lo fueran.',
        irA: toxicas[0] ? { plantaId: toxicas[0].id, apodo: toxicas[0].apodo } : undefined,
      };
    }
    case 'poda':
      return { texto: `${primeras.map((p) => `${p.apodo}: ${k(p).poda}.`).join(' ')}${cola}` };
    case 'propagacion':
      return {
        texto: `${primeras
          .map((p) => (k(p).propagacionMetodo === 'no registrado' ? `${p.apodo}: no tengo registrado cómo.` : `${p.apodo}: ${k(p).propagacionMetodo} (mejor ${k(p).propagacionCuando}).`))
          .join(' ')}${cola}`,
      };
    case 'tolerancia': {
      const ordenadas = [...plantas].sort((a, b) => k(b).temperaturaMinC - k(a).temperaturaMinC);
      const friolenta = ordenadas[0];
      const aguantadora = ordenadas[ordenadas.length - 1];
      const texto =
        plantas.length === 1
          ? `${friolenta.apodo} aguanta de ${k(friolenta).temperaturaMinC} a ${k(friolenta).temperaturaMaxC} °C.`
          : `La más friolenta es ${friolenta.apodo}: sufre por debajo de ${k(friolenta).temperaturaMinC} °C. La más aguantadora, ${aguantadora.apodo}, llega hasta ${k(aguantadora).temperaturaMinC} °C sin problema. Cuando una noche vaya a bajar de lo que aguanta alguna, te aviso en "El clima de estos días".`;
      return { texto, irA: { plantaId: friolenta.id, apodo: friolenta.apodo } };
    }
    case 'plaga':
      return {
        texto: `${primeras
          .map((p) => (p.snapshot.diagnostico?.hallazgos.length ? `${p.apodo}: tiene ${p.snapshot.diagnostico.hallazgos.join(' y ')} registrado.` : k(p).plagas.length ? `${p.apodo}: vigila ${lista(k(p).plagas.slice(0, 2))}.` : `${p.apodo}: nada típico registrado.`))
          .join(' ')} Revisa el envés de las hojas y las uniones del tallo, que es donde se esconden.`,
      };
    case 'luz': {
      const mal = plantas.filter((p) => !p.especie.bandasToleradas.includes(p.snapshot.planta.exposicion as never));
      if (mal.length === 0) return { texto: `Todas están en una luz que les va: ${lista(primeras.map((p) => `${p.apodo} en ${p.snapshot.planta.exposicion}`))}.` };
      return {
        texto: `${lista(mal.map((p) => p.apodo))} ${mal.length === 1 ? 'está' : 'están'} en una luz que no ${mal.length === 1 ? 'le' : 'les'} va. En "El clima de estos días" te digo a dónde moverlas.`,
        irA: { plantaId: mal[0].id, apodo: mal[0].apodo },
      };
    }
    case 'fenologia': {
      const enTemporada = plantas.filter((p) => p.snapshot.fenologia[0]?.enCurso);
      const texto = enTemporada.length
        ? `Ahora están en temporada ${lista(enTemporada.map((p) => `${p.apodo} (${p.snapshot.fenologia[0].fenomeno})`))}.`
        : 'Ninguna está en temporada de flor o brote ahora mismo.';
      return { texto: `${texto} En la ficha de cada una te digo cuándo le toca la siguiente.` };
    }
    case 'crecimiento':
      return {
        texto: `${primeras.map((p) => `${p.apodo} crece unos ${p.snapshot.especie.crecimientoCmPorAno} cm al año y llega a ${p.snapshot.especie.alturaMaximaCm} cm.`).join(' ')}${cola}`,
      };
    case 'sustrato':
      return {
        texto: `${primeras.map((p) => `${p.apodo}: sustrato al ${p.snapshot.hidrico.porcentajeSustrato} %, necesita drenaje ${p.snapshot.especie.drenajeRequerido}.`).join(' ')}${cola}`,
      };
    default:
      return { texto: `Dime de cuál: ${lista(primeras.map((p) => p.apodo))}.` };
  }
}

/** YYYY-MM-DD a fecha local a mediodía (sin sustos de zona horaria). */
function fechaDe(iso: string): Date {
  return new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12);
}

/** El clima de estos días, con lo que hay que hacer por él. */
function armarClima(jardin: Jardin): Armada {
  const { dias, avisos } = jardin.clima!;
  const hoy = dias[0];
  const lluvias = dias.filter((d) => d.lluviaMm >= 1);
  const calor = dias.reduce((a, b) => (b.tMaxC > a.tMaxC ? b : a));
  const frio = dias.reduce((a, b) => (b.tMinC < a.tMinC ? b : a));
  const partes = [`Hoy llega a ${hoy.tMaxC} °C y en la noche baja a ${hoy.tMinC} °C.`];
  const cuando = (d: DiaPronostico) => nombrarDia(d.fecha, fechaDe(hoy.fecha));
  if (calor.fecha !== hoy.fecha) partes.push(`Lo más caliente de estos días: ${calor.tMaxC} °C, ${cuando(calor)}.`);
  if (frio.fecha !== hoy.fecha && frio.tMinC < hoy.tMinC) partes.push(`La noche más fría: ${frio.tMinC} °C, ${cuando(frio)}.`);
  partes.push(
    lluvias.length
      ? `Viene lluvia ${lista(lluvias.map((d) => `${cuando(d)} (${Math.round(d.lluviaMm)} mm)`))}: lo que está afuera se riega solo esos días.`
      : 'No se ve lluvia en estos días.',
  );
  const urgentes = avisos.filter((a) => a.motivo !== 'luz');
  if (urgentes.length) partes.push(urgentes[0].texto);
  else partes.push('Con este clima no hay que mover a nadie de lugar.');
  return {
    texto: partes.join(' '),
    dato: `${dias.length} días de pronóstico`,
    irA: urgentes[0] ? { plantaId: urgentes[0].plantaId, apodo: urgentes[0].apodo } : undefined,
  };
}

/**
 * El estado del jardín: la racha primero, porque es lo que engancha, pero
 * nunca sola — siempre con lo que hay que hacer para no perderla.
 */
function armarEstado(jardin: Jardin, semilla: string): Armada {
  const { racha, perfil, plantas, nombre } = jardin;
  const saludo = nombre ? `${nombre}, ` : '';

  if (racha.enPeligro && racha.paraSalvarla.length > 0) {
    const quienes = lista(racha.paraSalvarla.map((f) => f.apodo));
    const varias = racha.paraSalvarla.length > 1;
    const que = racha.paraSalvarla.every((f) => f.motivo === 'sed')
      ? varias
        ? 'les falta agua'
        : 'le falta agua'
      : varias
        ? 'están encharcadas'
        : 'está encharcada';
    const objetivo = racha.paraSalvarla[0];
    return {
      texto: `${saludo}llevas ${racha.dias} ${dias(racha.dias)} de racha y hoy está en juego: ${quienes} ${que}.`,
      dato: `Racha de ${racha.dias} ${dias(racha.dias)}`,
      irA: { plantaId: objetivo.plantaId, apodo: objetivo.apodo },
    };
  }

  // La racha cuenta días en que registraste algo. Si hoy todavía no, eso es
  // lo primero que hay que decir: es lo único que la mantiene viva.
  if (!racha.hoyCuenta) {
    return {
      texto:
        racha.dias === 0
          ? `${saludo}hoy todavía no registras nada. Riega o revisa cualquier planta y tu racha empieza.`
          : `${saludo}llevas ${racha.dias} ${dias(racha.dias)} de racha y hoy todavía no cuenta. Riega o revisa cualquier planta para no perderla — revisar vale igual que regar.`,
      dato: `Racha de ${racha.dias} ${dias(racha.dias)}`,
      irA: plantas[0] ? { plantaId: plantas[0].id, apodo: plantas[0].apodo } : undefined,
    };
  }

  const cola = colaSegunPerfil(perfil, plantas.length, semilla);
  return {
    texto: variante(
      [
        `${saludo}vas ${racha.dias} ${dias(racha.dias)} seguidos cuidándolas, y hoy ya cuenta. ${cola}`,
        `${saludo}llevas ${racha.dias} ${dias(racha.dias)} sin soltarlas. ${cola}`,
        `${saludo}${racha.dias} ${dias(racha.dias)} de racha, hoy incluido. ${cola}`,
      ],
      semilla,
    ),
    dato: racha.mejor > racha.dias ? `Tu mejor racha: ${racha.mejor}` : `Racha de ${racha.dias}`,
  };
}

/**
 * Aquí es donde el asistente deja de ser genérico.
 *
 * La misma racha, la misma pregunta, y la frase cambia según qué error comete
 * ESA persona. A quien riega de más se le nombra el riesgo antes de que lo
 * tenga; a quien va bien no se le sermonea.
 */
function colaSegunPerfil(perfil: PerfilDeCuidado, plantas: number, semilla: string): string {
  switch (perfil.tendencia) {
    case 'riega_de_mas':
      return variante(
        [
          `Ojo con la mano: de los últimos ${perfil.diasObservados} días, ${perfil.diasConAhogo} fueron de sustrato encharcado. Cuando dudes, no riegues.`,
          `Tu patrón es regar de más — ${perfil.diasConAhogo} días encharcada este mes. La raíz se ahoga antes de que la hoja se vea mal.`,
        ],
        semilla,
      );
    case 'riega_de_menos':
      return variante(
        [
          `Lo tuyo es que se te pasa: ${perfil.diasConSed} de los últimos ${perfil.diasObservados} días alguna estuvo sin agua de verdad.`,
          `Se te olvidan — ${perfil.diasConSed} días de sed este mes. Te aviso yo, tú no tienes que acordarte.`,
        ],
        semilla,
      );
    case 'sin_datos':
      return plantas === 1
        ? 'Todavía te estoy conociendo; con un par de semanas ya te digo en qué se te va la mano.'
        : `Todavía te estoy conociendo. Con un par de semanas de tus ${plantas} plantas ya te digo en qué se te va la mano.`;
    default:
      return variante(
        ['Le has agarrado el punto.', 'Vas fino.', 'Así se ve cuando alguien ya le agarró el modo.'],
        semilla,
      );
  }
}

function armarNoEntendi(
  jardin: Jardin,
  perfil: PerfilDeCuidado,
  racha: Racha,
  semilla: string,
): Armada {
  // Incluso sin entender, se ofrece algo útil y propio de esta persona: la
  // planta que peor va, o la racha. Un "no entendí" a secas es una puerta
  // cerrada.
  if (perfil.puntoDebil) {
    const d = perfil.puntoDebil;
    return {
      texto: `Esa no te la sé. Lo que sí: ${d.apodo} lleva ${d.dias} ${dias(d.dias)} con problemas de ${d.motivo === 'ahogo' ? 'exceso de agua' : 'falta de agua'} este mes. ¿Le echamos un ojo?`,
      irA: { plantaId: d.plantaId, apodo: d.apodo },
    };
  }
  return {
    texto: variante(
      [
        `De eso no sé. Pregúntame del riego, de cómo se ven, del clima o de tu racha — llevas ${racha.dias}.`,
        `Esa se me escapa. Lo mío es el riego, el estado de tus plantas, el clima y tu racha de ${racha.dias} ${dias(racha.dias)}.`,
      ],
      semilla,
    ),
  };
}

// ---------------------------------------------------------------------------

/** Qué ofrecerle preguntar después, según de qué se acaba de hablar. */
function seguimientosDe(intencion: Intencion, jardin: Jardin): string[] {
  const hayPlantas = jardin.plantas.length > 0;
  switch (intencion) {
    case 'riego':
      return hayPlantas ? ['¿Cuánta agua?', '¿Va a llover?', '¿Cómo voy de racha?'] : ['¿Quién eres?'];
    case 'sintoma':
      return ['¿Le falta luz?', '¿Cuándo la regué?', '¿Qué hago?'];
    case 'estado':
    case 'historial':
      return ['¿Cuál necesita agua?', '¿Cuál va peor?', '¿Va a llover?'];
    case 'clima':
      return ['¿Entonces riego?', '¿Hay que mover alguna?', '¿Cuál se ve peor?'];
    case 'plaga':
    case 'toxicidad':
    case 'poda':
    case 'propagacion':
    case 'tolerancia':
      return hayPlantas
        ? [...jardin.plantas.slice(0, 2).map((p) => `¿Y ${p.apodo}?`), '¿Cuál necesita agua?']
        : ['¿Qué te puedo preguntar?'];
    case 'ayuda':
      return ['¿Cuál necesita agua?', '¿Cómo voy?', '¿Va a llover?'];
    default:
      return ['¿Cuál necesita agua?', '¿Cómo voy?', '¿Quién eres?'];
  }
}

/** ¿Ya habíamos hablado de esto hace poco? */
function seRepite(intencion: Intencion, historial: Turno[]): boolean {
  return historial.slice(-3).some((t) => t.suya.intencion === intencion);
}

function preludioDeRepeticion(semilla: string): string {
  return variante(
    ['Como te decía:', 'Otra vez, pues:', 'Te lo repito:', 'Sigue igual:'],
    semilla,
  );
}

function lista(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

function dias(n: number): string {
  return n === 1 ? 'día' : 'días';
}

/** Misma semilla, misma frase: se puede reproducir lo que vio un usuario. */
function variante(opciones: string[], semilla: string): string {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return opciones[Math.abs(h) % opciones.length];
}

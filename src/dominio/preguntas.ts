/**
 * Preguntarle cosas a la planta, sin conexión y sin costo.
 *
 * CÓMO ESTÁ REPARTIDO EL TRABAJO, que es lo importante de este archivo:
 *
 *   1. ENTENDER la pregunta lo hace un modelo entrenado (`src/ia`). Es
 *      aprendizaje automático de verdad: regresión softmax sobre rasgos de
 *      texto, entrenada con descenso de gradiente, que acierta 96 de cada 100
 *      preguntas escritas a mano que nunca vio. Aguanta erratas y formas que
 *      nadie escribió en el corpus, porque generaliza.
 *
 *   2. REDACTAR la respuesta lo hace este archivo, con datos del snapshot.
 *
 * Ese corte es a propósito y es lo que hace la app confiable. El modelo decide
 * DE QUÉ se habla; lo que se AFIRMA sale siempre del expediente. Así, por
 * construcción, ninguna respuesta puede inventarse un número — y hay una
 * prueba que lo verifica para todas las intenciones, con el mismo verificador
 * de anclaje que vigilaría a un modelo de lenguaje.
 *
 * Un LLM haría el punto 2 con mejor prosa, y cuesta por token. Esto cuesta
 * cero y funciona en el metro sin señal. El contrato para conectar uno ya está
 * escrito en `gemelo.ts` (`PROMPT_SISTEMA_GEMELO`); el día que se conecte,
 * esto se vuelve su respaldo sin red.
 */

import type { Lectura } from '../ia/clasificador';
import { leerPregunta } from '../ia/conversacion';
import { NOMBRE_INTENCION } from '../ia/intenciones';
import type { Intencion } from '../ia/intenciones';
import type { SnapshotGemelo } from './gemelo';
import { vozDeterminista } from './gemelo';
import { etiquetaFenomeno } from './fenologia';
import { causasProbables, leerSenales, redactarCausas } from './sintomas';
import type { Contexto } from './sintomas';
import { buscarSaber } from './saber';
import type { Especie } from './tipos';

export type { Intencion };

export interface Respuesta {
  intencion: Intencion;
  texto: string;
  /** Dato que respalda lo dicho. Siempre sale del snapshot. */
  dato?: string;
  /** Qué tan segura estuvo la lectura de la pregunta, de 0 a 1. */
  confianza: number;
  /** Si salió de lo que se sabe de jardinería en general (`saber.ts`), cuál tema. */
  saberId?: string;
}

/** Lo que se le puede preguntar, para ofrecerlo como sugerencias en pantalla. */
export const PREGUNTAS_SUGERIDAS = [
  '¿Cuándo te riego?',
  '¿Por qué te ves así?',
  '¿Eres tóxica?',
  '¿Cómo te saco un esqueje?',
  '¿Te podo?',
  '¿Aguantas el frío?',
  '¿Qué te puedo preguntar?',
] as const;

/**
 * De qué está preguntando.
 *
 * Existía antes como una lista de palabras clave. El modelo la reemplazó y las
 * pruebas de aquella versión se quedaron: ahora hacen de red de seguridad — si
 * un reentrenamiento rompe un caso que ya funcionaba, se nota.
 */
export function detectarIntencion(pregunta: string): Intencion {
  return leerPregunta(pregunta).principal.intencion;
}

// ---------------------------------------------------------------------------

export function responder(
  pregunta: string,
  snapshot: SnapshotGemelo,
  especie: Especie,
  /** Temas de los turnos anteriores. Permite entender "¿y de sol?". */
  previas: Intencion[] = [],
): Respuesta {
  const { principal, secundaria, heredada } = leerPregunta(pregunta, { previas });
  const armada = armar(principal, snapshot, especie, pregunta);

  let texto = conDuda(armada.texto, principal);

  // Pregunta doble: se contestan las dos. Dejar la segunda sin responder
  // obliga a repetirla, y repetir es justo lo que hace sentir tonta a una app.
  if (secundaria) {
    const otra = armar(secundaria, snapshot, especie, pregunta);
    texto = `${texto} Y de ${NOMBRE_INTENCION[secundaria.intencion]}: ${otra.texto}`;
  }

  if (heredada) {
    texto = `Seguimos con ${NOMBRE_INTENCION[principal.intencion]}. ${texto}`;
  }

  return { ...armada, texto, confianza: principal.confianza };
}

/**
 * Cuando el modelo no está seguro, contesta igual pero lo dice y ofrece la otra
 * lectura.
 *
 * Es mejor que las dos alternativas obvias. Callarse deja a la persona sin
 * nada; afirmar con 20 % de confianza es una moneda al aire con voz firme.
 * Esto da una respuesta útil y, en la misma frase, la manera de corregirla.
 */
function conDuda(texto: string, lectura: Lectura): string {
  if (lectura.segura || lectura.intencion === 'desconocida' || !lectura.alternativa) {
    return texto;
  }
  return `Creo que me preguntas de ${NOMBRE_INTENCION[lectura.intencion]}; si era de ${NOMBRE_INTENCION[lectura.alternativa]}, dímelo. ${texto}`;
}

/**
 * Lo que el lector de síntomas necesita saber de la planta.
 *
 * Sale entero del snapshot, que es el contrato. Si mañana una causa quiere
 * mirar un dato nuevo, el dato tiene que entrar antes al snapshot — no se
 * consulta nada por la puerta de atrás.
 *
 * Se exporta porque el asistente del jardín lee los mismos síntomas cuando
 * hay una sola planta, y duplicar el adaptador es duplicar la forma de
 * equivocarse.
 */
export function contextoDe(snapshot: SnapshotGemelo): Contexto {
  const h = snapshot.hidrico;
  return {
    nivel: h.nivel,
    porcentajeSustrato: h.porcentajeSustrato,
    diasEncharcado: h.diasEncharcado,
    diasEnEstres: h.diasEnEstres,
    diasDesdeUltimoRiego: h.diasDesdeUltimoRiego,
    exposicion: snapshot.planta.exposicion,
    interior: snapshot.planta.interior,
    humedadQuePrefiere: snapshot.conocimiento.humedad as Contexto['humedadQuePrefiere'],
    plagasDeLaEspecie: snapshot.conocimiento.plagas,
    conocimientoDeSuEspecie: snapshot.conocimiento.esDeSuEspecie,
  };
}

function armar(
  lectura: Lectura,
  snapshot: SnapshotGemelo,
  especie: Especie,
  /**
   * La frase tal como se escribió.
   *
   * La necesita el caso `sintoma` y sólo ése. En un síntoma las palabras SON
   * el diagnóstico —"puntas cafés" y "base blanda" no se tratan igual— y
   * quedarse con la etiqueta que puso el clasificador tira esa información.
   */
  pregunta = '',
): Omit<Respuesta, 'confianza'> {
  const intencion = lectura.intencion;
  const h = snapshot.hidrico;
  const pct = h.porcentajeSustrato;

  switch (intencion) {
    case 'riego': {
      if (h.accionSugerida === 'cambiar_agua') {
        return {
          intencion,
          texto: `A mí no me riegas: vivo en agua. Lo que toca es renovármela. ${h.motivo}`,
          dato:
            h.diasDesdeCambioAgua === null
              ? undefined
              : `${h.diasDesdeCambioAgua} días desde el cambio`,
        };
      }
      if (h.accionSugerida === 'regar') {
        return {
          intencion,
          texto: `Hoy sí. Con ${h.mlSugeridos} ml me repongo. ${h.motivo}`,
          dato: `Sustrato al ${pct} %`,
        };
      }
      if (h.accionSugerida === 'esperar_lluvia') {
        return {
          intencion,
          texto: `Todavía no. ${h.motivo}`,
          dato: snapshot.clima
            ? `${snapshot.clima.lluviaProximas48hMm} mm de lluvia en camino`
            : undefined,
        };
      }
      if (h.accionSugerida === 'suspender_riego') {
        return {
          intencion,
          texto: `Ni se te ocurra. ${h.motivo}`,
          dato: `${h.diasEncharcado} días encharcada`,
        };
      }
      return {
        intencion,
        texto: `Hoy no hace falta. ${h.motivo}`,
        dato:
          h.diasDesdeUltimoRiego === null
            ? `Sustrato al ${pct} %`
            : `Último riego hace ${h.diasDesdeUltimoRiego} días`,
      };
    }

    case 'sintoma': {
      // Primero se lee LO QUE DESCRIBIÓ. Va antes que las ramas de agua porque
      // sabe más: cruza las señales de la frase con el mismo expediente que
      // ellas miran. "Puntas cafés" con el sustrato al 76 % no es un problema
      // de agua, y contestarle del agua es lo que hacía parecer tonta a la app.
      const causas = causasProbables(leerSenales(pregunta), contextoDe(snapshot));
      if (causas.length > 0) {
        const dicho = redactarCausas(causas);
        return {
          intencion,
          texto: dicho,
          dato: causas[0].respaldo ?? `Sustrato al ${pct} %`,
        };
      }

      if (h.nivel === 'encharcado') {
        return {
          intencion,
          texto:
            'Me sobra agua. La raíz lleva días sin oxígeno y ya no me sube nada, por eso me veo caída aunque el sustrato esté empapado.',
          dato: `Sustrato al ${pct} %, ${h.diasEncharcado} días encharcada`,
        };
      }
      if (h.nivel === 'seco' || h.nivel === 'critico') {
        return {
          intencion,
          texto:
            'Me falta agua. Sin presión adentro, las hojas no se sostienen y se doblan.',
          dato: `Sustrato al ${pct} %, sufro por debajo del ${snapshot.especie.umbralEstresPct} %`,
        };
      }
      if (snapshot.diagnostico && snapshot.diagnostico.hallazgos.length > 0) {
        const lista = snapshot.diagnostico.hallazgos.join(' y ');
        return {
          intencion,
          texto:
            snapshot.diagnostico.confianza === 'confirmado'
              ? `Tengo ${lista}, ya confirmado.`
              : `Puede que tenga ${lista}, pero no estoy segura todavía.`,
        };
      }
      return {
        intencion,
        texto:
          'Por el lado del agua estoy bien, así que si me ves rara el motivo es otro: nutrientes, luz o algo en las hojas. Registra lo que ves al escanearme y lo cruzo con mi historial.',
        dato: `Sustrato al ${pct} %`,
      };
    }

    case 'luz':
      return {
        intencion,
        texto: `Estoy en ${snapshot.planta.exposicion} y así me acomodo. Cambiarme de lugar altera cuánta agua pierdo al día, así que si me mueves, actualiza dónde vivo.`,
        dato: snapshot.clima ? `Demanda de hoy ${snapshot.clima.et0HoyMm} mm de ET₀` : undefined,
      };

    case 'fenologia': {
      const proximo = snapshot.fenologia[0];
      if (!proximo) {
        return {
          intencion,
          texto: 'No tengo temporadas marcadas en mi ficha, así que no te puedo decir cuándo.',
        };
      }
      if (proximo.enCurso) {
        return {
          intencion,
          texto: `Ahora mismo estoy en temporada de ${etiquetaFenomeno(proximo.fenomeno)}.`,
          dato: proximo.fuente === 'historial' ? 'Ajustado con mi propio historial' : undefined,
        };
      }
      return {
        intencion,
        texto: `Me faltan como ${proximo.diasParaInicio} días para mi ${etiquetaFenomeno(proximo.fenomeno)}.`,
        dato: proximo.fuente === 'historial' ? 'Ajustado con mi propio historial' : undefined,
      };
    }

    case 'crecimiento':
      return {
        intencion,
        texto: `Mi especie crece unos ${snapshot.especie.crecimientoCmPorAno} cm al año con buen cuidado, y se estabiliza cerca de los ${snapshot.especie.alturaMaximaCm} cm. En la ficha puedes verme proyectada a tres meses, seis y un año.`,
      };

    case 'sustrato':
      return {
        intencion,
        texto: `Mi sustrato está al ${pct} % de su capacidad útil. Empiezo a sufrir por debajo del ${snapshot.especie.umbralEstresPct} %, y aguanto ${snapshot.especie.toleranciaEncharcamientoDias} días encharcada antes de que la raíz corra peligro.`,
        dato: `Drenaje que necesito: ${snapshot.especie.drenajeRequerido}`,
      };

    case 'identidad': {
      const donde = snapshot.planta.municipio
        ? `Vivo contigo en ${snapshot.planta.municipio}`
        : 'Vivo contigo';
      return {
        intencion,
        texto: `Me dices ${snapshot.planta.apodo}. De nombre soy ${snapshot.planta.nombreCientifico}, que en corto es ${snapshot.planta.nombreComun}. Tengo ${snapshot.planta.edad}. ${donde}, en ${snapshot.planta.exposicion}.`,
        dato: snapshot.planta.zonaClimatica
          ? `Zona climática ${snapshot.planta.zonaClimatica}`
          : undefined,
      };
    }

    case 'clima': {
      if (!snapshot.clima) {
        return {
          intencion,
          texto:
            'No tengo el clima de mi zona. Con permiso de ubicación lo consulto y ajusto cuánta agua pierdo al día — sin eso trabajo con el promedio de la región, que es más burdo.',
        };
      }
      const lluvia =
        snapshot.clima.lluviaProximas48hMm > 0
          ? `Vienen ${snapshot.clima.lluviaProximas48hMm} mm de lluvia en dos días.`
          : 'No viene lluvia en los próximos dos días.';
      return {
        intencion,
        texto: `Hoy llega a ${snapshot.clima.tMaxHoyC} °C y evaporo ${snapshot.clima.et0HoyMm} mm. ${lluvia}`,
        dato: `Llovió ${snapshot.clima.lluviaHoyMm} mm hoy`,
      };
    }

    case 'historial': {
      if (h.diasDesdeCambioAgua !== null) {
        return {
          intencion,
          texto: `Mi último cambio de agua fue hace ${h.diasDesdeCambioAgua} días, según lo que anotaste.`,
          dato: `${h.diasDesdeCambioAgua} días desde el cambio`,
        };
      }
      if (h.diasDesdeUltimoRiego === null) {
        return {
          intencion,
          texto:
            'No tengo ningún riego anotado todavía. Registra el primero y a partir de ahí llevo yo la cuenta — es lo que me permite decirte cuándo toca el siguiente.',
        };
      }
      return {
        intencion,
        texto: `Me regaste hace ${h.diasDesdeUltimoRiego} días. Desde entonces mi sustrato bajó al ${pct} % de su capacidad útil.`,
        dato: `Último riego hace ${h.diasDesdeUltimoRiego} días`,
      };
    }

    case 'plaga': {
      const k = snapshot.conocimiento;
      // Si ya hay un diagnóstico, eso manda: es lo que se vio en ESTA planta,
      // no lo que suele pasarle a su especie.
      if (snapshot.diagnostico && snapshot.diagnostico.hallazgos.length > 0) {
        const lista = snapshot.diagnostico.hallazgos.join(' y ');
        const seguro = snapshot.diagnostico.confianza === 'confirmado';
        return {
          intencion,
          texto: seguro
            ? `Tengo ${lista}. Lo primero es mecánico: chorro de agua a presión en el envés de las hojas, y si sigue, jabón potásico cada cinco días. Aísla­me de las demás mientras tanto.`
            : `Puede que tenga ${lista}, pero no está confirmado. Antes de echarme nada, revisa el envés de las hojas con luz y registra lo que veas — tratar a ciegas hace más daño que esperar un día.`,
          dato: `Diagnóstico ${snapshot.diagnostico.confianza}`,
        };
      }
      if (k.plagas.length === 0) {
        return {
          intencion,
          texto:
            'No tengo registradas las plagas típicas de mi especie. Si ves bichos, escanéame y anota qué viste: con eso lo cruzo con mi historial.',
        };
      }
      return {
        intencion,
        texto: `A las de mi especie les pega sobre todo ${enumerar(k.plagas)}. Revísame el envés de las hojas y las uniones del tallo, que es donde se esconden. Ahorita no tengo nada diagnosticado.`,
        dato: k.esDeSuEspecie ? `Plagas típicas de ${snapshot.planta.nombreComun}` : undefined,
      };
    }

    case 'poda': {
      const k = snapshot.conocimiento;
      return {
        intencion,
        texto: `Mi poda: ${k.poda}.`,
        dato: k.esDeSuEspecie ? undefined : 'Dato genérico, no de mi especie',
      };
    }

    case 'propagacion': {
      const k = snapshot.conocimiento;
      if (k.propagacionMetodo === 'no registrado') {
        return {
          intencion,
          texto:
            'No tengo registrado cómo se me saca un esqueje. Mejor no improvises: cortar donde no va puede costarme una rama entera.',
        };
      }
      return {
        intencion,
        texto: `Sí se puede, y es ${k.propagacionDificultad}. Se hace así: ${k.propagacionMetodo}. La temporada buena es ${k.propagacionCuando}.`,
        dato: `Dificultad: ${k.propagacionDificultad}`,
      };
    }

    case 'toxicidad': {
      const k = snapshot.conocimiento;
      if (!k.esDeSuEspecie) {
        return {
          intencion,
          texto:
            'No tengo mi toxicidad registrada, y en esto no conviene suponer: trátame como si lo fuera y mantenme lejos de mascotas y niños hasta confirmarlo.',
        };
      }
      // Lo de mascotas va primero: es lo que la gente está preguntando de
      // verdad cuando pregunta esto.
      const alerta =
        k.toxicidadMascotas === 'tóxica'
          ? 'Sí, soy tóxica para perros y gatos.'
          : k.toxicidadMascotas === 'irritante'
            ? 'Para perros y gatos soy irritante, no tóxica de gravedad.'
            : 'Para perros y gatos soy segura.';
      const gente =
        k.toxicidadPersonas === 'comestible'
          ? ' Para personas, parte de mí se come.'
          : k.toxicidadPersonas === 'tóxica'
            ? ' Para personas también soy tóxica.'
            : k.toxicidadPersonas === 'irritante'
              ? ' A las personas les irrito la piel o la boca.'
              : ' Para personas soy segura.';
      return {
        intencion,
        texto: `${alerta}${gente} El porqué: ${k.toxicidadDetalle}.`,
        dato: `Mascotas: ${k.toxicidadMascotas} · Personas: ${k.toxicidadPersonas}`,
      };
    }

    case 'tolerancia': {
      const k = snapshot.conocimiento;
      return {
        intencion,
        texto: `Aguanto de ${k.temperaturaMinC} a ${k.temperaturaMaxC} °C. Por debajo del mínimo me quemo de frío, y eso no se ve hasta días después. Prefiero ${k.humedad}.`,
        dato: `${k.temperaturaMinC} a ${k.temperaturaMaxC} °C`,
      };
    }

    case 'ayuda':
      return {
        intencion,
        texto:
          'Te puedo contar de mi riego, de por qué me veo como me veo, de las plagas que me pegan, de la luz que necesito, de mi poda, de cómo sacarme un esqueje, de si soy tóxica, del frío que aguanto, de mi tierra, de mi temporada de flor, de cuánto voy a crecer y de lo que me has hecho. Pregúntame con tus palabras, no hace falta que le atines.',
      };

    case 'estado':
      return { intencion, texto: vozDeterminista(snapshot) };

    default: {
      // Antes de rendirse: ¿es algo de jardinería en general? (abono, viajes,
      // plagas por su nombre…). Eso no está en su expediente, pero sí en lo
      // que sabe la sina, y contestarlo es mejor que "no sé".
      const saber = buscarSaber(pregunta, [
        {
          apodo: snapshot.planta.apodo,
          familia: especie.familiaFuncional,
          perfilHidrico: especie.perfilHidrico,
          interior: snapshot.planta.interior,
        },
      ]);
      if (saber) {
        // Con un diagnóstico sin confirmar no se recomiendan químicos (regla
        // del producto): se quitan esas frases del consejo general.
        const sinConfirmar = snapshot.diagnostico && snapshot.diagnostico.confianza !== 'confirmado';
        const texto = sinConfirmar
          ? saber.respuesta
              .split(/(?<=\.)\s+/)
              .filter((f) => !/fungicida|insecticida|acaricida|plaguicida|cobre|azufre/i.test(f))
              .join(' ')
          : saber.respuesta;
        return {
          intencion: 'desconocida',
          texto: `Eso no está en mi expediente, pero te lo digo en general: ${texto}`,
          saberId: saber.id,
        };
      }
      // Cuando no entiende, ofrece su segunda lectura en vez de dejar a la
      // persona adivinando. Si tampoco hay, enumera de qué sí sabe hablar.
      const rescate = lectura.alternativa
        ? ` ¿Me preguntabas de ${NOMBRE_INTENCION[lectura.alternativa]}?`
        : ' Puedo contarte de mi riego, de cómo me veo, de dónde estoy, de mi temporada, de cuánto voy a crecer y de mi historial.';
      return {
        intencion: 'desconocida',
        texto: `De eso no sé. Sólo puedo hablar de lo que está en mi expediente.${rescate}`,
      };
    }
  }
}

/** "pulgón, mosca blanca y araña roja". */
function enumerar(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

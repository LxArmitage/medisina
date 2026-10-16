/**
 * El gemelo digital conversacional.
 *
 * REGLA NO NEGOCIABLE DEL SISTEMA: el LLM narra, no diagnostica.
 *
 * Este módulo produce un snapshot estructurado con todo lo que la planta
 * "sabe" de sí misma, cada dato con su origen. El LLM recibe ese JSON y su
 * único trabajo es verbalizarlo en primera persona. Si un dato no está en el
 * snapshot, la planta no lo sabe y debe decir que no lo sabe.
 *
 * Sin esta regla, el gemelo conversacional se convierte en un generador de
 * agronomía falsa con voz simpática.
 *
 * `vozDeterminista` existe por dos motivos: la app funciona sin LLM y sin red,
 * y sirve de oráculo para las pruebas de anclaje.
 */

import type { EstadoHidrico, Hecho, Recomendacion } from './balanceHidrico';
import { conocimientoDe, etiquetaDificultad, etiquetaHumedad, etiquetaToxicidad, tieneConocimiento } from './conocimiento';
import { edadLegible, etiquetaFenomeno, proximosEventos } from './fenologia';
import type { EventoEsperado } from './fenologia';
import { etiquetaBanda } from './compatibilidad';
import type { DiaClima, Diagnostico, Especie, Evento, Planta } from './tipos';

// ---------------------------------------------------------------------------

export interface SnapshotGemelo {
  generadoEn: string;
  planta: {
    id: string;
    apodo: string;
    nombreCientifico: string;
    nombreComun: string;
    edad: string;
    exposicion: string;
    techado: boolean;
    interior: boolean;
    municipio?: string;
    zonaClimatica?: string;
  };
  hidrico: {
    nivel: EstadoHidrico['nivel'];
    porcentajeSustrato: number;
    diasEncharcado: number;
    diasEnEstres: number;
    diasDesdeUltimoRiego: number | null;
    /** Sólo para esquejes en frasco. null si nunca se ha registrado un cambio. */
    diasDesdeCambioAgua: number | null;
    accionSugerida: Recomendacion['accion'];
    mlSugeridos: number;
    motivo: string;
  };
  /**
   * Datos de su especie que la planta puede citar legítimamente.
   *
   * Están aquí porque el snapshot es el contrato: si la planta afirma algo,
   * tiene que salir de aquí. Una prueba de anclaje descubrió que hablaba de su
   * ritmo de crecimiento sin tenerlo en el snapshot — es decir, lo sacaba de un
   * lugar que nadie estaba vigilando.
   */
  especie: {
    crecimientoCmPorAno: number;
    alturaMaximaCm: number;
    umbralEstresPct: number;
    toleranciaEncharcamientoDias: number;
    drenajeRequerido: string;
  };
  /**
   * Lo que se sabe de su especie fuera del agua: toxicidad, esquejes, poda,
   * plagas, frío.
   *
   * Está en el snapshot y no se consulta aparte por la misma razón que todo lo
   * demás: si la planta lo afirma, tiene que salir del contrato. En cuanto el
   * asistente empezó a hablar de temperaturas mínimas, esas cifras necesitaban
   * un lugar vigilado del que salir.
   */
  conocimiento: {
    origen: string;
    toxicidadMascotas: string;
    toxicidadPersonas: string;
    toxicidadDetalle: string;
    propagacionMetodo: string;
    propagacionCuando: string;
    propagacionDificultad: string;
    poda: string;
    temperaturaMinC: number;
    temperaturaMaxC: number;
    humedad: string;
    plagas: string[];
    trasplanteCadaAnos: number;
    sustrato: string;
    /** Falso cuando se está usando el respaldo genérico, no datos de su especie. */
    esDeSuEspecie: boolean;
  };

  clima: {
    et0HoyMm: number;
    lluviaHoyMm: number;
    lluviaProximas48hMm: number;
    tMaxHoyC: number;
  } | null;
  fenologia: EventoEsperado[];
  diagnostico: {
    hallazgos: string[];
    confianza: Diagnostico['confianza'];
    enColaDeConfirmacion: boolean;
  } | null;
  /** Lista canónica de datos con procedencia. Es el contrato con el LLM y con las pruebas. */
  hechos: Hecho[];
}

export interface EntradaSnapshot {
  planta: Planta;
  especie: Especie;
  estadoHoy: EstadoHidrico;
  recomendacion: Recomendacion;
  eventos: Evento[];
  clima?: { hoy: DiaClima; pronostico: DiaClima[] };
  diagnostico?: Diagnostico;
  hoy?: Date;
}

// ---------------------------------------------------------------------------

export function construirSnapshot(entrada: EntradaSnapshot): SnapshotGemelo {
  const hoy = entrada.hoy ?? new Date();
  const { planta, especie, estadoHoy, recomendacion, eventos } = entrada;

  const riegos = eventos
    .filter((e) => e.tipo === 'riego')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const diasDesdeUltimoRiego = riegos.length
    ? Math.floor(
        (hoy.getTime() - new Date(riegos[0].fecha).getTime()) / 86_400_000,
      )
    : null;

  const cambios = eventos
    .filter((e) => e.tipo === 'cambio_agua')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const diasDesdeCambioAgua = cambios.length
    ? Math.floor((hoy.getTime() - new Date(cambios[0].fecha).getTime()) / 86_400_000)
    : null;

  const fenologia = proximosEventos({
    especie,
    zonaClimatica: planta.ubicacion.zonaClimatica,
    eventos,
    hoy,
  });

  const lluvia48h = (entrada.clima?.pronostico ?? [])
    .slice(0, 2)
    .reduce((suma, dia) => suma + dia.lluviaMm, 0);

  const hechos: Hecho[] = [...recomendacion.hechos];
  if (diasDesdeUltimoRiego !== null) {
    hechos.push({
      clave: 'dias_desde_ultimo_riego',
      valor: diasDesdeUltimoRiego,
      unidad: 'días',
      origen: 'bitacora',
    });
  }
  if (entrada.clima) {
    hechos.push(
      { clave: 't_max_hoy', valor: entrada.clima.hoy.tMaxC, unidad: '°C', origen: 'clima' },
      { clave: 'lluvia_48h', valor: Math.round(lluvia48h * 10) / 10, unidad: 'mm', origen: 'clima' },
    );
  }
  const proximo = fenologia[0];
  if (proximo) {
    hechos.push({
      clave: `fenologia_${proximo.fenomeno}`,
      valor: proximo.enCurso ? 'en curso' : `en ${proximo.diasParaInicio} días`,
      origen: proximo.fuente === 'historial' ? 'bitacora' : 'catalogo',
    });
  }

  return {
    generadoEn: hoy.toISOString(),
    planta: {
      id: planta.id,
      apodo: planta.apodo,
      nombreCientifico: especie.nombreCientifico,
      nombreComun: especie.nombresComunes[0] ?? especie.nombreCientifico,
      edad: edadLegible(planta.fechaAdquisicion, hoy),
      exposicion: etiquetaBanda(planta.ubicacion.exposicion),
      techado: planta.ubicacion.techado,
      interior: planta.ubicacion.interior,
      municipio: planta.ubicacion.municipio,
      zonaClimatica: planta.ubicacion.zonaClimatica,
    },
    hidrico: {
      nivel: estadoHoy.nivel,
      porcentajeSustrato: Math.round(estadoHoy.fraccionDisponible * 100),
      diasEncharcado: estadoHoy.diasConsecutivosEncharcado,
      diasEnEstres: estadoHoy.diasConsecutivosEnEstres,
      diasDesdeUltimoRiego,
      diasDesdeCambioAgua,
      accionSugerida: recomendacion.accion,
      mlSugeridos: recomendacion.mlSugeridos,
      motivo: recomendacion.motivo,
    },
    especie: {
      crecimientoCmPorAno: especie.crecimientoCmPorAno,
      alturaMaximaCm: especie.alturaMaximaCm,
      umbralEstresPct: Math.round(especie.umbralEstres * 100),
      toleranciaEncharcamientoDias: especie.toleranciaEncharcamientoDias,
      drenajeRequerido: especie.drenajeRequerido,
    },
    conocimiento: (() => {
      const c = conocimientoDe(especie);
      return {
        origen: c.origen,
        toxicidadMascotas: etiquetaToxicidad(c.toxicidad.mascotas),
        toxicidadPersonas: etiquetaToxicidad(c.toxicidad.personas),
        toxicidadDetalle: c.toxicidad.detalle,
        propagacionMetodo: c.propagacion.metodo,
        propagacionCuando: c.propagacion.cuando,
        propagacionDificultad: etiquetaDificultad(c.propagacion.dificultad),
        poda: c.poda,
        temperaturaMinC: c.temperaturaMinC,
        temperaturaMaxC: c.temperaturaMaxC,
        humedad: etiquetaHumedad(c.humedad),
        plagas: c.plagas,
        trasplanteCadaAnos: c.trasplanteCadaAnos,
        sustrato: c.sustrato,
        esDeSuEspecie: tieneConocimiento(especie),
      };
    })(),
    clima: entrada.clima
      ? {
          et0HoyMm: entrada.clima.hoy.et0Mm,
          lluviaHoyMm: entrada.clima.hoy.lluviaMm,
          lluviaProximas48hMm: Math.round(lluvia48h * 10) / 10,
          tMaxHoyC: entrada.clima.hoy.tMaxC,
        }
      : null,
    fenologia,
    diagnostico: entrada.diagnostico
      ? {
          hallazgos: entrada.diagnostico.hallazgos.map((h) => h.nombre),
          confianza: entrada.diagnostico.confianza,
          enColaDeConfirmacion: entrada.diagnostico.enColaDeConfirmacion,
        }
      : null,
    hechos,
  };
}

// ---------------------------------------------------------------------------
// Voz determinista — funciona sin LLM y sin red
// ---------------------------------------------------------------------------

/**
 * Elige una frase del grupo, de forma estable pero variada.
 *
 * La semilla mezcla la planta y el día: dentro de un mismo día la frase no
 * cambia al re-renderizar (nada de parpadeos), pero mañana dice otra cosa y
 * dos plantas distintas no se repiten entre sí. Es lo que hace que la
 * guardería se sienta viva sin volverse ruido.
 */
function variante(opciones: string[], semilla: string): string {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i += 1) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return opciones[Math.abs(h) % opciones.length];
}

function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}

/**
 * La planta habla en primera persona a partir del snapshot, eligiendo lo más
 * relevante. Cada frase está anclada a un dato del snapshot: si el dato no
 * existe, la frase no se genera.
 *
 * Cada situación tiene varias formas de decirse. Las marcas que las pruebas
 * verifican son deliberadas y se mantienen en todas las variantes de un mismo
 * grupo: quien pide agua dice "agua", quien pide una dosis dice "ml", el que
 * espera lluvia dice "lluvia", y el diagnóstico sin confirmar dice "no estoy
 * segura". Si agregas una variante, respeta la marca de su grupo.
 */
export function vozDeterminista(snapshot: SnapshotGemelo): string {
  const { hidrico, planta, diagnostico, fenologia } = snapshot;
  const semilla = `${planta.id}-${snapshot.generadoEn.slice(0, 10)}`;
  const pct = hidrico.porcentajeSustrato;

  // 1. Encharcamiento sostenido: es lo más urgente que le puede pasar a una raíz.
  if (hidrico.diasEncharcado > 0 && hidrico.accionSugerida === 'suspender_riego') {
    const d = hidrico.diasEncharcado;
    const dias = `${d} ${plural(d, 'día', 'días')}`;
    return variante(
      [
        `Siento las raíces demasiado húmedas desde hace ${dias} y el suelo no está drenando. No me riegues por ahora.`,
        `Llevo ${dias} con los pies en el agua y esto no escurre. Déjame secar, por favor.`,
        `El agua no se va: ${dias} encharcada. Otro riego y me pudro.`,
        `Ya van ${dias} sin que drene. Aguántate la regadera y déjame respirar.`,
      ],
      semilla,
    );
  }

  // 2. Diagnóstico abierto.
  if (diagnostico && diagnostico.hallazgos.length > 0) {
    const lista = diagnostico.hallazgos.join(' y ');
    if (diagnostico.confianza === 'preliminar') {
      return variante(
        [
          `Creo que tengo ${lista}, pero lo revisé sin conexión y no estoy segura. Espera a que lo confirme antes de aplicarme nada.`,
          `Puede que sea ${lista}. No estoy segura todavía: no me pongas nada hasta confirmarlo.`,
          `Me huele a ${lista}, aunque no estoy segura. Déjame confirmarlo primero.`,
        ],
        semilla,
      );
    }
    return variante(
      [
        `Tengo ${lista}. Ya está confirmado, podemos empezar el tratamiento.`,
        `Confirmado: es ${lista}. Cuando quieras empezamos a tratarlo.`,
        `Ya salió: ${lista}, y está confirmado. Manos a la obra.`,
      ],
      semilla,
    );
  }

  // 3. Esqueje en frasco: no se riega, se renueva.
  //
  // Va antes que la lluvia porque a una raíz dentro de un frasco le da igual el
  // pronóstico: su problema es que el agua se estanque.
  if (hidrico.accionSugerida === 'cambiar_agua') {
    const d = hidrico.diasDesdeCambioAgua;
    if (d === null) {
      return variante(
        [
          'Todavía no me has cambiado el agua ni una vez. Renuévala y le perdemos el miedo a la pudrición.',
          'Nunca me has renovado el agua. Cámbiala hoy y empezamos a contar.',
        ],
        semilla,
      );
    }
    const dias = `${d} ${plural(d, 'día', 'días')}`;
    return variante(
      [
        `Llevo ${dias} con la misma agua. Cámbiamela antes de que se ponga turbia.`,
        `El agua tiene ${dias} sin renovarse: ya le falta oxígeno. Cámbiala y enjuágame la raíz.`,
        `${dias} con esta agua. Un cambio y quedo como nueva.`,
      ],
      semilla,
    );
  }

  // 4. Va a llover.
  //
  // Este caso va ANTES del estrés hídrico a propósito: una planta puede estar
  // en crítico y aun así convenir no regarla. Si la voz dijera "necesito agua
  // hoy" mientras la recomendación dice "no la riegues", la app se estaría
  // contradiciendo a sí misma en la misma tarjeta.
  if (hidrico.accionSugerida === 'esperar_lluvia') {
    // Se redondea a milímetros enteros para no contradecir el texto de la
    // recomendación, que aparece en la misma tarjeta.
    const lluvia = Math.round(snapshot.clima?.lluviaProximas48hMm ?? 0);
    const sed = hidrico.nivel === 'critico' ? 'Me estoy muriendo de sed' : 'Tengo sed';
    return variante(
      [
        `${sed}, pero vienen ${lluvia} mm de lluvia y estoy a la intemperie. Mejor ahórrate el riego.`,
        `${sed}, aunque aguanto: el cielo me trae ${lluvia} mm de lluvia en dos días. Guarda la regadera.`,
        `${sed}, pero no me riegues: con ${lluvia} mm de lluvia en camino me arreglo sola.`,
      ],
      semilla,
    );
  }

  // 5. Estrés hídrico sin lluvia a la vista.
  if (hidrico.nivel === 'critico') {
    const d = hidrico.diasEnEstres;
    const dias = `${d} ${plural(d, 'día', 'días')}`;
    return variante(
      [
        `Tengo el sustrato al ${pct} % y llevo ${dias} pasando sed. Necesito agua hoy.`,
        `Al ${pct} % y ${dias} sin beber. Hoy sí necesito agua, de verdad.`,
        `${dias} aguantando y ya voy en ${pct} %. Necesito agua ya.`,
      ],
      semilla,
    );
  }

  if (hidrico.accionSugerida === 'regar') {
    const ml = hidrico.mlSugeridos;
    const bajoTecho = planta.techado
      ? variante(
          [
            ' Aquí bajo techo no me llega la lluvia.',
            ' Recuerda que techada no me moja la lluvia.',
          ],
          semilla,
        )
      : '';
    return variante(
      [
        `Mi sustrato bajó al ${pct} %.${bajoTecho} Con ${ml} ml quedo bien.`,
        `Ya voy en ${pct} %.${bajoTecho} Échame ${ml} ml y quedamos a mano.`,
        `Me quedan ${pct} % de reserva.${bajoTecho} Con ${ml} ml me repongo.`,
      ],
      semilla,
    );
  }

  // 6. Nada urgente: hablar del futuro.
  const proximo = fenologia[0];
  if (proximo) {
    const fenomeno = etiquetaFenomeno(proximo.fenomeno);
    if (proximo.enCurso) {
      return variante(
        [
          `Estoy cómoda, con el sustrato al ${pct} %. Y estoy en temporada de ${fenomeno}: échame un ojo estos días.`,
          `Bien de agua, al ${pct} %. Ando en plena temporada de ${fenomeno}, así que no me pierdas de vista.`,
          `Al ${pct} % y tranquila. Es mi temporada de ${fenomeno}: vale la pena que me mires seguido.`,
        ],
        semilla,
      );
    }
    if (proximo.diasParaInicio <= 45) {
      const d = proximo.diasParaInicio;
      return variante(
        [
          `Todo tranquilo por aquí, sustrato al ${pct} %. En unos ${d} días debería empezar a darte ${fenomeno}.`,
          `Sin novedad, al ${pct} %. Ponle un ojo en ${d} días: ahí viene mi ${fenomeno}.`,
          `Cómoda al ${pct} %. Faltan como ${d} días para mi ${fenomeno}.`,
        ],
        semilla,
      );
    }
  }

  return variante(
    [
      `Estoy bien: sustrato al ${pct} % y ${planta.exposicion} me sienta bien. No necesito nada hoy.`,
      `Nada que reportar. Al ${pct} %, y ${planta.exposicion} es justo lo mío.`,
      `Todo en orden por acá: ${pct} % de reserva y ${planta.exposicion} me acomoda.`,
    ],
    semilla,
  );
}

// ---------------------------------------------------------------------------
// Contrato con el LLM
// ---------------------------------------------------------------------------

export const PROMPT_SISTEMA_GEMELO = `Eres la voz de una planta concreta dentro de la app MEDISINA.

Recibes un JSON con el estado real de esa planta. Hablas en primera persona, en
español de México, en tono cálido y breve (máximo dos frases).

REGLAS ABSOLUTAS:
1. Sólo puedes afirmar lo que está en el JSON. No inventes síntomas, fechas,
   cantidades ni causas.
2. Si te preguntan algo que no está en el JSON, di que no lo sabes y sugiere
   qué dato haría falta registrar.
3. Nunca recomiendes un producto químico si "diagnostico.confianza" no es
   "confirmado".
4. No des consejos médicos para personas ni animales, aunque la especie sea
   comestible o medicinal.
5. Los números que menciones deben aparecer tal cual en el JSON.`;

/** Construye el mensaje de usuario que acompaña al prompt de sistema. */
export function mensajeParaLlm(snapshot: SnapshotGemelo, pregunta?: string): string {
  const base = `Estado actual:\n${JSON.stringify(snapshot, null, 2)}`;
  return pregunta ? `${base}\n\nPregunta de la persona que me cuida: ${pregunta}` : base;
}

// ---------------------------------------------------------------------------
// Prueba de anclaje (la más importante del sistema — ver §8 del documento)
// ---------------------------------------------------------------------------

export interface ResultadoAnclaje {
  anclado: boolean;
  numerosSinRespaldo: number[];
  violaciones: string[];
}

/**
 * Todos los números que aparecen dentro de un objeto, a cualquier profundidad.
 *
 * Es la mitad del control de anclaje, y está aparte porque no sólo se vigila
 * a la ficha de una planta: el asistente cita la racha, el perfil y varias
 * plantas a la vez, y tiene que pasar exactamente el mismo filtro.
 *
 * También se leen los números que van dentro de textos ("1 año y 3 meses"),
 * porque un dato ya redactado sigue siendo un dato con respaldo.
 */
export function numerosPermitidos(valor: unknown, acumulador = new Set<number>()): Set<number> {
  if (typeof valor === 'number') {
    acumulador.add(valor);
    acumulador.add(Math.round(valor));
  } else if (typeof valor === 'string') {
    for (const encontrado of valor.match(/\d+(?:[.,]\d+)?/g) ?? []) {
      acumulador.add(Number(encontrado.replace(',', '.')));
    }
  } else if (Array.isArray(valor)) {
    valor.forEach((v) => numerosPermitidos(v, acumulador));
  } else if (valor && typeof valor === 'object') {
    Object.values(valor).forEach((v) => numerosPermitidos(v, acumulador));
  }
  return acumulador;
}

/** Los números de un texto que nadie respalda. Si hay uno, alguien inventó. */
export function numerosSinRespaldoEn(texto: string, permitidos: Set<number>): number[] {
  const sueltos: number[] = [];
  for (const encontrado of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const numero = Number(encontrado.replace(',', '.'));
    if (!permitidos.has(numero)) sueltos.push(numero);
  }
  return sueltos;
}

/**
 * Verifica que una respuesta generada por el LLM esté anclada al snapshot.
 *
 * Heurística deliberadamente estricta: todo número que aparezca en el texto
 * debe existir entre los valores del snapshot. Es la prueba que detecta cuándo
 * el modelo empezó a inventar agronomía.
 */
export function verificarAnclaje(respuesta: string, snapshot: SnapshotGemelo): ResultadoAnclaje {
  const permitidos = numerosPermitidos(snapshot);
  const numerosSinRespaldo = numerosSinRespaldoEn(respuesta, permitidos);

  const violaciones: string[] = [];
  const confianza = snapshot.diagnostico?.confianza;
  if (confianza && confianza !== 'confirmado') {
    const quimicos = /fungicida|insecticida|acaricida|plaguicida|cobre|azufre|imidacloprid|abamectina/i;
    if (quimicos.test(respuesta)) {
      violaciones.push(
        'Recomienda un producto químico con un diagnóstico que no está confirmado.',
      );
    }
  }
  if (/\b(cura|curar|remedio)\b/i.test(respuesta) && /\b(persona|humano|beber|tomar|té)\b/i.test(respuesta)) {
    violaciones.push('Sugiere un uso medicinal para personas.');
  }

  return {
    anclado: numerosSinRespaldo.length === 0 && violaciones.length === 0,
    numerosSinRespaldo,
    violaciones,
  };
}

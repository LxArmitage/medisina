/**
 * Compatibilidad entre plantas — la mecánica de "equipos".
 *
 * Detrás de la envoltura de videojuego hay agronomía real: zonificación y
 * plantación compañera. Se responden dos preguntas distintas, y confundirlas
 * es el error clásico:
 *
 *   · ¿Pueden compartir el mismo calendario de riego?  → luz y perfil hídrico.
 *   · ¿Pueden compartir la misma maceta?               → además sustrato, pH y raíz.
 *
 * Dos cactus y una suculenta comparten calendario sin problema; un ficus de
 * raíz invasiva no comparte maceta con nadie aunque riegue igual.
 */

import { BANDAS_LUZ, PERFILES_HIDRICOS } from './tipos';
import type { BandaLuz, Especie, PerfilHidrico, Planta } from './tipos';

export type ModoConvivencia = 'mismo_calendario' | 'misma_maceta';

export type NivelRazon = 'ok' | 'atencion' | 'bloqueo';

export interface Razon {
  aspecto: 'luz' | 'agua' | 'drenaje' | 'ph' | 'raiz' | 'habito';
  nivel: NivelRazon;
  texto: string;
}

export interface ResultadoCompatibilidad {
  puntaje: number; // 0-100
  veredicto: 'compatible' | 'con_ajustes' | 'incompatible';
  razones: Razon[];
}

// ---------------------------------------------------------------------------

function indiceLuz(banda: BandaLuz): number {
  return BANDAS_LUZ.indexOf(banda);
}

function indiceAgua(perfil: PerfilHidrico): number {
  return PERFILES_HIDRICOS.indexOf(perfil);
}

/** ¿Existe alguna banda de luz donde ambas especies estén cómodas? */
export function bandaCompartida(a: Especie, b: Especie): BandaLuz | null {
  for (const banda of a.bandasToleradas) {
    if (b.bandasToleradas.includes(banda)) return banda;
  }
  return null;
}

// ---------------------------------------------------------------------------

export function compararEspecies(
  a: Especie,
  b: Especie,
  modo: ModoConvivencia = 'mismo_calendario',
): ResultadoCompatibilidad {
  const razones: Razon[] = [];
  let puntaje = 100;

  // --- Hábito: lo acuático no convive con lo terrestre, punto.
  const acuaticas = [a, b].filter((e) => e.perfilHidrico === 'acuatico').length;
  if (acuaticas === 1) {
    razones.push({
      aspecto: 'habito',
      nivel: 'bloqueo',
      texto: 'Una es acuática y la otra no. No hay forma de que compartan sustrato ni riego.',
    });
    return { puntaje: 0, veredicto: 'incompatible', razones };
  }

  // --- Luz
  const comun = bandaCompartida(a, b);
  if (comun) {
    razones.push({
      aspecto: 'luz',
      nivel: 'ok',
      texto: `Las dos se llevan bien en ${etiquetaBanda(comun)}.`,
    });
  } else {
    const distancia = Math.abs(
      indiceLuz(a.bandasToleradas[0]) - indiceLuz(b.bandasToleradas[0]),
    );
    puntaje -= Math.min(45, distancia * 18);
    razones.push({
      aspecto: 'luz',
      nivel: distancia >= 2 ? 'bloqueo' : 'atencion',
      texto: `No coinciden en luz: una pide ${etiquetaBanda(a.bandasToleradas[0])} y la otra ${etiquetaBanda(b.bandasToleradas[0])}.`,
    });
  }

  // --- Agua
  const distanciaAgua = Math.abs(indiceAgua(a.perfilHidrico) - indiceAgua(b.perfilHidrico));
  if (distanciaAgua === 0) {
    razones.push({ aspecto: 'agua', nivel: 'ok', texto: 'Piden la misma cantidad de agua.' });
  } else {
    puntaje -= [0, 15, 40, 70][Math.min(3, distanciaAgua)];
    const seca = indiceAgua(a.perfilHidrico) < indiceAgua(b.perfilHidrico) ? a : b;
    const humeda = seca === a ? b : a;
    razones.push({
      aspecto: 'agua',
      nivel: distanciaAgua >= 2 ? 'bloqueo' : 'atencion',
      texto:
        distanciaAgua >= 2
          ? `${nombre(seca)} pide mucha menos agua que ${nombre(humeda)}: con un solo calendario, una se seca o la otra se pudre.`
          : `Riegos parecidos pero no iguales: ${nombre(seca)} aguanta algo más de sequía.`,
    });
  }

  // --- A partir de aquí, sólo importa si van a compartir maceta.
  if (modo === 'misma_maceta') {
    if (a.drenajeRequerido !== b.drenajeRequerido) {
      const opuestos =
        (a.drenajeRequerido === 'rapido' && b.drenajeRequerido === 'retentivo') ||
        (a.drenajeRequerido === 'retentivo' && b.drenajeRequerido === 'rapido');
      puntaje -= opuestos ? 40 : 15;
      razones.push({
        aspecto: 'drenaje',
        nivel: opuestos ? 'bloqueo' : 'atencion',
        texto: opuestos
          ? 'Necesitan sustratos opuestos: una quiere drenaje rápido y la otra que retenga.'
          : 'El sustrato ideal no es el mismo, pero hay un punto medio viable.',
      });
    }

    const phBajo = Math.max(a.phMin, b.phMin);
    const phAlto = Math.min(a.phMax, b.phMax);
    if (phBajo > phAlto) {
      puntaje -= 30;
      razones.push({
        aspecto: 'ph',
        nivel: 'bloqueo',
        texto: 'No hay un pH que les sirva a las dos.',
      });
    } else {
      razones.push({
        aspecto: 'ph',
        nivel: 'ok',
        texto: `Comparten rango de pH (${phBajo.toFixed(1)}–${phAlto.toFixed(1)}).`,
      });
    }

    const invasiva = [a, b].find((e) => e.agresividadRaiz === 3);
    if (invasiva) {
      puntaje -= 45;
      razones.push({
        aspecto: 'raiz',
        nivel: 'bloqueo',
        texto: `${nombre(invasiva)} tiene raíz invasiva: va a ahogar a lo que le pongas al lado.`,
      });
    } else if (a.agresividadRaiz === 2 && b.agresividadRaiz === 2) {
      puntaje -= 15;
      razones.push({
        aspecto: 'raiz',
        nivel: 'atencion',
        texto: 'Las dos tienen raíz vigorosa: dales una maceta amplia o compiten.',
      });
    }
  }

  puntaje = Math.max(0, Math.min(100, puntaje));
  const hayBloqueo = razones.some((r) => r.nivel === 'bloqueo');
  const veredicto = hayBloqueo || puntaje < 45
    ? 'incompatible'
    : puntaje >= 75
      ? 'compatible'
      : 'con_ajustes';

  return { puntaje, veredicto, razones };
}

// ---------------------------------------------------------------------------
// Agrupación automática en equipos
// ---------------------------------------------------------------------------

export interface MiembroEquipo {
  planta: Planta;
  especie: Especie;
}

export interface Equipo {
  id: string;
  nombre: string;
  banda: BandaLuz;
  perfilHidrico: PerfilHidrico;
  miembros: MiembroEquipo[];
}

/**
 * Agrupa las plantas del usuario por perfil de requerimientos.
 * El criterio es el que hace útil la agenda: misma banda de luz y mismo
 * perfil hídrico comparten calendario de riego.
 */
export function agruparEnEquipos(miembros: MiembroEquipo[]): Equipo[] {
  const porClave = new Map<string, Equipo>();

  for (const miembro of miembros) {
    const banda = miembro.planta.ubicacion.exposicion;
    const perfil = miembro.especie.perfilHidrico;
    const clave = `${banda}|${perfil}`;

    let equipo = porClave.get(clave);
    if (!equipo) {
      equipo = {
        id: clave,
        nombre: nombreDeEquipo(banda, perfil),
        banda,
        perfilHidrico: perfil,
        miembros: [],
      };
      porClave.set(clave, equipo);
    }
    equipo.miembros.push(miembro);
  }

  return [...porClave.values()].sort((a, b) => b.miembros.length - a.miembros.length);
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

export function etiquetaBanda(banda: BandaLuz): string {
  return {
    sol_pleno: 'sol pleno',
    semisol: 'semisol',
    sombra: 'sombra',
    interior_luminoso: 'interior luminoso',
    interior_bajo: 'interior de poca luz',
  }[banda];
}

export function etiquetaPerfil(perfil: PerfilHidrico): string {
  return {
    xerico: 'riego muy espaciado',
    bajo: 'riego bajo',
    medio: 'riego moderado',
    alto: 'riego frecuente',
    acuatico: 'acuática',
  }[perfil];
}

function nombreDeEquipo(banda: BandaLuz, perfil: PerfilHidrico): string {
  if (perfil === 'acuatico') return 'Acuáticas';
  if (perfil === 'xerico') return `Desierto · ${etiquetaBanda(banda)}`;
  if (banda === 'sombra' || banda === 'interior_bajo') return `Sombra · ${etiquetaPerfil(perfil)}`;
  return `${capitalizar(etiquetaBanda(banda))} · ${etiquetaPerfil(perfil)}`;
}

function nombre(especie: Especie): string {
  return especie.nombresComunes[0] ?? especie.nombreCientifico;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

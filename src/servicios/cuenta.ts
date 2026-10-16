/**
 * Dónde se guarda la cuenta y cómo se entra.
 *
 * El perfil (nombre, ciudad) va en los ajustes de la base local. La huella de
 * la contraseña va aparte, en el llavero del teléfono (Keychain en el iPhone),
 * que es el lugar que el sistema cuida para esto; en el navegador, donde no
 * hay llavero, en los ajustes.
 *
 * Face ID: se usa `expo-local-authentication`. En Expo Go, Apple no deja usar
 * Face ID a apps de terceros, así que el teléfono pide su código en su lugar —
 * sigue siendo el dueño del teléfono quien entra. En una app instalada, es
 * Face ID de verdad.
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { getRandomBytes } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { borrarTodo, guardarAjuste, leerAjuste } from '../datos/db';
import { crearCredencial, limpiarCorreo, verificarCredencial } from '../dominio/cuenta';
import type { Credencial, Perfil } from '../dominio/cuenta';
import type { Ubicacion } from '../dominio/tipos';

const CLAVE_PERFIL = 'cuenta:perfil';
const CLAVE_SESION = 'cuenta:sesion';
const CLAVE_CREDENCIAL = 'medisina.credencial';
/** La misma que usa el asistente para saludarte (`servicios/jardin.ts`). */
const CLAVE_NOMBRE_ASISTENTE = 'usuario:nombre';

// ---------------------------------------------------------------------------
// Almacén
// ---------------------------------------------------------------------------

async function guardarSecreto(valor: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    await guardarAjuste(`secreto:${CLAVE_CREDENCIAL}`, valor ?? '');
    return;
  }
  if (valor === null) await SecureStore.deleteItemAsync(CLAVE_CREDENCIAL);
  else await SecureStore.setItemAsync(CLAVE_CREDENCIAL, valor, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function leerSecreto(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const v = await leerAjuste(`secreto:${CLAVE_CREDENCIAL}`);
    return v || null;
  }
  return SecureStore.getItemAsync(CLAVE_CREDENCIAL);
}

export async function leerPerfil(): Promise<Perfil | null> {
  const crudo = await leerAjuste(CLAVE_PERFIL).catch(() => null);
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as Perfil;
  } catch {
    return null;
  }
}

export async function guardarPerfil(perfil: Perfil): Promise<void> {
  await guardarAjuste(CLAVE_PERFIL, JSON.stringify(perfil));
  // El asistente te llama por tu nombre: que sea el de la cuenta.
  await guardarAjuste(CLAVE_NOMBRE_ASISTENTE, perfil.nombre.split(/\s+/)[0] ?? perfil.nombre).catch(() => undefined);
  ciudadEnMemoria = undefined;
}

let ciudadEnMemoria: Perfil['ciudad'] | null | undefined;

/** La ciudad de la cuenta, para el clima. Se lee una vez y se recuerda. */
export async function ciudadDeLaCuenta(): Promise<Perfil['ciudad'] | undefined> {
  if (ciudadEnMemoria === undefined) ciudadEnMemoria = (await leerPerfil().catch(() => null))?.ciudad ?? null;
  return ciudadEnMemoria ?? undefined;
}

export async function sesionAbierta(): Promise<boolean> {
  return (await leerAjuste(CLAVE_SESION).catch(() => null)) === 'abierta';
}

async function marcarSesion(abierta: boolean): Promise<void> {
  await guardarAjuste(CLAVE_SESION, abierta ? 'abierta' : 'cerrada');
}

// ---------------------------------------------------------------------------
// Crear y entrar
// ---------------------------------------------------------------------------

/** Deja que la pantalla pinte el "entrando…" antes del cálculo, que tarda un momento. */
const respirar = () => new Promise<void>((r) => setTimeout(r, 30));

export async function crearCuentaConCorreo(
  datos: { nombre: string; correo: string; contrasena: string },
  resto: Pick<Perfil, 'ciudad' | 'desbloqueo'>,
): Promise<Perfil> {
  await respirar();
  const credencial = crearCredencial(datos.correo, datos.contrasena, getRandomBytes(16));
  await guardarSecreto(JSON.stringify(credencial));
  const perfil: Perfil = {
    nombre: datos.nombre.trim(),
    correo: limpiarCorreo(datos.correo),
    metodo: 'correo',
    ciudad: resto.ciudad,
    desbloqueo: resto.desbloqueo,
    creadoEn: new Date().toISOString(),
  };
  await guardarPerfil(perfil);
  await marcarSesion(true);
  return perfil;
}

export type ResultadoEntrada = { ok: true; perfil: Perfil } | { ok: false; motivo: string };

export async function entrarConCorreo(correo: string, contrasena: string): Promise<ResultadoEntrada> {
  const perfil = await leerPerfil();
  const crudo = await leerSecreto().catch(() => null);
  if (!perfil || !crudo) return { ok: false, motivo: 'En este teléfono no hay una cuenta con ese correo.' };
  let credencial: Credencial;
  try {
    credencial = JSON.parse(crudo) as Credencial;
  } catch {
    return { ok: false, motivo: 'No pude leer tu cuenta. Entra con Face ID o crea una nueva.' };
  }
  await respirar();
  if (limpiarCorreo(correo) !== credencial.correo) {
    return { ok: false, motivo: 'Ese correo no es el de la cuenta de este teléfono.' };
  }
  if (!verificarCredencial(credencial, correo, contrasena)) {
    return { ok: false, motivo: 'La contraseña no coincide.' };
  }
  await marcarSesion(true);
  return { ok: true, perfil };
}

/** Cambiar la contraseña, sólo después de que el dueño del teléfono se identificó. */
export async function cambiarContrasena(contrasena: string): Promise<void> {
  const perfil = await leerPerfil();
  if (!perfil?.correo) throw new Error('La cuenta no tiene correo.');
  await respirar();
  const credencial = crearCredencial(perfil.correo, contrasena, getRandomBytes(16));
  await guardarSecreto(JSON.stringify(credencial));
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

export async function appleDisponible(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

export type ResultadoApple =
  | { ok: true; appleId: string; nombre?: string; correo?: string }
  | { ok: false; cancelado: boolean; motivo: string };

/** Pide a Apple quién es. Apple sólo da el nombre y el correo la primera vez. */
export async function pedirApple(): Promise<ResultadoApple> {
  try {
    const c = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const nombre = [c.fullName?.givenName, c.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    return { ok: true, appleId: c.user, nombre, correo: c.email ?? undefined };
  } catch (e) {
    const cancelado = (e as { code?: string })?.code === 'ERR_REQUEST_CANCELED';
    return { ok: false, cancelado, motivo: cancelado ? '' : 'Apple no respondió. Intenta otra vez.' };
  }
}

export async function crearCuentaConApple(
  apple: { appleId: string; nombre: string; correo?: string },
  resto: Pick<Perfil, 'ciudad' | 'desbloqueo'>,
): Promise<Perfil> {
  const perfil: Perfil = {
    nombre: apple.nombre.trim(),
    correo: apple.correo ? limpiarCorreo(apple.correo) : undefined,
    metodo: 'apple',
    appleId: apple.appleId,
    ciudad: resto.ciudad,
    desbloqueo: resto.desbloqueo,
    creadoEn: new Date().toISOString(),
  };
  await guardarSecreto(null).catch(() => undefined);
  await guardarPerfil(perfil);
  await marcarSesion(true);
  return perfil;
}

/** Volver a entrar con Apple: tiene que ser la misma persona que creó la cuenta. */
export async function entrarConApple(): Promise<ResultadoEntrada> {
  const perfil = await leerPerfil();
  const r = await pedirApple();
  if (!r.ok) return { ok: false, motivo: r.motivo };
  if (!perfil) return { ok: false, motivo: 'En este teléfono no hay una cuenta todavía. Créala primero.' };
  if (perfil.appleId && perfil.appleId !== r.appleId) {
    return { ok: false, motivo: 'Ese Apple ID no es el de la cuenta de este teléfono.' };
  }
  const actualizado = perfil.appleId ? perfil : { ...perfil, appleId: r.appleId };
  if (actualizado !== perfil) await guardarPerfil(actualizado);
  await marcarSesion(true);
  return { ok: true, perfil: actualizado };
}

// ---------------------------------------------------------------------------
// Face ID
// ---------------------------------------------------------------------------

export type TipoDesbloqueo = 'face' | 'huella' | 'codigo' | null;

/** Qué puede usar este teléfono para identificar a su dueño. */
export async function desbloqueoDisponible(): Promise<TipoDesbloqueo> {
  if (Platform.OS === 'web') return null;
  try {
    const [hardware, inscrito, tipos, nivel] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.getEnrolledLevelAsync(),
    ]);
    if (hardware && inscrito) {
      if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
      if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'huella';
    }
    return nivel !== LocalAuthentication.SecurityLevel.NONE ? 'codigo' : null;
  } catch {
    return null;
  }
}

export function nombreDesbloqueo(tipo: TipoDesbloqueo): string {
  if (tipo === 'face') return Platform.OS === 'ios' ? 'Face ID' : 'tu cara';
  if (tipo === 'huella') return Platform.OS === 'ios' ? 'Touch ID' : 'tu huella';
  return 'el código del teléfono';
}

/** Pide Face ID (o el código). `true` si es el dueño. */
export async function identificarDueno(motivo: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar código',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}

/** Entrar con Face ID (o el código del teléfono), si la cuenta lo tiene encendido. */
export async function entrarConDesbloqueo(): Promise<ResultadoEntrada> {
  const perfil = await leerPerfil();
  if (!perfil) return { ok: false, motivo: 'En este teléfono no hay una cuenta todavía.' };
  if (!perfil.desbloqueo) return { ok: false, motivo: 'Esta cuenta no tiene Face ID encendido. Entra con tu contraseña.' };
  const ok = await identificarDueno('Entrar a MEDISINA');
  if (!ok) return { ok: false, motivo: '' };
  await marcarSesion(true);
  return { ok: true, perfil };
}

// ---------------------------------------------------------------------------
// Salir y borrar
// ---------------------------------------------------------------------------

export async function cerrarSesion(): Promise<void> {
  await marcarSesion(false);
}

/** Borra la cuenta Y todo lo del teléfono: plantas, bitácora, fotos registradas. */
export async function borrarCuentaYDatos(): Promise<void> {
  ciudadEnMemoria = undefined;
  await guardarSecreto(null).catch(() => undefined);
  await borrarTodo();
  await guardarAjuste(CLAVE_PERFIL, '').catch(() => undefined);
  await marcarSesion(false).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Lo que el resto de la app necesita del perfil
// ---------------------------------------------------------------------------

/**
 * La ubicación con que nace una planta: la ciudad de la cuenta (para el
 * clima), y el patio a medio sol hasta que la persona diga dónde está.
 */
export async function ubicacionInicial(): Promise<Ubicacion> {
  const perfil = await leerPerfil();
  const c = perfil?.ciudad;
  return {
    exposicion: 'semisol',
    techado: false,
    interior: false,
    zonaClimatica: c?.zona ?? 'BSh',
    municipio: c?.nombre,
    lat: c?.lat,
    lon: c?.lon,
  };
}

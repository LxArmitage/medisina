/**
 * La cuenta de la persona: quién es, cómo entra y de dónde es su clima.
 *
 * TODO VIVE EN EL TELÉFONO. No hay servidor: la app es gratis y funciona sin
 * internet, y una cuenta en la nube pediría las dos cosas. La cuenta sirve para
 * saludar por su nombre, para saber de qué ciudad sacar el clima y para que
 * nadie más abra tus plantas en tu teléfono. No respalda nada en otro lado, y
 * la pantalla de crearla lo dice así.
 *
 * LA CONTRASEÑA NUNCA SE GUARDA. Se guarda una huella: PBKDF2 con SHA-256, sal
 * al azar y miles de vueltas. Con la huella se puede comprobar una contraseña,
 * pero no recuperarla. Está escrito aquí, en JavaScript puro, para que el
 * teléfono, el navegador y las pruebas calculen exactamente lo mismo.
 */

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

export function limpiarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function correoValido(correo: string): boolean {
  const c = limpiarCorreo(correo);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) && c.length <= 254;
}

export function nombreValido(nombre: string): boolean {
  const n = nombre.trim();
  return n.length >= 2 && n.length <= 40;
}

export interface Fuerza {
  /** 0 muy débil … 4 muy fuerte. */
  nivel: 0 | 1 | 2 | 3 | 4;
  texto: string;
  /** Si alcanza para crear la cuenta. */
  sirve: boolean;
}

const COMUNES = new Set([
  '12345678', '123456789', '1234567890', 'password', 'contrasena', 'contraseña', 'qwerty123', '11111111',
  '00000000', 'abcdefgh', 'mexico123', 'plantas1', 'iloveyou', 'password1', 'abc12345',
]);

/**
 * Qué tan difícil de adivinar es. Pide ocho caracteres como mínimo y premia la
 * variedad y el largo; una frase larga en minúsculas vale más que "Abc123!".
 */
export function fuerzaContrasena(contrasena: string): Fuerza {
  const c = contrasena;
  if (c.length < 8) return { nivel: 0, texto: 'Mínimo 8 caracteres', sirve: false };
  if (COMUNES.has(c.toLowerCase())) return { nivel: 0, texto: 'Es de las más usadas: cualquiera la adivina', sirve: false };
  if (/^(.)\1+$/.test(c)) return { nivel: 0, texto: 'Un solo carácter repetido', sirve: false };
  let puntos = 0;
  if (c.length >= 10) puntos += 1;
  if (c.length >= 14) puntos += 1;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(c)).length;
  if (tipos >= 2) puntos += 1;
  if (tipos >= 3) puntos += 1;
  const nivel = Math.max(1, Math.min(4, puntos)) as Fuerza['nivel'];
  const texto = ['', 'Débil, pero sirve', 'Aceptable', 'Buena', 'Muy buena'][nivel];
  return { nivel, texto, sirve: true };
}

// ---------------------------------------------------------------------------
// Huella de la contraseña: SHA-256, HMAC y PBKDF2
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

export function sha256(datos: Uint8Array): Uint8Array {
  const largoBits = datos.length * 8;
  const relleno = ((datos.length + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(relleno);
  m.set(datos);
  m[datos.length] = 0x80;
  // Largo en bits, big-endian, en los últimos 8 bytes (cabe en 53 bits).
  const alto = Math.floor(largoBits / 0x100000000);
  const vista = new DataView(m.buffer);
  vista.setUint32(relleno - 8, alto);
  vista.setUint32(relleno - 4, largoBits >>> 0);

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  for (let i = 0; i < relleno; i += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = vista.getUint32(i + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const a = w[t - 15];
      const b = w[t - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const salida = new Uint8Array(32);
  const vs = new DataView(salida.buffer);
  h.forEach((v, i) => vs.setUint32(i * 4, v));
  return salida;
}

export function hmacSha256(llave: Uint8Array, mensaje: Uint8Array): Uint8Array {
  let k = llave.length > 64 ? sha256(llave) : llave;
  const bloque = new Uint8Array(64);
  bloque.set(k);
  k = bloque;
  const interno = new Uint8Array(64 + mensaje.length);
  const externo = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i += 1) {
    interno[i] = k[i] ^ 0x36;
    externo[i] = k[i] ^ 0x5c;
  }
  interno.set(mensaje, 64);
  externo.set(sha256(interno), 64);
  return sha256(externo);
}

/**
 * Una compresión de SHA-256 sobre el estado `h`, con 16 palabras ya cargadas
 * en `w[0..15]`. Sin crear memoria: es lo que se repite miles de veces.
 */
function comprimir(h: Uint32Array, w: Uint32Array) {
  for (let t = 16; t < 64; t += 1) {
    const x = w[t - 15];
    const y = w[t - 2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
  }
  let a = h[0];
  let b = h[1];
  let c = h[2];
  let d = h[3];
  let e = h[4];
  let f = h[5];
  let g = h[6];
  let hh = h[7];
  for (let t = 0; t < 64; t += 1) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
    hh = g;
    g = f;
    f = e;
    e = (d + t1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (t1 + t2) >>> 0;
  }
  h[0] = (h[0] + a) >>> 0;
  h[1] = (h[1] + b) >>> 0;
  h[2] = (h[2] + c) >>> 0;
  h[3] = (h[3] + d) >>> 0;
  h[4] = (h[4] + e) >>> 0;
  h[5] = (h[5] + f) >>> 0;
  h[6] = (h[6] + g) >>> 0;
  h[7] = (h[7] + hh) >>> 0;
}

const INICIAL = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);

/** El estado de SHA-256 después de procesar la llave XOR `relleno` (un bloque). */
function estadoConLlave(llave: Uint8Array, relleno: number): Uint32Array {
  const k = llave.length > 64 ? sha256(llave) : llave;
  const h = INICIAL.slice();
  const w = new Uint32Array(64);
  for (let i = 0; i < 16; i += 1) {
    let v = 0;
    for (let j = 0; j < 4; j += 1) v = (v << 8) | ((k[i * 4 + j] ?? 0) ^ relleno);
    w[i] = v >>> 0;
  }
  comprimir(h, w);
  return h;
}

/**
 * PBKDF2-HMAC-SHA256 (RFC 8018), un solo bloque de 32 bytes: es lo que hace
 * falta. Cada vuelta es un HMAC de 32 bytes; como la llave no cambia, los dos
 * estados con la llave se calculan una vez y cada vuelta cuesta dos
 * compresiones en vez de cuatro.
 */
export function pbkdf2Sha256(contrasena: Uint8Array, sal: Uint8Array, vueltas: number): Uint8Array {
  const interno = estadoConLlave(contrasena, 0x36);
  const externo = estadoConLlave(contrasena, 0x5c);
  const primero = new Uint8Array(sal.length + 4);
  primero.set(sal);
  primero[sal.length + 3] = 1;
  // La primera vuelta tiene un mensaje de largo libre (sal + contador): va por el camino general.
  const u0 = hmacSha256(contrasena, primero);

  const u = new Uint32Array(8);
  const t = new Uint32Array(8);
  for (let i = 0; i < 8; i += 1) {
    u[i] = ((u0[i * 4] << 24) | (u0[i * 4 + 1] << 16) | (u0[i * 4 + 2] << 8) | u0[i * 4 + 3]) >>> 0;
    t[i] = u[i];
  }
  const w = new Uint32Array(64);
  const h = new Uint32Array(8);
  for (let v = 1; v < vueltas; v += 1) {
    // Interno: estado(llave^ipad) + bloque [u (32 bytes), 0x80, …, largo = (64+32)·8].
    h.set(interno);
    for (let i = 0; i < 8; i += 1) w[i] = u[i];
    w[8] = 0x80000000;
    for (let i = 9; i < 15; i += 1) w[i] = 0;
    w[15] = (64 + 32) * 8;
    comprimir(h, w);
    // Externo: estado(llave^opad) + bloque [hash interno, relleno, mismo largo].
    for (let i = 0; i < 8; i += 1) w[i] = h[i];
    w[8] = 0x80000000;
    for (let i = 9; i < 15; i += 1) w[i] = 0;
    w[15] = (64 + 32) * 8;
    h.set(externo);
    comprimir(h, w);
    for (let i = 0; i < 8; i += 1) {
      u[i] = h[i];
      t[i] ^= h[i];
    }
  }
  const salida = new Uint8Array(32);
  for (let i = 0; i < 8; i += 1) {
    salida[i * 4] = t[i] >>> 24;
    salida[i * 4 + 1] = (t[i] >>> 16) & 255;
    salida[i * 4 + 2] = (t[i] >>> 8) & 255;
    salida[i * 4 + 3] = t[i] & 255;
  }
  return salida;
}

export function utf8(texto: string): Uint8Array {
  // TextEncoder existe en Hermes y en el navegador; el respaldo cubre lo raro.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texto);
  const bytes: number[] = [];
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(bytes);
}

export function aHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function deHex(hex: string): Uint8Array {
  const limpio = hex.length % 2 === 0 ? hex : `0${hex}`;
  const salida = new Uint8Array(limpio.length / 2);
  for (let i = 0; i < salida.length; i += 1) salida[i] = parseInt(limpio.slice(i * 2, i * 2 + 2), 16) || 0;
  return salida;
}

/**
 * Vueltas de PBKDF2. Suficientes para que probar contraseñas a lo bruto sea
 * lento, y pocas para que entrar no tarde en el teléfono (~0.3 s en Hermes).
 */
export const VUELTAS = 12000;

export interface Credencial {
  correo: string;
  sal: string;
  huella: string;
  vueltas: number;
}

export function crearCredencial(correo: string, contrasena: string, sal: Uint8Array, vueltas = VUELTAS): Credencial {
  const huella = pbkdf2Sha256(utf8(contrasena), sal, vueltas);
  return { correo: limpiarCorreo(correo), sal: aHex(sal), huella: aHex(huella), vueltas };
}

/** Compara sin salirse antes: el tiempo no revela cuántos caracteres coinciden. */
function igualesSinPrisa(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i += 1) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function verificarCredencial(c: Credencial, correo: string, contrasena: string): boolean {
  if (limpiarCorreo(correo) !== c.correo) return false;
  const huella = pbkdf2Sha256(utf8(contrasena), deHex(c.sal), c.vueltas);
  return igualesSinPrisa(aHex(huella), c.huella);
}

// ---------------------------------------------------------------------------
// El perfil
// ---------------------------------------------------------------------------

export type MetodoEntrada = 'correo' | 'apple';

export interface Perfil {
  nombre: string;
  correo?: string;
  metodo: MetodoEntrada;
  /** El id estable que da Apple, para reconocer a la misma persona al volver. */
  appleId?: string;
  ciudad?: { nombre: string; estado: string; lat: number; lon: number; zona: string };
  /** Pedir Face ID (o el código del teléfono) al abrir la app. */
  desbloqueo: boolean;
  creadoEn: string;
}

/** El saludo según la hora, como lo diría alguien de aquí. */
export function saludo(nombre: string, hora = new Date().getHours()): string {
  const pila = nombre.trim().split(/\s+/)[0] ?? '';
  const parte = hora < 6 ? 'Buenas noches' : hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  return pila ? `${parte}, ${pila}` : parte;
}

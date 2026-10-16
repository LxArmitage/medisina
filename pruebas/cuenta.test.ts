/**
 * La cuenta local: la huella de la contraseña, la validación y la ciudad.
 *
 * La huella se prueba contra los vectores publicados (FIPS 180-2 para
 * SHA-256, RFC 7914 §11 para PBKDF2-HMAC-SHA256): si el cálculo propio se
 * desvía un bit, una contraseña correcta dejaría de entrar.
 */

import { CIUDADES, buscarCiudades, ciudadMasCercana } from '../src/dominio/ciudades';
import {
  aHex,
  correoValido,
  crearCredencial,
  fuerzaContrasena,
  hmacSha256,
  nombreValido,
  pbkdf2Sha256,
  saludo,
  sha256,
  utf8,
  verificarCredencial,
} from '../src/dominio/cuenta';

describe('SHA-256, HMAC y PBKDF2 dan lo que dicen los estándares', () => {
  it('SHA-256', () => {
    expect(aHex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(aHex(sha256(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // Dos bloques: el relleno cruza el límite de 64 bytes.
    expect(aHex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('HMAC-SHA256 (RFC 4231, caso 2)', () => {
    expect(aHex(hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('PBKDF2-HMAC-SHA256', () => {
    expect(aHex(pbkdf2Sha256(utf8('password'), utf8('salt'), 1))).toBe(
      '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b',
    );
    expect(aHex(pbkdf2Sha256(utf8('password'), utf8('salt'), 4096))).toBe(
      'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a',
    );
  });

  it('acentos y eñes cuentan igual en todos lados', () => {
    expect(aHex(utf8('ñ'))).toBe('c3b1');
    expect(aHex(utf8('🌵'))).toBe('f09f8cb5');
  });
});

describe('la contraseña nunca se guarda, sólo su huella', () => {
  const sal = new Uint8Array(16).fill(7);
  const c = crearCredencial('Ana@Correo.MX ', 'mi jardín de sombra', sal, 500);

  it('la credencial no contiene la contraseña', () => {
    expect(JSON.stringify(c)).not.toMatch(/jard/);
    expect(c.correo).toBe('ana@correo.mx');
  });

  it('entra con la correcta, aunque el correo venga con mayúsculas', () => {
    expect(verificarCredencial(c, 'ANA@correo.mx', 'mi jardín de sombra')).toBe(true);
  });

  it('no entra con otra, ni con otro correo', () => {
    expect(verificarCredencial(c, 'ana@correo.mx', 'mi jardin de sombra')).toBe(false);
    expect(verificarCredencial(c, 'otra@correo.mx', 'mi jardín de sombra')).toBe(false);
  });

  it('dos cuentas con la misma contraseña tienen huellas distintas (la sal)', () => {
    const otra = crearCredencial('ana@correo.mx', 'mi jardín de sombra', new Uint8Array(16).fill(8), 500);
    expect(otra.huella).not.toBe(c.huella);
  });
});

describe('validación', () => {
  it.each([
    ['ana@correo.mx', true],
    ['  Ana@Correo.com ', true],
    ['ana@correo', false],
    ['anacorreo.mx', false],
    ['ana @correo.mx', false],
  ])('correo %s', (correo, ok) => expect(correoValido(correo)).toBe(ok));

  it('nombre', () => {
    expect(nombreValido('Al')).toBe(true);
    expect(nombreValido(' ')).toBe(false);
  });

  it('las contraseñas débiles no pasan; una frase larga sí', () => {
    expect(fuerzaContrasena('1234567').sirve).toBe(false);
    expect(fuerzaContrasena('12345678').sirve).toBe(false);
    expect(fuerzaContrasena('aaaaaaaaaa').sirve).toBe(false);
    expect(fuerzaContrasena('mi jardín de sombra').nivel).toBeGreaterThanOrEqual(fuerzaContrasena('Abc123!x').nivel - 1);
    expect(fuerzaContrasena('mi jardín de sombra').sirve).toBe(true);
  });

  it('saluda según la hora y con el nombre de pila', () => {
    expect(saludo('Alonso Campos', 9)).toBe('Buenos días, Alonso');
    expect(saludo('Alonso', 15)).toBe('Buenas tardes, Alonso');
    expect(saludo('Alonso', 22)).toBe('Buenas noches, Alonso');
  });
});

describe('la ciudad del clima', () => {
  it('se encuentra sin acentos y por estado', () => {
    expect(buscarCiudades('culiacan')[0].nombre).toBe('Culiacán');
    expect(buscarCiudades('queretaro')[0].nombre).toBe('Querétaro');
    expect(buscarCiudades('sinaloa').map((c) => c.nombre)).toEqual(expect.arrayContaining(['Culiacán', 'Mazatlán']));
  });

  it('del GPS a la ciudad más cercana', () => {
    // Navolato, junto a Culiacán.
    expect(ciudadMasCercana({ lat: 24.77, lon: -107.7 }).ciudad.nombre).toBe('Culiacán');
    // Coyoacán, dentro de la CDMX.
    expect(ciudadMasCercana({ lat: 19.35, lon: -99.16 }).ciudad.nombre).toBe('Ciudad de México');
  });

  it('todas tienen coordenadas de México y una zona conocida', () => {
    for (const c of CIUDADES) {
      expect([c.nombre, c.lat > 14 && c.lat < 33 && c.lon > -118 && c.lon < -86]).toEqual([c.nombre, true]);
      expect(['BWh', 'BSh', 'Aw', 'Am', 'Cwa', 'Cwb', 'Csa']).toContain(c.zona);
    }
  });
});

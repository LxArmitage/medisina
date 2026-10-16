/**
 * Revisiones de bulto sobre el código de la interfaz.
 *
 * El resto de las pruebas corre el dominio, que es puro. La interfaz no se
 * puede correr aquí —necesitaría React Native, expo-gl y una GPU—, así que lo
 * que se hace es LEER el archivo y buscar formas que se sabe que revientan.
 *
 * Esto nació de un congelamiento real. Un reemplazo automático sustituyó el
 * cuerpo de un componente de la vieja escena 3D, que quedó devolviéndose a sí
 * mismo. Cualquier planta sin foto entraba en recursión infinita: la pantalla
 * se quedaba en blanco, sin error en la consola, y sólo se notaba abriendo una
 * planta. Una prueba que lee el texto lo habría dicho en un segundo, y por eso
 * está aquí: es barata y cubre justo lo que el tipado no ve.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const UI = join(__dirname, '..', 'src', 'ui');

function archivosDeInterfaz(): string[] {
  return readdirSync(UI).filter((n) => n.endsWith('.tsx'));
}

function leer(nombre: string): string {
  return readFileSync(join(UI, nombre), 'utf8');
}

/** Nombres de los componentes declarados como `function Algo(` o `const Algo = (`. */
function componentesDe(fuente: string): string[] {
  const nombres = new Set<string>();
  for (const m of fuente.matchAll(/\bfunction\s+([A-Z]\w*)\s*\(/g)) nombres.add(m[1]);
  for (const m of fuente.matchAll(/\bconst\s+([A-Z]\w*)\s*[:=][^=]*=>/g)) nombres.add(m[1]);
  return [...nombres];
}

/**
 * El cuerpo de una función, contando llaves desde su apertura.
 *
 * Hay dos trampas, y las dos se pagaron. La primera: `indexOf` de la llave de
 * cierre no sirve, porque el cuerpo de un componente está lleno de llaves de
 * JSX y cortaría en la primera interpolación. La segunda, más sigilosa: la
 * primera llave después del nombre NO es el cuerpo, es el destructurado de los
 * parámetros —`function Hoja({ m, textura })`—, así que hay que saltarse la
 * lista de parámetros contando paréntesis antes de empezar a mirar llaves.
 * Cogiendo el destructurado por cuerpo, estas pruebas pasaban sin mirar nada.
 */
function cuerpoDe(fuente: string, nombre: string): string | null {
  const firma = new RegExp(`\\bfunction\\s+${nombre}\\s*\\(`);
  const inicio = fuente.search(firma);
  if (inicio < 0) return null;

  // Fin de la lista de parámetros.
  let parentesis = 0;
  let trasParametros = -1;
  for (let i = fuente.indexOf('(', inicio); i < fuente.length; i += 1) {
    if (fuente[i] === '(') parentesis += 1;
    else if (fuente[i] === ')') {
      parentesis -= 1;
      if (parentesis === 0) {
        trasParametros = i;
        break;
      }
    }
  }
  if (trasParametros < 0) return null;

  const abre = fuente.indexOf('{', trasParametros);
  if (abre < 0) return null;

  let nivel = 0;
  for (let i = abre; i < fuente.length; i += 1) {
    if (fuente[i] === '{') nivel += 1;
    else if (fuente[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return fuente.slice(abre, i + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

describe('ningún componente se dibuja a sí mismo', () => {
  /**
   * Un componente puede llamarse a sí mismo —un árbol de carpetas lo hace— pero
   * sólo con una condición de corte. Los de esta app no son recursivos: si uno
   * aparece dentro de su propio cuerpo, es que un reemplazo se pasó de listo.
   */
  it.each(archivosDeInterfaz())('%s', (nombre) => {
    const fuente = leer(nombre);
    const culpables: string[] = [];

    for (const componente of componentesDe(fuente)) {
      const cuerpo = cuerpoDe(fuente, componente);
      if (!cuerpo) continue;
      if (new RegExp(`<${componente}[\\s/>]`).test(cuerpo)) culpables.push(componente);
    }

    expect(culpables).toEqual([]);
  });
});

describe('los gestos tienen raíz', () => {
  /**
   * El fallo que motivó esto: picarle a "Dibujo" tumbaba la ficha en el
   * iPhone. `GestureDetector` lanza al montarse si no hay un
   * `GestureHandlerRootView` arriba — pero sólo en el teléfono y en modo
   * desarrollo; en web la librería se salta la comprobación. O sea: invisible
   * en la computadora, fatal en el celular. Esta prueba lo ve desde el texto.
   */
  it('si algo usa GestureDetector, la raíz monta GestureHandlerRootView', () => {
    const usan = archivosDeInterfaz().filter((n) => /\bGestureDetector\b/.test(leer(n)));
    if (usan.length === 0) return;

    const raiz = readFileSync(join(__dirname, '..', 'app', '_layout.tsx'), 'utf8');
    expect(raiz).toMatch(/<GestureHandlerRootView\b/);
  });
});

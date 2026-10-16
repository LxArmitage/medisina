/**
 * De una frase a números.
 *
 * Este archivo lo usan DOS programas: el entrenador, que corre en la
 * computadora, y la app, que corre en el teléfono. Tiene que ser el mismo
 * código en los dos. Si el entrenador normaliza distinto que la app, el modelo
 * aprende sobre unos rasgos y en producción ve otros — un modelo entrenado con
 * esmero puede quedar en ruido por esa sola diferencia.
 *
 * Los rasgos son cuatro familias, y cada una cubre lo que las otras no:
 *   · Palabras sueltas — "agua", "sol", "amarilla".
 *   · Inicios de palabra — "riego" de "riegoo" y de "riegas". Sobrevive al
 *     plural, a la conjugación y a la tecla repetida.
 *   · Pares de palabras — "cuando riego", "se ve", que separan intenciones que
 *     comparten vocabulario.
 *   · Trozos de tres y cuatro letras — así "amarilla" y "amarrilla" comparten
 *     casi todo. Es lo que sostiene al modelo cuando se escribe con el pulgar.
 */

/** Más allá de esto no hay pregunta, hay párrafo. Cortar acota el costo. */
const LARGO_MAXIMO = 200;

/**
 * Tamaños del trozo de letras. Los dos, y no uno.
 *
 * Con trozos de cuatro, "tierra" y "tiera" comparten dos de cuatro; con trozos
 * de tres comparten cuatro de cinco. Se midió: sólo con cuatro, una errata le
 * cambiaba la lectura a "que tal la tiera" y la mandaba de sustrato a saludo.
 * Los de tres aguantan el dedo suelto; los de cuatro distinguen palabras que
 * se parecen. Cada tamaño arregla lo que el otro no.
 */
const TROZOS = [3, 4];

/** Cuantas letras del principio de la palabra se guardan aparte. */
const INICIO = 5;

export function normalizar(texto: string): string {
  return texto
    .slice(0, LARGO_MAXIMO)
    .toLowerCase()
    .normalize('NFD')
    // Quita los acentos: "cuándo" y "cuando" deben ser la misma palabra, porque
    // en el teclado del teléfono casi nadie los pone.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Los rasgos presentes en una frase, sin repetir.
 *
 * Sin repetir a propósito: en una frase de diez palabras, que "agua" aparezca
 * dos veces no la hace el doble de sobre riego.
 */
export function rasgosDe(texto: string): string[] {
  const limpio = normalizar(texto);
  if (!limpio) return [];

  const rasgos = new Set<string>();
  const palabras = limpio.split(' ');

  for (const palabra of palabras) {
    rasgos.add(`p:${palabra}`);
    // El principio de la palabra, que es lo que sobrevive a casi todo: al
    // plural ("hoja"/"hojas"), a la conjugación ("riego"/"riegas") y a la
    // errata de teclado repetido ("riego"/"riegoo"). Se midió: sin esto,
    // "cuando la riegoo" perdía a la vez la palabra y el par de palabras, y
    // la lectura correcta se caía hasta el tercer lugar.
    if (palabra.length > INICIO) rasgos.add(`i:${palabra.slice(0, INICIO)}`);
  }
  for (let i = 0; i + 1 < palabras.length; i += 1) {
    rasgos.add(`d:${palabras[i]} ${palabras[i + 1]}`);
  }

  // Los guiones bajos de los extremos marcan principio y fin de palabra, para
  // que "_reg" (empieza con reg) pese distinto que "reg" en medio.
  const cadena = `_${limpio.replace(/ /g, '_')}_`;
  for (const largo of TROZOS) {
    for (let i = 0; i + largo <= cadena.length; i += 1) {
      rasgos.add(`t${largo}:${cadena.slice(i, i + largo)}`);
    }
  }

  return [...rasgos];
}

/**
 * Cuánto pesa cada familia de rasgos.
 *
 * Los trozos de letras van más bajo por una razón de aritmética: una frase de
 * cinco palabras produce cinco rasgos de palabra y unos treinta de letras. Sin
 * esto, los trozos aportan seis veces más señal nada más por ser más, y el
 * modelo acaba decidiendo por el armazón de la frase en vez de por lo que dice.
 */
const PESO_FAMILIA: Record<string, number> = { p: 1, i: 0.8, d: 0.9, t3: 0.35, t4: 0.45 };

/** Lo que va antes de los dos puntos: "p", "d", "t3", "t4". */
function familiaDe(rasgo: string): string {
  const corte = rasgo.indexOf(':');
  return corte < 0 ? rasgo : rasgo.slice(0, corte);
}

/**
 * Los rasgos de una frase, cada uno con su valor.
 *
 * Cada familia se reparte entre los suyos, así que una pregunta larga no
 * empuja más fuerte que una corta sólo por ser larga.
 *
 * Importante: se reparte entre TODOS los rasgos, no sólo entre los que el
 * modelo conoce. Eso hace que una frase de puras palabras desconocidas dé
 * puntajes débiles — y un puntaje débil es exactamente lo que dispara el
 * "no te entendí". Repartir sólo entre los conocidos daría confianza alta a
 * una frase que el modelo casi no entendió.
 */
export function vectorizar(
  texto: string,
  /**
   * Cuánto vale cada rasgo por lo raro que es.
   *
   * Sin esto, "está" pesa lo mismo que "marchita" aunque aparezca en todas las
   * preguntas del mundo. Medido: el modelo mandaba "está marchita" a *clima*,
   * porque clima tiene muchas frases que empiezan con "está" — "está nublado",
   * "está soleado" — y el armazón le ganaba a la palabra que importaba.
   */
  rareza: (rasgo: string) => number = () => 1,
): Array<[string, number]> {
  const porFamilia = new Map<string, string[]>();
  for (const rasgo of rasgosDe(texto)) {
    const familia = familiaDe(rasgo);
    const lista = porFamilia.get(familia);
    if (lista) lista.push(rasgo);
    else porFamilia.set(familia, [rasgo]);
  }

  const salida: Array<[string, number]> = [];
  for (const [familia, lista] of porFamilia) {
    const peso = PESO_FAMILIA[familia] ?? 1;
    const valores = lista.map(rareza);
    let norma = 0;
    for (const valor of valores) norma += valor * valor;
    norma = Math.sqrt(norma) || 1;
    lista.forEach((rasgo, i) => salida.push([rasgo, (peso * valores[i]) / norma]));
  }
  return salida;
}

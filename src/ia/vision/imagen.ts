/**
 * De una foto cualquiera al cuadro que espera la red.
 *
 * Se recorta el cuadrado del centro —la gente centra la planta— y se escala
 * promediando los píxeles de origen que caen en cada píxel de destino. Con un
 * muestreo simple, una foto de 3000 px encogida a 160 se llena de ruido y la
 * red ve texturas que no están.
 *
 * Es puro y sin dependencias para que el teléfono, el navegador y el
 * entrenamiento en la computadora preparen la foto EXACTAMENTE igual: si el
 * entrenamiento viera fotos preparadas distinto de como las ve el teléfono,
 * lo aprendido no serviría en el teléfono.
 */

export interface Pixeles {
  ancho: number;
  alto: number;
  /** RGBA, 4 bytes por píxel. */
  datos: ArrayLike<number>;
}

/**
 * Recorta el cuadrado central (una fracción `zoom` del lado corto) y lo
 * escala a `lado` × `lado`. Devuelve RGBA.
 */
export function cuadroCentral(foto: Pixeles, lado: number, zoom = 1): Uint8ClampedArray {
  const corto = Math.min(foto.ancho, foto.alto) * Math.max(0.1, Math.min(1, zoom));
  const x0 = (foto.ancho - corto) / 2;
  const y0 = (foto.alto - corto) / 2;
  const escala = corto / lado;
  const salida = new Uint8ClampedArray(lado * lado * 4);

  for (let y = 0; y < lado; y += 1) {
    const ya = y0 + y * escala;
    const yb = ya + escala;
    for (let x = 0; x < lado; x += 1) {
      const xa = x0 + x * escala;
      const xb = xa + escala;
      let r = 0;
      let g = 0;
      let b = 0;
      let peso = 0;
      // Promedio por área: cada píxel de origen pesa lo que cubre del destino.
      for (let sy = Math.floor(ya); sy < Math.ceil(yb); sy += 1) {
        if (sy < 0 || sy >= foto.alto) continue;
        const cy = Math.min(yb, sy + 1) - Math.max(ya, sy);
        for (let sx = Math.floor(xa); sx < Math.ceil(xb); sx += 1) {
          if (sx < 0 || sx >= foto.ancho) continue;
          const w = cy * (Math.min(xb, sx + 1) - Math.max(xa, sx));
          if (w <= 0) continue;
          const i = (sy * foto.ancho + sx) * 4;
          r += foto.datos[i] * w;
          g += foto.datos[i + 1] * w;
          b += foto.datos[i + 2] * w;
          peso += w;
        }
      }
      const o = (y * lado + x) * 4;
      salida[o] = peso > 0 ? r / peso : 0;
      salida[o + 1] = peso > 0 ? g / peso : 0;
      salida[o + 2] = peso > 0 ? b / peso : 0;
      salida[o + 3] = 255;
    }
  }
  return salida;
}

/** La misma imagen, al revés como en un espejo. Para ver la planta de dos lados. */
export function espejo(rgba: ArrayLike<number>, lado: number): Uint8ClampedArray {
  const salida = new Uint8ClampedArray(lado * lado * 4);
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado; x += 1) {
      const o = (y * lado + x) * 4;
      const i = (y * lado + (lado - 1 - x)) * 4;
      salida[o] = rgba[i];
      salida[o + 1] = rgba[i + 1];
      salida[o + 2] = rgba[i + 2];
      salida[o + 3] = 255;
    }
  }
  return salida;
}

/**
 * Qué decirle a quien toca su racha.
 *
 * No es lo mismo llevar un mes que haber empezado ayer, ni haber cuidado hoy
 * que tenerlo pendiente: felicitar igual en los tres casos sería no estar
 * viendo. Puro, para probarlo sin dibujar (la tarjeta está en
 * `ui/FelicitacionRacha.tsx`).
 */

export interface DatosRacha {
  dias: number;
  mejor: number;
  hoyCuenta: boolean;
}

export function mensajeDeRacha(r: DatosRacha): { titulo: string; texto: string } {
  const n = Math.max(0, Math.round(r.dias));
  // "1 día seguidos" no se dice: con uno es su primer día.
  const seguidos = n === 1 ? 'tu primer día' : `${n} días seguidos`;
  if (n === 0) {
    return { titulo: 'Tu racha empieza hoy', texto: 'Riega o revisa una planta y se enciende el fuego. Mañana ya serán dos.' };
  }
  const record = n >= 3 && n >= r.mejor ? ' ¡Es tu mejor racha!' : '';
  if (!r.hoyCuenta) {
    return { titulo: '¡Vas muy bien!', texto: `Llevas ${seguidos}. Cuida alguna hoy para que siga creciendo.${record}` };
  }
  if (n >= 30) return { titulo: '¡Felicidades por cuidarlas!', texto: `Un mes o más: ${n} días sin fallar. Tu jardín se nota.${record}` };
  if (n >= 7) return { titulo: '¡Felicidades por cuidarlas!', texto: `${seguidos}: ya es costumbre, y tus plantas lo agradecen.${record}` };
  if (n === 1) return { titulo: '¡Felicidades por cuidarlas!', texto: 'Hoy es tu primer día. Mañana, el segundo: tus plantas lo van a notar.' };
  return { titulo: '¡Felicidades por cuidarlas!', texto: `Llevas ${seguidos}. Tus plantas lo notan.${record}` };
}

/**
 * La pestaña de escanear no es una pantalla: tocarla abre la cámara
 * (`/escanear`), que es un paso a paso con su propio encabezado. Si alguien
 * llega aquí por un enlace, se le manda directo allá.
 */

import { Redirect } from 'expo-router';

export default function PestanaEscanear() {
  return <Redirect href="/escanear" />;
}

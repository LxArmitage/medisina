/**
 * Selección del motor de persistencia — variante por defecto.
 *
 * Metro prefiere `motor.native.ts` en iOS y Android, así que este archivo es el
 * que acaban usando la web y las pruebas en Node: el almacén en memoria.
 *
 * Que Jest resuelva justo esta variante es intencional — permite probar la capa
 * de servicios completa, degradación de clima incluida, sin emulador.
 */

export { motorMemoria as motor } from './memoria';

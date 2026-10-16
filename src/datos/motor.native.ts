/**
 * Selección del motor de persistencia — iOS y Android.
 *
 * En el dispositivo se usa SQLite, que es la persistencia real del producto.
 */

export { motorSqlite as motor } from './sqlite';

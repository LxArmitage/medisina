/**
 * Baja fotos etiquetadas de cada especie del catálogo, para enseñarle a la
 * red a distinguirlas.
 *
 * Salen de iNaturalist: observaciones reales, identificadas por la comunidad,
 * con licencia abierta (CC0 / CC-BY / CC-BY-NC / CC-BY-SA). Primero las
 * cultivadas —macetas, jardines—, porque así son las fotos que va a tomar la
 * gente con la app; si no alcanzan, se completa con plantas en el campo.
 *
 * Las fotos no viajan en la app ni entran al repositorio: sólo sirven para
 * calcular los pesos de la última capa. Se guardan en una carpeta temporal.
 *
 *   node .entrenamiento-compilado/entrenamiento/vision/descargar.js <carpeta> [porEspecie]
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ESPECIES } from '../../src/dominio/catalogo';

/**
 * Cómo se llama cada especie en iNaturalist cuando no es como en el catálogo:
 * sinónimos y cultivares que allá se registran bajo otro nombre. Una lista
 * junta varias especies que en casa son una sola planta: la pitahaya de pulpa
 * blanca, roja y amarilla es "la pitahaya".
 */
export const NOMBRE_INATURALIST: Record<string, string | string[]> = {
  'lophocereus-schottii': 'Pachycereus schottii',
  'citrus-limon': 'Citrus × limon',
  'rosa-hybrida': 'Rosa',
  'dypsis-lutescens': 'Chrysalidocarpus lutescens',
  'pelargonium-hortorum': 'Pelargonium × hybridum',
  'schefflera-arboricola': 'Heptapleurum arboricola',
  'selenicereus-undatus': ['Selenicereus undatus', 'Selenicereus costaricensis', 'Selenicereus megalanthus'],
  'echinocactus-grusonii': 'Kroenleinia grusonii',
  'dracaena-marginata': 'Dracaena reflexa angustifolia',
};

/**
 * Plantas que NO están en el catálogo, para la clase "otra".
 *
 * Sin esta clase la red está obligada a escoger una de las del catálogo aunque
 * le enseñes una begonia, y lo dice con toda seguridad. Con ella aprende que
 * existe "ninguna de las mías" — y de paso a separar las parecidas: la reina
 * de la noche de la pitahaya, la heliconia del plátano, la haworthia de la
 * sábila.
 *
 * OJO: una especie que entra al catálogo tiene que salir de aquí. Antes la
 * pitahaya estaba en esta lista, y la red aprendió a llamarla "otra".
 */
export const OTRAS: string[] = [
  'Scindapsus pictus', 'Maranta leuconeura', 'Goeppertia', 'Yucca gigantea', 'Peperomia obtusifolia', 'Begonia',
  'Haworthiopsis attenuata', 'Gasteria', 'Portulacaria afra', 'Aspidistra elatior', 'Chrysanthemum', 'Adiantum',
  'Asparagus setaceus', 'Alocasia', 'Caladium bicolor', 'Lantana camara', 'Duranta erecta', 'Ixora coccinea',
  'Hedera helix', 'Curio rowleyanus', 'Schlumbergera', 'Aeonium', 'Graptopetalum paraguayense', 'Euphorbia tirucalli',
  'Sansevieria cylindrica', 'Cyperus alternifolius', 'Impatiens walleriana', 'Zinnia elegans', 'Ferocactus',
  'Dianthus caryophyllus', 'Gerbera jamesonii', 'Ricinus communis', 'Cosmos bipinnatus', 'Cynodon dactylon',
  'Taraxacum officinale', 'Opuntia microdasys', 'Kalanchoe daigremontiana', 'Aloe maculata', 'Agave attenuata',
  'Thaumatophyllum bipinnatifidum', 'Tradescantia pallida', 'Cissus verticillata', 'Thunbergia alata',
  'Ipomoea purpurea', 'Pachira aquatica', 'Yucca filifera', 'Epiphyllum oxypetalum', 'Disocactus flagelliformis',
  'Heliconia', 'Canna indica', 'Tillandsia', 'Nandina domestica', 'Callisia repens', 'Plectranthus verticillatus',
  'Tecoma stans', 'Pentas lanceolata', 'Allamanda cathartica', 'Russelia equisetiformis', 'Citrus × aurantiifolia',
  'Annona muricata', 'Moringa oleifera',
];
const POR_OTRA = 30;

const API = 'https://api.inaturalist.org/v1';
const LICENCIAS = 'cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nc-sa';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function json<T>(url: string): Promise<T> {
  for (let intento = 0; intento < 4; intento += 1) {
    const r = await fetch(url, { headers: { 'User-Agent': 'medisina-entrenamiento/1.0' } });
    if (r.ok) return (await r.json()) as T;
    // Respetar el límite de la API: si se queja, esperar y volver a pedir.
    await espera(2000 * (intento + 1));
  }
  throw new Error(`No respondió: ${url}`);
}

async function idDeTaxon(nombre: string): Promise<number> {
  const r = await json<{ results: Array<{ id: number; name: string; rank: string }> }>(
    `${API}/taxa?q=${encodeURIComponent(nombre)}&per_page=5`,
  );
  const exacto = r.results.find((t) => t.name.toLowerCase() === nombre.toLowerCase()) ?? r.results[0];
  if (!exacto) throw new Error(`iNaturalist no conoce ${nombre}`);
  return exacto.id;
}

interface Observacion {
  id: number;
  photos: Array<{ id: number; url: string; license_code: string | null }>;
}

async function fotosDe(taxon: number, cuantas: number): Promise<Array<{ id: number; url: string }>> {
  const vistas = new Set<number>();
  const salida: Array<{ id: number; url: string }> = [];
  // Cultivadas primero; luego silvestres para completar.
  for (const cautiva of ['true', 'false']) {
    for (let pagina = 1; pagina <= 3 && salida.length < cuantas; pagina += 1) {
      const r = await json<{ results: Observacion[] }>(
        `${API}/observations?taxon_id=${taxon}&photos=true&photo_license=${LICENCIAS}` +
          `&captive=${cautiva}&order_by=votes&per_page=100&page=${pagina}`,
      );
      if (r.results.length === 0) break;
      for (const o of r.results) {
        const foto = o.photos.find((f) => f.license_code);
        if (!foto || vistas.has(foto.id)) continue;
        vistas.add(foto.id);
        salida.push({ id: foto.id, url: foto.url.replace('/square.', '/medium.') });
        if (salida.length >= cuantas) break;
      }
      await espera(1100);
    }
  }
  return salida;
}

async function bajar(url: string, destino: string): Promise<boolean> {
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function principal() {
  const [, , carpeta, porEspecieTexto] = process.argv;
  if (!carpeta) throw new Error('Uso: descargar <carpeta> [porEspecie]');
  const porEspecie = Number(porEspecieTexto ?? 110);

  for (const especie of ESPECIES) {
    const dir = join(carpeta, especie.id);
    mkdirSync(dir, { recursive: true });
    const ya = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
    if (ya >= porEspecie) {
      console.log(`${especie.id}: ya tiene ${ya}`);
      continue;
    }
    const nombres = [NOMBRE_INATURALIST[especie.id] ?? especie.nombreCientifico].flat();
    const fotos: Array<{ id: number; url: string }> = [];
    // Con varias especies, la primera pone la mitad y las demás el resto.
    for (const [i, nombre] of nombres.entries()) {
      const cuantas = nombres.length === 1 ? porEspecie : i === 0 ? Math.round(porEspecie / 2) : Math.round(porEspecie / 2 / (nombres.length - 1));
      fotos.push(...(await fotosDe(await idDeTaxon(nombre), cuantas)));
    }
    const nombre = nombres.join(' + ');
    let bajadas = 0;
    // De ocho en ocho: las fotos vienen de un almacén estático, no de la API.
    for (let i = 0; i < fotos.length; i += 8) {
      const tanda = fotos.slice(i, i + 8);
      const r = await Promise.all(
        tanda.map((f) => {
          const destino = join(dir, `${f.id}.jpg`);
          return existsSync(destino) ? Promise.resolve(true) : bajar(f.url, destino);
        }),
      );
      bajadas += r.filter(Boolean).length;
    }
    console.log(`${especie.id} (${nombre}): ${bajadas} fotos`);
  }

  const dirOtra = join(carpeta, 'otra');
  mkdirSync(dirOtra, { recursive: true });
  const delCatalogo = new Set(ESPECIES.map((e) => e.nombreCientifico.toLowerCase()));
  for (const nombre of OTRAS) {
    if (delCatalogo.has(nombre.toLowerCase())) {
      console.log(`otra · ${nombre}: está en el catálogo, no puede ser "otra"`);
      continue;
    }
    try {
      const taxon = await idDeTaxon(nombre);
      const fotos = await fotosDe(taxon, POR_OTRA);
      const r = await Promise.all(
        fotos.map((f) => {
          const destino = join(dirOtra, `${f.id}.jpg`);
          return existsSync(destino) ? Promise.resolve(true) : bajar(f.url, destino);
        }),
      );
      console.log(`otra · ${nombre}: ${r.filter(Boolean).length}`);
    } catch (e) {
      console.log(`otra · ${nombre}: ${e instanceof Error ? e.message : 'falló'}`);
    }
  }
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});

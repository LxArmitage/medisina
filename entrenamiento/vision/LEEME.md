# Reconocimiento de plantas sin internet

Cómo se fabrica lo que está en `src/ia/vision/`. Nada de esto corre en la app:
la app sólo carga los tres JSON que salen de aquí.

## Las piezas

| Archivo en la app | Qué es | De dónde sale |
| --- | --- | --- |
| `red-plantas.json` | La red que "ve" plantas (MobileNet V2, ~2.2 M de pesos en bytes) | `plants_V1` de Google AIY (Apache 2.0), convertida con `convertir.ts` |
| `cabeza-plantas.json` | La última capa a 160 px: rasgos → especie del catálogo, más "otra" (512 neuronas ocultas) | `cabeza_mlp.py` |
| `cabeza-plantas-128.json` | La misma a 128 px, para teléfonos lentos (256 neuronas ocultas, más ligera) | `cabeza_mlp.py` |

La red de Google conoce 2,100 especies silvestres, pero no varias del catálogo
(lengua de suegra, potos, helecho de Boston…). Por eso no se usa su clasificador:
se usa sólo como "ojo" y encima se entrena una capa propia con fotos de cada
especie del catálogo.

## Regenerar (por ejemplo, al agregar especies al catálogo)

```bash
npx tsc -p tsconfig.entrenamiento.json
```

1. **Red** (sólo si cambia el modelo base). Bajar el `.tflite` de
   `https://tfhub.dev/google/lite-model/aiy/vision/classifier/plants_V1/3?lite-format=tflite` y:
   ```bash
   node .entrenamiento-compilado/entrenamiento/vision/convertir.js plants.tflite src/ia/vision/red-plantas.json
   ```
2. **Fotos** de iNaturalist (licencias abiertas; se guardan fuera del repositorio):
   ```bash
   node .entrenamiento-compilado/entrenamiento/vision/descargar.js <carpeta-fotos> 230
   ```
   Si una especie se llama distinto en iNaturalist, va en `NOMBRE_INATURALIST`
   (con una lista si en casa varias especies son "la misma planta", como la
   pitahaya blanca, roja y amarilla). Una especie que entra al catálogo tiene
   que salir de `OTRAS`: si no, la red aprende a llamarla "otra" (le pasó a la
   pitahaya).
3. **Rasgos** de cada foto, en todos los núcleos (unos 10 min por tamaño):
   ```bash
   node .entrenamiento-compilado/entrenamiento/vision/rasgos.js <carpeta-fotos> src/ia/vision/red-plantas.json rasgos-160.jsonl 160
   node .entrenamiento-compilado/entrenamiento/vision/rasgos.js <carpeta-fotos> src/ia/vision/red-plantas.json rasgos-128.jsonl 128
   ```
   Con `rasgos-anterior.jsonl` al final sólo se procesan las fotos nuevas. Se
   guardan un renglón por foto: con más de 28 mil fotos un solo JSON pasa del
   medio giga que Node puede escribir de una vez (se siguen leyendo los `.json`
   viejos).
4. **Última capa**, con una capa oculta y examen en fotos apartadas. Se entrena
   con numpy (gratis: `pip install numpy`); primero los rasgos pasan a binario:
   ```bash
   node --max-old-space-size=14000 .entrenamiento-compilado/entrenamiento/vision/volcar.js rasgos-160.jsonl r160
   node --max-old-space-size=14000 .entrenamiento-compilado/entrenamiento/vision/volcar.js rasgos-128.jsonl r128
   python entrenamiento/vision/cabeza_mlp.py r160 512 src/ia/vision/cabeza-plantas.json
   python entrenamiento/vision/cabeza_mlp.py r128 256 src/ia/vision/cabeza-plantas-128.json
   ```
   Unos 6 y 3 minutos. `entrenar.ts` sigue sirviendo para la versión de una
   sola capa (formato 1), que la app también sabe leer.

`pruebas/reconocimiento.test.ts` falla si el catálogo tiene una especie que el
modelo no conoce, o si las dos cabezas no hablan de las mismas clases.

## Lo que salió la última vez (25 sep 2026, tarde)

29,245 fotos de 71 especies + 2,359 de otras plantas para la clase "otra".
Entraron 15 especies de patio que antes sólo se sabían llamar "otra": la
pitahaya, el ave del paraíso, el plátano, la papaya, la guayaba, el té limón…
Examen con 5,729 fotos apartadas antes de entrenar, una foto a la vez, ya con
los pesos en bytes como van en la app:

| Tamaño | Acierta a la primera | Entre las 3 primeras | Si dice ≥70 %, acierta (y lo dice en…) | Tiempo en Hermes* |
| --- | --- | --- | --- | --- |
| 160 px | 76.3 % | 89.1 % | 92 % (67 % de las fotos) | ~5.5 s |
| 128 px | 70.6 % | 85.8 % | 90 % (60 %) | ~3.5 s |

Con 15 especies más, casi lo mismo que la vez anterior (77.5 % y 90 % entre
56). La pitahaya tiene más fotos que las demás (≈1,100: blanca, roja y
amarilla) porque es de las que más se confunden —con la lengua de suegra y la
sábila, por los tallos—: acierta a la primera el 76 % y entre las 3 primeras
el 92 %. Lo más flojo sigue siendo el aguacate (45 %: sus hojas se parecen a
las del ficus y el mango).

## La vez anterior (25 sep 2026, mañana)

22,535 fotos de 56 especies (≈330 por especie) + 2,384 de otras plantas para
la clase "otra". Examen con 4,382 fotos apartadas antes de entrenar, una foto a
la vez, ya con los pesos en bytes como van en la app:

| Tamaño | Acierta a la primera | Entre las 3 primeras | Si dice ≥70 %, acierta (y lo dice en…) | Tiempo en Hermes* |
| --- | --- | --- | --- | --- |
| 160 px | 77.5 % | 90 % | 91 % (71 % de las fotos) | ~5.5 s |
| 128 px | 71 % | 86 % | 90 % (61 %) | ~3.5 s |

Con las mismas fotos, la cabeza de una sola capa (formato 1) sacaba 68.6 % y
85.6 % a 160 px: la capa oculta vale 9 puntos. La vez anterior (24 sep) eran
75 % y 90 %, pero entre sólo 30 especies; ahora son casi el doble y acierta más.

\* Hermes 0.13 en una laptop Ryzen 7 5800H, un núcleo. En el teléfono varía; la
app mide y elige el tamaño sola (`elegirLado`). La capa oculta agrega unas
700 mil multiplicaciones por foto: no se nota junto a los 300 millones de la red.

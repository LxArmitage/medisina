# MEDISINA

El expediente clínico de tus plantas. Diagnóstico que recuerda, no que adivina.

> **Sina** (*Lophocereus schottii*): cactus columnar de Sonora y Sinaloa, de fruto
> rojo comestible y medicinal, capaz de curarse y prosperar en el desierto.

Concepto completo y decisiones de arquitectura: [docs/01-concepto-y-arquitectura.md](docs/01-concepto-y-arquitectura.md)

## Qué hay construido

### Fase 1: el gemelo digital

El MVP no es el modelo de visión: es el **gemelo digital**.

- Alta de plantas con ficha, apodo, ubicación, maceta y clima de la zona.
- **Balance hídrico dinámico**: agenda de riego recalculada a diario con ET₀ real
  y pronóstico de lluvia, no con pautas fijas.
- **Expediente**: bitácora de riegos, podas, fertilizaciones y brotes.
- **Fenología**: qué le toca y cuándo, ajustado con el historial de esa planta.
- **Equipos**: agrupación por perfil de luz y agua, con detección de las parejas
  que riegan igual pero no pueden compartir maceta.
- **Voz del gemelo**: la planta habla en primera persona, siempre anclada a un
  dato de su expediente.
- Funciona sin conexión: SQLite local y degradación explícita del clima
  (API → caché → climatología de la zona).

### Fase 2 (en curso): reconocer y conversar, sin internet

- **Reconocimiento de especie en el teléfono**: MobileNet V2 como "ojo" y una
  capa propia entrenada con 29,245 fotos de 71 especies. Acierta a la primera
  el 76.3 % y entre las tres primeras el 89.1 %, en un examen con 5,729 fotos
  apartadas antes de entrenar. Cómo se entrena: [entrenamiento/vision/LEEME.md](entrenamiento/vision/LEEME.md).
- **Preguntas en lenguaje natural**: un clasificador de intención propio (96 de
  cada 100 preguntas nuevas) que sigue la conversación. La respuesta se arma con
  datos del expediente, así que no puede inventar un número.
- **Lectura de síntomas**: "puntas cafés y secas", "base blanda" o "hojas de
  abajo amarillas" llevan a causas y tratamientos distintos.
- **Cuenta en el dispositivo**: sin servidor; la contraseña se guarda sólo como
  huella PBKDF2 con sal.
- **Jardines compartidos por QR**, de teléfono a teléfono, y racha de cuidado.

## Cómo correrlo

```bash
npm install
npx expo start
```

Escanea el QR con Expo Go. En la primera ejecución se siembran siete plantas de
ejemplo, elegidas para que cada una ejercite una rama distinta del motor: el
helecho bajo techo, el potos sin drenaje, el cactus que casi no bebe y el ficus
de raíz invasiva.

Para enseñarlo sin instalar nada, corre igual en el navegador:

```bash
npx expo start --web
```

```bash
npm test     # 893 pruebas
npm run lint # tipos de la app y de las pruebas
```

### En el celular, sin la PC prendida

La app se publica en EAS Update (proyecto `@lxarmitage/MEDISINA`, canal
`produccion`) y Expo Go la baja de ahí: no hace falta que la computadora esté
encendida ni en la misma red. Después de cambiar el código:

```bash
npm run publicar -- --message "qué cambió"
```

El teléfono toma la versión nueva la siguiente vez que abre la app en Expo Go
(a veces hace falta cerrarla y abrirla dos veces: la primera la baja, la
segunda la usa).

Para abrirla la primera vez, escanea con la cámara el QR de
<https://qr.expo.dev/eas-update?projectId=f95705f3-c6f6-4ff3-a8ef-eac22ce8bde9&runtimeVersion=exposdk:57.0.0&channel=produccion>.
Desde ahí queda en la lista de recientes de Expo Go. Es este enlace:

```text
exp://u.expo.dev/f95705f3-c6f6-4ff3-a8ef-eac22ce8bde9?runtime-version=exposdk%3A57.0.0&channel-name=produccion
```

`runtimeVersion` usa la política `sdkVersion` (`exposdk:57.0.0`), que es la
que Expo Go acepta. Al subir de SDK, Expo Go también se actualiza y hay que
volver a publicar.

## Estructura

```
app/                    Pantallas (expo-router)
  (tabs)/index.tsx      Agenda de hoy
  (tabs)/plantas.tsx    Listado
  (tabs)/equipos.tsx    Agrupación por perfil
  planta/[id].tsx       Expediente clínico
  planta/nueva.tsx      Alta

src/dominio/            Lógica pura, sin React ni red — es donde está el valor
  tipos.ts              Modelo del gemelo digital
  balanceHidrico.ts     Motor de cubeta y recomendación de riego
  compatibilidad.ts     Mecánica de equipos
  fenologia.ts          Ventanas esperadas y ajuste por historial
  gemelo.ts             Snapshot, voz y verificación de anclaje
  catalogo.ts           Catálogo semilla de especies

src/datos/              Persistencia, clima y datos de ejemplo
  contrato.ts           Interfaz del repositorio
  sqlite.ts             Implementación real (iOS y Android)
  memoria.ts            Implementación para web y pruebas
  motor.ts              Selección por plataforma
  clima.ts              Open-Meteo, con degradación explícita
src/ia/                 Clasificador de intención y red de visión (corren en el teléfono)
src/servicios/          Une dominio y datos
src/ui/                 Tema y componentes
pruebas/                Suite de pruebas
entrenamiento/          Cómo se entrenan los modelos (no corre en la app)
```

El dominio se mantiene **puro a propósito**: se prueba sin dispositivo, sin red y
sin emulador. Toda la mezcla con el mundo exterior vive en `src/servicios`.

La persistencia está detrás de una interfaz: SQLite en el teléfono, almacén en
memoria en web y en Jest. No es sólo por la demo en navegador — es lo que
permite probar la capa de servicios, degradación de clima incluida, sin
emulador.

## Reglas que el código hace cumplir

1. **El LLM narra, no diagnostica.** Recibe un snapshot en JSON y sólo lo
   verbaliza. `verificarAnclaje()` detecta cuando una respuesta afirma números
   que no están en el snapshot.
2. **Sin químicos desde un diagnóstico preliminar.** Un diagnóstico hecho sin
   conexión nunca autoriza recomendar un producto.
3. **La degradación se dice.** Si el clima viene de la climatología y no del
   pronóstico, la interfaz lo advierte en lugar de fingir precisión.

## Notas de dependencias

`.npmrc` fija `legacy-peer-deps=true`: el árbol de Expo 57 trae un choque de
peers entre `react-dom` 19.3 y `react` 19.2 que detiene a npm sin esa bandera.

## Pendiente

- Fase 2: modelo de patología en dispositivo, cascada de confianza y prior
  geoclimático.
- Fase 3: validación comunitaria, directorio de viveros, LLM sobre el snapshot.
- Fase 4: sensores BLE de humedad y luz.

## Autor

**Alonso (ArmitaGG3)**, estudiante de Ingeniería en Sistemas · [GitHub](https://github.com/LxArmitage)

## Licencia

© 2026 Alonso (ArmitaGG3). Todos los derechos reservados. El código se publica
para consulta; no se permite copiarlo, modificarlo ni distribuirlo sin permiso.
Los componentes de terceros conservan su licencia: ver [LICENSE](LICENSE).

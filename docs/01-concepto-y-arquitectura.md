# MEDISINA — Concepto de producto y arquitectura técnica

> **Sina** (*Lophocereus schottii*) — cactus columnar del noroeste de México (Sonora y Sinaloa).
> Fruto rojo comestible y medicinal, apreciado por comunidades indígenas.
> Planta capaz de curarse y prosperar en condiciones extremas del desierto.
>
> **MEDI + SINA** = medicina para la planta + resiliencia del desierto + identidad del norte de México.

Documento vivo. Versión 0.1 — 17 de septiembre de 2026.

---

## 1. Tesis del producto

Las apps existentes resuelven **una sola pregunta, una sola vez**: "¿qué es esto?" o "¿qué tiene esto?".
Toman una foto, devuelven una etiqueta, y olvidan todo.

**MEDISINA no es un clasificador de fotos. Es un expediente clínico.**

La foto es solo el punto de entrada. El valor real se acumula con el tiempo: después de tres meses,
MEDISINA sabe que *tu* limonero, en *tu* patio, en *tu* clima, se estresa cada mayo y que el año
pasado esa misma mancha resultó ser sol quemante y no hongo. Ninguna app del mercado tiene memoria.

Esa es la barrera defensiva: un competidor puede copiar el modelo de visión en seis meses.
No puede copiar dos años de historial longitudinal de tus usuarios.

### Frase de posicionamiento

> *El expediente clínico de tus plantas. Diagnóstico que recuerda, no que adivina.*

---

## 2. Análisis competitivo → hueco que ocupamos

| Dimensión | Plantix | PictureThis | LeafSnap | **MEDISINA** |
|---|---|---|---|---|
| Público | Cultivo de campo (maíz, arroz, tomate) | Ornamental / identificación | Árboles y hojas | **Casa y jardín, México primero** |
| Offline | No (depende de nube) | Parcial | Parcial | **Edge-first, nube como refuerzo** |
| Contexto ambiental | Ninguno | Débil (pautas rígidas) | Ninguno | **Geo + clima + sensor + historial** |
| Salida | Diagnóstico aislado | ID + muro de pago | Lista ambigua | **Diagnóstico + tratamiento + dónde comprarlo** |
| Memoria de la planta | No | Recordatorios genéricos | No | **Gemelo digital con bitácora** |
| Monetización | Freemium agrícola | Suscripción agresiva | Anuncios invasivos | **Lead-gen a viveros locales** |
| Ante el error | Silencio | Silencio | Lista de opciones | **Validación comunitaria + reentreno** |

### Contras concretos que atacamos

- **Plantix — sesgo agrícola.** Inútil para una monstera o un nopal de maceta. Nosotros entramos por
  planta de casa y jardín urbano, no por hectárea.
- **Plantix — dependencia de red.** Nuestro modelo corre en el teléfono; la nube solo confirma.
- **PictureThis — muro de pago en el tratamiento.** El diagnóstico y el tratamiento son gratis
  **siempre**. Se monetiza el insumo, no la información.
- **PictureThis — riego desfasado.** Nada de "riega cada 7 días". Balance hídrico dinámico con
  clima real y pronóstico de lluvia.
- **LeafSnap — resultados ambiguos.** Si la confianza es baja, no devolvemos una lista de 12
  opciones: pedimos una foto mejor, o mandamos el caso a validación humana.
- **LeafSnap — regresiones tras actualizar.** Versionado de modelos con suite de regresión
  obligatoria antes de publicar (ver §8).

---

## 3. Los cinco puntos ciegos técnicos, resueltos

### 3.1 Modelos duales (especie ≠ patología)

Correcto: **no meter ambas tareas en una sola red.** Arquitectura en cascada de tres etapas:

1. **Portero de calidad** (modelo diminuto, ~1 MB). ¿Esto es una planta? ¿La foto sirve
   (enfoque, luz, encuadre)? Rechaza antes de inferir. Aquí se mata buena parte de los falsos
   positivos que sufre LeafSnap.
2. **Modelo A — Especie.** Clasificación fina con *metric learning* (embeddings + vecinos más
   cercanos), no softmax cerrado. Ventaja: puede decir "no sé qué es, pero se parece a estas tres"
   y admitir especies nuevas sin reentrenar toda la red.
3. **Modelo B — Patología.** **Condicionado por la especie** que salió del Modelo A. Una clorosis
   en una monstera no significa lo mismo que en un cactus. Además **multietiqueta, no
   multiclase**: una planta real puede tener cochinilla *y* exceso de riego al mismo tiempo.

Mismo backbone compartido (MobileNetV3 / MobileViT) con dos cabezas distintas: se ahorra memoria
en el teléfono sin degradar la precisión de cada tarea.

### 3.2 El dilema Edge AI → cascada de confianza

La compresión sí eleva los falsos positivos en síntomas sutiles. La solución no es evitar la
compresión: es **dejar de tratar al modelo del teléfono como la última palabra**.

```
Foto → modelo INT8 en dispositivo → confianza
   ≥ umbral alto  → "Diagnóstico confirmado"
   zona media     → "Diagnóstico preliminar (sin conexión)" + cola de confirmación
   < umbral bajo  → no se muestra nada; se pide mejor foto
```

Los casos de la zona media se encolan y se reprocesan contra el modelo grande en la nube cuando
vuelve la señal. El usuario recibe una notificación: *"Revisé tu foto con más detalle: no era
oídio, era polvo de la calle."* Esa corrección honesta genera más confianza que fingir certeza.

**Regla dura:** si el diagnóstico implica aplicar un producto químico, nunca se recomienda
tratamiento desde un diagnóstico de zona media. Primero se confirma.

### 3.3 Geolocalización como probabilidad previa (la palanca más barata)

Un hongo tropical es estadísticamente imposible en Hermosillo en junio. Aplicamos Bayes sobre la
salida del modelo:

```
P(enfermedad | imagen, región, mes) ∝ P(imagen | enfermedad) · P(enfermedad | región, mes, especie)
```

La segunda parte es una **tabla de prevalencia** por zona climática (Köppen) × mes × especie
hospedera. No requiere tocar la red neuronal: es un reescalado de logits. Es la mejora de
precisión percibida más grande por unidad de esfuerzo de ingeniería.

Fuentes para poblar la tabla: SINAVEF/SENASICA (alertas fitosanitarias de México), CONABIO, GBIF,
y — a mediano plazo — **los propios reportes confirmados de nuestros usuarios**, que cierran el
ciclo y hacen que la tabla mejore sola por región.

Efecto secundario valioso: cobertura nacional real. Una app entrenada con datos de Europa o India
propone plagas que en Sinaloa no existen.

### 3.4 Integración IoT / sensores

Soporte BLE opcional para sensores de humedad de suelo y luz (clase Xiaomi Mi Flora, o un ESP32
casero documentado en el repo). **Nada se bloquea si no hay sensor**: sin sensor el gemelo digital
*estima* el balance hídrico; con sensor lo *mide*. La app dice cuál de los dos está usando.

Es literalmente el hueco que ninguna app comercial masiva cubre, y es barato de ocupar.

### 3.5 Validación comunitaria

Los diagnósticos de baja confianza y los casos que el usuario marca como "no era eso" van a un
feed de revisión. Viveristas, ingenieros agrónomos y usuarios veteranos confirman o corrigen.

- Reduce la frustración del error algorítmico (hay una salida humana).
- Genera datos etiquetados de calidad, gratis y regionales.
- Es el motor de retención del modelo iNaturalist.

Sistema de reputación por región y por especie: quien acierta en cactáceas de Sonora sube rango
en cactáceas de Sonora, no en orquídeas.

---

## 4. Gemelo digital conversacional

### 4.1 Qué guarda cada planta

Cada planta registrada es una **entidad con expediente**, no una foto suelta:

- **Identidad** — especie, apodo, edad / fecha de adquisición, línea de tiempo de fotos.
- **Ubicación y ambiente** — geo, exposición (sol pleno / semisol / sombra / interior), maceta o
  suelo, sustrato, orientación.
- **Bitácora de eventos** — riegos, fertilizaciones, trasplantes, podas, tratamientos aplicados,
  observaciones del usuario.
- **Estado derivado** (calculado, no capturado) — balance hídrico del sustrato, presupuesto de luz
  acumulado, índice de estrés, días desde el último evento relevante.
- **Fenología** — ventana esperada de brote, floración y fructificación según especie × zona
  climática. Esto responde la pregunta de *"¿en qué temporada le saldrá una nueva rama u hoja?"*.

### 4.2 Modelo de balance hídrico (el "sabe cómo se siente")

Modelo de cubeta, simple y suficiente:

```
agua_disponible(t) = agua(t-1) + riego + lluvia − ET₀ × Kc × factor_maceta
```

`ET₀` viene de la API meteorológica; `Kc` es el coeficiente por especie; `factor_maceta` ajusta por
volumen y material. De ahí salen las alertas reales de riego.

### 4.3 El LLM narra, no diagnostica

**Regla de diseño no negociable.** El LLM recibe un *snapshot* estructurado del gemelo (JSON) más
el diagnóstico de visión, y su único trabajo es **verbalizarlo en primera persona** y responder
preguntas ancladas a ese JSON. No inventa agronomía.

```
"Siento las raíces demasiado húmedas desde el martes y el suelo no está drenando."
      ↑                          ↑                              ↑
  tono narrativo        balance_hidrico = 0.91         dias_sobre_capacidad = 5
                        (del modelo, no del LLM)       (de la bitácora, no del LLM)
```

Si el dato no está en el snapshot, la planta dice que no lo sabe. Esto es lo que separa una
experiencia encantadora de un generador de consejos falsos con voz simpática.

---

## 5. Funcionalidades derivadas de las ideas del equipo

### 5.1 Historial clínico de seguimiento *(idea de German)*

El núcleo del producto, no un extra. Línea de tiempo por planta: fotos, diagnósticos, tratamientos
aplicados y su resultado. Permite la pregunta que ninguna app puede contestar hoy:
*"¿funcionó lo que le puse hace tres semanas?"*

### 5.2 Alertas de riego por día + meteorología *(idea de German)*

No "riega cada 7 días". La agenda se recalcula a diario con pronóstico:
*"Mañana no riegues el jazmín: vienen 12 mm de lluvia. Sí riega los helechos del porche techado."*

Ese matiz —el techado no recibe lluvia— es exactamente lo que el gemelo digital sabe y una pauta
rígida no.

### 5.3 Nombre, edad y ficha *(idea de German)*

Apodo, fecha de adquisición, edad estimada. Suena cosmético; es apego. Una planta con nombre no
se abandona, y el apego es retención.

### 5.4 Fenología: cuándo le saldrá una rama nueva *(idea de German)*

Ventanas esperadas por especie × zona climática, ajustadas por el historial real de esa planta.
Convierte la app de reactiva ("tu planta está enferma") a **anticipatoria** ("en dos semanas debería
brotar; si no brota, avísame"). La anticipación es lo que hace que abran la app sin crisis.

### 5.5 Agrupación tipo "Pokémon" *(idea de German)*

Idea excelente, y agronómicamente real: es **zonificación y plantación compañera** con envoltura de
videojuego. Las plantas se agrupan por perfil de requerimientos:

`sol pleno` · `semisol` · `sombra` · `acuáticas` · `cactáceas y suculentas` · `arbóreas`

La app calcula compatibilidad entre dos plantas a partir de: banda de luz, frecuencia de riego,
drenaje y pH del sustrato, agresividad de raíz, y zona de rusticidad. Resultado:

> *"Estas tres pueden compartir maceta y calendario de riego. Esta cuarta no: pide la mitad de agua
> y se te va a pudrir."*

Es la interfaz que vuelve divertida la parte aburrida (agrupar por necesidades hídricas y lumínicas).
Nombre sugerido para la unidad: **"cantero"** o **"equipo"**.

### 5.6 Vivero e insumos locales *(idea de German)* — **y el modelo de negocio**

Un diagnóstico sin acceso al remedio es frustración. Al cerrar un diagnóstico:

> *Necesitas un fungicida a base de cobre. Tres lugares cerca de ti lo manejan.*

Se recomienda el **ingrediente activo**, no una marca, y se listan viveros y agroservicios locales.
Esto es la monetización: **lead-gen y comisión con viveros locales, no un muro de pago sobre el
diagnóstico.** Ataca de frente el peor defecto de PictureThis y encaja con la economía de viveros
en México, que hoy casi no tiene canal digital.

---

## 6. Alcance por fases

### Fase 1 — MVP (el gemelo, no el modelo)

Contraintuitivo pero importante: **el MVP no debe ser el modelo de visión propio.**
Construir una CNN de patologías toma meses y sin usuarios no hay datos para mejorarla.

- Registro de plantas con ficha, apodo y foto.
- Identificación de especie vía **API externa** (Pl@ntNet u similar) — se sustituye después.
- Bitácora de riego y eventos.
- Balance hídrico + alertas diarias con clima real y pronóstico.
- Agrupación por perfil (luz / agua) — la mecánica de "equipos".
- Historial clínico visible.

Esto ya es un producto que nadie tiene, y **empieza a acumular el dato que después entrena el
modelo propio**.

### Fase 2 — Visión propia

- Portero de calidad + Modelo A (especie) en dispositivo.
- Modelo B (patología) condicionado por especie.
- Cascada de confianza edge → nube.
- Prior geoclimático.

### Fase 3 — Red

- Validación comunitaria y reputación.
- Directorio de viveros e insumos.
- Voz conversacional de la planta (LLM sobre el snapshot).

### Fase 4 — Físico

- Sensores BLE.
- Guía de sensor casero ESP32.

---

## 7. Riesgos y puntos a vigilar

| Riesgo | Mitigación |
|---|---|
| **Recomendar plaguicidas** implica responsabilidad legal | Solo ingredientes activos con registro COFEPRIS; mostrar siempre EPP, dosis y periodo de carencia; nunca recomendar desde diagnóstico no confirmado |
| El nombre **MEDISINA** se lee como "medicina" | Riesgo de categoría equivocada en tiendas de apps y de confusión con salud humana. Verificar disponibilidad de marca (IMPI) antes de invertir en identidad. No hacer afirmaciones médicas sobre el fruto de la sina para consumo humano |
| Arranque en frío del dato regional | Fase 1 vive de APIs externas; los datos propios llegan con los usuarios |
| Coste de la nube por inferencia | La cascada hace que solo la zona media llegue a la nube (estimado: 10-20 % de las fotos) |
| Regresión de precisión al actualizar modelo | Suite de regresión con conjunto dorado por región; no se publica un modelo que baje precisión en ninguna zona climática (ver §8) |
| Privacidad de geolocalización | Guardar zona climática y municipio, no coordenadas exactas; el prior no necesita precisión de GPS |

---

## 8. Calidad y pruebas

Dado que esto vive en la carpeta de proyectos QA, vale la pena fijarlo desde el día uno:

- **Conjunto dorado por región** — set fijo de imágenes etiquetadas por zona climática. Ningún
  modelo se publica si baja la precisión en *cualquiera* de las zonas, aunque suba el promedio
  global. Es exactamente la falla de LeafSnap.
- **Pruebas del balance hídrico** — casos sintéticos: ola de calor, semana de lluvia, maceta
  techada, trasplante. Verificar que la alerta de riego reacciona como debe.
- **Pruebas de anclaje del LLM** — corpus de snapshots con la respuesta correcta esperada.
  Detectar cuando el modelo afirma algo que no está en el JSON. Es la prueba más importante de
  todo el sistema.
- **Pruebas offline** — modo avión obligatorio en la suite: la app debe diagnosticar, registrar
  riegos y encolar confirmaciones sin red.
- **Matriz de dispositivos** — la gama baja de Android es el escenario real en campo; medir
  latencia de inferencia y consumo de batería ahí, no en gama alta.

---

## 9. Decisiones abiertas

1. **Plataforma** — React Native / Expo (un código, iOS y Android, buen soporte TFLite) vs. nativo
   (mejor rendimiento de cámara e inferencia). Recomendación: Expo para Fase 1, evaluar nativo
   cuando entre el modelo propio.
2. **Backend** — Supabase / Firebase para arrancar rápido vs. propio desde el inicio.
3. **API meteorológica** — Open-Meteo (gratis, sin llave, entrega ET₀) es la apuesta obvia para el MVP.
4. **Alcance geográfico inicial** — ¿Sonora y Sinaloa como piloto (coherente con el nombre y con
   el prior climático), o nacional desde el arranque?

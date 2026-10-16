/**
 * Todo lo de una planta, en una sola pantalla.
 *
 * Antes eran dos: aquí el expediente, y en otra el gemelo en grande con sus
 * preguntas y su proyección. Había que tocar "ver en grande" para la mitad de
 * la información y volver para la otra mitad. Nadie hace ese viaje dos veces:
 * se quedaban con la mitad que les tocó primero.
 *
 * Ahora baja todo de un tirón, en el orden en que importa: cómo se ve, qué
 * dice, cómo anda de agua, qué significa lo que ves, qué le puedes preguntar,
 * qué sigue, qué registrar y su historia.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { nuevoId, obtenerPlanta } from '../../src/datos/db';
import { etiquetaBanda } from '../../src/dominio/compatibilidad';
import { contrastarObservacion } from '../../src/dominio/contraste';
import { curiosidadesDe, datoDelDia } from '../../src/dominio/curiosidades';
import { lineaDeNombres, nombresDe } from '../../src/dominio/nombres';
import type { Hallazgo } from '../../src/dominio/contraste';
import { edadEnMeses, edadLegible, etiquetaFenomeno } from '../../src/dominio/fenologia';
import { calcularMorfologia, describirMorfologia } from '../../src/dominio/morfologia';
import { PREGUNTAS_SUGERIDAS, responder } from '../../src/dominio/preguntas';
import type { Respuesta } from '../../src/dominio/preguntas';
import type { Evento } from '../../src/dominio/tipos';
import { areaEvaporacionM2, mmAMl } from '../../src/dominio/balanceHidrico';
import { estadoDePlanta } from '../../src/servicios/agenda';
import { registrarCuidado } from '../../src/servicios/cuidado';
import { fotoExiste } from '../../src/servicios/fotos';
import { EscenarioPlanta } from '../../src/ui/EscenarioPlanta';
import type { EstadoDePlanta } from '../../src/servicios/agenda';
import {
  BarraHumedad,
  Boton,
  Chip,
  Seccion,
  Tarjeta,
  estilosTexto,
} from '../../src/ui/componentes';
import { colorDeNivel, espacio, etiquetaNivel, fuente, radio, useTema } from '../../src/ui/tema';

export default function PantallaPlanta() {
  const { id, naciendo } = useLocalSearchParams<{ id: string; naciendo?: string }>();
  const tema = useTema();
  const textos = estilosTexto(tema);
  const [estado, setEstado] = useState<EstadoDePlanta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [pregunta, setPregunta] = useState('');
  const [dialogo, setDialogo] = useState<Array<{ mia: string; suya: Respuesta }>>([]);

  const cargar = useCallback(async () => {
    if (!id) return;
    const planta = await obtenerPlanta(id);
    setEstado(planta ? await estadoDePlanta(planta) : null);
    setCargando(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const registrar = useCallback(
    async (tipo: Evento['tipo'], cantidadMl?: number, nota?: string) => {
      if (!id) return;
      await registrarCuidado({
        id: nuevoId(),
        plantaId: id,
        tipo,
        fecha: new Date().toISOString(),
        cantidadMl,
        nota,
      });
      await cargar();
    },
    [id, cargar],
  );

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: tema.fondo }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  if (!estado) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: espacio.xl }}>
        <Text style={textos.cuerpo}>No se encontró esta planta.</Text>
      </View>
    );
  }

  const { planta, especie, estadoHoy, recomendacion, eventos, snapshot } = estado;
  const color = colorDeNivel(tema, estadoHoy.nivel);

  const morfologia = calcularMorfologia({
    especie,
    estado: estadoHoy,
    fenologia: snapshot.fenologia,
    edadMeses: edadEnMeses(planta.fechaAdquisicion),
    medidas: planta.medidas,
  });

  // Cantidad para el registro rápido cuando la planta no tiene déficit: una
  // dosis proporcional a su sustrato y su maceta. Un cactus de maceta chica no
  // recibe lo mismo que un limonero en tierra.
  const mlPorDefecto = Math.round(
    mmAMl(especie.aguaUtilMm * 0.7, areaEvaporacionM2(planta.contenedor)),
  );

  const hallazgos = contrastarObservacion({
    medidas: planta.medidas,
    estado: estadoHoy,
    especie,
  });
  const fotos = eventos.filter((e) => e.fotoUri);

  function preguntar(texto: string) {
    const limpia = texto.trim();
    if (!limpia || !estado) return;
    setDialogo((previo) => [
      ...previo,
      {
        mia: limpia,
        // Los temas de los turnos anteriores: es lo que le permite entender
        // "¿y de sol?" sin que se repita la pregunta entera.
        suya: responder(
          limpia,
          estado.snapshot,
          estado.especie,
          previo.map((t) => t.suya.intencion),
        ),
      },
    ]);
    setPregunta('');
  }

  return (
    <>
      <Stack.Screen options={{ title: planta.apodo }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: tema.fondo }}
        contentContainerStyle={{ padding: espacio.lg, gap: espacio.xl, paddingBottom: espacio.xxl }}
      >
        {/* Identidad */}
        <View style={{ gap: espacio.sm }}>
          <Text style={textos.titulo}>{planta.apodo}</Text>
          <Text style={textos.subtitulo}>
            {nombresDe(especie).principal} · <Text style={{ fontFamily: fuente.tituloItalica }}>{especie.nombreCientifico}</Text>
          </Text>
          {lineaDeNombres(especie) !== '' && <Text style={[textos.suave, { marginTop: -4 }]}>{lineaDeNombres(especie)}</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
            <Chip texto={edadLegible(planta.fechaAdquisicion)} color={tema.textoSuave} />
            <Chip texto={etiquetaBanda(planta.ubicacion.exposicion)} />
            {planta.ubicacion.techado && <Chip texto="bajo techo" color={tema.textoSuave} />}
            {planta.ubicacion.municipio && (
              <Chip texto={planta.ubicacion.municipio} color={tema.textoSuave} />
            )}
          </View>
        </View>

        {/* El gemelo, ya en grande y con todo lo suyo: 3D, dibujo, partes
            tocables y proyección. No hay que ir a ningún lado a verlo. */}
        <EscenarioPlanta estado={estado} naciendo={naciendo === '1'} />

        {/* Voz del gemelo */}
        <View
          style={{
            backgroundColor: tema.primarioSuave,
            borderRadius: radio.lg,
            padding: espacio.lg,
            gap: espacio.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
            <Ionicons name="chatbubble-ellipses" size={16} color={tema.primario} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.primario }}>
              {planta.apodo.toUpperCase()} DICE
            </Text>
          </View>
          <Text style={[textos.cuerpo, { fontSize: 16, lineHeight: 23 }]}>{estado.voz}</Text>
          <Text style={[textos.suave, { fontSize: 11 }]}>
            Generado con {snapshot.hechos.length} datos de su expediente, sin inventar nada.
          </Text>
        </View>

        {/* Lo que sale de cruzar tu ojo con el modelo */}
        {hallazgos.length > 0 && (
          <Seccion titulo="Lo que esto significa">
            <View style={{ gap: espacio.md }}>
              {hallazgos.map((hallazgo) => (
                <TarjetaHallazgo key={hallazgo.clave} hallazgo={hallazgo} />
              ))}
            </View>
          </Seccion>
        )}

        {/* Estado hídrico */}
        <Seccion titulo="Agua">
          <Tarjeta>
            <View style={{ gap: espacio.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={textos.encabezadoTarjeta}>
                  {Math.round(estadoHoy.fraccionDisponible * 100)} % de capacidad útil
                </Text>
                <Chip texto={etiquetaNivel(estadoHoy.nivel)} color={color} />
              </View>

              <BarraHumedad
                fraccion={estadoHoy.fraccionDisponible}
                nivel={estadoHoy.nivel}
                umbralEstres={especie.umbralEstres}
              />

              <View style={{ gap: espacio.xs }}>
                <Dato
                  etiqueta="Demanda de hoy"
                  valor={`${estadoHoy.demandaMm.toFixed(1)} mm`}
                />
                <Dato
                  etiqueta="Empieza a sufrir por debajo de"
                  valor={`${Math.round(especie.umbralEstres * 100)} %`}
                />
                <Dato
                  etiqueta="Clima"
                  valor={
                    estado.serie.fuente === 'api'
                      ? 'pronóstico real'
                      : estado.serie.fuente === 'cache'
                        ? 'último pronóstico guardado'
                        : 'promedio de la zona (sin conexión)'
                  }
                />
              </View>

              <Text style={[textos.cuerpo, { color: tema.textoSuave }]}>
                {recomendacion.motivo}
              </Text>

              {recomendacion.accion === 'regar' && (
                <Boton
                  titulo={`Registrar riego de ${recomendacion.mlSugeridos} ml`}
                  onPress={() => registrar('riego', recomendacion.mlSugeridos)}
                />
              )}

              {recomendacion.accion === 'cambiar_agua' && (
                <Boton titulo="Ya le cambié el agua" onPress={() => registrar('cambio_agua')} />
              )}
            </View>
          </Tarjeta>
        </Seccion>

        {/* Fenología */}
        {snapshot.fenologia.length > 0 && (
          <Seccion titulo="Qué sigue">
            {snapshot.fenologia.slice(0, 3).map((evento) => (
              <Tarjeta key={`${evento.fenomeno}-${evento.inicio}`}>
                <View style={{ flexDirection: 'row', gap: espacio.md, alignItems: 'center' }}>
                  <Ionicons
                    name={evento.enCurso ? 'flower' : 'flower-outline'}
                    size={22}
                    color={evento.enCurso ? tema.acento : tema.textoSuave}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={textos.encabezadoTarjeta}>
                      {capitalizar(etiquetaFenomeno(evento.fenomeno))}
                    </Text>
                    <Text style={textos.suave}>
                      {evento.enCurso
                        ? 'En temporada ahora mismo'
                        : `En unos ${evento.diasParaInicio} días`}
                      {evento.fuente === 'historial' && ' · ajustado con su historial'}
                    </Text>
                  </View>
                </View>
              </Tarjeta>
            ))}
          </Seccion>
        )}

        {/* Un dato de su especie, distinto cada día. */}
        {curiosidadesDe(especie.id).length > 0 && (
          <Pressable
            onPress={() => router.push(`/especie/${especie.id}`)}
            accessibilityRole="button"
            accessibilityHint="Abre la ficha de su especie"
            style={({ pressed }) => ({
              backgroundColor: tema.superficie,
              borderRadius: radio.lg,
              borderWidth: 1,
              borderColor: tema.borde,
              padding: espacio.lg,
              gap: espacio.sm,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#E8940C', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={14} color="#FFFFFF" />
              </View>
              <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 15, color: tema.texto }}>¿Sabías que…?</Text>
            </View>
            <Text style={[textos.cuerpo, { fontSize: 15, lineHeight: 22 }]}>{datoDelDia(especie.id, new Date(), planta.id)}</Text>
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.primario }}>
              Más sobre {nombresDe(especie).principal.toLowerCase()} ›
            </Text>
          </Pressable>
        )}

        {/* Nota de la especie */}
        {especie.nota && (
          <Tarjeta style={{ backgroundColor: tema.superficieAlta }}>
            <View style={{ flexDirection: 'row', gap: espacio.md }}>
              <Ionicons name="bulb-outline" size={18} color={tema.textoSuave} />
              <Text style={[textos.cuerpo, { flex: 1 }]}>{especie.nota}</Text>
            </View>
          </Tarjeta>
        )}

        {/* Acciones rápidas */}
        <Seccion titulo="Registrar">
          <View style={{ flexDirection: 'row', gap: espacio.sm, flexWrap: 'wrap' }}>
            {planta.contenedor.tipo === 'agua' ? (
              <Boton
                titulo="Cambié el agua"
                variante="secundario"
                onPress={() => registrar('cambio_agua')}
                style={{ flexGrow: 1 }}
              />
            ) : (
              <Boton
                titulo="Riego"
                variante="secundario"
                onPress={() => registrar('riego', recomendacion.mlSugeridos || mlPorDefecto)}
                style={{ flexGrow: 1 }}
              />
            )}
            {/* "La revisé" cuenta para la racha igual que un riego. Es lo que
                permite mantenerla los días en que la planta NO quiere agua. */}
            <Boton
              titulo="La revisé"
              variante="secundario"
              onPress={() => registrar('observacion', undefined, 'La revisé: todo en orden')}
              style={{ flexGrow: 1 }}
            />
            <Boton
              titulo="Fertilicé"
              variante="secundario"
              onPress={() => registrar('fertilizacion')}
              style={{ flexGrow: 1 }}
            />
            <Boton
              titulo="Brote nuevo"
              variante="secundario"
              onPress={() => registrar('brote')}
              style={{ flexGrow: 1 }}
            />
            <Boton
              titulo="Podé"
              variante="secundario"
              onPress={() => registrar('poda')}
              style={{ flexGrow: 1 }}
            />
          </View>
        </Seccion>

        {/* Pregúntale */}
        <Seccion titulo="Pregúntale">
          <View style={{ gap: espacio.md }}>
            {dialogo.map((turno, i) => (
              <View key={i} style={{ gap: espacio.sm }}>
                <View
                  style={{
                    alignSelf: 'flex-end',
                    maxWidth: '85%',
                    backgroundColor: tema.superficieAlta,
                    borderRadius: radio.lg,
                    borderBottomRightRadius: radio.sm,
                    paddingHorizontal: espacio.md,
                    paddingVertical: espacio.sm,
                  }}
                >
                  <Text style={textos.cuerpo}>{turno.mia}</Text>
                </View>

                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '92%',
                    backgroundColor: tema.primarioSuave,
                    borderRadius: radio.lg,
                    borderBottomLeftRadius: radio.sm,
                    padding: espacio.md,
                    gap: 6,
                  }}
                >
                  <Text style={textos.cuerpo}>{turno.suya.texto}</Text>
                  {turno.suya.dato && (
                    <Text
                      style={{
                        fontFamily: fuente.cuerpoFuerte,
                        fontSize: 11.5,
                        color: tema.primario,
                      }}
                    >
                      {turno.suya.dato}
                    </Text>
                  )}
                </View>
              </View>
            ))}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
              {PREGUNTAS_SUGERIDAS.map((sugerida) => (
                <Pressable
                  key={sugerida}
                  onPress={() => preguntar(sugerida)}
                  style={({ pressed }) => ({
                    borderColor: tema.borde,
                    borderWidth: 1,
                    borderRadius: radio.completo,
                    paddingHorizontal: espacio.md,
                    minHeight: 34,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.texto }}>
                    {sugerida}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: espacio.sm }}>
              <TextInput
                value={pregunta}
                onChangeText={setPregunta}
                onSubmitEditing={() => preguntar(pregunta)}
                placeholder="O pregúntale otra cosa…"
                placeholderTextColor={tema.textoSuave}
                returnKeyType="send"
                submitBehavior="submit"
                style={{
                  flex: 1,
                  backgroundColor: tema.superficie,
                  borderColor: tema.borde,
                  borderWidth: 1,
                  borderRadius: radio.md,
                  paddingHorizontal: espacio.md,
                  minHeight: 46,
                  fontFamily: fuente.cuerpo,
                  fontSize: 14.5,
                  color: tema.texto,
                }}
              />
              <Pressable
                onPress={() => preguntar(pregunta)}
                disabled={!pregunta.trim()}
                style={({ pressed }) => ({
                  width: 46,
                  minHeight: 46,
                  borderRadius: radio.md,
                  backgroundColor: tema.primario,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: !pregunta.trim() ? 0.35 : pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="arrow-up" size={20} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
              </Pressable>
            </View>

            <Text style={[textos.suave, { fontSize: 11.5 }]}>
              Contesta con lo que hay en su expediente y en su ficha de especie, sin conexión y
              sin costo. Si no sabe algo, lo dice en vez de inventarlo.
            </Text>
          </View>
        </Seccion>

        {/* Sus fotos */}
        {fotos.length > 0 && (
          <Seccion titulo="Sus fotos">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: espacio.md }}>
                {fotos.map((evento) => (
                  <View key={evento.id} style={{ gap: 4 }}>
                    {fotoExiste(evento.fotoUri) ? (
                      <Image
                        source={{ uri: evento.fotoUri }}
                        style={{ width: 132, height: 132, borderRadius: radio.lg }}
                      />
                    ) : (
                      // Las fotos de antes vivían en la caché y el sistema pudo
                      // borrarlas. Decirlo es mejor que un cuadro vacío.
                      <View
                        style={{
                          width: 132,
                          height: 132,
                          borderRadius: radio.lg,
                          backgroundColor: tema.superficieAlta,
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: espacio.md,
                          gap: 4,
                        }}
                      >
                        <Ionicons name="image-outline" size={22} color={tema.textoSuave} />
                        <Text style={[textos.suave, { fontSize: 11, textAlign: 'center' }]}>
                          El teléfono borró esta foto de su caché
                        </Text>
                      </View>
                    )}
                    {evento.nota && (
                      <Text style={[textos.suave, { fontSize: 11, maxWidth: 132 }]} numberOfLines={1}>
                        {evento.nota}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </ScrollView>
          </Seccion>
        )}

        {/* Qué está mirando el dibujo */}
        <Seccion titulo="De dónde sale lo que ves">
          <Tarjeta>
            <View style={{ gap: espacio.md }}>
              <Renglon etiqueta="Postura" valor={descripcionPostura(morfologia.caida)} />
              <Renglon etiqueta="Color" valor={descripcionColor(morfologia.senal)} />
              <Renglon
                etiqueta="Tamaño"
                valor={
                  planta.medidas?.alturaCm
                    ? `${planta.medidas.alturaCm} cm que mediste`
                    : `estimado por su edad (${edadLegible(planta.fechaAdquisicion)})`
                }
              />
              <Renglon
                etiqueta="Datos usados"
                valor={`${snapshot.hechos.length} del expediente`}
              />
            </View>
          </Tarjeta>
        </Seccion>

        {/* Expediente */}
        <Seccion
          titulo={`Bitácora · ${eventos.length} ${eventos.length === 1 ? 'registro' : 'registros'}`}
        >
          {eventos.length === 0 ? (
            <Text style={textos.suave}>
              Todavía no hay nada registrado. Cada riego y cada tratamiento que anotes hace que
              el diagnóstico de mañana sea mejor.
            </Text>
          ) : (
            <Tarjeta>
              <View style={{ gap: espacio.md }}>
                {eventos.slice(0, 20).map((evento, i) => (
                  <View key={evento.id} style={{ gap: espacio.md }}>
                    {i > 0 && (
                      <View style={{ height: 1, backgroundColor: tema.borde, opacity: 0.6 }} />
                    )}
                    <View style={{ flexDirection: 'row', gap: espacio.md }}>
                      <Ionicons
                        name={iconoDeEvento(evento.tipo)}
                        size={18}
                        color={tema.textoSuave}
                        style={{ marginTop: 1 }}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: tema.texto }}>
                          {etiquetaEvento(evento)}
                        </Text>
                        <Text style={[textos.suave, { fontSize: 12 }]}>
                          {fechaRelativa(evento.fecha)}
                          {evento.nota ? ` · ${evento.nota}` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </Tarjeta>
          )}
        </Seccion>
      </ScrollView>
    </>
  );
}

// ---------------------------------------------------------------------------

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.md }}>
      <Text style={{ fontSize: 13, color: tema.textoSuave, flex: 1 }}>{etiqueta}</Text>
      <Text style={{ fontSize: 13, color: tema.texto, fontWeight: '600' }}>{valor}</Text>
    </View>
  );
}

type NombreIcono = React.ComponentProps<typeof Ionicons>['name'];

function iconoDeEvento(tipo: Evento['tipo']): NombreIcono {
  const mapa: Record<Evento['tipo'], NombreIcono> = {
    riego: 'water-outline',
    cambio_agua: 'sync-outline',
    fertilizacion: 'nutrition-outline',
    trasplante: 'swap-horizontal-outline',
    poda: 'cut-outline',
    tratamiento: 'medkit-outline',
    observacion: 'eye-outline',
    foto: 'camera-outline',
    diagnostico: 'pulse-outline',
    brote: 'leaf-outline',
    floracion: 'flower-outline',
  };
  return mapa[tipo];
}

function etiquetaEvento(evento: Evento): string {
  const base: Record<Evento['tipo'], string> = {
    riego: 'Riego',
    cambio_agua: 'Cambio de agua',
    fertilizacion: 'Fertilización',
    trasplante: 'Trasplante',
    poda: 'Poda',
    tratamiento: 'Tratamiento',
    observacion: 'Observación',
    foto: 'Foto',
    diagnostico: 'Diagnóstico',
    brote: 'Brote nuevo',
    floracion: 'Floración',
  };
  const texto = base[evento.tipo];
  return evento.cantidadMl ? `${texto} · ${evento.cantidadMl} ml` : texto;
}

function fechaRelativa(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.floor(dias / 30.44);
  return `Hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---------------------------------------------------------------------------

function TarjetaHallazgo({ hallazgo }: { hallazgo: Hallazgo }) {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const color =
    hallazgo.severidad === 'urgente'
      ? tema.critico
      : hallazgo.severidad === 'atencion'
        ? tema.seco
        : tema.textoSuave;
  const icono =
    hallazgo.severidad === 'urgente'
      ? 'alert-circle'
      : hallazgo.severidad === 'atencion'
        ? 'information-circle'
        : 'time-outline';

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderLeftWidth: 4,
        borderLeftColor: color,
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: tema.borde,
        padding: espacio.lg,
        gap: espacio.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
        <Ionicons name={icono} size={18} color={color} />
        <Text style={[textos.encabezadoTarjeta, { flex: 1 }]}>{hallazgo.titulo}</Text>
      </View>
      <Text style={textos.cuerpo}>{hallazgo.explicacion}</Text>
    </View>
  );
}

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start' }}>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.textoSuave, width: 104 }}>
        {etiqueta}
      </Text>
      <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto, flex: 1 }}>
        {valor}
      </Text>
    </View>
  );
}

function descripcionPostura(caida: number): string {
  if (caida < 0.15) return 'Erguida y turgente';
  if (caida < 0.4) return 'Empezando a perder firmeza';
  if (caida < 0.7) return 'Vencida';
  return 'Colapsada';
}

function descripcionColor(senal: 'ninguna' | 'sed' | 'ahogo'): string {
  if (senal === 'sed') return 'Amarilleando por falta de agua';
  if (senal === 'ahogo') return 'Apagado hacia el azul: le sobra agua';
  return 'Verde pleno';
}

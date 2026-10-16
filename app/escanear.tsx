/**
 * Escaneo de una planta.
 *
 * Flujo: fotos → portero de calidad → identificación → confirmación → nace el
 * gemelo. Las fotos quedan como primera entrada del expediente, que es el punto:
 * el escaneo no es un truco de entrada, es el día uno de la historia clínica.
 *
 * El reconocimiento corre dentro del teléfono y tarda unos segundos por foto,
 * así que cada foto se empieza a mirar EN CUANTO SE TOMA. Mientras la persona
 * toma la siguiente, la anterior ya se está reconociendo; al tocar la flecha,
 * casi siempre ya está listo.
 */

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { guardarPlanta, nuevoId, registrarEvento } from '../src/datos/db';
import { registrarCuidado } from '../src/servicios/cuidado';
import { buscarEspecie, esGenerica, especiesGenericas, filtrarEspecies, genericaParecida } from '../src/dominio/catalogo';
import { OPCIONES_DANO } from '../src/dominio/contraste';
import { LUGARES, lugarDe, ubicacionEn, veredictoMudanza } from '../src/dominio/lugares';
import type { Lugar, Zona } from '../src/dominio/lugares';
import { curiosidadesDe } from '../src/dominio/curiosidades';
import { calcularMorfologia } from '../src/dominio/morfologia';
import { lineaDeNombres } from '../src/dominio/nombres';
import type { AparienciaObservada, Especie, MedidasObservadas } from '../src/dominio/tipos';
import { medirAparienciaDeFoto } from '../src/servicios/aparienciaEscaneo';
import { guardarFoto } from '../src/servicios/fotos';
import { analizarFoto, avanceDe, escucharAvance, olvidarFoto } from '../src/servicios/visionLocal';
import {
  ORGANOS,
  identificar,
  organosDistintos,
  porteroDeCalidad,
  siguienteOrganoUtil,
} from '../src/servicios/identificacion';
import type {
  Candidato,
  Organo,
  ResultadoIdentificacion,
  Toma,
} from '../src/servicios/identificacion';
import { Gemelo } from '../src/ui/Gemelo';
import { Boton, Seccion, estilosTexto } from '../src/ui/componentes';
import { Grupo, Segmentado } from '../src/ui/iOS';
import { ubicacionInicial } from '../src/servicios/cuenta';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

type Paso = 'camara' | 'identificando' | 'especie' | 'lugar';

type TipoRecipiente = 'maceta' | 'suelo' | 'agua';

const RECIPIENTES: Array<{ valor: TipoRecipiente; etiqueta: string }> = [
  { valor: 'maceta', etiqueta: 'En maceta' },
  { valor: 'suelo', etiqueta: 'En tierra' },
  { valor: 'agua', etiqueta: 'En agua' },
];

/** El nombre del órgano en español, para la bitácora y la interfaz. */
function etiquetaOrgano(organo: Organo): string {
  return ORGANOS.find((o) => o.organo === organo)?.etiqueta ?? 'Foto';
}

function contenedorDe(tipo: TipoRecipiente) {
  if (tipo === 'suelo') return { tipo, tieneDrenaje: true } as const;
  if (tipo === 'agua') return { tipo, tieneDrenaje: true } as const;
  return { tipo, volumenL: 3, material: 'plastico', tieneDrenaje: true } as const;
}


export default function PantallaEscanear() {
  const tema = useTema();
  const textos = estilosTexto(tema);

  const camara = useRef<CameraView>(null);
  const [permiso, pedirPermiso] = useCameraPermissions();

  const [paso, setPaso] = useState<Paso>('camara');
  const [tomas, setTomas] = useState<Toma[]>([]);
  const [organo, setOrgano] = useState<Organo>('habit');
  const [resultado, setResultado] = useState<ResultadoIdentificacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [especieId, setEspecieId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [apodo, setApodo] = useState('');
  const [lugar, setLugar] = useState<Lugar>('patio_medio');
  const [recipiente, setRecipiente] = useState<TipoRecipiente>('maceta');
  const [alturaCm, setAlturaCm] = useState('');
  const [numElementos, setNumElementos] = useState('');
  const [dano, setDano] = useState<MedidasObservadas['danoVisible']>('ninguno');
  const [guardando, setGuardando] = useState(false);
  // El color y la proporción de SU planta, medidos en la foto: es lo que hace
  // que el gemelo sea el suyo y no uno de catálogo.
  const [apariencia, setApariencia] = useState<AparienciaObservada | undefined>(undefined);

  const especie = especieId ? buscarEspecie(especieId) : undefined;

  // El teclado no puede tapar lo que se escribe: al enfocar un campo, la
  // pantalla lo sube hasta arriba, y el botón de seguir viaja pegado al teclado.
  const desplazador = useRef<ScrollView>(null);
  const altoEncabezado = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [tecladoArriba, setTecladoArriba] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setTecladoArriba(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setTecladoArriba(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  const subirA = (y: number) => {
    // Después de que el teclado empieza a subir, no antes: si no, el desplazamiento
    // se calcula con la pantalla todavía entera y queda corto.
    setTimeout(() => desplazador.current?.scrollTo({ y: Math.max(0, y - espacio.md), animated: true }), 120);
  };

  // Redibujar cuando avanza la lectura de alguna foto: es lo que mueve las
  // barritas de las miniaturas y la de "mirándola".
  const [, refrescar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => escucharAvance(refrescar), []);
  const avance = tomas.length === 0 ? 0 : tomas.reduce((s, t) => s + avanceDe(t.uri), 0) / tomas.length;

  /**
   * Agregar una toma no dispara la identificación.
   *
   * Ése es el cambio de fondo del escaneo por varias fotos: antes, la primera
   * foto era la respuesta. Ahora se juntan varias —hoja, flor, fruto— y se
   * mandan todas juntas, porque el modelo separa especies parecidas por el
   * órgano que las distingue, no por tener más píxeles de la misma hoja.
   */
  function agregarToma(nueva: Toma): Toma[] | null {
    const portero = porteroDeCalidad({ tomas: [nueva] });
    if (!portero.sirve) {
      setError(portero.motivo);
      return null;
    }
    setError(null);
    const juntas = [...tomas, nueva];
    setTomas(juntas);
    // Empieza a mirarla ya, sin esperar a que termine de tomar las demás.
    void analizarFoto(nueva.uri);
    // Sugerir el siguiente órgano que todavía no se ha fotografiado.
    setOrgano(siguienteOrganoUtil(juntas) ?? 'auto');
    return juntas;
  }

  /** Con las tomas de ahora, o con una lista recién armada (el estado aún no se actualiza). */
  async function identificarTodo(lista: Toma[] = tomas) {
    if (lista.length === 0) return;
    setPaso('identificando');

    // La foto de cuerpo entero es la que mejor dice cómo es; si no hay, la primera.
    const deCuerpo = lista.find((t) => t.organo === 'habit') ?? lista[0];
    void medirAparienciaDeFoto(deCuerpo.uri).then(setApariencia);

    const identificacion = await identificar({ tomas: lista }, { leerLocal: analizarFoto });
    setResultado(identificacion);

    const mejor = identificacion.candidatos.find((c) => c.enCatalogo);
    if (identificacion.confianza === 'confirmado' && mejor?.especieId) {
      setEspecieId(mejor.especieId);
    }
    setPaso('especie');
  }

  async function capturar() {
    setError(null);
    const captura = await camara.current?.takePictureAsync({ quality: 0.7 });
    if (!captura) {
      setError('No se pudo tomar la foto.');
      return;
    }
    agregarToma({ uri: captura.uri, organo, ancho: captura.width, alto: captura.height });
  }

  /**
   * Salida por galería.
   *
   * No es sólo para quien niega el permiso: mucha gente fotografía la planta en
   * el momento y la registra después, ya en su casa y con calma.
   *
   * Sin cámara no hay pantalla donde juntar varias fotos, así que la foto
   * elegida se manda a reconocer de una vez. Antes se agregaba y la pantalla
   * se quedaba en "necesito la cámara", sin forma de seguir.
   */
  async function elegirDeGaleria(identificarAlTiro = false) {
    setError(null);
    const elegida = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (elegida.canceled || !elegida.assets[0]) return;

    const activo = elegida.assets[0];
    const juntas = agregarToma({ uri: activo.uri, organo, ancho: activo.width, alto: activo.height });
    if (juntas && identificarAlTiro) void identificarTodo(juntas);
  }

  async function crear() {
    if (!especieId || guardando) return;
    setGuardando(true);

    const id = nuevoId();
    // A la carpeta de documentos: la caché donde las deja la cámara la vacía
    // el sistema cuando quiere, y con ella se iba la foto del expediente.
    const fotos = await Promise.all(tomas.map((t) => guardarFoto(t.uri, { ancho: t.ancho, alto: t.alto })));
    await guardarPlanta({
      id,
      apodo: apodo.trim() || especie?.nombresComunes[0] || 'Mi planta',
      especieId,
      fechaAdquisicion: new Date().toISOString().slice(0, 10),
      ubicacion: ubicacionEn(lugar, await ubicacionInicial()),
      contenedor: contenedorDe(recipiente),
      fotoPortadaUri: fotos[0],
      apariencia,
      // Lo que la persona midió. Sin esto el gemelo se dibuja por edad, que es
      // una planta promedio y no la suya.
      medidas: {
        fecha: new Date().toISOString(),
        alturaCm: alturaCm ? Number(alturaCm) : undefined,
        elementos: numElementos ? Number(numElementos) : undefined,
        danoVisible: dano,
      },
      creadaEn: new Date().toISOString(),
    });

    // Las fotos del escaneo abren el expediente.
    for (const [i, toma] of tomas.entries()) {
      // Sólo la primera pasa por la racha: si pasaran todas, cada foto
      // siguiente taparía la celebración con un "anotado".
      await (i === 0 ? registrarCuidado : registrarEvento)({
        id: nuevoId(),
        plantaId: id,
        tipo: 'foto',
        fecha: new Date().toISOString(),
        fotoUri: fotos[i] ?? toma.uri,
        nota: `Escaneo inicial · ${etiquetaOrgano(toma.organo)}`,
      });
    }

    router.replace({ pathname: '/planta/[id]', params: { id, naciendo: '1' } });
  }

  // -------------------------------------------------------------------------

  if (!permiso) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, justifyContent: 'center' }}>
        <ActivityIndicator color={tema.primario} />
      </View>
    );
  }

  if (!permiso.granted && paso === 'camara') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tema.fondo,
          justifyContent: 'center',
          padding: espacio.xl,
          gap: espacio.lg,
        }}
      >
        <Stack.Screen options={{ title: 'Escanear' }} />
        <Text style={textos.titulo}>Necesito la cámara</Text>
        <Text style={textos.subtitulo}>
          Para reconocer tu planta y abrirle su expediente. La foto se queda en tu teléfono.
        </Text>
        <Boton titulo="Dar permiso" onPress={pedirPermiso} />
        <Boton titulo="Mejor elijo una foto" variante="secundario" onPress={() => void elegirDeGaleria(true)} />
        {error && <Text style={[textos.suave, { color: tema.acento }]}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <Stack.Screen options={{ title: tituloDePaso(paso) }} />

      {paso === 'camara' && (
        <VistaCamara
          refCamara={camara}
          onCapturar={capturar}
          onGaleria={() => void elegirDeGaleria()}
          onIdentificar={() => void identificarTodo()}
          onQuitar={(i) => {
            if (tomas[i]) olvidarFoto(tomas[i].uri);
            const quedan = tomas.filter((_, j) => j !== i);
            setTomas(quedan);
            setOrgano(siguienteOrganoUtil(quedan) ?? 'auto');
          }}
          tomas={tomas}
          organo={organo}
          onOrgano={setOrgano}
          error={error}
        />
      )}

      {paso === 'identificando' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: espacio.lg }}>
          {tomas[0] && <FotoEscaneandose uri={tomas[0].uri} />}
          <Text style={textos.subtitulo}>
            {tomas.length === 1 ? 'Mirándola…' : `Cruzando tus ${tomas.length} fotos…`}
          </Text>
          {/* Una barra y no sólo un circulito: son unos segundos, y ver que
              avanza es lo que hace que se esperen sin pensar que se trabó. */}
          <View
            style={{
              width: 200,
              height: 6,
              borderRadius: 3,
              backgroundColor: tema.superficieAlta,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(Math.max(0.04, avance) * 100)}%`,
                height: '100%',
                backgroundColor: tema.primario,
              }}
            />
          </View>
          <Text style={[textos.suave, { textAlign: 'center', paddingHorizontal: espacio.xl }]}>
            Se reconoce aquí en tu teléfono, sin internet.
          </Text>
        </View>
      )}

      {(paso === 'especie' || paso === 'lugar') && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={altoEncabezado}
        >
          <ScrollView
            ref={desplazador}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ padding: espacio.lg, gap: espacio.xl, paddingBottom: espacio.xl }}
          >
            {tomas.length > 0 && (
              <View style={{ flexDirection: 'row', gap: espacio.lg, alignItems: 'center' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: espacio.sm }}>
                    {tomas.map((toma, i) => (
                      <Image
                        key={i}
                        source={{ uri: toma.uri }}
                        style={{ width: 84, height: 84, borderRadius: radio.md }}
                      />
                    ))}
                  </View>
                </ScrollView>
                {especie && paso === 'lugar' && <VistaPrevia especie={especie} apariencia={apariencia} />}
              </View>
            )}

            {paso === 'especie' && (
              <PasoEspecie
                resultado={resultado}
                especieId={especieId}
                apariencia={apariencia}
                onElegir={(id) => {
                  setEspecieId(id);
                  void Haptics.selectionAsync().catch(() => undefined);
                }}
                busqueda={busqueda}
                onBuscar={setBusqueda}
                onEnfocarBusqueda={subirA}
              />
            )}

            {paso === 'lugar' && (
              <PasoLugar
                especie={especie}
                apodo={apodo}
                onApodo={setApodo}
                lugar={lugar}
                onLugar={setLugar}
                recipiente={recipiente}
                onRecipiente={setRecipiente}
                alturaCm={alturaCm}
                onAlturaCm={setAlturaCm}
                numElementos={numElementos}
                onNumElementos={setNumElementos}
                dano={dano}
                onDano={setDano}
                onEnfocar={subirA}
              />
            )}
          </ScrollView>

          {/* El botón de seguir, siempre a la vista: sobre el teclado si está
              abierto, y sobre la barra de inicio del iPhone si no. */}
          <View
            style={{
              paddingHorizontal: espacio.lg,
              paddingTop: espacio.md,
              paddingBottom: tecladoArriba ? espacio.md : Math.max(insets.bottom, espacio.md),
              backgroundColor: tema.fondo,
              borderTopWidth: 1,
              borderTopColor: tema.borde,
              gap: 6,
            }}
          >
            {paso === 'especie' ? (
              <>
                {especie && (
                  <Text numberOfLines={1} style={[textos.suave, { textAlign: 'center' }]}>
                    Elegida: <Text style={{ fontFamily: fuente.cuerpoFuerte, color: tema.texto }}>{especie.nombresComunes[0]}</Text>
                  </Text>
                )}
                <Boton
                  titulo={especie ? 'Continuar' : 'Elige una para seguir'}
                  deshabilitado={!especieId}
                  onPress={() => {
                    if (!especie) return;
                    Keyboard.dismiss();
                    setApodo((a) => a || (esGenerica(especie.id) ? '' : capitalizar(especie.nombresComunes[0])));
                    setLugar(lugarDe({ exposicion: especie.bandasToleradas[0] }));
                    setPaso('lugar');
                    desplazador.current?.scrollTo({ y: 0, animated: false });
                  }}
                />
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: espacio.sm }}>
                <Boton
                  titulo="Atrás"
                  variante="secundario"
                  style={{ flex: 1 }}
                  onPress={() => {
                    Keyboard.dismiss();
                    setPaso('especie');
                  }}
                />
                <Boton
                  titulo={guardando ? 'Naciendo…' : 'Crear su gemelo'}
                  onPress={() => {
                    Keyboard.dismiss();
                    void crear();
                  }}
                  deshabilitado={guardando}
                  style={{ flex: 2 }}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * La cámara del escaneo, guiada por órgano.
 *
 * POR QUÉ VARIAS FOTOS Y NO UNA. Pl@ntNet —y cualquier clasificador de plantas
 * serio— acierta mucho más cuando se le dice QUÉ está viendo y se le dan varias
 * partes. Dos especies con la hoja casi idéntica se separan por la flor; dos con
 * la misma flor se separan por la corteza. Cinco fotos de la misma hoja no
 * suman nada; hoja, flor y fruto cambian el resultado.
 *
 * Por eso la pantalla pide partes concretas en vez de "toma otra foto", y por
 * eso el contador dice cuántas PARTES distintas llevas y no cuántas fotos.
 */
function VistaCamara({
  refCamara,
  onCapturar,
  onGaleria,
  onIdentificar,
  onQuitar,
  tomas,
  organo,
  onOrgano,
  error,
}: {
  refCamara: React.RefObject<CameraView | null>;
  onCapturar: () => void;
  onGaleria: () => void;
  onIdentificar: () => void;
  onQuitar: (indice: number) => void;
  tomas: Toma[];
  organo: Organo;
  onOrgano: (organo: Organo) => void;
  error: string | null;
}) {
  const tema = useTema();
  const actual = ORGANOS.find((o) => o.organo === organo) ?? ORGANOS[0];
  const partes = organosDistintos(tomas);

  return (
    <View style={{ flex: 1 }}>
      <CameraView ref={refCamara} style={{ flex: 1 }} facing="back" />
      <Encuadre />

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: espacio.md }}>
        {/* Qué parte tocar ahora. Las ya hechas se marcan; se puede volver a
            cualquiera tocándola. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ORGANOS.map((opcion) => {
              const hecha = tomas.some((t) => t.organo === opcion.organo);
              const activa = opcion.organo === organo;
              return (
                <Pressable
                  key={opcion.organo}
                  onPress={() => onOrgano(opcion.organo)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: activa ? '#FFFFFF' : 'rgba(0,0,0,0.55)',
                    borderRadius: radio.completo,
                    paddingHorizontal: espacio.md,
                    minHeight: 34,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  {hecha && (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={activa ? tema.primario : '#7BE0AC'}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: activa ? '800' : '600',
                      color: activa ? '#12100D' : '#fff',
                    }}
                  >
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View
          style={{
            marginTop: espacio.sm,
            backgroundColor: 'rgba(0,0,0,0.58)',
            borderRadius: radio.md,
            padding: espacio.md,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>
            {actual.etiqueta}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 18 }}>
            {actual.pista}. Que quepa en el cuadro, con buena luz.
          </Text>
          {partes >= 2 && (
            <Text style={{ color: '#7BE0AC', fontSize: 12, marginTop: 4, fontWeight: '700' }}>
              {partes} partes distintas · entre más partes, mejor le atino
            </Text>
          )}
        </View>

        {error && (
          <View
            style={{
              marginTop: espacio.sm,
              backgroundColor: tema.acento,
              borderRadius: radio.md,
              padding: espacio.md,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13 }}>{error}</Text>
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 34 }}>
        {/* Lo que llevas. Se puede tirar una toma tocándola: pedirle a alguien
            que reinicie el escaneo por una foto movida es de las cosas que
            hacen abandonar una app. */}
        {tomas.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: espacio.lg, gap: espacio.sm }}
          >
            {tomas.map((toma, i) => (
              <Pressable
                key={`${toma.uri}-${i}`}
                onPress={() => onQuitar(i)}
                accessibilityLabel={`Quitar la foto de ${etiquetaOrgano(toma.organo)}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignItems: 'center' })}
              >
                <Image
                  source={{ uri: toma.uri }}
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: radio.sm,
                    borderWidth: 2,
                    borderColor: '#fff',
                  }}
                />
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </View>
                <Text style={{ color: '#fff', fontSize: 10, marginTop: 3 }}>
                  {etiquetaOrgano(toma.organo)}
                </Text>
                {/* Cuánto lleva reconocida. Se llena sola mientras tomas la siguiente. */}
                <View
                  style={{
                    width: 58,
                    height: 3,
                    borderRadius: 2,
                    marginTop: 2,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(avanceDe(toma.uri) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#7BE0AC',
                    }}
                  />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View
          style={{
            marginTop: espacio.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espacio.xl,
          }}
        >
          <Pressable
            onPress={onGaleria}
            accessibilityLabel="Elegir una foto de la galería"
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: radio.md,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="images-outline" size={24} color="#fff" />
          </Pressable>

          <Pressable
            onPress={onCapturar}
            accessibilityLabel={`Tomar la foto de ${actual.etiqueta}`}
            style={({ pressed }) => ({
              width: 74,
              height: 74,
              borderRadius: radio.completo,
              backgroundColor: '#fff',
              borderWidth: 5,
              borderColor: 'rgba(255,255,255,0.45)',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          />

          {/* El botón de terminar sólo existe cuando ya hay algo que mandar. Un
              botón deshabilitado ahí sería una pregunta sin respuesta. */}
          {tomas.length > 0 ? (
            <Pressable
              onPress={onIdentificar}
              accessibilityLabel="Identificar con estas fotos"
              style={({ pressed }) => ({
                minWidth: 52,
                height: 52,
                paddingHorizontal: espacio.md,
                borderRadius: radio.md,
                backgroundColor: tema.primario,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="arrow-forward" size={24} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
            </Pressable>
          ) : (
            <View style={{ width: 52 }} />
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * Cómo va a quedar su gemelo: con la forma de la especie elegida y el color
 * medido en su foto. Si la persona cambia de especie, cambia aquí mismo.
 */
function VistaPrevia({ especie, apariencia }: { especie: Especie; apariencia?: AparienciaObservada }) {
  // Se dibuja en su mejor estado: es cómo se vería si la cuidas bien.
  const morfologia = useMemo(
    () =>
      calcularMorfologia({
        especie,
        estado: {
          fecha: '',
          aguaDisponibleMm: especie.aguaUtilMm,
          fraccionDisponible: 0.7,
          demandaMm: 0,
          aporteMm: 0,
          diasConsecutivosEncharcado: 0,
          diasConsecutivosEnEstres: 0,
          nivel: 'optimo',
          esPronostico: false,
        },
        edadMeses: 12,
      }),
    [especie],
  );
  return (
    <Gemelo
      especieId={especie.id}
      morfologia={morfologia}
      apariencia={apariencia}
      ancho={110}
      alto={124}
      detalle="bajo"
      sombra={false}
    />
  );
}

/** Qué hace falta para dibujar una especie de muestra, en su mejor día. */
const MORFOLOGIAS = new Map<string, ReturnType<typeof calcularMorfologia>>();
function morfologiaDeMuestra(especie: Especie) {
  const ya = MORFOLOGIAS.get(especie.id);
  if (ya) return ya;
  const m = calcularMorfologia({
    especie,
    estado: {
      fecha: '',
      aguaDisponibleMm: especie.aguaUtilMm,
      fraccionDisponible: 0.7,
      demandaMm: 0,
      aporteMm: 0,
      diasConsecutivosEncharcado: 0,
      diasConsecutivosEnEstres: 0,
      nivel: 'optimo',
      esPronostico: false,
    },
    edadMeses: 12,
  });
  MORFOLOGIAS.set(especie.id, m);
  return m;
}

/** El gemelo de una especie, chiquito: para reconocerla de un vistazo en una lista. */
function Muestra({
  especie,
  apariencia,
  ancho,
  alto,
}: {
  especie: Especie;
  apariencia?: AparienciaObservada;
  ancho: number;
  alto: number;
}) {
  return (
    <Gemelo
      especieId={especie.id}
      morfologia={morfologiaDeMuestra(especie)}
      apariencia={apariencia}
      ancho={ancho}
      alto={alto}
      detalle="bajo"
      sombra={false}
    />
  );
}

// ---------------------------------------------------------------------------

function PasoEspecie({
  resultado,
  especieId,
  apariencia,
  onElegir,
  busqueda,
  onBuscar,
  onEnfocarBusqueda,
}: {
  resultado: ResultadoIdentificacion | null;
  especieId: string | null;
  apariencia?: AparienciaObservada;
  onElegir: (id: string) => void;
  busqueda: string;
  onBuscar: (v: string) => void;
  /** El buscador recibió el foco: hay que subirlo para que el teclado no lo tape. */
  onEnfocarBusqueda: (y: number) => void;
}) {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const yBusqueda = useRef(0);
  const campo = useRef<TextInput>(null);

  const candidatos = (resultado?.candidatos ?? []).filter((c) => c.enCatalogo && c.especieId);
  const seguro = resultado?.confianza === 'confirmado' && candidatos[0];
  const principal = seguro ? buscarEspecie(candidatos[0].especieId!) : undefined;

  // Con texto, lo que coincide (sin las genéricas, que van en su propia fila);
  // sin texto, nada: la lista entera de 50 plantas no ayuda a nadie a buscar.
  const encontradas = useMemo(
    () => (busqueda.trim() ? filtrarEspecies(busqueda).filter((e) => !esGenerica(e.id)).slice(0, 12) : []),
    [busqueda],
  );
  const genericas = useMemo(() => especiesGenericas(), []);
  const sugerida = useMemo(() => {
    const parecida = candidatos[0]?.especieId ? buscarEspecie(candidatos[0].especieId) : undefined;
    return parecida ? genericaParecida(parecida) : undefined;
  }, [candidatos]);

  return (
    <View style={{ gap: espacio.xl }}>
      {principal ? (
        <Animated.View entering={FadeInDown.duration(260)}>
          <Pressable
            onPress={() => onElegir(principal.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: especieId === principal.id }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.md,
              backgroundColor: especieId === principal.id ? tema.primarioSuave : tema.superficie,
              borderColor: especieId === principal.id ? tema.primario : tema.borde,
              borderWidth: 1.5,
              borderRadius: radio.lg,
              padding: espacio.md,
            }}
          >
            <Muestra especie={principal} apariencia={apariencia} ancho={96} alto={108} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={textos.rotulo}>Creo que es</Text>
              <Text style={{ fontFamily: fuente.titulo, fontSize: 24, color: tema.texto }}>
                {capitalizar(principal.nombresComunes[0])}
              </Text>
              <Text style={{ fontFamily: fuente.tituloItalica, fontSize: 13, color: tema.textoSuave }}>
                {principal.nombreCientifico}
              </Text>
              {lineaDeNombres(principal) !== '' && (
                <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave, lineHeight: 17 }}>
                  {lineaDeNombres(principal)}
                </Text>
              )}
              <BarraSeguridad valor={candidatos[0].probabilidad} />
            </View>
            {especieId === principal.id && <Ionicons name="checkmark-circle" size={24} color={tema.primario} />}
          </Pressable>
          {curiosidadesDe(principal.id).length > 0 && (
            <Pressable
              onPress={() => router.push(`/especie/${principal.id}`)}
              accessibilityRole="button"
              accessibilityHint="Abre su ficha con más datos"
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: espacio.sm,
                marginTop: espacio.sm,
                padding: espacio.md,
                borderRadius: radio.md,
                backgroundColor: tema.superficieAlta,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="sparkles" size={16} color={tema.primario} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13.5, color: tema.texto, lineHeight: 19 }}>
                  <Text style={{ fontFamily: fuente.cuerpoNegro }}>¿Sabías que…? </Text>
                  {curiosidadesDe(principal.id)[0]}
                </Text>
                <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: tema.primario }}>Ver su ficha completa ›</Text>
              </View>
            </Pressable>
          )}
        </Animated.View>
      ) : null}

      {candidatos.length > (principal ? 1 : 0) && (
        <View style={{ gap: espacio.md }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fuente.titulo, fontSize: principal ? 17 : 22, color: tema.texto }}>
              {principal
                ? '¿No es? Estas también se parecen'
                : resultado?.fueraDeCatalogo
                  ? 'No la reconozco del todo'
                  : '¿Es alguna de éstas?'}
            </Text>
            {!principal && resultado?.advertencia && <Text style={textos.suave}>{resultado.advertencia}</Text>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: espacio.sm }}>
            {candidatos.slice(principal ? 1 : 0).map((c, i) => {
              const e = buscarEspecie(c.especieId!);
              if (!e) return null;
              const activa = e.id === especieId;
              return (
                <Animated.View key={e.id} entering={FadeInDown.delay(60 * i).duration(240)}>
                  <Pressable
                    onPress={() => onElegir(e.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activa }}
                    accessibilityLabel={`${e.nombresComunes[0]}, ${Math.round(c.probabilidad * 100)} por ciento`}
                    style={({ pressed }) => ({
                      width: 128,
                      alignItems: 'center',
                      gap: 2,
                      backgroundColor: activa ? tema.primarioSuave : tema.superficie,
                      borderColor: activa ? tema.primario : tema.borde,
                      borderWidth: 1.5,
                      borderRadius: radio.lg,
                      padding: espacio.sm,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <Muestra especie={e} apariencia={apariencia} ancho={96} alto={100} />
                    <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.texto }}>
                      {capitalizar(e.nombresComunes[0])}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fuente.tituloItalica, fontSize: 11, color: tema.textoSuave }}>
                      {e.nombresIngles?.[0] ?? e.nombreCientifico}
                    </Text>
                    <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: tema.primario, marginTop: 2 }}>
                      {Math.max(1, Math.round(c.probabilidad * 100))} %
                    </Text>
                    {activa && (
                      <View style={{ position: 'absolute', top: 6, right: 6 }}>
                        <Ionicons name="checkmark-circle" size={20} color={tema.primario} />
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>
      )}

      <View
        style={{ gap: espacio.md }}
        onLayout={(e) => {
          yBusqueda.current = e.nativeEvent.layout.y;
        }}
      >
        <Text style={textos.rotulo}>{candidatos.length > 0 ? 'O búscala por su nombre' : 'Búscala por su nombre'}</Text>
        <Pressable
          onPress={() => campo.current?.focus()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.sm,
            backgroundColor: tema.superficieAlta,
            borderRadius: radio.md,
            paddingHorizontal: espacio.md,
            minHeight: 44,
          }}
        >
          <Ionicons name="search" size={17} color={tema.textoSuave} />
          <TextInput
            ref={campo}
            value={busqueda}
            onChangeText={onBuscar}
            onFocus={() => onEnfocarBusqueda(yBusqueda.current)}
            placeholder="Pitahaya, dragon fruit, sábila…"
            placeholderTextColor={tema.textoSuave}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 16, color: tema.texto, paddingVertical: 10 }}
          />
          {busqueda.length > 0 && Platform.OS !== 'ios' && (
            <Pressable onPress={() => onBuscar('')} hitSlop={10} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
            </Pressable>
          )}
        </Pressable>

        {busqueda.trim().length > 0 && encontradas.length === 0 && (
          <Text style={textos.suave}>No tengo ninguna que se llame así. Elige abajo cómo la cuido.</Text>
        )}
        {encontradas.length > 0 && (
          <Grupo>
            {encontradas.map((e) => {
              const activa = e.id === especieId;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => {
                    onElegir(e.id);
                    Keyboard.dismiss();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activa }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: espacio.md,
                    paddingHorizontal: espacio.md,
                    paddingVertical: 6,
                    backgroundColor: activa ? tema.primarioSuave : pressed ? tema.superficieAlta : 'transparent',
                  })}
                >
                  <Muestra especie={e} ancho={44} alto={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.texto }}>
                      {capitalizar(e.nombresComunes[0])}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
                      {[e.nombreCientifico, ...e.nombresComunes.slice(1, 3)].join(' · ')}
                    </Text>
                  </View>
                  {activa && <Ionicons name="checkmark" size={20} color={tema.primario} />}
                </Pressable>
              );
            })}
          </Grupo>
        )}
      </View>

      {/* Nunca un callejón sin salida: si no está, se cuida por su tipo. */}
      <View style={{ gap: espacio.md }}>
        <View style={{ gap: 2 }}>
          <Text style={textos.rotulo}>¿No está? Cuídala por su tipo</Text>
          <Text style={textos.suave}>
            Le pongo el riego y la luz de las de su tipo. Si después la reconozco, le cambias la especie.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
          {genericas.map((g) => {
            const activa = g.id === especieId;
            const recomendada = sugerida?.id === g.id && !principal;
            return (
              <Pressable
                key={g.id}
                onPress={() => onElegir(g.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: activa ? tema.primario : tema.superficie,
                  borderColor: activa ? tema.primario : recomendada ? tema.primario : tema.borde,
                  borderWidth: 1,
                  borderRadius: radio.completo,
                  paddingLeft: 4,
                  paddingRight: espacio.md,
                  minHeight: 40,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Muestra especie={g} ancho={32} alto={34} />
                <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: activa ? (tema.esOscuro ? '#0B1A13' : '#fff') : tema.texto }}>
                  {capitalizar(g.nombresComunes[0])}
                </Text>
                {recomendada && !activa && (
                  <Text style={{ fontFamily: fuente.cuerpo, fontSize: 11, color: tema.primario }}>· parece</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Qué tan seguro está, en una barra y con palabras: un "82 %" solo no dice si es mucho. */
function BarraSeguridad({ valor }: { valor: number }) {
  const tema = useTema();
  const pct = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  return (
    <View style={{ gap: 3, marginTop: 4 }}>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: tema.superficieAlta, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: tema.primario }} />
      </View>
      <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: tema.textoSuave }}>
        {pct} % seguro{pct >= 90 ? ' · casi no me equivoco con ésta' : ''}
      </Text>
    </View>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---------------------------------------------------------------------------

function PasoLugar({
  especie,
  apodo,
  onApodo,
  lugar,
  onLugar,
  recipiente,
  onRecipiente,
  alturaCm,
  onAlturaCm,
  numElementos,
  onNumElementos,
  dano,
  onDano,
  onEnfocar,
}: {
  especie?: Especie;
  apodo: string;
  onApodo: (v: string) => void;
  lugar: Lugar;
  onLugar: (v: Lugar) => void;
  recipiente: TipoRecipiente;
  onRecipiente: (v: TipoRecipiente) => void;
  alturaCm: string;
  onAlturaCm: (v: string) => void;
  numElementos: string;
  onNumElementos: (v: string) => void;
  dano: MedidasObservadas['danoVisible'];
  onDano: (v: MedidasObservadas['danoVisible']) => void;
  /** Un campo recibió el foco: subirlo sobre el teclado. */
  onEnfocar: (y: number) => void;
}) {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const yMedidas = useRef(0);
  const veredicto = especie ? veredictoMudanza(especie, lugar) : null;

  return (
    <View style={{ gap: espacio.xl }}>
      <Seccion titulo="Cómo le vas a decir">
        <TextInput
          value={apodo}
          onChangeText={onApodo}
          onFocus={() => onEnfocar(0)}
          placeholder="Su nombre"
          placeholderTextColor={tema.textoSuave}
          returnKeyType="done"
          style={{
            backgroundColor: tema.superficie,
            borderColor: tema.borde,
            borderWidth: 1,
            borderRadius: radio.md,
            padding: espacio.md,
            fontFamily: fuente.cuerpo,
            fontSize: 16,
            color: tema.texto,
          }}
        />
      </Seccion>

      <Seccion titulo="Dónde la tienes">
        <Grupo>
          {LUGARES.map((l) => {
            const activo = l.lugar === lugar;
            const v = especie ? veredictoMudanza(especie, l.lugar) : null;
            return (
              <Pressable
                key={l.lugar}
                onPress={() => onLugar(l.lugar)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activo }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: espacio.md,
                  paddingHorizontal: espacio.md,
                  paddingVertical: 10,
                  backgroundColor: activo ? tema.primarioSuave : pressed ? tema.superficieAlta : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: COLOR_ZONA_ESCANEO[l.zona],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={ICONO_ZONA_ESCANEO[l.zona]} size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14.5, color: tema.texto }}>{l.titulo}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
                    {l.detalle}
                  </Text>
                </View>
                {v?.nivel === 'ideal' && (
                  <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11, color: tema.optimo }}>Su ideal</Text>
                )}
                {activo && <Ionicons name="checkmark" size={20} color={tema.primario} />}
              </Pressable>
            );
          })}
        </Grupo>
        {veredicto && veredicto.nivel !== 'ideal' && (
          <Text style={[textos.suave, veredicto.nivel === 'mal' ? { color: tema.critico } : null]}>{veredicto.texto}</Text>
        )}
        <Text style={textos.suave}>De esto sale su calendario de riego. La puedes mover después desde Hoy.</Text>
      </Seccion>

      <Seccion titulo="En qué está">
        <Segmentado
          opciones={RECIPIENTES.map((r) => ({ valor: r.valor, etiqueta: r.etiqueta }))}
          valor={recipiente}
          onCambio={onRecipiente}
        />
        <Text style={textos.suave}>
          Un esqueje en frasco no se riega: se le cambia el agua. La app lo cuida distinto.
        </Text>
      </Seccion>

      <View
        onLayout={(e) => {
          yMedidas.current = e.nativeEvent.layout.y;
        }}
      >
        <Seccion titulo="Mídela (si quieres)">
          <Text style={textos.suave}>
            Con esto el gemelo se dibuja con las proporciones de TU planta. A ojo de buen cubero basta.
          </Text>
          <View style={{ flexDirection: 'row', gap: espacio.md }}>
            <View style={{ flex: 1, gap: espacio.sm }}>
              <Text style={textos.suave}>Alto en cm</Text>
              <CampoNumero valor={alturaCm} onChange={onAlturaCm} placeholder="30" onFocus={() => onEnfocar(yMedidas.current)} />
            </View>
            <View style={{ flex: 1, gap: espacio.sm }}>
              <Text style={textos.suave}>Cuántas hojas</Text>
              <CampoNumero valor={numElementos} onChange={onNumElementos} placeholder="6" onFocus={() => onEnfocar(yMedidas.current)} />
            </View>
          </View>
        </Seccion>
      </View>

      <Seccion titulo="Cómo se ve">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
          {OPCIONES_DANO.map((opcion) => {
            const activa = opcion.valor === dano;
            return (
              <Pressable
                key={opcion.valor}
                onPress={() => onDano(opcion.valor)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                style={{
                  backgroundColor: activa ? tema.primario : tema.superficie,
                  borderColor: activa ? tema.primario : tema.borde,
                  borderWidth: 1,
                  borderRadius: radio.completo,
                  paddingHorizontal: espacio.md,
                  paddingVertical: espacio.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: fuente.cuerpoFuerte,
                    color: activa ? (tema.esOscuro ? '#10100C' : '#fff') : tema.texto,
                  }}
                >
                  {opcion.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={textos.suave}>
          Esto se cruza con el balance de agua: un mismo síntoma significa cosas distintas según cómo esté el sustrato.
        </Text>
      </Seccion>
    </View>
  );
}

const ICONO_ZONA_ESCANEO: Record<Zona, keyof typeof Ionicons.glyphMap> = { patio: 'sunny', casa: 'home', sombra: 'leaf' };
const COLOR_ZONA_ESCANEO: Record<Zona, string> = { patio: '#F2A516', casa: '#C66A3D', sombra: '#2E8B57' };

// ---------------------------------------------------------------------------

function CampoNumero({
  valor,
  onChange,
  placeholder,
  onFocus,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  onFocus?: () => void;
}) {
  const tema = useTema();
  return (
    <TextInput
      value={valor}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={tema.textoSuave}
      keyboardType="number-pad"
      returnKeyType="done"
      onFocus={onFocus}
      style={{
        backgroundColor: tema.superficie,
        borderColor: tema.borde,
        borderWidth: 1,
        borderRadius: radio.md,
        padding: espacio.md,
        fontFamily: fuente.cuerpo,
        fontSize: 16,
        color: tema.texto,
      }}
    />
  );
}

/**
 * La foto mientras se reconoce: una línea de luz la recorre de arriba abajo,
 * como un escáner. Dice "estoy trabajando" sin un circulito girando.
 */
function FotoEscaneandose({ uri }: { uri: string }) {
  const tema = useTema();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [t]);
  const LADO = 220;
  const linea = useAnimatedStyle(() => ({ transform: [{ translateY: t.get() * (LADO - 4) }] }));
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ width: LADO, height: LADO, borderRadius: radio.lg, overflow: 'hidden' }}>
      <Image source={{ uri }} style={{ width: LADO, height: LADO }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.12)' }} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 4,
            backgroundColor: tema.primario,
            shadowColor: tema.primario,
            shadowOpacity: 0.9,
            shadowRadius: 10,
          },
          linea,
        ]}
      />
    </Animated.View>
  );
}

/** Las esquinas del cuadro: lo que queda adentro es lo que la red mira con más atención. */
function Encuadre() {
  const { width } = useWindowDimensions();
  const lado = Math.min(width - 64, 340);
  const esquina = { position: 'absolute' as const, width: 34, height: 34, borderColor: '#FFFFFF' };
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      <View style={{ width: lado, height: lado }}>
        <View style={[esquina, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }]} />
        <View style={[esquina, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }]} />
        <View style={[esquina, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }]} />
        <View style={[esquina, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }]} />
      </View>
    </View>
  );
}

function tituloDePaso(paso: Paso): string {
  return {
    camara: 'Escanear',
    identificando: 'Mirándola',
    especie: '¿Qué es?',
    lugar: 'Dónde vive',
  }[paso];
}

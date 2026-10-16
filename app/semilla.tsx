/**
 * Identificar una semilla, con foto.
 *
 * LA FOTO NO ADIVINA: MIDE. Es la distinción que sostiene toda la pantalla.
 * Reconocer "esto es semilla de limonero" mirando una foto no se puede — son
 * milímetros de color liso y las de familias enteras se ven iguales. Pero
 * medirla sí: la foto da el color, la proporción y, con una moneda al lado, el
 * largo en milímetros. Y resulta que color, forma y tamaño es exactamente lo
 * que la clave botánica necesita para ir descartando.
 *
 * Así que la cámara hace el trabajo tedioso —calcular milímetros a ojo— y la
 * clave hace el de identificar. Lo medido se muestra siempre y se puede
 * corregir: una foto con sombra puede leer mal un color, y en ese caso hay que
 * poder decirlo en vez de arrastrar el error hasta el resultado.
 *
 * Quien no quiera usar la cámara contesta las tres preguntas a mano. Las
 * opciones traen referencias de cocina en vez de milímetros, porque "como un
 * grano de arroz" se contesta en un segundo.
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import {
  ESPECIES_CON_SEMILLA,
  OPCIONES_COLOR,
  OPCIONES_FORMA,
  OPCIONES_TAMANO,
  confianzaDeClave,
  esBuenaEpoca,
  fechaEsperada,
  identificarSemilla,
} from '../src/dominio/semillas';
import type { CandidataSemilla, Color, Forma, Rasgos, Tamano } from '../src/dominio/semillas';
import { MONEDAS } from '../src/dominio/vision';
import type { Medicion } from '../src/dominio/vision';
import { medirFotoDeSemilla } from '../src/servicios/fotoSemilla';
import { Grupo } from '../src/ui/iOS';
import { estilosTexto } from '../src/ui/componentes';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

export default function PantallaSemilla() {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const reducido = useReducedMotion();

  const [rasgos, setRasgos] = useState<Rasgos>({});
  const [foto, setFoto] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<number | undefined>(28);
  const [medicion, setMedicion] = useState<Medicion | null>(null);
  const [midiendo, setMidiendo] = useState(false);

  async function usarFoto(uri: string) {
    setFoto(uri);
    setMidiendo(true);
    const resultado = await medirFotoDeSemilla(uri, { monedaMm: moneda });
    setMedicion(resultado);
    // Lo medido entra como respuesta, no como veredicto: queda puesto en las
    // preguntas y se puede cambiar tocando otra opción.
    setRasgos((previos) => ({
      tamano: resultado.tamano ?? previos.tamano,
      forma: resultado.forma ?? previos.forma,
      color: resultado.color ?? previos.color,
    }));
    setMidiendo(false);
  }

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const tomada = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!tomada.canceled && tomada.assets[0]) await usarFoto(tomada.assets[0].uri);
  }

  async function elegirFoto() {
    const elegida = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!elegida.canceled && elegida.assets[0]) await usarFoto(elegida.assets[0].uri);
  }
  const candidatas = useMemo(() => identificarSemilla(rasgos), [rasgos]);
  const confianza = confianzaDeClave(candidatas);
  const contestadas = Object.values(rasgos).filter((v) => v !== undefined).length;

  // Sólo las que siguen encajando del todo. Las demás ya se descartaron y
  // mostrarlas sería ruido.
  const enPie = candidatas.filter((c) => c.encaje === (candidatas[0]?.encaje ?? 0));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingBottom: 60, gap: espacio.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Semillas' }} />

      <View style={{ gap: espacio.xs }}>
        <Text style={textos.titulo}>¿Qué semilla es?</Text>
        <Text style={textos.subtitulo}>
          Foto sobre papel blanco con una moneda al lado, y la mido. O
          contéstame las tres preguntas a mano.
        </Text>
      </View>

      <BloqueFoto
        foto={foto}
        moneda={moneda}
        onMoneda={setMoneda}
        medicion={medicion}
        midiendo={midiendo}
        onTomar={tomarFoto}
        onElegir={elegirFoto}
      />

      <Pregunta
        titulo="Tamaño"
        opciones={OPCIONES_TAMANO}
        valor={rasgos.tamano}
        onElegir={(v: Tamano) => setRasgos((r) => ({ ...r, tamano: v }))}
      />

      {(rasgos.tamano || foto) && (
        <Aparece reducido={reducido}>
          <Pregunta
            titulo="Forma"
            opciones={OPCIONES_FORMA}
            valor={rasgos.forma}
            onElegir={(v: Forma) => setRasgos((r) => ({ ...r, forma: v }))}
          />
        </Aparece>
      )}

      {(rasgos.forma || foto) && (
        <Aparece reducido={reducido}>
          <Pregunta
            titulo="Color"
            opciones={OPCIONES_COLOR}
            valor={rasgos.color}
            onElegir={(v: Color) => setRasgos((r) => ({ ...r, color: v }))}
          />
        </Aparece>
      )}

      {contestadas > 0 && (
        <Aparece reducido={reducido}>
          <View style={{ gap: espacio.md }}>
            <Text style={textos.rotulo}>
              {enPie.length === 0
                ? 'Ninguna encaja'
                : confianza === 'clara'
                  ? 'Es ésta'
                  : `${enPie.length} ${enPie.length === 1 ? 'posible' : 'posibles'}`}
            </Text>

            {enPie.length === 0 && (
              <Text style={textos.cuerpo}>
                Con esos rasgos no me cuadra ninguna de las que conozco. Puede que sea de una
                especie que no tengo, que son la mayoría.
              </Text>
            )}

            {enPie.map((candidata) => (
              <TarjetaCandidata
                key={candidata.perfil.especieId}
                candidata={candidata}
                sola={confianza === 'clara'}
              />
            ))}

            {contestadas < 3 && enPie.length > 1 && (
              <Text style={[textos.suave, { fontSize: 12 }]}>
                Contesta lo que falta y descarto más.
              </Text>
            )}
          </View>
        </Aparece>
      )}

      <Grupo nota={`Conozco las semillas de ${ESPECIES_CON_SEMILLA} especies del catálogo. Si la tuya no está, te lo digo en vez de darte un parecido — sembrar tres meses algo equivocado sale caro.`}>
        <Pressable
          onPress={() => {
            setRasgos({});
            setFoto(null);
            setMedicion(null);
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.md,
            paddingHorizontal: espacio.lg,
            minHeight: 48,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name="refresh" size={18} color={tema.textoSuave} />
          <Text style={{ fontFamily: fuente.cuerpoMedio, fontSize: 15, color: tema.texto }}>
            Empezar de nuevo
          </Text>
        </Pressable>
      </Grupo>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

/**
 * La foto y lo que se sacó de ella.
 *
 * La moneda se elige ANTES de disparar porque es lo que da la escala: sin un
 * objeto de tamaño conocido en el encuadre, la foto no tiene forma de saber si
 * la semilla mide dos milímetros o dos centímetros.
 */
function BloqueFoto({
  foto,
  moneda,
  onMoneda,
  medicion,
  midiendo,
  onTomar,
  onElegir,
}: {
  foto: string | null;
  moneda: number | undefined;
  onMoneda: (mm: number | undefined) => void;
  medicion: Medicion | null;
  midiendo: boolean;
  onTomar: () => void;
  onElegir: () => void;
}) {
  const tema = useTema();
  const textos = estilosTexto(tema);

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderWidth: 1,
        borderColor: tema.borde,
        padding: espacio.lg,
        gap: espacio.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
        <Ionicons name="camera" size={17} color={tema.primario} />
        <Text style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 14.5, color: tema.texto }}>
          Que la mida la cámara
        </Text>
      </View>

      <Text style={[textos.cuerpo, { fontSize: 13.5 }]}>
        Pon la semilla sobre papel blanco, con una moneda al lado y sin que se toquen. De la foto
        saco su color, su forma y —por la moneda— su tamaño en milímetros.
      </Text>

      <View style={{ gap: espacio.sm }}>
        <Text
          style={{
            fontFamily: fuente.cuerpoFuerte,
            fontSize: 11.5,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: tema.textoSuave,
          }}
        >
          Qué moneda pusiste
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
          {[...MONEDAS, { valor: 'no', etiqueta: 'Ninguna', mm: 0 }].map((opcion) => {
            const mm = opcion.mm > 0 ? opcion.mm : undefined;
            const activa = moneda === mm;
            return (
              <Pressable
                key={opcion.valor}
                onPress={() => onMoneda(mm)}
                style={({ pressed }) => ({
                  borderColor: activa ? tema.primario : tema.borde,
                  backgroundColor: activa ? tema.primarioSuave : 'transparent',
                  borderWidth: 1,
                  borderRadius: radio.completo,
                  paddingHorizontal: espacio.md,
                  minHeight: 34,
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.texto }}>
                  {opcion.etiqueta}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {moneda === undefined && (
          <Text style={[textos.suave, { fontSize: 11.5 }]}>
            Sin moneda leo color y forma, pero el tamaño lo pones tú: una foto sin referencia no
            tiene escala, y cualquier milímetro que dijera sería inventado.
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: espacio.sm }}>
        <Pressable
          onPress={onTomar}
          disabled={midiendo}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espacio.sm,
            backgroundColor: tema.primario,
            borderRadius: radio.md,
            minHeight: 48,
            opacity: midiendo ? 0.5 : pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="camera" size={17} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
          <Text
            style={{
              fontFamily: fuente.cuerpoFuerte,
              fontSize: 14.5,
              color: tema.esOscuro ? '#0B1A13' : '#fff',
            }}
          >
            Tomar foto
          </Text>
        </Pressable>
        <Pressable
          onPress={onElegir}
          disabled={midiendo}
          style={({ pressed }) => ({
            width: 48,
            minHeight: 48,
            borderRadius: radio.md,
            borderWidth: 1,
            borderColor: tema.borde,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: midiendo ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="images-outline" size={20} color={tema.textoSuave} />
        </Pressable>
      </View>

      {midiendo && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
          <ActivityIndicator color={tema.primario} />
          <Text style={[textos.suave, { fontSize: 13 }]}>Midiéndola…</Text>
        </View>
      )}

      {foto && !midiendo && (
        <View style={{ flexDirection: 'row', gap: espacio.md, alignItems: 'flex-start' }}>
          <Image
            source={{ uri: foto }}
            style={{ width: 84, height: 84, borderRadius: radio.md }}
          />
          <View style={{ flex: 1, gap: 4 }}>
            {medicion?.notas.map((nota, i) => (
              <Text key={i} style={[textos.cuerpo, { fontSize: 13 }]}>
                {nota}
              </Text>
            ))}
            {medicion?.sirvio && (
              <Text style={[textos.suave, { fontSize: 11.5 }]}>
                Lo dejé puesto abajo. Si me equivoqué en algo, tócalo y corrígelo.
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Aparece({ children, reducido }: { children: React.ReactNode; reducido: boolean }) {
  return (
    <Animated.View entering={reducido ? undefined : FadeInDown.duration(260)}>
      {children}
    </Animated.View>
  );
}

function Pregunta<T extends string>({
  titulo,
  opciones,
  valor,
  onElegir,
}: {
  titulo: string;
  opciones: Array<{ valor: T; etiqueta: string; referencia?: string }>;
  valor: T | undefined;
  onElegir: (valor: T) => void;
}) {
  const tema = useTema();

  return (
    <View style={{ gap: espacio.sm }}>
      <Text
        style={{
          fontFamily: fuente.cuerpoFuerte,
          fontSize: 11.5,
          letterSpacing: 0.9,
          textTransform: 'uppercase',
          color: tema.textoSuave,
        }}
      >
        {titulo}
      </Text>

      <View style={{ gap: espacio.sm }}>
        {opciones.map((opcion) => {
          const activa = opcion.valor === valor;
          return (
            <Pressable
              key={opcion.valor}
              onPress={() => onElegir(opcion.valor)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: espacio.md,
                backgroundColor: activa ? tema.primarioSuave : tema.superficie,
                borderColor: activa ? tema.primario : tema.borde,
                borderWidth: 1,
                borderRadius: radio.md,
                paddingHorizontal: espacio.lg,
                minHeight: 52,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14.5, color: tema.texto }}>
                  {opcion.etiqueta}
                </Text>
                {opcion.referencia && (
                  <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
                    {opcion.referencia}
                  </Text>
                )}
              </View>
              {activa && <Ionicons name="checkmark-circle" size={20} color={tema.primario} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------

function TarjetaCandidata({ candidata, sola }: { candidata: CandidataSemilla; sola: boolean }) {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const { perfil, especie } = candidata;
  const ventana = fechaEsperada(perfil.siembra);
  const enEpoca = esBuenaEpoca(perfil.siembra);

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderWidth: 1,
        borderColor: sola ? tema.primario : tema.borde,
        padding: espacio.lg,
        gap: espacio.sm,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fuente.titulo, fontSize: 18, color: tema.texto }}>
          {especie.nombresComunes[0] ?? especie.nombreCientifico}
        </Text>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
          {especie.nombreCientifico}
          {perfil.deSemilla && ` · ${perfil.largoMmMin}–${perfil.largoMmMax} mm`}
        </Text>
      </View>

      {/* La señal es lo que de verdad resuelve el empate cuando quedan dos. */}
      <Text style={[textos.cuerpo, { fontSize: 14 }]}>
        <Text style={{ fontFamily: fuente.cuerpoFuerte }}>Cómo la reconoces: </Text>
        {perfil.senal}.
      </Text>

      {!perfil.deSemilla ? (
        <View
          style={{
            backgroundColor: tema.superficieAlta,
            borderRadius: radio.md,
            padding: espacio.md,
            gap: 4,
          }}
        >
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.acento }}>
            De semilla no se hace
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.texto }}>
            Lo que sí funciona: {perfil.enLugarDe}.
          </Text>
        </View>
      ) : (
        <View style={{ gap: espacio.sm }}>
          <Dato
            icono="arrow-down"
            texto={
              perfil.siembra.profundidadCm === 0
                ? 'A la superficie, sin taparla'
                : `Entiérrala ${perfil.siembra.profundidadCm} cm`
            }
          />
          <Dato
            icono="time-outline"
            texto={`Asoma entre ${perfil.siembra.diasMin} y ${perfil.siembra.diasMax} días — o sea del ${ventana.desde} al ${ventana.hasta} si la siembras hoy`}
          />
          {perfil.siembra.tratamiento !== 'ninguno' && (
            <Dato icono="construct-outline" texto={`Antes: ${perfil.siembra.tratamiento}`} />
          )}
          <Dato
            icono={enEpoca ? 'checkmark-circle' : 'calendar-outline'}
            color={enEpoca ? tema.primario : tema.seco}
            texto={
              enEpoca
                ? 'Estás en su temporada de siembra'
                : `Su temporada es ${mesesLegibles(perfil.siembra.meses)}`
            }
          />
        </View>
      )}

      {sola && perfil.deSemilla && (
        <Pressable
          onPress={() => router.push('/planta/nueva')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espacio.sm,
            backgroundColor: tema.primario,
            borderRadius: radio.md,
            minHeight: 46,
            marginTop: espacio.xs,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="add" size={18} color={tema.esOscuro ? '#0B1A13' : '#fff'} />
          <Text
            style={{
              fontFamily: fuente.cuerpoFuerte,
              fontSize: 14.5,
              color: tema.esOscuro ? '#0B1A13' : '#fff',
            }}
          >
            Registrarla al sembrarla
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function Dato({
  icono,
  texto,
  color,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name'];
  texto: string;
  color?: string;
}) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: espacio.sm, alignItems: 'flex-start' }}>
      <Ionicons name={icono} size={15} color={color ?? tema.textoSuave} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 13.5, color: tema.texto }}>
        {texto}
      </Text>
    </View>
  );
}

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function mesesLegibles(meses: number[]): string {
  if (meses.length === 0) return 'ninguna';
  if (meses.length === 1) return `en ${NOMBRES_MES[meses[0] - 1]}`;
  return `de ${NOMBRES_MES[meses[0] - 1]} a ${NOMBRES_MES[meses[meses.length - 1] - 1]}`;
}

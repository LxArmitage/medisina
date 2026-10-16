/**
 * Ajustes.
 *
 * El reconocimiento de plantas ya viene encendido: corre dentro del teléfono,
 * sin internet ni llave (`src/ia/vision`). Aquí se puede sumar Pl@ntNet, que
 * conoce muchas más especies pero pide internet y una llave gratuita; se pega,
 * se comprueba contra el servidor, y desde ese momento se usa cuando hay señal.
 *
 * La comprobación es la parte que más se agradece: una llave con un espacio de
 * más falla igual que no tener ninguna, y sin probarla uno se entera después de
 * fotografiar la planta.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { leerAjuste } from '../src/datos/db';
import { identificarDueno } from '../src/servicios/cuenta';
import { useSesion } from '../src/ui/Sesion';
import {
  CLAVE_PLANTNET,
  guardarLlave,
  hayPlantnet,
  probarLlave,
} from '../src/servicios/identificacion';
import { EXAMEN_VISION } from '../src/ia/vision/reconocer';
import { Fila, Grupo } from '../src/ui/iOS';
import { estilosTexto } from '../src/ui/componentes';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

const PORTAL = 'https://my.plantnet.org/';

export default function PantallaAjustes() {
  const tema = useTema();
  const textos = estilosTexto(tema);

  const sesion = useSesion();
  const perfil = sesion.perfil;
  const [llave, setLlave] = useState('');
  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<{ sirve: boolean; motivo: string } | null>(null);

  useEffect(() => {
    void (async () => {
      setLlave((await leerAjuste(CLAVE_PLANTNET).catch(() => null)) ?? '');
    })();
  }, []);

  async function guardarYProbar() {
    setProbando(true);
    setResultado(null);
    await guardarLlave(llave);
    setResultado(await probarLlave(llave));
    setProbando(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      contentContainerStyle={{ padding: espacio.lg, paddingBottom: 60, gap: espacio.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Ajustes' }} />

      <Grupo
        titulo="Tu cuenta"
        nota="Tu cuenta y tus plantas viven en este teléfono: no hay servidor. Si borras la app, se van con ella."
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.md,
            paddingHorizontal: espacio.lg,
            paddingVertical: espacio.md,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: tema.primario,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: fuente.titulo, fontSize: 20, color: tema.esOscuro ? '#0B1A13' : '#fff' }}>
              {(nombre.trim().charAt(0) || '·').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              onEndEditing={() => {
                const limpio = nombre.trim();
                if (limpio.length >= 2 && limpio !== perfil?.nombre) void sesion.actualizar({ nombre: limpio });
                else setNombre(perfil?.nombre ?? '');
              }}
              placeholder="Tu nombre"
              placeholderTextColor={tema.textoSuave}
              returnKeyType="done"
              style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 16, color: tema.texto, paddingVertical: 2 }}
            />
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
              {perfil?.metodo === 'apple' ? `Con Apple${perfil.correo ? ` · ${perfil.correo}` : ''}` : (perfil?.correo ?? '')}
            </Text>
          </View>
        </View>
        <Fila
          titulo="Ciudad del clima"
          icono="partly-sunny"
          colorIcono="#F2A516"
          valor={perfil?.ciudad?.nombre ?? 'Elegir'}
          onPress={() => router.push('/cuenta/ciudad')}
        />
        {sesion.desbloqueo !== null && (
          <Fila
            titulo={`Abrir con ${sesion.nombreDesbloqueo}`}
            icono="lock-closed"
            colorIcono="#5C6FB8"
            accesorio={
              <Switch
                value={!!perfil?.desbloqueo}
                trackColor={{ true: tema.primario, false: tema.superficieAlta }}
                onValueChange={async (v) => {
                  // Encenderlo pide Face ID una vez: así se sabe que funciona
                  // antes de depender de él.
                  if (v && !(await identificarDueno('Usar ' + sesion.nombreDesbloqueo + ' en MEDISINA'))) return;
                  await sesion.actualizar({ desbloqueo: v });
                }}
              />
            }
          />
        )}
        <Fila
          titulo="Cerrar sesión"
          icono="log-out-outline"
          colorIcono="#6B7A73"
          onPress={() => {
            const salir = () => void sesion.salir();
            if (Platform.OS === 'web') return salir();
            Alert.alert('¿Cerrar sesión?', 'Tus plantas se quedan en el teléfono; las ves otra vez al entrar.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Cerrar sesión', onPress: salir },
            ]);
          }}
        />
        <Fila
          titulo="Borrar mi cuenta y mis datos"
          icono="trash-outline"
          colorIcono={tema.critico}
          destructiva
          onPress={() => {
            Alert.alert(
              '¿Borrar todo?',
              'Se borran tu cuenta, tus plantas, su bitácora y sus fotos registradas de este teléfono. No se puede deshacer.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Borrar todo', style: 'destructive', onPress: () => void sesion.borrarTodo() },
              ],
            );
          }}
        />
      </Grupo>

      <View style={{ gap: espacio.md }}>
        <Text
          style={{
            fontFamily: fuente.cuerpoFuerte,
            fontSize: 11.5,
            letterSpacing: 0.9,
            textTransform: 'uppercase',
            color: tema.textoSuave,
            paddingHorizontal: espacio.md,
          }}
        >
          Reconocimiento de plantas
        </Text>

        <View
          style={{
            backgroundColor: tema.superficie,
            borderRadius: radio.lg,
            borderWidth: 1,
            borderColor: tema.primario,
            padding: espacio.lg,
            gap: espacio.md,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
            <Ionicons name="checkmark-circle" size={18} color={tema.primario} />
            <Text style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 14.5, color: tema.texto }}>
              Encendido, sin internet
            </Text>
          </View>

          <Text style={textos.cuerpo}>
            El reconocimiento corre dentro de tu teléfono: no manda tus fotos a ningún lado y no
            cuesta nada. En fotos que nunca había visto, le atinó a la primera{' '}
            {Math.round(EXAMEN_VISION.top1 * 100)} de cada 100 veces, y entre sus tres opciones{' '}
            {Math.round(EXAMEN_VISION.top3 * 100)}. Con dos fotos —la planta entera y una hoja— le
            atina más.
          </Text>

          <View style={{ height: 1, backgroundColor: tema.borde }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
            <Ionicons
              name={hayPlantnet() ? 'checkmark-circle' : 'add-circle-outline'}
              size={18}
              color={hayPlantnet() ? tema.primario : tema.textoSuave}
            />
            <Text style={{ flex: 1, fontFamily: fuente.cuerpoFuerte, fontSize: 14.5, color: tema.texto }}>
              {hayPlantnet() ? 'Pl@ntNet también está encendido' : 'Opcional: Pl@ntNet'}
            </Text>
          </View>

          <Text style={textos.cuerpo}>
            Pl@ntNet conoce muchas más especies, pero necesita internet y manda la foto a su
            servidor. Es gratis: 500 identificaciones al día. Saca tu llave en my.plantnet.org y
            pégala aquí.
          </Text>

          <Pressable
            onPress={() => void Linking.openURL(PORTAL)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="open-outline" size={15} color={tema.primario} />
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13.5, color: tema.primario }}>
              Abrir my.plantnet.org
            </Text>
          </Pressable>

          <TextInput
            value={llave}
            onChangeText={setLlave}
            placeholder="Pega aquí tu llave"
            placeholderTextColor={tema.textoSuave}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: tema.fondo,
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
            onPress={guardarYProbar}
            disabled={probando || llave.trim().length === 0}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: espacio.sm,
              backgroundColor: tema.primario,
              borderRadius: radio.md,
              minHeight: 48,
              opacity: probando || llave.trim().length === 0 ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            {probando ? (
              <ActivityIndicator color={tema.esOscuro ? '#0B1A13' : '#fff'} />
            ) : (
              <Text
                style={{
                  fontFamily: fuente.cuerpoFuerte,
                  fontSize: 15,
                  color: tema.esOscuro ? '#0B1A13' : '#fff',
                }}
              >
                Guardar y probar
              </Text>
            )}
          </Pressable>

          {resultado && (
            <View
              style={{
                flexDirection: 'row',
                gap: espacio.sm,
                backgroundColor: tema.superficieAlta,
                borderRadius: radio.md,
                padding: espacio.md,
              }}
            >
              <Ionicons
                name={resultado.sirve ? 'checkmark-circle' : 'close-circle'}
                size={17}
                color={resultado.sirve ? tema.primario : tema.acento}
              />
              <Text style={[textos.cuerpo, { flex: 1, fontSize: 13.5 }]}>{resultado.motivo}</Text>
            </View>
          )}

          <Text style={[textos.suave, { fontSize: 11.5 }]}>
            Sin llave no pasa nada: el reconocimiento del teléfono sigue funcionando igual. Con llave,
            cuando hay señal se le pregunta también a Pl@ntNet, y si él está seguro, manda.
          </Text>
        </View>
      </View>

      <Grupo
        titulo="Privacidad"
        nota="Las fotos que tomas se quedan en el teléfono y se reconocen ahí mismo. Sólo salen si encendiste Pl@ntNet: entonces, al identificar, se le mandan a él, y nada más."
      >
        <Fila titulo="Todo se guarda en este dispositivo" icono="phone-portrait" colorIcono="#6B7A73" />
      </Grupo>
    </ScrollView>
  );
}

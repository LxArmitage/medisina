/**
 * Elegir la ciudad de tus plantas: con el GPS (una sola vez) o buscándola.
 *
 * El GPS sólo sirve para encontrar la ciudad más cercana de la lista; las
 * coordenadas exactas no se guardan, se guardan las de la ciudad. Si la
 * persona dice que no al permiso, busca su ciudad y listo: no hay callejón.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { buscarCiudades, ciudadMasCercana } from '../dominio/ciudades';
import type { Ciudad } from '../dominio/ciudades';
import { Grupo } from './iOS';
import { espacio, fuente, radio, useTema } from './tema';

export function SelectorCiudad({
  elegida,
  onElegir,
  onEnfocar,
}: {
  elegida: Ciudad | null;
  onElegir: (c: Ciudad) => void;
  /** El buscador recibió el foco (para subirlo sobre el teclado). */
  onEnfocar?: () => void;
}) {
  const tema = useTema();
  const [texto, setTexto] = useState('');
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Sin buscar, la que ya está elegida va primero y marcada: se ve de un vistazo.
  const lista = useMemo(() => {
    const encontradas = buscarCiudades(texto, 7);
    if (texto.trim() || !elegida) return encontradas;
    const otras = encontradas.filter((c) => !(c.nombre === elegida.nombre && c.estado === elegida.estado));
    return [elegida, ...otras].slice(0, 7);
  }, [texto, elegida]);

  async function usarUbicacion() {
    setAviso(null);
    setBuscandoGps(true);
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (!permiso.granted) {
        setAviso('Sin permiso de ubicación. Búscala abajo, es igual de bueno.');
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      const { ciudad, km } = ciudadMasCercana({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      onElegir(ciudad);
      setAviso(km > 80 ? `La más cercana que conozco está a ${Math.round(km)} km. Si hay otra más parecida a tu clima, búscala.` : null);
    } catch {
      setAviso('No pude leer la ubicación. Búscala abajo.');
    } finally {
      setBuscandoGps(false);
    }
  }

  return (
    <View style={{ gap: espacio.md }}>
      <Pressable
        onPress={() => void usarUbicacion()}
        disabled={buscandoGps}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: espacio.sm,
          minHeight: 48,
          borderRadius: radio.md,
          backgroundColor: tema.primarioSuave,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {buscandoGps ? (
          <ActivityIndicator color={tema.primario} />
        ) : (
          <Ionicons name="navigate" size={17} color={tema.primario} />
        )}
        <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.primario }}>
          {buscandoGps ? 'Buscando…' : 'Usar mi ubicación'}
        </Text>
      </Pressable>
      {aviso && <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>{aviso}</Text>}

      <View
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
          value={texto}
          onChangeText={setTexto}
          onFocus={onEnfocar}
          placeholder="Busca tu ciudad"
          placeholderTextColor={tema.textoSuave}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          textContentType="addressCity"
          style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 16, color: tema.texto, paddingVertical: 10 }}
        />
        {texto.length > 0 && Platform.OS !== 'ios' && (
          <Pressable onPress={() => setTexto('')} hitSlop={10} accessibilityLabel="Borrar">
            <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
          </Pressable>
        )}
      </View>

      {lista.length === 0 ? (
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.textoSuave }}>
          No la tengo. Elige la más cercana: el clima de una ciudad vecina sirve igual.
        </Text>
      ) : (
        <Grupo>
          {lista.map((c) => {
            const activa = elegida?.nombre === c.nombre && elegida.estado === c.estado;
            return (
              <Pressable
                key={`${c.nombre}-${c.estado}`}
                onPress={() => onElegir(c)}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: espacio.md,
                  paddingHorizontal: espacio.lg,
                  minHeight: 48,
                  backgroundColor: activa ? tema.primarioSuave : pressed ? tema.superficieAlta : 'transparent',
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: tema.texto }}>{c.nombre}</Text>
                  <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>{c.estado}</Text>
                </View>
                {activa && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <Ionicons name="checkmark" size={20} color={tema.primario} />
                  </Animated.View>
                )}
              </Pressable>
            );
          })}
        </Grupo>
      )}
    </View>
  );
}

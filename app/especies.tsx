/**
 * Conoce las plantas: todas las que la app reconoce, con su cara en 3D.
 *
 * Sirve para dos cosas. Para curiosear —¿qué es un ave del paraíso?, ¿cómo
 * se ve una pitahaya con fruta?— y para encontrar la tuya cuando sabes cómo
 * le dicen pero no su nombre de libro: se busca en español, en inglés
 * ("dragon fruit") o por el científico.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { especiesReales, filtrarEspecies } from '../src/dominio/catalogo';
import { enCategoria } from '../src/dominio/categorias';
import type { Categoria } from '../src/dominio/categorias';
import { nombresDe } from '../src/dominio/nombres';
import type { Especie } from '../src/dominio/tipos';
import { MuestraEspecie } from '../src/ui/MuestraEspecie';
import { estilosTexto } from '../src/ui/componentes';
import { espacio, fuente, radio, useTema } from '../src/ui/tema';

const FILTROS: Array<{ clave: Categoria; titulo: string; icono: keyof typeof Ionicons.glyphMap }> = [
  { clave: 'todas', titulo: 'Todas', icono: 'apps' },
  { clave: 'frutales', titulo: 'Frutales', icono: 'nutrition' },
  { clave: 'flor', titulo: 'De flor', icono: 'flower' },
  { clave: 'suculentas', titulo: 'Cactus y suculentas', icono: 'sunny' },
  { clave: 'interior', titulo: 'De interior', icono: 'home' },
  { clave: 'cocina', titulo: 'De cocina', icono: 'restaurant' },
];

export default function PantallaEspecies() {
  const tema = useTema();
  const textos = estilosTexto(tema);
  const { width } = useWindowDimensions();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Categoria>('todas');

  const lista = useMemo(() => {
    const reales = new Set(especiesReales().map((e) => e.id));
    return filtrarEspecies(busqueda)
      .filter((e) => reales.has(e.id) && enCategoria(e, filtro))
      .sort((a, b) => a.nombresComunes[0].localeCompare(b.nombresComunes[0], 'es'));
  }, [busqueda, filtro]);

  const tinta = tema.esOscuro ? '#0B1A13' : '#FFFFFF';
  const columnas = width >= 700 ? 3 : 2;
  const ancho = Math.floor((Math.min(width, 900) - espacio.lg * 2 - espacio.sm * (columnas - 1)) / columnas);

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <Stack.Screen options={{ title: 'Conoce las plantas' }} />
      <FlatList
        data={lista}
        key={columnas}
        numColumns={columnas}
        keyExtractor={(e) => e.id}
        initialNumToRender={6}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        columnWrapperStyle={{ gap: espacio.sm }}
        contentContainerStyle={{ padding: espacio.lg, gap: espacio.sm, paddingBottom: espacio.xxl }}
        ListHeaderComponent={
          <View style={{ gap: espacio.md, marginBottom: espacio.sm }}>
            <Text style={textos.subtitulo}>
              Las {especiesReales().length} plantas que la app reconoce, aun sin internet. Toca una para conocerla.
            </Text>
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
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Pitahaya, dragon fruit, sábila…"
                placeholderTextColor={tema.textoSuave}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 16, color: tema.texto, paddingVertical: 10 }}
                accessibilityLabel="Buscar una planta"
              />
              {busqueda.length > 0 && (
                <Pressable onPress={() => setBusqueda('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
                  <Ionicons name="close-circle" size={18} color={tema.textoSuave} />
                </Pressable>
              )}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.xs }}>
              {FILTROS.map((f) => {
                const activo = f.clave === filtro;
                return (
                  <Pressable
                    key={f.clave}
                    onPress={() => setFiltro(f.clave)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: activo ? tema.primario : tema.superficie,
                      borderWidth: 1,
                      borderColor: activo ? tema.primario : tema.borde,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Ionicons name={f.icono} size={14} color={activo ? tinta : tema.textoSuave} />
                    <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: activo ? tinta : tema.texto }}>
                      {f.titulo}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[textos.suave, { textAlign: 'center', marginTop: espacio.xl }]}>
            No encontré “{busqueda}”. Prueba con otro nombre, o escanéala: si no la conozco, igual la puedes registrar.
          </Text>
        }
        renderItem={({ item }) => <TarjetaEspecie especie={item} ancho={ancho} />}
      />
    </View>
  );
}

function TarjetaEspecie({ especie, ancho }: { especie: Especie; ancho: number }) {
  const tema = useTema();
  const n = nombresDe(especie);
  const segundo = [n.otros[0], n.ingles[0]].filter(Boolean).join(' · ') || n.cientifico;
  return (
    <Pressable
      onPress={() => router.push(`/especie/${especie.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${n.principal}. ${segundo}`}
      style={({ pressed }) => ({
        width: ancho,
        borderRadius: radio.lg,
        overflow: 'hidden',
        backgroundColor: tema.superficie,
        borderWidth: 1,
        borderColor: tema.borde,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <MuestraEspecie especie={especie} ancho={ancho} alto={Math.round(ancho * 0.95)} conFondo enFlor />
      <View style={{ paddingHorizontal: espacio.sm, paddingVertical: espacio.sm, gap: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpoNegro, fontSize: 15, color: tema.texto }}>
          {n.principal}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fuente.cuerpo, fontSize: 12, color: tema.textoSuave }}>
          {segundo}
        </Text>
      </View>
    </Pressable>
  );
}

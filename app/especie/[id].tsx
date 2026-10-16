/**
 * La ficha de una especie: cómo se ve, cómo le dicen y lo que vale la pena
 * saber de ella.
 *
 * No es la ficha de TU planta (esa es `planta/[id]`, con su agua y su
 * historia): es la de la especie, para conocerla antes de tenerla o para
 * saber más de la que ya tienes. Por eso lo primero son los nombres —todos,
 * también el de internet— y los datos curiosos.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { buscarEspecie } from '../../src/dominio/catalogo';
import { etiquetaBanda, etiquetaPerfil } from '../../src/dominio/compatibilidad';
import { conocimientoDe, etiquetaToxicidad } from '../../src/dominio/conocimiento';
import { curiosidadesDe } from '../../src/dominio/curiosidades';
import { formaDe } from '../../src/dominio/forma';
import { nombresDe } from '../../src/dominio/nombres';
import { MuestraEspecie } from '../../src/ui/MuestraEspecie';
import { Boton, Seccion, Vacio, estilosTexto } from '../../src/ui/componentes';
import { espacio, fuente, radio, useTema } from '../../src/ui/tema';

const COLORES_DATO = ['#E8940C', '#2E8B57', '#3F7CAC', '#C66A3D', '#8E5BB5'];

export default function PantallaEspecie() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tema = useTema();
  const textos = estilosTexto(tema);
  const { width } = useWindowDimensions();
  const especie = buscarEspecie(id ?? '');
  const forma = formaDe(id ?? '');
  const tieneFlor = !!(forma.flor || forma.fruto);
  const [enFlor, setEnFlor] = useState(tieneFlor);

  if (!especie) {
    return (
      <View style={{ flex: 1, backgroundColor: tema.fondo, padding: espacio.lg }}>
        <Vacio titulo="No encontré esa planta" descripcion="Puede que ya no esté en el catálogo." />
      </View>
    );
  }

  const n = nombresDe(especie);
  const c = conocimientoDe(especie);
  const datos = curiosidadesDe(especie.id);
  const lado = Math.min(width, 640) - espacio.lg * 2;
  const tamano =
    especie.alturaMaximaCm >= 100
      ? `hasta ${(especie.alturaMaximaCm / 100).toFixed(especie.alturaMaximaCm % 100 === 0 ? 0 : 1)} m`
      : `hasta ${especie.alturaMaximaCm} cm`;
  const basicos: Array<{ icono: keyof typeof Ionicons.glyphMap; titulo: string; valor: string }> = [
    { icono: 'sunny', titulo: 'Luz', valor: capitalizar(etiquetaBanda(especie.bandasToleradas[0])) },
    { icono: 'water', titulo: 'Agua', valor: capitalizar(etiquetaPerfil(especie.perfilHidrico)) },
    { icono: 'resize', titulo: 'Tamaño', valor: `${capitalizar(tamano)}, crece ${especie.crecimientoCmPorAno} cm al año` },
    { icono: 'thermometer', titulo: 'Aguanta', valor: `De ${c.temperaturaMinC} a ${c.temperaturaMaxC} °C` },
    { icono: 'earth', titulo: 'Es de', valor: capitalizar(c.origen) },
    { icono: 'paw', titulo: 'Con mascotas', valor: capitalizar(etiquetaToxicidad(c.toxicidad.mascotas)) },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tema.fondo }} contentContainerStyle={{ padding: espacio.lg, gap: espacio.xl, paddingBottom: espacio.xxl }}>
      <Stack.Screen options={{ title: n.principal }} />

      {/* Cómo se ve: se puede girar con el dedo. */}
      <View style={{ gap: espacio.sm }}>
        <View style={{ borderRadius: radio.lg, overflow: 'hidden', borderWidth: 1, borderColor: tema.borde }}>
          <MuestraEspecie especie={especie} ancho={lado} alto={Math.round(lado * 0.82)} conFondo enFlor={enFlor} detalle="alto" interactivo />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[textos.suave, { fontSize: 12 }]}>Gírala con el dedo</Text>
          {tieneFlor && (
            <Pressable
              onPress={() => setEnFlor((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: enFlor }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: enFlor ? tema.primarioSuave : tema.superficie,
                borderWidth: 1,
                borderColor: enFlor ? tema.primario : tema.borde,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name={enFlor ? 'flower' : 'flower-outline'} size={15} color={tema.primario} />
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto }}>
                {forma.fruto ? 'Con flor y fruto' : 'En flor'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Cómo se llama, de todas las formas. */}
      <View style={{ gap: espacio.sm }}>
        <Text style={textos.titulo}>{n.principal}</Text>
        <Text style={{ fontFamily: fuente.tituloItalica, fontSize: 16, color: tema.textoSuave }}>{n.cientifico}</Text>
        {n.otros.length > 0 && <FilaNombres titulo="También le dicen" nombres={n.otros} />}
        {n.ingles.length > 0 && <FilaNombres titulo="En inglés" nombres={n.ingles} ingles />}
      </View>

      {datos.length > 0 && (
        <Seccion titulo="¿Sabías que…?">
          <View style={{ gap: espacio.sm }}>
            {datos.map((dato, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(70 * i).duration(260)}
                style={{
                  flexDirection: 'row',
                  gap: espacio.md,
                  backgroundColor: tema.superficie,
                  borderRadius: radio.lg,
                  borderWidth: 1,
                  borderColor: tema.borde,
                  padding: espacio.md,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: COLORES_DATO[i % COLORES_DATO.length],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={i === 0 ? 'sparkles' : 'bulb'} size={16} color="#FFFFFF" />
                </View>
                <Text style={[textos.cuerpo, { flex: 1 }]}>{dato}</Text>
              </Animated.View>
            ))}
          </View>
        </Seccion>
      )}

      <Seccion titulo="Lo básico">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
          {basicos.map((b) => (
            <View
              key={b.titulo}
              style={{
                width: (lado - espacio.sm) / 2,
                backgroundColor: tema.superficie,
                borderRadius: radio.md,
                borderWidth: 1,
                borderColor: tema.borde,
                padding: espacio.md,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={b.icono} size={15} color={tema.primario} />
                <Text style={textos.rotulo}>{b.titulo}</Text>
              </View>
              <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 14, color: tema.texto }}>{b.valor}</Text>
            </View>
          ))}
        </View>
        {especie.nota && (
          <View style={{ flexDirection: 'row', gap: espacio.md, backgroundColor: tema.superficieAlta, borderRadius: radio.md, padding: espacio.md }}>
            <Ionicons name="leaf" size={18} color={tema.primario} />
            <Text style={[textos.cuerpo, { flex: 1 }]}>{especie.nota}</Text>
          </View>
        )}
      </Seccion>

      <View style={{ gap: espacio.sm }}>
        <Boton titulo="Tengo una: agregarla" onPress={() => router.push({ pathname: '/planta/nueva', params: { especie: especie.id } })} />
        <Boton titulo="Escanear la mía" variante="secundario" onPress={() => router.push('/escanear')} />
      </View>
    </ScrollView>
  );
}

function FilaNombres({ titulo, nombres, ingles = false }: { titulo: string; nombres: string[]; ingles?: boolean }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.textoSuave }}>{titulo}:</Text>
      {nombres.map((nombre) => (
        <View
          key={nombre}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: ingles ? tema.superficieAlta : tema.primarioSuave,
          }}
        >
          {ingles && <Text style={{ fontFamily: fuente.cuerpoNegro, fontSize: 10, color: tema.textoSuave }}>EN</Text>}
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: tema.texto }}>{nombre}</Text>
        </View>
      ))}
    </View>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

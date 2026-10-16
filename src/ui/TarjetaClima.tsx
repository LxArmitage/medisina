/**
 * El clima de estos días, y a quién hay que mover.
 *
 * Lo primero es lo que se hace: "mueve a Helechón a la sombra el jueves". El
 * pronóstico va abajo, de apoyo, para quien quiera ver por qué. Si nadie tiene
 * que moverse, se dice con esas palabras: un "todo bien" también es
 * información.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { AvisoMover, Cielo } from '../dominio/avisosClima';
import { lugarParaAviso } from '../dominio/lugares';
import type { Lugar } from '../dominio/lugares';
import type { EstadoDePlanta } from '../servicios/agenda';
import type { ClimaDelJardin } from '../servicios/climaJardin';
import { mudarPlanta, ponerBajoTecho } from '../servicios/mudanza';
import { espacio, fuente, radio, useTema } from './tema';

const ICONO_CIELO: Record<Cielo, keyof typeof Ionicons.glyphMap> = {
  sol: 'sunny',
  nubes: 'partly-sunny',
  lluvia: 'rainy',
  tormenta: 'thunderstorm',
};

const COLOR_CIELO: Record<Cielo, string> = {
  sol: '#F2B233',
  nubes: '#9BB0C0',
  lluvia: '#4F9ED8',
  tormenta: '#5C6FB8',
};

const ICONO_DESTINO: Record<AvisoMover['destino'], keyof typeof Ionicons.glyphMap> = {
  sombra: 'umbrella',
  adentro: 'home',
  techo: 'umbrella',
  mas_luz: 'sunny',
  menos_luz: 'partly-sunny',
};

const TITULO_DESTINO: Record<AvisoMover['destino'], string> = {
  sombra: 'A la sombra',
  adentro: 'Adentro',
  techo: 'Bajo techo',
  mas_luz: 'A más luz',
  menos_luz: 'Lejos del sol',
};

export function TarjetaClima({
  clima,
  estados = [],
  onMudada,
  onCambio,
}: {
  clima: ClimaDelJardin;
  /** Para poder moverla desde aquí mismo, sin ir a buscarla. */
  estados?: EstadoDePlanta[];
  /** Ya se mudó de lugar. */
  onMudada?: (plantaId: string, apodo: string, lugar: Lugar) => void;
  /** Cambió algo sin mudarla (la puso bajo techo): recargar. */
  onCambio?: () => void;
}) {
  const tema = useTema();
  const { dias, avisos, estimado } = clima;
  if (dias.length === 0) return null;
  const urgentes = avisos.filter((a) => a.motivo !== 'luz').slice(0, 4);
  const deLuz = avisos.filter((a) => a.motivo === 'luz').slice(0, 2);

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderWidth: 1,
        borderColor: urgentes.length > 0 ? '#E8761A' : tema.borde,
        padding: espacio.lg,
        gap: espacio.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
        <Ionicons name="cloudy-night-outline" size={18} color={tema.textoSuave} />
        <Text style={{ flex: 1, fontFamily: fuente.titulo, fontSize: 17, color: tema.texto }}>El clima de estos días</Text>
        {estimado && (
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 11, color: tema.textoSuave }}>sin conexión: promedio</Text>
        )}
      </View>

      {/* Primero lo que hay que hacer */}
      {urgentes.length > 0 ? (
        urgentes.map((a) => (
          <FilaAviso
            key={`${a.plantaId}-${a.motivo}`}
            aviso={a}
            estado={estados.find((e) => e.planta.id === a.plantaId)}
            onMudada={onMudada}
            onCambio={onCambio}
          />
        ))
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
          <Ionicons name="checkmark-circle" size={16} color={tema.primario} />
          <Text style={{ flex: 1, fontFamily: fuente.cuerpo, fontSize: 13.5, color: tema.texto }}>
            Con este clima no hay que mover a nadie de lugar.
          </Text>
        </View>
      )}

      {/* El pronóstico, de apoyo */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {dias.map((d) => (
          <View key={d.fecha} style={{ alignItems: 'center', gap: 3, flex: 1 }}>
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 11.5, color: d.nombre === 'Hoy' ? tema.texto : tema.textoSuave }}>
              {d.nombre}
            </Text>
            <Ionicons name={ICONO_CIELO[d.cielo]} size={22} color={COLOR_CIELO[d.cielo]} />
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13, color: d.tMaxC >= 38 ? '#E8761A' : tema.texto }}>
              {d.tMaxC}°
            </Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 11.5, color: d.tMinC <= 5 ? '#4F9ED8' : tema.textoSuave }}>
              {d.tMinC}°
            </Text>
            {d.lluviaMm >= 1 && (
              <Text style={{ fontFamily: fuente.cuerpo, fontSize: 10.5, color: '#4F9ED8' }}>{Math.round(d.lluviaMm)} mm</Text>
            )}
          </View>
        ))}
      </View>

      {deLuz.length > 0 && (
        <View style={{ gap: espacio.sm, borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: espacio.md }}>
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: tema.textoSuave }}>
            Y sin prisa, por su luz:
          </Text>
          {deLuz.map((a) => (
            <FilaAviso
              key={`${a.plantaId}-luz`}
              aviso={a}
              estado={estados.find((e) => e.planta.id === a.plantaId)}
              onMudada={onMudada}
              onCambio={onCambio}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function FilaAviso({
  aviso,
  estado,
  onMudada,
  onCambio,
}: {
  aviso: AvisoMover;
  estado?: EstadoDePlanta;
  onMudada?: (plantaId: string, apodo: string, lugar: Lugar) => void;
  onCambio?: () => void;
}) {
  const tema = useTema();
  const luz = aviso.motivo === 'luz';
  const [ocupado, setOcupado] = useState(false);

  // Moverla aquí mismo: el aviso ya dice a dónde, no hay nada más que decidir.
  const hacerlo = async () => {
    if (!estado || ocupado) return;
    setOcupado(true);
    try {
      const lugar = lugarParaAviso(aviso.destino, estado.especie);
      if (lugar) {
        await mudarPlanta(estado.planta, lugar);
        onMudada?.(estado.planta.id, estado.planta.apodo, lugar);
      } else {
        await ponerBajoTecho(estado.planta);
        onCambio?.();
      }
    } finally {
      setOcupado(false);
    }
  };
  // El renglón abre su ficha y el botón la mueve: hermanos, no uno dentro del
  // otro (un botón dentro de otro confunde a VoiceOver y al navegador).
  return (
    <View style={{ flexDirection: 'row', gap: espacio.md, alignItems: 'center' }}>
      <Pressable
        onPress={() => router.push(`/planta/${aviso.plantaId}`)}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          gap: espacio.md,
          alignItems: 'flex-start',
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: luz ? tema.superficieAlta : '#FCE3CC',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={ICONO_DESTINO[aviso.destino]} size={17} color={luz ? tema.textoSuave : '#C25E10'} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 13.5, color: tema.texto }}>
            {aviso.apodo} · {TITULO_DESTINO[aviso.destino]}
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, lineHeight: 18, color: tema.textoSuave }}>{aviso.texto}</Text>
        </View>
      </Pressable>
      {estado && onMudada && (
        <Pressable
          onPress={() => void hacerlo()}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel={aviso.destino === 'techo' ? `Ya puse a ${aviso.apodo} bajo techo` : `Mover a ${aviso.apodo}`}
          hitSlop={6}
          style={({ pressed }) => ({
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 11,
            minHeight: 32,
            borderRadius: radio.completo,
            backgroundColor: luz ? tema.superficieAlta : '#E8761A',
            opacity: pressed || ocupado ? 0.7 : 1,
          })}
        >
          {ocupado ? (
            <ActivityIndicator size="small" color={luz ? tema.texto : '#fff'} />
          ) : (
            <Ionicons name={aviso.destino === 'techo' ? 'checkmark' : 'move'} size={13} color={luz ? tema.texto : '#fff'} />
          )}
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: luz ? tema.texto : '#fff' }}>
            {aviso.destino === 'techo' ? 'Ya' : 'Moverla'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * La racha, en la pantalla de Hoy.
 *
 * Se lee en este orden, y el orden es el diseño:
 *
 *   1. La llama y el número. Encendida si hoy ya registraste algo; gris si no.
 *      Antes de leer una palabra ya sabes si te falta algo hoy.
 *   2. La semana. Siete casillas, la de hoy marcada. Es lo que enseña la regla
 *      sin explicarla: cada casilla llena es un día en que hiciste algo.
 *   3. Qué hacer. Una frase y, si hoy falta, un botón que lleva al patio.
 *
 * La salud de las plantas va al final y aparte. No mueve la racha —la racha
 * cuenta lo que haces—, pero si una maceta está encharcada hay que decirlo
 * aunque la racha vaya perfecta.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { DiaDeRacha, Racha } from '../dominio/racha';
import { felicitarRacha } from './FelicitacionRacha';
import { Llama } from './Llama';
import { espacio, fuente, radio, useTema } from './tema';

const NARANJA = '#FF7A1A';
const HIELO = '#8FC9E8';

export interface TarjetaRachaProps {
  racha: Racha;
  /** Saltar a la planta que está fuera de rango. */
  onAtender?: (plantaId: string) => void;
  /** Ir a cuidarlas: el patio, donde cada planta se riega o se revisa de un toque. */
  onCuidar?: () => void;
}

export function TarjetaRacha({ racha, onAtender, onCuidar }: TarjetaRachaProps) {
  const tema = useTema();
  const meta = racha.siguienteMeta;

  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderRadius: radio.lg,
        borderWidth: 1,
        borderColor: racha.enPeligro ? NARANJA : tema.borde,
        padding: espacio.lg,
        gap: espacio.md,
      }}
    >
      {/* 1. Llama y número. Se tocan: felicitan. */}
      <Pressable
        onPress={() => felicitarRacha({ dias: racha.dias, mejor: racha.mejor, hoyCuenta: racha.hoyCuenta })}
        accessibilityRole="button"
        accessibilityHint="Toca para ver cómo vas"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: espacio.md, opacity: pressed ? 0.8 : 1 })}
      >
        <Llama tamano={40} encendida={racha.hoyCuenta} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: fuente.titulo,
              fontSize: 30,
              lineHeight: 34,
              color: racha.hoyCuenta ? NARANJA : tema.texto,
            }}
          >
            {racha.dias} {racha.dias === 1 ? 'día' : 'días'}
          </Text>
          <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.textoSuave }}>
            {racha.hoyCuenta ? 'de racha · hoy ya cuenta' : 'de racha · hoy te falta'}
          </Text>
        </View>

        {racha.protectores > 0 && (
          <View
            accessibilityLabel="Tienes un protector: cubre un día que se te olvide"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: tema.superficieAlta,
              borderRadius: radio.completo,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Ionicons name="snow" size={14} color={HIELO} />
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12, color: tema.textoSuave }}>
              Protector
            </Text>
          </View>
        )}
      </Pressable>

      {/* 2. La semana */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {racha.semana.map((dia) => (
          <CasillaDia key={dia.fecha} dia={dia} />
        ))}
      </View>

      {/* 3. Qué hacer */}
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14, lineHeight: 20, color: tema.texto }}>
        {racha.explicacion}
      </Text>

      {!racha.hoyCuenta && onCuidar && (
        <Pressable
          onPress={onCuidar}
          accessibilityRole="button"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: espacio.sm,
            backgroundColor: NARANJA,
            borderRadius: radio.completo,
            minHeight: 46,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <Ionicons name="leaf" size={16} color="#fff" />
          <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 15, color: '#fff' }}>
            Ir al patio a cuidarlas
          </Text>
        </Pressable>
      )}

      {meta && meta.faltan !== undefined && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fuente.cuerpoFuerte, fontSize: 12.5, color: tema.texto }}>
              {meta.titulo}
            </Text>
            <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave }}>
              {meta.faltan === 1 ? 'falta 1 día' : `faltan ${meta.faltan} días`}
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: tema.superficieAlta, overflow: 'hidden' }}>
            <View
              style={{
                width: `${Math.round(meta.avance * 100)}%`,
                height: '100%',
                backgroundColor: NARANJA,
                borderRadius: 3,
              }}
            />
          </View>
        </View>
      )}

      {/* La salud, aparte */}
      <Salud racha={racha} onAtender={onAtender} />
    </View>
  );
}

function CasillaDia({ dia }: { dia: DiaDeRacha }) {
  const tema = useTema();
  const lleno = dia.estado === 'cuidado';
  const protegido = dia.estado === 'protegido';

  return (
    <View style={{ alignItems: 'center', gap: 4 }} accessibilityLabel={descripcionDe(dia)}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: lleno ? NARANJA : protegido ? HIELO : 'transparent',
          borderWidth: 2,
          borderColor: lleno ? NARANJA : protegido ? HIELO : dia.esHoy ? NARANJA : tema.borde,
          borderStyle: dia.esHoy && !lleno ? 'dashed' : 'solid',
        }}
      >
        {lleno && <Ionicons name="checkmark" size={17} color="#fff" />}
        {protegido && <Ionicons name="snow" size={14} color="#fff" />}
      </View>
      <Text
        style={{
          fontFamily: dia.esHoy ? fuente.cuerpoFuerte : fuente.cuerpo,
          fontSize: 11,
          color: dia.esHoy ? tema.texto : tema.textoSuave,
        }}
      >
        {dia.letra}
      </Text>
    </View>
  );
}

function descripcionDe(dia: DiaDeRacha): string {
  const cuando = dia.esHoy ? 'Hoy' : dia.fecha;
  switch (dia.estado) {
    case 'cuidado':
      return `${cuando}: cuidaste tus plantas`;
    case 'protegido':
      return `${cuando}: cubierto por el protector`;
    case 'perdido':
      return `${cuando}: sin registro`;
    case 'pendiente':
      return `${cuando}: pendiente`;
    default:
      return `${cuando}: antes de empezar`;
  }
}

function Salud({ racha, onAtender }: { racha: Racha; onAtender?: (id: string) => void }) {
  const tema = useTema();
  const { paraSalvarla, salud } = racha;
  if (salud.total === 0) return null;

  if (paraSalvarla.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.sm }}>
        <Ionicons name="checkmark-circle" size={16} color={tema.primario} />
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 12.5, color: tema.textoSuave, flex: 1 }}>
          {salud.total === 1
            ? 'Tu planta amaneció en rango.'
            : `Tus ${salud.total} plantas amanecieron en rango.`}
        </Text>
      </View>
    );
  }

  const primera = paraSalvarla[0];
  const sed = primera.motivo === 'sed';
  return (
    <Pressable
      onPress={() => onAtender?.(primera.plantaId)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.sm,
        backgroundColor: tema.superficieAlta,
        borderRadius: radio.md,
        padding: espacio.md,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={sed ? 'water-outline' : 'warning-outline'} size={16} color={tema.acento} />
      <Text style={{ fontFamily: fuente.cuerpo, fontSize: 13, color: tema.texto, flex: 1 }}>
        {primera.apodo} {sed ? 'tiene sed de verdad' : 'está encharcada: no la riegues'}
        {paraSalvarla.length > 1 ? ` y ${paraSalvarla.length - 1} más` : ''}.
      </Text>
      <Ionicons name="chevron-forward" size={16} color={tema.textoSuave} />
    </Pressable>
  );
}

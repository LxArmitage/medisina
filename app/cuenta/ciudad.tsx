/**
 * Cambiar la ciudad del clima, desde Ajustes. Se abre como hoja (modal) y se
 * cierra sola al elegir: en iOS, una elección en una hoja es la respuesta.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { CIUDADES } from '../../src/dominio/ciudades';
import type { Ciudad } from '../../src/dominio/ciudades';
import { SelectorCiudad } from '../../src/ui/SelectorCiudad';
import { useSesion } from '../../src/ui/Sesion';
import { espacio, fuente, useTema } from '../../src/ui/tema';

export default function PantallaCiudad() {
  const tema = useTema();
  const sesion = useSesion();
  const actual = sesion.perfil?.ciudad;
  const [elegida, setElegida] = useState<Ciudad | null>(
    actual ? (CIUDADES.find((c) => c.nombre === actual.nombre && c.estado === actual.estado) ?? { ...actual }) : null,
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: espacio.lg, gap: espacio.lg }}>
        <Text style={{ fontFamily: fuente.cuerpo, fontSize: 14.5, lineHeight: 20, color: tema.textoSuave }}>
          De aquí sale el clima de tus plantas: la lluvia, el calor y las heladas. Las plantas que ya tienes lo toman
          también, salvo las que tengan su propia ubicación.
        </Text>
        <SelectorCiudad
          elegida={elegida}
          onElegir={async (c) => {
            setElegida(c);
            await sesion.actualizar({ ciudad: { ...c } });
            setTimeout(() => router.back(), 250);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

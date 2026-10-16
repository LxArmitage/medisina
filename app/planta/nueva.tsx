import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ZONAS_CLIMATICAS } from '../../src/datos/clima';
import { guardarPlanta, nuevoId } from '../../src/datos/db';
import { buscarEspecie, filtrarEspecies } from '../../src/dominio/catalogo';
import { capitalizar as capitalizarNombre } from '../../src/dominio/nombres';
import { etiquetaBanda } from '../../src/dominio/compatibilidad';
import { BANDAS_LUZ } from '../../src/dominio/tipos';
import type { BandaLuz, MaterialMaceta } from '../../src/dominio/tipos';
import { Boton, Seccion, Tarjeta, estilosTexto } from '../../src/ui/componentes';
import { espacio, radio, useTema } from '../../src/ui/tema';

const MATERIALES: MaterialMaceta[] = ['plastico', 'barro', 'ceramica', 'tela', 'metal'];

export default function PantallaNuevaPlanta() {
  const tema = useTema();
  const textos = estilosTexto(tema);

  // Desde la ficha de una especie ("Tengo una") llega ya elegida.
  const { especie: especieDeFicha } = useLocalSearchParams<{ especie?: string }>();
  const deFicha = especieDeFicha ? buscarEspecie(especieDeFicha) : undefined;
  const [apodo, setApodo] = useState(() => (deFicha ? capitalizarNombre(deFicha.nombresComunes[0]) : ''));
  const [busqueda, setBusqueda] = useState(() => deFicha?.nombresComunes[0] ?? '');
  const [especieId, setEspecieId] = useState<string | null>(deFicha?.id ?? null);
  const [exposicion, setExposicion] = useState<BandaLuz>(deFicha?.bandasToleradas[0] ?? 'semisol');
  const [techado, setTechado] = useState(false);
  const [interior, setInterior] = useState(false);
  const [recipiente, setRecipiente] = useState<'maceta' | 'suelo' | 'agua'>('maceta');
  const [volumen, setVolumen] = useState('3');
  const [material, setMaterial] = useState<MaterialMaceta>('plastico');
  const [tieneDrenaje, setTieneDrenaje] = useState(true);
  const [zona, setZona] = useState('BSh');
  const [mesesTeniendola, setMesesTeniendola] = useState('0');
  const [guardando, setGuardando] = useState(false);

  const especies = useMemo(() => filtrarEspecies(busqueda), [busqueda]);
  const puedeGuardar = apodo.trim().length > 0 && especieId !== null;

  async function guardar() {
    if (!puedeGuardar || guardando) return;
    setGuardando(true);

    const meses = Number(mesesTeniendola) || 0;
    const fechaAdquisicion = new Date(Date.now() - meses * 30.44 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const id = nuevoId();
    await guardarPlanta({
      id,
      apodo: apodo.trim(),
      especieId: especieId as string,
      fechaAdquisicion,
      ubicacion: { exposicion, techado: interior ? true : techado, interior, zonaClimatica: zona },
      contenedor:
        recipiente === 'maceta'
          ? { tipo: 'maceta', volumenL: Number(volumen) || 3, material, tieneDrenaje }
          : { tipo: recipiente, tieneDrenaje: true },
      creadaEn: new Date().toISOString(),
    });

    // Al expediente de la planta recién creada, no atrás: se ve nacer su gemelo
    // y, si se llegó aquí por enlace directo, no queda a dónde volver.
    router.replace({ pathname: '/planta/[id]', params: { id, naciendo: '1' } });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tema.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: espacio.lg, gap: espacio.xl, paddingBottom: 60 }}>
        <Seccion titulo="Cómo le dices">
          <Campo
            valor={apodo}
            onChange={setApodo}
            placeholder="Doña Sina, El Helechón, Verdoso…"
          />
          <Text style={textos.suave}>
            Ponerle nombre no es un adorno: una planta con nombre no se abandona.
          </Text>
        </Seccion>

        <Seccion titulo="Qué es">
          <Campo valor={busqueda} onChange={setBusqueda} placeholder="Buscar especie…" />
          <View style={{ gap: espacio.sm }}>
            {especies.slice(0, 8).map((especie) => {
              const activa = especie.id === especieId;
              return (
                <Pressable
                  key={especie.id}
                  onPress={() => setEspecieId(especie.id)}
                  style={{
                    backgroundColor: activa ? tema.primarioSuave : tema.superficie,
                    borderColor: activa ? tema.primario : tema.borde,
                    borderWidth: 1,
                    borderRadius: radio.md,
                    padding: espacio.md,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontWeight: '600', color: tema.texto }}>
                    {especie.nombresComunes[0]}
                  </Text>
                  <Text style={{ fontSize: 12, color: tema.textoSuave, fontStyle: 'italic' }}>
                    {especie.nombreCientifico}
                  </Text>
                </Pressable>
              );
            })}
            {especies.length === 0 && (
              <Text style={textos.suave}>
                No está en el catálogo semilla. En Fase 2 esto lo resuelve la identificación por
                foto.
              </Text>
            )}
          </View>
        </Seccion>

        <Seccion titulo="Dónde vive">
          <Opciones
            valores={BANDAS_LUZ as readonly BandaLuz[]}
            seleccionado={exposicion}
            etiqueta={etiquetaBanda}
            onSelect={setExposicion}
          />
          <Interruptor
            titulo="Está en interior"
            descripcion="Nunca le llega la lluvia ni el sol directo."
            valor={interior}
            onChange={(v) => {
              setInterior(v);
              if (v) setTechado(true);
            }}
          />
          {!interior && (
            <Interruptor
              titulo="Está bajo techo"
              descripcion="Porche, pasillo o alero: la lluvia no la moja aunque llueva."
              valor={techado}
              onChange={setTechado}
            />
          )}
        </Seccion>

        <Seccion titulo="En qué está">
          <Opciones
            valores={['maceta', 'suelo', 'agua'] as const}
            seleccionado={recipiente}
            etiqueta={(v) =>
              v === 'maceta' ? 'En maceta' : v === 'suelo' ? 'En tierra' : 'En agua'
            }
            onSelect={setRecipiente}
          />
          {recipiente === 'agua' && (
            <Text style={textos.suave}>
              Un esqueje en frasco no se riega: se le cambia el agua. La app lo cuida distinto.
            </Text>
          )}
          {recipiente === 'maceta' && (
            <>
              <View style={{ gap: espacio.sm }}>
                <Text style={textos.suave}>Litros de la maceta</Text>
                <Campo valor={volumen} onChange={setVolumen} teclado="numeric" placeholder="3" />
              </View>
              <Opciones
                valores={MATERIALES}
                seleccionado={material}
                etiqueta={(m) => m}
                onSelect={setMaterial}
              />
              <Interruptor
                titulo="Tiene agujero de drenaje"
                descripcion="Sin drenaje, el agua sobrante se queda y pudre la raíz."
                valor={tieneDrenaje}
                onChange={setTieneDrenaje}
              />
            </>
          )}
        </Seccion>

        <Seccion titulo="Tu clima">
          <View style={{ gap: espacio.sm }}>
            {ZONAS_CLIMATICAS.map((z) => {
              const activa = z.codigo === zona;
              return (
                <Pressable
                  key={z.codigo}
                  onPress={() => setZona(z.codigo)}
                  style={{
                    backgroundColor: activa ? tema.primarioSuave : tema.superficie,
                    borderColor: activa ? tema.primario : tema.borde,
                    borderWidth: 1,
                    borderRadius: radio.md,
                    padding: espacio.md,
                  }}
                >
                  <Text style={{ fontSize: 13, color: tema.texto }}>{z.etiqueta}</Text>
                </Pressable>
              );
            })}
          </View>
        </Seccion>

        <Seccion titulo="Desde cuándo la tienes">
          <Campo
            valor={mesesTeniendola}
            onChange={setMesesTeniendola}
            teclado="numeric"
            placeholder="Meses (0 si acaba de llegar)"
          />
        </Seccion>

        <Boton
          titulo={guardando ? 'Guardando…' : 'Abrir expediente'}
          onPress={guardar}
          deshabilitado={!puedeGuardar || guardando}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------

function Campo({
  valor,
  onChange,
  placeholder,
  teclado,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  teclado?: 'numeric';
}) {
  const tema = useTema();
  return (
    <TextInput
      value={valor}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={tema.textoSuave}
      keyboardType={teclado === 'numeric' ? 'number-pad' : 'default'}
      style={{
        backgroundColor: tema.superficie,
        borderColor: tema.borde,
        borderWidth: 1,
        borderRadius: radio.md,
        paddingHorizontal: espacio.md,
        paddingVertical: espacio.md,
        fontSize: 15,
        color: tema.texto,
      }}
    />
  );
}

function Opciones<T extends string>({
  valores,
  seleccionado,
  etiqueta,
  onSelect,
}: {
  valores: readonly T[];
  seleccionado: T;
  etiqueta: (v: T) => string;
  onSelect: (v: T) => void;
}) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm }}>
      {valores.map((valor) => {
        const activo = valor === seleccionado;
        return (
          <Pressable
            key={valor}
            onPress={() => onSelect(valor)}
            style={{
              backgroundColor: activo ? tema.primario : tema.superficie,
              borderColor: activo ? tema.primario : tema.borde,
              borderWidth: 1,
              borderRadius: radio.completo,
              paddingHorizontal: espacio.md,
              paddingVertical: espacio.sm,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: activo ? '#fff' : tema.texto,
              }}
            >
              {etiqueta(valor)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Interruptor({
  titulo,
  descripcion,
  valor,
  onChange,
}: {
  titulo: string;
  descripcion: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  const tema = useTema();
  return (
    <Tarjeta onPress={() => onChange(!valor)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '600', color: tema.texto }}>{titulo}</Text>
          <Text style={{ fontSize: 12, color: tema.textoSuave, lineHeight: 17 }}>
            {descripcion}
          </Text>
        </View>
        <View
          style={{
            width: 46,
            height: 28,
            borderRadius: radio.completo,
            backgroundColor: valor ? tema.primario : tema.superficieAlta,
            padding: 3,
            justifyContent: 'center',
            alignItems: valor ? 'flex-end' : 'flex-start',
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radio.completo,
              backgroundColor: '#fff',
            }}
          />
        </View>
      </View>
    </Tarjeta>
  );
}

/**
 * Una frontera de error que CUENTA lo que pasó.
 *
 * Existe por un caso concreto: se reportó desde un iPhone que tocar el dibujo
 * de una planta tumbaba la pantalla. En el navegador no se reproducía, y las
 * pruebas del dominio y de la geometría —que barren todas las especies, en
 * todos los estados, a varias edades— salían limpias. O sea que el fallo vive
 * en la capa nativa de dibujo, donde desde aquí no se puede mirar.
 *
 * La reacción fácil sería envolver todo en un try/catch y enseñar "algo salió
 * mal". Eso convierte un fallo reproducible en uno invisible, y quien lo sufre
 * se queda sin nada que contar. Esto hace lo contrario: atrapa, sigue de pie, y
 * PONE EL ERROR EN LA PANTALLA para que la persona pueda leerlo tal cual. Un
 * mensaje que se puede copiar vale más que diez intentos a ciegas.
 *
 * Es una clase porque `componentDidCatch` no tiene equivalente en hooks. No hay
 * más remedio, y React lo documenta así.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export interface FronteraProps {
  children: ReactNode;
  /** Qué se estaba dibujando. Sale en el mensaje para ubicar el fallo. */
  zona: string;
  /**
   * Qué enseñar en lugar del contenido. Si no se da, se enseña el panel con el
   * error. Sirve para partes que tienen un respaldo bueno —el 3D cae al dibujo—
   * frente a las que no tienen ninguno.
   */
  respaldo?: (detalle: string, reintentar: () => void) => ReactNode;
  /** Colores de la app. Se pasan porque una clase no puede usar hooks. */
  tema: { texto: string; textoSuave: string; superficie: string; borde: string; critico: string };
}

interface Estado {
  detalle: string | null;
}

export class Frontera extends Component<FronteraProps, Estado> {
  state: Estado = { detalle: null };

  static getDerivedStateFromError(error: unknown): Estado {
    return { detalle: describir(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // A la consola también, que es donde lo ve quien tenga el Metro abierto.
    // El componentStack dice en qué componente reventó, que es justo lo que no
    // se sabe cuando sólo se tiene el mensaje.
    console.error(`[${this.props.zona}] ${describir(error)}`, info.componentStack);
  }

  reintentar = (): void => {
    this.setState({ detalle: null });
  };

  render(): ReactNode {
    const { detalle } = this.state;
    if (detalle === null) return this.props.children;
    if (this.props.respaldo) return this.props.respaldo(detalle, this.reintentar);

    return <Panel zona={this.props.zona} detalle={detalle} tema={this.props.tema} alReintentar={this.reintentar} />;
  }
}

function Panel({
  zona,
  detalle,
  tema,
  alReintentar,
}: {
  zona: string;
  detalle: string;
  tema: FronteraProps['tema'];
  alReintentar: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: tema.superficie,
        borderColor: tema.borde,
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}
    >
      <Text style={{ color: tema.critico, fontSize: 13, fontWeight: '700' }}>
        Aquí falló algo: {zona}
      </Text>
      <Text style={{ color: tema.textoSuave, fontSize: 13, lineHeight: 19 }}>
        El resto de la ficha sigue funcionando. Si puedes, copia estas líneas y
        pásalas — con ellas se arregla de una:
      </Text>
      <ScrollView
        horizontal
        style={{
          backgroundColor: tema.borde,
          borderRadius: 10,
          maxHeight: 120,
        }}
        contentContainerStyle={{ padding: 10 }}
      >
        <Text selectable style={{ color: tema.texto, fontSize: 12 }}>
          {detalle}
        </Text>
      </ScrollView>
      <Pressable
        onPress={alReintentar}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: tema.borde,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text style={{ color: tema.texto, fontSize: 13 }}>Intentar de nuevo</Text>
      </Pressable>
    </View>
  );
}

/**
 * De un error a algo que se pueda leer en voz alta por teléfono.
 *
 * Se incluye la primera línea de la pila porque es la que dice el archivo, y
 * sin ella el mensaje suele ser tan genérico que no ubica nada.
 */
function describir(error: unknown): string {
  if (error instanceof Error) {
    const donde = (error.stack ?? '').split('\n')[1]?.trim();
    return donde ? `${error.name}: ${error.message}\n${donde}` : `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

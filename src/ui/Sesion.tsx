/**
 * La sesión: quién entró, si la app está bloqueada y cómo salir.
 *
 * Vive arriba de toda la navegación (`app/_layout.tsx`): las pantallas de
 * plantas sólo existen con la sesión abierta, y las de bienvenida sólo sin
 * ella. Cambiar de una a otra es cambiar este estado; el router hace el resto.
 *
 * BLOQUEO. Si la persona pidió Face ID, la app se bloquea al abrirla y al
 * volver después de un rato en segundo plano, como las apps de banco. Se
 * desbloquea con Face ID o con el código del teléfono.
 */

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Perfil } from '../dominio/cuenta';
import {
  borrarCuentaYDatos,
  cerrarSesion,
  desbloqueoDisponible,
  guardarPerfil,
  identificarDueno,
  leerPerfil,
  nombreDesbloqueo,
  sesionAbierta,
} from '../servicios/cuenta';
import type { TipoDesbloqueo } from '../servicios/cuenta';

/** Cuánto puede estar la app en segundo plano sin volver a pedir Face ID. */
const GRACIA_MS = 60_000;

export interface Sesion {
  cargando: boolean;
  perfil: Perfil | null;
  abierta: boolean;
  bloqueada: boolean;
  /** Qué tiene el teléfono para identificar a su dueño (Face ID, huella, código). */
  desbloqueo: TipoDesbloqueo;
  nombreDesbloqueo: string;
  /** Después de crear la cuenta o entrar: la sesión queda abierta. */
  entrar: (perfil: Perfil) => void;
  salir: () => Promise<void>;
  actualizar: (cambios: Partial<Perfil>) => Promise<void>;
  desbloquear: () => Promise<boolean>;
  borrarTodo: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const [desbloqueo, setDesbloqueo] = useState<TipoDesbloqueo>(null);
  const enFondoDesde = useRef<number | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const [p, a, tipo] = await Promise.all([
        leerPerfil().catch(() => null),
        sesionAbierta().catch(() => false),
        desbloqueoDisponible(),
      ]);
      if (!vigente) return;
      setPerfil(p);
      setAbierta(a && p !== null);
      setDesbloqueo(tipo);
      setBloqueada(a && p !== null && p.desbloqueo && tipo !== null);
      setCargando(false);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  // Volver a bloquear después de un rato fuera.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'background') enFondoDesde.current = Date.now();
      if (estado === 'active' && enFondoDesde.current !== null) {
        const fuera = Date.now() - enFondoDesde.current;
        enFondoDesde.current = null;
        if (abierta && perfil?.desbloqueo && desbloqueo !== null && fuera > GRACIA_MS) setBloqueada(true);
      }
    });
    return () => sub.remove();
  }, [abierta, perfil, desbloqueo]);

  const entrar = useCallback((p: Perfil) => {
    setPerfil(p);
    setBloqueada(false);
    setAbierta(true);
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesion();
    setAbierta(false);
    setBloqueada(false);
  }, []);

  const actualizar = useCallback(
    async (cambios: Partial<Perfil>) => {
      if (!perfil) return;
      const nuevo = { ...perfil, ...cambios };
      await guardarPerfil(nuevo);
      setPerfil(nuevo);
    },
    [perfil],
  );

  const desbloquear = useCallback(async () => {
    const ok = await identificarDueno('Abrir MEDISINA');
    if (ok) setBloqueada(false);
    return ok;
  }, []);

  const borrarTodo = useCallback(async () => {
    await borrarCuentaYDatos();
    setPerfil(null);
    setAbierta(false);
    setBloqueada(false);
  }, []);

  const valor = useMemo<Sesion>(
    () => ({
      cargando,
      perfil,
      abierta,
      bloqueada,
      desbloqueo,
      nombreDesbloqueo: nombreDesbloqueo(desbloqueo),
      entrar,
      salir,
      actualizar,
      desbloquear,
      borrarTodo,
    }),
    [cargando, perfil, abierta, bloqueada, desbloqueo, entrar, salir, actualizar, desbloquear, borrarTodo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion va dentro de <ProveedorSesion>');
  return s;
}

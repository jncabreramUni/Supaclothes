import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiUrl, request, type ApiRequest, type RequestOptions } from '../api/client';
import { logIn } from '../api/operations';
import type { AuthLoginRequest, AuthResponse, Role } from '../types/api';

type Session = AuthResponse & { username: string; origin: string };
const sessionKey = 'supaclothes.session';
const roles: Role[] = ['ADMIN', 'VENDEDOR', 'BODEGA'];

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  api: ApiRequest;
  signIn: (credentials: AuthLoginRequest, admin: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const current = useRef<Session | null>(null);
  const storageWrites = useRef(Promise.resolve());

  const writeSession = useCallback((next: Session | null) => {
    const write = storageWrites.current.catch(() => undefined).then(() => next
      ? SecureStore.setItemAsync(sessionKey, JSON.stringify(next))
      : SecureStore.deleteItemAsync(sessionKey));
    storageWrites.current = write;
    return write;
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const stored = await SecureStore.getItemAsync(sessionKey);
        if (!stored || !active) return;
        const saved: Session = JSON.parse(stored);
        if (saved.origin !== apiUrl || !roles.includes(saved.role) || !saved.token || !saved.username) return;
        current.current = saved;
        setSession(saved);
      } catch {
        // The login screen remains available if local storage cannot be read.
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => { active = false; };
  }, []);

  const invalidate = useCallback((expected: Session) => {
    if (current.current !== expected) return Promise.resolve();
    current.current = null;
    setSession(null);
    return writeSession(null);
  }, [writeSession]);

  const api: ApiRequest = useCallback(async <T,>(path: string, options?: RequestOptions) => {
    const signedIn = current.current;
    if (!signedIn) throw new ApiError(401, 'Inicia sesión para continuar.');
    try {
      return await request<T>(path, options, signedIn.token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (path !== '/products') {
        // Spring can return 401 from its error dispatch even while the JWT is valid.
        try {
          await request('/products', { signal: options?.signal }, signedIn.token);
        } catch (verificationError) {
          if (verificationError instanceof ApiError && verificationError.status === 401) {
            await invalidate(signedIn).catch(() => undefined);
          }
          throw verificationError;
        }
        throw new ApiError(403, 'SupaClothes rechazó la operación. Revisa los datos o los permisos de tu cuenta.');
      }
      await invalidate(signedIn).catch(() => undefined);
      throw error;
    }
  }, [invalidate]);

  async function signIn(credentials: AuthLoginRequest, admin: boolean) {
    const result = await logIn(credentials, admin);
    if (!roles.includes(result.role) || !result.token) {
      throw new Error('La API no devolvió una sesión válida para SupaClothes.');
    }
    const next = { ...result, username: credentials.username, origin: apiUrl };
    await writeSession(next);
    current.current = next;
    setSession(next);
  }

  async function signOut() {
    const signedIn = current.current;
    if (!signedIn) return;
    try {
      await request<void>('/auth/logout', { method: 'POST' }, signedIn.token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    await invalidate(signedIn);
  }

  return (
    <SessionContext.Provider value={{ session, loading, api, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider es obligatorio.');
  return value;
}

import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean; // true tills vi vet om användaren är inloggad
  error: string | null;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  error: null,
});

// Delas mellan anrop så att två samtidiga anrop inte skapar två anonyma användare
let signingIn: ReturnType<typeof supabase.auth.signInAnonymously> | null = null;

/** Loggar in anonymt om det inte redan finns en sparad inloggning. Returnerar ett felmeddelande eller null. */
async function ensureSignedIn(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return null;

  signingIn ??= supabase.auth.signInAnonymously();
  const { error } = await signingIn;
  signingIn = null;
  return error?.message ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Håller sessionen uppdaterad: inloggning, utloggning och förnyade inloggningar
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    ensureSignedIn().then((message) => {
      if (message) {
        console.warn('Anonym inloggning misslyckades:', message);
        setError(message);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

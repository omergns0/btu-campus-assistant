import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, translateAuthError } from '../services/supabaseClient';

const AuthContext = createContext(null);

// { error } yerine Türkçe hata metni döndüren küçük sarmalayıcı
async function run(promise) {
  const { data, error } = await promise;
  return { data, error: error ? translateAuthError(error) : null, rawError: error };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    signIn: (email, password) => run(supabase.auth.signInWithPassword({ email, password })),
    signUp: (name, email, password) => run(supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })),
    verifySignup: (email, token) => run(supabase.auth.verifyOtp({ email, token, type: 'signup' })),
    resendSignup: email => run(supabase.auth.resend({ type: 'signup', email })),
    sendReset: email => run(supabase.auth.resetPasswordForEmail(email)),
    recover: async (email, token, password) => {
      const v = await run(supabase.auth.verifyOtp({ email, token, type: 'recovery' }));
      if (v.error) return v;
      return run(supabase.auth.updateUser({ password }));
    },
    signOut: () => supabase.auth.signOut(),
  }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}

export function displayName(user) {
  return (user?.user_metadata?.full_name || '').trim() || (user?.email || '').split('@')[0];
}

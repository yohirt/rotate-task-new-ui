import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      signInWithPassword: ({ email, password }) => {
        if (!supabase) {
          return Promise.resolve({
            error: new Error("Supabase is not configured"),
          });
        }

        return supabase.auth.signInWithPassword({ email, password });
      },
      signUpWithPassword: ({ email, password }) => {
        if (!supabase) {
          return Promise.resolve({
            error: new Error("Supabase is not configured"),
          });
        }

        return supabase.auth.signUp({ email, password });
      },
      signOut: () => {
        if (!supabase) {
          return Promise.resolve({ error: null });
        }

        return supabase.auth.signOut();
      },
    }),
    [isLoading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

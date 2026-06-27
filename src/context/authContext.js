import { createContext } from "react";

export const AuthContext = createContext({
  isConfigured: false,
  isLoading: false,
  session: null,
  user: null,
  signInWithPassword: async () => ({
    error: new Error("Supabase is not configured"),
  }),
  signUpWithPassword: async () => ({
    error: new Error("Supabase is not configured"),
  }),
  signOut: async () => ({ error: null }),
});

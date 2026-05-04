import { createContext, useContext, useEffect, useState } from 'react';
export { supabase } from '../config/supabase';
import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

async function fetchProfile(token) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('profile fetch failed');
  const json = await res.json();
  return json.data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // Supabase auth user
  const [profile, setProfile] = useState(null); // users table row (name, role, etc.)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          try {
            const p = await fetchProfile(session.access_token);
            setProfile(p);
          } catch { setProfile(null); }
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      // TOKEN_REFRESHED and other events: do nothing — profile hasn't changed

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

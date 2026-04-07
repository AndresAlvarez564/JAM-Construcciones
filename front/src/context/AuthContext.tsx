import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Usuario } from '../types';
import { getMe, logout as amplifyLogout } from '../services/auth.service';

interface AuthContextType {
  usuario: Usuario | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsuario = async () => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      const data = await getMe();
      setUsuario(data);
    } catch {
      setUsuario(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuario(); }, []);

  return (
    <AuthContext.Provider value={{ usuario, loading, refetch: fetchUsuario, logout: amplifyLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
};

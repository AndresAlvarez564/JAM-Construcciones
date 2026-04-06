import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Usuario } from '../types';
import { getMe, logout } from '../services/auth.service';

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
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    try {
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
    <AuthContext.Provider value={{ usuario, loading, refetch: fetchUsuario, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext debe usarse dentro de AuthProvider');
  return ctx;
};

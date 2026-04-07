import { signIn, signOut } from 'aws-amplify/auth';
import { apiGet } from './api';
import type { Usuario } from '../types';

export const login = async (username: string, password: string) => {
  try { await signOut(); } catch { /* sin sesión previa, ignorar */ }
  await signIn({ username, password, options: { authFlowType: 'USER_PASSWORD_AUTH' } });
};

export const logout = async () => {
  await signOut();
  window.location.href = '/login';
};

export const getMe = async (): Promise<Usuario> => {
  return apiGet<Usuario>('/auth/me');
};

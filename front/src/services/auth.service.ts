import api from './api';
import { LoginPayload, LoginResponse, Usuario } from '../types';

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/auth/login', payload);
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('id_token', data.id_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  return data;
};

export const getMe = async (): Promise<Usuario> => {
  const { data } = await api.get<Usuario>('/auth/me');
  return data;
};

export const logout = () => {
  localStorage.clear();
  window.location.href = '/login';
};

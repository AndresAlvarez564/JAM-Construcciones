import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { Bloqueo, HistorialBloqueo } from '../types';

export const bloquearUnidad = (data: {
  proyecto_id: string;
  unidad_id: string;
}): Promise<Bloqueo> => apiPost<Bloqueo>('/bloqueos', data);

export const getBloquesActivos = (): Promise<Bloqueo[]> =>
  apiGet<Bloqueo[]>('/bloqueos/activos');

export interface HistorialResponse {
  items: HistorialBloqueo[];
  next_token?: string;
}

export const getHistorialBloqueos = (unidadId?: string, nextToken?: string): Promise<HistorialResponse> => {
  const params = new URLSearchParams();
  if (unidadId) params.set('unidad_id', unidadId);
  if (nextToken) params.set('next_token', nextToken);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiGet<HistorialResponse>(`/admin/bloqueos/historial${qs}`);
};

export const liberarBloqueo = (unidadId: string, proyectoId: string): Promise<{ message: string }> =>
  apiDelete(`/admin/bloqueos/${unidadId}?proyecto_id=${proyectoId}`);

export const extenderBloqueo = (
  unidadId: string,
  proyectoId: string,
  data: { horas_extra: number; justificacion: string }
): Promise<{ message: string; nueva_fecha_liberacion: string }> =>
  apiPut(`/admin/bloqueos/${unidadId}/extender?proyecto_id=${proyectoId}`, data);

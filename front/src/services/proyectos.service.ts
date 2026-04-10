import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { Proyecto, Unidad, Etapa, Torre } from '../types';

// Proyectos
export const getProyectos = (): Promise<Proyecto[]> =>
  apiGet<Proyecto[]>('/proyectos');

export const getProyecto = (proyectoId: string): Promise<Proyecto> =>
  apiGet<Proyecto>(`/proyectos/${proyectoId}`);

export const crearProyecto = (data: { nombre: string; descripcion?: string }): Promise<Proyecto> =>
  apiPost<Proyecto>('/admin/proyectos', data);

export const actualizarProyecto = (proyectoId: string, data: { nombre?: string; descripcion?: string; imagen_url?: string }): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}`, data);

export const eliminarProyecto = (proyectoId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}`);

export const getPresignedImagenProyecto = (proyectoId: string): Promise<{ upload_url: string; public_url: string; key: string }> =>
  apiPost(`/admin/proyectos/${proyectoId}/imagen`, {});

// Etapas
export const getEtapas = (proyectoId: string): Promise<Etapa[]> =>
  apiGet<Etapa[]>(`/proyectos/${proyectoId}/etapas`);

export const crearEtapa = (proyectoId: string, data: { nombre: string; orden?: number }): Promise<Etapa> =>
  apiPost<Etapa>(`/admin/proyectos/${proyectoId}/etapas`, data);

export const actualizarEtapa = (proyectoId: string, etapaId: string, data: { nombre?: string; orden?: number }): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}/etapas/${etapaId}`, data);

export const eliminarEtapa = (proyectoId: string, etapaId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}/etapas/${etapaId}`);

// Torres
export const getTorres = (proyectoId: string): Promise<Torre[]> =>
  apiGet<Torre[]>(`/proyectos/${proyectoId}/torres`);

export const crearTorre = (proyectoId: string, data: { nombre: string; etapa_id: string; orden?: number }): Promise<Torre> =>
  apiPost<Torre>(`/admin/proyectos/${proyectoId}/torres`, data);

export const actualizarTorre = (proyectoId: string, torreId: string, data: { nombre?: string; orden?: number }): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}/torres/${torreId}`, data);

export const eliminarTorre = (proyectoId: string, torreId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}/torres/${torreId}`);

// Unidades
export const getUnidades = (
  proyectoId: string,
  filtros?: { estado?: string; torre_id?: string; etapa_id?: string }
): Promise<Unidad[]> => {
  const params = new URLSearchParams();
  if (filtros?.estado) params.append('estado', filtros.estado);
  if (filtros?.torre_id) params.append('torre_id', filtros.torre_id);
  if (filtros?.etapa_id) params.append('etapa_id', filtros.etapa_id);
  const qs = params.toString();
  return apiGet<Unidad[]>(`/proyectos/${proyectoId}/unidades${qs ? `?${qs}` : ''}`);
};

export const getUnidad = (proyectoId: string, unidadId: string): Promise<Unidad> =>
  apiGet<Unidad>(`/proyectos/${proyectoId}/unidades/${unidadId}`);

export const crearUnidad = (
  proyectoId: string,
  data: { id_unidad: string; etapa_id: string; torre_id: string; metraje: number; precio: number }
): Promise<Unidad> =>
  apiPost<Unidad>(`/admin/proyectos/${proyectoId}/unidades`, data);

export const actualizarUnidad = (
  proyectoId: string,
  unidadId: string,
  data: { id_unidad?: string; metraje?: number; precio?: number }
): Promise<void> =>
  apiPut(`/admin/proyectos/${proyectoId}/unidades/${unidadId}`, data);

export const eliminarUnidad = (proyectoId: string, unidadId: string): Promise<void> =>
  apiDelete(`/admin/proyectos/${proyectoId}/unidades/${unidadId}`);

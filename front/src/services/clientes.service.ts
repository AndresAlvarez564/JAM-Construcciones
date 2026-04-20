import { apiGet, apiPost, apiPut } from './api';
import type { Cliente } from '../types';

export interface RegistrarClientePayload {
  cedula: string;
  proyecto_id: string;
  nombres: string;
  apellidos: string;
  correo?: string;
  telefono?: string;
  estado_civil?: string;
  nacionalidad?: string;
  pais_residencia?: string;
  fecha_nacimiento?: string;
  unidad_id?: string;
}

export const buscarClientePorCedula = (cedula: string, proyectoId?: string): Promise<Cliente | Cliente[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Cliente | Cliente[]>(`/clientes/${encodeURIComponent(cedula)}${qs}`);
};

export const registrarCliente = (data: RegistrarClientePayload): Promise<Cliente> =>
  apiPost<Cliente>('/clientes', data);

export const getClientes = (proyectoId?: string): Promise<Cliente[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Cliente[]>(`/clientes${qs}`);
};

export const getClientesAdmin = (params?: { proyecto_id?: string; inmobiliaria_id?: string; next_token?: string; limit?: number }): Promise<{ items: Cliente[]; next_token?: string }> => {
  const qs = params ? '?' + new URLSearchParams(
    Object.entries({ ...params, limit: params.limit?.toString() ?? '50' })
      .filter(([, v]) => v) as [string, string][]
  ).toString() : '';
  return apiGet<{ items: Cliente[]; next_token?: string }>(`/admin/clientes${qs}`);
};

export const buscarClienteAdmin = (cedula: string): Promise<(Cliente & { procesos: any[] })[]> =>
  apiGet(`/admin/clientes/buscar?cedula=${encodeURIComponent(cedula)}`);

export const actualizarClienteAdmin = (
  cedula: string,
  proyectoId: string,
  inmobiliariaId: string,
  data: Partial<RegistrarClientePayload & { estado: string }>
): Promise<{ message: string }> =>
  apiPut(`/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}`, data);

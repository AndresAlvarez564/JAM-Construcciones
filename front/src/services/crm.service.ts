import { apiGet, apiPut } from './api';
import type { Proceso } from '../types';

export interface CambiarEstatusPayload {
  estatus: string;
  inmobiliaria_id: string;
  notificar: boolean;
}

export const getProcesosCliente = (cedula: string, inmobiliariaId?: string): Promise<Proceso[]> => {
  const qs = inmobiliariaId ? `?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}` : '';
  return apiGet<Proceso[]>(`/admin/clientes/${encodeURIComponent(cedula)}/procesos${qs}`);
};

export const getMisProcesos = (proyectoId?: string): Promise<Proceso[]> => {
  const qs = proyectoId ? `?proyecto_id=${proyectoId}` : '';
  return apiGet<Proceso[]>(`/mis-procesos${qs}`);
};

// Endpoint deshabilitado en backend — procesos se crean exclusivamente desde el flujo de bloqueo
// export const crearProceso = ...

export const cambiarEstatus = (
  cedula: string,
  proyectoId: string,
  unidadId: string,
  data: CambiarEstatusPayload
): Promise<{ message: string; estatus: string }> =>
  apiPut(
    `/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}/unidad/${encodeURIComponent(unidadId)}/estatus`,
    data
  );

export const getHistorialProceso = (
  cedula: string,
  proyectoId: string,
  unidadId: string,
  inmobiliariaId: string
): Promise<Proceso['historial']> =>
  apiGet(
    `/admin/clientes/${encodeURIComponent(cedula)}/proyecto/${encodeURIComponent(proyectoId)}/unidad/${encodeURIComponent(unidadId)}/historial?inmobiliaria_id=${encodeURIComponent(inmobiliariaId)}`
  );

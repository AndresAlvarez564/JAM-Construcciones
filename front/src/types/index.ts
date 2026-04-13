export type Rol = 'admin' | 'coordinador' | 'supervisor' | 'inmobiliaria';
export type RolInterno = 'admin' | 'coordinador' | 'supervisor';

export interface Usuario {
  sub: string;
  nombre: string;
  rol: Rol;
  inmobiliaria_id?: string;
  inmobiliaria_nombre?: string;
  proyectos?: string[];
  activo: boolean;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface Proyecto {
  pk: string;
  proyecto_id: string;
  nombre: string;
  descripcion?: string;
  imagen_url?: string;
  activo: boolean;
  creado_en: string;
}

export interface Etapa {
  pk: string;
  sk: string;
  etapa_id: string;
  nombre: string;
  orden: number;
  activo: boolean;
  creado_en: string;
}

export interface Torre {
  pk: string;
  sk: string;
  torre_id: string;
  nombre: string;
  etapa_id: string;
  orden: number;
  activo: boolean;
  creado_en: string;
}

export interface Unidad {
  pk: string;
  sk: string;
  unidad_id: string;
  id_unidad: string;
  etapa_id: string;
  torre_id: string;
  metraje: number;
  precio: number;
  estado: string;
  bloqueado_por?: string;
  fecha_bloqueo?: string;
  fecha_liberacion?: string;
  tiempo_restante?: number;
  creado_en: string;
  actualizado_en: string;
}

export interface HistorialBloqueo {
  pk: string;
  sk: string;
  unidad_id: string;
  proyecto_id: string;
  inmobiliaria_id: string;
  fecha_bloqueo: string;
  fecha_liberacion: string;
  motivo_liberacion?: string;
  liberado_por?: string;
}

export interface Bloqueo {
  pk: string;
  sk: string;
  unidad_id: string;
  id_unidad?: string;
  proyecto_id: string;
  bloqueado_por: string;
  fecha_bloqueo: string;
  fecha_liberacion: string;
  tiempo_restante?: number;
  estado: string;
}

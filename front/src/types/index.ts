export type Rol = 'admin' | 'inmobiliaria';

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
  creado_en: string;
  actualizado_en: string;
}

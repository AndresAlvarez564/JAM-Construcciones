export type Rol = 'admin' | 'inmobiliaria';

export interface Usuario {
  sub: string;
  nombre: string;
  rol: Rol;
  inmobiliaria_id?: string;
  inmobiliaria_nombre?: string;
  proyectos: string[];
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

import { useState, useCallback, useEffect } from 'react';
import { message } from 'antd';
import {
  getProyectos, getUnidades, getEtapas,
  crearProyecto, actualizarProyecto,
  crearEtapa, actualizarEtapa, eliminarEtapa,
  crearUnidad, actualizarUnidad, eliminarUnidad,
  getPresignedImagenProyecto,
} from '../services/proyectos.service';
import { getInmobiliarias } from '../services/inmobiliarias.service';
import type { Proyecto, Unidad, Etapa } from '../types';
import type { Inmobiliaria } from '../services/inmobiliarias.service';
import type { UploadFile } from 'antd';
import useAuth from './useAuth';

export type ModalMode = 'crear' | 'editar';
export type Vista = 'proyectos' | 'unidades';

export function useInventario() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';
  const isInmobiliaria = usuario?.rol === 'inmobiliaria';

  const [vista, setVista] = useState<Vista>('proyectos');
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroManzana, setFiltroManzana] = useState('');
  const [filtroPiso, setFiltroPiso] = useState('');

  // Modales
  const [modalProyecto, setModalProyecto] = useState(false);
  const [modoProyecto, setModoProyecto] = useState<ModalMode>('crear');
  const [proyectoEditando, setProyectoEditando] = useState<Proyecto | null>(null);
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);
  const [uploadingImagen, setUploadingImagen] = useState(false);
  const [drawerEtapas, setDrawerEtapas] = useState(false);
  const [etapaEditando, setEtapaEditando] = useState<Etapa | null>(null);
  const [modalUnidad, setModalUnidad] = useState(false);
  const [modoUnidad, setModoUnidad] = useState<ModalMode>('crear');
  const [unidadEditando, setUnidadEditando] = useState<Unidad | null>(null);

  const cargarProyectos = useCallback(async () => {
    try {
      const todos = await getProyectos();
      if (usuario?.rol === 'inmobiliaria' && usuario.proyectos?.length) {
        setProyectos(todos.filter(p => usuario.proyectos!.includes(p.proyecto_id)));
      } else {
        setProyectos(todos);
      }
    } catch { message.error('Error al cargar proyectos'); }
  }, [usuario]);

  const cargarUnidades = useCallback(async (pid?: string) => {
    const id = pid || proyectoId;
    if (!id) return;
    setLoading(true);
    try {
      const data = await getUnidades(id, {
        estado: filtroEstado || undefined,
        etapa_id: filtroEtapa || undefined,
        tipo: filtroTipo || undefined,
        manzana: filtroManzana || undefined,
        piso: filtroPiso || undefined,
      });
      setUnidades(data);
    } catch { message.error('Error al cargar unidades'); }
    finally { setLoading(false); }
  }, [proyectoId, filtroEstado, filtroEtapa, filtroTipo, filtroManzana, filtroPiso]);

  useEffect(() => {
    cargarProyectos();
    if (isAdmin) getInmobiliarias().then(setInmobiliarias).catch(() => {});
  }, [cargarProyectos, isAdmin]);

  const seleccionarProyecto = (id: string) => {
    setProyectoId(id);
    setFiltroEstado(''); setFiltroEtapa(''); setFiltroTipo('');
    setFiltroManzana(''); setFiltroPiso('');
    setVista('unidades');
    getEtapas(id).then(setEtapas).catch(() => {});
    setLoading(true);
    getUnidades(id).then(setUnidades).catch(() => message.error('Error al cargar unidades')).finally(() => setLoading(false));
  };

  const volverAProyectos = () => {
    setVista('proyectos'); setProyectoId(''); setUnidades([]);
  };

  // Proyectos
  const handleGuardarProyecto = async (values: any, archivoImagen?: File) => {
    try {
      setUploadingImagen(true);
      let imagen_url: string | undefined;

      const uploadImagen = async (proyectoId: string) => {
        if (!archivoImagen) return undefined;
        const contentType = archivoImagen.type || 'image/jpeg';
        const { upload_url, public_url } = await getPresignedImagenProyecto(proyectoId, contentType);
        const res = await fetch(upload_url, { method: 'PUT', body: archivoImagen, headers: { 'Content-Type': contentType } });
        if (!res.ok) throw new Error(`Error subiendo imagen a S3: ${res.status} ${res.statusText}`);
        return `${public_url}?t=${Date.now()}`;
      };

      if (modoProyecto === 'crear') {
        const p = await crearProyecto(values);
        imagen_url = await uploadImagen(p.proyecto_id);
        if (imagen_url) await actualizarProyecto(p.proyecto_id, { imagen_url });
        message.success('Proyecto creado');
      } else if (proyectoEditando) {
        imagen_url = await uploadImagen(proyectoEditando.proyecto_id);
        await actualizarProyecto(proyectoEditando.proyecto_id, { ...values, ...(imagen_url ? { imagen_url } : {}) });
        message.success('Proyecto actualizado');
      }
      await cargarProyectos(); setModalProyecto(false); setImagenFile(null);
    } catch (err) {
      console.error('Error al guardar proyecto:', err);
      message.error(err instanceof Error ? err.message : 'Error al guardar proyecto');
    }
    finally { setUploadingImagen(false); }
  };

  // Etapas
  const handleGuardarEtapa = async (values: any) => {
    try {
      if (etapaEditando) {
        await actualizarEtapa(proyectoId, etapaEditando.etapa_id, values);
        message.success('Etapa actualizada');
      } else {
        await crearEtapa(proyectoId, values);
        message.success('Etapa creada');
      }
      setEtapaEditando(null);
      getEtapas(proyectoId).then(setEtapas).catch(() => {});
    } catch { message.error('Error al guardar etapa'); }
  };

  const handleEliminarEtapa = async (etapaId: string) => {
    try {
      await eliminarEtapa(proyectoId, etapaId);
      getEtapas(proyectoId).then(setEtapas).catch(() => {});
    } catch { message.error('Error al eliminar etapa'); }
  };

  // Unidades
  const handleGuardarUnidad = async (values: any) => {
    try {
      if (modoUnidad === 'crear') {
        await crearUnidad(proyectoId, {
          id_unidad: values.id_unidad, etapa_id: values.etapa_id,
          metraje: parseFloat(values.metraje), precio: parseFloat(values.precio),
          tipo: values.tipo, manzana: values.manzana, piso: values.piso,
        });
        message.success('Unidad creada');
      } else if (unidadEditando) {
        await actualizarUnidad(proyectoId, unidadEditando.unidad_id, {
          id_unidad: values.id_unidad, etapa_id: values.etapa_id,
          metraje: parseFloat(values.metraje), precio: parseFloat(values.precio),
          tipo: values.tipo, manzana: values.manzana, piso: values.piso,
        });
        message.success('Unidad actualizada');
      }
      await cargarUnidades(); setModalUnidad(false);
    } catch { message.error('Error al guardar unidad'); }
  };

  const handleEliminarUnidad = async (u: Unidad) => {
    try {
      await eliminarUnidad(proyectoId, u.unidad_id);
      message.success('Unidad eliminada');
      await cargarUnidades();
    } catch (err: any) {
      const body = err?.response?.body;
      let msg = 'Error al eliminar unidad';
      if (body) { try { msg = (typeof body === 'string' ? JSON.parse(body) : body)?.message || msg; } catch { /* ok */ } }
      message.error(msg);
    }
  };

  const inmoNombre = (id: string) => inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}`)?.nombre ?? id;
  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);

  return {
    // Estado
    vista, proyectos, proyectoId, unidades, etapas, inmobiliarias, loading,
    proyectoActual, isAdmin, isInmobiliaria,
    // Filtros
    filtroEstado, setFiltroEstado, filtroEtapa, setFiltroEtapa,
    filtroTipo, setFiltroTipo, filtroManzana, setFiltroManzana, filtroPiso, setFiltroPiso,
    // Modales
    modalProyecto, setModalProyecto, modoProyecto, setModoProyecto,
    proyectoEditando, setProyectoEditando, imagenFile, setImagenFile, uploadingImagen,
    drawerEtapas, setDrawerEtapas, etapaEditando, setEtapaEditando,
    modalUnidad, setModalUnidad, modoUnidad, setModoUnidad, unidadEditando, setUnidadEditando,
    // Handlers
    cargarProyectos, cargarUnidades, seleccionarProyecto, volverAProyectos,
    handleGuardarProyecto, handleGuardarEtapa, handleEliminarEtapa,
    handleGuardarUnidad, handleEliminarUnidad, inmoNombre,
  };
}

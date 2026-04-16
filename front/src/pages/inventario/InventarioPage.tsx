import { useEffect, useState } from 'react';
import {
  Table, Typography, Tag, Button, Modal, Form, Input, message,
  Select, Card, Row, Col, Popconfirm, Drawer, Space, Tooltip, Statistic, Upload, Steps, DatePicker,
} from 'antd';
import {
  PlusOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined, HomeOutlined, ArrowLeftOutlined,
  CheckCircleOutlined, LockOutlined, StopOutlined, DollarOutlined,
  UploadOutlined, ClockCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import {
  getProyectos, getUnidades, crearProyecto, actualizarProyecto, eliminarProyecto,
  getEtapas, crearEtapa, actualizarEtapa, eliminarEtapa,
  getTorres, crearTorre, actualizarTorre, eliminarTorre,
  crearUnidad, actualizarUnidad, eliminarUnidad,
  getPresignedImagenProyecto,
} from '../../services/proyectos.service';
import { bloquearUnidad } from '../../services/bloqueos.service';
import { registrarCliente, buscarClientePorCedula } from '../../services/clientes.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Cliente, Proyecto, Unidad, Etapa, Torre } from '../../types';
import useAuth from '../../hooks/useAuth';

const { Title, Text } = Typography;

type ModalMode = 'crear' | 'editar';
type Vista = 'proyectos' | 'edificios' | 'unidades' | 'unidades-proyecto';

const ESTADO_CONFIG: Record<string, { color: string; label: string; tagColor: string }> = {
  disponible:    { color: '#52c41a', label: 'Disponible',    tagColor: 'success' },
  bloqueada:     { color: '#faad14', label: 'Bloqueada',     tagColor: 'warning' },
  no_disponible: { color: '#fa8c16', label: 'No disponible', tagColor: 'orange' },
  vendida:       { color: '#8c8c8c', label: 'Vendida',       tagColor: 'default' },
  desvinculada:  { color: '#ff4d4f', label: 'Desvinculada',  tagColor: 'error' },
};

const estadoTag = (v: string) => {
  const cfg = ESTADO_CONFIG[v] ?? { label: v, tagColor: 'default' };
  return <Tag color={cfg.tagColor}>{cfg.label}</Tag>;
};

// Gradiente único por nombre de proyecto
const projectGradient = (nombre: string) => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};

const formatTiempo = (segundos: number) => {
  if (segundos <= 0) return 'Vencido';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
};

const InventarioPage = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';
  const isInmobiliaria = usuario?.rol === 'inmobiliaria';

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [torres, setTorres] = useState<Torre[]>([]);
  const [bloqueando, setBloqueando] = useState<string | null>(null);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [unidadABloquear, setUnidadABloquear] = useState<Unidad | null>(null);
  const [pasoBloqueo, setPasoBloqueo] = useState(0);
  const [formCliente] = Form.useForm();
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  const [vista, setVista] = useState<Vista>('proyectos');
  const [proyectoId, setProyectoId] = useState('');
  const [torreId, setTorreId] = useState('');
  const [etapaId, setEtapaId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalProyecto, setModalProyecto] = useState(false);
  const [modoProyecto, setModoProyecto] = useState<ModalMode>('crear');
  const [proyectoEditando, setProyectoEditando] = useState<Proyecto | null>(null);
  const [formProyecto] = Form.useForm();
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  const [modalUnidad, setModalUnidad] = useState(false);
  const [modoUnidad, setModoUnidad] = useState<ModalMode>('crear');
  const [unidadEditando, setUnidadEditando] = useState<Unidad | null>(null);
  const [formUnidad] = Form.useForm();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalEdificio, setModalEdificio] = useState(false);
  const [formEtapa] = Form.useForm();
  const [formTorre] = Form.useForm();
  const [etapaEditando, setEtapaEditando] = useState<Etapa | null>(null);
  const [torreEditando, setTorreEditando] = useState<Torre | null>(null);

  useEffect(() => { cargarProyectos(); getInmobiliarias().then(setInmobiliarias).catch(() => {}); }, []);
  useEffect(() => {
    if (proyectoId) cargarEtapasYTorres();
    else { setEtapas([]); setTorres([]); }
  }, [proyectoId]);
  useEffect(() => {
    if (torreId) cargarUnidades();
    else setUnidades([]);
  }, [torreId, filtroEstado]);

  const cargarProyectos = async () => {
    try {
      const todos = await getProyectos();
      if (usuario?.rol === 'inmobiliaria' && usuario.proyectos?.length) {
        setProyectos(todos.filter(p => usuario.proyectos!.includes(p.proyecto_id)));
      } else {
        setProyectos(todos);
      }
    } catch { message.error('Error al cargar proyectos'); }
  };

  const cargarEtapasYTorres = async () => {
    try {
      const [e, t] = await Promise.all([getEtapas(proyectoId), getTorres(proyectoId)]);
      setEtapas(e); setTorres(t);
    } catch { console.error('Error al cargar etapas/edificios'); }
  };

  const cargarUnidades = async () => {
    setLoading(true);
    try {
      setUnidades(await getUnidades(proyectoId, {
        torre_id: torreId || undefined,
        estado: filtroEstado || undefined,
      }));
    } catch { message.error('Error al cargar unidades'); }
    finally { setLoading(false); }
  };

  const cargarTodasUnidades = async (pid: string, eid?: string, tid?: string, est?: string) => {
    setLoading(true);
    try {
      setUnidades(await getUnidades(pid, {
        etapa_id: eid || undefined,
        torre_id: tid || undefined,
        estado: est || undefined,
      }));
    } catch { message.error('Error al cargar unidades'); }
    finally { setLoading(false); }
  };

  // stats de unidades
  const statsUnidades = {
    total: unidades.length,
    disponibles: unidades.filter(u => u.estado === 'disponible').length,
    bloqueadas: unidades.filter(u => u.estado === 'bloqueada').length,
    vendidas: unidades.filter(u => u.estado === 'vendida').length,
  };

  // torres filtradas por etapa seleccionada
  const torresFiltradas = etapaId
    ? torres.filter(t => t.etapa_id === etapaId)
    : torres;

  // ── Navegación ──────────────────────────────────────────────
  const seleccionarProyecto = (id: string) => {
    setProyectoId(id); setTorreId(''); setEtapaId(''); setFiltroEstado('');
    setVista('unidades-proyecto');
    cargarTodasUnidades(id);
  };

  const seleccionarEdificio = (id: string) => {
    setTorreId(id); setFiltroEstado('');
    setVista('unidades');
  };

  const volverAProyectos = () => {
    setProyectoId(''); setTorreId(''); setEtapaId(''); setFiltroEstado('');
    setVista('proyectos');
  };

  const volverAEdificios = () => {
    setTorreId(''); setEtapaId(''); setFiltroEstado('');
    setVista('edificios');
  };

  // ── Proyectos ────────────────────────────────────────────────
  const abrirCrearProyecto = () => {
    setModoProyecto('crear'); setProyectoEditando(null);
    setImagenFile(null);
    formProyecto.resetFields(); setModalProyecto(true);
  };

  const abrirEditarProyecto = (p: Proyecto, e: React.MouseEvent) => {
    e.stopPropagation();
    setModoProyecto('editar'); setProyectoEditando(p);
    setImagenFile(null);
    formProyecto.setFieldsValue({ nombre: p.nombre, descripcion: p.descripcion });
    setModalProyecto(true);
  };

  const handleGuardarProyecto = async (values: { nombre: string; descripcion?: string }) => {
    try {
      setUploadingImagen(true);
      let imagen_url: string | undefined;

      if (modoProyecto === 'crear') {
        const proyecto = await crearProyecto(values);
        // subir imagen si hay
        if (imagenFile?.originFileObj) {
          const { upload_url, public_url } = await getPresignedImagenProyecto(proyecto.proyecto_id);
          await fetch(upload_url, { method: 'PUT', body: imagenFile.originFileObj, headers: { 'Content-Type': 'image/jpeg' } });
          imagen_url = public_url;
          await actualizarProyecto(proyecto.proyecto_id, { imagen_url });
        }
        message.success('Proyecto creado');
      } else if (proyectoEditando) {
        if (imagenFile?.originFileObj) {
          const { upload_url, public_url } = await getPresignedImagenProyecto(proyectoEditando.proyecto_id);
          await fetch(upload_url, { method: 'PUT', body: imagenFile.originFileObj, headers: { 'Content-Type': 'image/jpeg' } });
          imagen_url = public_url;
        }
        await actualizarProyecto(proyectoEditando.proyecto_id, { ...values, ...(imagen_url ? { imagen_url } : {}) });
        message.success('Proyecto actualizado');
      }
      await cargarProyectos(); setModalProyecto(false); setImagenFile(null);
    } catch { message.error('Error al guardar proyecto'); }
    finally { setUploadingImagen(false); }
  };

  const handleEliminarProyecto = async (p: Proyecto, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await eliminarProyecto(p.proyecto_id); message.success('Proyecto eliminado');
      await cargarProyectos();
    } catch { message.error('Error al eliminar proyecto'); }
  };

  // ── Etapas ───────────────────────────────────────────────────
  const handleGuardarEtapa = async (values: { nombre: string; orden?: number }) => {
    try {
      if (etapaEditando) {
        await actualizarEtapa(proyectoId, etapaEditando.etapa_id, values); message.success('Etapa actualizada');
      } else {
        await crearEtapa(proyectoId, values); message.success('Etapa creada');
      }
      setEtapaEditando(null); formEtapa.resetFields(); await cargarEtapasYTorres();
    } catch { message.error('Error al guardar etapa'); }
  };

  const handleEliminarEtapa = async (etapa: Etapa) => {
    try {
      await eliminarEtapa(proyectoId, etapa.etapa_id); message.success('Etapa eliminada');
      await cargarEtapasYTorres();
    } catch (err: any) { message.error(err?.message || 'Error al eliminar etapa'); }
  };

  // ── Edificios ────────────────────────────────────────────────
  const handleGuardarTorre = async (values: { nombre: string; etapa_id: string; orden?: number }) => {
    try {
      if (torreEditando) {
        await actualizarTorre(proyectoId, torreEditando.torre_id, values); message.success('Edificio actualizado');
      } else {
        await crearTorre(proyectoId, values); message.success('Edificio creado');
      }
      setTorreEditando(null); formTorre.resetFields(); await cargarEtapasYTorres();
    } catch { message.error('Error al guardar edificio'); }
  };

  const handleEliminarTorre = async (torre: Torre) => {
    try {
      await eliminarTorre(proyectoId, torre.torre_id); message.success('Edificio eliminado');
      await cargarEtapasYTorres();
    } catch (err: any) { message.error(err?.message || 'Error al eliminar edificio'); }
  };

  // ── Unidades ─────────────────────────────────────────────────
  const abrirCrearUnidad = () => {
    setModoUnidad('crear'); setUnidadEditando(null);
    formUnidad.resetFields();
    formUnidad.setFieldsValue({ torre_id: torreId, etapa_id: torres.find(t => t.torre_id === torreId)?.etapa_id });
    setModalUnidad(true);
  };

  const abrirEditarUnidad = (u: Unidad) => {
    setModoUnidad('editar'); setUnidadEditando(u);
    formUnidad.setFieldsValue({
      id_unidad: u.id_unidad, etapa_id: u.etapa_id,
      torre_id: u.torre_id, metraje: u.metraje, precio: u.precio,
    });
    setModalUnidad(true);
  };

  const handleGuardarUnidad = async (values: any) => {
    try {
      if (modoUnidad === 'crear') {
        await crearUnidad(proyectoId, {
          id_unidad: values.id_unidad, etapa_id: values.etapa_id,
          torre_id: values.torre_id, metraje: parseFloat(values.metraje),
          precio: parseFloat(values.precio),
        });
        message.success('Unidad creada');
      } else if (unidadEditando) {
        await actualizarUnidad(proyectoId, unidadEditando.unidad_id, {
          id_unidad: values.id_unidad,
          metraje: parseFloat(values.metraje),
          precio: parseFloat(values.precio),
        });
        message.success('Unidad actualizada');
      }
      await cargarUnidades(); setModalUnidad(false);
    } catch { message.error('Error al guardar unidad'); }
  };

  const handleEliminarUnidad = async (u: Unidad) => {
    try {
      await eliminarUnidad(proyectoId, u.unidad_id); message.success('Unidad eliminada');
      await cargarUnidades();
    } catch (err: any) {
      const body = err?.response?.body;
      let msg = 'Error al eliminar unidad';
      if (body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          if (parsed?.message) msg = parsed.message;
        } catch { /* ok */ }
      }
      message.error(msg);
    }
  };

  const abrirModalBloqueo = (u: Unidad) => {
    setUnidadABloquear(u);
    setPasoBloqueo(0);
    setClienteEncontrado(null);
    formCliente.resetFields();
    setModalBloqueo(true);
  };

  const buscarCliente = async (cedula: string) => {
    if (!cedula?.trim()) return;
    setBuscandoCliente(true);
    try {
      const result = await buscarClientePorCedula(cedula.trim(), proyectoId);
      const cliente = Array.isArray(result) ? result[0] : result;
      if (cliente) {
        setClienteEncontrado(cliente);
        formCliente.setFieldsValue({
          cedula: cliente.cedula,
          nombres: cliente.nombres,
          apellidos: cliente.apellidos,
          correo: cliente.correo,
          telefono: cliente.telefono,
          fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : undefined,
        });
      } else {
        setClienteEncontrado(null);
      }
    } catch {
      setClienteEncontrado(null);
    } finally {
      setBuscandoCliente(false);
    }
  };

  const handleBloquear = async (omitirCliente = false) => {
    if (!unidadABloquear) return;
    setGuardandoBloqueo(true);
    try {
      // Obtener cédula del form si hay cliente
      let cedula: string | undefined;
      if (!omitirCliente) {
        const values = formCliente.getFieldsValue();
        cedula = values.cedula?.trim();
      }

      // Paso 1: bloquear unidad (pasar cédula si existe)
      let intentos = 0;
      while (intentos < 2) {
        try {
          await bloquearUnidad({
            proyecto_id: proyectoId,
            unidad_id: unidadABloquear.unidad_id,
            ...(cedula ? { cliente_cedula: cedula } : {}),
          });
          break;
        } catch (err: any) {
          const status = err?.response?.statusCode ?? err?.response?.status ?? err?.statusCode;
          if ((status === 502 || status === 503) && intentos === 0) {
            intentos++;
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw err;
        }
      }

      // Paso 2: registrar cliente si no se omitió
      if (!omitirCliente) {
        let values: any;
        try {
          values = await formCliente.validateFields();
        } catch {
          // Validación falló — campos requeridos vacíos
          message.warning('Completa los campos requeridos del cliente (cédula, nombres, apellidos)');
          setGuardandoBloqueo(false);
          return;
        }
        try {
          await registrarCliente({
            ...values,
            proyecto_id: proyectoId,
            unidad_id: unidadABloquear.unidad_id,
            fecha_nacimiento: values.fecha_nacimiento
              ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD')
              : undefined,
          });
          message.success(`Unidad ${unidadABloquear.id_unidad} bloqueada y cliente registrado`);
        } catch (clienteErr: any) {
          const s = clienteErr?.response?.status ?? clienteErr?.response?.statusCode;
          if (s === 409) {
            message.warning('Unidad bloqueada. El cliente ya tiene exclusividad activa con otra inmobiliaria en este proyecto.');
          } else {
            message.warning(`Unidad bloqueada pero no se pudo registrar el cliente: ${s ?? 'error'}`);
          }
        }
      } else {
        message.success(`Unidad ${unidadABloquear.id_unidad} bloqueada por 48h`);
      }

      setModalBloqueo(false);
      if (vista === 'unidades-proyecto') {
        await cargarTodasUnidades(proyectoId, etapaId, torreId, filtroEstado);
      } else {
        await cargarUnidades();
      }
    } catch (err: any) {
      const status = err?.response?.statusCode ?? err?.response?.status ?? err?.statusCode;
      const body = err?.response?.body;
      let parsedStatus = status;
      if (!parsedStatus && body) {
        try {
          const parsed = typeof body === 'string' ? JSON.parse(body) : body;
          parsedStatus = parsed?.statusCode;
        } catch { /* ok */ }
      }
      if (parsedStatus === 409) message.error('La unidad ya no está disponible');
      else if (parsedStatus === 429) message.warning('Esta unidad no puede bloquearse nuevamente hasta 24h después de su liberación');
      else message.error('Error al procesar la operación');
    } finally {
      setGuardandoBloqueo(false);
      setBloqueando(null);
    }
  };

  const inmoNombre = (id: string) => {
    const inmo = inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}` || id?.startsWith(i.pk));
    return inmo?.nombre ?? id;
  };

  // ── Columnas tabla ───────────────────────────────────────────
  const columnaEdificio = {
    title: 'Edificio', dataIndex: 'torre_id', key: 'torre_id',
    render: (v: string) => torres.find(t => t.torre_id === v)?.nombre ?? v,
  };

  const columnaEtapa = {
    title: 'Etapa', dataIndex: 'etapa_id', key: 'etapa_id',
    render: (v: string) => {
      const e = etapas.find(et => et.etapa_id === v);
      return e ? <Tag color="blue">{e.nombre}</Tag> : v;
    },
  };

  const columnsBase = [
    { title: 'Unidad', dataIndex: 'id_unidad', key: 'id_unidad', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Metraje', dataIndex: 'metraje', key: 'metraje', render: (v: any) => `${parseFloat(v) || 0} m²` },
    {
      title: 'Precio', dataIndex: 'precio', key: 'precio',
      render: (v: any) => `$${parseFloat(v)?.toLocaleString('es-VE') ?? '—'}`,
    },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string, u: Unidad) => (
        <Space direction="vertical" size={2}>
          {estadoTag(v)}
          {v === 'bloqueada' && u.tiempo_restante !== undefined && (
            <Text style={{ fontSize: 11, color: u.tiempo_restante < 5 * 3600 ? '#faad14' : '#52c41a' }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />
              {formatTiempo(u.tiempo_restante)}
            </Text>
          )}
        </Space>
      ),
    },
    ...(isAdmin ? [
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => v ? <Tag>{inmoNombre(v)}</Tag> : <Text type="secondary">—</Text> },
      { title: 'Fecha bloqueo', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => v ? new Date(v).toLocaleDateString('es-VE') : <Text type="secondary">—</Text> },
    ] : []),
    ...(isAdmin ? [{
      title: '', key: 'acciones', width: 80,
      render: (_: any, u: Unidad) => (
        <Space>
          <Tooltip title="Editar">
            <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditarUnidad(u)} />
          </Tooltip>
          <Popconfirm title="¿Eliminar unidad?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarUnidad(u)}>
            <Tooltip title="Eliminar">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    }] : []),
    ...(isInmobiliaria ? [{
      title: '', key: 'bloqueo', width: 120,
      render: (_: any, u: Unidad) => {
        if (u.estado === 'bloqueada') {
          return <Tag icon={<LockOutlined />} color="warning" style={{ margin: 0 }}>Bloqueada</Tag>;
        }
        if (u.estado !== 'disponible') return null;
        return (
          <Button
            size="small"
            icon={<LockOutlined />}
            loading={bloqueando === u.unidad_id}
            type="primary"
            ghost
            onClick={() => abrirModalBloqueo(u)}
          >
            Bloquear
          </Button>
        );
      },
    }] : []),
  ];

  const columns = (vista === 'unidades-proyecto')
    ? [columnsBase[0], columnaEtapa, columnaEdificio, ...columnsBase.slice(1)]
    : columnsBase;

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);
  const edificioActual = torres.find(t => t.torre_id === torreId);

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {vista !== 'proyectos' && (
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={vista === 'unidades' ? volverAEdificios : volverAProyectos}
              type="text"
              style={{ padding: '4px 8px' }}
            />
          )}
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {vista === 'proyectos' && 'Proyectos'}
              {vista === 'edificios' && proyectoActual?.nombre}
              {(vista === 'unidades' || vista === 'unidades-proyecto') && (
                vista === 'unidades' ? edificioActual?.nombre : `${proyectoActual?.nombre} — Inventario`
              )}
            </Title>
            {vista !== 'proyectos' && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {vista === 'edificios' && 'Selecciona un edificio para ver sus unidades'}
                {vista === 'unidades' && `${proyectoActual?.nombre} / ${edificioActual?.nombre}`}
                {vista === 'unidades-proyecto' && 'Todas las unidades del proyecto'}
              </Text>
            )}
          </div>
        </div>

        {isAdmin && (
          <Space>
            {vista === 'proyectos' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearProyecto}>
                Nuevo proyecto
              </Button>
            )}
            {vista === 'edificios' && (
              <>
                <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>Etapas</Button>
                <Button icon={<AppstoreOutlined />} onClick={() => { setTorreId(''); setVista('unidades-proyecto'); cargarTodasUnidades(proyectoId); }}>
                  Ver todas las unidades
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTorreEditando(null); formTorre.resetFields(); setModalEdificio(true); }}>
                  Nuevo edificio
                </Button>
              </>
            )}
            {(vista === 'unidades' || vista === 'unidades-proyecto') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearUnidad}>
                Nueva unidad
              </Button>
            )}
            {vista === 'unidades-proyecto' && (
              <>
                <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>Etapas</Button>
                <Button icon={<PlusOutlined />} onClick={() => { setTorreEditando(null); formTorre.resetFields(); setModalEdificio(true); }}>
                  Nuevo edificio
                </Button>
                <Button icon={<HomeOutlined />} onClick={volverAEdificios}>Ver por edificio</Button>
              </>
            )}
          </Space>
        )}
      </div>

      {/* ── Vista: proyectos ── */}
      {vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {proyectos.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div
                style={{
                  borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
                  background: '#fff', border: '1px solid #f0f0f0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
                onClick={() => seleccionarProyecto(p.proyecto_id)}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Cover */}
                <div style={{
                  height: 160,
                  background: p.imagen_url ? undefined : projectGradient(p.nombre),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {p.imagen_url
                    ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />
                  }
                  {isAdmin && (
                    <div
                      style={{ position: 'absolute', top: 10, right: 10 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Space>
                        <Tooltip title="Editar">
                          <Button
                            size="small" type="text"
                            icon={<EditOutlined />}
                            style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                            onClick={(e) => abrirEditarProyecto(p, e)}
                          />
                        </Tooltip>
                        <Popconfirm title="¿Desactivar proyecto?" okText="Sí" cancelText="No" onConfirm={(e) => handleEliminarProyecto(p, e as any)}>
                          <Tooltip title="Eliminar">
                            <Button
                              size="small" type="text" danger
                              icon={<DeleteOutlined />}
                              style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion
                    ? <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                    : <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>
                  }
                </div>
              </div>
            </Col>
          ))}
          {proyectos.length === 0 && (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: 60 }}>
                <AppstoreOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 12 }} />
                <div><Text type="secondary">No hay proyectos disponibles</Text></div>
              </div>
            </Col>
          )}
        </Row>
      )}

      {/* ── Vista: edificios ── */}
      {vista === 'edificios' && (
        <>
          {/* Agrupar por etapa */}
          {etapas.filter(e => torres.some(t => t.etapa_id === e.etapa_id)).map((etapa, ei) => {
            const ETAPA_COLORS = ['#1677ff','#7c3aed','#f5576c','#43e97b','#fa8c16','#00b96b'];
            const color = ETAPA_COLORS[ei % ETAPA_COLORS.length];
            const torresEtapa = torres.filter(t => t.etapa_id === etapa.etapa_id);
            return (
              <div key={etapa.etapa_id} style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: color }} />
                  <Text strong style={{ fontSize: 15 }}>{etapa.nombre}</Text>
                  <Tag style={{ marginLeft: 4 }}>{torresEtapa.length} edificio{torresEtapa.length !== 1 ? 's' : ''}</Tag>
                </div>
                <Row gutter={[16, 16]}>
                  {torresEtapa.map(t => (
                    <Col key={t.torre_id} xs={24} sm={12} md={8} lg={6}>
                      <div
                        onClick={() => seleccionarEdificio(t.torre_id)}
                        style={{
                          borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                          background: '#fff', border: `1px solid #f0f0f0`,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                          transition: 'box-shadow 0.2s, transform 0.2s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px rgba(0,0,0,0.1)`;
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = color;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                          (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0';
                        }}
                      >
                        {/* Banda de color */}
                        <div style={{ height: 6, background: color }} />
                        <div style={{ padding: '16px 16px 14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <div style={{
                                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                                background: `${color}18`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <HomeOutlined style={{ fontSize: 20, color }} />
                              </div>
                              <div>
                                <Text strong style={{ fontSize: 14, display: 'block' }}>{t.nombre}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>{etapa.nombre}</Text>
                              </div>
                            </div>
                            {isAdmin && (
                              <Space onClick={e => e.stopPropagation()}>
                                <Tooltip title="Editar">
                                  <Button size="small" type="text" icon={<EditOutlined />}
                                    onClick={e => { e.stopPropagation(); setTorreEditando(t); formTorre.setFieldsValue({ nombre: t.nombre, etapa_id: t.etapa_id }); setModalEdificio(true); }} />
                                </Tooltip>
                                <Popconfirm title="¿Eliminar edificio?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarTorre(t)}>
                                  <Tooltip title="Eliminar">
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                  </Tooltip>
                                </Popconfirm>
                              </Space>
                            )}
                          </div>
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            );
          })}
          {torres.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <HomeOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 12 }} />
              <div><Text type="secondary">No hay edificios en este proyecto</Text></div>
            </div>
          )}
        </>
      )}

      {/* ── Vista: unidades ── */}
      {(vista === 'unidades' || vista === 'unidades-proyecto') && (
        <>
          {/* Stats row */}
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            {[
              { label: 'Total', value: statsUnidades.total, icon: <AppstoreOutlined />, color: '#1677ff', bg: '#e6f4ff' },
              { label: 'Disponibles', value: statsUnidades.disponibles, icon: <CheckCircleOutlined />, color: '#52c41a', bg: '#f6ffed' },
              { label: 'Bloqueadas', value: statsUnidades.bloqueadas, icon: <LockOutlined />, color: '#faad14', bg: '#fffbe6' },
              { label: 'Vendidas', value: statsUnidades.vendidas, icon: <DollarOutlined />, color: '#8c8c8c', bg: '#fafafa' },
            ].map(s => (
              <Col key={s.label} xs={12} sm={6}>
                <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }} styles={{ body: { padding: '16px 20px' } }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: s.color, fontSize: 16 }}>{s.icon}</span>
                    </div>
                    <Statistic title={<span style={{ fontSize: 12 }}>{s.label}</span>} value={s.value} valueStyle={{ fontSize: 22, fontWeight: 600 }} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Filtros */}
          <Card style={{ borderRadius: 12, marginBottom: 16, border: '1px solid #f0f0f0' }} styles={{ body: { padding: '12px 16px' } }}>
            <Space wrap>
              {vista === 'unidades-proyecto' && (
                <Select
                  value={etapaId || undefined}
                  onChange={v => {
                    const eid = v ?? '';
                    setEtapaId(eid);
                    setTorreId('');
                    cargarTodasUnidades(proyectoId, eid, '', filtroEstado);
                  }}
                  placeholder="Todas las etapas"
                  allowClear
                  style={{ width: 160 }}
                >
                  {etapas.map(e => <Select.Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Select.Option>)}
                </Select>
              )}
              {vista === 'unidades-proyecto' && (
                <Select
                  value={torreId || undefined}
                  onChange={v => {
                    const tid = v ?? '';
                    setTorreId(tid);
                    cargarTodasUnidades(proyectoId, etapaId, tid, filtroEstado);
                  }}
                  placeholder="Todos los edificios"
                  allowClear
                  style={{ width: 160 }}
                >
                  {torresFiltradas.map(t => <Select.Option key={t.torre_id} value={t.torre_id}>{t.nombre}</Select.Option>)}
                </Select>
              )}
              <Select
                value={filtroEstado || undefined}
                onChange={v => {
                  const est = v ?? '';
                  setFiltroEstado(est);
                  if (vista === 'unidades-proyecto') cargarTodasUnidades(proyectoId, etapaId, torreId, est);
                }}
                placeholder="Todos los estados"
                allowClear
                style={{ width: 180 }}
              >
                {Object.entries(ESTADO_CONFIG).map(([k, cfg]) => (
                  <Select.Option key={k} value={k}>{cfg.label}</Select.Option>
                ))}
              </Select>
              {(filtroEstado || etapaId || torreId) && (
                <Button type="text" size="small" onClick={() => {
                  setFiltroEstado(''); setEtapaId(''); setTorreId('');
                  cargarTodasUnidades(proyectoId);
                }}>
                  Limpiar filtros
                </Button>
              )}
            </Space>
          </Card>

          {/* Tabla */}
          <Card style={{ borderRadius: 12, border: '1px solid #f0f0f0' }} styles={{ body: { padding: 0 } }}>
            <Table
              dataSource={unidades}
              columns={columns}
              rowKey="unidad_id"
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: false }}
              locale={{ emptyText: (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <StopOutlined style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
                  <div><Text type="secondary">No hay unidades con los filtros seleccionados</Text></div>
                </div>
              )}}
              rowClassName={(u: Unidad) => `row-estado-${u.estado}`}
              style={{ borderRadius: 12, overflow: 'hidden' }}
            />
          </Card>
        </>
      )}

      {/* ── Modal Proyecto ── */}
      <Modal
        title={modoProyecto === 'crear' ? 'Nuevo proyecto' : 'Editar proyecto'}
        open={modalProyecto}
        onCancel={() => { setModalProyecto(false); setImagenFile(null); }}
        onOk={() => formProyecto.submit()}
        okText={modoProyecto === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
        confirmLoading={uploadingImagen}
      >
        <Form form={formProyecto} layout="vertical" onFinish={handleGuardarProyecto}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Residencias El Pinar" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} placeholder="Descripción opcional" />
          </Form.Item>
          <Form.Item label="Imagen de portada">
            {proyectoEditando?.imagen_url && !imagenFile && (
              <img
                src={proyectoEditando.imagen_url}
                alt="portada actual"
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
            )}
            <Upload
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              beforeUpload={() => false}
              fileList={imagenFile ? [imagenFile] : []}
              onChange={({ fileList }) => setImagenFile(fileList[0] ?? null)}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>
                {proyectoEditando?.imagen_url ? 'Cambiar imagen' : 'Subir imagen'}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Unidad ── */}
      <Modal
        title={modoUnidad === 'crear' ? 'Nueva unidad' : 'Editar unidad'}
        open={modalUnidad}
        onCancel={() => setModalUnidad(false)}
        onOk={() => formUnidad.submit()}
        okText={modoUnidad === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
      >
        <Form form={formUnidad} layout="vertical" onFinish={handleGuardarUnidad}>
          <Form.Item name="id_unidad" label="ID de la unidad" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: A-101" />
          </Form.Item>
          <Form.Item name="torre_id" label="Edificio" rules={[{ required: true, message: 'Requerido' }]} hidden={!!torreId}>
            <Select placeholder="Selecciona edificio" disabled={!!torreId}
              onChange={(val: string) => {
                const etapa = torres.find(t => t.torre_id === val)?.etapa_id;
                formUnidad.setFieldValue('etapa_id', etapa);
              }}>
              {torres.map(t => <Select.Option key={t.torre_id} value={t.torre_id}>{t.nombre}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="etapa_id" hidden><Input /></Form.Item>
          <Form.Item name="metraje" label="Metraje (m²)" rules={[{ required: true, message: 'Requerido' }]}>
            <Input type="number" placeholder="Ej: 85.5" />
          </Form.Item>
          <Form.Item name="precio" label="Precio" rules={[{ required: true, message: 'Requerido' }]}>
            <Input type="number" placeholder="Ej: 150000" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer Etapas ── */}
      <Drawer
        title="Etapas"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEtapaEditando(null); formEtapa.resetFields(); }}
        width={380}
      >
        <div style={{ marginBottom: 16 }}>
          {etapas.map(e => (
            <div key={e.etapa_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text>{e.nombre}</Text>
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEtapaEditando(e); formEtapa.setFieldsValue({ nombre: e.nombre, orden: e.orden }); }} />
                <Popconfirm title="¿Eliminar etapa?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarEtapa(e)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
        <Form form={formEtapa} layout="inline" onFinish={handleGuardarEtapa}>
          <Form.Item name="nombre" rules={[{ required: true, message: '' }]} style={{ flex: 1 }}>
            <Input placeholder={etapaEditando ? `Editando: ${etapaEditando.nombre}` : 'Nueva etapa'} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">{etapaEditando ? 'Guardar' : 'Agregar'}</Button>
          </Form.Item>
          {etapaEditando && (
            <Form.Item>
              <Button onClick={() => { setEtapaEditando(null); formEtapa.resetFields(); }}>Cancelar</Button>
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* ── Modal Edificio ── */}
      <Modal
        title={torreEditando ? 'Editar edificio' : 'Nuevo edificio'}
        open={modalEdificio}
        onCancel={() => { setModalEdificio(false); setTorreEditando(null); formTorre.resetFields(); }}
        onOk={() => formTorre.submit()}
        okText={torreEditando ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
      >
        <Form form={formTorre} layout="vertical" onFinish={handleGuardarTorre}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Edificio A" />
          </Form.Item>
          <Form.Item name="etapa_id" label="Etapa" rules={[{ required: true, message: 'Requerido' }]}>
            <Select placeholder="Selecciona etapa">
              {etapas.map(e => <Select.Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Bloqueo + Cliente ── */}
      <Modal
        title={<Space><LockOutlined /> Bloquear unidad {unidadABloquear?.id_unidad}</Space>}
        open={modalBloqueo}
        onCancel={() => { setModalBloqueo(false); formCliente.resetFields(); }}
        footer={null}
        width={560}
      >
        <Steps
          current={pasoBloqueo}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: 'Confirmar bloqueo' },
            { title: 'Registrar cliente' },
          ]}
        />

        {pasoBloqueo === 0 && (
          <div>
            <p>La unidad <strong>{unidadABloquear?.id_unidad}</strong> quedará bloqueada por <strong>48 horas</strong>.</p>
            <p style={{ color: '#8c8c8c', fontSize: 13 }}>Ninguna otra inmobiliaria podrá bloquearla durante ese tiempo.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <Button onClick={() => setModalBloqueo(false)}>Cancelar</Button>
              <Button type="primary" onClick={() => setPasoBloqueo(1)}>
                Continuar
              </Button>
            </div>
          </div>
        )}

        {pasoBloqueo === 1 && (
          <div>
            <p style={{ color: '#8c8c8c', fontSize: 13, marginBottom: 16 }}>
              Registra el cliente interesado en esta unidad. Puedes omitir este paso si aún no tienes los datos.
            </p>
            <Form form={formCliente} layout="vertical">
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true, message: 'Requerido' }]}>
                    <Input.Search
                      placeholder="V-12345678"
                      loading={buscandoCliente}
                      onSearch={buscarCliente}
                      onChange={() => { setClienteEncontrado(null); }}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
                    <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>
              {clienteEncontrado && (
                <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>
                  Cliente encontrado: <strong>{clienteEncontrado.nombres} {clienteEncontrado.apellidos}</strong> — datos precargados
                </div>
              )}
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="nombres" label="Nombres" rules={[{ required: true, message: 'Requerido' }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true, message: 'Requerido' }]}>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="correo" label="Correo">
                    <Input type="email" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="telefono" label="Teléfono">
                    <Input placeholder="+58 412 0000000" />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <Button onClick={() => setPasoBloqueo(0)}>Atrás</Button>
              <Space>
                <Button onClick={() => handleBloquear(true)} loading={guardandoBloqueo}>
                  Omitir cliente
                </Button>
                <Button type="primary" icon={<UserOutlined />} onClick={() => handleBloquear(false)} loading={guardandoBloqueo}>
                  Bloquear y registrar cliente
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InventarioPage;

import { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Tag, Button, Modal, Form, Input, message,
  Select, Row, Col, Popconfirm, Drawer, Space, Tooltip, Upload,
} from 'antd';
import {
  PlusOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined,
  SettingOutlined, ArrowLeftOutlined, LockOutlined, ClockCircleOutlined,
  ReloadOutlined, UploadOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import dayjs from 'dayjs';
import {
  getProyectos, getUnidades, crearProyecto, actualizarProyecto, eliminarProyecto,
  getEtapas, crearEtapa, actualizarEtapa, eliminarEtapa,
  crearUnidad, actualizarUnidad, eliminarUnidad,
  getPresignedImagenProyecto,
} from '../../services/proyectos.service';
import { bloquearUnidad } from '../../services/bloqueos.service';
import { buscarClientePorCedula } from '../../services/clientes.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Cliente, Proyecto, Unidad, Etapa } from '../../types';
import useAuth from '../../hooks/useAuth';
import DatePicker from 'antd/es/date-picker';

const { Title, Text } = Typography;
const { Option } = Select;
type ModalMode = 'crear' | 'editar';
type Vista = 'proyectos' | 'unidades';

const ESTADO_CONFIG: Record<string, { label: string; tagColor: string }> = {
  disponible:    { label: 'Disponible',    tagColor: 'success' },
  bloqueada:     { label: 'Bloqueada',     tagColor: 'warning' },
  no_disponible: { label: 'No disponible', tagColor: 'orange' },
  vendida:       { label: 'Vendida',       tagColor: 'default' },
  desvinculada:  { label: 'Desvinculada',  tagColor: 'error' },
};

const estadoTag = (v: string) => {
  const cfg = ESTADO_CONFIG[v] ?? { label: v, tagColor: 'default' };
  return <Tag color={cfg.tagColor}>{cfg.label}</Tag>;
};

const projectGradient = (nombre: string) => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
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

  // Modales proyectos
  const [modalProyecto, setModalProyecto] = useState(false);
  const [modoProyecto, setModoProyecto] = useState<ModalMode>('crear');
  const [proyectoEditando, setProyectoEditando] = useState<Proyecto | null>(null);
  const [formProyecto] = Form.useForm();
  const [imagenFile, setImagenFile] = useState<UploadFile | null>(null);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  // Drawer etapas
  const [drawerEtapas, setDrawerEtapas] = useState(false);
  const [formEtapa] = Form.useForm();
  const [etapaEditando, setEtapaEditando] = useState<Etapa | null>(null);

  // Modal unidades
  const [modalUnidad, setModalUnidad] = useState(false);
  const [modoUnidad, setModoUnidad] = useState<ModalMode>('crear');
  const [unidadEditando, setUnidadEditando] = useState<Unidad | null>(null);
  const [formUnidad] = Form.useForm();

  // Bloqueo
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [unidadABloquear, setUnidadABloquear] = useState<Unidad | null>(null);
  const [formCliente] = Form.useForm();
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

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

  useEffect(() => {
    if (proyectoId) {
      getEtapas(proyectoId).then(setEtapas).catch(() => {});
      cargarUnidades();
    }
  }, [proyectoId]);

  const seleccionarProyecto = (id: string) => {
    setProyectoId(id);
    setFiltroEstado(''); setFiltroEtapa(''); setFiltroTipo('');
    setFiltroManzana(''); setFiltroPiso('');
    setVista('unidades');
    getEtapas(id).then(setEtapas).catch(() => {});
    setLoading(true);
    getUnidades(id).then(setUnidades).catch(() => message.error('Error al cargar unidades')).finally(() => setLoading(false));
  };

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);
  const inmoNombre = (id: string) => inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}`)?.nombre ?? id;

  // ── Proyectos ──
  const handleGuardarProyecto = async (values: any) => {
    try {
      setUploadingImagen(true);
      let imagen_url: string | undefined;
      if (modoProyecto === 'crear') {
        const p = await crearProyecto(values);
        if (imagenFile?.originFileObj) {
          const { upload_url, public_url } = await getPresignedImagenProyecto(p.proyecto_id);
          await fetch(upload_url, { method: 'PUT', body: imagenFile.originFileObj, headers: { 'Content-Type': 'image/jpeg' } });
          await actualizarProyecto(p.proyecto_id, { imagen_url: public_url });
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

  // ── Etapas ──
  const handleGuardarEtapa = async (values: any) => {
    try {
      if (etapaEditando) {
        await actualizarEtapa(proyectoId, etapaEditando.etapa_id, values);
        message.success('Etapa actualizada');
      } else {
        await crearEtapa(proyectoId, values);
        message.success('Etapa creada');
      }
      setEtapaEditando(null); formEtapa.resetFields();
      getEtapas(proyectoId).then(setEtapas).catch(() => {});
    } catch { message.error('Error al guardar etapa'); }
  };

  // ── Unidades ──
  const abrirCrearUnidad = () => {
    setModoUnidad('crear'); setUnidadEditando(null);
    formUnidad.resetFields();
    setModalUnidad(true);
  };

  const abrirEditarUnidad = (u: Unidad) => {
    setModoUnidad('editar'); setUnidadEditando(u);
    formUnidad.setFieldsValue({
      id_unidad: u.id_unidad, etapa_id: u.etapa_id,
      metraje: u.metraje, precio: u.precio,
      tipo: u.tipo, manzana: u.manzana, piso: u.piso,
    });
    setModalUnidad(true);
  };

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

  // ── Bloqueo ──
  const abrirModalBloqueo = (u: Unidad) => {
    setUnidadABloquear(u); formCliente.resetFields();
    setClienteEncontrado(null); setModalBloqueo(true);
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
          cedula: cliente.cedula, nombres: cliente.nombres, apellidos: cliente.apellidos,
          correo: cliente.correo, telefono: cliente.telefono,
          fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : undefined,
        });
      } else { setClienteEncontrado(null); }
    } catch { setClienteEncontrado(null); }
    finally { setBuscandoCliente(false); }
  };

  const handleBloquear = async (omitirCliente = false) => {
    if (!unidadABloquear) return;
    setGuardandoBloqueo(true);
    try {
      let payload: any = { proyecto_id: proyectoId, unidad_id: unidadABloquear.unidad_id };
      if (!omitirCliente) {
        let values: any;
        try { values = await formCliente.validateFields(); }
        catch { message.warning('Completa los campos requeridos del cliente'); setGuardandoBloqueo(false); return; }
        payload = { ...payload, cedula: values.cedula?.trim(), nombres: values.nombres?.trim(),
          apellidos: values.apellidos?.trim(), correo: values.correo, telefono: values.telefono,
          fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
          estado_civil: values.estado_civil, nacionalidad: values.nacionalidad, pais_residencia: values.pais_residencia };
      }
      let intentos = 0;
      while (intentos < 2) {
        try { await bloquearUnidad(payload); break; }
        catch (err: any) {
          const s = err?.response?.statusCode ?? err?.response?.status;
          if ((s === 502 || s === 503) && intentos === 0) { intentos++; await new Promise(r => setTimeout(r, 1500)); continue; }
          throw err;
        }
      }
      if (!omitirCliente) message.success(`Unidad ${unidadABloquear.id_unidad} bloqueada y cliente registrado`);
      else message.success(`Unidad ${unidadABloquear.id_unidad} bloqueada por 48h`);
      setModalBloqueo(false);
      await cargarUnidades();
    } catch (err: any) {
      const s = err?.response?.statusCode ?? err?.response?.status;
      if (s === 409) message.error('La unidad ya no está disponible o el cliente tiene exclusividad con otra inmobiliaria');
      else if (s === 429) message.warning('No puedes re-bloquear esta unidad antes de 24h');
      else message.error('Error al procesar la operación');
    } finally { setGuardandoBloqueo(false); }
  };

  // ── Columnas tabla unidades ──
  const columnas = [
    { title: 'ID Unidad', dataIndex: 'id_unidad', key: 'id_unidad', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Etapa', dataIndex: 'etapa_id', key: 'etapa_id', render: (v: string) => {
      const e = etapas.find(et => et.etapa_id === v);
      return e ? <Tag color="blue">{e.nombre}</Tag> : <Text type="secondary">—</Text>;
    }},
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Manzana', dataIndex: 'manzana', key: 'manzana', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Piso', dataIndex: 'piso', key: 'piso', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Metraje', dataIndex: 'metraje', key: 'metraje', render: (v: any) => `${parseFloat(v) || 0} m²` },
    { title: 'Precio', dataIndex: 'precio', key: 'precio', render: (v: any) => `${parseFloat(v)?.toLocaleString('es-VE') ?? '—'}` },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string, u: Unidad) => (
        <Space direction="vertical" size={2}>
          {estadoTag(v)}
          {v === 'bloqueada' && u.tiempo_restante !== undefined && (
            <Text style={{ fontSize: 11, color: u.tiempo_restante < 5 * 3600 ? '#faad14' : '#52c41a' }}>
              <ClockCircleOutlined style={{ marginRight: 3 }} />{formatTiempo(u.tiempo_restante)}
            </Text>
          )}
        </Space>
      ),
    },
    ...(isAdmin ? [
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => v ? <Tag>{inmoNombre(v)}</Tag> : <Text type="secondary">—</Text> },
      { title: 'Fecha bloqueo', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => v ? new Date(v).toLocaleDateString('es-VE') : <Text type="secondary">—</Text> },
      { title: '', key: 'acciones', width: 80, render: (_: any, u: Unidad) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => abrirEditarUnidad(u)} /></Tooltip>
          <Popconfirm title="¿Eliminar unidad?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarUnidad(u)}>
            <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
    ] : []),
    ...(isInmobiliaria ? [{
      title: '', key: 'bloqueo', width: 120,
      render: (_: any, u: Unidad) => {
        if (u.estado === 'bloqueada') return <Tag icon={<LockOutlined />} color="warning">Bloqueada</Tag>;
        if (u.estado !== 'disponible') return null;
        return <Button size="small" icon={<LockOutlined />} type="primary" ghost onClick={() => abrirModalBloqueo(u)}>Bloquear</Button>;
      },
    }] : []),
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {vista === 'unidades' && (
            <Button icon={<ArrowLeftOutlined />} onClick={() => { setVista('proyectos'); setProyectoId(''); setUnidades([]); }} type="text" />
          )}
          <Title level={4} style={{ margin: 0 }}>
            {vista === 'proyectos' ? 'Proyectos' : proyectoActual?.nombre ?? 'Inventario'}
          </Title>
        </div>
        <Space>
          {vista === 'unidades' && (
            <Tooltip title="Actualizar">
              <Button icon={<ReloadOutlined />} onClick={() => cargarUnidades()} loading={loading} />
            </Tooltip>
          )}
          {isAdmin && vista === 'proyectos' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setModoProyecto('crear'); setProyectoEditando(null); setImagenFile(null); formProyecto.resetFields(); setModalProyecto(true); }}>
              Nuevo proyecto
            </Button>
          )}
          {isAdmin && vista === 'unidades' && (
            <Space>
              <Button icon={<SettingOutlined />} onClick={() => setDrawerEtapas(true)}>Etapas</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearUnidad}>Nueva unidad</Button>
            </Space>
          )}
        </Space>
      </div>

      {/* Vista proyectos */}
      {vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {proyectos.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: '#fff', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s, transform 0.2s' }}
                onClick={() => seleccionarProyecto(p.proyecto_id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{ height: 160, background: p.imagen_url ? undefined : projectGradient(p.nombre), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />}
                  {isAdmin && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                          onClick={() => { setModoProyecto('editar'); setProyectoEditando(p); setImagenFile(null); formProyecto.setFieldsValue({ nombre: p.nombre, descripcion: p.descripcion }); setModalProyecto(true); }} />
                        <Popconfirm title="¿Desactivar proyecto?" okText="Sí" cancelText="No" onConfirm={async () => { await eliminarProyecto(p.proyecto_id); cargarProyectos(); }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6 }} />
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion ? <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                    : <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Vista unidades */}
      {vista === 'unidades' && (
        <>
          {/* Filtros */}
          <Space wrap style={{ marginBottom: 16 }}>
            <Select allowClear placeholder="Etapa" style={{ width: 150 }} value={filtroEtapa || undefined}
              onChange={v => { setFiltroEtapa(v || ''); }}>
              {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
            </Select>
            <Select allowClear placeholder="Estado" style={{ width: 150 }} value={filtroEstado || undefined}
              onChange={v => setFiltroEstado(v || '')}>
              {Object.entries(ESTADO_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Input placeholder="Tipo" style={{ width: 120 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} allowClear />
            <Input placeholder="Manzana" style={{ width: 120 }} value={filtroManzana} onChange={e => setFiltroManzana(e.target.value)} allowClear />
            <Input placeholder="Piso" style={{ width: 100 }} value={filtroPiso} onChange={e => setFiltroPiso(e.target.value)} allowClear />
            <Button onClick={() => cargarUnidades()} loading={loading}>Aplicar filtros</Button>
          </Space>
          <Table dataSource={unidades} columns={columnas} rowKey="unidad_id" loading={loading}
            pagination={{ pageSize: 30 }} locale={{ emptyText: 'Sin unidades' }} />
        </>
      )}

      {/* Modal proyecto */}
      <Modal title={modoProyecto === 'crear' ? 'Nuevo proyecto' : 'Editar proyecto'} open={modalProyecto}
        onCancel={() => { setModalProyecto(false); setImagenFile(null); }}
        onOk={() => formProyecto.submit()} okText="Guardar" cancelText="Cancelar" confirmLoading={uploadingImagen}>
        <Form form={formProyecto} layout="vertical" onFinish={handleGuardarProyecto}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Imagen (opcional)">
            <Upload beforeUpload={file => { setImagenFile(file as any); return false; }} maxCount={1} accept="image/*"
              fileList={imagenFile ? [imagenFile] : []} onRemove={() => setImagenFile(null)}>
              <Button icon={<UploadOutlined />}>Seleccionar imagen</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer etapas */}
      <Drawer title="Gestionar etapas" open={drawerEtapas} onClose={() => { setDrawerEtapas(false); setEtapaEditando(null); formEtapa.resetFields(); }} width={380}>
        <Form form={formEtapa} layout="vertical" onFinish={handleGuardarEtapa}>
          <Form.Item name="nombre" label="Nombre de la etapa" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="orden" label="Orden"><Input type="number" /></Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">{etapaEditando ? 'Actualizar' : 'Crear'}</Button>
            {etapaEditando && <Button onClick={() => { setEtapaEditando(null); formEtapa.resetFields(); }}>Cancelar</Button>}
          </Space>
        </Form>
        <div style={{ marginTop: 24 }}>
          {etapas.map(e => (
            <div key={e.etapa_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Text>{e.nombre}</Text>
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => { setEtapaEditando(e); formEtapa.setFieldsValue({ nombre: e.nombre, orden: e.orden }); }} />
                <Popconfirm title="¿Eliminar etapa?" okText="Sí" cancelText="No"
                  onConfirm={async () => { await eliminarEtapa(proyectoId, e.etapa_id); getEtapas(proyectoId).then(setEtapas).catch(() => {}); }}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>
          ))}
        </div>
      </Drawer>

      {/* Modal unidad */}
      <Modal title={modoUnidad === 'crear' ? 'Nueva unidad' : 'Editar unidad'} open={modalUnidad}
        onCancel={() => setModalUnidad(false)} onOk={() => formUnidad.submit()} okText="Guardar" cancelText="Cancelar">
        <Form form={formUnidad} layout="vertical" onFinish={handleGuardarUnidad}>
          <Form.Item name="id_unidad" label="ID Unidad (ej: A7237)" rules={[{ required: true }]}><Input placeholder="A7237" /></Form.Item>
          <Form.Item name="etapa_id" label="Etapa" rules={[{ required: true }]}>
            <Select placeholder="Selecciona una etapa">
              {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="tipo" label="Tipo"><Input placeholder="Apartamento, Local, Oficina..." /></Form.Item>
          <Form.Item name="manzana" label="Manzana"><Input placeholder="Manzana A" /></Form.Item>
          <Form.Item name="piso" label="Piso"><Input placeholder="3" /></Form.Item>
          <Form.Item name="metraje" label="Metraje (m²)" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="precio" label="Precio" rules={[{ required: true }]}><Input type="number" /></Form.Item>
        </Form>
      </Modal>

      {/* Modal bloqueo */}
      <Modal title={`Bloquear unidad ${unidadABloquear?.id_unidad}`} open={modalBloqueo}
        onCancel={() => setModalBloqueo(false)} footer={null} width={560}>
        <Form form={formCliente} layout="vertical">
          <Form.Item name="cedula" label="Cédula del cliente" rules={[{ required: true }]}>
            <Input.Search placeholder="V-12345678" loading={buscandoCliente} onSearch={buscarCliente} enterButton="Buscar" />
          </Form.Item>
          {clienteEncontrado && <Text type="success" style={{ display: 'block', marginBottom: 12 }}>✓ Cliente encontrado: {clienteEncontrado.nombres} {clienteEncontrado.apellidos}</Text>}
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={() => handleBloquear(true)} loading={guardandoBloqueo}>Bloquear sin cliente</Button>
          <Button type="primary" onClick={() => handleBloquear(false)} loading={guardandoBloqueo}>Bloquear con cliente</Button>
        </Space>
      </Modal>
    </div>
  );
};

export default InventarioPage;

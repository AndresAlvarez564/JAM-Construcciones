import { useEffect, useState } from 'react';
import {
  Table, Typography, Tag, Button, Modal, Form, Input, message,
  Select, Card, Row, Col, Popconfirm, Drawer, Space, Tooltip,
} from 'antd';
import {
  PlusOutlined, AppstoreOutlined,
  EditOutlined, DeleteOutlined, SettingOutlined, HomeOutlined,
} from '@ant-design/icons';
import {
  getProyectos, getUnidades, crearProyecto, actualizarProyecto, eliminarProyecto,
  getEtapas, crearEtapa, actualizarEtapa, eliminarEtapa,
  getTorres, crearTorre, actualizarTorre, eliminarTorre,
  crearUnidad, actualizarUnidad, eliminarUnidad,
} from '../../services/proyectos.service';
import type { Proyecto, Unidad, Etapa, Torre } from '../../types';
import useAuth from '../../hooks/useAuth';

const { Title, Text, Paragraph } = Typography;

type ModalMode = 'crear' | 'editar';
type Vista = 'proyectos' | 'edificios' | 'unidades' | 'unidades-proyecto';

const InventarioPage = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';

  // datos
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [torres, setTorres] = useState<Torre[]>([]);

  // navegación
  const [vista, setVista] = useState<Vista>('proyectos');
  const [proyectoId, setProyectoId] = useState('');
  const [torreId, setTorreId] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [loading, setLoading] = useState(false);

  // modales proyecto
  const [modalProyecto, setModalProyecto] = useState(false);
  const [modoProyecto, setModoProyecto] = useState<ModalMode>('crear');
  const [proyectoEditando, setProyectoEditando] = useState<Proyecto | null>(null);
  const [formProyecto] = Form.useForm();

  // modales unidad
  const [modalUnidad, setModalUnidad] = useState(false);
  const [modoUnidad, setModoUnidad] = useState<ModalMode>('crear');
  const [unidadEditando, setUnidadEditando] = useState<Unidad | null>(null);
  const [formUnidad] = Form.useForm();

  // drawer etapas/edificios
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalEdificio, setModalEdificio] = useState(false);
  const [formEtapa] = Form.useForm();
  const [formTorre] = Form.useForm();
  const [etapaEditando, setEtapaEditando] = useState<Etapa | null>(null);
  const [torreEditando, setTorreEditando] = useState<Torre | null>(null);

  useEffect(() => { cargarProyectos(); }, []);

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

  const cargarTodasUnidades = async (pid: string) => {
    setLoading(true);
    try {
      setUnidades(await getUnidades(pid, { estado: filtroEstado || undefined }));
    } catch { message.error('Error al cargar unidades'); }
    finally { setLoading(false); }
  };

  // ── Navegación ─────────────────────────────────────────────
  const seleccionarProyecto = (id: string) => {
    setProyectoId(id); setTorreId(''); setFiltroEstado('');
    setVista('unidades-proyecto');
    cargarTodasUnidades(id);
  };

  const seleccionarEdificio = (id: string) => {
    setTorreId(id); setFiltroEstado('');
    setVista('unidades');
  };

  const verTodasUnidades = (pid: string) => {
    setTorreId(''); setFiltroEstado('');
    setVista('unidades-proyecto');
    cargarTodasUnidades(pid);
  };

  const volverAProyectos = () => {
    setProyectoId(''); setTorreId(''); setFiltroEstado('');
    setVista('proyectos');
  };

  const volverAEdificios = () => {
    setTorreId(''); setFiltroEstado('');
    setVista('edificios');
  };

  // ── Proyectos ──────────────────────────────────────────────
  const abrirCrearProyecto = () => {
    setModoProyecto('crear'); setProyectoEditando(null);
    formProyecto.resetFields(); setModalProyecto(true);
  };

  const abrirEditarProyecto = (p: Proyecto, e: React.MouseEvent) => {
    e.stopPropagation();
    setModoProyecto('editar'); setProyectoEditando(p);
    formProyecto.setFieldsValue({ nombre: p.nombre, descripcion: p.descripcion });
    setModalProyecto(true);
  };

  const handleGuardarProyecto = async (values: { nombre: string; descripcion?: string }) => {
    try {
      if (modoProyecto === 'crear') {
        await crearProyecto(values); message.success('Proyecto creado');
      } else if (proyectoEditando) {
        await actualizarProyecto(proyectoEditando.proyecto_id, values); message.success('Proyecto actualizado');
      }
      await cargarProyectos(); setModalProyecto(false);
    } catch { message.error('Error al guardar proyecto'); }
  };

  const handleEliminarProyecto = async (p: Proyecto, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await eliminarProyecto(p.proyecto_id); message.success('Proyecto eliminado');
      await cargarProyectos();
    } catch { message.error('Error al eliminar proyecto'); }
  };

  // ── Etapas ─────────────────────────────────────────────────
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

  // ── Edificios ──────────────────────────────────────────────
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

  // ── Unidades ───────────────────────────────────────────────
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
    } catch { message.error('Error al eliminar unidad'); }
  };

  // ── Columnas tabla ─────────────────────────────────────────
  const columnaEdificio = {
    title: 'Edificio', dataIndex: 'torre_id', key: 'torre_id',
    render: (v: string) => torres.find(t => t.torre_id === v)?.nombre ?? v,
  };

  const columnsBase = [
    { title: 'Unidad', dataIndex: 'id_unidad', key: 'id_unidad' },
    { title: 'Metraje', dataIndex: 'metraje', key: 'metraje', render: (v: any) => `${parseFloat(v) || 0} m²` },
    { title: 'Precio', dataIndex: 'precio', key: 'precio', render: (v: any) => `${parseFloat(v)?.toLocaleString() ?? '—'}` },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string) => <Tag color={v === 'disponible' ? 'green' : 'default'}>{v}</Tag>,
    },
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
  ];

  const columns = vista === 'unidades-proyecto'
    ? [columnsBase[0], columnaEdificio, ...columnsBase.slice(1)]
    : columnsBase;

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);
  const edificioActual = torres.find(t => t.torre_id === torreId);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          {vista === 'proyectos' && 'Proyectos'}
          {vista === 'edificios' && 'Edificios'}
          {vista === 'unidades' && 'Inventario'}
          {vista === 'unidades-proyecto' && 'Inventario'}
        </Title>
        {isAdmin && (
          <Space>
            {vista === 'proyectos' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearProyecto}>
                Nuevo proyecto
              </Button>
            )}
            {vista === 'edificios' && (
              <>
                <Button icon={<SettingOutlined />} onClick={() => setDrawerOpen(true)}>
                  Etapas
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setTorreEditando(null); formTorre.resetFields(); setModalEdificio(true); }}>
                  Nuevo edificio
                </Button>
              </>
            )}
            {vista === 'unidades' && isAdmin && (
              <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearUnidad}>
                Nueva unidad
              </Button>
            )}
            {vista === 'unidades-proyecto' && (
              <Space>
                <Button icon={<HomeOutlined />} onClick={volverAEdificios}>
                  Ver por edificio
                </Button>
                {isAdmin && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrearUnidad}>
                    Nueva unidad
                  </Button>
                )}
              </Space>
            )}
          </Space>
        )}
      </div>

      {/* Breadcrumb */}
      {vista !== 'proyectos' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Button size="small" type="link" icon={<HomeOutlined />} onClick={volverAProyectos} style={{ padding: 0 }}>
            Proyectos
          </Button>
          {vista === 'unidades' && (
            <>
              <Text type="secondary">/</Text>
              <Button size="small" type="link" onClick={volverAEdificios} style={{ padding: 0 }}>
                {proyectoActual?.nombre}
              </Button>
              <Text type="secondary">/</Text>
              <Text strong>{edificioActual?.nombre}</Text>
            </>
          )}
          {vista === 'edificios' && (
            <>
              <Text type="secondary">/</Text>
              <Text strong>{proyectoActual?.nombre}</Text>
            </>
          )}
          {vista === 'unidades-proyecto' && (
            <>
              <Text type="secondary">/</Text>
              <Text strong>{proyectoActual?.nombre}</Text>
              <Text type="secondary">/</Text>
              <Text strong>Todas las unidades</Text>
            </>
          )}
        </div>
      )}

      {/* Vista: cards de proyectos */}
      {vista === 'proyectos' && (
        <Row gutter={[16, 16]}>
          {proyectos.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => seleccionarProyecto(p.proyecto_id)}
                styles={{ body: { padding: 20 } }}
                style={{ borderRadius: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <AppstoreOutlined style={{ fontSize: 26, color: '#1677ff', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ fontSize: 15 }}>{p.nombre}</Text>
                      {p.descripcion && (
                        <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 2 }}>
                          {p.descripcion}
                        </Paragraph>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <Space style={{ flexShrink: 0, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                      <Tooltip title="Editar">
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => abrirEditarProyecto(p, e)} />
                      </Tooltip>
                      <Popconfirm
                        title="¿Desactivar proyecto?"
                        okText="Sí" cancelText="No"
                        onConfirm={(e) => handleEliminarProyecto(p, e as any)}
                      >
                        <Tooltip title="Eliminar">
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  )}
                </div>
              </Card>
            </Col>
          ))}
          {proyectos.length === 0 && (
            <Col span={24}><Text type="secondary">No hay proyectos disponibles.</Text></Col>
          )}
        </Row>
      )}

      {/* Vista: cards de edificios */}
      {vista === 'edificios' && (
        <Row gutter={[16, 16]}>
          {torres.map(t => {
            const etapa = etapas.find(e => e.etapa_id === t.etapa_id);
            return (
              <Col key={t.torre_id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => seleccionarEdificio(t.torre_id)}
                  styles={{ body: { padding: 20 } }}
                  style={{ borderRadius: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <HomeOutlined style={{ fontSize: 26, color: '#1677ff', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <Text strong style={{ fontSize: 15 }}>{t.nombre}</Text>
                        {etapa && (
                          <div style={{ marginTop: 6 }}>
                            <Tag color="blue">{etapa.nombre}</Tag>
                          </div>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <Space style={{ flexShrink: 0, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                        <Tooltip title="Editar">
                          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setTorreEditando(t); formTorre.setFieldsValue({ nombre: t.nombre, etapa_id: t.etapa_id }); setModalEdificio(true); }} />
                        </Tooltip>
                        <Popconfirm title="¿Eliminar edificio?" okText="Sí" cancelText="No" onConfirm={() => handleEliminarTorre(t)}>
                          <Tooltip title="Eliminar">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
          {torres.length === 0 && (
            <Col span={24}><Text type="secondary">No hay edificios en este proyecto.</Text></Col>
          )}
        </Row>
      )}

      {/* Vista: tabla de unidades (por edificio o por proyecto) */}
      {(vista === 'unidades' || vista === 'unidades-proyecto') && (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select value={filtroEstado || undefined} onChange={v => {
              setFiltroEstado(v ?? '');
              if (vista === 'unidades-proyecto') cargarTodasUnidades(proyectoId);
            }}
              placeholder="Todos los estados" allowClear style={{ width: 180 }}>
              <Select.Option value="disponible">Disponible</Select.Option>
              <Select.Option value="bloqueada">Bloqueada</Select.Option>
              <Select.Option value="no_disponible">No disponible</Select.Option>
              <Select.Option value="vendida">Vendida</Select.Option>
              <Select.Option value="desvinculada">Desvinculada</Select.Option>
            </Select>
          </div>
          <Table
            dataSource={unidades} columns={columns} rowKey="unidad_id"
            loading={loading} pagination={{ pageSize: 20 }}
            locale={{ emptyText: 'No hay unidades' }}
          />
        </>
      )}

      {/* Modal Proyecto */}
      <Modal
        title={modoProyecto === 'crear' ? 'Nuevo proyecto' : 'Editar proyecto'}
        open={modalProyecto}
        onCancel={() => setModalProyecto(false)}
        onOk={() => formProyecto.submit()}
        okText={modoProyecto === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
      >
        <Form form={formProyecto} layout="vertical" onFinish={handleGuardarProyecto}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Residencias El Pinar" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} placeholder="Descripción opcional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Unidad */}
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
          <Form.Item name="torre_id" label="Edificio" rules={[{ required: true, message: 'Requerido' }]}
            hidden={!!torreId}>
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

      {/* Drawer solo Etapas */}
      <Drawer
        title="Etapas"
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEtapaEditando(null); formEtapa.resetFields(); }}
        width={380}
      >
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          {etapas.map(e => (
            <div key={e.etapa_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
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
        <Form form={formEtapa} layout="inline" onFinish={handleGuardarEtapa} style={{ marginBottom: 4 }}>
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

      {/* Modal Edificio */}
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
    </div>
  );
};

export default InventarioPage;

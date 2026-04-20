import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, message, Space, Tooltip, Drawer, Descriptions, Spin,
  Tabs, Divider,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, UserOutlined, HistoryOutlined,
  SwapOutlined, SearchOutlined, EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getClientes, getClientesAdmin, buscarClienteAdmin, registrarCliente, actualizarClienteAdmin } from '../../services/clientes.service';
import { getProcesosCliente, getMisProcesos, crearProceso, cambiarEstatus } from '../../services/crm.service';
import { getProyectos, getUnidades } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { useAuthContext } from '../../context/AuthContext';
import type { Cliente, Proyecto, Proceso, Unidad } from '../../types';
import CambiarEstatusModal from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';

const { Title, Text } = Typography;
const { Option } = Select;

const ESTADO_COLOR: Record<string, string> = {
  captacion: 'blue', disponible: 'default', reserva: 'orange',
  separacion: 'purple', inicial: 'cyan', desvinculado: 'red',
};
const ESTADO_LABEL: Record<string, string> = {
  captacion: 'Captación', disponible: 'Disponible', reserva: 'Reserva',
  separacion: 'Separación', inicial: 'Inicial', desvinculado: 'Desvinculado',
};

const ClientesPage = () => {
  const { usuario } = useAuthContext();
  const isAdmin = usuario?.rol !== 'inmobiliaria';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerCliente, setDrawerCliente] = useState<Cliente | null>(null);
  const [drawerProcesos, setDrawerProcesos] = useState<Proceso[]>([]);
  const [loadingProcesos, setLoadingProcesos] = useState(false);
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [busqueda, setBusqueda] = useState('');
  const [form] = Form.useForm();
  const [formEditar] = Form.useForm();
  const [editarModal, setEditarModal] = useState(false);
  const [estatusModal, setEstatusModal] = useState<Proceso | null>(null);
  const [estatusCliente, setEstatusCliente] = useState<Cliente | null>(null);
  const [historialProceso, setHistorialProceso] = useState<Proceso | null>(null);
  const [historialClienteNombre, setHistorialClienteNombre] = useState('');
  const [crearProcesoModal, setCrearProcesoModal] = useState<Cliente | null>(null);
  const [unidadesProyecto, setUnidadesProyecto] = useState<Unidad[]>([]);
  const [formProceso] = Form.useForm();
  // Vista por cédula (admin)
  const [cedulaBuscar, setCedulaBuscar] = useState('');
  const [resultadoCedula, setResultadoCedula] = useState<(Cliente & { procesos: any[] })[] | null>(null);
  const [buscandoCedula, setBuscandoCedula] = useState(false);
  const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async (proyId?: string, inmoId?: string, token?: string) => {
    setLoading(true);
    try {
      if (isAdmin) {
        const data = await getClientesAdmin(
          proyId || inmoId ? { proyecto_id: proyId, inmobiliaria_id: inmoId, next_token: token } : { next_token: token }
        );
        setClientes(prev => token ? [...prev, ...data.items] : data.items);
        setNextToken(data.next_token);
      } else {
        const data = await getClientes(proyId);
        setClientes(data);
      }
    } catch { message.error('Error al cargar clientes'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (isAdmin) getInmobiliarias().then(setInmobiliarias).catch(() => {});
    cargar();
  }, [cargar, isAdmin]);

  const proyectoNombre = (id: string) => proyectos.find(p => p.proyecto_id === id)?.nombre ?? id;
  const inmoNombre = (id: string) => inmobiliarias.find(i => i.pk === id)?.nombre ?? id;

  // Búsqueda local por nombre o cédula
  const clientesFiltrados = busqueda.trim()
    ? clientes.filter(c =>
        c.cedula.toLowerCase().includes(busqueda.toLowerCase()) ||
        `${c.nombres} ${c.apellidos}`.toLowerCase().includes(busqueda.toLowerCase())
      )
    : clientes;

  const abrirDrawerCliente = async (cliente: Cliente) => {
    setDrawerCliente(cliente);
    setDrawerProcesos([]);
    setLoadingProcesos(true);
    try {
      if (isAdmin) {
        const p = await getProcesosCliente(cliente.cedula, cliente.inmobiliaria_id);
        setDrawerProcesos(p);
      } else {
        const p = await getMisProcesos(cliente.proyecto_id);
        setDrawerProcesos(p.filter(x => x.cedula === cliente.cedula));
      }
    } catch { setDrawerProcesos([]); }
    finally { setLoadingProcesos(false); }
  };

  const abrirEditar = (cliente: Cliente) => {
    formEditar.setFieldsValue({
      nombres: cliente.nombres,
      apellidos: cliente.apellidos,
      correo: cliente.correo,
      telefono: cliente.telefono,
      estado_civil: cliente.estado_civil,
      nacionalidad: cliente.nacionalidad,
      pais_residencia: cliente.pais_residencia,
      fecha_nacimiento: cliente.fecha_nacimiento ? dayjs(cliente.fecha_nacimiento) : undefined,
    });
    setEditarModal(true);
  };

  const handleEditar = async (values: any) => {
    if (!drawerCliente) return;
    try {
      await actualizarClienteAdmin(drawerCliente.cedula, drawerCliente.proyecto_id, drawerCliente.inmobiliaria_id, {
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
      message.success('Cliente actualizado');
      setEditarModal(false);
      // Refrescar drawer
      const updated = await getClientesAdmin({ proyecto_id: drawerCliente.proyecto_id, inmobiliaria_id: drawerCliente.inmobiliaria_id });
      const c = updated.items.find(x => x.cedula === drawerCliente.cedula);
      if (c) setDrawerCliente(c);
    } catch { message.error('Error al actualizar cliente'); }
  };

  const abrirCrearProceso = async (cliente: Cliente) => {
    setCrearProcesoModal(cliente);
    formProceso.resetFields();
    const [disponibles, bloqueadas] = await Promise.all([
      getUnidades(cliente.proyecto_id, { estado: 'disponible' }).catch(() => []),
      getUnidades(cliente.proyecto_id, { estado: 'bloqueada' }).catch(() => []),
    ]);
    setUnidadesProyecto([...disponibles, ...bloqueadas]);
  };

  const handleCrearProceso = async (values: any) => {
    if (!crearProcesoModal) return;
    try {
      await crearProceso(crearProcesoModal.cedula, {
        inmobiliaria_id: crearProcesoModal.inmobiliaria_id,
        proyecto_id: crearProcesoModal.proyecto_id,
        unidad_id: values.unidad_id,
      });
      message.success('Proceso creado');
      setCrearProcesoModal(null);
      formProceso.resetFields();
      if (drawerCliente) {
        const p = await getProcesosCliente(drawerCliente.cedula, drawerCliente.inmobiliaria_id);
        setDrawerProcesos(p);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al crear proceso');
    }
  };

  const handleCambiarEstatus = async (estatus: string, notificar: boolean) => {
    if (!estatusModal || !estatusCliente) return;
    try {
      await cambiarEstatus(estatusCliente.cedula, estatusModal.proyecto_id, estatusModal.unidad_id,
        { estatus, inmobiliaria_id: estatusModal.inmobiliaria_id, notificar });
      message.success(`Estatus actualizado a ${ESTADO_LABEL[estatus] ?? estatus}`);
      setEstatusModal(null); setEstatusCliente(null);
      if (drawerCliente) {
        const p = await getProcesosCliente(drawerCliente.cedula, drawerCliente.inmobiliaria_id);
        setDrawerProcesos(p);
      }
      cargar(proyectoFiltro, inmoFiltro);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Error al cambiar estatus');
      throw err;
    }
  };

  const handleRegistrar = async (values: any) => {
    try {
      await registrarCliente({ ...values, fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined });
      message.success('Cliente registrado');
      setModalOpen(false); form.resetFields();
      cargar(proyectoFiltro);
    } catch (err: any) {
      if (err?.response?.status === 409) message.error('Este cliente tiene exclusividad activa en este proyecto.');
      else message.error('Error al registrar cliente');
    }
  };

  const buscarPorCedula = async (cedula: string) => {
    if (!cedula.trim()) { setResultadoCedula(null); return; }
    setBuscandoCedula(true);
    try {
      const data = await buscarClienteAdmin(cedula.trim());
      setResultadoCedula(data);
    } catch { setResultadoCedula([]); }
    finally { setBuscandoCedula(false); }
  };

  const columnas = [
    {
      title: 'Cliente', key: 'cliente',
      render: (_: unknown, r: Cliente) => (
        <div>
          <Text strong>{r.nombres} {r.apellidos}</Text>
          <br /><Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text>
        </div>
      ),
    },
    { title: 'Proyecto', key: 'proyecto', render: (_: unknown, r: Cliente) => proyectoNombre(r.proyecto_id) },
    ...(isAdmin ? [{ title: 'Inmobiliaria', key: 'inmo', render: (_: unknown, r: Cliente) => <Tag>{inmoNombre(r.inmobiliaria_id)}</Tag> }] : []),
    {
      title: 'Exclusividad', key: 'exclusividad',
      render: (_: unknown, r: Cliente) => r.exclusividad_activa
        ? <Tag color="green">Activa hasta {dayjs(r.fecha_vencimiento).format('DD/MM/YYYY')}</Tag>
        : <Tag>Vencida</Tag>,
    },
    { title: 'Captado', dataIndex: 'fecha_captacion', key: 'fecha_captacion', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: '', key: 'acciones', render: (_: unknown, r: Cliente) => <Button size="small" type="link" onClick={() => abrirDrawerCliente(r)}>Ver detalle</Button> },
  ];

  const tablaClientes = (data: Cliente[]) => (
    <Table dataSource={data} columns={columnas} rowKey={r => `${r.pk}#${r.sk}`} loading={loading}
      pagination={false} locale={{ emptyText: 'Sin clientes' }}
      onRow={r => ({ onClick: () => abrirDrawerCliente(r), style: { cursor: 'pointer' } })}
    />
  );

  const tabItems = isAdmin ? [
    { key: 'todos', label: `Todos (${clientesFiltrados.length})`, children: tablaClientes(clientesFiltrados) },
    { key: 'activos', label: 'Exclusividad activa', children: tablaClientes(clientesFiltrados.filter(c => c.exclusividad_activa)) },
    { key: 'vencidos', label: 'Exclusividad vencida', children: tablaClientes(clientesFiltrados.filter(c => !c.exclusividad_activa)) },
  ] : [
    { key: 'activos', label: `Activos (${clientesFiltrados.filter(c => c.exclusividad_activa).length})`, children: tablaClientes(clientesFiltrados.filter(c => c.exclusividad_activa)) },
    { key: 'vencidos', label: `Vencidos (${clientesFiltrados.filter(c => !c.exclusividad_activa).length})`, children: tablaClientes(clientesFiltrados.filter(c => !c.exclusividad_activa)) },
  ];


  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Clientes</Title>
        <Space>
          {/* Búsqueda por nombre/cédula */}
          <Input
            prefix={<SearchOutlined />}
            placeholder="Buscar por nombre o cédula..."
            style={{ width: 240 }}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            allowClear
          />
          <Select allowClear placeholder="Filtrar por proyecto" style={{ width: 180 }}
            onChange={(v) => { setProyectoFiltro(v); setNextToken(undefined); cargar(v, inmoFiltro); }} value={proyectoFiltro}>
            {proyectos.map(p => <Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Option>)}
          </Select>
          {isAdmin && (
            <Select allowClear placeholder="Filtrar por inmobiliaria" style={{ width: 180 }}
              onChange={(v) => { setInmoFiltro(v); setNextToken(undefined); cargar(proyectoFiltro, v); }} value={inmoFiltro}>
              {inmobiliarias.map(i => <Option key={i.pk} value={i.pk}>{i.nombre}</Option>)}
            </Select>
          )}
          <Tooltip title="Actualizar">
            <Button icon={<ReloadOutlined />} onClick={() => { setNextToken(undefined); cargar(proyectoFiltro, inmoFiltro); }} loading={loading} />
          </Tooltip>
          {!isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Registrar cliente</Button>
          )}
        </Space>
      </div>

      {/* Búsqueda por cédula — solo admin */}
      {isAdmin && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>Buscar cliente por cédula exacta:</Text>
            <Input.Search
              placeholder="V-12345678"
              style={{ width: 220 }}
              loading={buscandoCedula}
              onSearch={buscarPorCedula}
              onChange={e => { if (!e.target.value) setResultadoCedula(null); }}
              allowClear
            />
          </Space>
          {resultadoCedula !== null && (
            <div style={{ marginTop: 12 }}>
              {resultadoCedula.length === 0 ? (
                <Text type="secondary">No se encontró ningún cliente con esa cédula.</Text>
              ) : (
                resultadoCedula.map(c => (
                  <div key={`${c.pk}#${c.sk}`} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <Text strong>{c.nombres} {c.apellidos}</Text>
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{c.cedula}</Text>
                        <br />
                        <Space size={4} style={{ marginTop: 4 }}>
                          <Tag>{proyectoNombre(c.proyecto_id)}</Tag>
                          <Tag>{inmoNombre(c.inmobiliaria_id)}</Tag>
                          {c.exclusividad_activa ? <Tag color="green">Exclusividad activa</Tag> : <Tag>Vencida</Tag>}
                        </Space>
                      </div>
                      <Button size="small" type="link" onClick={() => abrirDrawerCliente(c)}>Ver detalle</Button>
                    </div>
                    {c.procesos?.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Procesos: </Text>
                        <Space wrap>
                          {c.procesos.map((p: any) => (
                            <Tag key={p.sk} color={ESTADO_COLOR[p.estado]}>{p.unidad_nombre || p.unidad_id} — {ESTADO_LABEL[p.estado] ?? p.estado}</Tag>
                          ))}
                        </Space>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <Tabs items={tabItems} />

      {/* Cargar más */}
      {isAdmin && nextToken && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => cargar(proyectoFiltro, inmoFiltro, nextToken)} loading={loading}>Cargar más</Button>
        </div>
      )}

      {/* Drawer detalle cliente */}
      <Drawer
        title={drawerCliente ? `${drawerCliente.nombres} ${drawerCliente.apellidos}` : ''}
        open={!!drawerCliente}
        onClose={() => { setDrawerCliente(null); setDrawerProcesos([]); }}
        width={480}
        extra={isAdmin && drawerCliente && (
          <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(drawerCliente)}>Editar</Button>
        )}
      >
        {drawerCliente && (
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>Datos personales</Title>
            <Descriptions column={1} size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Cédula">{drawerCliente.cedula}</Descriptions.Item>
              {drawerCliente.correo && <Descriptions.Item label="Correo">{drawerCliente.correo}</Descriptions.Item>}
              {drawerCliente.telefono && <Descriptions.Item label="Teléfono">{drawerCliente.telefono}</Descriptions.Item>}
              {drawerCliente.edad && <Descriptions.Item label="Edad">{drawerCliente.edad} años</Descriptions.Item>}
              {drawerCliente.estado_civil && <Descriptions.Item label="Estado civil">{drawerCliente.estado_civil}</Descriptions.Item>}
              {drawerCliente.nacionalidad && <Descriptions.Item label="Nacionalidad">{drawerCliente.nacionalidad}</Descriptions.Item>}
              {drawerCliente.pais_residencia && <Descriptions.Item label="País residencia">{drawerCliente.pais_residencia}</Descriptions.Item>}
              <Descriptions.Item label="Proyecto">{proyectoNombre(drawerCliente.proyecto_id)}</Descriptions.Item>
              {isAdmin && <Descriptions.Item label="Inmobiliaria">{inmoNombre(drawerCliente.inmobiliaria_id)}</Descriptions.Item>}
              <Descriptions.Item label="Exclusividad">
                {drawerCliente.exclusividad_activa
                  ? <Tag color="green">Activa hasta {dayjs(drawerCliente.fecha_vencimiento).format('DD/MM/YYYY')}</Tag>
                  : <Tag>Vencida</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Captado">{dayjs(drawerCliente.fecha_captacion).format('DD/MM/YYYY')}</Descriptions.Item>
            </Descriptions>

            {/* Procesos — inmobiliaria solo lectura */}
            {!isAdmin && drawerProcesos.length > 0 && (
              <>
                <Title level={5} style={{ marginBottom: 8, marginTop: 16 }}>Procesos de venta</Title>
                {drawerProcesos.map(p => (
                  <div key={p.sk} style={{ padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}>
                    <Space>
                      <Tag color="geekblue">{p.unidad_nombre || p.unidad_id}</Tag>
                      <Tag color={ESTADO_COLOR[p.estado]}>{ESTADO_LABEL[p.estado] ?? p.estado}</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      Desde {dayjs(p.fecha_inicio).format('DD/MM/YYYY')}
                    </Text>
                  </div>
                ))}
              </>
            )}

            {/* Procesos — admin */}
            {isAdmin && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>Procesos de venta</Title>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => abrirCrearProceso(drawerCliente)}>Asignar unidad</Button>
                </div>
                {loadingProcesos ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
                ) : drawerProcesos.length === 0 ? (
                  <Text type="secondary">Sin procesos de venta registrados</Text>
                ) : (
                  drawerProcesos.map(p => (
                    <div key={p.sk} style={{ padding: '12px 14px', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <Tag color="geekblue">{p.unidad_nombre || p.unidad_id}</Tag>
                          <Tag color={ESTADO_COLOR[p.estado]}>{ESTADO_LABEL[p.estado] ?? p.estado}</Tag>
                        </Space>
                        <Space>
                          <Button size="small" type="link" icon={<SwapOutlined />}
                            onClick={() => { setEstatusModal(p); setEstatusCliente(drawerCliente); }}>Estatus</Button>
                          <Button size="small" type="link" icon={<HistoryOutlined />}
                            onClick={() => { setHistorialProceso(p); setHistorialClienteNombre(`${drawerCliente.nombres} ${drawerCliente.apellidos}`); }}>Historial</Button>
                        </Space>
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                        Inicio: {dayjs(p.fecha_inicio).format('DD/MM/YYYY')}
                      </Text>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* Modal registro */}
      <Modal title={<Space><UserOutlined /> Registrar cliente</Space>}
        open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()} okText="Registrar" cancelText="Cancelar" width={600}>
        <Form form={form} layout="vertical" onFinish={handleRegistrar}>
          <Form.Item name="proyecto_id" label="Proyecto" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un proyecto">
              {(usuario?.proyectos ?? proyectos.map(p => p.proyecto_id)).map(id => {
                const p = proyectos.find(x => x.proyecto_id === id);
                return <Option key={id} value={id}>{p?.nombre ?? id}</Option>;
              })}
            </Select>
          </Form.Item>
          <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true }]}><Input placeholder="V-12345678" /></Form.Item>
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input placeholder="+58 412 0000000" /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <Select allowClear placeholder="Selecciona">
              <Option value="soltero">Soltero/a</Option><Option value="casado">Casado/a</Option>
              <Option value="divorciado">Divorciado/a</Option><Option value="viudo">Viudo/a</Option>
              <Option value="union_libre">Unión libre</Option>
            </Select>
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Modal editar cliente — admin */}
      <Modal title="Editar datos del cliente" open={editarModal}
        onCancel={() => setEditarModal(false)} onOk={() => formEditar.submit()}
        okText="Guardar" cancelText="Cancelar" width={560}>
        <Form form={formEditar} layout="vertical" onFinish={handleEditar}>
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <Select allowClear>
              <Option value="soltero">Soltero/a</Option><Option value="casado">Casado/a</Option>
              <Option value="divorciado">Divorciado/a</Option><Option value="viudo">Viudo/a</Option>
              <Option value="union_libre">Unión libre</Option>
            </Select>
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Modal cambio de estatus */}
      {estatusModal && estatusCliente && (
        <CambiarEstatusModal open={!!estatusModal} proceso={estatusModal}
          tieneContacto={!!(estatusCliente.correo || estatusCliente.telefono)}
          onCancel={() => { setEstatusModal(null); setEstatusCliente(null); }}
          onConfirm={handleCambiarEstatus} />
      )}

      {/* Drawer historial */}
      <HistorialEstatusDrawer open={!!historialProceso} proceso={historialProceso}
        clienteNombre={historialClienteNombre} onClose={() => setHistorialProceso(null)} />

      {/* Modal asignar unidad */}
      <Modal title="Asignar unidad al cliente" open={!!crearProcesoModal}
        onCancel={() => { setCrearProcesoModal(null); formProceso.resetFields(); }}
        onOk={() => formProceso.submit()} okText="Crear proceso" cancelText="Cancelar">
        <Form form={formProceso} layout="vertical" onFinish={handleCrearProceso}>
          <Form.Item name="unidad_id" label="Unidad" rules={[{ required: true }]}>
            <Select placeholder="Selecciona una unidad" showSearch optionFilterProp="children">
              {unidadesProyecto.map(u => (
                <Option key={u.unidad_id} value={u.unidad_id}>
                  {u.id_unidad}
                  {u.estado === 'bloqueada' && <Tag color="warning" style={{ marginLeft: 8 }}>Bloqueada</Tag>}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientesPage;

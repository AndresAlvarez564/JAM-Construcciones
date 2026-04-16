import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Tag, Button, Modal, Form, Input, Select,
  DatePicker, message, Tabs, Space, Tooltip, Drawer, Descriptions,
} from 'antd';
import { PlusOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getClientes, getClientesAdmin, registrarCliente } from '../../services/clientes.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import { useAuthContext } from '../../context/AuthContext';
import type { Cliente, Proyecto } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

const ESTADO_COLOR: Record<string, string> = {
  captacion: 'blue', disponible: 'default', reserva: 'orange',
  separacion: 'purple', inicial: 'cyan', desvinculado: 'red',
};

const ClientesPage = () => {
  const { usuario } = useAuthContext();
  const isAdmin = usuario?.rol !== 'inmobiliaria';

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerCliente, setDrawerCliente] = useState<Cliente | null>(null);
  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [form] = Form.useForm();

  const cargar = useCallback(async (proyId?: string, inmoId?: string) => {
    setLoading(true);
    try {
      const data = isAdmin
        ? await getClientesAdmin(proyId || inmoId ? { proyecto_id: proyId, inmobiliaria_id: inmoId } : undefined)
        : await getClientes(proyId);
      setClientes(data);
    } catch { message.error('Error al cargar clientes'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    if (isAdmin) getInmobiliarias().then(setInmobiliarias).catch(() => {});
    cargar();
  }, [cargar, isAdmin]);

  const proyectoNombre = (id: string) => proyectos.find(p => p.proyecto_id === id)?.nombre ?? id;
  const inmoNombre = (id: string) => inmobiliarias.find(i => i.pk === id || i.pk === id)?.nombre ?? id;

  // Para admin: agrupar por cédula
  const agruparPorCedula = (data: Cliente[]) => {
    if (!isAdmin) return data;
    const map = new Map<string, Cliente & { _registros: Cliente[] }>();
    for (const c of data) {
      if (map.has(c.cedula)) {
        map.get(c.cedula)!._registros.push(c);
      } else {
        map.set(c.cedula, { ...c, _registros: [c] });
      }
    }
    return Array.from(map.values());
  };

  const handleRegistrar = async (values: any) => {
    try {
      await registrarCliente({
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
      message.success('Cliente registrado');
      setModalOpen(false);
      form.resetFields();
      cargar(proyectoFiltro);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) message.error('Este cliente tiene exclusividad activa con otra inmobiliaria en este proyecto.');
      else message.error('Error al registrar cliente');
    }
  };

  // Columnas simplificadas — solo datos personales
  const columnas = [
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_: unknown, r: Cliente) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.nombres} {r.apellidos}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.cedula}</Text>
        </Space>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (v: string, r: Cliente) => (
        <Space>
          <Tag color={ESTADO_COLOR[v] ?? 'default'}>{v}</Tag>
          {!r.exclusividad_activa && v === 'disponible' && <Tag>Vencido</Tag>}
        </Space>
      ),
    },
    {
      title: 'Exclusividad',
      dataIndex: 'fecha_vencimiento',
      key: 'fecha_vencimiento',
      render: (v: string, r: Cliente) =>
        r.exclusividad_activa ? dayjs(v).format('DD/MM/YYYY') : <Text type="secondary">Vencida</Text>,
    },
    {
      title: 'Captado',
      dataIndex: 'fecha_captacion',
      key: 'fecha_captacion',
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
    },
    {
      title: '',
      key: 'detalle',
      render: (_: unknown, r: Cliente) => (
        <Button size="small" type="link" onClick={() => setDrawerCliente(r)}>Ver detalle</Button>
      ),
    },
  ];

  const tabActivos = clientes.filter(c => c.exclusividad_activa);
  const tabVencidos = clientes.filter(c => !c.exclusividad_activa && c.estado === 'disponible');
  const tabProceso = clientes.filter(c => ['reserva', 'separacion', 'inicial', 'desvinculado'].includes(c.estado));

  const tablaClientes = (data: Cliente[]) => (
    <Table
      dataSource={isAdmin ? agruparPorCedula(data) : data}
      columns={columnas} rowKey="pk" loading={loading}
      pagination={{ pageSize: 20 }} locale={{ emptyText: 'Sin clientes' }}
      onRow={r => ({ onClick: () => setDrawerCliente(r), style: { cursor: 'pointer' } })}
    />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Clientes</Title>
        <Space>
          <Select allowClear placeholder="Filtrar por proyecto" style={{ width: 200 }}
            onChange={(v) => { setProyectoFiltro(v); cargar(v, inmoFiltro); }} value={proyectoFiltro}>
            {proyectos.map(p => <Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Option>)}
          </Select>
          {isAdmin && (
            <Select allowClear placeholder="Filtrar por inmobiliaria" style={{ width: 200 }}
              onChange={(v) => { setInmoFiltro(v); cargar(proyectoFiltro, v); }} value={inmoFiltro}>
              {inmobiliarias.map(i => <Option key={i.pk} value={i.pk}>{i.nombre}</Option>)}
            </Select>
          )}
          <Tooltip title="Actualizar">
            <Button icon={<ReloadOutlined />} onClick={() => cargar(proyectoFiltro, inmoFiltro)} loading={loading} />
          </Tooltip>
          {!isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Registrar cliente
            </Button>
          )}
        </Space>
      </div>

      <Tabs items={[
        { key: 'activos', label: `Activos (${tabActivos.length})`, children: tablaClientes(tabActivos) },
        { key: 'vencidos', label: `Vencidos (${tabVencidos.length})`, children: tablaClientes(tabVencidos) },
        { key: 'proceso', label: `En proceso (${tabProceso.length})`, children: tablaClientes(tabProceso) },
      ]} />

      {/* Drawer detalle cliente */}
      <Drawer
        title={drawerCliente ? `${drawerCliente.nombres} ${drawerCliente.apellidos}` : ''}
        open={!!drawerCliente}
        onClose={() => setDrawerCliente(null)}
        width={420}
      >
        {drawerCliente && (
          <div>
            {/* Proyecto e inmobiliaria — admin ve todos los registros */}
            <Title level={5} style={{ marginBottom: 8 }}>Proyectos e inmobiliarias</Title>
            {isAdmin ? (
              <div style={{ marginBottom: 20 }}>
                {((drawerCliente as any)._registros ?? [drawerCliente]).map((r: Cliente) => (
                  <div key={r.pk} style={{
                    padding: '10px 14px', background: '#fafafa', border: '1px solid #f0f0f0',
                    borderRadius: 8, marginBottom: 8,
                  }}>
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Text strong>{proyectoNombre(r.proyecto_id)}</Text>
                        <Tag color={ESTADO_COLOR[r.estado] ?? 'default'}>{r.estado}</Tag>
                        {!r.exclusividad_activa && <Tag>Vencido</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Inmobiliaria: {inmoNombre(r.inmobiliaria_id)}
                      </Text>
                      {r.unidades?.length ? (
                        <Space wrap>
                          {r.unidades.map(u => <Tag key={u.unidad_id} color="blue">{u.unidad_nombre}</Tag>)}
                        </Space>
                      ) : <Text type="secondary" style={{ fontSize: 12 }}>Sin unidades</Text>}
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 20 }}>
                <Descriptions.Item label="Proyecto">
                  <Text strong>{proyectoNombre(drawerCliente.proyecto_id)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Estado">
                  <Tag color={ESTADO_COLOR[drawerCliente.estado] ?? 'default'}>{drawerCliente.estado}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Exclusividad">
                  {drawerCliente.exclusividad_activa
                    ? <Tag color="green">Activa hasta {dayjs(drawerCliente.fecha_vencimiento).format('DD/MM/YYYY')}</Tag>
                    : <Tag>Vencida</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Unidades">
                  {drawerCliente.unidades?.length
                    ? <Space wrap>{drawerCliente.unidades.map(u => <Tag key={u.unidad_id} color="blue">{u.unidad_nombre}</Tag>)}</Space>
                    : <Text type="secondary">—</Text>}
                </Descriptions.Item>
              </Descriptions>
            )}

            {/* Datos personales */}
            <Title level={5} style={{ marginBottom: 8 }}>Datos personales</Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Cédula">{drawerCliente.cedula}</Descriptions.Item>
              {drawerCliente.correo && <Descriptions.Item label="Correo">{drawerCliente.correo}</Descriptions.Item>}
              {drawerCliente.telefono && <Descriptions.Item label="Teléfono">{drawerCliente.telefono}</Descriptions.Item>}
              {drawerCliente.edad && <Descriptions.Item label="Edad">{drawerCliente.edad} años</Descriptions.Item>}
              {drawerCliente.estado_civil && <Descriptions.Item label="Estado civil">{drawerCliente.estado_civil}</Descriptions.Item>}
              {drawerCliente.nacionalidad && <Descriptions.Item label="Nacionalidad">{drawerCliente.nacionalidad}</Descriptions.Item>}
              {drawerCliente.pais_residencia && <Descriptions.Item label="País residencia">{drawerCliente.pais_residencia}</Descriptions.Item>}
              <Descriptions.Item label="Captado">{dayjs(drawerCliente.fecha_captacion).format('DD/MM/YYYY')}</Descriptions.Item>
            </Descriptions>
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
          <Form.Item name="cedula" label="Cédula / Pasaporte" rules={[{ required: true }]}>
            <Input placeholder="V-12345678" />
          </Form.Item>
          <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
          <Form.Item name="telefono" label="Teléfono"><Input placeholder="+58 412 0000000" /></Form.Item>
          <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="estado_civil" label="Estado civil">
            <Select allowClear placeholder="Selecciona">
              <Option value="soltero">Soltero/a</Option>
              <Option value="casado">Casado/a</Option>
              <Option value="divorciado">Divorciado/a</Option>
              <Option value="viudo">Viudo/a</Option>
              <Option value="union_libre">Unión libre</Option>
            </Select>
          </Form.Item>
          <Form.Item name="nacionalidad" label="Nacionalidad"><Input /></Form.Item>
          <Form.Item name="pais_residencia" label="País de residencia"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientesPage;

import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Space, Popconfirm,
  Typography, Drawer, Tooltip, Select, message, Card, Row, Col, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckOutlined,
  DeleteOutlined, BankOutlined,
} from '@ant-design/icons';
import {
  getInmobiliarias, crearInmobiliaria, actualizarInmobiliaria,
  deshabilitarInmobiliaria, habilitarInmobiliaria, eliminarInmobiliaria,
  getUsuariosInmobiliaria, crearUsuarioInmobiliaria,
  deshabilitarUsuario, habilitarUsuario, eliminarUsuarioInmobiliaria,
  type Inmobiliaria, type UsuarioInmo,
} from '../../services/inmobiliarias.service';
import { getProyectos } from '../../services/proyectos.service';
import type { Proyecto } from '../../types';

const { Title, Text } = Typography;

type ModalMode = 'crear' | 'editar';

const InmobiliariasPage = () => {
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);

  // modal inmobiliaria
  const [modalInmo, setModalInmo] = useState(false);
  const [modoInmo, setModoInmo] = useState<ModalMode>('crear');
  const [inmoEditando, setInmoEditando] = useState<Inmobiliaria | null>(null);
  const [formInmo] = Form.useForm();

  // drawer usuarios
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inmoSeleccionada, setInmoSeleccionada] = useState<Inmobiliaria | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioInmo[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario] = Form.useForm();

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [inmos, projs] = await Promise.all([getInmobiliarias(), getProyectos()]);
      setInmobiliarias(inmos);
      setProyectos(projs);
    } catch {
      message.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  // ── Inmobiliarias ──────────────────────────────────────────

  const abrirCrear = () => {
    setModoInmo('crear'); setInmoEditando(null);
    formInmo.resetFields(); setModalInmo(true);
  };

  const abrirEditar = (inmo: Inmobiliaria, e: React.MouseEvent) => {
    e.stopPropagation();
    setModoInmo('editar'); setInmoEditando(inmo);
    formInmo.setFieldsValue({ nombre: inmo.nombre, correos: inmo.correos, proyectos: inmo.proyectos });
    setModalInmo(true);
  };

  const handleGuardarInmo = async (values: { nombre: string; correos: string[]; proyectos: string[] }) => {
    try {
      if (modoInmo === 'crear') {
        await crearInmobiliaria(values); message.success('Inmobiliaria creada');
      } else if (inmoEditando) {
        await actualizarInmobiliaria(inmoEditando.pk, values); message.success('Inmobiliaria actualizada');
      }
      setModalInmo(false); await cargar();
    } catch { message.error('Error al guardar'); }
  };

  const handleToggleInmo = async (inmo: Inmobiliaria, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (inmo.activo) {
        await deshabilitarInmobiliaria(inmo.pk); message.success('Inmobiliaria deshabilitada');
      } else {
        await habilitarInmobiliaria(inmo.pk); message.success('Inmobiliaria habilitada');
      }
      await cargar();
    } catch { message.error('Error al cambiar estado'); }
  };

  const handleEliminarInmo = async (inmo: Inmobiliaria) => {
    try {
      await eliminarInmobiliaria(inmo.pk); message.success('Inmobiliaria eliminada');
      await cargar();
    } catch { message.error('Error al eliminar'); }
  };

  // ── Usuarios ───────────────────────────────────────────────

  const abrirUsuarios = async (inmo: Inmobiliaria) => {
    setInmoSeleccionada(inmo); setDrawerOpen(true); setLoadingUsuarios(true);
    try {
      setUsuarios(await getUsuariosInmobiliaria(inmo.pk));
    } catch { message.error('Error al cargar usuarios'); }
    finally { setLoadingUsuarios(false); }
  };

  const handleCrearUsuario = async (values: { username: string; password: string; nombre?: string }) => {
    if (!inmoSeleccionada) return;
    try {
      await crearUsuarioInmobiliaria(inmoSeleccionada.pk, values);
      message.success('Usuario creado');
      setModalUsuario(false); formUsuario.resetFields();
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al crear usuario'); }
  };

  const handleToggleUsuario = async (u: UsuarioInmo) => {
    if (!inmoSeleccionada) return;
    try {
      if (u.activo) {
        await deshabilitarUsuario(inmoSeleccionada.pk, u.pk); message.success('Usuario deshabilitado');
      } else {
        await habilitarUsuario(inmoSeleccionada.pk, u.pk); message.success('Usuario habilitado');
      }
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al cambiar estado'); }
  };

  const handleEliminarUsuario = async (u: UsuarioInmo) => {
    if (!inmoSeleccionada) return;
    try {
      await eliminarUsuarioInmobiliaria(inmoSeleccionada.pk, u.pk); message.success('Usuario eliminado');
      setUsuarios(await getUsuariosInmobiliaria(inmoSeleccionada.pk));
    } catch { message.error('Error al eliminar'); }
  };

  const columnsUsuarios = [
    { title: 'Usuario', dataIndex: 'cognito_username', key: 'cognito_username' },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Estado', dataIndex: 'activo', key: 'activo',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: '', key: 'acciones', width: 140,
      render: (_: any, u: UsuarioInmo) => (
        <Space>
          <Popconfirm
            title={u.activo ? '¿Deshabilitar usuario?' : '¿Habilitar usuario?'}
            okText="Sí" cancelText="No"
            onConfirm={() => handleToggleUsuario(u)}
          >
            <Button size="small" danger={u.activo} type={u.activo ? 'default' : 'primary'}
              icon={u.activo ? <StopOutlined /> : <CheckOutlined />}>
              {u.activo ? 'Deshabilitar' : 'Habilitar'}
            </Button>
          </Popconfirm>
          <Popconfirm title="¿Eliminar usuario?" okText="Sí" cancelText="No" okButtonProps={{ danger: true }}
            onConfirm={() => handleEliminarUsuario(u)}>
            <Tooltip title="Eliminar">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Inmobiliarias</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrear}>
          Nueva inmobiliaria
        </Button>
      </div>

      {/* Cards */}
      <Row gutter={[16, 16]}>
        {inmobiliarias.map(inmo => (
          <Col key={inmo.pk} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              onClick={() => abrirUsuarios(inmo)}
              styles={{ body: { padding: 20 } }}
              style={{ borderRadius: 10, opacity: inmo.activo ? 1 : 0.6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  <BankOutlined style={{ fontSize: 26, color: inmo.activo ? '#1677ff' : '#aaa', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 15 }}>{inmo.nombre}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Badge status={inmo.activo ? 'success' : 'error'} text={inmo.activo ? 'Activa' : 'Inactiva'} />
                    </div>
                    {inmo.proyectos?.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {inmo.proyectos.map(id => {
                          const p = proyectos.find(p => p.proyecto_id === id);
                          return <Tag key={id} style={{ margin: 0 }}>{p?.nombre || id}</Tag>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <Space style={{ flexShrink: 0, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                  <Tooltip title="Editar">
                    <Button size="small" icon={<EditOutlined />} onClick={(e) => abrirEditar(inmo, e)} />
                  </Tooltip>
                  <Popconfirm
                    title={inmo.activo ? '¿Deshabilitar inmobiliaria?' : '¿Habilitar inmobiliaria?'}
                    okText="Sí" cancelText="No"
                    onConfirm={(e) => handleToggleInmo(inmo, e as any)}
                  >
                    <Tooltip title={inmo.activo ? 'Deshabilitar' : 'Habilitar'}>
                      <Button size="small" danger={inmo.activo} icon={inmo.activo ? <StopOutlined /> : <CheckOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                  <Popconfirm title="¿Eliminar inmobiliaria?" okText="Sí" cancelText="No" okButtonProps={{ danger: true }}
                    onConfirm={() => handleEliminarInmo(inmo)}>
                    <Tooltip title="Eliminar">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          </Col>
        ))}
        {!loading && inmobiliarias.length === 0 && (
          <Col span={24}><Text type="secondary">No hay inmobiliarias registradas.</Text></Col>
        )}
      </Row>

      {/* Modal inmobiliaria */}
      <Modal
        title={modoInmo === 'crear' ? 'Nueva inmobiliaria' : 'Editar inmobiliaria'}
        open={modalInmo}
        onCancel={() => setModalInmo(false)}
        onOk={() => formInmo.submit()}
        okText={modoInmo === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
        width={520}
      >
        <Form form={formInmo} layout="vertical" onFinish={handleGuardarInmo}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Inmobiliaria XYZ" />
          </Form.Item>
          <Form.Item name="correos" label="Correos de notificación">
            <Select mode="tags" placeholder="Escribe un correo y presiona Enter" tokenSeparators={[',']} />
          </Form.Item>
          <Form.Item name="proyectos" label="Proyectos asignados">
            <Select mode="multiple" placeholder="Selecciona proyectos">
              {proyectos.map(p => (
                <Select.Option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer usuarios */}
      <Drawer
        title={`Usuarios — ${inmoSeleccionada?.nombre}`}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setInmoSeleccionada(null); }}
        width={480}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalUsuario(true)}>
            Nuevo usuario
          </Button>
        }
      >
        <Table
          dataSource={usuarios} columns={columnsUsuarios}
          rowKey="pk" loading={loadingUsuarios} pagination={false} size="small"
        />
      </Drawer>

      {/* Modal nuevo usuario */}
      <Modal
        title="Nuevo usuario"
        open={modalUsuario}
        onCancel={() => { setModalUsuario(false); formUsuario.resetFields(); }}
        onOk={() => formUsuario.submit()}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={formUsuario} layout="vertical" onFinish={handleCrearUsuario}>
          <Form.Item name="nombre" label="Nombre visible">
            <Input placeholder="Ej: Vendedor Norte" />
          </Form.Item>
          <Form.Item name="username" label="Nombre de usuario" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: VendedorXYZ (sin espacios ni correo)" />
          </Form.Item>
          <Form.Item name="correo" label="Correo"
            rules={[{ required: true, message: 'Requerido' }, { type: 'email', message: 'Correo inválido' }]}>
            <Input placeholder="correo@ejemplo.com" />
          </Form.Item>
          <Form.Item name="password" label="Contraseña temporal"
            rules={[{ required: true, message: 'Requerido' }, { min: 8, message: 'Mínimo 8 caracteres' }]}>
            <Input.Password placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InmobiliariasPage;

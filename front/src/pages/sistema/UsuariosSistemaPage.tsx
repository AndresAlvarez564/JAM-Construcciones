import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Tag, Space,
  Popconfirm, Typography, Select, Tooltip, message, Grid, Dropdown,
} from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined, MoreOutlined } from '@ant-design/icons';
import {
  getUsuariosSistema, crearUsuarioSistema, actualizarUsuarioSistema,
  deshabilitarUsuarioSistema, habilitarUsuarioSistema, eliminarUsuarioSistema,
  type UsuarioSistema,
} from '../../services/sistema.service';
import type { RolInterno } from '../../types';

const { Title } = Typography;
const { useBreakpoint } = Grid;

const ROL_LABELS: Record<RolInterno, string> = {
  admin: 'Admin',
  coordinador: 'Coordinador',
  supervisor: 'Supervisor',
};

const ROL_COLORS: Record<RolInterno, string> = {
  admin: 'red',
  coordinador: 'blue',
  supervisor: 'purple',
};

type ModalMode = 'crear' | 'editar';

const UsuariosSistemaPage = () => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [modo, setModo] = useState<ModalMode>('crear');
  const [editando, setEditando] = useState<UsuarioSistema | null>(null);
  const [form] = Form.useForm();
  const { md } = useBreakpoint();
  const isMobile = !md;

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try { setUsuarios(await getUsuariosSistema()); }
    catch { message.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  };

  const abrirCrear = () => {
    setModo('crear');
    setEditando(null);
    form.resetFields();
    setModal(true);
  };

  const abrirEditar = (u: UsuarioSistema) => {
    setModo('editar');
    setEditando(u);
    form.setFieldsValue({ nombre: u.nombre, rol: u.rol });
    setModal(true);
  };

  const handleGuardar = async (values: any) => {
    try {
      if (modo === 'crear') {
        await crearUsuarioSistema(values);
        message.success('Usuario creado');
      } else if (editando) {
        await actualizarUsuarioSistema(editando.pk, { nombre: values.nombre, rol: values.rol });
        message.success('Usuario actualizado');
      }
      setModal(false);
      await cargar();
    } catch (err: any) {
      try {
        const body = await err?.response?.body?.json?.();
        message.error(body?.message ?? 'Error al guardar');
      } catch {
        message.error('Error al guardar');
      }
    }
  };

  const handleToggle = async (u: UsuarioSistema) => {
    try {
      if (u.activo) {
        await deshabilitarUsuarioSistema(u.pk);
        message.success('Usuario deshabilitado');
      } else {
        await habilitarUsuarioSistema(u.pk);
        message.success('Usuario habilitado');
      }
      await cargar();
    } catch {
      message.error('Error al cambiar estado');
    }
  };

  const handleEliminar = async (u: UsuarioSistema) => {
    try {
      await eliminarUsuarioSistema(u.pk);
      message.success('Usuario eliminado');
      await cargar();
    } catch {
      message.error('Error al eliminar');
    }
  };

  const columns = [
    { title: 'Usuario', dataIndex: 'cognito_username', key: 'cognito_username' },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Rol', dataIndex: 'rol', key: 'rol',
      render: (v: RolInterno) => <Tag color={ROL_COLORS[v]}>{ROL_LABELS[v]}</Tag>,
    },
    ...(!isMobile ? [{
      title: 'Estado', dataIndex: 'activo', key: 'activo',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    }] : []),
    {
      title: '', key: 'acciones', width: isMobile ? 48 : 130,
      render: (_: any, u: UsuarioSistema) => {
        if (isMobile) {
          const items = [
            { key: 'editar', icon: <EditOutlined />, label: 'Editar', onClick: () => abrirEditar(u) },
            {
              key: 'toggle', icon: u.activo ? <StopOutlined /> : <CheckOutlined />,
              label: u.activo ? 'Deshabilitar' : 'Habilitar', danger: u.activo,
              onClick: () => handleToggle(u),
            },
            {
              key: 'eliminar', icon: <DeleteOutlined />, label: 'Eliminar', danger: true,
              onClick: () => {
                Modal.confirm({
                  title: '¿Eliminar usuario?', okText: 'Eliminar',
                  cancelText: 'Cancelar', okButtonProps: { danger: true },
                  onOk: () => handleEliminar(u),
                });
              },
            },
          ];
          return <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight"><Button size="small" icon={<MoreOutlined />} /></Dropdown>;
        }
        return (
          <Space>
            <Tooltip title="Editar">
              <Button size="small" icon={<EditOutlined />} onClick={() => abrirEditar(u)} />
            </Tooltip>
            <Popconfirm title={u.activo ? 'Deshabilitar usuario?' : 'Habilitar usuario?'} okText="Si" cancelText="No" onConfirm={() => handleToggle(u)}>
              <Tooltip title={u.activo ? 'Deshabilitar' : 'Habilitar'}>
                <Button size="small" danger={u.activo} icon={u.activo ? <StopOutlined /> : <CheckOutlined />} />
              </Tooltip>
            </Popconfirm>
            <Popconfirm title="Eliminar usuario permanentemente?" okText="Si" cancelText="No" okButtonProps={{ danger: true }} onConfirm={() => handleEliminar(u)}>
              <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Usuarios del sistema</Title>
        <Space>
          <Tooltip title="Actualizar">
            <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading} />
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} onClick={abrirCrear}>
            {isMobile ? '' : 'Nuevo usuario'}
          </Button>
        </Space>
      </div>

      <Table
        dataSource={usuarios} columns={columns}
        rowKey="pk" loading={loading} pagination={{ pageSize: 20 }}
        scroll={{ x: true }}
      />

      <Modal
        title={modo === 'crear' ? 'Nuevo usuario' : 'Editar usuario'}
        open={modal}
        onCancel={() => setModal(false)}
        onOk={() => form.submit()}
        okText={modo === 'crear' ? 'Crear' : 'Guardar'}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleGuardar}>
          <Form.Item name="nombre" label="Nombre visible" rules={[{ required: true, message: 'Requerido' }]}>
            <Input placeholder="Ej: Juan Perez" />
          </Form.Item>
          {modo === 'crear' && (
            <>
              <Form.Item name="username" label="Nombre de usuario" rules={[{ required: true, message: 'Requerido' }]}>
                <Input placeholder="Sin espacios ni correo" />
              </Form.Item>
              <Form.Item
                name="password" label="Contrasena temporal"
                rules={[{ required: true, message: 'Requerido' }, { min: 8, message: 'Minimo 8 caracteres' }]}
              >
                <Input.Password placeholder="Minimo 8 caracteres, 1 mayuscula, 1 numero" />
              </Form.Item>
              <Form.Item
                name="correo" label="Correo"
                rules={[{ type: 'email', message: 'Correo invalido' }]}
              >
                <Input placeholder="correo@ejemplo.com" />
              </Form.Item>
            </>
          )}
          <Form.Item name="rol" label="Rol" rules={[{ required: true, message: 'Requerido' }]}>
            <Select placeholder="Selecciona un rol">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="coordinador">Coordinador</Select.Option>
              <Select.Option value="supervisor">Supervisor</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsuariosSistemaPage;

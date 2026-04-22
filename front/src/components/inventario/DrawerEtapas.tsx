import { Drawer, Form, Input, Button, Space, Popconfirm, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Etapa } from '../../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  etapas: Etapa[];
  etapaEditando: Etapa | null;
  onClose: () => void;
  onGuardar: (values: any) => void;
  onEliminar: (etapaId: string) => void;
  onEditar: (etapa: Etapa) => void;
  onCancelarEdicion: () => void;
}

const DrawerEtapas = ({ open, etapas, etapaEditando, onClose, onGuardar, onEliminar, onEditar, onCancelarEdicion }: Props) => {
  const [form] = Form.useForm();

  const handleGuardar = (values: any) => {
    onGuardar(values);
    form.resetFields();
  };

  return (
    <Drawer title="Gestionar etapas" open={open} onClose={() => { onClose(); form.resetFields(); }} width={380}>
      <Form form={form} layout="vertical" onFinish={handleGuardar}
        initialValues={etapaEditando ? { nombre: etapaEditando.nombre, orden: etapaEditando.orden } : {}}>
        <Form.Item name="nombre" label="Nombre de la etapa" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="orden" label="Orden"><Input type="number" /></Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">{etapaEditando ? 'Actualizar' : 'Crear'}</Button>
          {etapaEditando && <Button onClick={() => { onCancelarEdicion(); form.resetFields(); }}>Cancelar</Button>}
        </Space>
      </Form>
      <div style={{ marginTop: 24 }}>
        {etapas.map(e => (
          <div key={e.etapa_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Text>{e.nombre}</Text>
            <Space>
              <Button size="small" icon={<EditOutlined />} onClick={() => { onEditar(e); form.setFieldsValue({ nombre: e.nombre, orden: e.orden }); }} />
              <Popconfirm title="¿Eliminar etapa?" okText="Sí" cancelText="No" onConfirm={() => onEliminar(e.etapa_id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          </div>
        ))}
      </div>
    </Drawer>
  );
};

export default DrawerEtapas;

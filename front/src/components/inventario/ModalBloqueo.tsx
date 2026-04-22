import { Modal, Form, Input, Button, Space, Typography } from 'antd';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import type { Cliente, Unidad } from '../../types';

const { Text } = Typography;

interface Props {
  open: boolean;
  unidad: Unidad | null;
  clienteEncontrado: Cliente | null;
  buscandoCliente: boolean;
  guardando: boolean;
  onCancel: () => void;
  onBuscar: (cedula: string) => void;
  onBloquear: (omitirCliente: boolean, values?: any) => void;
}

const ModalBloqueo = ({ open, unidad, clienteEncontrado, buscandoCliente, guardando, onCancel, onBuscar, onBloquear }: Props) => {
  const [form] = Form.useForm();

  const handleCancel = () => { form.resetFields(); onCancel(); };

  const handleBloquear = async (omitir: boolean) => {
    if (omitir) { onBloquear(true); return; }
    try {
      const values = await form.validateFields();
      onBloquear(false, {
        ...values,
        fecha_nacimiento: values.fecha_nacimiento ? dayjs(values.fecha_nacimiento).format('YYYY-MM-DD') : undefined,
      });
    } catch { /* validación falló */ }
  };

  return (
    <Modal title={`Bloquear unidad ${unidad?.id_unidad}`} open={open}
      onCancel={handleCancel} footer={null} width={560} afterClose={() => form.resetFields()}>
      <Form form={form} layout="vertical">
        <Form.Item name="cedula" label="Cédula del cliente" rules={[{ required: true }]}>
          <Input.Search placeholder="V-12345678" loading={buscandoCliente} onSearch={onBuscar} enterButton="Buscar" />
        </Form.Item>
        {clienteEncontrado && (
          <Text type="success" style={{ display: 'block', marginBottom: 12 }}>
            ✓ Cliente encontrado: {clienteEncontrado.nombres} {clienteEncontrado.apellidos}
          </Text>
        )}
        <Form.Item name="nombres" label="Nombres" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="apellidos" label="Apellidos" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="correo" label="Correo"><Input type="email" /></Form.Item>
        <Form.Item name="telefono" label="Teléfono"><Input /></Form.Item>
        <Form.Item name="fecha_nacimiento" label="Fecha de nacimiento">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={() => handleBloquear(true)} loading={guardando}>Bloquear sin cliente</Button>
        <Button type="primary" onClick={() => handleBloquear(false)} loading={guardando}>Bloquear con cliente</Button>
      </Space>
    </Modal>
  );
};

export default ModalBloqueo;

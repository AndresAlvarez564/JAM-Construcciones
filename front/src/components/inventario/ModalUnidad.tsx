import { Modal, Form, Input, Select } from 'antd';
import type { Etapa, Unidad } from '../../types';

const { Option } = Select;

interface Props {
  open: boolean;
  modo: 'crear' | 'editar';
  etapas: Etapa[];
  unidadEditando: Unidad | null;
  onCancel: () => void;
  onFinish: (values: any) => void;
}

const ModalUnidad = ({ open, modo, etapas, onCancel, onFinish }: Props) => {
  const [form] = Form.useForm();

  const handleCancel = () => { form.resetFields(); onCancel(); };

  return (
    <Modal title={modo === 'crear' ? 'Nueva unidad' : 'Editar unidad'}
      open={open} onCancel={handleCancel} onOk={() => form.submit()}
      okText="Guardar" cancelText="Cancelar" afterClose={() => form.resetFields()}>
      <Form form={form} layout="vertical" onFinish={values => { onFinish(values); form.resetFields(); }}>
        <Form.Item name="id_unidad" label="ID Unidad (ej: A7237)" rules={[{ required: true }]}>
          <Input placeholder="A7237" />
        </Form.Item>
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
  );
};

export default ModalUnidad;

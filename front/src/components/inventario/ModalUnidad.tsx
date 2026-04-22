import { Modal, Form, Input, Select, Row, Col } from 'antd';
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
    <Modal
      title={modo === 'crear' ? 'Nueva unidad' : 'Editar unidad'}
      open={open}
      onCancel={handleCancel}
      onOk={() => form.submit()}
      okText="Guardar"
      cancelText="Cancelar"
      width={520}
      afterClose={() => form.resetFields()}
    >
      <Form form={form} layout="vertical" onFinish={values => { onFinish(values); form.resetFields(); }}>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="id_unidad" label="ID Unidad" rules={[{ required: true }]}>
              <Input placeholder="A7237" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="etapa_id" label="Etapa" rules={[{ required: true }]}>
              <Select placeholder="Selecciona una etapa">
                {etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="tipo" label="Tipo">
              <Input placeholder="Apartamento..." />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="manzana" label="Manzana">
              <Input placeholder="Manzana A" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="piso" label="Piso">
              <Input placeholder="3" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="metraje" label="Metraje" rules={[{ required: true }]}>
              <Input type="number" addonAfter="m²" placeholder="0" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="precio" label="Precio" rules={[{ required: true }]}>
              <Input type="number" addonBefore="$" placeholder="0" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default ModalUnidad;

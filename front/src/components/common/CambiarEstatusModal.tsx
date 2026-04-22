import { useState } from 'react';
import { Modal, Select, Switch, Space, Typography, Alert, Tag, Divider } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import type { Proceso } from '../../types';

const { Text } = Typography;
const { Option } = Select;

const TRANSICIONES: Record<string, string[]> = {
  captacion:  ['reserva', 'desvinculado'],
  reserva:    ['separacion', 'desvinculado'],
  separacion: ['inicial', 'desvinculado'],
  inicial:    ['desvinculado'],
};

const ESTADO_COLOR: Record<string, string> = {
  captacion: 'blue', disponible: 'default', reserva: 'orange',
  separacion: 'purple', inicial: 'cyan', desvinculado: 'red',
};

const ESTADO_LABEL: Record<string, string> = {
  captacion: 'Captación', disponible: 'Disponible', reserva: 'Reserva',
  separacion: 'Separación', inicial: 'Inicial', desvinculado: 'Desvinculado',
};

interface Props {
  open: boolean;
  proceso: Proceso;
  tieneContacto: boolean;
  onCancel: () => void;
  onConfirm: (estatus: string, notificar: boolean) => Promise<void>;
}

const CambiarEstatusModal = ({ open, proceso, tieneContacto, onCancel, onConfirm }: Props) => {
  const [nuevoEstatus, setNuevoEstatus] = useState<string | undefined>();
  const [notificar, setNotificar] = useState(false);
  const [loading, setLoading] = useState(false);

  const opciones = TRANSICIONES[proceso.estado] ?? [];

  const handleOk = async () => {
    if (!nuevoEstatus) return;
    setLoading(true);
    try {
      await onConfirm(nuevoEstatus, notificar);
      setNuevoEstatus(undefined);
      setNotificar(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNuevoEstatus(undefined);
    setNotificar(false);
    onCancel();
  };

  return (
    <Modal
      title="Cambiar estatus del proceso"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Confirmar"
      cancelText="Cancelar"
      okButtonProps={{ disabled: !nuevoEstatus, loading }}
      width={440}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">

        {/* Unidad */}
        <div style={{
          background: '#f5f5f5', borderRadius: 8, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Unidad</Text>
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {proceso.unidad_nombre || proceso.unidad_id}
          </Tag>
        </div>

        {/* Transición visual */}
        <div style={{
          background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8,
          padding: '12px 16px',
        }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Transición de estatus
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag color={ESTADO_COLOR[proceso.estado]} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
              {ESTADO_LABEL[proceso.estado] ?? proceso.estado}
            </Tag>
            <ArrowRightOutlined style={{ color: '#bfbfbf' }} />
            {nuevoEstatus ? (
              <Tag color={ESTADO_COLOR[nuevoEstatus]} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
                {ESTADO_LABEL[nuevoEstatus] ?? nuevoEstatus}
              </Tag>
            ) : (
              <Tag style={{ margin: 0, fontSize: 13, padding: '2px 10px', color: '#bfbfbf', borderStyle: 'dashed' }}>
                Selecciona
              </Tag>
            )}
          </div>
        </div>

        {/* Selector */}
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Nuevo estatus</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Selecciona el nuevo estatus"
            value={nuevoEstatus}
            onChange={setNuevoEstatus}
          >
            {opciones.map(op => (
              <Option key={op} value={op}>
                <Tag color={ESTADO_COLOR[op]} style={{ margin: 0 }}>{ESTADO_LABEL[op] ?? op}</Tag>
              </Option>
            ))}
          </Select>
          {opciones.length === 0 && (
            <Alert style={{ marginTop: 8 }} type="warning"
              message="No hay transiciones disponibles desde este estatus." showIcon />
          )}
        </div>

        {/* Notificación */}
        {tieneContacto && nuevoEstatus && (
          <>
            <Divider style={{ margin: '0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text>Notificar al cliente</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>Se enviará un correo/mensaje al cliente</Text>
              </div>
              <Switch checked={notificar} onChange={setNotificar} />
            </div>
          </>
        )}

        {nuevoEstatus === 'reserva' && (
          <Alert type="info" showIcon message="La unidad pasará a no disponible." />
        )}
        {nuevoEstatus === 'desvinculado' && (
          <Alert type="warning" showIcon message="La unidad volverá a estar disponible." />
        )}

      </Space>
    </Modal>
  );
};

export default CambiarEstatusModal;

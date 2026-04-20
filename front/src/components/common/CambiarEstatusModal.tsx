import { useState } from 'react';
import { Modal, Select, Switch, Space, Typography, Alert, Tag } from 'antd';
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

        <div>
          <Text type="secondary">Unidad</Text>
          <div style={{ marginTop: 4 }}>
            <Tag color="geekblue">{proceso.unidad_nombre || proceso.unidad_id}</Tag>
          </div>
        </div>

        <div>
          <Text type="secondary">Estatus actual</Text>
          <div style={{ marginTop: 4 }}>
            <Tag color={ESTADO_COLOR[proceso.estado]}>{ESTADO_LABEL[proceso.estado] ?? proceso.estado}</Tag>
          </div>
        </div>

        <div>
          <Text type="secondary">Nuevo estatus</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            placeholder="Selecciona el nuevo estatus"
            value={nuevoEstatus}
            onChange={setNuevoEstatus}
          >
            {opciones.map(op => (
              <Option key={op} value={op}>
                <Tag color={ESTADO_COLOR[op]}>{ESTADO_LABEL[op] ?? op}</Tag>
              </Option>
            ))}
          </Select>
          {opciones.length === 0 && (
            <Alert style={{ marginTop: 8 }} type="warning"
              message="No hay transiciones disponibles desde este estatus." showIcon />
          )}
        </div>

        {tieneContacto && nuevoEstatus && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>¿Enviar notificación al cliente?</Text>
            <Switch checked={notificar} onChange={setNotificar} />
          </div>
        )}

        {nuevoEstatus === 'reserva' && (
          <Alert type="info" showIcon message="La unidad pasará a no_disponible." />
        )}
        {nuevoEstatus === 'desvinculado' && (
          <Alert type="warning" showIcon message="La unidad volverá a estar disponible." />
        )}

      </Space>
    </Modal>
  );
};

export default CambiarEstatusModal;

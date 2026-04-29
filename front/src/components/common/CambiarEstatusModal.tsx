import { useState } from 'react';
import { Modal, Select, Space, Typography, Alert, Tag, Divider, Button } from 'antd';
import { ArrowRightOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import type { Proceso } from '../../types';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL } from '../../constants/estados';

const { Text } = Typography;
const { Option } = Select;

export type ModoNotificacion = false | 'admin' | 'todos';

const TRANSICIONES: Record<string, string[]> = {
  captacion:       ['reserva', 'desvinculado'],
  reserva:         ['separacion', 'desvinculado'],
  separacion:      ['inicial', 'pagos_atrasados', 'desvinculado'],
  inicial:         ['pagos_atrasados', 'contra_entrega', 'desvinculado'],
  pagos_atrasados: ['inicial', 'contra_entrega', 'desvinculado'],
  contra_entrega:  ['vendida', 'desvinculado'],
  vendida:         [],
};

interface Props {
  open: boolean;
  proceso: Proceso;
  tieneContacto: boolean;
  onCancel: () => void;
  onConfirm: (estatus: string, notificar: ModoNotificacion) => Promise<void>;
}

const CambiarEstatusModal = ({ open, proceso, tieneContacto, onCancel, onConfirm }: Props) => {
  const [nuevoEstatus, setNuevoEstatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const opciones = TRANSICIONES[proceso.estado] ?? [];

  const handleConfirm = async (notificar: ModoNotificacion) => {
    if (!nuevoEstatus) return;
    setLoading(true);
    try {
      await onConfirm(nuevoEstatus, notificar);
      setNuevoEstatus(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNuevoEstatus(undefined);
    onCancel();
  };

  return (
    <Modal
      title="Cambiar estatus del proceso"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={460}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">

        <div style={{
          background: '#f5f5f5', borderRadius: 8, padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Unidad</Text>
          <Tag color="geekblue" style={{ margin: 0, fontSize: 13 }}>
            {proceso.unidad_nombre || proceso.unidad_id}
          </Tag>
        </div>

        <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Transición de estatus
          </Text>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Tag color={ESTADO_PROCESO_COLOR[proceso.estado]} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
              {ESTADO_PROCESO_LABEL[proceso.estado] ?? proceso.estado}
            </Tag>
            <ArrowRightOutlined style={{ color: '#bfbfbf' }} />
            {nuevoEstatus ? (
              <Tag color={ESTADO_PROCESO_COLOR[nuevoEstatus]} style={{ margin: 0, fontSize: 13, padding: '2px 10px' }}>
                {ESTADO_PROCESO_LABEL[nuevoEstatus] ?? nuevoEstatus}
              </Tag>
            ) : (
              <Tag style={{ margin: 0, fontSize: 13, padding: '2px 10px', color: '#bfbfbf', borderStyle: 'dashed' }}>
                Selecciona
              </Tag>
            )}
          </div>
        </div>

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
                <Tag color={ESTADO_PROCESO_COLOR[op]} style={{ margin: 0 }}>
                  {ESTADO_PROCESO_LABEL[op] ?? op}
                </Tag>
              </Option>
            ))}
          </Select>
          {opciones.length === 0 && (
            <Alert style={{ marginTop: 8 }} type="warning"
              message="No hay transiciones disponibles desde este estatus." showIcon />
          )}
        </div>

        {nuevoEstatus === 'reserva' && (
          <Alert type="info" showIcon message="La unidad pasará a no disponible." />
        )}
        {nuevoEstatus === 'vendida' && (
          <Alert type="success" showIcon message="La unidad quedará marcada como vendida definitivamente." />
        )}
        {nuevoEstatus === 'desvinculado' && (
          <Alert type="warning" showIcon message="La unidad volverá a estar disponible." />
        )}

        {nuevoEstatus && (
          <>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                Notificación por correo (opcional)
              </Text>
              <Space style={{ width: '100%' }} direction="vertical" size={8}>
                {tieneContacto && (
                  <Button
                    block
                    icon={<TeamOutlined />}
                    onClick={() => handleConfirm('todos')}
                    loading={loading}
                    style={{ textAlign: 'left', height: 'auto', padding: '8px 14px' }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>Notificar a todos</div>
                      <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                        Inmobiliaria, cliente y administración
                      </div>
                    </div>
                  </Button>
                )}
                <Button
                  block
                  icon={<UserOutlined />}
                  onClick={() => handleConfirm('admin')}
                  loading={loading}
                  style={{ textAlign: 'left', height: 'auto', padding: '8px 14px' }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>Solo administración</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                      Solo nos llega a nosotros
                    </div>
                  </div>
                </Button>
                <Button
                  block
                  onClick={() => handleConfirm(false)}
                  loading={loading}
                  type="text"
                  style={{ color: '#8c8c8c' }}
                >
                  Confirmar sin notificar
                </Button>
              </Space>
            </div>
          </>
        )}

      </Space>
    </Modal>
  );
};

export default CambiarEstatusModal;

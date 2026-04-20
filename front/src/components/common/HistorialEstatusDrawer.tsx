import { Drawer, Timeline, Tag, Typography, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Proceso } from '../../types';

const { Text } = Typography;

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
  proceso: Proceso | null;
  clienteNombre: string;
  onClose: () => void;
}

const HistorialEstatusDrawer = ({ open, proceso, clienteNombre, onClose }: Props) => {
  const historial = proceso ? [...proceso.historial].reverse() : [];

  return (
    <Drawer
      title={`Historial — ${clienteNombre} · ${proceso?.unidad_nombre || proceso?.unidad_id || ''}`}
      open={open}
      onClose={onClose}
      width={420}
    >
      {historial.length === 0 ? (
        <Empty description="Sin cambios de estatus aún" />
      ) : (
        <Timeline
          items={historial.map(h => ({
            color: ESTADO_COLOR[h.estatus_nuevo] ?? 'gray',
            children: (
              <div>
                <div>
                  <Tag color={ESTADO_COLOR[h.estatus_anterior]}>{ESTADO_LABEL[h.estatus_anterior] ?? h.estatus_anterior}</Tag>
                  {' → '}
                  <Tag color={ESTADO_COLOR[h.estatus_nuevo]}>{ESTADO_LABEL[h.estatus_nuevo] ?? h.estatus_nuevo}</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(h.timestamp).format('DD/MM/YYYY HH:mm')} · {h.ejecutado_por_nombre}
                </Text>                <div>
                  {h.notificacion_enviada
                    ? <Text type="success" style={{ fontSize: 11 }}><CheckCircleOutlined /> Notificación enviada</Text>
                    : <Text type="secondary" style={{ fontSize: 11 }}><CloseCircleOutlined /> Sin notificación</Text>}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
};

export default HistorialEstatusDrawer;

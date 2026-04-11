import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Table, Tag, Button, Space, Popconfirm,
  Modal, Form, InputNumber, Input, message, Tooltip, Badge,
} from 'antd';
import {
  UnlockOutlined, ClockCircleOutlined, ReloadOutlined, FieldTimeOutlined,
} from '@ant-design/icons';
import { getBloquesActivos, liberarBloqueo, extenderBloqueo } from '../../services/bloqueos.service';
import { getProyectos } from '../../services/proyectos.service';
import type { Bloqueo, Proyecto } from '../../types';

const { Title, Text } = Typography;

const formatTiempo = (segundos: number) => {
  if (segundos <= 0) return 'Vencido';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${h}h ${m}m`;
};

const tiempoColor = (segundos?: number) => {
  if (!segundos || segundos <= 0) return 'error';
  if (segundos < 5 * 3600) return 'warning';
  return 'success';
};

const BloqueosPage = () => {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalExtender, setModalExtender] = useState(false);
  const [bloqueoSeleccionado, setBloqueoSeleccionado] = useState<Bloqueo | null>(null);
  const [form] = Form.useForm();

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [b, p] = await Promise.all([getBloquesActivos(), getProyectos()]);
      // Calcular tiempo_restante en cliente si no viene del backend
      const ahora = Date.now();
      const enriquecidos = b.map(item => ({
        ...item,
        tiempo_restante: item.tiempo_restante ??
          Math.max(0, Math.floor((new Date(item.fecha_liberacion).getTime() - ahora) / 1000)),
      }));
      setBloqueos(enriquecidos);
      setProyectos(p);
    } catch {
      message.error('Error al cargar bloqueos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleLiberar = async (b: Bloqueo) => {
    try {
      await liberarBloqueo(b.unidad_id, b.proyecto_id);
      message.success('Bloqueo liberado');
      cargar();
    } catch {
      message.error('Error al liberar bloqueo');
    }
  };

  const abrirExtender = (b: Bloqueo) => {
    setBloqueoSeleccionado(b);
    form.resetFields();
    setModalExtender(true);
  };

  const handleExtender = async (values: { horas_extra: number; justificacion: string }) => {
    if (!bloqueoSeleccionado) return;
    try {
      await extenderBloqueo(bloqueoSeleccionado.unidad_id, bloqueoSeleccionado.proyecto_id, values);
      message.success('Bloqueo extendido');
      setModalExtender(false);
      cargar();
    } catch {
      message.error('Error al extender bloqueo');
    }
  };

  const proyectoNombre = (id: string) =>
    proyectos.find(p => p.proyecto_id === id)?.nombre ?? id;

  const columns = [
    {
      title: 'Unidad',
      dataIndex: 'id_unidad',
      key: 'id_unidad',
      render: (v: string, r: Bloqueo) => (
        <Text strong>{v || r.unidad_id}</Text>
      ),
    },
    {
      title: 'Proyecto',
      dataIndex: 'proyecto_id',
      key: 'proyecto_id',
      render: (v: string) => proyectoNombre(v),
    },
    {
      title: 'Bloqueado por',
      dataIndex: 'bloqueado_por',
      key: 'bloqueado_por',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Fecha bloqueo',
      dataIndex: 'fecha_bloqueo',
      key: 'fecha_bloqueo',
      render: (v: string) => new Date(v).toLocaleString('es-VE'),
    },
    {
      title: 'Vence',
      dataIndex: 'fecha_liberacion',
      key: 'fecha_liberacion',
      render: (v: string) => new Date(v).toLocaleString('es-VE'),
    },
    {
      title: 'Tiempo restante',
      dataIndex: 'tiempo_restante',
      key: 'tiempo_restante',
      render: (v: number) => (
        <Badge
          status={tiempoColor(v)}
          text={
            <Text style={{ color: v < 5 * 3600 ? (v <= 0 ? '#ff4d4f' : '#faad14') : '#52c41a' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {formatTiempo(v)}
            </Text>
          }
        />
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      render: (_: unknown, record: Bloqueo) => (
        <Space>
          <Tooltip title="Extender bloqueo">
            <Button
              size="small"
              icon={<FieldTimeOutlined />}
              onClick={() => abrirExtender(record)}
            >
              Extender
            </Button>
          </Tooltip>
          <Popconfirm
            title="¿Liberar este bloqueo?"
            description="La unidad volverá a estar disponible."
            okText="Liberar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleLiberar(record)}
          >
            <Tooltip title="Liberar manualmente">
              <Button size="small" danger icon={<UnlockOutlined />}>
                Liberar
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Bloqueos activos</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {bloqueos.length} unidad{bloqueos.length !== 1 ? 'es' : ''} bloqueada{bloqueos.length !== 1 ? 's' : ''}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={cargar} loading={loading}>
          Actualizar
        </Button>
      </div>

      <Table
        dataSource={bloqueos}
        columns={columns}
        rowKey="unidad_id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No hay bloqueos activos' }}
      />

      <Modal
        title="Extender bloqueo"
        open={modalExtender}
        onCancel={() => setModalExtender(false)}
        onOk={() => form.submit()}
        okText="Extender"
        cancelText="Cancelar"
      >
        {bloqueoSeleccionado && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Unidad: <Text strong>{bloqueoSeleccionado.id_unidad || bloqueoSeleccionado.unidad_id}</Text>
            {' — '}Vence: {new Date(bloqueoSeleccionado.fecha_liberacion).toLocaleString('es-VE')}
          </Text>
        )}
        <Form form={form} layout="vertical" onFinish={handleExtender}>
          <Form.Item
            name="horas_extra"
            label="Horas adicionales"
            initialValue={24}
            rules={[{ required: true, message: 'Requerido' }]}
          >
            <InputNumber min={1} max={168} style={{ width: '100%' }} addonAfter="horas" />
          </Form.Item>
          <Form.Item
            name="justificacion"
            label="Justificación"
            rules={[{ required: true, message: 'La justificación es requerida' }]}
          >
            <Input.TextArea rows={3} placeholder="Motivo de la extensión..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BloqueosPage;

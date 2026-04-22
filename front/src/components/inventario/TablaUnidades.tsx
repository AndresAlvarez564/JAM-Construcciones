import { Table, Tag, Button, Space, Tooltip, Popconfirm, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Unidad, Etapa } from '../../types';
import { ESTADO_UNIDAD_CONFIG } from '../../constants/estados';

const { Text } = Typography;

const formatTiempo = (s: number) => {
  if (s <= 0) return 'Vencido';
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
};

interface Props {
  unidades: Unidad[];
  etapas: Etapa[];
  loading: boolean;
  isAdmin: boolean;
  isInmobiliaria: boolean;
  inmoNombre: (id: string) => string;
  onEditar: (u: Unidad) => void;
  onEliminar: (u: Unidad) => void;
  onBloquear: (u: Unidad) => void;
}

const TablaUnidades = ({ unidades, etapas, loading, isAdmin, isInmobiliaria, inmoNombre, onEditar, onEliminar, onBloquear }: Props) => {
  const columnas = [
    { title: 'ID Unidad', dataIndex: 'id_unidad', key: 'id_unidad', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Etapa', dataIndex: 'etapa_id', key: 'etapa_id', render: (v: string) => {
      const e = etapas.find(et => et.etapa_id === v);
      return e ? <Tag color="blue">{e.nombre}</Tag> : <Text type="secondary">—</Text>;
    }},
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text> },
    { title: 'Manzana', dataIndex: 'manzana', key: 'manzana', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Piso', dataIndex: 'piso', key: 'piso', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: 'Metraje', dataIndex: 'metraje', key: 'metraje', render: (v: any) => `${parseFloat(v) || 0} m²` },
    { title: 'Precio', dataIndex: 'precio', key: 'precio', render: (v: any) => `${parseFloat(v)?.toLocaleString('es-VE') ?? '—'}` },
    {
      title: 'Estado', dataIndex: 'estado', key: 'estado',
      render: (v: string, u: Unidad) => {
        const cfg = ESTADO_UNIDAD_CONFIG[v] ?? { label: v, tagColor: 'default' };
        return (
          <Space direction="vertical" size={2}>
            <Tag color={cfg.tagColor}>{cfg.label}</Tag>
            {v === 'bloqueada' && u.tiempo_restante !== undefined && (
              <Text style={{ fontSize: 11, color: u.tiempo_restante < 5 * 3600 ? '#faad14' : '#52c41a' }}>
                <ClockCircleOutlined style={{ marginRight: 3 }} />{formatTiempo(u.tiempo_restante)}
              </Text>
            )}
          </Space>
        );
      },
    },
    ...(isAdmin ? [
      { title: 'Bloqueado por', dataIndex: 'bloqueado_por', key: 'bloqueado_por', render: (v: string) => v ? <Tag>{inmoNombre(v)}</Tag> : <Text type="secondary">—</Text> },
      { title: 'Fecha bloqueo', dataIndex: 'fecha_bloqueo', key: 'fecha_bloqueo', render: (v: string) => v ? new Date(v).toLocaleDateString('es-VE') : <Text type="secondary">—</Text> },
      { title: '', key: 'acciones', width: 80, render: (_: any, u: Unidad) => (
        <Space>
          <Tooltip title="Editar"><Button size="small" icon={<EditOutlined />} onClick={() => onEditar(u)} /></Tooltip>
          <Popconfirm title="¿Eliminar unidad?" okText="Sí" cancelText="No" onConfirm={() => onEliminar(u)}>
            <Tooltip title="Eliminar"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )},
    ] : []),
    ...(isInmobiliaria ? [{
      title: '', key: 'bloqueo', width: 120,
      render: (_: any, u: Unidad) => {
        if (u.estado === 'bloqueada') return <Tag icon={<LockOutlined />} color="warning">Bloqueada</Tag>;
        if (u.estado !== 'disponible') return null;
        return <Button size="small" icon={<LockOutlined />} type="primary" ghost onClick={() => onBloquear(u)}>Bloquear</Button>;
      },
    }] : []),
  ];

  return (
    <Table dataSource={unidades} columns={columnas} rowKey="unidad_id"
      loading={loading} pagination={{ pageSize: 30 }} locale={{ emptyText: 'Sin unidades' }} />
  );
};

export default TablaUnidades;

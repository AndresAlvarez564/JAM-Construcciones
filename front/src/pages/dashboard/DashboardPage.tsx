import { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Table, Select, Spin, Typography,
  Progress, Empty, Tooltip,
} from 'antd';
import {
  AppstoreOutlined, TeamOutlined, LockOutlined, CheckCircleOutlined,
  StopOutlined, RiseOutlined, FallOutlined, ClockCircleOutlined,
  ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import { getAnalytics } from '../../services/analytics.service';
import type { AnalyticsData } from '../../services/analytics.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Proyecto } from '../../types';
import { ESTADO_UNIDAD_CONFIG, ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL } from '../../constants/estados';
import useAuth from '../../hooks/useAuth';

const { Text, Title } = Typography;

// ── helpers ──────────────────────────────────────────────────────────────────

const TAG_HEX: Record<string, string> = {
  success: '#52c41a', warning: '#faad14', orange: '#fa8c16',
  default: '#8c8c8c', error: '#ff4d4f', blue: '#1677ff',
  purple: '#722ed1', cyan: '#13c2c2', red: '#ff4d4f',
};

const fmtHoras = (h: number | null) => {
  if (h === null || h === undefined) return '—';
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
};

const sortDesc = (obj: Record<string, number>) =>
  Object.entries(obj).sort((a, b) => b[1] - a[1]);

const MES_LABEL: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
};
const fmtMes = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MES_LABEL[m] ?? m} ${y}`;
};

// ── Componente mini-barra horizontal ─────────────────────────────────────────
const BarRow = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{value} ({pct}%)</Text>
      </div>
      <Progress percent={pct} showInfo={false} strokeColor={color} size="small" />
    </div>
  );
};

// ── Componente KPI card ───────────────────────────────────────────────────────
const KpiCard = ({
  title, value, suffix, color, icon, tooltip,
}: {
  title: string; value: string | number; suffix?: string;
  color?: string; icon?: React.ReactNode; tooltip?: string;
}) => (
  <Card style={{ height: '100%' }}>
    <Tooltip title={tooltip}>
      <Statistic
        title={title}
        value={value}
        suffix={suffix}
        valueStyle={{ color: color ?? '#111' }}
        prefix={icon}
      />
    </Tooltip>
  </Card>
);

// ── Página principal ──────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === 'admin';
  const isInterno = ['admin', 'coordinador', 'supervisor'].includes(usuario?.rol ?? '');

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyectoId, setProyectoId] = useState('');
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async (pid: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await getAnalytics(pid);
      setData(res);
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const [projs, inmos] = await Promise.all([
          getProyectos(),
          isAdmin ? getInmobiliarias() : Promise.resolve([] as Inmobiliaria[]),
        ]);
        const filtrados = usuario?.rol === 'inmobiliaria' && usuario.proyectos?.length
          ? projs.filter(p => usuario.proyectos!.includes(p.proyecto_id))
          : projs;
        setProyectos(filtrados);
        setInmobiliarias(inmos);
        if (filtrados.length > 0) {
          setProyectoId(filtrados[0].proyecto_id);
          await cargar(filtrados[0].proyecto_id);
        } else {
          setLoading(false);
        }
      } catch { setLoading(false); }
    };
    init();
  }, [usuario, isAdmin, cargar]);

  const handleProyecto = (pid: string) => {
    setProyectoId(pid);
    cargar(pid);
  };

  const inmoNombre = (id: string) =>
    inmobiliarias.find(i => i.pk === id || i.pk === `INMOBILIARIA#${id}`)?.nombre ?? id;

  const proyectoActual = proyectos.find(p => p.proyecto_id === proyectoId);

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Dashboard</Title>
          {proyectoActual && <Text type="secondary">{proyectoActual.nombre}</Text>}
        </div>
        <Select
          value={proyectoId || undefined}
          onChange={handleProyecto}
          style={{ minWidth: 220 }}
          options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          placeholder="Seleccionar proyecto"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : !data || proyectos.length === 0 ? (
        <Empty description="No hay datos disponibles" />
      ) : (
        <DashboardContent
          data={data}
          isAdmin={isAdmin}
          isInterno={isInterno}
          inmoNombre={inmoNombre}
        />
      )}
    </div>
  );
};

// ── Contenido del dashboard (separado para claridad) ─────────────────────────
const DashboardContent = ({
  data, isAdmin, isInterno, inmoNombre,
}: {
  data: AnalyticsData;
  isAdmin: boolean;
  isInterno: boolean;
  inmoNombre: (id: string) => string;
}) => {
  const { unidad_stats, proceso_stats, cliente_stats, kpis, velocidad,
    cierres_mensuales, top_unidades, conversion_por_inmobiliaria, demograficos } = data;

  const estadosUnidad: (keyof typeof unidad_stats)[] = ['disponible', 'bloqueada', 'no_disponible', 'vendida', 'desvinculada'];
  const estadosProceso: (keyof typeof proceso_stats)[] = ['captacion', 'reserva', 'separacion', 'inicial', 'desvinculado'];

  return (
    <>
      {/* ── Sección 1: KPIs principales ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <KpiCard title="Total unidades" value={unidad_stats.total}
            icon={<AppstoreOutlined style={{ color: '#1677ff' }} />} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard title="Disponibles" value={unidad_stats.disponible}
            color="#52c41a" icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard title="Bloqueadas" value={unidad_stats.bloqueada}
            color="#faad14" icon={<LockOutlined />} />
        </Col>
        <Col xs={12} sm={8} md={4}>
          <KpiCard title="Vendidas" value={unidad_stats.vendida}
            color="#8c8c8c" icon={<StopOutlined />} />
        </Col>
        {isInterno && (
          <>
            <Col xs={12} sm={8} md={4}>
              <KpiCard title="Total clientes" value={cliente_stats.total}
                icon={<TeamOutlined style={{ color: '#1677ff' }} />} />
            </Col>
            <Col xs={12} sm={8} md={4}>
              <KpiCard title="Total procesos" value={proceso_stats.total}
                icon={<ThunderboltOutlined style={{ color: '#722ed1' }} />} />
            </Col>
          </>
        )}
      </Row>

      {/* ── Sección 2: KPIs clave ── */}
      {isInterno && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={6}>
            <KpiCard
              title="% Conversión"
              value={kpis.pct_conversion} suffix="%"
              color={kpis.pct_conversion >= 30 ? '#52c41a' : '#faad14'}
              icon={<RiseOutlined />}
              tooltip="Procesos en reserva/separación/inicial ÷ total procesos"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <KpiCard
              title="Tasa de abandono"
              value={kpis.tasa_abandono} suffix="%"
              color={kpis.tasa_abandono > 20 ? '#ff4d4f' : '#52c41a'}
              icon={<FallOutlined />}
              tooltip="Procesos desvinculados ÷ total procesos"
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <KpiCard
              title="Bloqueos → Venta"
              value={kpis.pct_bloqueos_a_venta} suffix="%"
              color={kpis.pct_bloqueos_a_venta < 30 ? '#ff4d4f' : '#52c41a'}
              icon={<WarningOutlined />}
              tooltip="% de bloqueos que terminan en reserva o venta. Si es bajo, hay inmobiliarias secuestrando unidades."
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <KpiCard
              title="Captación → Reserva"
              value={fmtHoras(velocidad.captacion_a_reserva_horas)}
              icon={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
              tooltip="Tiempo promedio desde captación hasta reserva"
            />
          </Col>
        </Row>
      )}

      {/* ── Sección 3: Distribuciones ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* Unidades por estado */}
        <Col xs={24} md={12}>
          <Card title="Unidades por estado">
            {unidad_stats.total === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin unidades" />
            ) : estadosUnidad.map(e => {
              const cfg = ESTADO_UNIDAD_CONFIG[e];
              return (
                <BarRow key={e} label={cfg.label} value={unidad_stats[e] as number}
                  total={unidad_stats.total} color={TAG_HEX[cfg.tagColor] ?? '#1677ff'} />
              );
            })}
          </Card>
        </Col>

        {/* Clientes/Procesos por estado */}
        {isInterno && (
          <Col xs={24} md={12}>
            <Card title="Procesos por estado">
              {proceso_stats.total === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin procesos" />
              ) : estadosProceso.map(e => (
                <BarRow key={e}
                  label={ESTADO_PROCESO_LABEL[e] ?? e}
                  value={proceso_stats[e] as number}
                  total={proceso_stats.total}
                  color={TAG_HEX[ESTADO_PROCESO_COLOR[e]] ?? '#1677ff'}
                />
              ))}
            </Card>
          </Col>
        )}
      </Row>

      {/* ── Sección 4: Cierres mensuales + Velocidad ── */}
      {isInterno && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={14}>
            <Card title="Cierres mensuales (Reservas y Separaciones)">
              {cierres_mensuales.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin cierres registrados" />
              ) : (
                <Table
                  dataSource={cierres_mensuales} rowKey="mes" pagination={false} size="small"
                  columns={[
                    { title: 'Mes', dataIndex: 'mes', key: 'mes', render: fmtMes },
                    { title: 'Reservas', dataIndex: 'reservas', key: 'r', align: 'center',
                      render: v => <Tag color="orange">{v}</Tag> },
                    { title: 'Separaciones', dataIndex: 'separaciones', key: 's', align: 'center',
                      render: v => <Tag color="purple">{v}</Tag> },
                    { title: 'Total', key: 't', align: 'center',
                      render: (_, r: any) => <Text strong>{r.reservas + r.separaciones}</Text> },
                  ]}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="Velocidad de venta" style={{ height: '100%' }}>
              <div style={{ padding: '8px 0' }}>
                <div style={{ marginBottom: 20 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>CAPTACIÓN → RESERVA</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff', marginTop: 4 }}>
                    {fmtHoras(velocidad.captacion_a_reserva_horas)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>promedio</Text>
                </div>
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>RESERVA → SEPARACIÓN</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#722ed1', marginTop: 4 }}>
                    {fmtHoras(velocidad.reserva_a_separacion_horas)}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>promedio</Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Sección 5: Conversión por inmobiliaria ── */}
      {isAdmin && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24}>
            <Card title="Conversión por inmobiliaria">
              {conversion_por_inmobiliaria.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos de conversión" />
              ) : (
                <Table
                  dataSource={conversion_por_inmobiliaria}
                  rowKey="inmobiliaria_id" pagination={false} size="small"
                  columns={[
                    { title: 'Inmobiliaria', dataIndex: 'inmobiliaria_id', key: 'inmo',
                      render: v => <Text strong>{inmoNombre(v)}</Text> },
                    { title: 'Captados', dataIndex: 'captados', key: 'c', align: 'center' },
                    { title: 'Reservas', dataIndex: 'reservas', key: 'r', align: 'center',
                      render: v => <Tag color="orange">{v}</Tag> },
                    { title: 'Separaciones', dataIndex: 'separaciones', key: 's', align: 'center',
                      render: v => <Tag color="purple">{v}</Tag> },
                    { title: 'Desvinculados', dataIndex: 'desvinculados', key: 'd', align: 'center',
                      render: v => <Tag color="red">{v}</Tag> },
                    { title: '% Conversión', dataIndex: 'pct_conversion', key: 'pct', align: 'center',
                      sorter: (a: any, b: any) => a.pct_conversion - b.pct_conversion,
                      render: (v: number) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                          <Progress percent={v} size="small" style={{ flex: 1 }}
                            strokeColor={v >= 30 ? '#52c41a' : '#faad14'} showInfo={false} />
                          <Text style={{ fontSize: 12, whiteSpace: 'nowrap',
                            color: v >= 30 ? '#52c41a' : '#faad14' }}>{v}%</Text>
                        </div>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Sección 6: Unidades más demandadas ── */}
      {isInterno && top_unidades.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card title="Unidades más demandadas">
              <Table
                dataSource={top_unidades} rowKey="unidad_id" pagination={false} size="small"
                columns={[
                  { title: 'Unidad', dataIndex: 'nombre', key: 'n',
                    render: (v: string, r: any) => (
                      <span>
                        <Text strong>{v}</Text>
                        {r.vendida && <Tag color="default" style={{ marginLeft: 6 }}>Vendida</Tag>}
                      </span>
                    )
                  },
                  { title: 'Procesos', dataIndex: 'procesos', key: 'p', align: 'center',
                    render: v => <Tag color="blue">{v}</Tag> },
                ]}
              />
            </Card>
          </Col>

          {/* Demografía: estado civil */}
          <Col xs={24} md={12}>
            <Card title="Clientes por estado civil">
              {Object.keys(demograficos.estado_civil).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />
              ) : sortDesc(demograficos.estado_civil).map(([k, v]) => (
                <BarRow key={k} label={k.replace('_', ' ')} value={v}
                  total={cliente_stats.total} color="#1677ff" />
              ))}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Sección 7: Demografía ── */}
      {isInterno && (
        <Row gutter={[16, 16]}>
          {/* Rangos de edad */}
          <Col xs={24} md={8}>
            <Card title="Clientes por edad">
              {Object.values(demograficos.rangos_edad).every(v => v === 0) ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos de edad" />
              ) : Object.entries(demograficos.rangos_edad).map(([rango, v]) => (
                <BarRow key={rango} label={rango} value={v}
                  total={cliente_stats.total} color="#13c2c2" />
              ))}
            </Card>
          </Col>

          {/* País de residencia */}
          <Col xs={24} md={8}>
            <Card title="País de residencia">
              {Object.keys(demograficos.pais_residencia).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />
              ) : sortDesc(demograficos.pais_residencia).slice(0, 8).map(([k, v]) => (
                <BarRow key={k} label={k} value={v}
                  total={cliente_stats.total} color="#fa8c16" />
              ))}
            </Card>
          </Col>

          {/* Nacionalidad */}
          <Col xs={24} md={8}>
            <Card title="Nacionalidad">
              {Object.keys(demograficos.nacionalidad).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin datos" />
              ) : sortDesc(demograficos.nacionalidad).slice(0, 8).map(([k, v]) => (
                <BarRow key={k} label={k} value={v}
                  total={cliente_stats.total} color="#722ed1" />
              ))}
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
};

export default DashboardPage;

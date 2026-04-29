import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Tag, Button, Space, Select, message,
  Badge, Tooltip, Grid, Input, Dropdown, Tabs,
} from 'antd';
import {
  ReloadOutlined, SwapOutlined, HistoryOutlined,
  SearchOutlined, MoreOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarTodosProcesos, cambiarEstatus, type ProcesoEnriquecido } from '../../services/crm.service';
import { getProyectos } from '../../services/proyectos.service';
import { getInmobiliarias } from '../../services/inmobiliarias.service';
import type { Inmobiliaria } from '../../services/inmobiliarias.service';
import type { Proyecto, Proceso } from '../../types';
import CambiarEstatusModal from '../../components/common/CambiarEstatusModal';
import HistorialEstatusDrawer from '../../components/common/HistorialEstatusDrawer';
import { ESTADO_PROCESO_COLOR, ESTADO_PROCESO_LABEL } from '../../constants/estados';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const ESTADOS_ACTIVOS = ['captacion', 'reserva', 'separacion', 'inicial'];

const ProcesosPage = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [procesos, setProcesos] = useState<ProcesoEnriquecido[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [inmobiliarias, setInmobiliarias] = useState<Inmobiliaria[]>([]);

  const [proyectoFiltro, setProyectoFiltro] = useState<string | undefined>();
  const [inmoFiltro, setInmoFiltro] = useState<string | undefined>();
  const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>();
  const [busqueda, setBusqueda] = useState('');
  const [tabActiva, setTabActiva] = useState<'activos' | 'cerrados'>('activos');

  const [estatusModal, setEstatusModal] = useState<ProcesoEnriquecido | null>(null);
  const [historialProceso, setHistorialProceso] = useState<Proceso | null>(null);
  const [historialNombre, setHistorialNombre] = useState('');

  const cargar = useCallback(async (opts: {
    token?: string;
    tab?: 'activos' | 'cerrados';
    proyecto?: string;
    inmo?: string;
    estado?: string;
  } = {}) => {
    const tab = opts.tab ?? tabActiva;
    setLoading(true);
    try {
      const data = await listarTodosProcesos({
        proyecto_id: opts.proyecto ?? proyectoFiltro,
        inmobiliaria_id: opts.inmo ?? inmoFiltro,
        estado: opts.estado ?? estadoFiltro,
        incluir_cerrados: tab === 'cerrados',
        next_token: opts.token,
      });
      setProcesos(prev => opts.token ? [...prev, ...data.items] : data.items);
      setNextToken(data.next_token);
    } catch {
      message.error('Error al cargar procesos');
    } finally {
      setLoading(false);
    }
  }, [tabActiva, proyectoFiltro, inmoFiltro, estadoFiltro]);

  useEffect(() => {
    getProyectos().then(setProyectos).catch(() => {});
    getInmobiliarias().then(setInmobiliarias).catch(() => {});
    cargar();
  }, []);

  const proyectoNombre = (id: string) =>
    proyectos.find(p => p.proyecto_id === id?.replace('PROYECTO#', ''))?.nombre ?? id;

  const inmoNombre = (id: string) => {
    const norm = id?.replace('INMOBILIARIA#', '');
    return inmobiliarias.find(i =>
      i.pk === id || i.pk === `INMOBILIARIA#${norm}` || i.pk.replace('INMOBILIARIA#', '') === norm
    )?.nombre ?? id;
  };

  const nombreCliente = (p: ProcesoEnriquecido) =>
    p.cliente?.nombres ? `${p.cliente.nombres} ${p.cliente.apellidos}` : p.cedula;

  const handleCambiarEstatus = async (estatus: string, notificar: boolean) => {
    if (!estatusModal) return;
    try {
      await cambiarEstatus(
        estatusModal.cedula,
        estatusModal.proyecto_id,
        estatusModal.unidad_id,
        { estatus, inmobiliaria_id: estatusModal.inmobiliaria_id, notificar }
      );
      message.success(`Estatus actualizado a ${ESTADO_PROCESO_LABEL[estatus] ?? estatus}`);
      setEstatusModal(null);
      cargar();
    } catch (err: any) {
      try {
        const body = await err?.response?.body?.json?.();
        message.error(body?.message ?? 'Error al cambiar estatus');
      } catch {
        message.error('Error al cambiar estatus');
      }
      throw err; // para que CambiarEstatusModal no cierre el loading
    }
  };

  const limpiarFiltros = () => {
    setProyectoFiltro(undefined);
    setInmoFiltro(undefined);
    setEstadoFiltro(undefined);
    setBusqueda('');
    setNextToken(undefined);
    cargar({ proyecto: undefined, inmo: undefined, estado: undefined });
  };

  const procesosVisibles = busqueda.trim()
    ? procesos.filter(p => {
        const nombre = nombreCliente(p).toLowerCase();
        const q = busqueda.toLowerCase();
        return nombre.includes(q) || p.cedula.includes(q) || (p.unidad_nombre ?? '').toLowerCase().includes(q);
      })
    : procesos;

  const procesosActivos = procesosVisibles.filter(p => ESTADOS_ACTIVOS.includes(p.estado));
  const procesosCerrados = procesosVisibles.filter(p => !ESTADOS_ACTIVOS.includes(p.estado));

  const alertaInfo = (p: ProcesoEnriquecido) => {
    const vencida = p.alerta_separacion_vencida && p.estado === 'separacion' && !p.pago_confirmado;
    const dias = p.fecha_separacion
      ? Math.floor((Date.now() - new Date(p.fecha_separacion).getTime()) / 86400000)
      : null;
    const proxima = !vencida && p.estado === 'separacion' && dias !== null && dias >= 25;
    return { vencida, proxima, dias };
  };

  const renderAlertas = (p: ProcesoEnriquecido) => {
    const { vencida, proxima, dias } = alertaInfo(p);
    return (
      <>
        {vencida && (
          <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '4px 10px', marginBottom: 8, fontSize: 12, color: '#cf1322' }}>
            ⚠️ Separación vencida — 30 días sin pago confirmado
          </div>
        )}
        {proxima && (
          <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, padding: '4px 10px', marginBottom: 8, fontSize: 12, color: '#d46b08' }}>
            ⏰ Vence en {30 - dias!} día{30 - dias! !== 1 ? 's' : ''} — pendiente pago
          </div>
        )}
      </>
    );
  };

  const renderTarjeta = (p: ProcesoEnriquecido) => {
    const puedeAvanzar = p.estado !== 'vendida' && p.estado !== 'desvinculado';
    const menuItems = [
      ...(puedeAvanzar ? [{ key: 'estatus', icon: <SwapOutlined />, label: 'Cambiar estatus', onClick: () => setEstatusModal(p) }] : []),
      { key: 'historial', icon: <HistoryOutlined />, label: 'Ver historial', onClick: () => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); } },
    ];

    return (
      <div key={`${p.pk}#${p.sk}`} style={{
        background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 10, padding: '14px 16px',
      }}>
        {renderAlertas(p)}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14 }}>{nombreCliente(p)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{p.cedula}</Text>
            </div>
            <Space size={4} wrap>
              <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
              <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>
                {ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}
              </Tag>
            </Space>
            <div style={{ marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{proyectoNombre(p.proyecto_id)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{inmoNombre(p.inmobiliaria_id)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Desde {dayjs(p.fecha_inicio).format('DD/MM/YYYY')}</Text>
            </div>
          </div>
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </div>
      </div>
    );
  };

  const renderFila = (p: ProcesoEnriquecido) => {
    const { vencida, proxima } = alertaInfo(p);
    const puedeAvanzar = p.estado !== 'vendida' && p.estado !== 'desvinculado';
    return (
      <div key={`${p.pk}#${p.sk}`} style={{
        display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr 80px',
        alignItems: 'center', padding: '12px 14px',
        background: '#fff', borderRadius: 8, marginBottom: 4,
        borderTop: '1px solid #f0f0f0', borderRight: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0',
        borderLeft: vencida ? '3px solid #ff4d4f' : proxima ? '3px solid #faad14' : '1px solid #f0f0f0',
      }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>{nombreCliente(p)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{p.cedula}</Text>
        </div>
        <Tag color="geekblue" style={{ margin: 0 }}>{p.unidad_nombre || p.unidad_id}</Tag>
        <Badge
          status={vencida ? 'error' : proxima ? 'warning' : 'default'}
          text={
            <Tag color={ESTADO_PROCESO_COLOR[p.estado]} style={{ margin: 0 }}>
              {ESTADO_PROCESO_LABEL[p.estado] ?? p.estado}
            </Tag>
          }
        />
        <Text style={{ fontSize: 12 }}>{proyectoNombre(p.proyecto_id)}</Text>
        <Text style={{ fontSize: 12 }}>{inmoNombre(p.inmobiliaria_id)}</Text>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          {puedeAvanzar && (
            <Tooltip title="Cambiar estatus">
              <Button size="small" icon={<SwapOutlined />} onClick={() => setEstatusModal(p)} />
            </Tooltip>
          )}
          <Tooltip title="Historial">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => { setHistorialProceso(p); setHistorialNombre(nombreCliente(p)); }} />
          </Tooltip>
        </div>
      </div>
    );
  };

  const renderTabla = (lista: ProcesoEnriquecido[]) => (
    <div>
      {!isMobile && lista.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1.2fr 80px',
          padding: '8px 14px', background: '#fafafa', borderRadius: 8,
          marginBottom: 4, fontSize: 11, color: '#8c8c8c', fontWeight: 600, letterSpacing: 0.5,
        }}>
          <span>CLIENTE</span><span>UNIDAD</span><span>ESTATUS</span>
          <span>PROYECTO</span><span>INMOBILIARIA</span><span />
        </div>
      )}
      {lista.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <UserOutlined style={{ fontSize: 40, marginBottom: 12 }} />
          <div>No hay procesos</div>
        </div>
      )}
      {isMobile ? lista.map(renderTarjeta) : lista.map(renderFila)}
    </div>
  );

  const opcionesEstado = ['captacion', 'reserva', 'separacion', 'inicial', 'vendida', 'desvinculado'].map(e => ({
    value: e,
    label: <Tag color={ESTADO_PROCESO_COLOR[e]} style={{ margin: 0 }}>{ESTADO_PROCESO_LABEL[e]}</Tag>,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>Procesos de venta</Title>
        <Button icon={<ReloadOutlined />} onClick={() => cargar()} loading={loading}>
          {!isMobile && 'Actualizar'}
        </Button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar cliente, cédula o unidad..."
          style={{ width: isMobile ? '100%' : 240 }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          allowClear
        />
        <Select
          allowClear placeholder="Proyecto"
          style={{ width: isMobile ? '100%' : 180 }}
          value={proyectoFiltro}
          options={proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
          onChange={v => {
            setProyectoFiltro(v);
            setNextToken(undefined);
            cargar({ proyecto: v });
          }}
        />
        <Select
          allowClear placeholder="Inmobiliaria"
          style={{ width: isMobile ? '100%' : 180 }}
          value={inmoFiltro}
          options={inmobiliarias.map(i => ({ value: i.pk, label: i.nombre }))}
          onChange={v => {
            setInmoFiltro(v);
            setNextToken(undefined);
            cargar({ inmo: v });
          }}
        />
        <Select
          allowClear placeholder="Estatus"
          style={{ width: isMobile ? '100%' : 150 }}
          value={estadoFiltro}
          options={opcionesEstado}
          onChange={v => {
            setEstadoFiltro(v);
            setNextToken(undefined);
            cargar({ estado: v });
          }}
        />
        <Button onClick={limpiarFiltros}>Limpiar</Button>
      </div>

      <Tabs
        activeKey={tabActiva}
        onChange={key => {
          const t = key as 'activos' | 'cerrados';
          setTabActiva(t);
          setNextToken(undefined);
          cargar({ tab: t });
        }}
        items={[
          {
            key: 'activos',
            label: `Activos (${procesosActivos.length})`,
            children: renderTabla(procesosActivos),
          },
          {
            key: 'cerrados',
            label: `Cerrados (${procesosCerrados.length})`,
            children: renderTabla(procesosCerrados),
          },
        ]}
      />

      {nextToken && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button onClick={() => cargar({ token: nextToken })} loading={loading}>Cargar más</Button>
        </div>
      )}

      {estatusModal && (
        <CambiarEstatusModal
          open={!!estatusModal}
          proceso={estatusModal}
          tieneContacto={!!(estatusModal.cliente?.correo || estatusModal.cliente?.telefono)}
          onCancel={() => setEstatusModal(null)}
          onConfirm={handleCambiarEstatus}
        />
      )}

      <HistorialEstatusDrawer
        open={!!historialProceso}
        proceso={historialProceso}
        clienteNombre={historialNombre}
        onClose={() => { setHistorialProceso(null); setHistorialNombre(''); }}
      />
    </div>
  );
};

export default ProcesosPage;

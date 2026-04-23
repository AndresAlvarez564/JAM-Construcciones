import { useState } from 'react';
import { Button, Modal, Form, Input, Space, Tooltip, Row, Col, Popconfirm, Upload, Select, Typography } from 'antd';
import { PlusOutlined, AppstoreOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ArrowLeftOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useInventario } from '../../hooks/useInventario';
import TablaUnidades from '../../components/inventario/TablaUnidades';
import DrawerEtapas from '../../components/inventario/DrawerEtapas';
import ModalUnidad from '../../components/inventario/ModalUnidad';
import ModalBloqueo from '../../components/inventario/ModalBloqueo';
import { ESTADO_UNIDAD_CONFIG, projectGradient } from '../../constants/estados';
import { eliminarProyecto } from '../../services/proyectos.service';
import { bloquearUnidad } from '../../services/bloqueos.service';
import { buscarClientePorCedula } from '../../services/clientes.service';
import type { Cliente, Unidad } from '../../types';
import { message } from 'antd';

const { Title, Text } = Typography;
const { Option } = Select;

const InventarioPage = () => {
  const inv = useInventario();

  // Estado local solo para bloqueo (no pertenece al hook de inventario)
  const [modalBloqueo, setModalBloqueo] = useState(false);
  const [unidadABloquear, setUnidadABloquear] = useState<Unidad | null>(null);
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);

  // Form refs para modales que necesitan reset externo
  const [formProyecto] = Form.useForm();
  const [formUnidad] = Form.useForm();

  const abrirEditarUnidad = (u: Unidad) => {
    inv.setModoUnidad('editar');
    inv.setUnidadEditando(u);
    formUnidad.setFieldsValue({ id_unidad: u.id_unidad, etapa_id: u.etapa_id, metraje: u.metraje, precio: u.precio, tipo: u.tipo, manzana: u.manzana, piso: u.piso });
    inv.setModalUnidad(true);
  };

  const buscarCliente = async (cedula: string) => {
    if (!cedula?.trim()) return;
    setBuscandoCliente(true);
    try {
      const result = await buscarClientePorCedula(cedula.trim(), inv.proyectoId);
      const cliente = Array.isArray(result) ? result[0] : result;
      setClienteEncontrado(cliente || null);
    } catch { setClienteEncontrado(null); }
    finally { setBuscandoCliente(false); }
  };

  const handleBloquear = async (omitir: boolean, values?: any) => {
    if (!unidadABloquear) return;
    setGuardandoBloqueo(true);
    try {
      const payload: any = { proyecto_id: inv.proyectoId, unidad_id: unidadABloquear.unidad_id, ...(!omitir ? values : {}) };
      let intentos = 0;
      while (intentos < 2) {
        try { await bloquearUnidad(payload); break; }
        catch (err: any) {
          const s = err?.response?.statusCode ?? err?.response?.status;
          if ((s === 502 || s === 503) && intentos === 0) { intentos++; await new Promise(r => setTimeout(r, 1500)); continue; }
          throw err;
        }
      }
      message.success(omitir ? `Unidad ${unidadABloquear.id_unidad} bloqueada` : `Unidad ${unidadABloquear.id_unidad} bloqueada y cliente registrado`);
      setModalBloqueo(false); setClienteEncontrado(null);
      await inv.cargarUnidades();
    } catch (err: any) {
      const s = err?.response?.statusCode ?? err?.response?.status;
      if (s === 409) message.error('La unidad ya no está disponible o el cliente tiene exclusividad con otra inmobiliaria');
      else if (s === 429) message.warning('No puedes re-bloquear esta unidad antes de 24h');
      else message.error('Error al procesar la operación');
    } finally { setGuardandoBloqueo(false); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {inv.vista === 'unidades' && (
            <Button icon={<ArrowLeftOutlined />} onClick={inv.volverAProyectos} type="text" />
          )}
          <Title level={4} style={{ margin: 0 }}>
            {inv.vista === 'proyectos' ? 'Proyectos' : inv.proyectoActual?.nombre ?? 'Inventario'}
          </Title>
        </div>
        <Space>
          {inv.vista === 'unidades' && (
            <Tooltip title="Actualizar">
              <Button icon={<ReloadOutlined />} onClick={() => inv.cargarUnidades()} loading={inv.loading} />
            </Tooltip>
          )}
          {inv.isAdmin && inv.vista === 'proyectos' && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { inv.setModoProyecto('crear'); inv.setProyectoEditando(null); inv.setImagenFile(null); formProyecto.resetFields(); inv.setModalProyecto(true); }}>
              Nuevo proyecto
            </Button>
          )}
          {inv.isAdmin && inv.vista === 'unidades' && (
            <Space>
              <Button icon={<SettingOutlined />} onClick={() => inv.setDrawerEtapas(true)}>Etapas</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { inv.setModoUnidad('crear'); inv.setUnidadEditando(null); formUnidad.resetFields(); inv.setModalUnidad(true); }}>
                Nueva unidad
              </Button>
            </Space>
          )}
        </Space>
      </div>

      {/* Vista proyectos */}
      {inv.vista === 'proyectos' && (
        <Row gutter={[20, 20]}>
          {inv.proyectos.map(p => (
            <Col key={p.proyecto_id} xs={24} sm={12} md={8} lg={6}>
              <div style={{ borderRadius: 16, overflow: 'hidden', cursor: 'pointer', background: '#fff', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s, transform 0.2s' }}
                onClick={() => inv.seleccionarProyecto(p.proyecto_id)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
              >
                <div style={{ height: 160, background: p.imagen_url ? undefined : projectGradient(p.nombre), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <AppstoreOutlined style={{ fontSize: 48, color: 'rgba(255,255,255,0.5)' }} />}
                  {inv.isAdmin && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }} onClick={e => e.stopPropagation()}>
                      <Space>
                        <Button size="small" type="text" icon={<EditOutlined />} style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}
                          onClick={() => { inv.setModoProyecto('editar'); inv.setProyectoEditando(p); inv.setImagenFile(null); formProyecto.setFieldsValue({ nombre: p.nombre, descripcion: p.descripcion }); inv.setModalProyecto(true); }} />
                        <Popconfirm title="¿Desactivar proyecto?" okText="Sí" cancelText="No" onConfirm={async () => { await eliminarProyecto(p.proyecto_id); inv.cargarProyectos(); }}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6 }} />
                        </Popconfirm>
                      </Space>
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>{p.nombre}</Text>
                  {p.descripcion ? <Text type="secondary" style={{ fontSize: 13 }} ellipsis={{ tooltip: p.descripcion }}>{p.descripcion}</Text>
                    : <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>Sin descripción</Text>}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* Vista unidades */}
      {inv.vista === 'unidades' && (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Select allowClear placeholder="Etapa" style={{ width: 150 }} value={inv.filtroEtapa || undefined} onChange={v => inv.setFiltroEtapa(v || '')}>
              {inv.etapas.map(e => <Option key={e.etapa_id} value={e.etapa_id}>{e.nombre}</Option>)}
            </Select>
            <Select allowClear placeholder="Estado" style={{ width: 150 }} value={inv.filtroEstado || undefined} onChange={v => inv.setFiltroEstado(v || '')}>
              {Object.entries(ESTADO_UNIDAD_CONFIG).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
            <Input placeholder="Tipo" style={{ width: 120 }} value={inv.filtroTipo} onChange={e => inv.setFiltroTipo(e.target.value)} allowClear />
            <Input placeholder="Manzana" style={{ width: 120 }} value={inv.filtroManzana} onChange={e => inv.setFiltroManzana(e.target.value)} allowClear />
            <Input placeholder="Piso" style={{ width: 100 }} value={inv.filtroPiso} onChange={e => inv.setFiltroPiso(e.target.value)} allowClear />
            <Button onClick={() => inv.cargarUnidades()} loading={inv.loading}>Aplicar filtros</Button>
          </Space>
          <TablaUnidades
            unidades={inv.unidades} etapas={inv.etapas} loading={inv.loading}
            isAdmin={inv.isAdmin} isInmobiliaria={inv.isInmobiliaria}
            inmoNombre={inv.inmoNombre}
            onEditar={abrirEditarUnidad}
            onEliminar={inv.handleEliminarUnidad}
            onBloquear={u => { setUnidadABloquear(u); setClienteEncontrado(null); setModalBloqueo(true); }}
          />
        </>
      )}

      {/* Modal proyecto */}
      <Modal title={inv.modoProyecto === 'crear' ? 'Nuevo proyecto' : 'Editar proyecto'} open={inv.modalProyecto}
        onCancel={() => { inv.setModalProyecto(false); inv.setImagenFile(null); }}
        onOk={() => formProyecto.submit()} okText="Guardar" cancelText="Cancelar" confirmLoading={inv.uploadingImagen}>
        <Form form={formProyecto} layout="vertical" onFinish={inv.handleGuardarProyecto}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Imagen (opcional)">
            <Upload beforeUpload={file => { inv.setImagenFile(file as any); return false; }} maxCount={1} accept="image/*"
              fileList={inv.imagenFile ? [inv.imagenFile] : []} onRemove={() => inv.setImagenFile(null)}>
              <Button icon={<UploadOutlined />}>Seleccionar imagen</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <DrawerEtapas
        open={inv.drawerEtapas} etapas={inv.etapas} etapaEditando={inv.etapaEditando}
        onClose={() => inv.setDrawerEtapas(false)}
        onGuardar={inv.handleGuardarEtapa}
        onEliminar={inv.handleEliminarEtapa}
        onEditar={e => inv.setEtapaEditando(e)}
        onCancelarEdicion={() => inv.setEtapaEditando(null)}
      />

      <ModalUnidad
        open={inv.modalUnidad} modo={inv.modoUnidad} etapas={inv.etapas} unidadEditando={inv.unidadEditando}
        onCancel={() => inv.setModalUnidad(false)}
        onFinish={inv.handleGuardarUnidad}
      />

      <ModalBloqueo
        open={modalBloqueo} unidad={unidadABloquear}
        clienteEncontrado={clienteEncontrado} buscandoCliente={buscandoCliente} guardando={guardandoBloqueo}
        onCancel={() => { setModalBloqueo(false); setClienteEncontrado(null); }}
        onBuscar={buscarCliente}
        onBloquear={handleBloquear}
      />
    </div>
  );
};

export default InventarioPage;

import { useState } from 'react';
import { Select, Typography, Alert } from 'antd';
import { useInventario } from '../../hooks/useInventario';
import MigracionExcel from '../../components/inventario/MigracionExcel';

const { Title, Text } = Typography;

const MigracionPage = () => {
  const inv = useInventario();
  const [proyectoId, setProyectoId] = useState('');
  const [completado, setCompletado] = useState(false);

  const proyectoSeleccionado = inv.proyectos.find(p => p.proyecto_id === proyectoId);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Migración de inventario</Title>
        <Text type="secondary">
          Carga masiva desde Excel. Solo disponible para proyectos nuevos sin unidades.
        </Text>
      </div>

      {!proyectoId && (
        <div style={{ maxWidth: 400 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Selecciona el proyecto destino
          </Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Seleccionar proyecto"
            options={inv.proyectos.map(p => ({ value: p.proyecto_id, label: p.nombre }))}
            onChange={v => { setProyectoId(v); setCompletado(false); }}
          />
        </div>
      )}

      {proyectoId && proyectoSeleccionado && !completado && (
        <MigracionExcel
          proyectoId={proyectoId}
          proyectoNombre={proyectoSeleccionado.nombre}
          onCerrar={() => {
            setCompletado(true);
            setProyectoId('');
          }}
        />
      )}

      {completado && (
        <Alert
          type="success"
          message="Migración completada"
          description="Puedes ir a Proyectos para ver el inventario cargado, o iniciar otra migración seleccionando un nuevo proyecto."
          showIcon
          action={
            <Text
              style={{ color: '#1677ff', cursor: 'pointer' }}
              onClick={() => setCompletado(false)}
            >
              Nueva migración
            </Text>
          }
        />
      )}
    </div>
  );
};

export default MigracionPage;

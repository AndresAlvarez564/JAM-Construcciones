export const ESTADO_UNIDAD_CONFIG: Record<string, { label: string; tagColor: string }> = {
  disponible:    { label: 'Disponible',    tagColor: 'success' },
  bloqueada:     { label: 'Bloqueada',     tagColor: 'warning' },
  no_disponible: { label: 'No disponible', tagColor: 'orange' },
  vendida:       { label: 'Vendida',       tagColor: 'default' },
  desvinculada:  { label: 'Desvinculada',  tagColor: 'error' },
};

export const ESTADO_PROCESO_COLOR: Record<string, string> = {
  captacion: 'blue', disponible: 'default', reserva: 'orange',
  separacion: 'purple', inicial: 'cyan', desvinculado: 'red',
};

export const ESTADO_PROCESO_LABEL: Record<string, string> = {
  captacion: 'Captación', disponible: 'Disponible', reserva: 'Reserva',
  separacion: 'Separación', inicial: 'Inicial', desvinculado: 'Desvinculado',
};

export const projectGradient = (nombre: string): string => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};

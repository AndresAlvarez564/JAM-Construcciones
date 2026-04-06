import { Typography } from 'antd';
import useAuth from '../../hooks/useAuth';

const DashboardPage = () => {
  const { usuario } = useAuth();
  return (
    <div>
      <Typography.Title level={4}>Bienvenido, {usuario?.nombre}</Typography.Title>
      <Typography.Text type="secondary">Panel principal — próximamente</Typography.Text>
    </div>
  );
};

export default DashboardPage;

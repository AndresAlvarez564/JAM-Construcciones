import { Menu } from 'antd';
import { AppstoreOutlined, TeamOutlined, HomeOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();

  const items = [
    { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/inventario', icon: <AppstoreOutlined />, label: 'Inventario' },
    { key: '/clientes', icon: <TeamOutlined />, label: 'Clientes' },
    ...(usuario?.rol === 'admin'
      ? [{ key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes' }]
      : []),
  ];

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};

export default Sidebar;

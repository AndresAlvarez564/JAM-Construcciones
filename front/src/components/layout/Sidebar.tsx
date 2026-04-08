import { Menu } from 'antd';
import { AppstoreOutlined, TeamOutlined, HomeOutlined, BarChartOutlined, BankOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

interface Props {
  onSelect: () => void;
}

const Sidebar = ({ onSelect }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const rol = usuario?.rol;

  const isAdmin = rol === 'admin';
  const isInterno = rol === 'admin' || rol === 'coordinador' || rol === 'supervisor';
  const canEdit = rol === 'admin' || rol === 'coordinador';

  const items = [
    { key: '/dashboard', icon: <HomeOutlined />, label: 'Dashboard' },
    { key: '/inventario', icon: <AppstoreOutlined />, label: 'Inventario' },
    ...(isInterno ? [{ key: '/clientes', icon: <TeamOutlined />, label: 'Clientes' }] : []),
    ...(rol === 'inmobiliaria' ? [{ key: '/clientes', icon: <TeamOutlined />, label: 'Clientes' }] : []),
    ...(isInterno ? [{ key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes' }] : []),
    ...(isAdmin ? [
      { key: '/inmobiliarias', icon: <BankOutlined />, label: 'Inmobiliarias' },
      { key: '/sistema/usuarios', icon: <UserOutlined />, label: 'Usuarios del sistema' },
    ] : []),
  ];

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => { navigate(key); onSelect(); }}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};

export default Sidebar;

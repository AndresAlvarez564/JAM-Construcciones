import { Layout, Typography, Space, Button, Avatar, Grid } from 'antd';
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import useAuth from '../../hooks/useAuth';

const { Header } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: Props) => {
  const { usuario, logout } = useAuth();
  const screens = useBreakpoint();

  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#001529' }}>
      <Space>
        {!screens.lg && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            style={{ color: 'white' }}
            onClick={onMenuClick}
          />
        )}
        <Typography.Title level={4} style={{ color: 'white', margin: 0 }}>
          JAM Construcciones
        </Typography.Title>
      </Space>
      <Space>
        <Avatar icon={<UserOutlined />} />
        {screens.sm && <Text style={{ color: 'white' }}>{usuario?.nombre}</Text>}
        <Button
          type="text"
          icon={<LogoutOutlined />}
          style={{ color: 'white' }}
          onClick={logout}
        />
      </Space>
    </Header>
  );
};

export default Navbar;

import { Layout, Typography, Space, Button, Avatar } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import useAuth from '../../hooks/useAuth';

const { Header } = Layout;
const { Text } = Typography;

const Navbar = () => {
  const { usuario, logout } = useAuth();

  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#001529' }}>
      <Typography.Title level={4} style={{ color: 'white', margin: 0 }}>
        JAM Construcciones
      </Typography.Title>
      <Space>
        <Avatar icon={<UserOutlined />} />
        <Text style={{ color: 'white' }}>{usuario?.nombre}</Text>
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

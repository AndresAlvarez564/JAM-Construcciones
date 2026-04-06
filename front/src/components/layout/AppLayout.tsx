import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const { Content, Sider } = Layout;

const AppLayout = () => (
  <Layout style={{ minHeight: '100vh' }}>
    <Navbar />
    <Layout>
      <Sider width={220} style={{ background: '#fff' }}>
        <Sidebar />
      </Sider>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <Outlet />
      </Content>
    </Layout>
  </Layout>
);

export default AppLayout;

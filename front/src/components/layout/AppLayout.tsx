import { Layout, Drawer } from 'antd';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const { Content, Sider } = Layout;

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navbar onMenuClick={() => setDrawerOpen(true)} />
      <Layout>
        {/* Sidebar desktop */}
        <Sider
          width={220}
          breakpoint="lg"
          collapsedWidth={0}
          style={{ background: '#fff' }}
          trigger={null}
        >
          <Sidebar onSelect={() => {}} />
        </Sider>

        {/* Drawer móvil */}
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          styles={{ body: { padding: 0 } }}
          width={220}
          title="JAM Construcciones"
        >
          <Sidebar onSelect={() => setDrawerOpen(false)} />
        </Drawer>

        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: '100%' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;

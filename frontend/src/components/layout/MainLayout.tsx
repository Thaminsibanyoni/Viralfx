import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Drawer, Typography, Space, Dropdown } from 'antd';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MenuOutlined, LoginOutlined, UserAddOutlined, TwitterOutlined, LinkedinOutlined, GithubOutlined, InstagramOutlined, ChevronDownOutlined
} from '@ant-design/icons';
import LanguageSwitcher from '../common/LanguageSwitcher';

const {Header, Content, Footer} = Layout;
const {Title, Text} = Typography;

const MainLayout: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { key: 'home', label: 'Home', path: '/' },
    { key: 'markets', label: 'Markets', path: '/markets' },
    { key: 'topics', label: 'Topics', path: '/topics' },
  ];

  const authButtons = (
    <Space>
      <Button
        type="text"
        icon={<LoginOutlined />}
        onClick={() => navigate('/login')}
        style={{ color: scrolled ? '#4B0082' : '#4B0082' }}
      >
        Login
      </Button>
      <Button
        type="primary"
        icon={<UserAddOutlined />}
        onClick={() => navigate('/register')}
        style={{
          background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
        }}
      >
        Register
      </Button>
    </Space>
  );

  const footerLinks = [
    { title: 'Product', links: ['Markets', 'Topics'] },
    { title: 'Legal', links: ['Terms', 'Privacy', 'Disclaimer'] },
  ];

  const socialLinks = [
    { icon: <TwitterOutlined />, url: '#' },
    { icon: <LinkedinOutlined />, url: '#' },
    { icon: <GithubOutlined />, url: '#' },
    { icon: <InstagramOutlined />, url: '#' },
  ];

  return (
    <Layout className="min-h-screen" style={{ background: '#0E0E10' }}>
      <Header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: scrolled
            ? 'rgba(14, 14, 16, 0.95)'
            : location.pathname === '/'
            ? 'transparent'
            : 'rgba(14, 14, 16, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: scrolled ? '1px solid rgba(255, 179, 0, 0.2)' : 'none',
          transition: 'all 0.3s ease',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white',
                fontSize: '16px',
              }}
            >
              VF
            </div>
            <Title
              level={3}
              style={{
                margin: 0,
                color: scrolled || location.pathname !== '/' ? '#4B0082' : 'white',
                fontSize: '24px',
                fontWeight: 'bold',
              }}
            >
              ViralFX
            </Title>
          </Link>

          <div className="hidden md:flex flex-1 justify-center">
            <Menu
              mode="horizontal"
              selectedKeys={[location.pathname]}
              style={{
                background: 'transparent',
                border: 'none',
                minWidth: '300px',
              }}
            >
              {menuItems.map((item) => (
                <Menu.Item key={item.path}>
                  <Link
                    to={item.path}
                    style={{
                      color: scrolled || location.pathname !== '/' ? '#4B0082' : 'white',
                      fontWeight: '500',
                      fontSize: '14px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(75, 0, 130, 0.1)';
                      e.currentTarget.style.color = '#4B0082';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = scrolled || location.pathname !== '/' ? '#4B0082' : 'white';
                    }}
                  >
                    {item.label}
                  </Link>
                </Menu.Item>
              ))}
            </Menu>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden md:block">{authButtons}</div>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setVisible(true)}
            className="md:hidden"
            style={{
              color: scrolled || location.pathname !== '/' ? '#4B0082' : 'white',
              fontSize: '18px',
              padding: '8px',
            }}
          />
        </div>
      </Header>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
              }}
            >
              VF
            </div>
            <span style={{ color: '#4B0082', fontWeight: 'bold' }}>ViralFX</span>
          </div>
        }
        placement="right"
        onClose={() => setVisible(false)}
        open={visible}
        width={300}
        bodyStyle={{ padding: '24px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <LanguageSwitcher />
          {menuItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => setVisible(false)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                color: '#4B0082',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(75, 0, 130, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ marginTop: '16px' }}>{authButtons}</div>
        </div>
      </Drawer>

      <Content style={{ marginTop: '72px', minHeight: 'calc(100vh - 72px)' }}>
        <Outlet />
      </Content>

      <Footer
        style={{
          background: '#1A1A1C',
          borderTop: '1px solid rgba(255, 179, 0, 0.2)',
          padding: '48px 24px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '48px',
              marginBottom: '48px',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                >
                  VF
                </div>
                <Title level={4} style={{ margin: 0, color: '#FFB300' }}>
                  ViralFX
                </Title>
              </div>
              <Text style={{ color: '#B8BCC8', lineHeight: '1.6' }}>
                Trade the trend with South Africa's leading viral trading platform.
                Real-time market data powered by social media trends.
              </Text>
            </div>

            {footerLinks.map((section) => (
              <div key={section.title}>
                <Title level={5} style={{ color: '#FFB300', marginBottom: '16px' }}>
                  {section.title}
                </Title>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {section.links.map((link) => (
                    <li key={link} style={{ marginBottom: '12px' }}>
                      <Link
                        to={`/${link.toLowerCase()}`}
                        style={{
                          color: '#B8BCC8',
                          textDecoration: 'none',
                          transition: 'color 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#FFB300';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#B8BCC8';
                        }}
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <Title level={5} style={{ color: '#FFB300', marginBottom: '16px' }}>
                Connect With Us
              </Title>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    style={{
                      width: '40px',
                      height: '40px',
                      background: 'rgba(255, 179, 0, 0.1)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFB300',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#FFB300';
                      e.currentTarget.style.color = '#0E0E10';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 179, 0, 0.1)';
                      e.currentTarget.style.color = '#FFB300';
                    }}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
              <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                Subscribe to our newsletter for the latest market trends and platform updates.
              </Text>
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255, 179, 0, 0.2)',
              paddingTop: '24px',
              textAlign: 'center',
            }}
          >
            <Text style={{ color: '#B8BCC8' }}>
              © 2024 ViralFX. All rights reserved. | FSCA Authorized | POPIA Compliant
            </Text>
          </div>
        </div>
      </Footer>
    </Layout>
  );
};

export default MainLayout;
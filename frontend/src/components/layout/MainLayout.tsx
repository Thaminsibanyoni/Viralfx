import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Drawer, Typography, Space } from 'antd';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MenuOutlined, LoginOutlined, UserAddOutlined, TwitterOutlined, LinkedinOutlined, GithubOutlined, InstagramOutlined
} from '@ant-design/icons';
import LanguageSwitcher from '../common/LanguageSwitcher';
import WhatsAppButton from '../common/WhatsAppButton';
import { XIcon, TikTokIcon } from '../icons/SocialIcons';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

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
        className="text-purple-800 hover:text-purple-900 hover:bg-purple-50/10 transition-all duration-300 font-medium"
      >
        Login
      </Button>
      <Button
        type="primary"
        icon={<UserAddOutlined />}
        onClick={() => navigate('/register')}
        className="bg-gradient-to-r from-purple-800 to-purple-600 hover:from-purple-900 hover:to-purple-700 border-0 shadow-lg shadow-purple-900/30 transition-all duration-300 hover:shadow-xl hover:shadow-purple-900/40 hover:scale-105"
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
    { icon: <XIcon className="text-lg" />, url: '#' },
    { icon: <TikTokIcon className="text-lg" />, url: '#' },
    { icon: <InstagramOutlined className="text-lg" />, url: '#' },
    { icon: <LinkedinOutlined className="text-lg" />, url: '#' },
  ];

  const isActiveRoute = (path: string) => location.pathname === path;

  return (
    <Layout className="min-h-screen bg-dark-950">
      {/* Header */}
      <Header
        className={`
          fixed top-0 left-0 right-0 z-50
          backdrop-blur-xl
          transition-all duration-300 ease-out
          px-6 h-[72px]
          flex items-center justify-between
          ${scrolled || location.pathname !== '/'
            ? 'bg-dark-950/90 border-b border-gold-400/20'
            : 'bg-transparent border-0'
          }
        `}
      >
        {/* Logo & Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition-opacity duration-300"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-800 to-gold-400 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg shadow-purple-900/20">
              VF
            </div>
            <Title
              level={3}
              className={`
                !mb-0 !text-2xl !font-bold
                transition-colors duration-300
                ${scrolled || location.pathname !== '/'
                  ? 'bg-gradient-to-r from-purple-800 to-gold-400 bg-clip-text text-transparent'
                  : 'text-white'
                }
              `}
            >
              ViralFX
            </Title>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex flex-1 justify-center">
            <Menu
              mode="horizontal"
              selectedKeys={[location.pathname]}
              className="bg-transparent border-0 min-w-[300px]"
              items={menuItems.map((item) => ({
                key: item.path,
                label: (
                  <Link
                    to={item.path}
                    className={`
                      relative font-medium text-sm
                      transition-all duration-300
                      ${isActiveRoute(item.path)
                        ? 'text-gold-400'
                        : scrolled || location.pathname !== '/'
                        ? 'text-gray-700 hover:text-purple-800'
                        : 'text-gray-200 hover:text-white'
                      }
                    `}
                  >
                    {item.label}
                    {isActiveRoute(item.path) && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-400 rounded-full" />
                    )}
                  </Link>
                ),
              }))}
            />
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <div className="hidden lg:block">{authButtons}</div>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setVisible(true)}
            className={`
              lg:hidden transition-all duration-300
              ${scrolled || location.pathname !== '/'
                ? 'text-purple-800 hover:bg-purple-50/10'
                : 'text-white hover:bg-white/10'
              }
            `}
          />
        </div>
      </Header>

      {/* Mobile Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-800 to-gold-400 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md">
              VF
            </div>
            <span className="bg-gradient-to-r from-purple-800 to-gold-400 bg-clip-text text-transparent font-bold">
              ViralFX
            </span>
          </div>
        }
        placement="right"
        onClose={() => setVisible(false)}
        open={visible}
        width={320}
        className="backdrop-blur-xl"
        styles={{
          body: { padding: '24px' },
          mask: { backdropFilter: 'blur(8px)' },
        }}
      >
        <div className="flex flex-col gap-4">
          <LanguageSwitcher />

          <div className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.key}
                to={item.path}
                onClick={() => setVisible(false)}
                className={`
                  block px-4 py-3 rounded-lg font-medium
                  transition-all duration-300
                  ${isActiveRoute(item.path)
                    ? 'bg-gradient-to-r from-purple-800/10 to-gold-400/10 text-gold-400 border-l-4 border-gold-400'
                    : 'text-gray-700 hover:bg-purple-800/5 hover:text-purple-800'
                  }
                `}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            {authButtons}
          </div>
        </div>
      </Drawer>

      {/* Main Content */}
      <Content className="mt-[72px] min-h-[calc(100vh-72px)]">
        <Outlet />
      </Content>

      {/* Footer */}
      <Footer className="bg-dark-900 border-t border-gold-400/20 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand Section */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-800 to-gold-400 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg shadow-purple-900/20">
                  VF
                </div>
                <Title level={4} className="!mb-0 text-gold-400">
                  ViralFX
                </Title>
              </div>
              <Text className="text-gray-400 leading-relaxed block">
                Trade the trend with South Africa's leading viral trading platform.
                Real-time market data powered by social media trends.
              </Text>
            </div>

            {/* Footer Links */}
            {footerLinks.map((section) => (
              <div key={section.title}>
                <Title level={5} className="text-gold-400 mb-4 font-semibold">
                  {section.title}
                </Title>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link}>
                      <Link
                        to={`/${link.toLowerCase()}`}
                        className="text-gray-400 hover:text-gold-400 transition-colors duration-300 inline-block"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Social & Newsletter */}
            <div>
              <Title level={5} className="text-gold-400 mb-4 font-semibold">
                Connect With Us
              </Title>
              <div className="flex gap-3 mb-6">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.url}
                    className="
                      w-10 h-10
                      bg-gold-400/10
                      rounded-full
                      flex items-center justify-center
                      text-gold-400
                      hover:bg-gold-400
                      hover:text-dark-950
                      transition-all duration-300
                      hover:scale-110
                      hover:shadow-lg hover:shadow-gold-400/30
                    "
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
              <Text className="text-gray-400 text-sm leading-relaxed block">
                Subscribe to our newsletter for the latest market trends and platform updates.
              </Text>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gold-400/20 pt-6 text-center">
            <Text className="text-gray-400 text-sm">
              © 2024 ViralFX. All rights reserved. | FSCA Authorized | POPIA Compliant
            </Text>
          </div>
        </div>
      </Footer>

      {/* WhatsApp Button */}
      <WhatsAppButton />
    </Layout>
  );
};

export default MainLayout;

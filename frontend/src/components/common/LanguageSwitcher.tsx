import React, { useState } from 'react';
import {
  Select, Space, Avatar, Typography, Divider, Button, Modal, Row, Col, Card, Tag, } from 'antd';
import {
  GlobalOutlined, CheckOutlined, } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { supportedLanguages, supportedRegions, supportedCurrencies } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';

const {Text} = Typography;
const {Option} = Select;

interface LanguageSwitcherProps {
  type?: 'dropdown' | 'modal';
  showRegion?: boolean;
  showCurrency?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  type = 'dropdown',
  showRegion = false,
  showCurrency = false,
}) => {
  const {i18n, t} = useTranslation();
  const {user, updateUser} = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);

  const currentLanguage = supportedLanguages.find(lang => lang.code === i18n.language) || supportedLanguages[0];
  const currentRegion = supportedRegions.find(region => region.code === user?.preferences?.region) || supportedRegions[0];
  const currentCurrency = supportedCurrencies.find(currency => currency.code === user?.preferences?.currency) || supportedCurrencies[0];

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    borderDefault: '#d9d9d9',
  };

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);

    // Update user preferences if logged in
    if (user) {
      updateUser({
        ...user,
        preferences: {
          ...user.preferences,
          language: languageCode as any,
        },
      });
    }
  };

  const handleRegionChange = (regionCode: string) => {
    const region = supportedRegions.find(r => r.code === regionCode);
    if (region && user) {
      updateUser({
        ...user,
        preferences: {
          ...user.preferences,
          region: regionCode as any,
          timezone: region.timezone,
          currency: region.currency as any,
        },
      });
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    if (user) {
      updateUser({
        ...user,
        preferences: {
          ...user.preferences,
          currency: currencyCode as any,
        },
      });
    }
  };

  const renderDropdownContent = () => (
    <Select
      value={currentLanguage.code}
      onChange={handleLanguageChange}
      style={{ minWidth: 120 }}
      suffixIcon={<GlobalOutlined />}
    >
      {supportedLanguages.map((language) => (
        <Option key={language.code} value={language.code}>
          <Space>
            <span>{language.flag}</span>
            <span>{language.nativeName}</span>
          </Space>
        </Option>
      ))}
    </Select>
  );

  const renderModalContent = () => (
    <>
      <Button
        type="text"
        icon={<GlobalOutlined />}
        onClick={() => setModalVisible(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: viralFxColors.textPrimary,
        }}
      >
        <Space>
          <span>{currentLanguage.flag}</span>
          <span>{currentLanguage.nativeName}</span>
        </Space>
      </Button>

      <Modal
        title={
          <Space>
            <GlobalOutlined style={{ color: viralFxColors.primaryPurple }} />
            <span>{t('preferences.language')} & Region Settings</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            {t('common.close')}
          </Button>,
        ]}
        width={800}
      >
        {/* Language Selection */}
        <div style={{ marginBottom: '32px' }}>
          <Title level={4} style={{ color: viralFxColors.textPrimary, marginBottom: '16px' }}>
            {t('preferences.language')}
          </Title>
          <Row gutter={[16, 16]}>
            {supportedLanguages.map((language) => (
              <Col xs={12} sm={8} md={6} key={language.code}>
                <Card
                  hoverable
                  onClick={() => handleLanguageChange(language.code)}
                  style={{
                    border: currentLanguage.code === language.code
                      ? `2px solid ${viralFxColors.primaryPurple}`
                      : `1px solid ${viralFxColors.borderDefault}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    backgroundColor: currentLanguage.code === language.code
                      ? `${viralFxColors.primaryPurple}10`
                      : viralFxColors.backgroundPrimary,
                  }}
                  bodyStyle={{ padding: '16px' }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                    {language.flag}
                  </div>
                  <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                    {language.nativeName}
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {language.name}
                  </Text>
                  {currentLanguage.code === language.code && (
                    <div style={{ marginTop: '8px' }}>
                      <CheckOutlined style={{ color: viralFxColors.successGreen }} />
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {showRegion && (
          <>
            <Divider />
            {/* Region Selection */}
            <div style={{ marginBottom: '32px' }}>
              <Title level={4} style={{ color: viralFxColors.textPrimary, marginBottom: '16px' }}>
                Region
              </Title>
              <Row gutter={[16, 16]}>
                {supportedRegions.map((region) => (
                  <Col xs={12} sm={8} md={6} key={region.code}>
                    <Card
                      hoverable
                      onClick={() => handleRegionChange(region.code)}
                      style={{
                        border: currentRegion.code === region.code
                          ? `2px solid ${viralFxColors.primaryPurple}`
                          : `1px solid ${viralFxColors.borderDefault}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: currentRegion.code === region.code
                          ? `${viralFxColors.primaryPurple}10`
                          : viralFxColors.backgroundPrimary,
                      }}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                        {region.flag}
                      </div>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        {region.name}
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {region.currency} • {region.timezone.split('/')[1]?.replace('_', ' ')}
                      </Text>
                      {currentRegion.code === region.code && (
                        <div style={{ marginTop: '8px' }}>
                          <CheckOutlined style={{ color: viralFxColors.successGreen }} />
                        </div>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </>
        )}

        {showCurrency && (
          <>
            <Divider />
            {/* Currency Selection */}
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ color: viralFxColors.textPrimary, marginBottom: '16px' }}>
                {t('preferences.currency')}
              </Title>
              <Row gutter={[16, 16]}>
                {supportedCurrencies.map((currency) => (
                  <Col xs={12} sm={8} md={6} key={currency.code}>
                    <Card
                      hoverable
                      onClick={() => handleCurrencyChange(currency.code)}
                      style={{
                        border: currentCurrency.code === currency.code
                          ? `2px solid ${viralFxColors.primaryPurple}`
                          : `1px solid ${viralFxColors.borderDefault}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: currentCurrency.code === currency.code
                          ? `${viralFxColors.primaryPurple}10`
                          : viralFxColors.backgroundPrimary,
                      }}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div style={{ fontSize: '20px', marginBottom: '8px' }}>
                        {currency.symbol}
                      </div>
                      <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                        {currency.code}
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {currency.name}
                      </Text>
                      {currentCurrency.code === currency.code && (
                        <div style={{ marginTop: '8px' }}>
                          <CheckOutlined style={{ color: viralFxColors.successGreen }} />
                        </div>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </>
        )}

        {/* Current Selection Summary */}
        <Card
          style={{
            backgroundColor: `${viralFxColors.primaryPurple}10`,
            border: `1px solid ${viralFxColors.primaryPurple}`,
            borderRadius: '8px',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Current Language:</Text>
              <Space>
                <span>{currentLanguage.flag}</span>
                <span>{currentLanguage.nativeName}</span>
              </Space>
            </div>
            {showRegion && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Current Region:</Text>
                <Space>
                  <span>{currentRegion.flag}</span>
                  <span>{currentRegion.name}</span>
                </Space>
              </div>
            )}
            {showCurrency && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Current Currency:</Text>
                <Space>
                  <span>{currentCurrency.symbol}</span>
                  <span>{currentCurrency.code}</span>
                </Space>
              </div>
            )}
          </Space>
        </Card>
      </Modal>
    </>
  );

  return type === 'dropdown' ? renderDropdownContent() : renderModalContent();
};

export default LanguageSwitcher;
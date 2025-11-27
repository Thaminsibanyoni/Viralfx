import React, { useState, useEffect } from 'react';
import {
  Form, Switch, Select, Button, Card, Row, Col, Divider, Space, Radio, Slider, InputNumber, Alert, Tooltip, Typography, Tag, } from 'antd';
import {
  GlobalOutlined, BulbOutlined, DollarOutlined, TranslationOutlined, SettingOutlined, InfoCircleOutlined, ThunderboltOutlined, MonitorOutlined, MobileOutlined, } from '@ant-design/icons';
import { User } from '../../types/user.types';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { supportedLanguages, supportedCurrencies, supportedRegions } from '../../i18n';
import { useCurrencyFormatter } from '../../utils/currency';

const {Title, Text} = Typography;
const {Option} = Select;

interface PreferencesTabProps {
  user: User;
  onUpdateUser: (userData: Partial<User>) => void;
}

const PreferencesTab: React.FC<PreferencesTabProps> = ({ user, onUpdateUser }) => {
  const {t} = useTranslation();
  const {formatCurrency, formatDate, formatTime} = useCurrencyFormatter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  // Global currencies with comprehensive support
  const currencies = supportedCurrencies;

  // Global languages with comprehensive support
  const languages = supportedLanguages;

  // Global regions with timezone support
  const regions = supportedRegions;
  const timezones = regions.map(region => ({
    value: region.timezone,
    label: `${region.name} (${region.timezone.split('/')[1]?.replace('_', ' ')})`,
  }));

  const chartTypes = [
    { value: 'candlestick', label: 'Candlestick', description: 'Traditional candlestick charts' },
    { value: 'line', label: 'Line Chart', description: 'Simple line chart' },
    { value: 'bar', label: 'Bar Chart', description: 'OHLC bar chart' },
    { value: 'area', label: 'Area Chart', description: 'Filled area chart' },
  ];

  const tradingLayouts = [
    { value: 'default', label: 'Default', description: 'Standard trading layout' },
    { value: 'pro', label: 'Professional', description: 'Advanced multi-screen layout' },
    { value: 'mobile', label: 'Mobile Optimized', description: 'Simplified mobile layout' },
    { value: 'minimal', label: 'Minimal', description: 'Clean, distraction-free layout' },
  ];

  useEffect(() => {
    // Initialize form with user preferences
    form.setFieldsValue({
      theme: user.preferences?.theme || 'system',
      language: user.preferences?.language || 'en',
      currency: user.preferences?.currency || 'ZAR',
      timezone: user.preferences?.timezone || 'Africa/Johannesburg',
      chartType: user.preferences?.chartType || 'candlestick',
      tradingLayout: user.preferences?.tradingLayout || 'default',
      autoSave: user.preferences?.autoSave ?? true,
      showAdvancedFeatures: user.preferences?.showAdvancedFeatures ?? false,
      enableKeyboardShortcuts: user.preferences?.enableKeyboardShortcuts ?? true,
      confirmBeforeTrading: user.preferences?.confirmBeforeTrading ?? true,
      defaultOrderSize: user.preferences?.defaultOrderSize || 1000,
      slippageTolerance: user.preferences?.slippageTolerance || 0.5,
      pricePrecision: user.preferences?.pricePrecision || 2,
      enableSounds: user.preferences?.enableSounds ?? true,
      enableAnimations: user.preferences?.enableAnimations ?? true,
      compactMode: user.preferences?.compactMode ?? false,
      showTooltip: user.preferences?.showTooltip ?? true,
      highContrastMode: user.preferences?.highContrastMode ?? false,
    });
  }, [user, form]);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          ...values,
        },
      };

      onUpdateUser(updatedUser);
      toast.success('Preferences updated successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to update preferences. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const renderThemeSelector = () => (
    <Form.Item label="Theme" name="theme">
      <Radio.Group>
        <Space direction="vertical">
          <Radio value="light">
            <Space>
              <BulbOutlined style={{ color: viralFxColors.warningOrange }} />
              <span>Light</span>
            </Space>
          </Radio>
          <Radio value="dark">
            <Space>
              <BulbOutlined style={{ color: viralFxColors.textSecondary }} />
              <span>Dark</span>
            </Space>
          </Radio>
          <Radio value="system">
            <Space>
              <MonitorOutlined />
              <span>System Default</span>
            </Space>
          </Radio>
        </Space>
      </Radio.Group>
    </Form.Item>
  );

  const renderLanguageSettings = () => (
    <Form.Item label="Language" name="language">
      <Select
        placeholder="Select your preferred language"
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
        }
      >
        {languages.map((lang) => (
          <Option key={lang.code} value={lang.code}>
            <Space>
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </Space>
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  const renderCurrencySettings = () => (
    <Form.Item label="Default Currency" name="currency">
      <Select
        placeholder="Select your preferred currency"
        showSearch
        filterOption={(input, option) =>
          (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
        }
      >
        {currencies.map((currency) => (
          <Option key={currency.code} value={currency.code}>
            <Space>
              <span>{currency.symbol}</span>
              <span>{currency.code} - {currency.name}</span>
            </Space>
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  const renderTradingPreferences = () => (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: viralFxColors.accentGold }} />
          <span>Trading Preferences</span>
        </Space>
      }
      style={{
        marginBottom: '24px',
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
      }}
    >
      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form.Item label="Chart Type" name="chartType">
            <Select>
              {chartTypes.map((type) => (
                <Option key={type.value} value={type.value}>
                  <div>
                    <div>{type.label}</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {type.description}
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Trading Layout" name="tradingLayout">
            <Select>
              {tradingLayouts.map((layout) => (
                <Option key={layout.value} value={layout.value}>
                  <div>
                    <div>{layout.label}</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {layout.description}
                    </Text>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form.Item label="Default Order Size (ZAR)" name="defaultOrderSize">
            <InputNumber
              style={{ width: '100%' }}
              min={100}
              max={1000000}
              step={100}
              formatter={value => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value!.replace(/R\s?|(,*)/g, '')}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            label={
              <Space>
                <span>Slippage Tolerance (%)</span>
                <Tooltip title="Maximum acceptable price slippage for trades">
                  <InfoCircleOutlined style={{ color: viralFxColors.textSecondary }} />
                </Tooltip>
              </Space>
            }
            name="slippageTolerance"
          >
            <Slider
              min={0.1}
              max={5}
              step={0.1}
              marks={{
                0.1: '0.1%',
                1: '1%',
                3: '3%',
                5: '5%',
              }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form.Item label="Price Precision" name="pricePrecision">
            <Select>
              <Option value={2}>2 decimal places</Option>
              <Option value={4}>4 decimal places</Option>
              <Option value={6}>6 decimal places</Option>
              <Option value={8}>8 decimal places</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Timezone" name="timezone">
            <Select showSearch>
              {timezones.map((tz) => (
                <Option key={tz.value} value={tz.value}>
                  {tz.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );

  const renderAccessibilitySettings = () => (
    <Card
      title={
        <Space>
          <SettingOutlined style={{ color: viralFxColors.primaryPurple }} />
          <span>Accessibility</span>
        </Space>
      }
      style={{
        marginBottom: '24px',
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
      }}
    >
      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form.Item label="High Contrast Mode" name="highContrastMode" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Compact Mode" name="compactMode" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form.Item label="Enable Animations" name="enableAnimations" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item label="Show Tooltips" name="showTooltip" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="Enable Sounds" name="enableSounds" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Alert
        message="Accessibility Features"
        description="These settings help improve the user experience for users with different needs and preferences."
        type="info"
        showIcon
        style={{
          marginTop: '16px',
          backgroundColor: `${viralFxColors.primaryPurple}10`,
          borderColor: viralFxColors.primaryPurple,
        }}
      />
    </Card>
  );

  const renderAdvancedSettings = () => (
    <Card
      title={
        <Space>
          <SettingOutlined style={{ color: viralFxColors.accentGold }} />
          <span>Advanced Settings</span>
        </Space>
      }
      style={{
        marginBottom: '24px',
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Form.Item name="autoSave" valuePropName="checked">
          <Space>
            <Switch />
            <span>Auto-save form data</span>
          </Space>
        </Form.Item>

        <Form.Item name="showAdvancedFeatures" valuePropName="checked">
          <Space>
            <Switch />
            <span>Show advanced trading features</span>
            <Tag color="purple">Experimental</Tag>
          </Space>
        </Form.Item>

        <Form.Item name="enableKeyboardShortcuts" valuePropName="checked">
          <Space>
            <Switch />
            <span>Enable keyboard shortcuts</span>
          </Space>
        </Form.Item>

        <Form.Item name="confirmBeforeTrading" valuePropName="checked">
          <Space>
            <Switch />
            <span>Require confirmation before placing trades</span>
            <Tag color="green">Safety</Tag>
          </Space>
        </Form.Item>
      </Space>

      <Alert
        message="Advanced Settings"
        description="These settings are for experienced users. Modify with caution as they may affect your trading experience."
        type="warning"
        showIcon
        style={{
          marginTop: '16px',
          backgroundColor: `${viralFxColors.warningOrange}10`,
          borderColor: viralFxColors.warningOrange,
        }}
      />
    </Card>
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <Title level={3} style={{ color: viralFxColors.textPrimary, marginBottom: '8px' }}>
          {t('settings.preferences.title')}
        </Title>
        <Text type="secondary">
          {t('settings.preferences.subtitle')}
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        style={{
          backgroundColor: viralFxColors.backgroundPrimary,
        }}
      >
        <Card
          title={
            <Space>
              <GlobalOutlined style={{ color: viralFxColors.primaryPurple }} />
              <span>General Settings</span>
            </Space>
          }
          style={{
            marginBottom: '24px',
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
          }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={24} md={8}>
              {renderThemeSelector()}
            </Col>
            <Col xs={24} md={8}>
              {renderLanguageSettings()}
            </Col>
            <Col xs={24} md={8}>
              {renderCurrencySettings()}
            </Col>
          </Row>
        </Card>

        {renderTradingPreferences()}
        {renderAccessibilitySettings()}
        {renderAdvancedSettings()}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text type="secondary">
              Last updated: {user.preferences?.updatedAt ? new Date(user.preferences.updatedAt).toLocaleDateString() : 'Never'}
            </Text>
          </Space>
          <Space>
            <Button
              onClick={() => form.resetFields()}
              style={{
                borderRadius: '6px',
                borderColor: viralFxColors.borderDefault,
                color: viralFxColors.textSecondary,
              }}
            >
              Reset to Default
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
              }}
            >
              Save Preferences
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default PreferencesTab;
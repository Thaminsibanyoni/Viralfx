import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Select, InputNumber, DatePicker, Button, Space, Typography, Row, Col, Card, Divider, message, Switch, Tooltip, Alert
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, InfoCircleOutlined, CalculatorOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import { brokerApi } from '../../services/api/broker.api';

const {Title, Text} = Typography;
const {Option} = Select;
const {TextArea} = Input;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface CreateInvoiceModalProps {
  visible: boolean;
  brokerId?: string;
  onOk: (invoiceData: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  visible,
  brokerId,
  onOk,
  onCancel,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [brokers, setBrokers] = useState<any[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }
  ]);
  const [calculateTax, setCalculateTax] = useState(true);
  const [taxRate, setTaxRate] = useState(15); // VAT rate in South Africa

  useEffect(() => {
    if (visible) {
      loadBrokers();
      if (brokerId) {
        form.setFieldsValue({ brokerId });
        handleBrokerChange(brokerId);
      }
    }
  }, [visible, brokerId]);

  const _loadBrokers = async () => {
    try {
      const response = await brokerApi.getBrokers({ limit: 1000 });
      setBrokers(response.data?.data || []);
    } catch (error) {
      message.error('Failed to load brokers');
    }
  };

  const handleBrokerChange = async (brokerIdValue: string) => {
    const broker = brokers.find(b => b.id === brokerIdValue);
    setSelectedBroker(broker);

    if (broker) {
      // Pre-fill with broker's tier-based pricing
      const baseFee = getTierBaseFee(broker.tier);

      setLineItems([
        {
          id: '1',
          description: `Monthly Subscription - ${broker.tier} Tier`,
          quantity: 1,
          unitPrice: baseFee,
          total: baseFee
        }
      ]);
    }
  };

  const _getTierBaseFee = (tier: string) => {
    const tierFees = {
      'STARTER': 299,
      'PROFESSIONAL': 599,
      'ENTERPRISE': 1299,
      'CUSTOM': 0
    };
    return tierFees[tier as keyof typeof tierFees] || 0;
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    });
    setLineItems(updatedItems);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTaxAmount = () => {
    return calculateTax ? (calculateSubtotal() * taxRate) / 100 : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const invoiceData = {
        ...values,
        lineItems,
        subtotal: calculateSubtotal(),
        taxAmount: calculateTaxAmount(),
        taxRate: calculateTax ? taxRate : 0,
        total: calculateTotal(),
        currency: selectedBroker?.currency || 'ZAR',
        billingPeriod: values.billingPeriod || format(new Date(), 'MMMM yyyy'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        invoiceDate: values.invoiceDate?.format('YYYY-MM-DD') || format(new Date(), 'YYYY-MM-DD')
      };

      onOk(invoiceData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title={
        <Title level={4} style={{ margin: 0 }}>
          Create Invoice
        </Title>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={
        <Space>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={loading}
            icon={<CalculatorOutlined />}
          >
            Create Invoice
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          invoiceDate: null,
          dueDate: null,
          billingPeriod: format(new Date(), 'MMMM yyyy'),
          status: 'DRAFT',
          notes: ''
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="brokerId"
              label="Broker"
              rules={[{ required: true, message: 'Please select a broker' }]}
            >
              <Select
                placeholder="Select broker"
                showSearch
                filterOption={(input, option) =>
                  option?.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
                onChange={handleBrokerChange}
              >
                {brokers.map(broker => (
                  <Option key={broker.id} value={broker.id}>
                    {broker.companyName} - {broker.tier} Tier
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="invoiceNumber"
              label="Invoice Number"
              rules={[{ required: true, message: 'Please enter invoice number' }]}
            >
              <Input placeholder="INV-001" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="invoiceDate"
              label="Invoice Date"
              rules={[{ required: true, message: 'Please select invoice date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[{ required: true, message: 'Please select due date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="billingPeriod"
              label="Billing Period"
            >
              <Input placeholder="e.g., January 2024" />
            </Form.Item>
          </Col>
        </Row>

        {selectedBroker && (
          <Alert
            message={`Selected: ${selectedBroker.companyName} (${selectedBroker.tier} Tier)`}
            description={`Currency: ${selectedBroker.currency || 'ZAR'} | Email: ${selectedBroker.billingEmail || selectedBroker.email}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider orientation="left">Invoice Items</Divider>

        <div className="line-items">
          {lineItems.map((item, index) => (
            <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Input
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                  />
                </Col>
                <Col span={4}>
                  <InputNumber
                    placeholder="Qty"
                    min={1}
                    value={item.quantity}
                    onChange={(value) => updateLineItem(item.id, 'quantity', value || 1)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={5}>
                  <InputNumber
                    placeholder="Unit price"
                    min={0}
                    precision={2}
                    value={item.unitPrice}
                    onChange={(value) => updateLineItem(item.id, 'unitPrice', value || 0)}
                    style={{ width: '100%' }}
                    prefix="R"
                  />
                </Col>
                <Col span={5}>
                  <InputNumber
                    value={item.total}
                    precision={2}
                    style={{ width: '100%' }}
                    prefix="R"
                    readOnly
                  />
                </Col>
                <Col span={2}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                  />
                </Col>
              </Row>
            </Card>
          ))}

          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addLineItem}
            style={{ width: '100%', marginBottom: 16 }}
          >
            Add Line Item
          </Button>
        </div>

        <Divider orientation="left">Tax & Settings</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Space>
              <Switch
                checked={calculateTax}
                onChange={setCalculateTax}
                checkedChildren="Include Tax"
                unCheckedChildren="No Tax"
              />
              {calculateTax && (
                <InputNumber
                  placeholder="Tax rate"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={setTaxRate}
                  formatter={value => `${value}%`}
                  parser={value => value!.replace('%', '')}
                  style={{ width: 100 }}
                />
              )}
            </Space>
          </Col>
          <Col span={12}>
            <Form.Item
              name="status"
              label="Invoice Status"
            >
              <Select>
                <Option value="DRAFT">Draft</Option>
                <Option value="PENDING">Pending</Option>
                <Option value="SENT">Sent</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="notes"
          label="Notes"
        >
          <TextArea
            rows={3}
            placeholder="Add any notes or payment instructions..."
          />
        </Form.Item>

        <Divider />

        <Card size="small">
          <Row gutter={16}>
            <Col span={8}>
              <Text strong>Subtotal:</Text>
            </Col>
            <Col span={16} style={{ textAlign: 'right' }}>
              <Text>R{calculateSubtotal().toFixed(2)}</Text>
            </Col>
          </Row>
          {calculateTax && (
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>Tax ({taxRate}%):</Text>
              </Col>
              <Col span={16} style={{ textAlign: 'right' }}>
                <Text>R{calculateTaxAmount().toFixed(2)}</Text>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={8}>
              <Title level={5} style={{ margin: 0 }}>Total:</Title>
            </Col>
            <Col span={16} style={{ textAlign: 'right' }}>
              <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                R{calculateTotal().toFixed(2)}
              </Title>
            </Col>
          </Row>
        </Card>
      </Form>
    </Modal>
  );
};

export default CreateInvoiceModal;
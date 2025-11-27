import React, { useState } from 'react';
import { Form, Select, Button, Radio, Space, Typography, Card, message } from 'antd';
import { CreditCardOutlined, WalletOutlined } from '@ant-design/icons';
import { crmApi, BrokerInvoice, PaymentInitiationData } from '../../services/api/crm.api';

const {Title} = Typography;
const {Option} = Select;

interface PaymentModalProps {
  invoice: BrokerInvoice;
  onSuccess?: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  invoice,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const paymentData: PaymentInitiationData = {
        invoiceId: invoice.id,
        provider: values.provider,
        returnUrl: window.location.origin + '/payment/success',
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          brokerId: invoice.brokerId,
        },
      };

      const response = await crmApi.initiatePayment(paymentData);

      if (response.data.paymentUrl) {
        window.open(response.data.paymentUrl, '_blank');
        message.success('Payment initiated successfully');
        onSuccess?.();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={4}>Initiate Payment for Invoice {invoice.invoiceNumber}</Title>

      <div className="mb-4 p-4 bg-gray-50 rounded">
        <div className="flex justify-between items-center">
          <span className="font-medium">Amount Due:</span>
          <span className="text-xl font-bold text-green-600">
            ${(Number(invoice.totalAmount) - Number(invoice.amountPaid)).toLocaleString()}
          </span>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ provider: 'PAYSTACK' }}
      >
        <Form.Item
          label="Payment Method"
          name="provider"
          rules={[{ required: true, message: 'Please select a payment method' }]}
        >
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="PAYSTACK">
                <div className="flex items-center space-x-2">
                  <CreditCardOutlined />
                  <span>Paystack (Card/Bank Transfer)</span>
                </div>
              </Radio>
              <Radio value="PAYFAST">
                <div className="flex items-center space-x-2">
                  <CreditCardOutlined />
                  <span>PayFast (South Africa)</span>
                </div>
              </Radio>
              <Radio value="WALLET">
                <div className="flex items-center space-x-2">
                  <WalletOutlined />
                  <span>Wallet _Balance</span>
                </div>
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            Proceed to Payment
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PaymentModal;
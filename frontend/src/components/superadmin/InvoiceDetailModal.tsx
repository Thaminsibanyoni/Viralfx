import React from 'react';
import { Modal, Descriptions, Tag, Button, Space, Typography, Divider } from 'antd';
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { Invoice } from '../../types/broker';

const {Title, Text} = Typography;

interface InvoiceDetailModalProps {
  visible: boolean;
  invoice: Invoice | null;
  onDownload: (invoice: Invoice) => void;
  onClose: () => void;
}

const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  visible,
  invoice,
  onDownload,
  onClose,
}) => {
  if (!invoice) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'green';
      case 'PENDING':
        return 'orange';
      case 'OVERDUE':
        return 'red';
      default:
        return 'default';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      title={
        <Title level={4} style={{ margin: 0 }}>
          Invoice Details
        </Title>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => onDownload(invoice)}
            type="primary"
          >
            Download PDF
          </Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            Print
          </Button>
          <Button onClick={onClose}>Close</Button>
        </Space>
      }
    >
      <div className="invoice-details">
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Descriptions title="Invoice Information" column={2}>
            <Descriptions.Item label="Invoice Number">
              <Text strong>{invoice.invoiceNumber}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(invoice.status)}>
                {invoice.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Invoice Date">
              {new Date(invoice.createdAt).toLocaleDateString()}
            </Descriptions.Item>
            <Descriptions.Item label="Due Date">
              {new Date(invoice.dueDate).toLocaleDateString()}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        {/* Broker Details */}
        <div style={{ marginBottom: 24 }}>
          <Descriptions title="Bill To" column={1}>
            <Descriptions.Item label="Company">
              <Text strong>{invoice.broker.companyName}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {invoice.billingEmail}
            </Descriptions.Item>
            {invoice.broker.address && (
              <Descriptions.Item label="Address">
                {invoice.broker.address}
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>

        <Divider />

        {/* Billing Period */}
        <div style={{ marginBottom: 24 }}>
          <Descriptions title="Billing Period" column={2}>
            <Descriptions.Item label="Period">
              {invoice.billingPeriod}
            </Descriptions.Item>
            <Descriptions.Item label="Currency">
              {invoice.currency}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        {/* Line Items */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>Invoice Items</Title>
          <div className="invoice-items">
            {invoice.baseFee > 0 && (
              <div className="invoice-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>Base Fee ({invoice.broker.tier} Tier)</span>
                <span>R{invoice.baseFee.toFixed(2)}</span>
              </div>
            )}
            {invoice.transactionFees > 0 && (
              <div className="invoice-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>Transaction Fees</span>
                <span>R{invoice.transactionFees.toFixed(2)}</span>
              </div>
            )}
            {invoice.additionalServices > 0 && (
              <div className="invoice-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>Additional Services</span>
                <span>R{invoice.additionalServices.toFixed(2)}</span>
              </div>
            )}
            {invoice.volumeDiscount > 0 && (
              <div className="invoice-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span>Volume Discount</span>
                <span style={{ color: '#52c41a' }}>-R{invoice.volumeDiscount.toFixed(2)}</span>
              </div>
            )}

            <Divider />

            <div className="invoice-subtotal" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 'bold' }}>
              <span>Subtotal</span>
              <span>R{invoice.subtotal.toFixed(2)}</span>
            </div>

            <div className="invoice-vat" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>VAT (15%)</span>
              <span>R{invoice.vatAmount.toFixed(2)}</span>
            </div>

            <div className="invoice-total" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: '16px', fontWeight: 'bold' }}>
              <span>Total</span>
              <span>R{invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Information */}
        {invoice.paidDate && (
          <>
            <Divider />
            <div style={{ marginBottom: 24 }}>
              <Descriptions title="Payment Information" column={2}>
                <Descriptions.Item label="Paid Date">
                  {new Date(invoice.paidDate).toLocaleDateString()}
                </Descriptions.Item>
                <Descriptions.Item label="Payment Method">
                  {invoice.paymentDetails?.method || 'N/A'}
                </Descriptions.Item>
                {invoice.paymentDetails?.transactionId && (
                  <Descriptions.Item label="Transaction ID">
                    {invoice.paymentDetails.transactionId}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </>
        )}

        {/* Notes */}
        {invoice.notes && (
          <>
            <Divider />
            <div>
              <Title level={5}>Notes</Title>
              <Text>{invoice.notes}</Text>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @media print {
          .ant-modal-footer {
            display: none !important;
          }
          .ant-modal-close {
            display: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default InvoiceDetailModal;
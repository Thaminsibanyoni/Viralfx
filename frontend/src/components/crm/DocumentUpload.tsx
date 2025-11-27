import React, { useState, useCallback } from 'react';
import {
  Upload, Button, Form, Select, Input, message, Progress, Space, Card, Typography, Alert, Row, Col, Tag, Tooltip, } from 'antd';
import {
  UploadOutlined, FileTextOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DeleteOutlined, EyeOutlined, } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd/es/upload/interface';
import { crmApi, FileUploadData } from '../../services/api/crm.api';

const {Title, Text} = Typography;
const {TextArea} = Input;
const {Option} = Select;

interface DocumentUploadProps {
  brokerId: string;
  onSuccess?: (document: any) => void;
  onError?: (error: Error) => void;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  brokerId,
  onSuccess,
  onError,
  maxFileSize = 10, // 10MB default
  acceptedFileTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  const documentTypes = [
    { value: 'KYC', label: 'KYC Document' },
    { value: 'FSCA_LICENSE', label: 'FSCA License' },
    { value: 'CERTIFICATE_OF_INCORPORATION', label: 'Certificate of Incorporation' },
    { value: 'TAX_CLEARANCE', label: 'Tax Clearance Certificate' },
    { value: 'BANK_DETAILS', label: 'Bank Details Confirmation' },
    { value: 'CONTRACT', label: 'Contract Agreement' },
    { value: 'IDENTITY_DOCUMENT', label: 'Identity Document' },
    { value: 'PROOF_OF_ADDRESS', label: 'Proof of Address' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Generate SHA256 hash for file integrity
  const generateFileHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Validate file before upload
  const beforeUpload = useCallback((file: File) => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      message.error(`File size must be less than ${maxFileSize}MB`);
      return false;
    }

    // Check file type
    if (!acceptedFileTypes.includes(file.type)) {
      message.error('Invalid file type. Please upload PDF, JPEG, PNG, or Word documents.');
      return false;
    }

    return false; // Prevent automatic upload
  }, [maxFileSize, acceptedFileTypes]);

  // Handle file selection
  const handleFileChange: UploadProps['onChange'] = ({ fileList: newFileList }) => {
    setFileList(newFileList.slice(-1)); // Keep only the latest file
  };

  // Generate pre-signed URL and upload file
  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      if (fileList.length === 0) {
        message.error('Please select a file to upload');
        return;
      }

      const file = fileList[0].originFileObj!;
      setUploading(true);
      setUploadProgress(0);

      // Generate file hash for integrity
      const fileHash = await generateFileHash(file);

      // Create upload data with metadata
      const uploadData: FileUploadData = {
        file,
        documentType: values.documentType,
        description: values.description,
        metadata: {
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          sha256Hash: fileHash,
          uploadTimestamp: new Date().toISOString(),
        },
      };

      // Upload to CRM API
      const response = await crmApi.uploadBrokerDocument(brokerId, uploadData);

      message.success('Document uploaded successfully');
      setUploadedDocs(prev => [response.data, ...prev]);
      setFileList([]);
      form.resetFields();
      setUploading(false);
      setUploadProgress(0);

      onSuccess?.(response.data);
    } catch (error: any) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.message || 'Failed to upload document');
      setUploading(false);
      setUploadProgress(0);
      onError?.(error);
    }
  };

  // Simulate upload progress (for demo purposes)
  React.useEffect(() => {
    if (uploading) {
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      return () => clearInterval(interval);
    }
  }, [uploading]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      KYC: 'blue',
      FSCA_LICENSE: 'green',
      CERTIFICATE_OF_INCORPORATION: 'purple',
      TAX_CLEARANCE: 'orange',
      BANK_DETAILS: 'cyan',
      CONTRACT: 'red',
      IDENTITY_DOCUMENT: 'geekblue',
      PROOF_OF_ADDRESS: 'magenta',
      OTHER: 'default',
    };
    return colors[type] || 'default';
  };

  return (
    <div className="space-y-4">
      <Card>
        <Title level={4}>Upload Document</Title>

        <Form
          form={form}
          layout="vertical"
          initialValues={{ documentType: 'KYC' }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Document Type"
                name="documentType"
                rules={[{ required: true, message: 'Please select document type' }]}
              >
                <Select placeholder="Select document type">
                  {documentTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Description"
                name="description"
              >
                <TextArea
                  placeholder="Enter document description (optional)"
                  rows={1}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Select File"
            required
          >
            <Upload
              beforeUpload={beforeUpload}
              onChange={handleFileChange}
              fileList={fileList}
              maxCount={1}
              accept={acceptedFileTypes.join(',')}
            >
              <Button icon={<UploadOutlined />}>
                Select File
              </Button>
            </Upload>

            {fileList.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileTextOutlined />
                    <span>{fileList[0].name}</span>
                    <Tag size="small">
                      {formatFileSize(fileList[0].size || 0)}
                    </Tag>
                  </div>
                </div>
              </div>
            )}

            <Alert
              message="File Requirements"
              description={`Maximum file size: ${maxFileSize}MB. Accepted formats: PDF, JPEG, PNG, Word documents.`}
              type="info"
              showIcon
              className="mt-2"
            />
          </Form.Item>

          {uploading && (
            <Form.Item>
              <Progress percent={uploadProgress} status="active" />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Recently Uploaded Documents */}
      {uploadedDocs.length > 0 && (
        <Card title="Recently Uploaded Documents">
          <div className="space-y-2">
            {uploadedDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <FileTextOutlined className="text-lg" />
                  <div>
                    <div className="font-medium">{doc.title}</div>
                    <div className="text-sm text-gray-500">
                      {doc.fileName} • {formatFileSize(doc.fileSize)}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <Tag color={getDocumentTypeColor(doc.documentType)}>
                        {doc.documentType.replace('_', ' ')}
                      </Tag>
                      <Tag color={doc.status === 'PENDING' ? 'orange' :
                                   doc.status === 'APPROVED' ? 'green' :
                                   doc.status === 'REJECTED' ? 'red' : 'default'}>
                        {doc.status}
                      </Tag>
                    </div>
                  </div>
                </div>
                <Space>
                  <Tooltip title="View Document">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                    />
                  </Tooltip>
                </Space>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default DocumentUpload;
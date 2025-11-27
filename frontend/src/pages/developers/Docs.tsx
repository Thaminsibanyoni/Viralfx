import React from 'react';
import { Card, Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';

const {Title, Paragraph} = Typography;

const Docs: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <BookOutlined /> API Documentation
      </Title>
      <Paragraph>
        Interactive API documentation will be embedded here using Swagger/Redoc UI.
      </Paragraph>
      <Card>
        <iframe
          src="/api/docs"
          style={{
            width: '100%',
            height: '800px',
            border: 'none',
            borderRadius: '8px',
          }}
          title="API Documentation"
        />
      </Card>
    </div>
  );
};

export default Docs;
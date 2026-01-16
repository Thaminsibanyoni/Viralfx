import React from 'react';
import { FloatButton, Tooltip } from 'antd';
import { WhatsAppOutlined } from '@ant-design/icons';

const WhatsAppButton: React.FC = () => {
  const handleClick = () => {
    window.open('https://wa.me/27813967368', '_blank');
  };

  return (
    <Tooltip title="Chat with us on WhatsApp" placement="left">
      <FloatButton
        icon={<WhatsAppOutlined />}
        type="primary"
        style={{
          right: 24,
          bottom: 24,
          backgroundColor: '#25D366',
          width: '56px',
          height: '56px',
        }}
        onClick={handleClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      />
    </Tooltip>
  );
};

export default WhatsAppButton;

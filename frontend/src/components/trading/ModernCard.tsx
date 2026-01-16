import React, { ReactNode } from 'react';
import { Card } from 'antd';
import styled from 'styled-components';

interface ModernCardProps {
  title?: string;
  extra?: ReactNode;
  children: ReactNode;
  gradient?: boolean;
  hoverable?: boolean;
  glow?: boolean;
  className?: string;
}

const StyledCard = styled(Card)<{ $gradient?: boolean; $glow?: boolean }>`
  background: linear-gradient(135deg, rgba(26, 26, 28, 0.95) 0%, rgba(20, 20, 22, 0.98) 100%);
  border: 1px solid rgba(255, 179, 0, 0.15);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 179, 0, 0.05);
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &:hover {
    border-color: rgba(255, 179, 0, 0.3);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 179, 0, 0.1);
    transform: translateY(-2px);
  }

  ${(props) =>
    props.$gradient &&
    `
    background: linear-gradient(135deg, rgba(75, 0, 130, 0.15) 0%, rgba(26, 26, 28, 0.95) 100%);
    border-color: rgba(139, 92, 246, 0.3);
  `}

  ${(props) =>
    props.$glow &&
    `
    box-shadow: 0 8px 32px rgba(255, 179, 0, 0.15), 0 0 24px rgba(255, 179, 0, 0.1);
    &:hover {
      box-shadow: 0 12px 48px rgba(255, 179, 0, 0.2), 0 0 32px rgba(255, 179, 0, 0.15);
    }
  `}

  .ant-card-head {
    background: transparent;
    border-bottom: 1px solid rgba(255, 179, 0, 0.1);
    padding: 20px 24px;

    .ant-card-head-title {
      color: #FFB300;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
  }

  .ant-card-body {
    padding: 24px;
  }
`;

const ModernCard: React.FC<ModernCardProps> = ({
  title,
  extra,
  children,
  gradient = false,
  hoverable = true,
  glow = false,
  className,
}) => {
  return (
    <StyledCard
      title={title}
      extra={extra}
      $gradient={gradient}
      $glow={glow}
      hoverable={hoverable}
      className={className}
    >
      {children}
    </StyledCard>
  );
};

export default ModernCard;

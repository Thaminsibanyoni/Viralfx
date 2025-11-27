import React, { useState } from 'react';
import {
  Card, List, Avatar, Tag, Button, Space, Tooltip, Typography, Badge, Progress, Dropdown, Menu, } from 'antd';
import {
  UserOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MoreOutlined, MessageOutlined, TeamOutlined, CalendarOutlined, } from '@ant-design/icons';
import { SupportTicket } from '../../services/api/crm.api';
import dayjs from 'dayjs';

const {Text, Title} = Typography;

interface TicketListProps {
  tickets: SupportTicket[];
  loading?: boolean;
  onTicketClick?: (ticket: SupportTicket) => void;
  onTicketAssign?: (ticket: SupportTicket) => void;
  onTicketClose?: (ticket: SupportTicket) => void;
}

const TicketList: React.FC<TicketListProps> = ({
  tickets,
  loading = false,
  onTicketClick,
  onTicketAssign,
  onTicketClose,
}) => {
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'red',
      IN_PROGRESS: 'blue',
      PENDING: 'orange',
      RESOLVED: 'green',
      CLOSED: 'default',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'green',
      NORMAL: 'blue',
      HIGH: 'orange',
      URGENT: 'red',
    };
    return colors[priority] || 'default';
  };

  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, React.ReactNode> = {
      LOW: '↓',
      NORMAL: '→',
      HIGH: '↑',
      URGENT: '⚡',
    };
    return icons[priority] || '→';
  };

  const getSlaStatus = (ticket: SupportTicket) => {
    if (!ticket.slaDeadline || ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
      return null;
    }

    const now = dayjs();
    const deadline = dayjs(ticket.slaDeadline);
    const hoursRemaining = deadline.diff(now, 'hour');

    if (hoursRemaining < 0) {
      return { status: 'breached', color: 'red', text: 'SLA Breached', icon: <ExclamationCircleOutlined /> };
    } else if (hoursRemaining < 2) {
      return { status: 'critical', color: 'orange', text: `${hoursRemaining}h left`, icon: <ClockCircleOutlined /> };
    } else if (hoursRemaining < 12) {
      return { status: 'warning', color: 'gold', text: `${hoursRemaining}h left`, icon: <ClockCircleOutlined /> };
    } else {
      return { status: 'normal', color: 'green', text: `${hoursRemaining}h left`, icon: <ClockCircleOutlined /> };
    }
  };

  const getMenuItems = (ticket: SupportTicket) => [
    {
      key: 'view',
      label: 'View Details',
      icon: <UserOutlined />,
      onClick: () => onTicketClick?.(ticket),
    },
    {
      key: 'assign',
      label: 'Assign Ticket',
      icon: <TeamOutlined />,
      onClick: () => onTicketAssign?.(ticket),
      disabled: ticket.status === 'CLOSED' || ticket.status === 'RESOLVED',
    },
    {
      key: 'close',
      label: 'Close Ticket',
      icon: <CheckCircleOutlined />,
      onClick: () => onTicketClose?.(ticket),
      disabled: ticket.status === 'CLOSED' || ticket.status === 'RESOLVED',
    },
  ];

  const handleTicketSelect = (ticketId: string, checked: boolean) => {
    if (checked) {
      setSelectedTickets(prev => [...prev, ticketId]);
    } else {
      setSelectedTickets(prev => prev.filter(id => id !== ticketId));
    }
  };

  return (
    <Card title="Support Tickets" loading={loading}>
      {selectedTickets.length > 0 && (
        <div className="mb-4 p-2 bg-blue-50 rounded flex items-center justify-between">
          <Text>
            {selectedTickets.length} ticket{selectedTickets.length !== 1 ? 's' : ''} selected
          </Text>
          <Space>
            <Button size="small">Assign All</Button>
            <Button size="small">Close All</Button>
            <Button size="small" type="link" onClick={() => setSelectedTickets([])}>
              Clear Selection
            </Button>
          </Space>
        </div>
      )}

      <List
        dataSource={tickets}
        renderItem={(ticket) => {
          const slaStatus = getSlaStatus(ticket);

          return (
            <List.Item
              key={ticket.id}
              className={`cursor-pointer hover:bg-gray-50 rounded-lg p-4 ${
                selectedTickets.includes(ticket.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
              onClick={() => {
                if (!selectedTickets.length) {
                  onTicketClick?.(ticket);
                }
              }}
              actions={[
                <input
                  type="checkbox"
                  checked={selectedTickets.includes(ticket.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleTicketSelect(ticket.id, e.target.checked);
                  }}
                />,
                <Dropdown
                  menu={{ items: getMenuItems(ticket) }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <div className="flex items-center space-x-2">
                    <Avatar size="small" icon={<MessageOutlined />} />
                    {ticket.assignee && (
                      <Avatar size="small" icon={<UserOutlined />} />
                    )}
                  </div>
                }
                title={
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Text strong className="text-lg">{ticket.title}</Text>
                      <div className="flex items-center space-x-2">
                        <Tag color={getPriorityColor(ticket.priority)}>
                          {getPriorityIcon(ticket.priority)} {ticket.priority}
                        </Tag>
                        <Tag color={getStatusColor(ticket.status)}>
                          {ticket.status}
                        </Tag>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {ticket.description}
                    </div>
                  </div>
                }
                description={
                  <div className="space-y-2">
                    {/* Client/Broker Information */}
                    <div className="flex items-center space-x-4 text-sm">
                      {ticket.broker && (
                        <div className="flex items-center space-x-1">
                          <TeamOutlined />
                          <Text>
                            {ticket.broker.broker?.companyName} (Broker)
                          </Text>
                        </div>
                      )}
                      {ticket.client && (
                        <div className="flex items-center space-x-1">
                          <UserOutlined />
                          <Text>
                            {ticket.client.user?.firstName} {ticket.client.user?.lastName}
                          </Text>
                        </div>
                      )}
                    </div>

                    {/* Category */}
                    <div className="flex items-center space-x-2">
                      <Text type="secondary" className="text-xs">
                        Category:
                      </Text>
                      <Tag size="small">{ticket.category}</Tag>
                    </div>

                    {/* Assignment */}
                    {ticket.assignee && (
                      <div className="flex items-center space-x-2">
                        <Text type="secondary" className="text-xs">
                          Assigned to:
                        </Text>
                        <div className="flex items-center space-x-1">
                          <Avatar size="small" icon={<UserOutlined />} />
                          <Text className="text-xs">
                            {ticket.assignee.firstName} {ticket.assignee.lastName}
                          </Text>
                        </div>
                      </div>
                    )}

                    {/* SLA Status */}
                    {slaStatus && (
                      <div className="flex items-center space-x-2">
                        <Badge
                          color={slaStatus.color}
                          text={slaStatus.text}
                          icon={slaStatus.icon}
                        />
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <CalendarOutlined />
                        <span>Created: {dayjs(ticket.createdAt).format('MMM DD, HH:mm')}</span>
                      </div>
                      {ticket.resolvedAt && (
                        <div className="flex items-center space-x-1">
                          <CheckCircleOutlined />
                          <span>Resolved: {dayjs(ticket.resolvedAt).format('MMM DD, HH:mm')}</span>
                        </div>
                      )}
                    </div>

                    {/* Message Count */}
                    {ticket.messages && ticket.messages.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <MessageOutlined />
                        <Text type="secondary" className="text-xs">
                          {ticket.messages.length} message{ticket.messages.length !== 1 ? 's' : ''}
                        </Text>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          );
        }}
        locale={{ emptyText: 'No tickets found' }}
      />
    </Card>
  );
};

export default TicketList;
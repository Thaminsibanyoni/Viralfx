import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  Card, Badge, Avatar, Tag, Button, Space, Tooltip, Typography, Empty, Progress, Dropdown, Menu, } from 'antd';
import {
  DollarOutlined, UserOutlined, CalendarOutlined, MoreOutlined, PlusOutlined, EyeOutlined, EditOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BrokerDeal, DealStage } from '../../services/api/crm.api';

const {Title, Text} = Typography;

interface PipelineKanbanProps {
  stages: DealStage[];
  deals: BrokerDeal[];
  onDealMove: (dealId: string, stageId: string) => void;
  onDealClick: (deal: BrokerDeal) => void;
  loading?: boolean;
  onEditDeal?: (deal: BrokerDeal) => void;
}

const PipelineKanban: React.FC<PipelineKanbanProps> = ({
  stages,
  deals,
  onDealMove,
  onDealClick,
  loading = false,
  onEditDeal,
}) => {
  const [draggingDeal, setDraggingDeal] = useState<string | null>(null);

  // Group deals by stage
  const dealsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = deals.filter(deal => deal.stageId === stage.id);
    return acc;
  }, {} as Record<string, BrokerDeal[]>);

  const _handleDragStart = (dealId: string) => {
    setDraggingDeal(dealId);
  };

  const handleDragEnd = (result: any) => {
    setDraggingDeal(null);

    if (!result.destination) return;

    const {draggableId, destination} = result;
    const sourceStageId = result.source.droppableId;
    const destinationStageId = destination.droppableId;

    if (sourceStageId === destinationStageId) return;

    onDealMove(draggableId, destinationStageId);
  };

  const getStageColor = (stageName: string) => {
    const colors: Record<string, string> = {
      'LEAD': '#f0f0f0',
      'QUALIFIED': '#e6f7ff',
      'PROPOSAL': '#fff7e6',
      'NEGOTIATION': '#f9f0ff',
      'CLOSED_WON': '#f6ffed',
      'CLOSED_LOST': '#fff1f0',
    };
    return colors[stageName] || '#f0f0f0';
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 75) return '#52c41a';
    if (probability >= 50) return '#fa8c16';
    if (probability >= 25) return '#1890ff';
    return '#d9d9d9';
  };

  const getDealMenu = (deal: BrokerDeal) => (
    <Menu>
      <Menu.Item
        key="view"
        icon={<EyeOutlined />}
        onClick={() => onDealClick(deal)}
      >
        View Details
      </Menu.Item>
      {onEditDeal && (
        <Menu.Item
          key="edit"
          icon={<EditOutlined />}
          onClick={() => onEditDeal(deal)}
        >
          Edit Deal
        </Menu.Item>
      )}
    </Menu>
  );

  const DealCard: React.FC<{ deal: BrokerDeal; index: number }> = ({ deal, index }) => (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-3 ${snapshot.isDragging ? 'opacity-75' : ''}`}
        >
          <Card
            size="small"
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onDealClick(deal)}
            style={{
              borderLeft: `4px solid ${getProbabilityColor(deal.probability)}`,
            }}
            actions={[
              <Dropdown overlay={getDealMenu(deal)} trigger={['click']}>
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            ]}
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <Title level={5} className="!mb-0 !leading-tight">
                  {deal.title}
                </Title>
                <Badge count={deal.probability} style={{ backgroundColor: getProbabilityColor(deal.probability) }} />
              </div>

              <div className="text-sm text-gray-500 line-clamp-2">
                {deal.description}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <DollarOutlined className="text-green-600" />
                  <Text strong>${Number(deal.value).toLocaleString()}</Text>
                </div>
                <Text type="secondary">{deal.currency}</Text>
              </div>

              <Progress
                percent={deal.probability}
                size="small"
                strokeColor={getProbabilityColor(deal.probability)}
                format={() => `${deal.probability}%`}
              />

              {deal.expectedCloseDate && (
                <div className="flex items-center space-x-1 text-sm">
                  <CalendarOutlined />
                  <Text type="secondary">
                    {dayjs(deal.expectedCloseDate).format('MMM DD, YYYY')}
                  </Text>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Avatar size="small" icon={<UserOutlined />} />
                <div className="flex-1 min-w-0">
                  <Text className="text-sm truncate" title={deal.broker?.broker?.companyName}>
                    {deal.broker?.broker?.companyName}
                  </Text>
                </div>
              </div>

              {deal.assignedTo && (
                <div className="flex items-center justify-between">
                  <Text type="secondary" className="text-xs">Assigned</Text>
                  <Tag size="small">
                    {deal.assignee?.firstName} {deal.assignee?.lastName}
                  </Tag>
                </div>
              )}

              {deal.tags && deal.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {deal.tags.slice(0, 2).map((tag) => (
                    <Tag key={tag} size="small">{tag}</Tag>
                  ))}
                  {deal.tags.length > 2 && (
                    <Tag size="small">+{deal.tags.length - 2}</Tag>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </Draggable>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div>Loading pipeline...</div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <Empty
        description="No pipeline stages configured"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex space-x-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
        {stages.map((stage) => {
          const stageDeals = dealsByStage[stage.id] || [];
          const stageTotalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.value), 0);
          const stageWeightedValue = stageDeals.reduce((sum, deal) => sum + (Number(deal.value) * deal.probability / 100), 0);

          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80"
              style={{
                backgroundColor: getStageColor(stage.name),
                borderRadius: '8px',
                padding: '12px',
                minHeight: '500px',
              }}
            >
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <Title level={5} className="!mb-0">
                    {stage.name}
                  </Title>
                  <Badge count={stageDeals.length} showZero />
                </div>
                <div className="text-sm text-gray-600">
                  {stage.description}
                </div>
                {stageDeals.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs">
                      <span className="text-gray-500">Total: </span>
                      <span className="font-medium">${stageTotalValue.toLocaleString()}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500">Weighted: </span>
                      <span className="font-medium">${stageWeightedValue.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-96 p-2 rounded transition-colors ${
                      snapshot.isDraggingOver ? 'bg-blue-50' : ''
                    } ${draggingDeal ? 'border-2 border-dashed border-blue-300' : ''}`}
                    style={{
                      backgroundColor: snapshot.isDraggingOver ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                    }}
                  >
                    {stageDeals.map((deal, index) => (
                      <DealCard key={deal.id} deal={deal} index={index} />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {stageDeals.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No deals in this stage"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};

export default PipelineKanban;
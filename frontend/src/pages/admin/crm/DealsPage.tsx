import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, Row, Col, Statistic, Form, Modal, message, Tooltip, Drawer, Descriptions, Progress, Switch, Avatar, } from 'antd';
import {
  DollarOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, PlusOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, UnorderedListOutlined, TableOutlined, ThunderboltOutlined, RiseOutlined, } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, BrokerDeal, DealFilters, DealStage } from '../../../services/api/crm.api';
import DealForm from '../../../components/crm/DealForm';
import DealDetail from '../../../components/crm/DealDetail';
import PipelineKanban from '../../../components/crm/PipelineKanban';

const {Title} = Typography;
const {Option} = Select;

interface DealsPageProps {}

const DealsPage: React.FC<DealsPageProps> = () => {
  const [filters, setFilters] = useState<DealFilters>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingDeal, setEditingDeal] = useState<BrokerDeal | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<BrokerDeal | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');

  const queryClient = useQueryClient();

  // Fetch deals
  const {data: dealsData, isLoading: dealsLoading, refetch: refetchDeals} = useQuery({
    queryKey: ['deals', filters],
    queryFn: () => crmApi.getDeals(filters),
    enabled: viewMode === 'table',
  });

  // Fetch kanban view
  const {data: kanbanData, isLoading: kanbanLoading, refetch: refetchKanban} = useQuery({
    queryKey: ['kanban', filters],
    queryFn: () => crmApi.getKanbanView(filters),
    enabled: viewMode === 'kanban',
  });

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (dealData: Partial<BrokerDeal>) => crmApi.createDeal(dealData),
    onSuccess: () => {
      message.success('Deal created successfully');
      setIsModalVisible(false);
      setEditingDeal(null);
      if (viewMode === 'table') {
        queryClient.invalidateQueries({ queryKey: ['deals'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['kanban'] });
      }
    },
    onError: () => {
      message.error('Failed to create deal');
    },
  });

  // Move deal mutation
  const moveDealMutation = useMutation({
    mutationFn: ({ id, stageId, notes }: { id: string; stageId: string; notes?: string }) =>
      crmApi.moveDeal(id, stageId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => {
      message.error('Failed to move deal');
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof DealFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({});
  };

  // Handle create deal
  const handleCreateDeal = () => {
    setEditingDeal(null);
    setIsModalVisible(true);
  };

  // Handle form submit
  const handleFormSubmit = (values: Partial<BrokerDeal>) => {
    createDealMutation.mutate(values);
  };

  // Handle view deal
  const handleViewDeal = (deal: BrokerDeal) => {
    setSelectedDeal(deal);
    setDrawerVisible(true);
  };

  // Handle drag end for kanban
  const _handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const {draggableId, destination} = result;
    const dealId = draggableId;
    const stageId = destination.droppableId;

    moveDealMutation.mutate({
      id: dealId,
      stageId,
      notes: `Moved to ${kanbanData?.data?.stages.find(s => s.id === stageId)?.name}`,
    });
  };

  // Table columns
  const columns: ColumnsType<BrokerDeal> = [
    {
      title: 'Deal Title',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Button
          type="link"
          onClick={() => handleViewDeal(record)}
        >
          {title}
        </Button>
      ),
    },
    {
      title: 'Broker',
      dataIndex: 'broker',
      key: 'broker',
      render: (broker) => (
        <div>
          <div className="font-medium">{broker?.broker?.companyName}</div>
          <div className="text-sm text-gray-500">{broker?.broker?.email}</div>
        </div>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage) => (
        <Tag color={getStageColor(stage?.name || '')}>
          {stage?.name}
        </Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value, record) => (
        <div>
          <div className="font-medium">${Number(value).toLocaleString()}</div>
          <div className="text-sm text-gray-500">{record.currency}</div>
        </div>
      ),
      sorter: true,
    },
    {
      title: 'Probability',
      dataIndex: 'probability',
      key: 'probability',
      render: (probability) => (
        <div className="w-32">
          <Progress
            percent={probability}
            size="small"
            format={(percent) => `${percent}%`}
          />
        </div>
      ),
      sorter: true,
    },
    {
      title: 'Expected Close',
      dataIndex: 'expectedCloseDate',
      key: 'expectedCloseDate',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : 'Not set',
      sorter: true,
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee) => assignee ? (
        <div className="flex items-center space-x-2">
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{assignee.firstName} {assignee.lastName}</span>
        </div>
      ) : (
        <span className="text-gray-500">Unassigned</span>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          {record.contactPerson && (
            <div className="font-medium">{record.contactPerson}</div>
          )}
          {record.contactEmail && (
            <div className="text-sm text-gray-500">{record.contactEmail}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDeal(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const _getStageColor = (stageName: string) => {
    const colors: Record<string, string> = {
      'LEAD': 'default',
      'QUALIFIED': 'blue',
      'PROPOSAL': 'orange',
      'NEGOTIATION': 'purple',
      'CLOSED_WON': 'green',
      'CLOSED_LOST': 'red',
    };
    return colors[stageName] || 'default';
  };

  // Calculate statistics
  const totalValue = dealsData?.data?.data?.reduce((sum, deal) => sum + Number(deal.value), 0) || 0;
  const weightedValue = dealsData?.data?.data?.reduce((sum, deal) => sum + (Number(deal.value) * deal.probability / 100), 0) || 0;
  const wonValue = dealsData?.data?.data?.filter(deal => deal.stage?.name === 'CLOSED_WON').reduce((sum, deal) => sum + Number(deal.value), 0) || 0;
  const activeDeals = dealsData?.data?.data?.filter(deal => !['CLOSED_WON', 'CLOSED_LOST'].includes(deal.stage?.name || '')).length || 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Sales Pipeline</Title>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Switch
              checkedChildren={<UnorderedListOutlined />}
              unCheckedChildren={<TableOutlined />}
              checked={viewMode === 'kanban'}
              onChange={(checked) => setViewMode(checked ? 'kanban' : 'table')}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateDeal}>
              Add Deal
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Active Deals"
                value={activeDeals}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Pipeline Value"
                value={totalValue}
                prefix={<DollarOutlined />}
                precision={0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Weighted Pipeline"
                value={weightedValue}
                prefix={<RiseOutlined />}
                precision={0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Won This Month"
                value={wonValue}
                prefix={<CheckCircleOutlined />}
                precision={0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="Search by deal title or broker"
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Stage"
                value={filters.stageId}
                onChange={(value) => handleFilterChange('stageId', value)}
                allowClear
                style={{ width: '100%' }}
              >
                {kanbanData?.data?.stages?.map((stage) => (
                  <Option key={stage.id} value={stage.id}>
                    {stage.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={4}>
              <Input
                placeholder="Min Value"
                type="number"
                value={filters.valueMin}
                onChange={(e) => handleFilterChange('valueMin', e.target.value ? Number(e.target.value) : undefined)}
                prefix="$"
              />
            </Col>
            <Col span={4}>
              <Input
                placeholder="Max Value"
                type="number"
                value={filters.valueMax}
                onChange={(e) => handleFilterChange('valueMax', e.target.value ? Number(e.target.value) : undefined)}
                prefix="$"
              />
            </Col>
            <Col span={6}>
              <Space>
                <Button icon={<FilterOutlined />} onClick={resetFilters}>
                  Reset
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => viewMode === 'table' ? refetchDeals() : refetchKanban()}
                >
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Deals View */}
      <Card>
        {viewMode === 'table' ? (
          <Table
            columns={columns}
            dataSource={dealsData?.data?.data}
            loading={dealsLoading}
            rowKey="id"
            pagination={{
              current: filters.page || 1,
              pageSize: filters.limit || 10,
              total: dealsData?.data?.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} deals`,
              onChange: (page, pageSize) => {
                setFilters(prev => ({ ...prev, page, limit: pageSize }));
              },
            }}
          />
        ) : (
          <PipelineKanban
            stages={kanbanData?.data?.stages || []}
            deals={kanbanData?.data?.deals || []}
            onDealMove={(dealId, stageId) => moveDealMutation.mutate({ id: dealId, stageId })}
            onDealClick={handleViewDeal}
            loading={kanbanLoading}
          />
        )}
      </Card>

      {/* Add/Edit Deal Modal */}
      <Modal
        title={editingDeal ? 'Edit Deal' : 'Add New Deal'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingDeal(null);
        }}
        footer={null}
        width={800}
      >
        <DealForm
          initialValues={editingDeal}
          onSubmit={handleFormSubmit}
          loading={createDealMutation.isPending}
          stages={kanbanData?.data?.stages || []}
        />
      </Modal>

      {/* Deal Details Drawer */}
      <Drawer
        title={selectedDeal?.title}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedDeal && (
          <DealDetail
            deal={selectedDeal}
            onUpdate={() => {
              if (viewMode === 'table') {
                queryClient.invalidateQueries({ queryKey: ['deals'] });
              } else {
                queryClient.invalidateQueries({ queryKey: ['kanban'] });
              }
            }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default DealsPage;
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, List, Button, Input, Select, Slider, Space, Tag, Typography, Statistic, Progress, Tooltip, message, Empty, Spin, Pagination, Badge, Avatar, Dropdown, MenuProps, Modal, } from 'antd';
import {
  SearchOutlined, FilterOutlined, RiseOutlined, FallOutlined, FireOutlined, StarOutlined, StarFilled, EyeOutlined, ReloadOutlined, HeartOutlined, HeartFilled, ShareAltOutlined, ExclamationCircleOutlined, TwitterOutlined, InstagramOutlined, VideoCameraOutlined, YoutubeFilled, MessageOutlined, LikeOutlined, DislikeOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsApi } from '../../services/api/topics.api';
import { useSocket } from '../../hooks/useSocket';
import TrendCard from '../../components/trends/TrendCard';
import type { Topic, TopicFilters, SocialPost, TopicStats } from '../../types/topic';

const {Title, Text, Paragraph} = Typography;
const {Option} = Select;
const {TextArea} = Input;

const TopicsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TopicFilters>({
    category: undefined,
    platform: undefined,
    region: 'SOUTH_AFRICA',
    sentiment: undefined,
    timeRange: '24H',
    minVirality: 0,
    maxVirality: 100,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedTopicForReport, setSelectedTopicForReport] = useState<Topic | null>(null);

  // Fetch topics
  const {data: topicsData, isLoading: topicsLoading, refetch: refetchTopics} = useQuery(
    ['topics', filters, currentPage, pageSize],
    () => topicsApi.getTopics(filters, currentPage, pageSize),
    {
      refetchInterval: 60000, // Refresh every minute
      keepPreviousData: true,
    }
  );

  // Fetch trending topics
  const {data: trendingTopics} = useQuery(
    'trendingTopics',
    () => topicsApi.getTrendingTopics(5),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch topic stats
  const {data: topicStats} = useQuery(
    'topicStats',
    () => topicsApi.getTopicStatsOverview(),
    {
      refetchInterval: 30000,
    }
  );

  // Report topic mutation
  const reportTopicMutation = useMutation(
    (data: { topicId: string; reason: string }) =>
      topicsApi.reportTopic(data.topicId, data.reason),
    {
      onSuccess: () => {
        message.success('Topic reported successfully');
        setReportModalVisible(false);
        setSelectedTopicForReport(null);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to report topic');
      },
    }
  );

  // WebSocket for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTopicUpdate = (data: { topicId: string; viralityScore: number; sentiment: string }) => {
      queryClient.setQueryData(['topics', filters, currentPage, pageSize], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((topic: Topic) =>
            topic.id === data.topicId
              ? { ...topic, viralityScore: data.viralityScore, sentiment: data.sentiment as any }
              : topic
          ),
        };
      });
    };

    const handleNewTopic = (topic: Topic) => {
      queryClient.invalidateQueries('trendingTopics');
      if (currentPage === 1) {
        queryClient.setQueryData(['topics', filters, currentPage, pageSize], (old: any) => {
          if (!old || !old.data) return old;
          return {
            ...old,
            data: [topic, ...old.data.slice(0, old.data.length - 1)],
          };
        });
      }
    };

    socket.on('topic_update', handleTopicUpdate);
    socket.on('new_topic', handleNewTopic);

    return () => {
      socket.off('topic_update', handleTopicUpdate);
      socket.off('new_topic', handleNewTopic);
    };
  }, [socket, filters, currentPage, pageSize, queryClient]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof TopicFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const toggleFavorite = (topicId: string) => {
    setFavorites(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    );
  };

  const handleReportTopic = (topic: Topic) => {
    setSelectedTopicForReport(topic);
    setReportModalVisible(true);
  };

  const handleQuickTrade = (topic: Topic) => {
    navigate(`/markets/trade?topic=${topic.id}`);
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return '#52C41A';
      case 'NEGATIVE': return '#FF4D4F';
      case 'NEUTRAL': return '#FFB300';
      case 'MIXED': return '#8C8C8C';
      default: return '#B8BCC8';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'TWITTER': return <TwitterOutlined style={{ color: '#1DA1F2' }} />;
      case 'INSTAGRAM': return <InstagramOutlined style={{ color: '#E4405F' }} />;
      case 'TIKTOK': return <VideoCameraOutlined style={{ color: '#000000' }} />;
      case 'YOUTUBE': return <YoutubeFilled style={{ color: '#FF0000' }} />;
      default: return <MessageOutlined />;
    }
  };

  const getTimeRangeText = (timeRange: string) => {
    switch (timeRange) {
      case '1H': return 'Last Hour';
      case '6H': return 'Last 6 Hours';
      case '24H': return 'Last 24 Hours';
      case '7D': return 'Last 7 Days';
      default: return 'All Time';
    }
  };

  const moreMenuItems: MenuProps['items'] = (topic: Topic) => [
    {
      key: 'share',
      label: 'Share Topic',
      icon: <ShareAltOutlined />,
      onClick: () => {
        const url = `${window.location.origin}/topics/${topic.id}`;
        navigator.clipboard.writeText(url);
        message.success('Link copied to clipboard');
      },
    },
    {
      key: 'report',
      label: 'Report Topic',
      icon: <ExclamationCircleOutlined />,
      onClick: () => handleReportTopic(topic),
    },
  ];

  const renderTopicItem = (topic: Topic) => (
    <List.Item
      key={topic.id}
      style={{
        padding: '20px',
        borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      onClick={() => navigate(`/topics/${topic.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(75, 0, 130, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      actions={[
        <Tooltip title="Add to favorites">
          <Button
            type="text"
            icon={favorites.includes(topic.id) ? <StarFilled style={{ color: '#FFB300' }} /> : <StarOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(topic.id);
            }}
          />
        </Tooltip>,
        <Tooltip title="Quick trade">
          <Button
            type="text"
            icon={<RiseOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleQuickTrade(topic);
            }}
            style={{ color: '#52C41A' }}
          />
        </Tooltip>,
        <Dropdown menu={{ items: moreMenuItems(topic) }} trigger={['click']}>
          <Button
            type="text"
            icon={<MessageOutlined />}
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Badge
            count={topic.viralityScore >= 80 ? <FireOutlined style={{ color: '#FF4D4F' }} /> : 0}
            offset={[-5, 5]}
          >
            <Avatar size={48} style={{ background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)' }}>
              {topic.title.charAt(0).toUpperCase()}
            </Avatar>
          </Badge>
        }
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
              {topic.title}
            </Text>
            <Tag color={getSentimentColor(topic.sentiment)}>
              {topic.sentiment}
            </Tag>
            <Tag color="blue">{topic.category}</Tag>
          </div>
        }
        description={
          <div>
            <Paragraph
              style={{ color: '#B8BCC8', marginBottom: '12px', lineHeight: '1.6' }}
              ellipsis={{ rows: 2 }}
            >
              {topic.description}
            </Paragraph>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Virality:</Text>
                <Progress
                  percent={topic.viralityScore}
                  size="small"
                  strokeColor={topic.viralityScore >= 70 ? '#52C41A' : topic.viralityScore >= 40 ? '#FFB300' : '#FF4D4F'}
                  style={{ width: '80px' }}
                  showInfo={false}
                />
                <Text style={{ color: '#FFB300', fontSize: '12px', fontWeight: 'bold' }}>
                  {topic.viralityScore}%
                </Text>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LikeOutlined style={{ color: '#52C41A', fontSize: '12px' }} />
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  {(topic.engagementMetrics.likes / 1000).toFixed(1)}K
                </Text>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MessageOutlined style={{ color: '#1890FF', fontSize: '12px' }} />
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  {(topic.engagementMetrics.comments / 1000).toFixed(1)}K
                </Text>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShareAltOutlined style={{ color: '#FFB300', fontSize: '12px' }} />
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  {(topic.engagementMetrics.shares / 1000).toFixed(1)}K
                </Text>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Platforms:</Text>
              {topic.platforms.map(platform => (
                <Tooltip key={platform} title={platform}>
                  {getPlatformIcon(platform)}
                </Tooltip>
              ))}
              <Divider type="vertical" style={{ borderColor: 'rgba(255, 179, 0, 0.2)' }} />
              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                {topic.region === 'SOUTH_AFRICA' ? '🇿🇦 South Africa' : topic.region}
              </Text>
              <Divider type="vertical" style={{ borderColor: 'rgba(255, 179, 0, 0.2)' }} />
              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                Velocity: {topic.velocity}/h
              </Text>
            </div>
          </div>
        }
      />
    </List.Item>
  );

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '32px' }}>
        <Col>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Trending Topics
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Discover viral trends and social media insights
          </Text>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Refresh topics">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchTopics()}
                loading={topicsLoading}
              />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Topic Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total Topics</Text>}
              value={topicsData?.total || 0}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#FFB300', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Trending Now</Text>}
              value={trendingTopics?.length || 0}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52C41A', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Positive Sentiment</Text>}
              value={topicStats?.positivePercentage || 0}
              suffix="%"
              valueStyle={{ color: '#52C41A', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total Mentions</Text>}
              value={topicStats?.totalMentions || 0}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#1890FF', fontSize: '24px' }}
              formatter={(value) => `${(Number(value) / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Filters Sidebar */}
        <Col xs={24} lg={6}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FilterOutlined />
                <Text style={{ color: '#FFB300' }}>Filters</Text>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
              height: 'fit-content',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Search Topics
                </Text>
                <Input.Search
                  placeholder="Search topics..."
                  onSearch={handleSearch}
                  style={{
                    background: '#0E0E10',
                    border: '1px solid rgba(255, 179, 0, 0.2)',
                  }}
                />
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Category
                </Text>
                <Select
                  value={filters.category}
                  onChange={(value) => handleFilterChange('category', value)}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="MUSIC">Music</Option>
                  <Option value="SPORTS">Sports</Option>
                  <Option value="TECH">Technology</Option>
                  <Option value="FASHION">Fashion</Option>
                  <Option value="FOOD">Food</Option>
                  <Option value="ENTERTAINMENT">Entertainment</Option>
                  <Option value="POLITICS">Politics</Option>
                  <Option value="LIFESTYLE">Lifestyle</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Platform
                </Text>
                <Select
                  value={filters.platform}
                  onChange={(value) => handleFilterChange('platform', value)}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="TWITTER">Twitter</Option>
                  <Option value="TIKTOK">TikTok</Option>
                  <Option value="INSTAGRAM">Instagram</Option>
                  <Option value="YOUTUBE">YouTube</Option>
                  <Option value="FACEBOOK">Facebook</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Region
                </Text>
                <Select
                  value={filters.region}
                  onChange={(value) => handleFilterChange('region', value)}
                  style={{ width: '100%' }}
                >
                  <Option value="SOUTH_AFRICA">South Africa</Option>
                  <Option value="GLOBAL">Global</Option>
                  <Option value="AFRICA">Africa</Option>
                  <Option value="EUROPE">Europe</Option>
                  <Option value="AMERICAS">Americas</Option>
                  <Option value="ASIA">Asia</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Sentiment
                </Text>
                <Select
                  value={filters.sentiment}
                  onChange={(value) => handleFilterChange('sentiment', value)}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="POSITIVE">Positive</Option>
                  <Option value="NEGATIVE">Negative</Option>
                  <Option value="NEUTRAL">Neutral</Option>
                  <Option value="MIXED">Mixed</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Time Range
                </Text>
                <Select
                  value={filters.timeRange}
                  onChange={(value) => handleFilterChange('timeRange', value)}
                  style={{ width: '100%' }}
                >
                  <Option value="1H">Last Hour</Option>
                  <Option value="6H">Last 6 Hours</Option>
                  <Option value="24H">Last 24 Hours</Option>
                  <Option value="7D">Last 7 Days</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Virality: {filters.minVirality}% - {filters.maxVirality}%
                </Text>
                <Slider
                  range
                  value={[filters.minVirality, filters.maxVirality]}
                  onChange={(value) => {
                    handleFilterChange('minVirality', value[0]);
                    handleFilterChange('maxVirality', value[1]);
                  }}
                  min={0}
                  max={100}
                  trackStyle={{ backgroundColor: '#FFB300' }}
                  handleStyle={{ borderColor: '#FFB300' }}
                />
              </div>
            </Space>
          </Card>

          {/* Hot Topics */}
          {trendingTopics && trendingTopics.length > 0 && (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FireOutlined style={{ color: '#FF4D4F' }} />
                  <Text style={{ color: '#FFB300' }}>🔥 Hot Topics</Text>
                </div>
              }
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                height: 'fit-content',
                marginTop: '24px',
              }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {trendingTopics.slice(0, 5).map((topic: Topic, index: number) => (
                  <div
                    key={topic.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => navigate(`/topics/${topic.id}`)}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: '#FFB300', fontWeight: 'bold', fontSize: '14px' }}>
                        {topic.title}
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <Tag size="small" color={getSentimentColor(topic.sentiment)}>
                          {topic.sentiment}
                        </Tag>
                        <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                          {topic.viralityScore}% virality
                        </Text>
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Col>

        {/* Topics Content */}
        <Col xs={24} lg={18}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>
                  Topics {filters.category && `- ${filters.category}`}
                  {filters.platform && ` on ${filters.platform}`}
                  {filters.region && ` in ${filters.region}`}
                  {` - ${getTimeRangeText(filters.timeRange!)}`}
                </Text>
                <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                  {topicsData?.total || 0} topics found
                </Text>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            {topicsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : topicsData?.data?.length === 0 ? (
              <Empty
                description={
                  <Text style={{ color: '#B8BCC8' }}>
                    No topics found matching your criteria
                  </Text>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <>
                <List
                  dataSource={topicsData?.data || []}
                  renderItem={renderTopicItem}
                  style={{ background: 'transparent' }}
                />
                {topicsData && topicsData.total > pageSize && (
                  <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <Pagination
                      current={currentPage}
                      total={topicsData.total}
                      pageSize={pageSize}
                      onChange={setCurrentPage}
                      showSizeChanger={false}
                      showQuickJumper
                      showTotal={(total, range) =>
                        `${range[0]}-${range[1]} of ${total} topics`
                      }
                    />
                  </div>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Report Topic Modal */}
      <Modal
        title="Report Topic"
        open={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setReportModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="report"
            type="primary"
            danger
            loading={reportTopicMutation.isLoading}
            onClick={() => {
              if (selectedTopicForReport) {
                reportTopicMutation.mutate({
                  topicId: selectedTopicForReport.id,
                  reason: 'Inappropriate content',
                });
              }
            }}
          >
            Report
          </Button>,
        ]}
      >
        {selectedTopicForReport && (
          <div>
            <Alert
              message="Topic Content"
              description={
                <div>
                  <Text strong style={{ color: '#FFB300' }}>{selectedTopicForReport.title}</Text>
                  <Paragraph style={{ color: '#B8BCC8', marginTop: '8px' }}>
                    {selectedTopicForReport.description}
                  </Paragraph>
                </div>
              }
              type="info"
              style={{ marginBottom: '16px' }}
            />
            <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
              Reason for reporting:
            </Text>
            <Select style={{ width: '100%' }} defaultValue="Inappropriate content">
              <Option value="spam">Spam</Option>
              <Option value="harassment">Harassment</Option>
              <Option value="inappropriate">Inappropriate Content</Option>
              <Option value="misinformation">Misinformation</Option>
              <Option value="other">Other</Option>
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TopicsPage;
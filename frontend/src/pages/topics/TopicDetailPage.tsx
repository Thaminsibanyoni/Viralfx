import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Statistic, Tag, Progress, Timeline, List, Avatar, Button, Space, Tooltip, Alert, Divider, Tabs, message, Spin, Empty, Badge, Rate, Select, } from 'antd';
import {
  ShareAltOutlined, HeartOutlined, HeartFilled, StarOutlined, StarFilled, RiseOutlined, FallOutlined, FireOutlined, MessageOutlined, LikeOutlined, EyeOutlined, TwitterOutlined, InstagramOutlined, VideoCameraOutlined, YoutubeFilled, LinkOutlined, WarningOutlined, BarChartOutlined, ClockCircleOutlined, UserOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { topicsApi } from '../../services/api/topics.api';
import { marketsApi } from '../../services/api/markets.api';
import { useSocket } from '../../hooks/useSocket';
import TrendChart from '../../components/trading/TrendChart';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Topic, TopicSentiment, SocialPost, RelatedTopic, TopicStats } from '../../types/topic';

dayjs.extend(relativeTime);

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;

const TopicDetailPage: React.FC = () => {
  const {topicId} = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24H');

  // Fetch topic details
  const {data: topic, isLoading: topicLoading, refetch: refetchTopic} = useQuery(
    ['topic', topicId],
    () => topicsApi.getTopic(topicId!),
    {
      enabled: !!topicId,
      refetchInterval: 30000,
    }
  );

  // Fetch topic sentiment
  const {data: sentiment} = useQuery(
    ['topicSentiment', topicId],
    () => topicsApi.getTopicSentiment(topicId!),
    {
      enabled: !!topicId,
      refetchInterval: 30000,
    }
  );

  // Fetch topic posts
  const {data: posts} = useQuery(
    ['topicPosts', topicId],
    () => topicsApi.getTopicPosts(topicId!),
    {
      enabled: !!topicId,
      refetchInterval: 60000,
    }
  );

  // Fetch related topics
  const {data: relatedTopics} = useQuery(
    ['relatedTopics', topicId],
    () => topicsApi.getRelatedTopics(topicId!),
    {
      enabled: !!topicId,
      refetchInterval: 120000,
    }
  );

  // Fetch topic statistics
  const {data: stats} = useQuery(
    ['topicStats', topicId],
    () => topicsApi.getTopicStats(topicId!),
    {
      enabled: !!topicId,
      refetchInterval: 30000,
    }
  );

  // WebSocket for real-time updates
  useEffect(() => {
    if (!socket || !topicId) return;

    const handleTopicUpdate = (data: any) => {
      if (data.topicId === topicId) {
        queryClient.setQueryData(['topic', topicId], (old: Topic) => ({ ...old, ...data }));
      }
    };

    const handleSentimentUpdate = (data: any) => {
      if (data.topicId === topicId) {
        queryClient.setQueryData(['topicSentiment', topicId], data.sentiment);
      }
    };

    socket.on('topic_update', handleTopicUpdate);
    socket.on('sentiment_update', handleSentimentUpdate);

    return () => {
      socket.off('topic_update', handleTopicUpdate);
      socket.off('sentiment_update', handleSentimentUpdate);
    };
  }, [socket, topicId, queryClient]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    message.success('Link copied to clipboard');
  };

  const handleFavorite = () => {
    setIsFavorite(!isFavorite);
    // API call to toggle favorite
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    // API call to like topic
  };

  const handleTrade = () => {
    navigate(`/markets/trade?topic=${topicId}`);
  };

  const getSentimentColor = (value: number) => {
    if (value >= 70) return '#52C41A';
    if (value >= 40) return '#FFB300';
    return '#FF4D4F';
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

  const getRegionFlag = (region: string) => {
    switch (region) {
      case 'SOUTH_AFRICA': return '🇿🇦';
      case 'GLOBAL': return '🌍';
      case 'AFRICA': return '🌍';
      case 'EUROPE': return '🇪🇺';
      case 'AMERICAS': return '🌎';
      case 'ASIA': return '🌏';
      default: return '🌍';
    }
  };

  if (topicLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#0E0E10', minHeight: '100vh' }}>
        <Spin size="large" />
        <Text style={{ color: '#B8BCC8', display: 'block', marginTop: '16px' }}>
          Loading topic details...
        </Text>
      </div>
    );
  }

  if (!topic) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#0E0E10', minHeight: '100vh' }}>
        <Empty
          description="Topic not found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Topic Header */}
      <div style={{ marginBottom: '32px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Button
              type="text"
              onClick={() => navigate('/topics')}
              style={{ color: '#B8BCC8', marginBottom: '16px' }}
            >
              ← Back to Topics
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <Title level={1} style={{ color: '#FFB300', margin: 0 }}>
                {topic.title}
              </Title>
              <Badge
                count={topic.viralityScore >= 80 ? <FireOutlined style={{ color: '#FF4D4F' }} /> : 0}
                offset={[10, 0]}
              >
                <Avatar size={48} style={{ background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)' }}>
                  {topic.title.charAt(0).toUpperCase()}
                </Avatar>
              </Badge>
            </div>
            <Space size="large" wrap>
              <Tag color="blue">{topic.category}</Tag>
              <Tag color={getSentimentColor(sentiment?.positive || 0)}>
                {topic.sentiment}
              </Tag>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {getRegionFlag(topic.region)}
                <Text style={{ color: '#B8BCC8' }}>{topic.region}</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {topic.platforms.map(platform => (
                  <Tooltip key={platform} title={platform}>
                    {getPlatformIcon(platform)}
                  </Tooltip>
                ))}
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                <Button
                  type="text"
                  icon={isFavorite ? <StarFilled style={{ color: '#FFB300' }} /> : <StarOutlined />}
                  onClick={handleFavorite}
                />
              </Tooltip>
              <Tooltip title={isLiked ? 'Unlike' : 'Like'}>
                <Button
                  type="text"
                  icon={isLiked ? <HeartFilled style={{ color: '#FF4D4F' }} /> : <HeartOutlined />}
                  onClick={handleLike}
                />
              </Tooltip>
              <Tooltip title="Share">
                <Button type="text" icon={<ShareAltOutlined />} onClick={handleShare} />
              </Tooltip>
              <Button
                type="primary"
                icon={<RiseOutlined />}
                onClick={handleTrade}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                }}
              >
                Trade Now
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Topic Statistics */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Virality Score</Text>}
              value={topic.viralityScore}
              suffix="%"
              prefix={<FireOutlined />}
              valueStyle={{
                color: topic.viralityScore >= 70 ? '#52C41A' : topic.viralityScore >= 40 ? '#FFB300' : '#FF4D4F',
                fontSize: '28px'
              }}
            />
            <Progress
              percent={topic.viralityScore}
              strokeColor={getSentimentColor(topic.viralityScore)}
              showInfo={false}
              style={{ marginTop: '8px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total Mentions</Text>}
              value={stats?.totalMentions || 0}
              prefix={<MessageOutlined />}
              valueStyle={{ color: '#1890FF', fontSize: '28px' }}
              formatter={(value) => `${(Number(value) / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Engagement Rate</Text>}
              value={stats?.engagementRate || 0}
              suffix="%"
              prefix={<HeartOutlined />}
              valueStyle={{ color: '#FFB300', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Velocity</Text>}
              value={topic.velocity}
              suffix="/hour"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52C41A', fontSize: '28px' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Main Content */}
        <Col xs={24} lg={16}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{
              '.ant-tabs-tab': { color: '#B8BCC8' },
              '.ant-tabs-tab-active': { color: '#FFB300' },
            }}
          >
            <TabPane tab="Overview" key="overview">
              <Card
                title={<Text style={{ color: '#FFB300' }}>Topic Overview</Text>}
                style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Title level={4} style={{ color: '#FFB300', marginBottom: '12px' }}>
                      Description
                    </Title>
                    <Paragraph style={{ color: '#B8BCC8', fontSize: '16px', lineHeight: '1.8' }}>
                      {topic.description}
                    </Paragraph>
                  </div>

                  <div>
                    <Title level={4} style={{ color: '#FFB300', marginBottom: '12px' }}>
                      Engagement Metrics
                    </Title>
                    <Row gutter={[16, 16]}>
                      <Col xs={12} sm={6}>
                        <div style={{ textAlign: 'center' }}>
                          <LikeOutlined style={{ fontSize: '24px', color: '#52C41A', marginBottom: '8px' }} />
                          <div style={{ fontSize: '20px', color: '#FFB300', fontWeight: 'bold' }}>
                            {(topic.engagementMetrics.likes / 1000000).toFixed(1)}M
                          </div>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Likes</Text>
                        </div>
                      </Col>
                      <Col xs={12} sm={6}>
                        <div style={{ textAlign: 'center' }}>
                          <MessageOutlined style={{ fontSize: '24px', color: '#1890FF', marginBottom: '8px' }} />
                          <div style={{ fontSize: '20px', color: '#FFB300', fontWeight: 'bold' }}>
                            {(topic.engagementMetrics.comments / 1000000).toFixed(1)}M
                          </div>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Comments</Text>
                        </div>
                      </Col>
                      <Col xs={12} sm={6}>
                        <div style={{ textAlign: 'center' }}>
                          <ShareAltOutlined style={{ fontSize: '24px', color: '#FFB300', marginBottom: '8px' }} />
                          <div style={{ fontSize: '20px', color: '#FFB300', fontWeight: 'bold' }}>
                            {(topic.engagementMetrics.shares / 1000000).toFixed(1)}M
                          </div>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Shares</Text>
                        </div>
                      </Col>
                      <Col xs={12} sm={6}>
                        <div style={{ textAlign: 'center' }}>
                          <EyeOutlined style={{ fontSize: '24px', color: '#8C8C8C', marginBottom: '8px' }} />
                          <div style={{ fontSize: '20px', color: '#FFB300', fontWeight: 'bold' }}>
                            {(topic.engagementMetrics.views / 1000000).toFixed(1)}M
                          </div>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Views</Text>
                        </div>
                      </Col>
                    </Row>
                  </div>

                  <div>
                    <Title level={4} style={{ color: '#FFB300', marginBottom: '12px' }}>
                      Key Statistics
                    </Title>
                    <Row gutter={[16, 16]}>
                      <Col xs={12}>
                        <div style={{ padding: '16px', background: 'rgba(255, 179, 0, 0.1)', borderRadius: '8px' }}>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Peak Virality</Text>
                          <div style={{ fontSize: '18px', color: '#FFB300', fontWeight: 'bold', marginTop: '4px' }}>
                            {stats?.peakVirality || 0}%
                          </div>
                        </div>
                      </Col>
                      <Col xs={12}>
                        <div style={{ padding: '16px', background: 'rgba(255, 179, 0, 0.1)', borderRadius: '8px' }}>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Reach</Text>
                          <div style={{ fontSize: '18px', color: '#FFB300', fontWeight: 'bold', marginTop: '4px' }}>
                            {stats?.reach ? (stats.reach / 1000000).toFixed(1) : 0}M
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Space>
              </Card>
            </TabPane>

            <TabPane tab="Virality Timeline" key="timeline">
              <Card
                title={<Text style={{ color: '#FFB300' }}>Virality Timeline</Text>}
                extra={
                  <Select value={selectedTimeframe} onChange={setSelectedTimeframe} style={{ width: 120 }}>
                    <Option value="1H">1 Hour</Option>
                    <Option value="6H">6 Hours</Option>
                    <Option value="24H">24 Hours</Option>
                    <Option value="7D">7 Days</Option>
                  </Select>
                }
                style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
              >
                <TrendChart
                  data={sentiment?.timeline || []}
                  height={400}
                  color="#FFB300"
                />
              </Card>
            </TabPane>

            <TabPane tab="Sentiment Analysis" key="sentiment">
              <Card
                title={<Text style={{ color: '#FFB300' }}>Sentiment Analysis</Text>}
                style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
              >
                <Row gutter={[24, 24]}>
                  <Col xs={24} md={12}>
                    <div style={{ marginBottom: '24px' }}>
                      <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '16px' }}>
                        Overall Sentiment Distribution
                      </Text>
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text style={{ color: '#52C41A' }}>Positive</Text>
                            <Text style={{ color: '#52C41A' }}>{sentiment?.positive || 0}%</Text>
                          </div>
                          <Progress percent={sentiment?.positive || 0} strokeColor="#52C41A" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text style={{ color: '#FFB300' }}>Neutral</Text>
                            <Text style={{ color: '#FFB300' }}>{sentiment?.neutral || 0}%</Text>
                          </div>
                          <Progress percent={sentiment?.neutral || 0} strokeColor="#FFB300" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text style={{ color: '#FF4D4F' }}>Negative</Text>
                            <Text style={{ color: '#FF4D4F' }}>{sentiment?.negative || 0}%</Text>
                          </div>
                          <Progress percent={sentiment?.negative || 0} strokeColor="#FF4D4F" />
                        </div>
                      </Space>
                    </div>
                  </Col>

                  <Col xs={24} md={12}>
                    <div>
                      <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '16px' }}>
                        Word Cloud
                      </Text>
                      <div
                        style={{
                          background: 'rgba(255, 179, 0, 0.05)',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          borderRadius: '8px',
                          padding: '20px',
                          minHeight: '200px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#8C8C8C' }}>Word cloud visualization coming soon</Text>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </TabPane>

            <TabPane tab="Social Media Posts" key="posts">
              <Card
                title={<Text style={{ color: '#FFB300' }}>Sample Social Media Posts</Text>}
                style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
              >
                {posts && posts.length > 0 ? (
                  <List
                    dataSource={posts}
                    renderItem={(post: SocialPost) => (
                      <List.Item
                        style={{
                          borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
                          padding: '16px 0',
                        }}
                      >
                        <List.Item.Meta
                          avatar={
                            <div style={{ textAlign: 'center' }}>
                              <Avatar src={post.author.avatarUrl} icon={<UserOutlined />} />
                              <div style={{ marginTop: '4px' }}>
                                {getPlatformIcon(post.platform)}
                              </div>
                            </div>
                          }
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>
                                  {post.author.name}
                                </Text>
                                {post.author.verified && (
                                  <Badge
                                    count="✓"
                                    style={{ backgroundColor: '#52C41A', marginLeft: '8px' }}
                                  />
                                )}
                                <Text style={{ color: '#8C8C8C', marginLeft: '8px' }}>
                                  @{post.author.username}
                                </Text>
                              </div>
                              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                                {dayjs(post.publishedAt).fromNow()}
                              </Text>
                            </div>
                          }
                          description={
                            <div>
                              <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '12px' }}>
                                {post.content}
                              </Text>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                <span style={{ color: '#8C8C8C', fontSize: '12px' }}>
                                  <LikeOutlined /> {post.engagement.likes.toLocaleString()}
                                </span>
                                <span style={{ color: '#8C8C8C', fontSize: '12px' }}>
                                  <MessageOutlined /> {post.engagement.comments.toLocaleString()}
                                </span>
                                <span style={{ color: '#8C8C8C', fontSize: '12px' }}>
                                  <ShareAltOutlined /> {post.engagement.shares.toLocaleString()}
                                </span>
                                {post.url && (
                                  <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#FFB300', fontSize: '12px' }}
                                  >
                                    View Post <LinkOutlined />
                                  </a>
                                )}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="No social media posts available" />
                )}
              </Card>
            </TabPane>
          </Tabs>
        </Col>

        {/* Sidebar */}
        <Col xs={24} lg={8}>
          {/* Trading Panel */}
          <Card
            title={<Text style={{ color: '#FFB300' }}>Quick Trade</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
              marginBottom: '24px',
            }}
          >
            <Alert
              message="Trading Opportunity"
              description={`Based on current virality score of ${topic.viralityScore}%, this topic shows ${topic.viralityScore >= 70 ? 'high' : 'moderate'} trading potential.`}
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ padding: '12px', background: 'rgba(255, 179, 0, 0.1)', borderRadius: '8px' }}>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Market Sentiment</Text>
                <div style={{ marginTop: '8px' }}>
                  <Rate disabled value={(sentiment?.positive || 0) / 20} />
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                block
                onClick={handleTrade}
                icon={<RiseOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  height: '48px',
                }}
              >
                Trade This Trend
              </Button>
              <Button block onClick={() => navigate('/markets')}>
                Browse Related Markets
              </Button>
            </Space>
          </Card>

          {/* Related Topics */}
          {relatedTopics && relatedTopics.length > 0 && (
            <Card
              title={<Text style={{ color: '#FFB300' }}>Related Topics</Text>}
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
            >
              <List
                dataSource={relatedTopics}
                renderItem={(relatedTopic: RelatedTopic) => (
                  <List.Item
                    style={{
                      borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
                      padding: '12px 0',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/topics/${relatedTopic.id}`)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size={32}
                          style={{ background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)' }}
                        >
                          {relatedTopic.title.charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={
                        <Text style={{ color: '#FFB300', fontSize: '14px' }}>
                          {relatedTopic.title}
                        </Text>
                      }
                      description={
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <Tag size="small" color="blue">
                              {relatedTopic.category}
                            </Tag>
                            <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                              {relatedTopic.viralityScore}% virality
                            </Text>
                          </div>
                          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                            {relatedTopic.similarity}% match
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* Platform Breakdown */}
          {stats?.platformBreakdown && (
            <Card
              title={<Text style={{ color: '#FFB300' }}>Platform Breakdown</Text>}
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                marginTop: '24px',
              }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {Object.entries(stats.platformBreakdown).map(([platform, percentage]) => (
                  <div key={platform}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getPlatformIcon(platform)}
                        <Text style={{ color: '#B8BCC8' }}>{platform}</Text>
                      </div>
                      <Text style={{ color: '#FFB300' }}>{percentage}%</Text>
                    </div>
                    <Progress percent={percentage} showInfo={false} />
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Col>
      </Row>

      {/* Risk Warning */}
      <Alert
        message={
          <span>
            <WarningOutlined style={{ marginRight: '8px' }} />
            Risk Warning
          </span>
        }
        description="Trading based on viral trends involves significant risk. Virality can change rapidly and past performance is not indicative of future results. Always do your own research before making investment decisions."
        type="warning"
        showIcon
        style={{ marginTop: '32px' }}
      />
    </div>
  );
};

export default TopicDetailPage;
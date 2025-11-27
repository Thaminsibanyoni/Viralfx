import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Input, Button, List, Avatar, Typography, Space, Badge, Dropdown, MenuProps, Modal, Form, Select, message, Tooltip, Upload, Popover, Divider, Card, Empty, Spin, Alert, } from 'antd';
import {
  SendOutlined, PaperClipOutlined, SmileOutlined, PhoneOutlined, VideoCameraOutlined, InfoOutlined, MoreOutlined, SearchOutlined, FilterOutlined, UserOutlined, CustomerServiceOutlined, TeamOutlined, ExclamationCircleOutlined, DeleteOutlined, BlockOutlined, ReportOutlined, CheckCircleOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../hooks/useSocket';
import { chatApi } from '../../services/api/chat.api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/en';
import EmojiPicker from 'emoji-picker-react';

dayjs.extend(relativeTime);

const {Sider, Content} = Layout;
const {Title, Text} = Typography;
const {TextArea} = Input;
const {Option} = Select;

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
    role: 'user' | 'admin' | 'moderator' | 'support';
    isOnline: boolean;
  };
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachments?: Array<{
    id: string;
    type: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
    filename: string;
    url: string;
    size: number;
  }>;
  readBy: string[];
  reactions: Array<{
    userId: string;
    emoji: string;
  }>;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface Conversation {
  id: string;
  type: 'DIRECT' | 'BROKER' | 'SUPPORT' | 'COMMUNITY';
  name?: string;
  participants: Array<{
    id: string;
    username: string;
    avatar?: string;
    role: 'user' | 'admin' | 'moderator' | 'support';
    isOnline: boolean;
    lastSeen?: string;
  }>;
  lastMessage?: Message;
  unreadCount: number;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  isMuted?: boolean;
  isPinned?: boolean;
}

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

const ChatPage: React.FC = () => {
  const {conversationId} = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(conversationId || null);
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'DIRECT' | 'BROKER' | 'SUPPORT' | 'COMMUNITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessages, setSelectedMessages] = useState<string[]>([]);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedMessageForReport, setSelectedMessageForReport] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch conversations
  const {data: conversations, isLoading: conversationsLoading} = useQuery(
    ['conversations', filter],
    () => chatApi.getConversations({ type: filter === 'ALL' ? undefined : filter }),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch messages for selected conversation
  const {data: messagesData, isLoading: messagesLoading} = useQuery(
    ['messages', selectedConversation],
    () => selectedConversation ? chatApi.getMessages(selectedConversation) : null,
    {
      enabled: !!selectedConversation,
      refetchInterval: 15000,
    }
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    (messageData: { conversationId: string; content: string; attachments?: File[] }) =>
      chatApi.sendMessage(messageData),
    {
      onSuccess: () => {
        setMessage('');
        queryClient.invalidateQueries(['messages', selectedConversation]);
        queryClient.invalidateQueries('conversations');
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to send message');
      },
    }
  );

  // Report message mutation
  const reportMessageMutation = useMutation(
    (data: { messageId: string; reason: string }) =>
      chatApi.reportMessage(data.messageId, data.reason),
    {
      onSuccess: () => {
        message.success('Message reported successfully');
        setReportModalVisible(false);
        setSelectedMessageForReport(null);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to report message');
      },
    }
  );

  // WebSocket handlers
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: Message) => {
      if (newMessage.conversationId === selectedConversation) {
        queryClient.setQueryData(['messages', selectedConversation], (old: any) => {
          if (!old) return { messages: [newMessage], hasMore: true, total: 1, page: 1 };
          return { ...old, messages: [...old.messages, newMessage], total: old.total + 1 };
        });
      }
      queryClient.invalidateQueries('conversations');
    };

    const handleTyping = (data: { conversationId: string; user: TypingUser }) => {
      if (data.conversationId === selectedConversation) {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.user.userId);
          return [...filtered, data.user];
        });
      }
    };

    const handleStopTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === selectedConversation) {
        setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
      }
    };

    const handleMessageRead = (data: { conversationId: string; messageId: string; userId: string }) => {
      if (data.conversationId === selectedConversation) {
        queryClient.setQueryData(['messages', selectedConversation], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((msg: Message) =>
              msg.id === data.messageId ? { ...msg, readBy: [...msg.readBy, data.userId] } : msg
            )
          };
        });
      }
    };

    const handleUserOnline = (data: { userId: string; isOnline: boolean }) => {
      queryClient.setQueryData(['conversations', filter], (old: Conversation[] = []) =>
        old.map(conv => ({
          ...conv,
          participants: conv.participants.map(p => p.id === data.userId ? { ...p, isOnline: data.isOnline } : p)
        }))
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('message_read', handleMessageRead);
    socket.on('user_online', handleUserOnline);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('stop_typing', handleStopTyping);
      socket.off('message_read', handleMessageRead);
      socket.off('user_online', handleUserOnline);
    };
  }, [socket, selectedConversation, queryClient, filter]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData, typingUsers]);

  // Update URL when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      navigate(`/chat/${selectedConversation}`, { replace: true });
    } else {
      navigate('/chat', { replace: true });
    }
  }, [selectedConversation, navigate]);

  // Handle typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping && socket && selectedConversation) {
      setIsTyping(true);
      socket.emit('typing', { conversationId: selectedConversation });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        handleTypingStop();
      }, 3000);
    }
  }, [isTyping, socket, selectedConversation]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && socket && selectedConversation) {
      setIsTyping(false);
      socket.emit('stop_typing', { conversationId: selectedConversation });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [isTyping, socket, selectedConversation]);

  const handleSendMessage = () => {
    if (!message.trim() || !selectedConversation) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: message.trim(),
    });

    handleTypingStop();
  };

  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = (file: File) => {
    if (!selectedConversation) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation,
      content: '',
      attachments: [file],
    });

    return false; // Prevent default upload behavior
  };

  const _handleReportMessage = (msg: Message) => {
    setSelectedMessageForReport(msg);
    setReportModalVisible(true);
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'DIRECT': return <UserOutlined />;
      case 'BROKER': return <CustomerServiceOutlined />;
      case 'SUPPORT': return <CustomerServiceOutlined />;
      case 'COMMUNITY': return <TeamOutlined />;
      default: return <MessageOutlined />;
    }
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;

    const otherParticipants = conversation.participants.filter(p => p.id !== socket?.userId);
    if (otherParticipants.length === 1) {
      return otherParticipants[0].username;
    }

    return otherParticipants.map(p => p.username).join(', ');
  };

  const formatTypingIndicator = () => {
    if (typingUsers.length === 0) return null;

    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} is typing...`;
    }

    if (typingUsers.length === 2) {
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    }

    return `${typingUsers.length} people are typing...`;
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'mark-read',
      label: 'Mark as Read',
      icon: <CheckCircleOutlined />,
      onClick: () => {
        if (selectedConversation && socket) {
          socket.emit('mark_as_read', { conversationId: selectedConversation });
        }
      },
    },
    {
      key: 'mute',
      label: 'Mute Notifications',
      icon: <ClockCircleOutlined />,
      onClick: () => message.info('Mute functionality coming soon'),
    },
    {
      type: 'divider',
    },
    {
      key: 'delete-conversation',
      label: 'Delete Conversation',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: 'Delete Conversation',
          content: 'Are you sure you want to delete this conversation? This action cannot be undone.',
          onOk: () => message.info('Delete functionality coming soon'),
        });
      },
    },
  ];

  return (
    <Layout style={{ height: 'calc(100vh - 72px)', background: '#0E0E10' }}>
      <Sider
        width={300}
        style={{
          background: '#1A1A1C',
          borderRight: '1px solid rgba(255, 179, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Chat Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 179, 0, 0.2)' }}>
          <Title level={4} style={{ color: '#FFB300', margin: 0 }}>
            Messages
          </Title>
          <div style={{ marginTop: '12px' }}>
            <Input
              placeholder="Search conversations..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: '#0E0E10', border: '1px solid rgba(255, 179, 0, 0.2)' }}
            />
          </div>
          <div style={{ marginTop: '12px' }}>
            <Select
              value={filter}
              onChange={setFilter}
              style={{ width: '100%' }}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="ALL">All Conversations</Option>
              <Option value="UNREAD">Unread</Option>
              <Option value="DIRECT">Direct Messages</Option>
              <Option value="BROKER">Broker Support</Option>
              <Option value="SUPPORT">Platform Support</Option>
              <Option value="COMMUNITY">Community Rooms</Option>
            </Select>
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {conversationsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin />
            </div>
          ) : (
            <List
              dataSource={conversations?.filter(c =>
                searchQuery === '' ||
                getConversationName(c).toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={(conversation: Conversation) => (
                <List.Item
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: selectedConversation === conversation.id ? 'rgba(75, 0, 130, 0.2)' : 'transparent',
                    border: selectedConversation === conversation.id ? '1px solid rgba(255, 179, 0, 0.3)' : 'none',
                    marginBottom: '4px',
                  }}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge dot={conversation.isOnline} color="#52C41A">
                        <Avatar
                          size={40}
                          src={conversation.participants[0]?.avatar}
                          icon={getConversationIcon(conversation.type)}
                          style={{ background: '#4B0082' }}
                        />
                      </Badge>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>
                          {getConversationName(conversation)}
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {conversation.unreadCount > 0 && (
                            <Badge count={conversation.unreadCount} size="small" />
                          )}
                          {conversation.isPinned && <CheckCircleOutlined style={{ color: '#FFB300' }} />}
                        </div>
                      </div>
                    }
                    description={
                      <div>
                        <Text
                          style={{
                            color: conversation.unreadCount > 0 ? '#FFB300' : '#B8BCC8',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </Text>
                        <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                          {conversation.lastMessage ? dayjs(conversation.lastMessage.createdAt).fromNow() : ''}
                        </Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      </Sider>

      <Layout>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div
              style={{
                background: '#1A1A1C',
                borderBottom: '1px solid rgba(255, 179, 0, 0.2)',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <Title level={5} style={{ color: '#FFB300', margin: 0 }}>
                  {getConversationName(conversations?.find(c => c.id === selectedConversation) || {})}
                </Title>
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  {conversations?.find(c => c.id === selectedConversation)?.participants[0]?.isOnline ? 'Online' : 'Offline'}
                </Text>
              </div>
              <Space>
                <Tooltip title="Voice Call">
                  <Button icon={<PhoneOutlined />} />
                </Tooltip>
                <Tooltip title="Video Call">
                  <Button icon={<VideoCameraOutlined />} />
                </Tooltip>
                <Tooltip title="Conversation Info">
                  <Button icon={<InfoOutlined />} />
                </Tooltip>
                <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                  <Button icon={<MoreOutlined />} />
                </Dropdown>
              </Space>
            </div>

            {/* Messages Area */}
            <Content style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {messagesLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Spin size="large" />
                </div>
              ) : (
                <>
                  {messagesData?.messages?.map((msg: Message) => (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '16px',
                        display: 'flex',
                        justifyContent: msg.sender.id === socket?.userId ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          background: msg.sender.id === socket?.userId ? '#4B0082' : '#2A2A2C',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: `1px solid ${msg.sender.id === socket?.userId ? 'rgba(75, 0, 130, 0.3)' : 'rgba(255, 179, 0, 0.2)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Avatar size={24} src={msg.sender.avatar} icon={<UserOutlined />} />
                          <Text style={{ color: '#FFB300', fontSize: '12px', fontWeight: 'bold' }}>
                            {msg.sender.username}
                          </Text>
                          <Text style={{ color: '#8C8C8C', fontSize: '10px' }}>
                            {dayjs(msg.createdAt).format('HH:mm')}
                          </Text>
                          {msg.sender.id === socket?.userId && (
                            <CheckCircleOutlined
                              style={{
                                color: msg.readBy.length > 1 ? '#52C41A' : '#8C8C8C',
                                fontSize: '12px',
                              }}
                            />
                          )}
                        </div>
                        <Text style={{ color: '#B8BCC8', display: 'block', lineHeight: '1.4' }}>
                          {msg.content}
                        </Text>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            {msg.attachments.map((attachment) => (
                              <div key={attachment.id} style={{ marginBottom: '4px' }}>
                                <a
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#FFB300', textDecoration: 'none' }}
                                >
                                  <PaperClipOutlined /> {attachment.filename}
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {typingUsers.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                      <div
                        style={{
                          background: '#2A2A2C',
                          padding: '8px 12px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                        }}
                      >
                        <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                          {formatTypingIndicator()}
                        </Text>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </>
              )}
            </Content>

            {/* Message Input */}
            <div
              style={{
                background: '#1A1A1C',
                borderTop: '1px solid rgba(255, 179, 0, 0.2)',
                padding: '16px 24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  />
                  <Tooltip title="Attach File">
                    <Button
                      icon={<PaperClipOutlined />}
                      onClick={() => fileInputRef.current?.click()}
                    />
                  </Tooltip>
                  <Popover
                    open={showEmojiPicker}
                    onOpenChange={setShowEmojiPicker}
                    content={<EmojiPicker onEmojiClick={handleEmojiSelect} />}
                    trigger="click"
                    placement="topLeft"
                  >
                    <Tooltip title="Emoji">
                      <Button icon={<SmileOutlined />} onClick={() => setShowEmojiPicker(!showEmojiPicker)} />
                    </Tooltip>
                  </Popover>
                </div>
                <TextArea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (e.target.value) {
                      handleTypingStart();
                    } else {
                      handleTypingStop();
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{
                    background: '#0E0E10',
                    border: '1px solid rgba(255, 179, 0, 0.2)',
                    borderRadius: '8px',
                    color: '#B8BCC8',
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sendMessageMutation.isLoading}
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                    height: '40px',
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text style={{ color: '#B8BCC8' }}>
                  Select a conversation to start messaging
                </Text>
              }
            />
          </Content>
        )}
      </Layout>

      {/* Report Message Modal */}
      <Modal
        title="Report Message"
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
            loading={reportMessageMutation.isLoading}
            onClick={() => {
              if (selectedMessageForReport) {
                reportMessageMutation.mutate({
                  messageId: selectedMessageForReport.id,
                  reason: 'Inappropriate content',
                });
              }
            }}
          >
            Report
          </Button>,
        ]}
      >
        {selectedMessageForReport && (
          <div>
            <Alert
              message="Message Content"
              description={selectedMessageForReport.content}
              type="info"
              style={{ marginBottom: '16px' }}
            />
            <Form layout="vertical">
              <Form.Item label="Reason for reporting">
                <Select placeholder="Select a reason" defaultValue="Inappropriate content">
                  <Option value="spam">Spam</Option>
                  <Option value="harassment">Harassment</Option>
                  <Option value="inappropriate">Inappropriate Content</Option>
                  <Option value="threats">Threats</Option>
                  <Option value="other">Other</Option>
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default ChatPage;
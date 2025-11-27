import React, { useState, useRef, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Upload, Space, Typography, Avatar, Tag, Tooltip, Switch, Modal, message, Dropdown, Menu, } from 'antd';
import {
  PaperClipOutlined, SendOutlined, SmileOutlined, LinkOutlined, PictureOutlined, FileTextOutlined, BoldOutlined, ItalicOutlined, UnderlineOutlined, UnorderedListOutlined, OrderedListOutlined, UserOutlined, ClockCircleOutlined, MoreOutlined, DeleteOutlined, } from '@ant-design/icons';
import { SupportTicket } from '../../services/api/crm.api';
import { useAuthStore } from '../../stores/authStore';

const {TextArea} = Input;
const {Option} = Select;
const {Text, Title} = Typography;
const {Dragger} = Upload;

interface TicketComposerProps {
  ticketId: string;
  onSendMessage: (content: string, files?: File[], isInternal?: boolean) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  showInternalToggle?: boolean;
  maxHeight?: number;
}

const TicketComposer: React.FC<TicketComposerProps> = ({
  ticketId,
  onSendMessage,
  placeholder = 'Type your message...',
  disabled = false,
  showInternalToggle = true,
  maxHeight = 200,
}) => {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isInternal, setIsInternal] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const textAreaRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {user} = useAuthStore();

  // Emoji mapping
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥲', '😴', '😪', '😵', '🤯', '🥶', '😶', '😷', '🤕', '🤒', '🤔', '🤫', '🤥',
    '😮', '🤐', '🍽', '🤤', '🤢', '🤮', '🤧', '🥳', '🥴', '🥵', '🥶', '🥷', '🥸',
    '🤠', '🥹', '🥺', '😻', '😼', '😽', '🥰', '🥻', '🥼', '🥽', '🥾', '🥿', '😀',
    '💪', '💀', '💁', '💂', '💃', '💄', '💅', '💆', '💇', '💈', '💉', '💊',
    '👋', '👌', '👍', '👎', '👏', '👐', '👋', '👃', '👆', '👇', '👈', '👉',
    '👊', '👐', '👐', '💋', '💍', '💎', '💏', '💐', '💑', '💒', '🎓', '🎂', '🎃',
    '🎄', '🎅', '🎆', '🎇', '🎈', '🎉', '🎊', '🎋', '🎌', '🎍', '🎎', '🎏',
    '🎐', '🎑', '🎒', '🎓', '🎔', '🎕', '🎖', '🎗', '🎘', '🎙', '🎚', '🎛', '🎜',
    '🎝', '🎞', '🎟', '🎠', '🎡', '🎢', '🎣', '🎤', '🎥', '🎦', '🎧', '🎨', '🎩',
    '🎪', '🎭', '🎮', '🎯', '🎰', '🎱', '🎲', '🎳', '🎴', '🎵', '🎶', '🎷',
    '🎸', '🎹', '🎺', '🎻', '🎼', '🎽', '🎾', '🎿', '🏀', '🏁', '🏂', '🏃',
    '🏄', '🏅', '🏆', '🏇', '🏈', '🏉', '🏊', '🏋', '🏌', '🏍', '🏎', '🏏',
    '🏐', '🏑', '🏒', '🏓', '🏔', '🏕', '🏖', '🏗', '🏘', '🏙', '🏚', '🏛',
    '🏜', '🏝', '🏞', '🏟', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦',
    '🏧', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏮', '🏯', '🏰', '🏱',
    '🏲', '🏳', '🏴', '🏵', '🏶', '🏷', '🏸', '🏹', '🏺', '🏻', '🏼',
    '🏽', '🏾', '🏿', '🐀', '🐁', '🐂', '🐃', '🐄', '🐅', '🐆', '🐇',
    '🐈', '🐉', '🐊', '🐋', '🐌', '🐍', '🐎', '🐏', '🐐', '🐑', '🐒', '🐓',
    '🐔', '🐕', '🐖', '🐗', '🐘', '🐙', '🐚', '🐛', '🐜', '🐝', '🐞',
    '🐟', '🐠', '🐡', '🐢', '🐣', '🐤', '🐥', '🐦', '🐧', '🐨', '🐩',
    '🐪', '🐫', '🐬', '🐭', '🐮', '🐯', '🐰', '🐱', '🐲', '🐳', '🐴',
    '🐵', '🐶', '🐷', '🐸', '🐹', '🐺', '🐻', '🐼', '🐽', '🐾', '🐿',
    '🐀', '🐁', '🐂', '🐃', '🐄', '🐅', '🐆', '🐇', '🐈', '🐉', '🐊', '🐋',
    '🐌', '🐍', '🐎', '🐏', '🐐', '🐑', '🐒', '🐓', '🐔', '🐕', '🐖', '🐗',
    '🐘', '🐙', '🐚', '🐛', '🐜', '🐝', '🐞', '🐟', '🐠', '🐡', '🐢', '🐣',
    '🐤', '🐥', '🐦', '🐧', '🐨', '🐩', '🐪', '🐫', '🐬', '🐭', '🐮',
    '🐯', '🐰', '🐱', '🐲', '🐳', '🐴', '🐵', '🐶', '🐷', '🐸', '🐹',
    '🐺', '🐻', '🐼', '🐽', '🐾', '🐿', '🐀', '🐁', '🐂', '🐃', '🐄',
    '🐅', '🐆', '🐇', '🐈', '🐉', '🐊', '🐋', '🐌', '🐍', '🐎', '🐏',
    '🐐', '🐑', '🐒', '🐓', '🐔', '🐕', '🐖', '🐗', '🐘', '🐙', '🐚',
    '🐛', '🐜', '🐝', '🐞', '🐟', '🐠', '🐡', '🐢', '🐣', '🐤', '🐥',
    '🐦', '🐧', '🐨', '🐩', '🐪', '🐫', '🐬', '🐭', '🐮', '🐯',
    '🐰', '🐱', '🐲', '🐳', '🐴', '🐵', '🐶', '🐷', '🐸', '🐹',
    '🐺', '🐻', '🐼', '🐽', '🐾', '🐿', '👑', '👒', '👓', '👔',
    '👕', '👖', '👗', '👘', '👙', '👚', '👛', '👜', '👝', '👞',
    '👟', '👠', '👡', '👢', '👣', '👤', '👥', '👦', '👧', '👨',
    '👩', '👪', '👫', '👬', '👭', '👮', '👯', '👰', '👱', '👲',
    '👳', '👴', '👵', '👶', '👷', '👸', '👹', '👺', '👻',
    '👼', '👽', '👾', '👿', '💀', '💁', '💂', '💃', '💄', '💅', '💆',
    '💇', '💈', '💉', '💊', '💋', '💌', '💍', '💎', '💏', '💐',
    '💑', '💒', '💓', '💔', '💕', '💖', '💗', '💘', '💙',
    '💚', '💛', '💜', '💝', '💞', '💟', '💠', '💡', '💢', '💣',
    '💤', '💥', '💦', '💧', '💨', '💩', '💪', '💫', '💬', '💭',
    '💮', '💯', '💰', '💱', '💲', '💳', '💴', '💵', '💶', '💷',
    '💸', '💹', '💺', '💻', '💼', '💽', '💾', '💿', '📀', '📁',
    '📂', '📃', '📄', '📅', '📆', '📇', '📈', '📉', '📊', '📋',
    '📌', '📍', '📎', '📏', '📐', '📑', '📒', '📓', '📔',
    '📕', '📖', '📗', '📘', '📙', '📚', '📛', '📜', '📝',
    '📞', '📟', '📠', '📡', '📢', '📣', '📤', '📥', '📦',
    '📧', '📨', '📩', '📪', '📫', '📬', '📭', '📮', '📯',
    '📰', '📱', '📲', '📳', '📴', '📵', '📶', '📷', '📸',
    '📹', '📺', '📻', '📼', '📽', '📾', '📿', '🔀', '🔁',
    '🔂', '🔃', '🔄', '🔅', '🔆', '🔇', '🔈', '🔉', '🔊',
    '🔋', '🔌', '🔍', '🔎', '🔏', '🔐', '🔑', '🔒', '🔓',
    '🔔', '🔕', '🔖', '🔗', '🔘', '🔙', '🔚', '🔛', '🔜',
    '🔝', '🔞', '🔟', '🔠', '🔡', '🔢', '🔣', '🔤', '🔥',
    '🔦', '🔧', '🔨', '🔩', '🔪', '🔫', '🔬', '🔭', '🔮',
    '🔯', '🔰', '🔱', '🔲', '🔳', '🔴', '🔵', '🔶', '🔷',
    '🔸', '🔹', '🔺', '🔻', '🔼', '🔽', '🔾', '🔿', '🕀',
    '🕁', '🕂', '🕃', '🕄', '🕅', '🕆', '🕇', '🕈', '🕉',
    '🕊', '🕋', '🕌', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕',
    '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞',
    '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧',
    '🕨', '🕩', '🕪', '🕫', '🕬', '🕭', '🕮', '🕯', '🕰',
    '🕱', '🕲', '🕳', '🕴', '🕵', '🕶', '🕷', '🕸', '🕹',
    '🕺', '🕻', '🕼', '🕽', '🕾', '🕿', '🖀', '🖁', '🖂', '🖃',
    '🖄', '🖅', '🖆', '🖇', '🖈', '🖉', '🖊', '🖋', '🖌', '🖍',
    '🖎', '🖏', '🖐', '🖑', '🖒', '🖓', '🖔', '🖕', '🖖',
    '🖗', '🖘', '🖙', '🖚', '🖛', '🖜', '🖝', '🖞', '🖟',
    '🖠', '🖡', '🖢', '🖣', '🖤', '🖥', '🖦', '🖧', '🖨',
    '🖩', '🖪', '🖫', '🖬', '🖭', '🖮', '🖯', '🖰', '🖱',
    '🖲', '🖳', '🖴', '🖵', '🖶', '🖷', '🖸', '🖹', '🖺',
    '🖻', '🖼', '🖽', '🖾', '🖿', '🗀', '🗁', '🗂', '🗃',
    '🗄', '🗅', '🗆', '🗇', '🗈', '🗉', '🗊', '🗋', '🗌', '🗍',
    '🗎', '🗏', '🗐', '🗑', '🗒', '🗓', '🗔', '🗕', '🗖',
    '🗗', '🗘', '🗙', '🗚', '🗛', '🗜', '🗝', '🗞', '🗟',
    '🗠', '🗡', '🗢', '🗣', '🗤', '🗥', '🗦', '🗧', '🗨',
    '🗩', '🗪', '🗫', '🗬', '🗭', '🗮', '🗯', '🗰', '🗱',
    '🗲', '🗳', '🗴', '🗵', '🗶', '🗷', '🗸', '🗹', '🗺',
    '🗻', '🗼', '🗽', '🗾', '🗿', '😀', '😁', '😂', '🤣', '😃',
    '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '😙',
    '😚', '😛', '😜', '😝', '😞', '😟', '😠', '😡', '😢', '😣',
    '😤', '😥', '😦', '😧', '😨', '😩', '😪', '😫', '😬', '😭',
    '😮', '😯', '😰', '😱', '😲', '😳', '😴', '😵', '😶', '😷',
    '😸', '😹', '😺', '😻', '😼', '😽', '😾', '😿', '🙀', '🙁',
    '🙂', '🙃', '🙄', '🙅', '🙆', '🙇', '🙈', '🙉', '🙊',
    '🙋', '🙌', '🙍', '🙎', '🙏', '🙐', '🙑', '🙒', '🙓',
    '🙔', '🙕', '🙖', '🙗', '🙘', '🙙', '🙚', '🙛', '🙜',
    '🙝', '🙞', '🙟', '🙠', '🙡', '🙢', '🙣', '🙤', '🙥',
    '🙦', '🙧', '🙨', '🙩', '🙪', '🙫', '🙬', '🙭', '🙮',
    '🙯', '🙰', '🙱', '🙲', '🙳', '🙴', '🙵', '🙶', '🙷',
    '🙸', '🙹', '🙺', '🙻', '🙼', '🙽', '🙾', '🙿', '🛀',
    '🛁', '🛂', '🛃', '🛄', '🛅', '🛆', '🛇', '🛈', '🛉',
    '🛊', '🛋', '🛌', '🛍', '🛎', '🛏', '🛐', '🛑', '🛒',
    '🛓', '🛔', '🛕', '🛖', '🛗', '🛘', '🛙', '🛚', '🛛',
    '🛜', '🛝', '🛞', '🛟', '🛠', '🛡', '🛢', '🛣', '🛤',
    '🛥', '🛦', '🛧', '🛨', '🛩', '🛪', '🛫', '🛬', '🛭',
    '🛮', '🛯', '🛰', '🛱', '🛲', '🛳', '🛴', '🛵', '🛶',
    '🛷', '🛸', '🛹', '🛺', '🛻', '🛼', '🛽', '🛾', '🛿',
    '🜀', '🜁', '🜂', '🜃', '🜄', '🜅', '🜆', '🜇', '🜈', '🜉',
    '🜊', '🜋', '🜌', '🜍', '🜎', '🜏', '🜐', '🜑', '🜒',
    '🜓', '🜔', '🜕', '🜖', '🜗', '🜘', '🜙', '🜚', '🜛',
    '🜜', '🜝', '🜞', '🜟', '🜠', '🜡', '🜢', '🜣', '🜤',
    '🜥', '🜦', '🜧', '🜨', '🜩', '🜪', '🜫', '🜬', '🜭',
    '🜮', '🜯', '🜰', '🜱', '🜲', '🜳', '🜴', '🜵', '🜶',
    '🜷', '🜸', '🜹', '🜺', '🜻', '🜼', '🜽', '🜾', '🜿',
    '🝀', '🝁', '🝂', '🝃', '🝄', '🝅', '🝆', '🝇', '🝈', '🝉',
    '🝊', '🝋', '🝌', '🝍', '🝎', '🝏', '🝐', '🝑', '🝒',
    '🝓', '🝔', '🝕', '🝖', '🝗', '🝘', '🝙', '🝚', '🝛',
    '🝜', '🝝', '🝞', '🝟', '🝠', '🝡', '🝢', '🝣', '🝤',
    '🝥', '🝦', '🝧', '🝨', '🝩', '🝪', '🝫', '🝬', '🝭',
    '🝮', '🝯', '🝰', '🝱', '🝲', '🝳', '🝴', '🝵', '🝶',
    '🝷', '🝸', '🝹', '🝺', '🝻', '🝼', '🝽', '🝾', '🝿',
    '🞀', '🞁', '🞂', '🞃', '🞄', '🞅', '🞆', '🞇', '🞈', '🞉',
    '🞊', '🞋', '🞌', '🞍', '🞍', '🞍', '🞍', '🞍', '🞍',
    '🞎', '🞏', '🞐', '🞑', '🞒', '🞍', '🞍', '🞍', '🞍',
    '🞍', '🞍', '🞍', '🞍', '🞍', '🞍', '🞍', '🞍', '🞍',
  ];

  const fileUploadProps = {
    name: 'files',
    multiple: true,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif',
    beforeUpload: (file) => {
      const isValidType = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg', 'image/gif'].includes(file.type);
      const isValidSize = file.size / 1024 / 1024 < 10; // 10MB limit

      if (!isValidType) {
        message.error(`${file.name} is not a supported file type`);
        return false;
      }
      if (!isValidSize) {
        message.error(`${file.name} exceeds the 10MB file size limit`);
        return false;
      }
      return true;
    },
    customRequest: ({ file, onSuccess, onError, onProgress }) => {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate upload progress
      const interval = setInterval(() => {
        const progress = Math.min(100, Math.random() * 30 + 70);
        onProgress!({ percent: progress });
      }, 200);

      // Simulate upload completion
      setTimeout(() => {
        clearInterval(interval);
        onSuccess(file);

        // Add file to state
        setFiles(prev => [...prev, file]);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      }, 1500);
    },
    onChange: (info) => {
      const {status} = info.file;
      if (status === 'error') {
        message.error(`${info.file.name} upload failed.`);
      }
    },
  };

  const handleSendMessage = async () => {
    if (!content.trim() && files.length === 0) {
      message.warning('Please enter a message or attach files');
      return;
    }

    setIsComposing(true);
    try {
      await onSendMessage(content, files, isInternal);
      setContent('');
      setFiles([]);
      setUploadProgress({});
      form.resetFields();
    } catch (error) {
      message.error('Failed to send message');
    } finally {
      setIsComposing(false);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const newValue = content.substring(0, start) + emoji + content.substring(end);
      setContent(newValue);

      // Restore cursor position
      setTimeout(() => {
        textArea.focus();
        textArea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    }

    setShowEmojiPicker(false);
  };

  const handleFormatting = (type: 'bold' | 'italic' | 'underline' | 'link') => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea;
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const selectedText = content.substring(start, end);

      let formattedText = '';
      switch (type) {
        case 'bold':
          formattedText = `**${selectedText}**`;
          break;
        case 'italic':
          formattedText = `_${selectedText}_`;
          break;
        case 'underline':
          formattedText = `__${selectedText}__`;
          break;
        case 'link':
          const url = prompt('Enter URL:');
          if (url) {
            formattedText = `[${selectedText || 'Link'}](${url})`;
          }
          break;
      }

      const newValue = content.substring(0, start) + formattedText + content.substring(end);
      setContent(newValue);

      // Restore selection
      setTimeout(() => {
        textArea.focus();
        textArea.setSelectionRange(start, start + formattedText.length);
      }, 0);
    }

    setShowFormatting(false);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[files[index].name];
      return newProgress;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="ticket-composer">
      {/* Internal/External Toggle */}
      {showInternalToggle && (
        <div className="mb-3 flex items-center justify-between">
          <Space>
            <Avatar size="small" icon={<UserOutlined />} />
            <Text type="secondary">
              {user?.firstName} {user?.lastName}
            </Text>
          </Space>
          <Space>
            <Text type="secondary">Internal:</Text>
            <Switch
              checked={isInternal}
              onChange={setIsInternal}
              checkedChildren="Team Only"
              unCheckedChildren="Visible to Client"
            />
          </Space>
        </div>
      )}

      {/* Message Input */}
      <Form form={form} onFinish={handleSendMessage}>
        <div className="space-y-3">
          {/* Formatting Toolbar */}
          <div className="flex items-center space-x-2 border-b pb-2">
            <Space>
              <Button
                type="text"
                size="small"
                icon={<BoldOutlined />}
                onClick={() => handleFormatting('bold')}
                className="hover:bg-gray-100"
              />
              <Button
                type="text"
                size="small"
                icon={<ItalicOutlined />}
                onClick={() => handleFormatting('italic')}
                className="hover:bg-gray-100"
              />
              <Button
                type="text"
                size="small"
                icon={<UnderlineOutlined />}
                onClick={() => handleFormatting('underline')}
                className="hover:bg-gray-100"
              />
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => handleFormatting('link')}
                className="hover:bg-gray-100"
              />
            </Space>

            <div className="flex-1" />

            <Space>
              <Button
                type="text"
                size="small"
                icon={<SmileOutlined />}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="hover:bg-gray-100"
              />
              <Button
                type="text"
                size="small"
                icon={<PaperClipOutlined />}
                onClick={() => fileInputRef.current?.click()}
                className="hover:bg-gray-100"
              />
            </Space>
          </div>

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="mb-3 p-3 border rounded-lg bg-white shadow-lg">
              <div className="grid grid-cols-10 gap-2 max-h-60 overflow-y-auto">
                {emojis.map((emoji, index) => (
                  <button
                    key={index}
                    className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                    onClick={() => handleInsertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Text Area */}
          <TextArea
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            autoSize={{ minRows: 3, maxRows: maxHeight / 24 }}
            disabled={disabled}
            className="resize-none"
          />

          {/* File Upload */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-2">
                    <FileTextOutlined />
                    <Text className="text-sm">{file.name}</Text>
                    <Text type="secondary" className="text-xs">
                      ({formatFileSize(file.size)})
                    </Text>
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadProgress[file.name] !== undefined && uploadProgress[file.name] < 100 && (
                      <div className="w-20">
                        <Progress
                          percent={uploadProgress[file.name]}
                          size="small"
                          status="active"
                          showInfo={false}
                        />
                      </div>
                    )}
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => removeFile(index)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
            onChange={(e) => {
              const newFiles = Array.from(e.target.files);
              setFiles(prev => [...prev, ...newFiles]);
            }}
            style={{ display: 'none' }}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Space>
              <Dragger {...fileUploadProps} showUploadList={false}>
                <Button
                  type="text"
                  icon={<PaperClipOutlined />}
                  disabled={disabled}
                >
                  Attach Files
                </Button>
              </Dragger>
            </Space>

            <Space>
              <Button
                onClick={() => {
                  setContent('');
                  setFiles([]);
                  form.resetFields();
                }}
                disabled={disabled || isComposing}
              >
                Clear
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={isComposing}
                disabled={disabled || (!content.trim() && files.length === 0)}
              >
                {isInternal ? 'Send Internal' : 'Send'}
              </Button>
            </Space>
          </div>
        </div>
      </Form>
    </Card>
  );
};

export default TicketComposer;
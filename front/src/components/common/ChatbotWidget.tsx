import { useState, useRef, useEffect } from 'react';
import { Button, Input, Spin, Tooltip } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined } from '@ant-design/icons';
import { useAuthContext } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

const CHATBOT_URL = 'https://253hubrxvpidhtqh43bn2m2gzy0fwqla.lambda-url.us-east-1.on.aws/';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const ChatbotWidget = () => {
  const { usuario } = useAuthContext();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(CHATBOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          channel: 'crm',
          user_role: usuario?.rol ?? 'crm_user',
          user_name: usuario?.nombre ?? 'Usuario',
          user_email: usuario?.username ?? '',
          context: location.pathname,
        }),
      });

      const data = await res.json();
      const answer = data?.answer ?? data?.message ?? 'Sin respuesta del asistente.';
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con el asistente. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Burbuja flotante */}
      {!open && (
        <Tooltip title="JAM Asistente" placement="left">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<MessageOutlined style={{ fontSize: 22 }} />}
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed',
              bottom: 28,
              right: 28,
              width: 56,
              height: 56,
              zIndex: 1000,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              background: '#1a3c5e',
              border: 'none',
            }}
          />
        </Tooltip>
      )}

      {/* Panel del chat */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 360,
          maxHeight: 540,
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: '#1a3c5e',
            color: '#fff',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ fontSize: 18 }} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>JAM Asistente</span>
            </div>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setOpen(false)}
              style={{ color: '#fff', padding: 0 }}
            />
          </div>

          {/* Mensajes */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 300,
            maxHeight: 400,
            background: '#f8f9fb',
          }}>
            {messages.length === 0 && (
              <div style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                Hola, soy JAM Asistente. ¿En qué puedo ayudarte hoy?
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '82%',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? '#1a3c5e' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#222',
                  fontSize: 13,
                  lineHeight: 1.5,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 14px',
                  background: '#fff',
                  borderRadius: '12px 12px 12px 2px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                }}>
                  <Spin size="small" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: 8,
            background: '#fff',
          }}>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={sendMessage}
              placeholder="Escribe tu pregunta..."
              disabled={loading}
              style={{ borderRadius: 8, fontSize: 13 }}
              maxLength={1500}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{ background: '#1a3c5e', border: 'none', borderRadius: 8 }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;

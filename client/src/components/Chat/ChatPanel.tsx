import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ChatMsg, User } from '@/types';

interface ChatPanelProps {
  messages: ChatMsg[];
  onSend: (msg: string) => void;
  user: User | null;
}

function getLevelColor(level: number): string {
  if (level >= 50) return 'bg-red-500';
  if (level >= 30) return 'bg-purple-500';
  if (level >= 20) return 'bg-yellow-500';
  if (level >= 10) return 'bg-blue-500';
  return 'bg-gray-500';
}

function getUsernameColor(role: string): string {
  if (role === 'ADMIN') return 'text-red-400';
  return 'text-gray-300';
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, onSend, user }: ChatPanelProps) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-white/5">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
        <span className="text-sm font-medium text-gray-300">Chat</span>
        <span className="text-xs text-gray-500 ml-auto">{messages.length} msgs</span>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10"
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-start gap-2 py-1 group"
          >
            {/* Level badge */}
            <div
              className={`${getLevelColor(msg.level)} shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5`}
            >
              <span className="text-[10px] font-bold text-white leading-none">{msg.level}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-semibold ${getUsernameColor(msg.role)} truncate`}>
                  {msg.username}
                </span>
                <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-400 break-words leading-snug">{msg.message}</p>
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-white/5">
        {user ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              maxLength={200}
              placeholder="Сообщение..."
              className="flex-1 bg-[var(--color-surface-light)] text-sm text-white placeholder-gray-500 px-3 py-2 rounded-lg border border-white/5 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="p-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500 py-2">
            Войдите для чата
          </div>
        )}
      </div>
    </div>
  );
}

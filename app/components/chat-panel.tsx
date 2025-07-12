'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Send, Bot, User, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  extractedDataId: string;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPanel({ extractedDataId, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you understand and analyze the extracted document data. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage, 
      timestamp: new Date() 
    }]);
    setLoading(true);
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: extractedDataId, message: userMessage }),
      });

      if (!response.ok) throw new Error('Chat failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '', 
        timestamp: new Date() 
      }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              assistantMessage += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = assistantMessage;
                return updated;
              });
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const quickPrompts = [
    "Summarize the key information",
    "What are the important dates?",
    "Extract contact details",
    "Find monetary amounts"
  ];

  return (
    <div className="w-96 flex flex-col bg-gradient-to-b from-white to-blue-50/30 border-l border-gray-200/50 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/50 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">AI Assistant</h3>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Online
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="p-3 border-b border-gray-200/50 bg-gray-50/50">
        <div className="text-xs font-semibold text-gray-600 mb-2">Quick Questions:</div>
        <div className="flex flex-wrap gap-1">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => setInput(prompt)}
              className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 animate-fadeIn ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'order-1' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-3 shadow-lg ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white ml-auto' 
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <div className="text-sm leading-relaxed">{msg.content}</div>
              </div>
              <div className={`text-xs text-gray-400 mt-1 ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                {formatTime(msg.timestamp)}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 animate-fadeIn">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200/50 bg-white/90 backdrop-blur-sm">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask me anything about the document..."
              disabled={loading}
              className="pr-12 bg-white border-gray-300 focus:border-blue-400 focus:ring-blue-400 rounded-xl shadow-sm"
            />
            {input && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
              </div>
            )}
          </div>
          <Button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 rounded-xl"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {/* Character Counter */}
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>Powered by AI</span>
          <span>{input.length}/500</span>
        </div>
      </div>
    </div>
  );
}
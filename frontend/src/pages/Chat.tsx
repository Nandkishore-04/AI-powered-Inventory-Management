import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import socketService, { ChatMessage, ChatSession } from '../services/socket';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const Chat: React.FC = () => {
  const { user } = useAuthStore();
  const { language, t } = useLanguage();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Connect to socket
    socketService.connect();
    setIsConnected(true);

    // Set up event listeners
    socketService.on('session_joined', (data: { session: ChatSession; messages: ChatMessage[] }) => {
      setCurrentSession(data.session);
      setMessages(data.messages);
      toast.success(t('Connected to chat session'));
    });

    socketService.on('message_received', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      setIsAITyping(false);

      // Show notification for AI messages
      if (message.sender === 'AI') {
        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
      }
    });

    socketService.on('user_typing', (data: { userId: string; isTyping: boolean }) => {
      setIsAITyping(data.isTyping);
    });

    socketService.on('sessions_list', (sessionsList: ChatSession[]) => {
      setSessions(sessionsList);
    });

    socketService.on('session_deleted', (data: { sessionId: string }) => {
      setSessions((prev) => prev.filter((s) => s.id !== data.sessionId));
      if (currentSession?.id === data.sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      toast.success(t('Session deleted'));
    });

    socketService.on('error', (error: { message: string }) => {
      toast.error(error.message);
    });

    // Load sessions
    if (user) {
      socketService.getSessions(user.id);
    }

    return () => {
      socketService.off('session_joined');
      socketService.off('message_received');
      socketService.off('user_typing');
      socketService.off('sessions_list');
      socketService.off('session_deleted');
      socketService.off('error');
    };
  }, [user]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewSession = () => {
    if (user) {
      socketService.joinSession(user.id);
    }
  };

  const joinExistingSession = (sessionId: string) => {
    if (user) {
      socketService.joinSession(user.id, sessionId);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || !currentSession) {
      return;
    }

    socketService.sendMessage(inputMessage.trim(), language);
    setInputMessage('');
    setIsTyping(false);
    setIsAITyping(true); // Show AI typing indicator
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    // Typing indicator
    if (!isTyping) {
      setIsTyping(true);
      socketService.setTyping(true);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.setTyping(false);
    }, 2000);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user && confirm(t('Are you sure you want to delete this conversation?'))) {
      socketService.deleteSession(sessionId, user.id);
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return t('Today');
    } else if (d.toDateString() === yesterday.toDateString()) {
      return t('Yesterday');
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Sidebar - Sessions List */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('Chat')}</h2>
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? t('Connected') : t('Disconnected')} />
          </div>
          <button
            onClick={startNewSession}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + {t('New Conversation')}
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">{t('No conversations yet')}</p>
              <p className="text-xs mt-2">{t('Start a new conversation to get started!')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => joinExistingSession(session.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    currentSession?.id === session.id ? 'bg-blue-50 dark:bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-800 dark:text-white truncate">
                        {session.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(session.lastActivity)}
                      </p>
                      {session.messages && session.messages.length > 0 && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">
                          {session.messages[0].content}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Chat Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                    {currentSession.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('Ask me anything about your inventory')}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <p className="text-lg font-medium">{t('Start a conversation')}</p>
                    <p className="text-sm mt-2">{t('Try asking:')}</p>
                    <div className="mt-3 space-y-1 text-sm text-left max-w-md mx-auto">
                      <p>• "{t('Show low stock items')}"</p>
                      <p>• "{t('Search product laptop')}"</p>
                      <p>• "{t('Show total inventory value')}"</p>
                      <p>• "{t('List all suppliers')}"</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.sender === 'USER'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        <div
                          className={`text-xs mt-1 ${
                            message.sender === 'USER' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isAITyping && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg px-4 py-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <form onSubmit={handleSendMessage} className="flex space-x-4">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={handleInputChange}
                  placeholder={t('Type your message... (e.g., "show low stock")')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {t('Send')}
                </button>
              </form>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('Type "help" to see available commands')}
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg className="w-24 h-24 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-xl font-medium">{t('Select a conversation')}</p>
              <p className="text-sm mt-2">{t('or start a new one to begin chatting')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

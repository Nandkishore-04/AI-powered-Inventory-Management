import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'USER' | 'AI';
  content: string;
  metadata?: string;
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  contextData?: string;
  lastActivity: Date;
  createdAt: Date;
  messages?: ChatMessage[];
}

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  getSocket() {
    return this.socket;
  }

  // Chat-specific helper methods
  joinSession(userId: string, sessionId?: string) {
    this.emit('join_session', { userId, sessionId });
  }

  sendMessage(content: string, language?: 'en' | 'ta') {
    this.emit('send_message', { content, language });
  }

  setTyping(isTyping: boolean) {
    this.emit('typing', { isTyping });
  }

  getSessions(userId: string) {
    this.emit('get_sessions', { userId });
  }

  deleteSession(sessionId: string, userId: string) {
    this.emit('delete_session', { sessionId, userId });
  }
}

export default new SocketService();

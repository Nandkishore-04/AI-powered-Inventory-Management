import { Server, Socket } from 'socket.io';
import prisma from '../config/database';
import logger from '../config/logger';
import { parseCommand } from '../utils/commandParser';
import { getAIResponse, isOpenAIConfigured } from './openaiService';

interface SocketUser {
  userId: string;
  sessionId: string;
}

// Store active users and their sessions
const activeUsers = new Map<string, SocketUser>();
const AI_MODE = (process.env.AI_MODE || 'offline').toLowerCase();

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join chat session
    socket.on('join_session', async (data: { userId: string; sessionId?: string }) => {
      try {
        const { userId, sessionId } = data;
        let session;

        if (sessionId) {
          // Join existing session
          session = await prisma.chatSession.findUnique({
            where: { id: sessionId },
          });

          if (!session || session.userId !== userId) {
            socket.emit('error', { message: 'Session not found or unauthorized' });
            return;
          }
        } else {
          // Create new session
          session = await prisma.chatSession.create({
            data: {
              userId,
              title: 'New Conversation',
            },
          });
        }

        // Store user info
        activeUsers.set(socket.id, { userId, sessionId: session.id });

        // Join socket room for this session
        socket.join(session.id);

        // Send session info and message history
        const messages = await prisma.chatMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { timestamp: 'asc' },
          take: 50, // Last 50 messages
        });

        socket.emit('session_joined', {
          session,
          messages,
        });

        logger.info(`User ${userId} joined session ${session.id}`);
      } catch (error) {
        logger.error('Error joining session:', error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Send message
    socket.on('send_message', async (data: { content: string; language?: 'en' | 'ta' }) => {
      try {
        const userInfo = activeUsers.get(socket.id);
        if (!userInfo) {
          socket.emit('error', { message: 'Not connected to a session' });
          return;
        }

        const { userId, sessionId } = userInfo;
        const { content, language } = data;

        // Save user message
        const userMessage = await prisma.chatMessage.create({
          data: {
            sessionId,
            sender: 'USER',
            content,
          },
        });

        // Update session last activity
        await prisma.chatSession.update({
          where: { id: sessionId },
          data: { lastActivity: new Date() },
        });

        // Broadcast to all clients in the session
        io.to(sessionId).emit('message_received', userMessage);

        // Get conversation history for context (last 10 messages)
        const conversationHistory = await prisma.chatMessage.findMany({
          where: { sessionId },
          orderBy: { timestamp: 'desc' },
          take: 10,
        });

        const historyForAI = conversationHistory
          .reverse()
          .map((msg) => ({
            role: (msg.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: msg.content,
          }))
          .slice(0, -1); // Exclude the current message

        let aiResponse: string;
        let metadata: any = {};

        // Offline mode is used for demos without paid APIs.
        const shouldUseOpenAI = AI_MODE !== 'offline' && isOpenAIConfigured;

        // Try OpenAI first (if enabled), fallback to parser
        if (shouldUseOpenAI) {
          try {
            const aiResult = await getAIResponse(content, historyForAI, userId);
            aiResponse = aiResult.response;
            metadata = {
              aiPowered: true,
              functionCalls: aiResult.functionCalls,
            };
          } catch (error) {
            logger.error('OpenAI error, falling back to regex parser:', error);
            const commandResult = await parseCommand(content, userId, language);
            aiResponse = commandResult.response;
            metadata = {
              aiPowered: false,
              command: commandResult.command,
              data: commandResult.data,
              inventoryUpdates: commandResult.inventoryUpdates,
            };
          }
        } else {
          // Use parser as primary assistant in offline/demo mode.
          const commandResult = await parseCommand(content, userId, language);
          aiResponse = commandResult.response;
          metadata = {
            aiPowered: false,
            mode: 'offline',
            command: commandResult.command,
            data: commandResult.data,
            inventoryUpdates: commandResult.inventoryUpdates,
          };
        }

        // Save AI response
        const aiMessage = await prisma.chatMessage.create({
          data: {
            sessionId,
            sender: 'AI',
            content: aiResponse,
            metadata: JSON.stringify(metadata),
          },
        });

        // Broadcast AI response
        io.to(sessionId).emit('message_received', aiMessage);

        // If there are inventory updates, broadcast them
        if (metadata.inventoryUpdates) {
          io.emit('inventory_update', metadata.inventoryUpdates);
        }
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing', (data: { isTyping: boolean }) => {
      const userInfo = activeUsers.get(socket.id);
      if (userInfo) {
        socket.to(userInfo.sessionId).emit('user_typing', {
          userId: userInfo.userId,
          isTyping: data.isTyping,
        });
      }
    });

    // Get session history
    socket.on('get_sessions', async (data: { userId: string }) => {
      try {
        const sessions = await prisma.chatSession.findMany({
          where: { userId: data.userId },
          orderBy: { lastActivity: 'desc' },
          take: 20,
          include: {
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        });

        socket.emit('sessions_list', sessions);
      } catch (error) {
        logger.error('Error fetching sessions:', error);
        socket.emit('error', { message: 'Failed to fetch sessions' });
      }
    });

    // Delete session
    socket.on('delete_session', async (data: { sessionId: string; userId: string }) => {
      try {
        const session = await prisma.chatSession.findUnique({
          where: { id: data.sessionId },
        });

        if (!session || session.userId !== data.userId) {
          socket.emit('error', { message: 'Session not found or unauthorized' });
          return;
        }

        await prisma.chatSession.delete({
          where: { id: data.sessionId },
        });

        socket.emit('session_deleted', { sessionId: data.sessionId });
      } catch (error) {
        logger.error('Error deleting session:', error);
        socket.emit('error', { message: 'Failed to delete session' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const userInfo = activeUsers.get(socket.id);
      if (userInfo) {
        logger.info(`User ${userInfo.userId} disconnected from session ${userInfo.sessionId}`);
        activeUsers.delete(socket.id);
      }
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};

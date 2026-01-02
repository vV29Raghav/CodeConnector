const ACTIONS = require('../client/src/Utils/Actions.js');
const express = require('express');
const Redis = require('ioredis');
const app = express();
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const cors = require('cors');

const http = require('http');
app.use(cors());
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;

const userSocketMap = {};
const roomAdmins = {}; // roomId -> adminSocketId
const userPermissions = {}; // socketId -> { canRunCode: boolean }
const ROOM_CAPACITY = 10;

// Initialize Redis 
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => null,
  })
  : new Redis({
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => null,
  });

let isRedisConnected = false;
const memoryStore = new Map(); // Fallback for room data: roomId -> { code, language, adminId }
const userRoomsStore = new Map(); // Fallback for user rooms: userId -> Set(roomIds)

redis.on('connect', () => {
  isRedisConnected = true;
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  isRedisConnected = false;
  console.error('Redis connection error (falling back to memory):', err.message);
});

function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
      isAdmin: roomAdmins[roomId] === socketId,
      permissions: userPermissions[socketId] || { canRunCode: false },
    }
  })
}

//Whenever a user connects this event triggers
io.on('connection', (socket) => {

  console.log('a user connected', socket.id);

  socket.on(ACTIONS.JOIN, async ({ roomId, username }) => {
    const currentClients = getAllConnectedClients(roomId);

    // 1. Check Capacity
    if (currentClients.length >= ROOM_CAPACITY) {
      socket.emit(ACTIONS.ROOM_FULL, { message: `Room is full. Max capacity is ${ROOM_CAPACITY}.` });
      return;
    }

    userSocketMap[socket.id] = username;
    socket.join(roomId);

    // 2. Assign Admin if first user
    if (!roomAdmins[roomId]) {
      roomAdmins[roomId] = socket.id;
      userPermissions[socket.id] = { canRunCode: true }; // Admin always has authority
    } else {
      userPermissions[socket.id] = { canRunCode: false }; // Others don't by default
    }

    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });

    // Check persistence for saved codespace
    try {
      let savedData;
      if (isRedisConnected) {
        savedData = await redis.get(`room:${roomId}`);
      } else {
        const data = memoryStore.get(roomId);
        if (data) savedData = JSON.stringify(data);
      }

      if (savedData) {
        const { code, language } = JSON.parse(savedData);
        socket.emit(ACTIONS.CODE_CHANGE, { code });
        socket.emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
      }
    } catch (err) {
      console.error('Persistence load error:', err);
    }
  });

  socket.on(ACTIONS.SAVE_ROOM, async ({ roomId, code, language, userId }) => {
    console.log(`Save request for room ${roomId} from user ${userId}`);
    // Only admin can save
    if (roomAdmins[roomId] === socket.id) {
      try {
        const roomDataObj = { code, language, adminId: userId };

        if (isRedisConnected) {
          const roomData = JSON.stringify(roomDataObj);
          await redis.setex(`room:${roomId}`, 86400, roomData);
          await redis.sadd(`user:${userId}:rooms`, roomId);
          await redis.expire(`user:${userId}:rooms`, 86400);
          console.log(`Saved to Redis: ${roomId}`);
        } else {
          // Memory fallback
          memoryStore.set(roomId, roomDataObj);
          if (!userRoomsStore.has(userId)) userRoomsStore.set(userId, new Set());
          userRoomsStore.get(userId).add(roomId);

          // Basic auto-cleanup for memory fallback (24h)
          setTimeout(() => {
            memoryStore.delete(roomId);
            if (userRoomsStore.has(userId)) userRoomsStore.get(userId).delete(roomId);
          }, 86400000);
          console.log(`Saved to Memory: ${roomId}`);
        }

        socket.emit(ACTIONS.ROOM_SAVED, { message: 'Codespace saved for 24 hours!' });
      } catch (err) {
        console.error('Persistence save error:', err);
        socket.emit(ACTIONS.ROOM_SAVE_ERROR, { message: 'Failed to save codespace.' });
      }
    } else {
      console.log(`Save denied: ${socket.id} is not admin for ${roomId}`);
      socket.emit(ACTIONS.ROOM_SAVE_ERROR, { message: 'Only the room admin can save.' });
    }
  });

  socket.on(ACTIONS.DELETE_ROOM, async ({ roomId, userId }) => {
    console.log(`Delete request for room ${roomId} from user ${userId}`);
    // Only admin can delete
    if (roomAdmins[roomId] === socket.id) {
      try {
        if (isRedisConnected) {
          await redis.del(`room:${roomId}`);
          await redis.srem(`user:${userId}:rooms`, roomId);
          console.log(`Deleted from Redis: ${roomId}`);
        } else {
          // Memory fallback
          memoryStore.delete(roomId);
          if (userRoomsStore.has(userId)) {
            userRoomsStore.get(userId).delete(roomId);
          }
          console.log(`Deleted from Memory: ${roomId}`);
        }
        socket.emit(ACTIONS.ROOM_DELETED, { message: 'Codespace deleted successfully!', roomId });
      } catch (err) {
        console.error('Persistence delete error:', err);
        socket.emit(ACTIONS.ROOM_SAVE_ERROR, { message: 'Failed to delete codespace.' });
      }
    } else {
      console.log(`Delete denied: ${socket.id} is not admin for ${roomId}`);
      socket.emit(ACTIONS.ROOM_SAVE_ERROR, { message: 'Only the room admin can delete.' });
    }
  });

  socket.on(ACTIONS.GET_USER_ROOMS, async ({ userId }) => {
    try {
      let roomIds = [];
      if (isRedisConnected) {
        roomIds = await redis.smembers(`user:${userId}:rooms`);
      } else if (userRoomsStore.has(userId)) {
        roomIds = Array.from(userRoomsStore.get(userId));
      }
      socket.emit(ACTIONS.USER_ROOMS_LIST, { roomIds });
    } catch (err) {
      console.error('Persistence fetch rooms error:', err);
    }
  });

  socket.on(ACTIONS.REQUEST_AUTHORITY, ({ roomId, targetSocketId, canRunCode }) => {
    // Only admin can change authority
    if (roomAdmins[roomId] === socket.id) {
      userPermissions[targetSocketId] = { ...userPermissions[targetSocketId], canRunCode };

      const clients = getAllConnectedClients(roomId);
      // Sync updated permissions to all
      io.in(roomId).emit(ACTIONS.AUTHORITY_CHANGED, { clients });
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    //Broadcast to all other clients except the sender
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language, code }) => {
    //Broadcast to all other clients except the sender
    socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
  });

  socket.on(ACTIONS.SYNC_RUNNING, ({ roomId, isRunning }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_RUNNING, { isRunning });
  });

  socket.on(ACTIONS.SYNC_OUTPUT, ({ roomId, output }) => {
    socket.in(roomId).emit(ACTIONS.SYNC_OUTPUT, { output });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ code, language, socketId }) => {
    // Send the current code and language to the specific newly joined user
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    io.to(socketId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
  });

  //Whenever any user disconnects this event triggers
  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms]; //Get all rooms in which this socket is present
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });

      // If admin leaves, assign a new one
      if (roomAdmins[roomId] === socket.id) {
        delete roomAdmins[roomId];
        const remainingClients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
        if (remainingClients.length > 0) {
          roomAdmins[roomId] = remainingClients[0];
          userPermissions[remainingClients[0]] = { canRunCode: true };
          // Notify everyone of the new admin
          io.in(roomId).emit(ACTIONS.AUTHORITY_CHANGED, { clients: getAllConnectedClients(roomId) });
        }
      }
    });
    delete userSocketMap[socket.id];
    delete userPermissions[socket.id];
    socket.leave();
  });


});

app.post('/run-code', express.json(), async (req, res) => {
  const { language, code } = req.body;
  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  try {
    const prompt = `
    You are a code execution simulator.
    The user is writing code in ${language}.
    
    CODE:
    ${code}

    Execute this code (or simulate its execution if actual execution is not possible) and return ONLY the standard output and standard error.
    Do not provide any explanation, comments, or formatting like markdown code blocks. Just the raw output of the code.
    If there is a compilation error or runtime error, return the error message.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const outputText = (response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

    res.json({ output: outputText });
  }
  catch (error) {
    console.error('Error during code execution:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
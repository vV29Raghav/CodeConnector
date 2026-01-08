const ACTIONS = require('../client/src/Utils/Actions.js');
const express = require('express');
const app = express();

require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const cors = require('cors');
const http = require('http');
app.use(cors());

const { Server } = require('socket.io'); //creates Socket.io server instance
const server = http.createServer(app); //create http server and attach our app with it

const io = new Server(server, {//Allow web socket on that http server
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {//Iterate on all socketsIds in the room
    return {
      socketId,
      username: userSocketMap[socketId],
    }
  })
}

//Whenever a user connects this event triggers
io.on('connection', (socket) => {

  console.log('a user connected', socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
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
    });
    delete userSocketMap[socket.id];
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

server.listen(PORT, () => { //we do server.listen so that it will not create another http server 
  console.log(`listening on *:${PORT}`);
});
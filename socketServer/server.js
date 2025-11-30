const ACTIONS = require('../client/src/Utils/Actions.js'); 
const express = require('express');
const app = express();
require('dotenv').config();
const {GoogleGenAI} = require('@google/genai');
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const cors = require('cors');

const http = require('http');
app.use(cors());
const {Server} = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, {
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

    socket.on(ACTIONS.JOIN, ({roomId, username}) => {
      userSocketMap[socket.id] = username;
      socket.join(roomId);
      const clients = getAllConnectedClients(roomId);
      clients.forEach(({socketId}) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
          socketId: socket.id,
        });
      });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({roomId, code}) => {
      //Broadcast to all other clients except the sender
      socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({roomId, language, code}) => {
      //Broadcast to all other clients except the sender
      socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, {language, code});
    });

    socket.on(ACTIONS.SYNC_CODE, ({code, socketId}) => {
      //Broadcast to all other clients except the sender
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, {code});
      io
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
  const {language, code} = req.body;
  if(!code || !language) {
    return res.status(400).json({error: 'Code and language are required'});
  }

  const prompt = `
    You are a code analysis and execution agent.
    If the language is Java, execute the code and return ONLY the output/error.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
       contents: prompt,
       config: {
        tools: [{codeExecution: {}}],
       }
    });
    const outputText = (response?.text || response?.output_text || '').trim();

    if (outputText.startsWith('Error:')) {
      return res.status(400).json({ error: outputText });
    }
    res.json({output: outputText});
  }
  catch (error) {
    console.error('Error during code execution:', error);
    res.status(500).json({error: 'Internal server error'});
  }

});

server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});
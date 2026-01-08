const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const codeRoutes = require('./routes/codeRoutes');
const socketManager = require('./socket/socketManager');

app.use(cors());
app.use(express.json()); // Enable JSON parsing for body

// Use Routes
app.use('/', codeRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize Socket Manager
socketManager(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
const ACTIONS = require('../client/src/Actions.js'); 
const express = require('express');
const app = express();
require('dotenv').config();


const http = require('http');
const {Server} = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);

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

    socket.on(ACTIONS.SYNC_CODE, ({code, socketId}) => {
      //Broadcast to all other clients except the sender
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, {code});
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


server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
});

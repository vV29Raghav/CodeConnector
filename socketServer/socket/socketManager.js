const ACTIONS = require('../../client/src/Utils/Actions.js');

const userSocketMap = {};

function getAllConnectedClients(io, roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId],
        }
    })
}

const socketManager = (io) => {
    io.on('connection', (socket) => {
        console.log('a user connected', socket.id);

        socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
            userSocketMap[socket.id] = username;
            socket.join(roomId);

            const clients = getAllConnectedClients(io, roomId);

            // Broadcast JOINED event 
            clients.forEach(({ socketId }) => {
                io.to(socketId).emit(ACTIONS.JOINED, {
                    clients,
                    username,
                    socketId: socket.id,
                });
            });
        });

        socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
            socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
        });

        socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language, code }) => {
            socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
        });

        socket.on(ACTIONS.SYNC_RUNNING, ({ roomId, isRunning }) => {
            socket.in(roomId).emit(ACTIONS.SYNC_RUNNING, { isRunning });
        });

        socket.on(ACTIONS.SYNC_OUTPUT, ({ roomId, output }) => {
            socket.in(roomId).emit(ACTIONS.SYNC_OUTPUT, { output });
        });

        socket.on(ACTIONS.SYNC_CODE, ({ code, language, socketId }) => {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
            io.to(socketId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
        });

        socket.on('disconnecting', () => {
            const rooms = [...socket.rooms];
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
};

module.exports = socketManager;

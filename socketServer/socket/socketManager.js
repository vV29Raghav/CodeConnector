// backend/socketManager.js
const ACTIONS = require("./Actions");
const Redis = require("ioredis");

// Initialize Redis Client


// It will use process.env.REDIS_URL if provided, else defaults to localhost:6379
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
redis.on("error", (err) => console.log("Redis Client Error", err));

const userSocketMap = {};
const roomHostMap = {}; // Tracks the host (creator) of each room

function getAllConnectedClients(io, roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

const socketManager = (io) => {
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on(ACTIONS.JOIN, async ({ roomId, username }) => {
            userSocketMap[socket.id] = username;

            // If room doesn't exist yet, this user is the host
            const roomClients = io.sockets.adapter.rooms.get(roomId);
            const isHost = (!roomClients || roomClients.size === 0);

            if (isHost) {
                roomHostMap[roomId] = socket.id;
            }

            socket.join(roomId);

            const clients = getAllConnectedClients(io, roomId);
            const hostSocketId = roomHostMap[roomId];

            clients.forEach(({ socketId }) => {
                io.to(socketId).emit(ACTIONS.JOINED, {
                    clients,
                    username,
                    socketId: socket.id,
                    hostSocketId,
                });
            });

            // If this is the room host (first client), try to restore state from Redis
            if (isHost) {
                try {
                    const savedData = await redis.get(`roomId:${roomId}`);
                    if (savedData) {
                        const parsedData = JSON.parse(savedData);
                        io.in(roomId).emit('load_saved_code', parsedData);
                    }
                } catch (err) {
                    console.error("Redis Load Error:", err);
                }
            }
        });

        socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
            socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
        });

        socket.on(ACTIONS.LANGUAGE_CHANGE, ({ roomId, language, code }) => {
            socket.to(roomId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
        });

        socket.on(ACTIONS.SYNC_RUNNING, ({ roomId, isRunning }) => {
            socket.to(roomId).emit(ACTIONS.SYNC_RUNNING, { isRunning });
        });

        socket.on(ACTIONS.SYNC_OUTPUT, ({ roomId, output }) => {
            socket.to(roomId).emit(ACTIONS.SYNC_OUTPUT, { output });
        });

        socket.on('sync_input', ({ roomId, inputData }) => {
            socket.to(roomId).emit('sync_input', { inputData });
        });

        socket.on(ACTIONS.SYNC_CODE, ({ code, language, socketId }) => {
            io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
            io.to(socketId).emit(ACTIONS.LANGUAGE_CHANGE, { language, code });
        });

        // Redis Save Code Logic
        socket.on(ACTIONS.SAVE_CODE, async ({ roomId, code, language }) => {
            if (roomHostMap[roomId] !== socket.id) {
                socket.emit('save_error', { message: 'Only the room maker can save the code.' });
                return;
            }

            try {
                // Save to Redis with 24 hr (86400 seconds) expiration
                await redis.set(`roomId:${roomId}`, JSON.stringify({ code, language }), 'EX', 86400);
                socket.emit('save_success', { message: 'Code space saved securely for 24 hours!' });
            } catch (err) {
                console.error("Redis Save Error:", err);
                socket.emit('save_error', { message: 'Failed to save code space.' });
            }
        });

        socket.on("disconnecting", () => {
            const rooms = [...socket.rooms];

            rooms.forEach((roomId) => {
                socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
                    socketId: socket.id,
                    username: userSocketMap[socket.id],
                });

                // If host disconnects, ideally we should reassign or clear, but we leave it for now
                if (roomHostMap[roomId] === socket.id) {
                    // host left
                    // delete roomHostMap[roomId];
                }
            });

            delete userSocketMap[socket.id];
        });
    });
};

module.exports = socketManager;

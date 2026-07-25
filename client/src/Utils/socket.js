import { io } from "socket.io-client";

let socket = null;

export const initSocket = () => {
  // If socket exists but is disconnected, destroy it so we create a fresh one
  if (socket && !socket.connected && !socket.active) {
    socket.removeAllListeners();
    socket = null;
  }

  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: false, // we manually connect so we can attach listeners first
    });
  }

  return socket;
};
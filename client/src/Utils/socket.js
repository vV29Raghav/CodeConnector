import {io} from "socket.io-client";
let socket = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(process.env.REACT_APP_SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });
  }
  return socket;
};
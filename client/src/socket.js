import {io} from "socket.io-client";

export const initSocket = async () => {
  const options = {
    'force new connection': true,
    reconnectionAttempts: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };
  return new io(process.env.REACT_APP_SOCKET_URL, options); //return promise of socket instance
}

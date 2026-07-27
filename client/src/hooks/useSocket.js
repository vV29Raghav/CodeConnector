import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import { useNavigate } from 'react-router-dom';

export const useSocket = (roomId, username, handlers) => {
    const [socket, setSocket] = useState(null);
    const navigate = useNavigate();
    const handlersRef = useRef(handlers);

    // Update handlers ref when handlers change
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        let socketInstance;

        const init = async () => {
            try {
                socketInstance = await initSocket();
                setSocket(socketInstance);

                function handleErrors(e) {
                    console.error('Socket error', e);
                    toast.error('Socket connection failed, try again later.');
                    navigate('/');
                }

                socketInstance.on('connect_error', handleErrors);
                socketInstance.on('connect_failed', handleErrors);

                // Join the room
                socketInstance.emit(ACTIONS.JOIN, {
                    roomId,
                    username,
                });

                // Event Listeners using ref to avoid re-attaching
                socketInstance.on(ACTIONS.JOINED, (data) => handlersRef.current.onJoined?.(data));
                socketInstance.on(ACTIONS.LANGUAGE_CHANGE, (data) => handlersRef.current.onLanguageChange?.(data));
                socketInstance.on(ACTIONS.CODE_CHANGE, (data) => handlersRef.current.onCodeChange?.(data));
                socketInstance.on(ACTIONS.SYNC_RUNNING, (data) => handlersRef.current.onSyncRunning?.(data));
                socketInstance.on(ACTIONS.SYNC_OUTPUT, (data) => handlersRef.current.onSyncOutput?.(data));
                socketInstance.on(ACTIONS.DISCONNECTED, (data) => handlersRef.current.onDisconnected?.(data));

            } catch (err) {
                console.error('Socket initialization failed', err);
                toast.error('Failed to connect to the server');
                navigate('/');
            }
        };

        if (roomId && username) {
            init();
        }

        return () => {
            if (socketInstance) {
                socketInstance.disconnect();
            }
        };
    }, [roomId, username, navigate]);

    return socket;
};

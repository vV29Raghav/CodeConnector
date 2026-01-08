import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import { useNavigate } from 'react-router-dom';

export const useSocket = (roomId, username, handlers) => {
    const socketRef = useRef(null);
    const effectRan = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (effectRan.current) return;
        effectRan.current = true;

        const init = async () => {
            socketRef.current = await initSocket();

            function handleErrors(e) {
                console.log('Socket error', e);
                toast.error('Socket connection failed, try again later.');
                navigate('/');
            }

            socketRef.current.on('connect_error', handleErrors);
            socketRef.current.on('connect_failed', handleErrors);

            // Join the room
            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username,
            });

            // Event Listeners
            socketRef.current.on(ACTIONS.JOINED, handlers.onJoined);
            socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, handlers.onLanguageChange);
            socketRef.current.on(ACTIONS.CODE_CHANGE, handlers.onCodeChange);
            socketRef.current.on(ACTIONS.SYNC_RUNNING, handlers.onSyncRunning);
            socketRef.current.on(ACTIONS.SYNC_OUTPUT, handlers.onSyncOutput);
            socketRef.current.on(ACTIONS.DISCONNECTED, handlers.onDisconnected);
        };

        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.off('connect_error');
                socketRef.current.off('connect_failed');
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
                socketRef.current.off(ACTIONS.CODE_CHANGE);
                socketRef.current.off(ACTIONS.SYNC_RUNNING);
                socketRef.current.off(ACTIONS.SYNC_OUTPUT);
                socketRef.current.disconnect();
            }
        };
    }, [roomId, username, navigate]);

    return socketRef;
};

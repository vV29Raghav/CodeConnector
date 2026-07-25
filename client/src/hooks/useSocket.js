import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import { useNavigate } from 'react-router-dom';

export const useSocket = (roomId, username, handlers) => {
    const [socket, setSocket] = useState(null);
    const navigate = useNavigate();
    const handlersRef = useRef(handlers);

    // Keep handlers ref always up to date without re-running the socket effect
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    useEffect(() => {
        if (!roomId || !username) return;

        const socketInstance = initSocket();
        let attempt = 0;
        let cleanedUp = false;

        // ── Error handler ──────────────────────────────────────────────────
        function handleErrors(e) {
            if (cleanedUp) return;
            console.error('Socket error', e);
            attempt++;
            if (attempt === 1) {
                toast('Waking up the server… Please wait up to a minute.', {
                    icon: '⏳',
                    duration: 15000,
                    id: 'wakeup-toast',
                });
            }
            if (attempt > 8) {
                cleanedUp = true;
                toast.dismiss('wakeup-toast');
                toast.error('Could not connect to the server. Please try again.');
                navigate('/');
            }
        }

        // ── Connect handler – fires every time socket connects ─────────────
        function handleConnect() {
            if (cleanedUp) return;
            toast.dismiss('wakeup-toast');
            // Dismiss the loading screen in EditorPage
            handlersRef.current.onConnect?.();
            // Emit JOIN only after confirmed connection
            socketInstance.emit(ACTIONS.JOIN, { roomId, username });
        }

        // ── Register ALL listeners BEFORE calling connect() ────────────────
        socketInstance.on('connect', handleConnect);
        socketInstance.on('connect_error', handleErrors);
        socketInstance.on('connect_failed', handleErrors);

        socketInstance.on(ACTIONS.JOINED, (data) => {
            if (cleanedUp) return;
            // Safety net: also dismiss loading screen when JOINED arrives
            handlersRef.current.onConnect?.();
            handlersRef.current.onJoined?.(data);
        });
        socketInstance.on(ACTIONS.LANGUAGE_CHANGE, (data) => {
            if (!cleanedUp) handlersRef.current.onLanguageChange?.(data);
        });
        socketInstance.on(ACTIONS.CODE_CHANGE, (data) => {
            if (!cleanedUp) handlersRef.current.onCodeChange?.(data);
        });
        socketInstance.on(ACTIONS.SYNC_RUNNING, (data) => {
            if (!cleanedUp) handlersRef.current.onSyncRunning?.(data);
        });
        socketInstance.on(ACTIONS.SYNC_OUTPUT, (data) => {
            if (!cleanedUp) handlersRef.current.onSyncOutput?.(data);
        });
        socketInstance.on('sync_input', (data) => {
            if (!cleanedUp) handlersRef.current.onSyncInput?.(data);
        });
        socketInstance.on(ACTIONS.DISCONNECTED, (data) => {
            if (!cleanedUp) handlersRef.current.onDisconnected?.(data);
        });

        // ── Now connect (or immediately join if already connected) ──────────
        if (socketInstance.connected) {
            handleConnect();
        } else {
            socketInstance.connect();
        }

        setSocket(socketInstance);

        // ── Cleanup on unmount ─────────────────────────────────────────────
        return () => {
            cleanedUp = true;
            toast.dismiss('wakeup-toast');
            socketInstance.off('connect', handleConnect);
            socketInstance.off('connect_error', handleErrors);
            socketInstance.off('connect_failed', handleErrors);
            socketInstance.off(ACTIONS.JOINED);
            socketInstance.off(ACTIONS.LANGUAGE_CHANGE);
            socketInstance.off(ACTIONS.CODE_CHANGE);
            socketInstance.off(ACTIONS.SYNC_RUNNING);
            socketInstance.off(ACTIONS.SYNC_OUTPUT);
            socketInstance.off('sync_input');
            socketInstance.off(ACTIONS.DISCONNECTED);
            socketInstance.disconnect();
        };
    }, [roomId, username, navigate]);

    return socket;
};

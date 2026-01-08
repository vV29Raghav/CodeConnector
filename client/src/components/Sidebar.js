import React from 'react';
import Client from './Client';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ clients, roomId }) => {
    const navigate = useNavigate();

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        navigate('/');
    }

    return (
        <div className='aside'>
            <div className='asideInner'>
                <div className='logo'>
                    <img className='logoImage' src="/Logo.gif" alt="code-sync-logo" />
                </div>
                <h3 className='connectedText'>Connected</h3>
                <div className='clientsList'>
                    {clients.map((client) => (
                        <Client
                            key={client.socketId}
                            username={client.username}
                        />
                    ))}
                </div>
            </div>
            <button className='btn copyBtn' onClick={copyRoomId}>Copy ROOM ID</button>
            <button className='btn leaveBtn' onClick={leaveRoom}>Leave</button>
        </div>
    );
};

export default Sidebar;

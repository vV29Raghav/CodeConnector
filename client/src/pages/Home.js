import React, { useState } from 'react';
import { v4 as uuidV4 } from 'uuid';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SignInButton, UserButton, SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import { useEffect, useRef } from 'react';

const Home = () => {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [savedRooms, setSavedRooms] = useState([]);
  const { isSignedIn, user } = useUser();
  const socketRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      if (isSignedIn && user) {
        socketRef.current = await initSocket();
        socketRef.current.emit(ACTIONS.GET_USER_ROOMS, { userId: user.id });
        socketRef.current.on(ACTIONS.USER_ROOMS_LIST, ({ roomIds }) => {
          setSavedRooms(roomIds);
        });
        socketRef.current.on(ACTIONS.ROOM_DELETED, ({ roomId }) => {
          setSavedRooms((prev) => prev.filter(id => id !== roomId));
          toast.success('Codespace deleted');
        });
      }
    };
    init();

    return () => {
      const socket = socketRef.current;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isSignedIn, user]);

  //This will create new room id using uuid
  const createNewListener = (e) => {
    e.preventDefault();
    const id = uuidV4();
    setRoomId(id);
    toast.success('Created a new room');
  }

  //This will join the room
  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error('ROOM ID & USERNAME is required');
      return;
    }

    //Redirecting to editor page
    navigate(`/editor/${roomId}`, {
      state: {
        username,//Here state is used to pass data to another route
      }
    });
  }

  //This will handle enter key press
  const handleInputEnter = (e) => {
    if (e.code === 'Enter') {
      joinRoom();
    }
  }

  const deleteRoom = (id) => {
    if (window.confirm(`Delete saved codespace for room ${id}?`)) {
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.DELETE_ROOM, { roomId: id, userId: user.id });
      }
    }
  }

  return (
    <div className='homePageWrapper'>
      <div className='formWrapper'>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn joinBtn" style={{ width: 'auto', padding: '5px 15px' }}>Sign In</button>
            </SignInButton>
          </SignedOut>
        </div>
        <img className='homePageLogo' src="/Logo.gif" alt="code-sync-logo" />
        <h4 className='mainLabel'>Paste Invitation ROOM ID</h4>
        <div className='inputGroup'>
          <input type="text" className='inputBox' placeholder='ROOM ID' value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={handleInputEnter} />
          <input type="text" className='inputBox' placeholder='USERNAME' value={username} onChange={(e) => setUsername(e.target.value)} onKeyUp={handleInputEnter} />
          <button className='btn joinBtn' onClick={joinRoom}>Join</button>
          <span className='createInfo'>If you don't have an invite then create &nbsp;
            <button onClick={createNewListener} className='createNewBtn' style={{ background: 'none', border: 'none', color: '#4aed88', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>new room</button>
          </span>
        </div>

        <SignedIn>
          {savedRooms.length > 0 && (
            <div className='savedRoomsWrapper'>
              <h5 className='savedRoomsLabel'>Your Saved Codespaces (24h)</h5>
              <div className='savedRoomsList'>
                {savedRooms.map((id) => (
                  <div key={id} className='savedRoomItem'>
                    <span className='savedRoomId' onClick={() => { setRoomId(id); setUsername(user.username || user.fullName || '') }}>{id}</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button className='btn joinBtn small' onClick={() => { setRoomId(id); setUsername(user.username || user.fullName || '') }} style={{ width: 'auto', padding: '2px 8px', fontSize: '12px' }}>Pick</button>
                      <button className='btn deleteBtn small' onClick={() => deleteRoom(id)} style={{ width: 'auto', padding: '2px 8px', fontSize: '12px', backgroundColor: '#dc2626' }}>X</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SignedIn>
      </div>
      <footer>
        <h4>Built with 💛 by <a href="https://github.com/vV29Raghav">Raghav Verma</a></h4>
      </footer>
    </div>
  )
}

export default Home

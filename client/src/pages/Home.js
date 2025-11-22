import React, { useState } from 'react';
import {v4 as uuidV4} from 'uuid';
import {toast} from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  //This will create new room id using uuid
  const createNewListener = (e) => {
    e.preventDefault();
    const id = uuidV4();
    setRoomId(id);
    toast.success('Created a new room');
  }

  //This will join the room
  const joinRoom = () => {
    if(!roomId || !username){
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
    if(e.code === 'Enter'){
      joinRoom();
    }
  }

  return (
    <div className='homePageWrapper'>
      <div className='formWrapper'>
        <img className='homePageLogo' src="/Logo.gif" alt="code-sync-logo" />
        <h4 className='mainLabel'>Paste Invitation ROOM ID</h4>
        <div className='inputGroup'>
          <input type="text" className='inputBox' placeholder='ROOM ID' value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyUp={handleInputEnter}/>
          <input type="text" className='inputBox' placeholder='USERNAME' value={username} onChange={(e) => setUsername(e.target.value)} onKeyUp={handleInputEnter}/>
          <button className='btn joinBtn' onClick={joinRoom}>Join</button>
          <span className='createInfo'>If you don't have an invite then create &nbsp;
            <a onClick={createNewListener} href='' className='createNewBtn'>new room</a>
          </span>
        </div>
      </div>
      <footer>
        <h4>Built with 💛 by <a href = "https://github.com/vV29Raghav">Raghav Verma</a></h4>
      </footer>
    </div>
  )
}

export default Home

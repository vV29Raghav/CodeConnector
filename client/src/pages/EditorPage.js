import React, {useState, useRef, useEffect, use} from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../socket';
import ACTIONS from '../Actions';


const EditorPage = () => {

  const socketRef = useRef(null); //Stop multiple rerenders when data updates means it holds mutable data
  const location = useLocation();
  const reactNavigator = useNavigate();
  const {roomId} = useParams();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();  //Promise come here from socket.js where initSocket is async function

      function  handleErrors(e) {
        console.log('Socket error', e);
        toast.error('Socket connection failed, try again later.');
        reactNavigator('/'); //Redirect to home page
      }
      socketRef.current.on('connect_error', handleErrors);
      socketRef.current.on('connect_failed', handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username : location.state?.username,
      });

      //Listening for joined event from server
      socketRef.current.on(ACTIONS.JOINED, ({clients, username, socketId}) =>{
        if(username !== location.state?.username) {  //to notify other except self
          toast.success(`${username} joined the room.`);
          // console.log(`${username} joined`);
        }
        setClients(clients);
      })

      //Listening for disconnected event from server
      socketRef.current.on(ACTIONS.DISCONNECTED, ({socketId, username}) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter(client => client.socketId !== socketId);//filtering the list by removing the disconnected client
        })
      });

    }

    init();

    //Here on is the listener and we need to clean up the event listeners when component unmounts always(to avoid memory leaks)
    return () => {
      socketRef.current.disconnect();
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
    }
    
  }, []);

  

  if(!location.state) {
    return <Navigate to="/"/>;
  }

  return (
    <div className='mainWrap'>
      <div className='aside'>
        <div className='asideInner'>
          <div className='logo'>
            <img className='logoImage' src="/Logo.gif" alt="code-sync-logo" />
          </div>
          <h3 className='connectedText'>Connected</h3>
          <div className='clientsList'>
            {clients.map((client) => (
              <Client username={client.username} key={client.socketId}/>
            ))}
          </div>
        </div>
        <button className='btn copyBtn'>Copy ROOM ID</button>
        <button className='btn leaveBtn'>Leave</button>
      </div>
      <div className='editorWrap'>
        <Editor />
      </div>
    </div>
  )
}

export default EditorPage

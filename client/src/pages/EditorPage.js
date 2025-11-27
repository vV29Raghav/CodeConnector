import React, {useState, useRef, useEffect, use} from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import Dropdown from 'react-bootstrap/Dropdown';
import play from '../assets/play.png';
import file from '../assets/file.png';
import { LANGUAGE_VERSIONS } from '../Utils/constants';


const EditorPage = () => {

  const socketRef = useRef(null); //Stop multiple rerenders when data updates means it holds mutable data
  const effectRan = useRef(false); //For solving StrictMode useEffect double call issue in dev mode
  const codeRef = useRef(null); //for code synchronization
  const location = useLocation();
  const reactNavigator = useNavigate();
  const {roomId} = useParams();
  const [clients, setClients] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("Java");

  useEffect(() => {
    if(effectRan.current) return; //To solve StrictMode useEffect double call issue in dev mode
    effectRan.current = true;
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
        }
        setClients(clients);
        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          socketId,
          code: codeRef.current,
        });
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
      if(socketRef.current) {
      socketRef.current.off('connect_error');
      socketRef.current.off('connect_failed');
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.disconnect();
      }
    }

  }, [roomId, reactNavigator, location.state]);

  //Copy roomID function
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success('Room ID has been copied to your clipboard');
    } catch (err) {
      toast.error('Could not copy the Room ID');
      console.error(err);
    }
  }

  //Leave room function
  async function leaveRoom() {
    reactNavigator('/');
  }

  if(!location.state) {
    return <Navigate to="/"/>;
  }

  //Dropdown select handler
  

  const handleSelect = (eventKey) => {
    setSelectedLanguage(eventKey);
  };


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
        <button className='btn copyBtn' onClick={copyRoomId}>Copy ROOM ID</button>
        <button className='btn leaveBtn' onClick={leaveRoom}>Leave</button>
      </div>
      <div className='editorWrap'>
        <div className='editorHeader'>
          <Dropdown onSelect={handleSelect}>
            <Dropdown.Toggle variant="success" id="dropdown-language">
              {selectedLanguage || "Select Java"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item eventKey="Javascript">Javascript</Dropdown.Item>
              <Dropdown.Item eventKey="C++">C++</Dropdown.Item>
              <Dropdown.Item eventKey="Python">Python</Dropdown.Item>
              <Dropdown.Item eventKey="Java">Java</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <button className='btn addNew' ><img src={file} alt="File Icon" className='runImage'/>Add New</button>
          <button className='btn run' ><img src={play} alt="Run Icon" className='runImage'/>Run Code</button>
        </div>
        
       <Editor socketRef={socketRef} roomId={roomId} onCodeChange= {(code) => {codeRef.current = code}} selectedLanguage={selectedLanguage}/>
      </div>
    </div>
  )
}

export default EditorPage

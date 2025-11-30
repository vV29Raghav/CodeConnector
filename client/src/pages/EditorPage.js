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
import { LANGUAGE_VERSIONS } from '../Utils/constants.js';


const EditorPage = () => {

  const socketRef = useRef(null); //Stop multiple rerenders when data updates means it holds mutable data
  const effectRan = useRef(false); //For solving StrictMode useEffect double call issue in dev mode
  const codeRef = useRef(null); //for code synchronization
  const location = useLocation();
  const reactNavigator = useNavigate();
  const {roomId} = useParams();
  const [clients, setClients] = useState([]);

  const [selectedLanguage, setSelectedLanguage] = useState("Java");
  const [codeSnippet, setCodeSnippet] = useState(LANGUAGE_VERSIONS["Java"].snippet || '');

  const [output, setOutput] = useState('Run code to see output here...');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(effectRan.current) return; //To solve StrictMode useEffect double call issue in dev mode
    effectRan.current = true;
    const init = async () => {
    socketRef.current = await initSocket();  //Promise come here from socket.js where initSocket is async function

      function  handleErrors(e) {
        console.log('Socket error', e);
        toast.error('Socket connection failed, try again later.');
        reactNavigator('/');
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
          language: selectedLanguage,
        });
      })

      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({language, code}) => {
        if(language !== selectedLanguage) {
          setSelectedLanguage(language);
          setCodeSnippet(code);
          codeRef.current = code;
          toast.success(`Language changed to ${language} by host`);
        }
      });

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
      socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
      socketRef.current.disconnect();
      }
    }

  }, [roomId, reactNavigator, location.state]);

  const handleSelect = (eventKey) => {
    const newSnippet = LANGUAGE_VERSIONS[eventKey]?.snippet || "";
    
    // 1. Update states
    setSelectedLanguage(eventKey);
    setCodeSnippet(newSnippet);
    codeRef.current = newSnippet;

    // 2. Broadcast the new snippet to all connected clients
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.CODE_CHANGE, {
        roomId,
        code: newSnippet,
      });
    }

    socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
      roomId,
      language: eventKey,
      code: newSnippet,
    });
    toast.success(`Language changed to ${eventKey}`);
  };

  //Run code fucntionality
  async function runCode() { 
    const currentCode = codeRef.current || codeSnippet;
    const language = selectedLanguage;

    if(!currentCode) {
      toast.error('Code editor is empty!');
      return;
    }

    setLoading(true);
    setOutput('Running code...');

    try {
      
      console.log("Running code: 1", {language, currentCode});
      const response = await fetch('http://localhost:5000/run-code', {
        
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: currentCode, language }),
      });
      console.log("Running code: 2", {language, currentCode});

      const data = await response.json();
      if(response.ok) {
        setOutput(data.output);
        toast.success('Code executed successfully!');
      }
      else {
        setOutput(data.error || 'Error executing code');
        toast.error('Error executing code');
      }
      console.log("Running code: 3", {language, currentCode});
    } catch (error) {
      setOutput('Error running code');
      console.error('Error running code:', error);
      toast.error('Error running code');
    } finally {
      setLoading(false);
    }
  }

  



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
              {selectedLanguage || "Java"}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {Object.keys(LANGUAGE_VERSIONS).map((lang) => (
                <Dropdown.Item eventKey={lang} key={lang}>{lang}</Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <button className='btn addNew' ><img src={file} alt="File Icon" className='runImage'/>Add New</button>
          <button className='btn run' onClick={runCode} disabled={loading}><img src={play} alt="Run Icon" className='runImage'/>{loading ? 'Running...' : 'Run Code'}</button>
        </div>
        
       <Editor socketRef={socketRef} roomId={roomId} onCodeChange= {(code) => {codeRef.current = code}} selectedLanguage={selectedLanguage} codeSnippet={codeSnippet} />

        <div className='outWindow'>
          <h4>Output:</h4>
          <pre className='output-text'>{output}</pre>
        </div>
      </div>
    </div>
  )
}

export default EditorPage;

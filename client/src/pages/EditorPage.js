import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import Client from '../components/Client';
import Editor from '../components/Editor';
import { initSocket } from '../Utils/socket';
import ACTIONS from '../Utils/Actions';
import Dropdown from 'react-bootstrap/Dropdown';
import play from '../assets/play.png';
import { LANGUAGE_VERSIONS } from '../Utils/constants.js';
import { useUser, UserButton } from '@clerk/clerk-react';


const EditorPage = () => {

  const socketRef = useRef(null); //Stop multiple rerenders when data updates means it holds mutable data
  const effectRan = useRef(false); //For solving StrictMode useEffect double call issue in dev mode
  const codeRef = useRef(null); //for code synchronization
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const [clients, setClients] = useState([]);

  const [selectedLanguage, setSelectedLanguage] = useState("Java");
  const [codeSnippet, setCodeSnippet] = useState(LANGUAGE_VERSIONS["Java"].snippet || '');

  const [output, setOutput] = useState('Run code to see output here...');
  const [loading, setLoading] = useState(false);
  const [currentUserInfo, setCurrentUserInfo] = useState({ isAdmin: false, canRunCode: false });
  const { isSignedIn, user } = useUser();
  const languageRef = useRef(selectedLanguage);
  const userInfoRef = useRef(currentUserInfo);

  useEffect(() => {
    languageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    userInfoRef.current = currentUserInfo;
  }, [currentUserInfo]);

  useEffect(() => {
    if (effectRan.current) return; //To solve StrictMode useEffect double call issue in dev mode
    effectRan.current = true;
    const init = async () => {
      socketRef.current = await initSocket();  //Promise come here from socket.js where initSocket is async function

      function handleErrors(e) {
        console.log('Socket error', e);
        toast.error('Socket connection failed, try again later.');
        reactNavigator('/');
      }
      socketRef.current.on('connect_error', handleErrors);
      socketRef.current.on('connect_failed', handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      //Listening for joined event from server
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== location.state?.username) {  //to notify other except self
          toast.success(`${username} joined the room.`);

          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            socketId,
            code: codeRef.current,
            language: languageRef.current,
          });
        }
        setClients(clients);

        // Update current user info
        const me = clients.find(c => c.username === location.state?.username);
        if (me) {
          setCurrentUserInfo({ isAdmin: me.isAdmin, canRunCode: me.permissions.canRunCode });
        }
      })

      socketRef.current.on(ACTIONS.ROOM_FULL, ({ message }) => {
        toast.error(message);
        reactNavigator('/');
      });

      socketRef.current.on(ACTIONS.AUTHORITY_CHANGED, ({ clients }) => {
        setClients(clients);
        const me = clients.find(c => c.username === location.state?.username);
        if (me) {
          const oldCanRun = userInfoRef.current.canRunCode;
          const newCanRun = me.permissions.canRunCode;
          setCurrentUserInfo({ isAdmin: me.isAdmin, canRunCode: newCanRun });

          if (oldCanRun !== newCanRun) {
            toast(newCanRun ? '🔓 You now have authority to run code!' : '🔒 Your run authority has been revoked.', {
              icon: newCanRun ? '✅' : '🚫',
            });
          }
        }
      });

      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language, code }) => {
        if (language !== languageRef.current) {
          setSelectedLanguage(language);
          setCodeSnippet(code);
          codeRef.current = code;
          toast.success(`Language changed to ${language} by host`);
        }
      });

      socketRef.current.on(ACTIONS.SYNC_RUNNING, ({ isRunning }) => {
        setLoading(isRunning);
        if (isRunning) {
          setOutput('Running code...');
        }
      });

      socketRef.current.on(ACTIONS.SYNC_OUTPUT, ({ output }) => {
        setOutput(output);
        if (output !== 'Running code...') {
          toast.success('Code execution finished on another client!');
        }
      });

      socketRef.current.on(ACTIONS.ROOM_SAVED, ({ message }) => {
        toast.success(message, { id: 'save-toast' });
      });

      socketRef.current.on(ACTIONS.ROOM_SAVE_ERROR, ({ message }) => {
        toast.error(message, { id: 'save-toast' });
      });

      socketRef.current.on(ACTIONS.ROOM_DELETED, ({ message }) => {
        toast.success(message, { id: 'save-toast' });
      });

      //Listening for disconnected event from server
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter(client => client.socketId !== socketId);//filtering the list by removing the disconnected client
        })
      });
    }

    init();

    //Here on is the listener and we need to clean up the event listeners when component unmounts always(to avoid memory leaks)
    return () => {
      const socket = socketRef.current;
      if (socket) {
        socket.off('connect_error');
        socket.off('connect_failed');
        socket.off(ACTIONS.JOINED);
        socket.off(ACTIONS.DISCONNECTED);
        socket.off(ACTIONS.LANGUAGE_CHANGE);
        socket.off(ACTIONS.SYNC_RUNNING);
        socket.off(ACTIONS.SYNC_OUTPUT);
        socket.off(ACTIONS.AUTHORITY_CHANGED);
        socket.off(ACTIONS.ROOM_FULL);
        socket.disconnect();
      }
    }

  }, [roomId, reactNavigator, location.state, setClients, setCurrentUserInfo, setLoading, setOutput, setSelectedLanguage, setCodeSnippet]);

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
    if (!currentUserInfo.canRunCode) {
      toast.error('You do not have authority to run code. Please ask the admin.');
      return;
    }

    const currentCode = codeRef.current || codeSnippet;
    const language = selectedLanguage;

    if (!currentCode) {
      toast.error('Code editor is empty!');
      return;
    }

    setLoading(true);
    setOutput('Running code...');

    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.SYNC_RUNNING, {
        roomId,
        isRunning: true,
      });
    }

    try {

      console.log("Running code: 1", { language, currentCode });
      const response = await fetch('http://localhost:5000/run-code', {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: currentCode, language }),
      });
      console.log("Running code: 2", { language, currentCode });

      const data = await response.json();
      const finalOutput = response.ok ? data.output : (data.error || 'Error executing code');

      setOutput(finalOutput);

      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SYNC_OUTPUT, {
          roomId,
          output: finalOutput,
        });
        socketRef.current.emit(ACTIONS.SYNC_RUNNING, {
          roomId,
          isRunning: false,
        });
      }

      if (response.ok) {
        toast.success('Code executed successfully!');
      }
      else {
        toast.error('Error executing code');
      }
      console.log("Running code: 3", { language, currentCode });
    } catch (error) {
      setOutput('Error running code');
      console.error('Error running code:', error);
      toast.error('Error running code');
    } finally {
      setLoading(false);
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SYNC_RUNNING, {
          roomId,
          isRunning: false,
        });
      }
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

  const toggleAuthority = (targetSocketId, currentAuthority) => {
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.REQUEST_AUTHORITY, {
        roomId,
        targetSocketId,
        canRunCode: !currentAuthority,
      });
    }
  };

  const saveCodespace = () => {
    if (!isSignedIn) {
      toast.error('You must be signed in to save the codespace.');
      return;
    }
    if (!currentUserInfo.isAdmin) {
      toast.error('Only the room admin can save the codespace.');
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.SAVE_ROOM, {
        roomId,
        code: codeRef.current || codeSnippet,
        language: selectedLanguage,
        userId: user.id,
      });
      toast.loading('Saving codespace...', { id: 'save-toast' });
    }
  };

  const deleteCodespace = () => {
    if (!isSignedIn) {
      toast.error('You must be signed in to delete the codespace.');
      return;
    }
    if (!currentUserInfo.isAdmin) {
      toast.error('Only the room admin can delete the codespace.');
      return;
    }

    if (window.confirm('Are you sure you want to delete the saved codespace? This cannot be undone.')) {
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.DELETE_ROOM, {
          roomId,
          userId: user.id,
        });
        toast.loading('Deleting codespace...', { id: 'save-toast' });
      }
    }
  };

  if (!location.state) {
    return <Navigate to="/" />;
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
              <Client
                username={client.username}
                key={client.socketId}
                isAdmin={client.isAdmin}
                canRunCode={client.permissions.canRunCode}
                isMe={client.username === location.state?.username}
                onToggleAuthority={() => toggleAuthority(client.socketId, client.permissions.canRunCode)}
                showControls={currentUserInfo.isAdmin && client.username !== location.state?.username}
              />
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
          <button
            className='btn run'
            onClick={runCode}
            disabled={loading || !currentUserInfo.canRunCode}
            style={{ opacity: (!currentUserInfo.canRunCode) ? 0.5 : 1, cursor: (!currentUserInfo.canRunCode) ? 'not-allowed' : 'pointer' }}
          >
            <img src={play} alt="Run Icon" className='runImage' />
            {loading ? 'Running...' : (currentUserInfo.canRunCode ? 'Run Code' : 'No Authority')}
          </button>

          {currentUserInfo.isAdmin && (
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                className='btn save'
                onClick={saveCodespace}
                disabled={!isSignedIn}
                title={isSignedIn ? 'Save Codespace for 24h' : 'Sign in to Save'}
                style={{ opacity: isSignedIn ? 1 : 0.5 }}
              >
                Save 24h
              </button>
              <button
                className='btn deleteBtn'
                onClick={deleteCodespace}
                disabled={!isSignedIn}
                title={isSignedIn ? 'Delete Saved Codespace' : 'Sign in to delete'}
                style={{ opacity: isSignedIn ? 1 : 0.5, backgroundColor: '#dc2626' }}
              >
                Delete Save
              </button>
            </div>
          )}

          <div style={{ marginLeft: '10px' }}>
            <UserButton />
          </div>
        </div>

        <Editor socketRef={socketRef} roomId={roomId} onCodeChange={(code) => { codeRef.current = code }} selectedLanguage={selectedLanguage} codeSnippet={codeSnippet} />

        <div className='outWindow'>
          <h4>Output:</h4>
          <pre className='output-text'>{output}</pre>
        </div>
      </div>
    </div>
  )
}

export default EditorPage;

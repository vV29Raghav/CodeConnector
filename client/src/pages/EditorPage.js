import React, { useState, useRef, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, Navigate, useParams } from 'react-router-dom';
import Editor from '../components/Editor';
import Sidebar from '../components/Sidebar';
import EditorHeader from '../components/EditorHeader';
import { useSocket } from '../hooks/useSocket';
import ACTIONS from '../Utils/Actions';
import { LANGUAGE_VERSIONS } from '../Utils/constants';
import { useAuth, useClerk } from '@clerk/clerk-react';

const EditorPage = () => {
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();
  const username = location.state?.username || localStorage.getItem('username') || 'Guest';

  const [clients, setClients] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("Java");
  const [codeSnippet, setCodeSnippet] = useState(LANGUAGE_VERSIONS["Java"].snippet || '');
  const [output, setOutput] = useState('Run code to see output here...');
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const latestSocket = useRef(null);

  // Define Handlers using useCallback to prevent re-creation
  const onJoined = useCallback(({ clients, username: joinedUsername, socketId, hostSocketId }) => {
    if (joinedUsername === username) {
      setIsHost(socketId === hostSocketId);
    }

    if (joinedUsername !== username) {
      toast.success(`${joinedUsername} joined the room.`);
      // Emit SYNC_CODE only if the current client is not the one who just joined
      // and if socket is available.
      if (latestSocket.current) {
        latestSocket.current.emit(ACTIONS.SYNC_CODE, {
          socketId,
          code: codeRef.current,
          language: selectedLanguage,
        });
      }
    }
    setClients(clients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, selectedLanguage]);

  const onLanguageChange = useCallback(({ language, code }) => {
    if (language !== selectedLanguage) {
      setSelectedLanguage(language);
      setCodeSnippet(code);
      codeRef.current = code;
      toast.success(`Language changed to ${language} by host`);
    }
  }, [selectedLanguage]);

  const onCodeChange = useCallback(({ code }) => {
    // Logic handled in Editor.js via direct socket
  }, []);

  const onSyncRunning = useCallback(({ isRunning }) => {
    setLoading(isRunning);
    if (isRunning) setOutput('Running code...');
  }, []);

  const onSyncOutput = useCallback(({ output }) => {
    setOutput(output);
    if (output !== 'Running code...') {
      toast.success('Code execution finished on another client!');
    }
  }, []);

  const onSyncInput = useCallback(({ inputData }) => {
    setInputData(inputData);
  }, []);

  const onDisconnected = useCallback(({ socketId, username }) => {
    toast.success(`${username} left the room.`);
    setClients((prev) => prev.filter(client => client.socketId !== socketId));
  }, []);

  // Handlers bundle for useSocket hook
  const handlers = useMemo(() => ({
    onJoined,
    onLanguageChange,
    onCodeChange,
    onSyncRunning,
    onSyncOutput,
    onSyncInput,
    onDisconnected
  }), [onJoined, onLanguageChange, onCodeChange, onSyncRunning, onSyncOutput, onSyncInput, onDisconnected]);

  const socket = useSocket(roomId, username, handlers);

  React.useEffect(() => {
    latestSocket.current = socket;
  }, [socket]);

  const handleSelectLanguage = (eventKey) => {
    const newSnippet = LANGUAGE_VERSIONS[eventKey]?.snippet || "";
    setSelectedLanguage(eventKey);
    setCodeSnippet(newSnippet);
    codeRef.current = newSnippet;

    if (socket) {
      socket.emit(ACTIONS.CODE_CHANGE, { roomId, code: newSnippet });
      socket.emit(ACTIONS.LANGUAGE_CHANGE, { roomId, language: eventKey, code: newSnippet });
    }
    toast.success(`Language changed to ${eventKey}`);
  };

  const { userId } = useAuth();
  const { openSignIn } = useClerk();

  async function runCode() {
    if (!userId) {
      toast.error('Please login to run code');
      openSignIn({ mode: 'modal', afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
      return;
    }

    const currentCode = codeRef.current !== null ? codeRef.current : codeSnippet;
    const language = selectedLanguage;

    if (!currentCode || typeof currentCode !== 'string' || !currentCode.trim()) {
      toast.error('Code cannot be empty');
      setOutput('Error: Code cannot be empty');
      return;
    }

    setLoading(true);
    setOutput('Running code...');
    if (socket) {
      socket.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: true });
    }

    try {
      const url = process.env.REACT_APP_RUN_CODE_URL;
      if (!url || !url.startsWith('http')) {
        throw new Error(`Invalid Run Code URL: "${url}". Please check your Vercel/local environment settings.`);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, language, input: inputData }),
      });

      const data = await response.json();
      const finalOutput = response.ok ? data.output : (data.error || 'Error executing code');
      setOutput(finalOutput);

      if (socket) {
        socket.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: finalOutput });
        socket.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: false });
      }

      if (response.ok) toast.success('Code executed successfully!');
      else toast.error('Error executing code');

    } catch (error) {
      setOutput('Error running code');
      toast.error('Error running code');
    } finally {
      setLoading(false);
      if (socket) {
        socket.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: false });
      }
    }
  }

  const saveCode = () => {
    if (!userId) {
      toast.error('Please login to save the code space');
      openSignIn({ mode: 'modal', afterSignInUrl: window.location.href, afterSignUpUrl: window.location.href });
      return;
    }
    if (socket) {
      socket.emit(ACTIONS.SAVE_CODE, {
        roomId,
        code: codeRef.current || codeSnippet,
        language: selectedLanguage,
      });
    }
  };

  React.useEffect(() => {
    if (socket) {
      const handleSaveSuccess = ({ message }) => toast.success(message);
      const handleSaveError = ({ message }) => toast.error(message);
      const handleLoadSavedCode = ({ code, language }) => {
        setSelectedLanguage(language);
        setCodeSnippet(code);
        codeRef.current = code;
        toast.success(`Loaded saved ${language} code space from 24h backup!`);
      };

      socket.on('save_success', handleSaveSuccess);
      socket.on('save_error', handleSaveError);
      socket.on('load_saved_code', handleLoadSavedCode);

      return () => {
        socket.off('save_success', handleSaveSuccess);
        socket.off('save_error', handleSaveError);
        socket.off('load_saved_code', handleLoadSavedCode);
      };
    }
  }, [socket, roomId]);

  if (!username) {
    return <Navigate to="/" />;
  }

  return (
    <div className='mainWrap'>
      <Sidebar
        clients={clients}
        roomId={roomId}
      />

      <div className='editorWrap'>
        <EditorHeader
          selectedLanguage={selectedLanguage}
          onSelectLanguage={handleSelectLanguage}
          runCode={runCode}
          saveCode={saveCode}
          loading={loading}
          isHost={isHost}
        />

        <Editor
          socket={socket}
          roomId={roomId}
          onCodeChange={(code) => { codeRef.current = code }}
          selectedLanguage={selectedLanguage}
          codeSnippet={codeSnippet}
        />

        <div className='consoleWrap'>
          <div className='inWindow'>
            <h4>Input:</h4>
            <textarea
              className='input-textarea'
              value={inputData}
              onChange={(e) => {
                setInputData(e.target.value);
                if (socket) {
                  socket.emit('sync_input', { roomId, inputData: e.target.value });
                }
              }}
              placeholder='Enter standard input (STDIN) here...'
            ></textarea>
          </div>
          <div className='outWindow'>
            <h4>Output:</h4>
            <pre className='output-text'>{output}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditorPage;

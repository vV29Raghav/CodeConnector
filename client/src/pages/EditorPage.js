import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, Navigate, useParams } from 'react-router-dom';
import Editor from '../components/Editor';
import Sidebar from '../components/Sidebar';
import EditorHeader from '../components/EditorHeader';
import { useSocket } from '../hooks/useSocket';
import ACTIONS from '../Utils/Actions';
import { LANGUAGE_VERSIONS } from '../Utils/constants';

const EditorPage = () => {
  const codeRef = useRef(null);
  const location = useLocation();
  const { roomId } = useParams();

  const [clients, setClients] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("Java");
  const [codeSnippet, setCodeSnippet] = useState(LANGUAGE_VERSIONS["Java"].snippet || '');
  const [output, setOutput] = useState('Run code to see output here...');
  const [loading, setLoading] = useState(false);

  // Define Handlers using useCallback to prevent re-creation
  const onJoined = useCallback(({ clients, username, socketId }) => {
    if (username !== location.state?.username) {
      toast.success(`${username} joined the room.`);
      // Emit SYNC_CODE only if the current client is not the one who just joined
      // and if socketRef.current is available.
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          socketId,
          code: codeRef.current,
          language: selectedLanguage,
        });
      }
    }
    setClients(clients);
  }, [location.state?.username, selectedLanguage]);

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

  const onDisconnected = useCallback(({ socketId, username }) => {
    toast.success(`${username} left the room.`);
    setClients((prev) => prev.filter(client => client.socketId !== socketId));
  }, []);

  // Handlers bundle for useSocket hook
  const handlers = {
    onJoined,
    onLanguageChange,
    onCodeChange,
    onSyncRunning,
    onSyncOutput,
    onDisconnected
  };

  const socketRef = useSocket(roomId, location.state?.username, handlers);

  const handleSelectLanguage = (eventKey) => {
    const newSnippet = LANGUAGE_VERSIONS[eventKey]?.snippet || "";
    setSelectedLanguage(eventKey);
    setCodeSnippet(newSnippet);
    codeRef.current = newSnippet;

    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.CODE_CHANGE, { roomId, code: newSnippet });
      socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, { roomId, language: eventKey, code: newSnippet });
    }
    toast.success(`Language changed to ${eventKey}`);
  };

  async function runCode() {
    const currentCode = codeRef.current || codeSnippet;
    const language = selectedLanguage;

    if (!currentCode) {
      toast.error('Code editor is empty!');
      return;
    }

    setLoading(true);
    setOutput('Running code...');
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: true });
    }

    try {
      const url = process.env.REACT_APP_RUN_CODE_URL;
      if (!url || !url.startsWith('http')) {
        throw new Error(`Invalid Run Code URL: "${url}". Please check your Vercel/local environment settings.`);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, language }),
      });

      const data = await response.json();
      const finalOutput = response.ok ? data.output : (data.error || 'Error executing code');
      setOutput(finalOutput);

      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SYNC_OUTPUT, { roomId, output: finalOutput });
        socketRef.current.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: false });
      }

      if (response.ok) toast.success('Code executed successfully!');
      else toast.error('Error executing code');

    } catch (error) {
      setOutput('Error running code');
      toast.error('Error running code');
    } finally {
      setLoading(false);
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SYNC_RUNNING, { roomId, isRunning: false });
      }
    }
  }

  if (!location.state) {
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
          loading={loading}
        />

        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => { codeRef.current = code }}
          selectedLanguage={selectedLanguage}
          codeSnippet={codeSnippet}
        />

        <div className='outWindow'>
          <h4>Output:</h4>
          <pre className='output-text'>{output}</pre>
        </div>
      </div>
    </div>
  )
}

export default EditorPage;

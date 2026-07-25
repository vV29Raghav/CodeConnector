import React, { useEffect, useRef } from "react";
import { toast } from 'react-hot-toast';
import Codemirror from "codemirror";
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/theme/dracula.css';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/python/python';
import 'codemirror/mode/javascript/javascript';
import ACTIONS from "../Utils/Actions";
import { LANGUAGE_VERSIONS } from "../Utils/constants";

const Editor = ({ socket, roomId, onCodeChange, selectedLanguage, codeSnippet }) => {

  const editorRef = useRef(null);
  const editorInitialized = useRef(false);
  const latestSocket = useRef(socket);

  useEffect(() => {
    latestSocket.current = socket;
  }, [socket]);

  useEffect(() => {
    if (editorInitialized.current) return; //To ensure editor is initialized only once
    editorInitialized.current = true;

    async function init() {
      editorRef.current = Codemirror.fromTextArea(document.getElementById("realTimeEditor"), {
        mode: { name: "java", json: true },
        theme: 'dracula',
        autocloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
        lineWrapping: false,
        matchBrackets: true,
        tabSize: 4,
        indentUnit: 4,
      });

      editorRef.current.on('change', (instance, changes) => {

        const { origin } = changes;
        const code = instance.getValue();

        onCodeChange(code); //Callback to update codeRef in EditorPage

        if (origin !== 'setValue' && latestSocket.current) {
          latestSocket.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
      });
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      console.log("Editor instance available:", !!editorRef.current);


      if (codeSnippet !== editorRef.current.getValue()) {
        editorRef.current.setValue(codeSnippet);
      }

      const mode = LANGUAGE_VERSIONS[selectedLanguage]?.mode;

      if (mode) {
        console.log("CodeMirror Mode set to:", mode);
        editorRef.current.setOption("mode", mode);
      }

    }
  }, [selectedLanguage, codeSnippet]);


  useEffect(() => {
    if (socket) {
      socket.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null && code !== editorRef.current.getValue()) {
          editorRef.current.setValue(code);
        }
      });
      socket.on(ACTIONS.LANGUAGE_CHANGE, () => { });//Passive listener to avoid errors

      return () => {
        socket.off(ACTIONS.CODE_CHANGE);
        socket.off(ACTIONS.LANGUAGE_CHANGE);
      }
    };
  }, [socket]);

  return (

    <textarea id="realTimeEditor"></textarea>

  );
};

export default Editor;

import React, { use, useEffect, useRef } from "react";
import Codemirror from "codemirror";
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/theme/dracula.css';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from "../Utils/Actions";

const Editor = ({socketRef, roomId, onCodeChange}) => {

  const editorRef = useRef(null);
  const editorInitialized = useRef(false);

  useEffect(() => {
    if(editorInitialized.current) return; //To ensure editor is initialized only once
    editorInitialized.current = true;

    async function init() {
      editorRef.current = Codemirror.fromTextArea(document.getElementById("realTimeEditor"), {
        mode: { name: "javascript", json: true },
        theme: 'dracula',
        autocloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      });

      editorRef.current.on('change', (instance, changes) => {
        
        const { origin } = changes;
        const code = instance.getValue();

        onCodeChange(code); //Callback to update codeRef in EditorPage

        if(origin !== 'setValue') {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
      });
    };

    init();
  }, []);

  useEffect(() => {
    if(socketRef.current) {
        socketRef.current.on(ACTIONS.CODE_CHANGE, ({code}) => {
          if(code !== null && code !==editorRef.current.getValue()) {
           editorRef.current.setValue(code);
          }
        });
      };
      return () => {
        if(!socketRef.current) return;
        socketRef.current.off(ACTIONS.CODE_CHANGE);
      }
  }, [socketRef.current]);

  return (
  
  <textarea id="realTimeEditor"></textarea>

);
};

export default Editor;

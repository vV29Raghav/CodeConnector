import React, { useEffect, useRef } from "react";
import Codemirror from "codemirror";
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/theme/dracula.css';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import ACTIONS from "../Actions";

const Editor = ({socketRef, roomId}) => {

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

        if(origin !== 'setValue') {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
          });
        }
      });



      if(socketRef.current != null) {
        socketRef.current.on(ACTIONS.CODE_CHANGE, ({code}) => {
          if(code !== null && code !==editorRef.current.getValue()) {
           editorRef.current.setValue(code);
          }
        });
      };
    };
    init();
    return () => {
      if(!socketRef.current) return;
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    }
  }, []);

  return <textarea id="realTimeEditor"></textarea>;
};

export default Editor;

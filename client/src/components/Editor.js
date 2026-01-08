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

const Editor = ({ socketRef, roomId, onCodeChange, selectedLanguage, codeSnippet }) => {

  const editorRef = useRef(null);
  const editorInitialized = useRef(false);

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
      });

      editorRef.current.on('beforeChange', (instance, change) => {
        if (change.origin === 'paste') {
          if (change.text.length > 2) {
            change.cancel();
            toast.error("You cannot paste more than 2 lines of code!");
          }
        }
      });

      editorRef.current.on('change', (instance, changes) => {

        const { origin } = changes;
        const code = instance.getValue();

        onCodeChange(code); //Callback to update codeRef in EditorPage

        if (origin !== 'setValue' && socketRef.current) {
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
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code }) => {
        if (code !== null && code !== editorRef.current.getValue()) {
          editorRef.current.setValue(code);
        }
      });
      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, () => { });//Passive listener to avoid errors
    };
    return () => {
      if (!socketRef.current) return;
      socketRef.current.off(ACTIONS.CODE_CHANGE);
      socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
    }
  }, [socketRef.current]);

  return (

    <textarea id="realTimeEditor"></textarea>

  );
};

export default Editor;

import React, { useEffect } from "react";
import Codemirror from "codemirror";
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/theme/dracula.css';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';

let editorInstance = null; // <-- prevent multiple editors

const Editor = () => {

  useEffect(() => {
    if (!editorInstance) {
      const textarea = document.getElementById("realTimeEditor");
      editorInstance = Codemirror.fromTextArea(textarea, {
        mode: { name: "javascript", json: true },
        theme: 'dracula',
        autocloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      });
    }
  }, []);

  return <textarea id="realTimeEditor"></textarea>;
};

export default Editor;

import React from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import play from '../assets/play.png';
import { LANGUAGE_VERSIONS } from '../Utils/constants.js';

const EditorHeader = ({ selectedLanguage, onSelectLanguage, runCode, loading }) => {
    return (
        <div className='editorHeader'>
            <Dropdown onSelect={onSelectLanguage}>
                <Dropdown.Toggle variant="success" id="dropdown-language">
                    {selectedLanguage || "Java"}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                    {Object.keys(LANGUAGE_VERSIONS).map((lang) => (
                        <Dropdown.Item eventKey={lang} key={lang}>{lang}</Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown>
            <button className='btn run' onClick={runCode} disabled={loading}>
                <img src={play} alt="Run Icon" className='runImage' />
                {loading ? 'Running...' : 'Run Code'}
            </button>
        </div>
    );
};

export default EditorHeader;

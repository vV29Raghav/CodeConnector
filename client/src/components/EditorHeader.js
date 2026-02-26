import React from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import play from '../assets/play.png';
import { LANGUAGE_VERSIONS } from '../Utils/constants.js';
import { UserButton, SignedIn } from '@clerk/clerk-react';

const EditorHeader = ({ selectedLanguage, onSelectLanguage, runCode, saveCode, loading, isHost }) => {
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
            {isHost && (
                <button className='btn saveBtn' onClick={saveCode} style={{ marginLeft: 'auto', marginRight: '10px', backgroundColor: '#e63946', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '5px', fontWeight: 'bold' }}>
                    Save for 24 hr
                </button>
            )}
            <button className='btn run' onClick={runCode} disabled={loading}>
                <img src={play} alt="Run Icon" className='runImage' />
                {loading ? 'Running...' : 'Run Code'}
            </button>
            <SignedIn>
                <div className="userIcon">
                    <UserButton afterSignOutUrl="/" />
                </div>
            </SignedIn>
        </div>
    );
};

export default EditorHeader;

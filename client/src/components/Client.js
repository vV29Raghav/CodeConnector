import React from 'react'
import Avatar from 'react-avatar';

const Client = ({ username, isAdmin, canRunCode, isMe, onToggleAuthority, showControls }) => {
  return (
    <div className='client'>
      <div className="avatar-wrapper">
        <Avatar name={username} size="40" round="14px" />
        {isAdmin && <span className="admin-badge" title="Room Admin">⭐</span>}
        {!canRunCode && <span className="lock-badge" title="No Run Authority">🔒</span>}
      </div>
      <span className='userName'>{username}{isMe ? ' (You)' : ''}</span>
      {showControls && (
        <button
          className={`auth-btn ${canRunCode ? 'revoke' : 'grant'}`}
          onClick={onToggleAuthority}
          title={canRunCode ? 'Revoke Authority' : 'Grant Authority'}
        >
          {canRunCode ? 'Revoke' : 'Grant'}
        </button>
      )}
    </div>
  )
}

export default Client

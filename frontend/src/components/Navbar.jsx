import React from 'react';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand-logo">
        <div className="brand-icon">⚡</div>
        <span>AI Task Processor</span>
      </div>
      {user && (
        <div className="user-nav">
          <div className="user-badge">
            <span>👤</span>
            <span>{user.name}</span>
          </div>
          <button className="btn-secondary" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
}

import React, { useState } from 'react';
import { authAPI, setAuthToken } from '../services/api';

export default function AuthPage({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await authAPI.login(email, password);
      } else {
        res = await authAPI.register(name, email, password);
      }
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container glass-panel">
      <h1 className="auth-title">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
      <p className="auth-subtitle">
        {isLogin ? 'Sign in to access your AI task processing dashboard' : 'Join the platform to run distributed AI operations'}
      </p>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!isLogin}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className="form-input"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
          {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#94a3b8' }}>
        {isLogin ? "Don't have an account?" : 'Already registered?'}
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#6366f1',
            fontWeight: 600,
            marginLeft: '0.5rem',
            cursor: 'pointer',
          }}
        >
          {isLogin ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
    </div>
  );
}

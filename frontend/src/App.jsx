import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import { authAPI, getAuthToken, removeAuthToken } from './services/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    authAPI
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        removeAuthToken();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}>
        Loading platform...
      </div>
    );
  }

  return (
    <div>
      <Navbar user={user} onLogout={handleLogout} />
      <main className="app-container">
        {!user ? <AuthPage onAuthSuccess={(userData) => setUser(userData)} /> : <DashboardPage />}
      </main>
    </div>
  );
}

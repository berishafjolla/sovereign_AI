import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import DataHolderDashboard from './components/DataHolder/DataHolderDashboard';
import ConsumerPortal from './components/Consumer/ConsumerPortal';
import AuditorDashboard from './components/Auditor/AuditorDashboard';
import AdminDashboard from './components/Admin/AdminDashboard';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('login'); // login|register
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sai_token');
    if (token) {
      api.me()
        .then(u => setUser(u))
        .catch(() => localStorage.removeItem('sai_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => setUser(userData);

  const handleLogout = () => {
    localStorage.removeItem('sai_token');
    setUser(null);
    setScreen('login');
  };

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
        <span>Loading SovereignAI...</span>
      </div>
    );
  }

  if (!user) {
    return screen === 'login'
      ? <Login onLogin={handleLogin} onSwitch={() => setScreen('register')} />
      : <Register onLogin={handleLogin} onSwitch={() => setScreen('login')} />;
  }

  const dashboards = {
    data_holder: <DataHolderDashboard user={user} onLogout={handleLogout} />,
    consumer: <ConsumerPortal user={user} onLogout={handleLogout} />,
    auditor: <AuditorDashboard user={user} onLogout={handleLogout} />,
    admin: <AdminDashboard user={user} onLogout={handleLogout} />,
  };

  return dashboards[user.role] || <div className="loading-center"><p>Unknown role: {user.role}</p></div>;
}

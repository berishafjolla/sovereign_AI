import React, { useState } from 'react';
import { api } from '../../api';

export default function Register({ onLogin, onSwitch }) {
  const [form, setForm] = useState({
    username: '', email: '', password: '', role: 'consumer', organization: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.register(form);
      const res = await api.login({ username: form.username, password: form.password });
      localStorage.setItem('sai_token', res.access_token);
      onLogin(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'data_holder', label: 'Data Holder', desc: 'Upload & govern datasets' },
    { value: 'consumer', label: 'Data Consumer', desc: 'Request & use data' },
    { value: 'auditor', label: 'Auditor', desc: 'Monitor compliance' },
  ];

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>SovereignAI</h1>
          <p>Create your account</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="grid-2" style={{ marginBottom: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Username</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="username" required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="6+ characters" required />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Organization (optional)</label>
            <input value={form.organization}
              onChange={e => setForm({ ...form, organization: e.target.value })}
              placeholder="Company / Institution" />
          </div>
          <div className="form-group">
            <label>Role</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roles.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  padding: '10px 14px', background: form.role === r.value
                    ? 'rgba(198,131,70,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${form.role === r.value ? 'rgba(198,131,70,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, transition: 'all 0.15s'
                }}>
                  <input type="radio" name="role" value={r.value}
                    checked={form.role === r.value}
                    onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ width: 'auto' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-switch">
          Already have an account? <a onClick={onSwitch}>Sign in</a>
        </div>
      </div>
    </div>
  );
}

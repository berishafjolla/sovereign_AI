import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { StatCard } from '../DataHolder/DataHolderDashboard';

export default function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, l] = await Promise.all([
        api.adminStats(), api.adminUsers(), api.auditLogs()
      ]);
      setStats(s); setUsers(u); setLogs(l);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const notify = (msg, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const toggleUser = async (u) => {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      notify(`User ${u.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) { notify(err.message, true); }
  };

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1>SovereignAI</h1>
          <span>Admin Console</span>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Administration</div>
            {['Overview', 'Users', 'Audit Log'].map(t => (
              <div key={t} className={`nav-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                <span className="icon">
                  {t === 'Overview' ? '◈' : t === 'Users' ? '◉' : '◷'}
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user.username}</div>
              <div className="user-role">Admin</div>
            </div>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading...</span></div>
        ) : (
          <>
            {tab === 'Overview' && stats && (
              <div>
                <div className="page-header">
                  <div className="page-title">Platform Overview</div>
                  <div className="page-sub">SovereignAI system-wide statistics</div>
                </div>
                <div className="stats-grid mb-24">
                  <StatCard label="Total Users" value={stats.total_users} />
                  <StatCard label="Datasets" value={stats.total_datasets} />
                  <StatCard label="Published" value={stats.published_datasets} cls="gold" />
                  <StatCard label="AI Policies" value={stats.ai_generated_policies} cls="gold" />
                  <StatCard label="Access Requests" value={stats.total_access_requests} />
                  <StatCard label="Pending" value={stats.pending_requests} cls={stats.pending_requests > 0 ? 'red' : 'green'} />
                  <StatCard label="Total Exports" value={stats.total_exports} />
                  <StatCard label="GDPR Requests" value={stats.total_gdpr_requests} cls="red" />
                </div>

                <div className="card mb-24">
                  <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Users by Role</h3>
                  <div style={{ display: 'flex', gap: 32 }}>
                    {Object.entries(stats.users_by_role).map(([role, count]) => (
                      <div key={role} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)' }}>{count}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray)', textTransform: 'capitalize' }}>{role.replace('_', ' ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Recent Activity</h3>
                  {logs.slice(0, 10).map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 0', borderBottom: '1px solid var(--card-border)', fontSize: 13 }}>
                      <span className="badge badge-gray" style={{ minWidth: 120, textAlign: 'center' }}>
                        {l.event_type}
                      </span>
                      <span className="text-gray text-xs">{l.actor_id?.slice(0, 8)}</span>
                      <span style={{ flex: 1 }} />
                      <span className="text-xs text-gray">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'Users' && (
              <div>
                <div className="page-header">
                  <div className="page-title">User Management</div>
                  <div className="page-sub">{users.length} registered users</div>
                </div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Username</th><th>Email</th><th>Role</th><th>Organization</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td className="bold text-sm">{u.username}</td>
                            <td className="text-sm text-gray">{u.email}</td>
                            <td>
                              <span className={`badge ${
                                u.role === 'admin' ? 'badge-red' :
                                u.role === 'data_holder' ? 'badge-gold' :
                                u.role === 'auditor' ? 'badge-blue' : 'badge-gray'
                              }`}>{u.role.replace('_', ' ')}</span>
                            </td>
                            <td className="text-sm text-gray">{u.organization || '—'}</td>
                            <td>
                              <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="text-xs text-gray">{new Date(u.created_at).toLocaleDateString()}</td>
                            <td>
                              <button
                                className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                                onClick={() => toggleUser(u)}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {users.length === 0 && <div className="empty-state"><p>No users</p></div>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'Audit Log' && (
              <div>
                <div className="page-header">
                  <div className="page-title">Full Audit Log</div>
                  <div className="page-sub">{logs.length} events</div>
                </div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Event</th><th>Actor</th><th>Target</th><th>Details</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {logs.map(l => (
                          <tr key={l.id}>
                            <td className="text-xs text-gray">{l.id}</td>
                            <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{l.event_type}</span></td>
                            <td className="text-xs text-gray">{l.actor_id?.slice(0, 8) || '—'}</td>
                            <td className="text-xs text-gray">{l.target_id?.slice(0, 8) || '—'}</td>
                            <td className="text-xs text-gray" style={{ maxWidth: 200 }}>
                              <div className="truncate">{l.details ? JSON.stringify(l.details) : '—'}</div>
                            </td>
                            <td className="text-xs text-gray">{new Date(l.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

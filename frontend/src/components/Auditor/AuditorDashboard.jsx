import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { StatCard } from '../DataHolder/DataHolderDashboard';

export default function AuditorDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('Audit Log');
  const [logs, setLogs] = useState([]);
  const [chain, setChain] = useState(null);
  const [gdprReqs, setGdprReqs] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([
      api.auditLogs(), api.listGdprRequests(),
      api.listDatasets(), api.listExports()
    ]).then(([l, g, d, e]) => {
      setLogs(l); setGdprReqs(g); setDatasets(d); setExports(e);
    }).finally(() => setLoading(false));
  }, []);

  const verifyChain = async () => {
    setVerifying(true);
    try { setChain(await api.chainVerify()); }
    catch (e) { alert(e.message); }
    finally { setVerifying(false); }
  };

  const filteredLogs = filter
    ? logs.filter(l => l.event_type.toLowerCase().includes(filter.toLowerCase()) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const eventColors = {
    USER_REGISTER: 'badge-blue', USER_LOGIN: 'badge-gray',
    DATASET_UPLOAD: 'badge-gold', DATASET_DELETED: 'badge-red',
    POLICY_CREATED: 'badge-blue', POLICY_AI_GENERATED: 'badge-gold',
    BINDING_CREATED: 'badge-blue', BINDING_REVOKED: 'badge-red',
    ACCESS_REQUEST: 'badge-yellow', ACCESS_APPROVED: 'badge-green', ACCESS_DENIED: 'badge-red',
    EXPORT_CREATED: 'badge-gold', EXPORT_DOWNLOADED: 'badge-gray',
    GDPR_ERASURE: 'badge-red', GDPR_ACCESS: 'badge-blue', GDPR_PORTABILITY: 'badge-blue',
  };

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1>SovereignAI</h1>
          <span>Compliance Monitor</span>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Auditor</div>
            {['Audit Log', 'GDPR Requests', 'Datasets', 'Exports'].map(t => (
              <div key={t} className={`nav-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                <span className="icon">
                  {t === 'Audit Log' ? '◷' : t === 'GDPR Requests' ? '◎' : t === 'Datasets' ? '◧' : '◫'}
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
              <div className="user-role">Auditor</div>
            </div>
            <button className="logout-btn" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </div>

      <div className="main-content">
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading audit data...</span></div>
        ) : (
          <>
            {tab === 'Audit Log' && (
              <div>
                <div className="flex-between page-header">
                  <div>
                    <div className="page-title">Audit Log</div>
                    <div className="page-sub">{logs.length} events recorded</div>
                  </div>
                  <button className="btn btn-primary" onClick={verifyChain} disabled={verifying}>
                    {verifying ? 'Verifying...' : 'Verify Chain Integrity'}
                  </button>
                </div>

                {chain && (
                  <div className={`alert ${chain.valid ? 'alert-success' : 'alert-error'} mb-24`}>
                    {chain.valid
                      ? `Chain verified. All ${chain.total_entries} entries intact.`
                      : `Chain broken at entry #${chain.broken_at_entry_id}. Possible tampering detected.`}
                  </div>
                )}

                <div className="stats-grid mb-24">
                  <StatCard label="Total Events" value={logs.length} />
                  <StatCard label="Exports" value={logs.filter(l => l.event_type === 'EXPORT_CREATED').length} cls="gold" />
                  <StatCard label="Access Requests" value={logs.filter(l => l.event_type === 'ACCESS_REQUEST').length} />
                  <StatCard label="GDPR Actions" value={logs.filter(l => l.event_type.startsWith('GDPR')).length} cls="red" />
                </div>

                <div className="card">
                  <div className="mb-16">
                    <input value={filter} onChange={e => setFilter(e.target.value)}
                      placeholder="Filter by event type or details..." />
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>#</th><th>Event</th><th>Actor</th><th>Target</th><th>Details</th><th>Hash</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {filteredLogs.map(l => (
                          <tr key={l.id}>
                            <td className="text-xs text-gray">{l.id}</td>
                            <td>
                              <span className={`badge ${eventColors[l.event_type] || 'badge-gray'}`}>
                                {l.event_type}
                              </span>
                            </td>
                            <td className="text-xs text-gray">{l.actor_id?.slice(0, 8) || '—'}</td>
                            <td className="text-xs text-gray">{l.target_id?.slice(0, 8) || '—'}</td>
                            <td className="text-xs text-gray" style={{ maxWidth: 180 }}>
                              <div className="truncate">
                                {l.details ? JSON.stringify(l.details).slice(0, 80) : '—'}
                              </div>
                            </td>
                            <td>
                              <code style={{ fontSize: 10, color: 'var(--gray)', fontFamily: 'monospace' }}>
                                {l.entry_hash?.slice(0, 12)}...
                              </code>
                            </td>
                            <td className="text-xs text-gray">
                              {new Date(l.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredLogs.length === 0 && (
                      <div className="empty-state"><p>No matching events</p></div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'GDPR Requests' && (
              <div>
                <div className="page-header">
                  <div className="page-title">GDPR Requests</div>
                  <div className="page-sub">All data subject rights requests</div>
                </div>
                <div className="stats-grid mb-24">
                  <StatCard label="Total" value={gdprReqs.length} />
                  <StatCard label="Completed" value={gdprReqs.filter(r => r.status === 'completed').length} cls="green" />
                  <StatCard label="Pending" value={gdprReqs.filter(r => r.status === 'pending').length} cls="gold" />
                  <StatCard label="Erasure" value={gdprReqs.filter(r => r.request_type === 'erasure').length} cls="red" />
                </div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Subject Email</th><th>Type</th><th>Dataset</th><th>Status</th><th>Completed</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {gdprReqs.map(r => (
                          <tr key={r.id}>
                            <td className="text-sm">{r.subject_email}</td>
                            <td>
                              <span className={`badge ${
                                r.request_type === 'erasure' ? 'badge-red' :
                                r.request_type === 'access' ? 'badge-blue' : 'badge-gold'
                              }`}>{r.request_type}</span>
                            </td>
                            <td className="text-xs text-gray">{r.dataset_id?.slice(0, 8) || 'All'}</td>
                            <td>
                              <span className={`badge ${r.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="text-xs text-gray">
                              {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="text-xs text-gray">{new Date(r.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {gdprReqs.length === 0 && <div className="empty-state"><p>No GDPR requests</p></div>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'Datasets' && (
              <div>
                <div className="page-header">
                  <div className="page-title">All Datasets</div>
                  <div className="page-sub">Platform-wide dataset overview</div>
                </div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Name</th><th>Owner</th><th>Format</th><th>Rows</th><th>Visibility</th><th>Policy</th><th>Created</th></tr>
                      </thead>
                      <tbody>
                        {datasets.map(d => (
                          <tr key={d.id}>
                            <td className="bold text-sm">{d.name}</td>
                            <td className="text-xs text-gray">{d.owner_id.slice(0, 8)}</td>
                            <td><span className="badge badge-gray">{d.file_format?.toUpperCase()}</span></td>
                            <td>{d.row_count?.toLocaleString() || '—'}</td>
                            <td>
                              <span className={`badge ${d.visibility === 'published' ? 'badge-green' : 'badge-gray'}`}>
                                {d.visibility}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${d.has_policy ? 'badge-green' : 'badge-yellow'}`}>
                                {d.has_policy ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="text-xs text-gray">{new Date(d.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {datasets.length === 0 && <div className="empty-state"><p>No datasets</p></div>}
                  </div>
                </div>
              </div>
            )}

            {tab === 'Exports' && (
              <div>
                <div className="page-header">
                  <div className="page-title">All Exports</div>
                  <div className="page-sub">Platform-wide export history</div>
                </div>
                <div className="card">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Export ID</th><th>Consumer</th><th>Dataset</th><th>Rows</th><th>Redacted</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {exports.map(e => (
                          <tr key={e.id}>
                            <td><code style={{ fontSize: 11, color: 'var(--gray)' }}>{e.id.slice(0, 12)}</code></td>
                            <td className="text-xs text-gray">{e.consumer_id.slice(0, 8)}</td>
                            <td className="text-xs text-gray">{e.dataset_id.slice(0, 8)}</td>
                            <td>{e.row_count?.toLocaleString()}</td>
                            <td className="text-xs text-gray">{(e.fields_redacted || []).join(', ') || 'None'}</td>
                            <td className="text-xs text-gray">{new Date(e.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {exports.length === 0 && <div className="empty-state"><p>No exports yet</p></div>}
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

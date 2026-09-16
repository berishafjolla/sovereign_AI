import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { StatusBadge, StatCard } from '../DataHolder/DataHolderDashboard';

const TABS = ['Marketplace', 'My Requests', 'My Exports'];

export default function ConsumerPortal({ user, onLogout }) {
  const [tab, setTab] = useState('Marketplace');
  const [marketplace, setMarketplace] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [mkt, bs, rs, es] = await Promise.all([
        api.marketplace(), api.listBindings(),
        api.listMyRequests(), api.listExports()
      ]);
      setMarketplace(mkt);
      setBindings(bs);
      setRequests(rs);
      setExports(es);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const notify = (msg, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const approved = requests.filter(r => r.decision === 'allow').length;
  const pending = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1>SovereignAI</h1>
          <span>Data Marketplace</span>
        </div>
        <div className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-label">Consumer</div>
            {[
              { label: 'Marketplace', icon: '◈' },
              { label: 'My Requests', icon: '◉', badge: pending },
              { label: 'My Exports', icon: '◫' },
            ].map(item => (
              <div key={item.label}
                className={`nav-item ${tab === item.label ? 'active' : ''}`}
                onClick={() => setTab(item.label)}>
                <span className="icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 10,
                    fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>{item.badge}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">{user.username[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user.username}</div>
              <div className="user-role">Consumer</div>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Logout">Logout</button>
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
            {tab === 'Marketplace' && (
              <MarketplaceTab
                datasets={marketplace} bindings={bindings}
                requests={requests} onRefresh={load} notify={notify}
              />
            )}
            {tab === 'My Requests' && (
              <RequestsTab requests={requests} bindings={bindings} datasets={marketplace} />
            )}
            {tab === 'My Exports' && (
              <ExportsTab exports={exports} datasets={marketplace} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MarketplaceTab({ datasets, bindings, requests, onRefresh, notify }) {
  const [requesting, setRequesting] = useState(null); // dataset being requested
  const [form, setForm] = useState({ purpose: '', organization: '', intended_use: '', location: '' });
  const [submitting, setSubmitting] = useState(false);

  // Map binding by dataset_id
  const bindingByDataset = {};
  bindings.forEach(b => { bindingByDataset[b.dataset_id] = b; });

  // Map requests by binding_id
  const requestByBinding = {};
  requests.forEach(r => { requestByBinding[r.binding_id] = r; });

  const submitRequest = async (e) => {
    e.preventDefault();
    const binding = bindingByDataset[requesting.id];
    if (!binding) { notify('No active binding found', true); return; }
    setSubmitting(true);
    try {
      await api.submitRequest({ binding_id: binding.id, ...form });
      notify('Access request submitted successfully');
      setRequesting(null);
      setForm({ purpose: '', organization: '', intended_use: '', location: '' });
      onRefresh();
    } catch (err) { notify(err.message, true); }
    finally { setSubmitting(false); }
  };

  const PURPOSES = [
    'academic_research', 'commercial_analytics', 'product_development',
    'public_health', 'regulatory_compliance', 'internal_operations', 'journalism', 'other'
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Data Marketplace</div>
        <div className="page-sub">{datasets.length} published dataset{datasets.length !== 1 ? 's' : ''} available</div>
      </div>

      {requesting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, background: 'var(--navy)' }}>
            <div className="flex-between mb-16">
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Request Access</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setRequesting(null)}>×</button>
            </div>
            <div className="alert alert-info mb-16">
              <strong>{requesting.name}</strong> — {requesting.file_format?.toUpperCase()} · {requesting.row_count?.toLocaleString()} rows
            </div>
            <form onSubmit={submitRequest}>
              <div className="form-group">
                <label>Purpose *</label>
                <select value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required>
                  <option value="">Select purpose...</option>
                  {PURPOSES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Organization</label>
                  <input value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })}
                    placeholder="Your organization" />
                </div>
                <div className="form-group">
                  <label>Location (ISO code)</label>
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="e.g. DE, FR, US" maxLength={2} />
                </div>
              </div>
              <div className="form-group">
                <label>Intended Use</label>
                <textarea value={form.intended_use}
                  onChange={e => setForm({ ...form, intended_use: e.target.value })}
                  placeholder="Describe how you intend to use this data..." />
              </div>
              <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setRequesting(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {datasets.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">◈</div>
          <p>No datasets published yet. Check back later.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {datasets.map(d => {
            const binding = bindingByDataset[d.id];
            const existingReq = binding ? requestByBinding[binding.id] : null;
            const hasAccess = existingReq?.decision === 'allow';
            const isPending = existingReq?.status === 'pending';

            return (
              <div key={d.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="flex-between">
                  <span className="badge badge-gray">{d.file_format?.toUpperCase()}</span>
                  {d.confidentiality_level && (
                    <span className={`badge ${
                      d.confidentiality_level === 'public' ? 'badge-green' :
                      d.confidentiality_level === 'confidential' ? 'badge-red' : 'badge-yellow'
                    }`}>{d.confidentiality_level}</span>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{d.name}</h3>
                  <p className="text-sm text-gray" style={{ lineHeight: 1.5 }}>
                    {d.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--gray)' }}>
                  <span>Rows: <strong style={{ color: 'var(--white)' }}>{d.row_count?.toLocaleString() || '?'}</strong></span>
                  <span>Columns: <strong style={{ color: 'var(--white)' }}>{d.column_names?.length || '?'}</strong></span>
                </div>

                {d.column_names?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {d.column_names.slice(0, 6).map(col => (
                      <span key={col} className="badge badge-gray" style={{ fontSize: 10 }}>{col}</span>
                    ))}
                    {d.column_names.length > 6 && (
                      <span className="badge badge-gray" style={{ fontSize: 10 }}>+{d.column_names.length - 6} more</span>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                  {hasAccess ? (
                    <ExportButton dataset={d} binding={binding} request={existingReq} notify={() => {}} />
                  ) : isPending ? (
                    <button className="btn btn-secondary" style={{ width: '100%' }} disabled>
                      Request Pending...
                    </button>
                  ) : existingReq?.status === 'denied' ? (
                    <button className="btn btn-danger" style={{ width: '100%' }} disabled>
                      Request Denied
                    </button>
                  ) : (
                    <button className="btn btn-primary" style={{ width: '100%' }}
                      onClick={() => setRequesting(d)}>
                      Request Access
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportButton({ dataset, binding, request, notify }) {
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const doExport = async () => {
    setExporting(true);
    try {
      const exp = await api.createExport({
        dataset_id: dataset.id,
        binding_id: binding.id,
        purpose: request?.purpose,
      });
      await api.downloadExport(exp.id, `${dataset.name}_export.csv`);
      setDone(true);
    } catch (err) { alert(err.message); }
    finally { setExporting(false); }
  };

  return (
    <button className="btn btn-success" style={{ width: '100%' }} onClick={doExport} disabled={exporting}>
      {exporting ? 'Preparing export...' : done ? 'Download Again' : 'Download Dataset'}
    </button>
  );
}

function RequestsTab({ requests, bindings, datasets }) {
  const bindingMap = {};
  bindings.forEach(b => { bindingMap[b.id] = b; });
  const datasetMap = {};
  datasets.forEach(d => { datasetMap[d.id] = d; });

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My Requests</div>
        <div className="page-sub">Track your access requests</div>
      </div>
      <div className="stats-grid">
        <StatCard label="Total Requests" value={requests.length} />
        <StatCard label="Approved" value={requests.filter(r => r.decision === 'allow').length} cls="green" />
        <StatCard label="Pending" value={requests.filter(r => r.status === 'pending').length} cls="gold" />
        <StatCard label="Denied" value={requests.filter(r => r.decision === 'deny').length} cls="red" />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Dataset</th><th>Purpose</th><th>Status</th><th>Decision</th><th>Reason</th><th>Date</th></tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const b = bindingMap[r.binding_id];
                const ds = b ? datasetMap[b.dataset_id] : null;
                return (
                  <tr key={r.id}>
                    <td className="bold text-sm">{ds?.name || r.binding_id.slice(0, 8)}</td>
                    <td className="text-sm">{r.purpose?.replace(/_/g, ' ')}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>
                      {r.decision === 'allow'
                        ? <span className="badge badge-green">Allowed</span>
                        : r.decision === 'deny'
                        ? <span className="badge badge-red">Denied</span>
                        : <span className="text-gray text-sm">—</span>}
                    </td>
                    <td className="text-xs text-gray" style={{ maxWidth: 200 }}>
                      <div className="truncate">{r.decision_reason || '—'}</div>
                    </td>
                    <td className="text-xs text-gray">{new Date(r.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="empty-state">
              <div className="icon">◉</div>
              <p>No requests yet. Browse the Marketplace to request access.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportsTab({ exports, datasets }) {
  const dsMap = {};
  datasets.forEach(d => { dsMap[d.id] = d; });

  return (
    <div>
      <div className="page-header">
        <div className="page-title">My Exports</div>
        <div className="page-sub">Download your approved data exports</div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Dataset</th><th>Rows</th><th>Fields Exported</th><th>Redacted</th><th>Date</th><th>Download</th></tr>
            </thead>
            <tbody>
              {exports.map(e => (
                <tr key={e.id}>
                  <td className="bold text-sm">{dsMap[e.dataset_id]?.name || e.dataset_id.slice(0, 8)}</td>
                  <td>{e.row_count?.toLocaleString()}</td>
                  <td className="text-xs text-gray">{(e.fields_exported || []).slice(0, 4).join(', ')}{e.fields_exported?.length > 4 ? '...' : ''}</td>
                  <td>
                    {(e.fields_redacted || []).length > 0
                      ? <span className="badge badge-yellow">{e.fields_redacted.length} redacted</span>
                      : <span className="text-gray text-sm">None</span>}
                  </td>
                  <td className="text-xs text-gray">{new Date(e.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => api.downloadExport(e.id, `export_${e.id.slice(0,8)}.csv`)}>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {exports.length === 0 && (
            <div className="empty-state">
              <div className="icon">◫</div>
              <p>No exports yet. Get access approval first from the Marketplace.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

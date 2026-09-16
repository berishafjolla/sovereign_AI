import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import PolicyGenerator from './PolicyGenerator';

const TABS = ['Overview', 'Datasets', 'Policies', 'Requests', 'Exports', 'GDPR'];

export default function DataHolderDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('Overview');
  const [datasets, setDatasets] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [genDataset, setGenDataset] = useState(null); // dataset to generate policy for
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [ds, ps, bs, rs, es] = await Promise.all([
        api.listDatasets(), api.listPolicies(), api.listBindings(),
        api.listIncomingRequests(), api.listExports()
      ]);
      setDatasets(ds); setPolicies(ps); setBindings(bs);
      setRequests(rs); setExports(es);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const notify = (msg, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  if (genDataset) {
    return (
      <PolicyGenerator
        dataset={genDataset}
        onDone={() => { setGenDataset(null); load(); }}
        onBack={() => setGenDataset(null)}
      />
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const bound = new Set(bindings.map(b => b.dataset_id));
  const published = bindings.filter(b => b.published).length;

  return (
    <div className="app-shell">
      <Sidebar user={user} tab={tab} setTab={setTab} pendingCount={pendingCount} onLogout={onLogout} />
      <div className="main-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {tab === 'Overview' && (
          <Overview datasets={datasets} policies={policies} bindings={bindings}
            requests={requests} exports={exports} published={published} setTab={setTab} />
        )}
        {tab === 'Datasets' && (
          <Datasets datasets={datasets} bindings={bindings} policies={policies}
            onGenerate={setGenDataset} onRefresh={load} notify={notify} />
        )}
        {tab === 'Policies' && (
          <Policies policies={policies} bindings={bindings} datasets={datasets}
            onRefresh={load} notify={notify} />
        )}
        {tab === 'Requests' && (
          <Requests requests={requests} bindings={bindings} datasets={datasets}
            onRefresh={load} notify={notify} />
        )}
        {tab === 'Exports' && <ExportsTab exports={exports} datasets={datasets} />}
        {tab === 'GDPR' && <GDPRTab datasets={datasets} notify={notify} />}
      </div>
    </div>
  );
}

function Sidebar({ user, tab, setTab, pendingCount, onLogout }) {
  const items = [
    { label: 'Overview', icon: '◈' },
    { label: 'Datasets', icon: '◧' },
    { label: 'Policies', icon: '◎' },
    { label: 'Requests', icon: '◉', badge: pendingCount },
    { label: 'Exports', icon: '◫' },
    { label: 'GDPR', icon: '◷' },
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>SovereignAI</h1>
        <span>Data Governance</span>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label">Data Holder</div>
          {items.map(item => (
            <div key={item.label} className={`nav-item ${tab === item.label ? 'active' : ''}`}
              onClick={() => setTab(item.label)}>
              <span className="icon">{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px',
                  fontSize: '10px', padding: '1px 6px', fontWeight: 700 }}>{item.badge}</span>
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
            <div className="user-role">Data Holder</div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">Logout</button>
        </div>
      </div>
    </div>
  );
}

function Overview({ datasets, policies, bindings, requests, exports, published, setTab }) {
  const pending = requests.filter(r => r.status === 'pending').length;
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Dashboard</div>
        <div className="page-sub">Manage your datasets, policies, and access governance</div>
      </div>
      <div className="stats-grid">
        <StatCard label="Total Datasets" value={datasets.length} />
        <StatCard label="Published" value={published} cls="gold" />
        <StatCard label="AI Policies" value={policies.filter(p => p.source === 'ai_generated').length} cls="gold" />
        <StatCard label="Pending Requests" value={pending} cls={pending > 0 ? 'red' : 'green'} />
        <StatCard label="Total Exports" value={exports.length} />
      </div>
      {pending > 0 && (
        <div className="alert alert-warning" style={{ cursor: 'pointer' }} onClick={() => setTab('Requests')}>
          You have {pending} pending access request{pending > 1 ? 's' : ''} waiting for your approval.
        </div>
      )}
      <div className="grid-2">
        <div className="card">
          <div className="flex-between mb-16">
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Datasets</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('Datasets')}>View all</button>
          </div>
          {datasets.slice(0, 5).map(d => (
            <div key={d.id} className="finding-row">
              <div className="finding-field truncate">{d.name}</div>
              <div className="finding-type">{d.file_format?.toUpperCase()}</div>
              <span className={`badge ${d.has_policy ? 'badge-green' : 'badge-yellow'}`}>
                {d.has_policy ? 'Policy set' : 'No policy'}
              </span>
            </div>
          ))}
          {datasets.length === 0 && <p className="text-gray text-sm">No datasets yet</p>}
        </div>
        <div className="card">
          <div className="flex-between mb-16">
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Recent Requests</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setTab('Requests')}>View all</button>
          </div>
          {requests.slice(0, 5).map(r => (
            <div key={r.id} className="finding-row">
              <div style={{ flex: 1 }}>
                <div className="text-sm bold truncate">{r.purpose}</div>
                <div className="text-xs text-gray">{r.organization || 'Unknown org'}</div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))}
          {requests.length === 0 && <p className="text-gray text-sm">No requests yet</p>}
        </div>
      </div>
    </div>
  );
}

function Datasets({ datasets, bindings, policies, onGenerate, onRefresh, notify }) {
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', file: null });
  const [showUpload, setShowUpload] = useState(false);
  const [bindForm, setBindForm] = useState({ datasetId: '', policyId: '' });
  const [binding, setBinding] = useState(false);

  const upload = async (e) => {
    e.preventDefault();
    if (!form.file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('file', form.file);
      await api.uploadDataset(fd);
      notify('Dataset uploaded successfully');
      setShowUpload(false);
      setForm({ name: '', description: '', file: null });
      onRefresh();
    } catch (err) { notify(err.message, true); }
    finally { setUploading(false); }
  };

  const bindPolicy = async (e) => {
    e.preventDefault();
    setBinding(true);
    try {
      await api.createBinding({ dataset_id: bindForm.datasetId, policy_id: bindForm.policyId });
      notify('Policy bound to dataset');
      setBindForm({ datasetId: '', policyId: '' });
      onRefresh();
    } catch (err) { notify(err.message, true); }
    finally { setBinding(false); }
  };

  const togglePublish = async (bindingId) => {
    try {
      await api.togglePublish(bindingId);
      notify('Visibility updated');
      onRefresh();
    } catch (err) { notify(err.message, true); }
  };

  const deleteDs = async (id) => {
    if (!window.confirm('Delete this dataset?')) return;
    try { await api.deleteDataset(id); notify('Dataset deleted'); onRefresh(); }
    catch (err) { notify(err.message, true); }
  };

  const boundMap = {};
  bindings.forEach(b => { boundMap[b.dataset_id] = b; });

  const unboundDatasets = datasets.filter(d => !boundMap[d.id]);
  const unboundPolicies = policies;

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Datasets</div>
          <div className="page-sub">Upload and manage your data files</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>
          + Upload Dataset
        </button>
      </div>

      {showUpload && (
        <div className="card mb-24">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Upload New Dataset</h3>
          <form onSubmit={upload}>
            <div className="grid-2">
              <div className="form-group">
                <label>Dataset Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Customer Transactions Q1 2024" required />
              </div>
              <div className="form-group">
                <label>File</label>
                <input type="file" accept=".csv,.json,.xlsx,.xls,.tsv,.parquet,.xml,.txt"
                  onChange={e => setForm({ ...form, file: e.target.files[0] })} required
                  style={{ padding: '6px 10px' }} />
              </div>
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of what this dataset contains..." />
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {unboundDatasets.length > 0 && policies.length > 0 && (
        <div className="card mb-24" style={{ borderColor: 'rgba(198,131,70,0.3)' }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, color: 'var(--gold)' }}>Bind Policy to Dataset</h3>
          <form onSubmit={bindPolicy}>
            <div className="grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Dataset</label>
                <select value={bindForm.datasetId} onChange={e => setBindForm({ ...bindForm, datasetId: e.target.value })} required>
                  <option value="">Select dataset...</option>
                  {unboundDatasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Policy</label>
                <select value={bindForm.policyId} onChange={e => setBindForm({ ...bindForm, policyId: e.target.value })} required>
                  <option value="">Select policy...</option>
                  {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-end mt-16">
              <button type="submit" className="btn btn-primary btn-sm" disabled={binding}>
                {binding ? 'Binding...' : 'Bind Policy'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Format</th><th>Rows</th><th>Policy</th>
                <th>Published</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map(d => {
                const binding = boundMap[d.id];
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="bold">{d.name}</div>
                      <div className="text-xs text-gray">{d.description?.slice(0, 50)}</div>
                    </td>
                    <td><span className="badge badge-gray">{d.file_format?.toUpperCase() || '?'}</span></td>
                    <td>{d.row_count?.toLocaleString() || '—'}</td>
                    <td>
                      {binding
                        ? <span className="badge badge-green">Bound</span>
                        : <span className="badge badge-yellow">No policy</span>}
                    </td>
                    <td>
                      {binding ? (
                        <button className={`btn btn-sm ${binding.published ? 'btn-success' : 'btn-warning'}`}
                          onClick={() => togglePublish(binding.id)}
                          title={binding.published ? 'Click to unpublish' : 'Click to publish to marketplace'}>
                          {binding.published ? '✓ Published' : '→ Publish'}
                        </button>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => onGenerate(d)}
                          title="Generate AI Policy">
                          AI Policy
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteDs(d.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {datasets.length === 0 && (
            <div className="empty-state">
              <div className="icon">◧</div>
              <p>No datasets yet. Upload your first dataset above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Policies({ policies, bindings, datasets, onRefresh, notify }) {
  const deletePolicy = async (id) => {
    if (!window.confirm('Delete this policy?')) return;
    try { await api.deletePolicy(id); notify('Policy deleted'); onRefresh(); }
    catch (err) { notify(err.message, true); }
  };

  const boundPolicies = new Set(bindings.map(b => b.policy_id));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Policies</div>
        <div className="page-sub">View and manage data access policies. Use Datasets tab to generate AI policies.</div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Source</th><th>Legal Basis</th><th>Risk</th><th>Frameworks</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {policies.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="bold">{p.name}</div>
                    <div className="text-xs text-gray">{p.description?.slice(0, 60)}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.source === 'ai_generated' ? 'badge-gold' : 'badge-blue'}`}>
                      {p.source === 'ai_generated' ? 'AI Generated' : 'Manual'}
                    </span>
                  </td>
                  <td className="text-sm">{p.legal_basis || '—'}</td>
                  <td><RiskBadge level={p.risk_level} /></td>
                  <td>
                    {(p.compliance_frameworks || []).map(f => (
                      <span key={f} className="badge badge-blue" style={{ marginRight: 4 }}>{f}</span>
                    ))}
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm"
                      disabled={boundPolicies.has(p.id)}
                      onClick={() => deletePolicy(p.id)}
                      title={boundPolicies.has(p.id) ? 'Revoke binding first' : 'Delete'}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {policies.length === 0 && (
            <div className="empty-state">
              <div className="icon">◎</div>
              <p>No policies yet. Use the AI Policy Generator on your datasets.</p>
            </div>
          )}
        </div>
      </div>
      {policies.some(p => p.ai_analysis) && (
        <div className="mt-24">
          <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>AI Analysis Details</h3>
          {policies.filter(p => p.ai_analysis).map(p => (
            <div key={p.id} className="card mb-16">
              <div className="flex-between mb-16">
                <h4 style={{ fontSize: 14 }}>{p.name}</h4>
                <RiskBadge level={p.risk_level} />
              </div>
              {p.ai_analysis?.findings_summary && (
                <div className="alert alert-info">{p.ai_analysis.findings_summary}</div>
              )}
              {p.ai_analysis?.pii_detected?.length > 0 && (
                <div className="analysis-section">
                  <h4>PII Detected</h4>
                  {p.ai_analysis.pii_detected.map((item, i) => (
                    <div key={i} className="finding-row">
                      <div className="finding-field">{item.field}</div>
                      <div className="finding-type">{item.type}</div>
                      <span className={`badge ${item.confidence === 'high' ? 'badge-red' : 'badge-yellow'}`}>
                        {item.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Requests({ requests, bindings, datasets, onRefresh, notify }) {
  const [selected, setSelected] = useState(new Set());
  const [denyReason, setDenyReason] = useState('');

  const bindingMap = {};
  bindings.forEach(b => { bindingMap[b.id] = b; });
  const datasetMap = {};
  datasets.forEach(d => { datasetMap[d.id] = d; });

  const approve = async (id) => {
    try { await api.approveRequest(id); notify('Request approved'); onRefresh(); }
    catch (err) { notify(err.message, true); }
  };

  const deny = async (id) => {
    const reason = window.prompt('Reason for denial:', 'Does not meet policy requirements');
    if (reason === null) return;
    try { await api.denyRequest(id, { reason }); notify('Request denied'); onRefresh(); }
    catch (err) { notify(err.message, true); }
  };

  const bulkApprove = async () => {
    try { await api.bulkApprove([...selected]); notify(`Approved ${selected.size} requests`); setSelected(new Set()); onRefresh(); }
    catch (err) { notify(err.message, true); }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const others = requests.filter(r => r.status !== 'pending');

  const notify_ = (msg, isErr = false) => notify(msg, isErr);

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Access Requests</div>
          <div className="page-sub">{pending.length} pending approval</div>
        </div>
        {selected.size > 0 && (
          <div className="flex gap-8">
            <button className="btn btn-success btn-sm" onClick={bulkApprove}>
              Approve {selected.size} selected
            </button>
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="card mb-24">
          <h3 style={{ marginBottom: 16, fontSize: 14, color: 'var(--warning)' }}>Pending Approval ({pending.length})</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" onChange={e => {
                    if (e.target.checked) setSelected(new Set(pending.map(r => r.id)));
                    else setSelected(new Set());
                  }} /></th>
                  <th>Purpose</th><th>Organization</th><th>Location</th><th>Intended Use</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(r => {
                  const b = bindingMap[r.binding_id];
                  const ds = b ? datasetMap[b.dataset_id] : null;
                  return (
                    <tr key={r.id}>
                      <td>
                        <input type="checkbox" checked={selected.has(r.id)}
                          onChange={e => {
                            const s = new Set(selected);
                            if (e.target.checked) s.add(r.id); else s.delete(r.id);
                            setSelected(s);
                          }} />
                      </td>
                      <td>
                        <div className="bold text-sm">{r.purpose}</div>
                        {ds && <div className="text-xs text-gray">Dataset: {ds.name}</div>}
                      </td>
                      <td className="text-sm">{r.organization || '—'}</td>
                      <td className="text-sm">{r.location || '—'}</td>
                      <td className="text-sm" style={{ maxWidth: 200 }}>
                        <div className="truncate">{r.intended_use || '—'}</div>
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-success btn-sm" onClick={() => approve(r.id)}>Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deny(r.id)}>Deny</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 16, fontSize: 14 }}>All Requests</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Purpose</th><th>Organization</th><th>Status</th><th>Decision</th><th>Date</th></tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td className="bold text-sm">{r.purpose}</td>
                  <td className="text-sm">{r.organization || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-sm text-gray">{r.decision_reason?.slice(0, 60) || '—'}</td>
                  <td className="text-xs text-gray">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && <div className="empty-state"><p>No requests yet</p></div>}
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
        <div className="page-title">Export Monitor</div>
        <div className="page-sub">Track all data exports from your datasets</div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Dataset</th><th>Rows</th><th>Redacted Fields</th><th>Purpose</th><th>Date</th></tr>
            </thead>
            <tbody>
              {exports.map(e => (
                <tr key={e.id}>
                  <td className="bold text-sm">{dsMap[e.dataset_id]?.name || e.dataset_id.slice(0, 8)}</td>
                  <td>{e.row_count?.toLocaleString()}</td>
                  <td className="text-sm text-gray">{(e.fields_redacted || []).join(', ') || 'None'}</td>
                  <td className="text-sm">{e.purpose || '—'}</td>
                  <td className="text-xs text-gray">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {exports.length === 0 && <div className="empty-state"><p>No exports yet</p></div>}
        </div>
      </div>
    </div>
  );
}

function GDPRTab({ datasets, notify }) {
  const [form, setForm] = useState({ subject_email: '', request_type: 'erasure', dataset_id: '' });
  const [loading, setLoading] = useState(false);
  const [gdprReqs, setGdprReqs] = useState([]);

  useEffect(() => {
    api.listGdprRequests().then(setGdprReqs).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const handlers = { erasure: api.gdprErasure, access: api.gdprAccess, portability: api.gdprPortability };
      await handlers[form.request_type](form);
      notify(`GDPR ${form.request_type} request submitted`);
      const updated = await api.listGdprRequests();
      setGdprReqs(updated);
      setForm({ subject_email: '', request_type: 'erasure', dataset_id: '' });
    } catch (err) { notify(err.message, true); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">GDPR Compliance</div>
        <div className="page-sub">Handle data subject rights requests</div>
      </div>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Submit Rights Request</h3>
          <form onSubmit={submit}>
            <div className="form-group">
              <label>Data Subject Email</label>
              <input type="email" value={form.subject_email}
                onChange={e => setForm({ ...form, subject_email: e.target.value })}
                placeholder="subject@example.com" required />
            </div>
            <div className="form-group">
              <label>Request Type</label>
              <select value={form.request_type} onChange={e => setForm({ ...form, request_type: e.target.value })}>
                <option value="erasure">Right to Erasure (Art. 17)</option>
                <option value="access">Right of Access (Art. 15)</option>
                <option value="portability">Data Portability (Art. 20)</option>
                <option value="rectification">Rectification (Art. 16)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Dataset (optional — leave blank for all)</label>
              <select value={form.dataset_id} onChange={e => setForm({ ...form, dataset_id: e.target.value })}>
                <option value="">All datasets</option>
                {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: 15 }}>Request History</h3>
          {gdprReqs.map(r => (
            <div key={r.id} className="finding-row">
              <div style={{ flex: 1 }}>
                <div className="bold text-sm">{r.subject_email}</div>
                <div className="text-xs text-gray">{r.request_type} · {new Date(r.created_at).toLocaleDateString()}</div>
              </div>
              <span className={`badge ${r.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{r.status}</span>
            </div>
          ))}
          {gdprReqs.length === 0 && <p className="text-gray text-sm">No requests yet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function StatCard({ label, value, cls }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls || ''}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pending: 'badge-yellow', approved: 'badge-green', auto_approved: 'badge-green',
    denied: 'badge-red', active: 'badge-green', revoked: 'badge-red',
    completed: 'badge-green', processing: 'badge-blue',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status?.replace('_', ' ')}</span>;
}

function RiskBadge({ level }) {
  if (!level) return null;
  const map = { low: 'badge-green', medium: 'badge-yellow', high: 'badge-gold', critical: 'badge-red' };
  return <span className={`badge ${map[level] || 'badge-gray'}`}>{level}</span>;
}

export { StatusBadge, RiskBadge, StatCard };

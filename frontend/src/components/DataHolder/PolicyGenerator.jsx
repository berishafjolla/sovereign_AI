import React, { useState } from 'react';
import { api } from '../../api';

export default function PolicyGenerator({ dataset, onDone, onBack }) {
  const [step, setStep] = useState(1); // 1=configure, 2=analyzing, 3=review
  const [frameworks, setFrameworks] = useState(['GDPR']);
  const [context, setContext] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Editable policy draft state
  const [draft, setDraft] = useState(null);

  const generate = async () => {
    setError('');
    setStep(2);
    try {
      const res = await api.generatePolicy({
        dataset_id: dataset.id,
        compliance_frameworks: frameworks,
        additional_context: context || null,
      });
      setResult(res);
      setDraft(res.draft);
      setStep(3);
    } catch (err) {
      setError(err.message);
      setStep(1);
    }
  };

  const savePolicy = async () => {
    setSaving(true);
    try {
      const policy = await api.createPolicy({
        name: draft.name,
        description: draft.description,
        source: 'ai_generated',
        ai_analysis: result.analysis,
        compliance_frameworks: draft.compliance_frameworks,
        legal_basis: draft.legal_basis,
        allowed_purposes: draft.allowed_purposes,
        allowed_roles: draft.allowed_roles,
        data_subject_rights: draft.data_subject_rights,
        retention_period_days: draft.retention_period_days,
        geographic_restrictions: draft.geographic_restrictions,
        requires_manual_approval: draft.requires_manual_approval,
        max_exports_per_consumer: draft.max_exports_per_consumer,
        row_limit: draft.row_limit,
        fields_to_redact: draft.fields_to_redact,
        frand_terms: draft.frand_terms,
        b2b_sharing_obligations: draft.b2b_sharing_obligations,
        switching_rights: draft.switching_rights,
        switching_conditions: draft.switching_conditions,
        requires_explicit_consent: draft.requires_explicit_consent,
        dpia_required: result.analysis.dpia_required,
        risk_level: result.analysis.risk_level,
      });
      // Auto-bind to dataset and publish to marketplace
      let binding;
      try {
        binding = await api.createBinding({ dataset_id: dataset.id, policy_id: policy.id });
      } catch (_) {
        // Binding may already exist — fetch existing bindings and find it
        const allBindings = await api.listBindings();
        binding = allBindings.find(b => b.dataset_id === dataset.id);
      }
      if (binding && !binding.published) {
        await api.togglePublish(binding.id);
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleFramework = (fw) => {
    setFrameworks(prev =>
      prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]
    );
  };

  return (
    <div className="app-shell">
      <div style={{ width: 240, background: 'var(--navy)', borderRight: '1px solid var(--card-border)',
        display: 'flex', flexDirection: 'column', padding: '24px 20px', position: 'fixed',
        top: 0, left: 0, bottom: 0 }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ color: 'var(--gold)', fontSize: 20, fontWeight: 700 }}>SovereignAI</div>
          <div style={{ color: 'var(--gray)', fontSize: 11, marginTop: 2 }}>AI Policy Generator</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 24 }}>
          ← Back to Datasets
        </button>
        <div style={{ flex: 1 }}>
          <StepIndicator current={step} steps={['Configure', 'Analyzing', 'Review & Save']} />
        </div>
        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16, fontSize: 12, color: 'var(--gray)' }}>
          <div className="bold" style={{ color: 'var(--white)', marginBottom: 4 }}>{dataset.name}</div>
          <div>{dataset.file_format?.toUpperCase()} · {dataset.row_count?.toLocaleString() || '?'} rows</div>
          <div style={{ marginTop: 4 }}>{(dataset.column_names || []).length} columns</div>
        </div>
      </div>

      <div className="main-content">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {step === 1 && (
          <Step1Configure
            dataset={dataset} frameworks={frameworks} context={context}
            toggleFramework={toggleFramework} setContext={setContext}
            onGenerate={generate} disabled={frameworks.length === 0}
          />
        )}
        {step === 2 && <Step2Analyzing dataset={dataset} />}
        {step === 3 && result && (
          <Step3Review
            result={result} draft={draft} setDraft={setDraft}
            onSave={savePolicy} saving={saving} onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

function StepIndicator({ current, steps }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 11, fontWeight: 700,
              background: done ? 'var(--success)' : active ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
              color: done || active ? (done ? '#fff' : 'var(--navy)') : 'var(--gray)',
            }}>
              {done ? '✓' : num}
            </div>
            <span style={{ fontSize: 13, color: active ? 'var(--white)' : done ? 'var(--success)' : 'var(--gray)', fontWeight: active ? 600 : 400 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Step1Configure({ dataset, frameworks, context, toggleFramework, setContext, onGenerate, disabled }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Configure Policy Generation</div>
        <div className="page-sub">
          The AI will analyze your actual dataset contents and generate a compliant policy based on what it finds.
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 24 }}>
        <strong>How it works:</strong> The AI reads your dataset's columns and sample data rows, then automatically detects:
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
          <li><strong>PII (Personally Identifiable Information)</strong> — any data that can identify a real person: names, emails, phone numbers, ID numbers, addresses, dates of birth, IP addresses, etc.</li>
          <li><strong>GDPR Article 9 Special Categories</strong> — extra-sensitive data that gets stronger legal protection: health records, biometric data, racial/ethnic origin, political opinions, religious beliefs, sexual orientation</li>
          <li><strong>EU Data Act triggers</strong> — IoT device data, machine-generated sensor readings, and connected product usage logs that fall under the EU Data Act (Reg. 2023/2854)</li>
        </ul>
        Based on what it finds, it generates an evidence-based policy — not just based on your description.
      </div>

      <div className="card mb-24">
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Dataset Preview</h3>
        <div className="grid-2">
          <div>
            <div className="text-xs text-gray" style={{ marginBottom: 6 }}>COLUMNS THAT WILL BE ANALYZED</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(dataset.column_names || []).map(col => (
                <span key={col} className="badge badge-gray">{col}</span>
              ))}
              {(!dataset.column_names || dataset.column_names.length === 0) && (
                <span className="text-gray text-sm">Columns will be read from file</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray" style={{ marginBottom: 6 }}>FILE INFO</div>
            <div className="text-sm">
              <div><span className="text-gray">Format:</span> {dataset.file_format?.toUpperCase()}</div>
              <div><span className="text-gray">Rows:</span> {dataset.row_count?.toLocaleString() || 'unknown'}</div>
              <div><span className="text-gray">Sample sent to AI:</span> first 50 rows</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-24">
        <h3 style={{ marginBottom: 16, fontSize: 15, fontWeight: 600 }}>Compliance Frameworks</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              id: 'GDPR', name: 'GDPR', full: 'General Data Protection Regulation',
              desc: 'EU Reg. 2016/679 — PII detection, legal basis, data subject rights, retention, DPIA assessment'
            },
            {
              id: 'EU_DATA_ACT', name: 'EU Data Act', full: 'EU Data Act',
              desc: 'Reg. 2023/2854 — IoT/machine data, FRAND terms, B2B obligations, switching rights'
            },
          ].map(fw => (
            <label key={fw.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', padding: '14px 16px',
              background: frameworks.includes(fw.id) ? 'rgba(198,131,70,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${frameworks.includes(fw.id) ? 'rgba(198,131,70,0.4)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, transition: 'all 0.15s',
            }}>
              <input type="checkbox" checked={frameworks.includes(fw.id)}
                onChange={() => toggleFramework(fw.id)}
                style={{ width: 'auto', marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: frameworks.includes(fw.id) ? 'var(--gold)' : 'var(--white)' }}>
                  {fw.name} <span style={{ fontWeight: 400, color: 'var(--gray)', fontSize: 12 }}>— {fw.full}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>{fw.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card mb-24">
        <h3 style={{ marginBottom: 8, fontSize: 15, fontWeight: 600 }}>Additional Context <span style={{ color: 'var(--gray)', fontWeight: 400, fontSize: 13 }}>(optional)</span></h3>
        <p className="text-sm text-gray" style={{ marginBottom: 12 }}>
          Describe any additional context about this dataset that might not be obvious from the data itself (e.g. who the data subjects are, the industry sector, intended use cases).
        </p>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="e.g. This dataset contains patient records from a clinical trial. The data will be shared with academic researchers for cardiovascular disease research..."
          style={{ minHeight: 100 }}
        />
      </div>

      <div className="flex-end">
        <button
          className="btn btn-primary btn-lg"
          onClick={onGenerate}
          disabled={disabled}
        >
          Analyze Dataset & Generate Policy
        </button>
      </div>
    </div>
  );
}

function Step2Analyzing({ dataset }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <div style={{ width: 80, height: 80, border: '4px solid rgba(198,131,70,0.2)', borderTop: '4px solid var(--gold)',
          borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 24 }}>
          ◎
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Analyzing your dataset...</h2>
        <p className="text-gray" style={{ maxWidth: 480, lineHeight: 1.6 }}>
          The AI is reading <strong style={{ color: 'var(--white)' }}>{dataset.name}</strong>, scanning for
          PII (names, emails, IDs and other personal identifiers),
          GDPR Article 9 special categories (health, biometric, racial data),
          EU Data Act triggers, and cross-referencing applicable legal articles.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 400 }}>
        {[
          'Reading dataset columns and sample rows',
          'Detecting PII and sensitive fields',
          'Checking GDPR Article 9 categories',
          'Evaluating EU Data Act triggers',
          'Generating compliant policy',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
            color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)',
              animation: `spin 1s linear ${i * 0.2}s infinite` }} />
            {step}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray" style={{ marginTop: 8 }}>This may take 15–30 seconds...</p>
    </div>
  );
}

function Step3Review({ result, draft, setDraft, onSave, saving, onBack }) {
  const { analysis } = result;

  const riskColors = { low: 'var(--success)', medium: 'var(--warning)', high: '#f97316', critical: 'var(--danger)' };
  const riskColor = riskColors[analysis.risk_level] || 'var(--gray)';

  const updateDraft = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));
  const updateNested = (parent, field, value) =>
    setDraft(prev => ({ ...prev, [parent]: { ...prev[parent], [field]: value } }));

  return (
    <div>
      <div className="flex-between page-header">
        <div>
          <div className="page-title">Review AI-Generated Policy</div>
          <div className="page-sub">Review the AI findings and edit the policy before saving</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-secondary" onClick={onBack}>Regenerate</button>
          <button className="btn btn-primary btn-lg" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Policy & Bind to Dataset'}
          </button>
        </div>
      </div>

      {/* Analysis Report */}
      <div className="card mb-24" style={{ borderColor: riskColor, borderWidth: 1 }}>
        <div className="flex-between mb-16">
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>AI Analysis Report</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--gray)' }}>Risk Level</span>
            <span style={{ background: riskColor, color: '#fff', padding: '3px 10px',
              borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              {analysis.risk_level}
            </span>
            {analysis.dpia_required && (
              <span className="badge badge-red">DPIA Required</span>
            )}
          </div>
        </div>

        <div className="alert alert-info mb-16">{analysis.findings_summary}</div>

        <div className="grid-3">
          {/* PII */}
          <div>
            <div className="text-xs text-gray bold" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PII Detected ({analysis.pii_detected?.length || 0})
            </div>
            {analysis.pii_detected?.length > 0 ? (
              analysis.pii_detected.map((item, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--white)' }}>{item.field}</span>
                    <div style={{ color: 'var(--gray)', fontSize: 11 }}>{item.type?.replace(/_/g, ' ')}</div>
                  </div>
                  <span className={`badge ${item.confidence === 'high' ? 'badge-red' : item.confidence === 'medium' ? 'badge-yellow' : 'badge-gray'}`}>
                    {item.confidence}
                  </span>
                </div>
              ))
            ) : <p className="text-sm text-gray">No PII detected</p>}
          </div>

          {/* Special Categories */}
          <div>
            <div className="text-xs text-gray bold" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              GDPR Art. 9 ({analysis.special_categories_detected?.length || 0})
            </div>
            {analysis.special_categories_detected?.length > 0 ? (
              analysis.special_categories_detected.map((item, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#f97316' }}>{item.field}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 11 }}>{item.category?.replace(/_/g, ' ')}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 11 }}>{item.gdpr_article}</div>
                </div>
              ))
            ) : <p className="text-sm text-gray">No special categories</p>}
          </div>

          {/* EU Data Act */}
          <div>
            <div className="text-xs text-gray bold" style={{ marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              EU Data Act ({analysis.data_act_triggers?.length || 0})
            </div>
            {analysis.data_act_triggers?.length > 0 ? (
              analysis.data_act_triggers.map((item, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: 'var(--info)' }}>{item.field}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 11 }}>{item.trigger?.replace(/_/g, ' ')}</div>
                  <div style={{ color: 'var(--gray)', fontSize: 11 }}>{item.article}</div>
                </div>
              ))
            ) : <p className="text-sm text-gray">No Data Act triggers</p>}
          </div>
        </div>

        {analysis.dpia_required && (
          <div className="alert alert-warning mt-16">
            <strong>DPIA Required:</strong> {analysis.dpia_reason}
          </div>
        )}
      </div>

      {/* AI Explanation */}
      <div className="card mb-24" style={{ background: 'rgba(198,131,70,0.05)', borderColor: 'rgba(198,131,70,0.2)' }}>
        <h3 style={{ fontSize: 14, color: 'var(--gold)', marginBottom: 10 }}>Policy Explanation</h3>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>{draft.ai_explanation}</p>
        {draft.compliance_notes?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {draft.compliance_notes.map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12, color: 'var(--gray)' }}>
                <span style={{ color: 'var(--gold)' }}>•</span> {note}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editable Policy */}
      <div className="card mb-24">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Edit Policy</h3>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Policy Name</label>
            <input value={draft.name} onChange={e => updateDraft('name', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Legal Basis</label>
            <select value={draft.legal_basis} onChange={e => updateDraft('legal_basis', e.target.value)}>
              <option value="consent">Consent — Art. 6(1)(a)</option>
              <option value="contract">Contract — Art. 6(1)(b)</option>
              <option value="legal_obligation">Legal Obligation — Art. 6(1)(c)</option>
              <option value="vital_interests">Vital Interests — Art. 6(1)(d)</option>
              <option value="public_task">Public Task — Art. 6(1)(e)</option>
              <option value="legitimate_interests">Legitimate Interests — Art. 6(1)(f)</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea value={draft.description} onChange={e => updateDraft('description', e.target.value)} />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Retention Period (days)</label>
            <input type="number" value={draft.retention_period_days || ''}
              onChange={e => updateDraft('retention_period_days', parseInt(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Row Limit per Export</label>
            <input type="number" value={draft.row_limit || ''}
              onChange={e => updateDraft('row_limit', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Leave blank for unlimited" />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label>Geographic Scope</label>
            <select value={draft.geographic_restrictions?.mode || 'global'}
              onChange={e => updateNested('geographic_restrictions', 'mode', e.target.value)}>
              <option value="EU_only">EU Countries Only</option>
              <option value="EEA">EEA (EU + Norway, Iceland, Liechtenstein)</option>
              <option value="global">Global</option>
            </select>
          </div>
          <div className="form-group">
            <label>Max Exports per Consumer</label>
            <input type="number" value={draft.max_exports_per_consumer || ''}
              onChange={e => updateDraft('max_exports_per_consumer', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Leave blank for unlimited" />
          </div>
        </div>

        <div className="policy-section" style={{ marginBottom: 16 }}>
          <h4>Fields to Redact</h4>
          <p className="text-xs text-gray" style={{ marginBottom: 10 }}>
            These fields will be removed from all exported data. AI recommended: {analysis.recommended_redactions?.join(', ') || 'none'}
          </p>
          <TagEditor
            tags={draft.fields_to_redact || []}
            onChange={tags => updateDraft('fields_to_redact', tags)}
            placeholder="Add field name..."
          />
        </div>

        <div className="policy-section" style={{ marginBottom: 16 }}>
          <h4>Allowed Purposes</h4>
          <TagEditor
            tags={draft.allowed_purposes || []}
            onChange={tags => updateDraft('allowed_purposes', tags)}
            placeholder="e.g. academic_research..."
          />
        </div>

        <div className="policy-section" style={{ marginBottom: 16 }}>
          <h4>Allowed Roles</h4>
          <TagEditor
            tags={draft.allowed_roles || []}
            onChange={tags => updateDraft('allowed_roles', tags)}
            placeholder="e.g. academic, corporate..."
          />
        </div>

        <div className="grid-2">
          <div className="policy-section">
            <h4>Access Controls</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
              <input type="checkbox" checked={draft.requires_manual_approval}
                onChange={e => updateDraft('requires_manual_approval', e.target.checked)}
                style={{ width: 'auto' }} />
              Requires manual approval
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.requires_explicit_consent}
                onChange={e => updateDraft('requires_explicit_consent', e.target.checked)}
                style={{ width: 'auto' }} />
              Requires explicit consent
            </label>
          </div>
          <div className="policy-section">
            <h4>Data Subject Rights</h4>
            {Object.entries(draft.data_subject_rights || {}).map(([right, enabled]) => (
              <label key={right} style={{ display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', marginBottom: 6, fontSize: 13 }}>
                <input type="checkbox" checked={enabled}
                  onChange={e => setDraft(prev => ({
                    ...prev, data_subject_rights: { ...prev.data_subject_rights, [right]: e.target.checked }
                  }))} style={{ width: 'auto' }} />
                Right to {right}
              </label>
            ))}
          </div>
        </div>

        {(draft.frand_terms || draft.b2b_sharing_obligations?.length > 0) && (
          <div className="policy-section mt-16">
            <h4>EU Data Act Terms</h4>
            {draft.frand_terms && (
              <div className="form-group">
                <label>FRAND Terms</label>
                <textarea value={draft.frand_terms} onChange={e => updateDraft('frand_terms', e.target.value)} />
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={draft.switching_rights}
                onChange={e => updateDraft('switching_rights', e.target.checked)}
                style={{ width: 'auto' }} />
              Switching rights apply (Art. 23)
            </label>
          </div>
        )}
      </div>

      <div className="flex-end gap-8">
        <button className="btn btn-secondary btn-lg" onClick={onBack}>Regenerate</button>
        <button className="btn btn-primary btn-lg" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Policy & Bind to Dataset'}
        </button>
      </div>
    </div>
  );
}

function TagEditor({ tags, onChange, placeholder }) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput('');
  };

  const remove = (tag) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="tag-input-wrap">
      {tags.map(tag => (
        <span key={tag} className="tag">
          {tag} <span className="tag-remove" onClick={() => remove(tag)}>×</span>
        </span>
      ))}
      <input
        className="tag-add-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        placeholder={placeholder}
      />
    </div>
  );
}

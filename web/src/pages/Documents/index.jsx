import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getDocuments, createDocument, submitDocument, approveDocument,
  rejectDocument, escalateDocument, fileDocument, serveDocument,
  checkCompliance, classifyDoc,
} from '../../api/documents';
import { getTemplates } from '../../api/templates';
import { getCases } from '../../api/cases';
import { useAuth } from '../../context/AuthContext';
import { STATUS_COLORS } from '../../constants/colors';
import styles from './styles.module.css';

const LEVEL_1 = ['intern', 'junior_associate', 'chambering'];

export default function Documents() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = [...LEVEL_1, 'associate'].includes(role);

  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [cases, setCases] = useState([]);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState('');
  const [caseFilter, setCaseFilter] = useState(searchParams.get('case_id') ?? '');
  const [tagFilter, setTagFilter] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [formTags, setFormTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', template_id: '', case_id: '' });
  const [fileInput, setFileInput] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyDoc, setBusyDoc] = useState(null);
  const [classifyHint, setClassifyHint] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [escalateModal, setEscalateModal] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, tplRes, casesRes] = await Promise.all([
        getDocuments({ status: statusFilter || undefined, case_id: caseFilter || undefined, tag: tagFilter || undefined }),
        getTemplates(),
        getCases(),
      ]);
      setDocs(docsRes.data.data ?? []);
      setTemplates(tplRes.data.data ?? []);
      setCases(casesRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter, caseFilter, tagFilter]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      if (form.template_id) fd.append('template_id', form.template_id);
      if (form.case_id) fd.append('case_id', form.case_id);
      if (fileInput) fd.append('file', fileInput);
      formTags.forEach(t => fd.append('tags', t));
      const res = await createDocument(fd);
      const newId = res.data.data?.id;
      setShowForm(false);
      setForm({ title: '', template_id: '', case_id: '' });
      setFormTags([]);
      setTagInput('');
      setFileInput(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
      if (newId) {
        try {
          const cr = await classifyDoc(newId);
          const hint = cr.data.data;
          if (hint?.confidence > 0) setClassifyHint(hint);
        } catch { /* AI service unavailable — silently ignore */ }
      }
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to create'); }
    finally { setSaving(false); }
  };

  const withBusy = (id, action, fn) => async () => {
    const key = `${id}:${action}`;
    if (busyDoc === key) return;
    setBusyDoc(key); setActionError('');
    try { await fn(); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
    finally { setBusyDoc(null); }
  };

  const handleSubmit = (id) => withBusy(id, 'submit', () => submitDocument(id))();
  const handleApprove = (id) => withBusy(id, 'approve', () => approveDocument(id))();
  const handleFile = (id) => withBusy(id, 'file', () => fileDocument(id))();
  const handleServe = (id) => withBusy(id, 'serve', () => serveDocument(id))();

  const handleReject = async (comments) => {
    setActionError('');
    try { await rejectDocument(rejectModal, { reviewer_comments: comments }); setRejectModal(null); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleEscalate = async (reason) => {
    setActionError('');
    try { await escalateDocument(escalateModal, { escalation_reason: reason }); setEscalateModal(null); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleCheck = async (id) => {
    setCheckingId(id); setComplianceResult(null);
    try {
      const res = await checkCompliance(id);
      setComplianceResult(res.data.data);
    } catch (err) { setActionError(err.response?.data?.message ?? 'AI service unavailable'); }
    finally { setCheckingId(null); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Documents</h2>
        {canCreate && <button className={styles.btnPrimary} onClick={() => { setShowForm(true); setError(''); }}>+ New Document</button>}
      </div>

      <div className={styles.filters} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['draft','pending_associate','pending_partner','approved','filed','served','rejected'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
        <select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)} style={{ minWidth: 200 }}>
          <option value="">All cases</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            placeholder="Filter by tag…"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            style={{ width: 150, fontSize: 13 }}
          />
          {tagFilter && <button onClick={() => setTagFilter('')} style={{ fontSize: 12, padding: '4px 8px' }}>✕</button>}
        </div>
      </div>

      {actionError && <div className={styles.error}>{actionError}</div>}

      {classifyHint && (
        <div className={styles.classifyBanner}>
          <span>
            AI classified the uploaded document as <strong>{classifyHint.label}</strong>
            {' '}({Math.round(classifyHint.confidence * 100)}% confidence
            {classifyHint.auto_selected ? ' — high confidence' : ''})
          </span>
          <button onClick={() => setClassifyHint(null)}>✕</button>
        </div>
      )}

      {complianceResult && (
        <div className={styles.compliancePanel}>
          <div className={styles.complianceHeader}>
            <strong>Compliance Report</strong>
            <span style={{ color: complianceResult.compliance.compliant ? '#057a55' : '#e02424' }}>
              {complianceResult.compliance.compliant ? '✓ Passed' : `✗ ${complianceResult.compliance.issue_count} issue(s)`}
            </span>
            <button onClick={() => setComplianceResult(null)}>✕</button>
          </div>
          {complianceResult.compliance.issues.map((issue, i) => (
            <div key={i} className={`${styles.issue} ${issue.severity === 'error' ? styles.issueError : styles.issueWarn}`}>
              <strong>{issue.field.replace(/_/g,' ')}</strong>: {issue.issue}
              <span className={styles.confidence}>{Math.round(issue.confidence * 100)}% confidence</span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className={styles.formCard}>
          <h3>New Document</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleCreate} className={styles.form}>
            <div className={styles.field}><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className={styles.field}>
              <label>Template</label>
              <select value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
                <option value="">None</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Linked Case</label>
              <select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
                <option value="">None</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label>Tags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {formTags.map(t => (
                  <span key={t} className={styles.tagChip}>
                    {t}
                    <button onClick={() => setFormTags(formTags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, padding: 0, fontSize: 11 }}>✕</button>
                  </span>
                ))}
              </div>
              <input
                placeholder="Type tag, press Enter…"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault();
                    const t = tagInput.trim().replace(/,+$/, '');
                    if (t && !formTags.includes(t)) setFormTags([...formTags, t]);
                    setTagInput('');
                  }
                }}
                style={{ fontSize: 13 }}
              />
            </div>
            <div className={styles.field}>
              <label>Word File (.docx)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={(e) => setFileInput(e.target.files[0] ?? null)}
              />
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={() => { setShowForm(false); setFileInput(null); setForm({ title: '', template_id: '', case_id: '' }); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Create Draft'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Loading…</p> : (
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Title</th><th>Case</th><th>Status</th><th>File</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={6} className={styles.empty}>No documents found.</td></tr>}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link to={`/documents/${d.id}`}>{d.title}</Link>
                    {d.tags?.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {d.tags.map(t => (
                          <span key={t} className={styles.tagChip} style={{ cursor: 'pointer' }} onClick={() => setTagFilter(t)}>{t}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {d.case_file
                      ? <Link to={`/cases/${d.case_file.id}`}>{d.case_file.case_number}</Link>
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className={styles.badge} style={{ background: (STATUS_COLORS[d.status] ?? '#6b7280') + '20', color: STATUS_COLORS[d.status] ?? '#6b7280' }}>
                      {d.status.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{d.file_name ? `v${d.file_version} · ${d.file_name}` : '—'}</td>
                  <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className={styles.rowActions}>
                    <button onClick={() => handleCheck(d.id)} disabled={checkingId === d.id}>{checkingId === d.id ? '…' : 'Check'}</button>
                    {[...LEVEL_1, 'associate'].includes(role) && ['draft','rejected'].includes(d.status) && (
                      <button className={styles.btnPrimary} onClick={() => handleSubmit(d.id)} disabled={busyDoc === `${d.id}:submit`}>{busyDoc === `${d.id}:submit` ? '…' : 'Submit'}</button>
                    )}
                    {role === 'associate' && d.status === 'pending_associate' && (<>
                      <button className={styles.btnSuccess} onClick={() => handleApprove(d.id)} disabled={busyDoc === `${d.id}:approve`}>{busyDoc === `${d.id}:approve` ? '…' : 'Approve'}</button>
                      <button className={styles.btnSuccess} onClick={() => setEscalateModal(d.id)}>Escalate</button>
                      <button className={styles.btnDanger} onClick={() => setRejectModal(d.id)}>Reject</button>
                    </>)}
                    {role === 'associate' && d.status === 'approved' && (
                      <button className={styles.btnSuccess} onClick={() => handleFile(d.id)} disabled={busyDoc === `${d.id}:file`}>{busyDoc === `${d.id}:file` ? '…' : 'Mark Filed'}</button>
                    )}
                    {role === 'partner' && d.status === 'pending_partner' && (<>
                      <button className={styles.btnSuccess} onClick={() => handleApprove(d.id)} disabled={busyDoc === `${d.id}:approve`}>{busyDoc === `${d.id}:approve` ? '…' : 'Approve'}</button>
                      <button className={styles.btnDanger} onClick={() => setRejectModal(d.id)}>Reject</button>
                    </>)}
                    {role === 'admin' && d.status === 'filed' && (
                      <button className={styles.btnSuccess} onClick={() => handleServe(d.id)} disabled={busyDoc === `${d.id}:serve`}>{busyDoc === `${d.id}:serve` ? '…' : 'Mark Served'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rejectModal && <CommentModal title="Reject Document" label="Reviewer comments" onConfirm={handleReject} onCancel={() => setRejectModal(null)} />}
      {escalateModal && <CommentModal title="Escalate to Partner" label="Escalation reason" onConfirm={handleEscalate} onCancel={() => setEscalateModal(null)} />}
    </div>
  );
}

function CommentModal({ title, label, onConfirm, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>{title}</h3>
        <div className={styles.field}>
          <label>{label} *</label>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
        <div className={styles.actions}>
          <button onClick={onCancel}>Cancel</button>
          <button className={styles.btnPrimary} onClick={() => { if (text.trim()) onConfirm(text.trim()); }} disabled={!text.trim()}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

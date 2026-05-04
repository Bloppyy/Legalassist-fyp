import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDocuments, createDocument, submitDocument, approveDocument,
  rejectDocument, escalateDocument, fileDocument, serveDocument,
  checkCompliance,
} from '../../api/documents';
import { getTemplates } from '../../api/templates';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const STATUS_COLORS = {
  draft: '#6b7280', pending_associate: '#c27803', pending_partner: '#7e3af2',
  approved: '#057a55', filed: '#1c64f2', served: '#0694a2', rejected: '#e02424',
};

const LEVEL_1 = ['intern', 'junior_associate', 'chambering'];

export default function Documents() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canCreate = [...LEVEL_1, 'associate'].includes(role);

  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', template_id: '' });
  const [fileInput, setFileInput] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [escalateModal, setEscalateModal] = useState(null);
  const [complianceResult, setComplianceResult] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [docsRes, tplRes] = await Promise.all([
        getDocuments({ status: statusFilter || undefined }),
        getTemplates(),
      ]);
      setDocs(docsRes.data.data ?? []);
      setTemplates(tplRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      if (form.template_id) fd.append('template_id', form.template_id);
      if (fileInput) fd.append('file', fileInput);
      await createDocument(fd);
      setShowForm(false);
      setForm({ title: '', template_id: '' });
      setFileInput(null);
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to create'); }
    finally { setSaving(false); }
  };

  const handleSubmit = async (id) => {
    setActionError('');
    try { await submitDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleApprove = async (id) => {
    setActionError('');
    try { await approveDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleFile = async (id) => {
    setActionError('');
    try { await fileDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleServe = async (id) => {
    setActionError('');
    try { await serveDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

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

      <div className={styles.filters}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['draft','pending_associate','pending_partner','approved','filed','served','rejected'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
      </div>

      {actionError && <div className={styles.error}>{actionError}</div>}

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
              <label>Word File (.docx)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={(e) => setFileInput(e.target.files[0] ?? null)}
              />
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={() => { setShowForm(false); setFileInput(null); if (fileRef.current) fileRef.current.value = ''; }}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Create Draft'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Loading…</p> : (
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>File</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={5} className={styles.empty}>No documents found.</td></tr>}
              {docs.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/documents/${d.id}`}>{d.title}</Link></td>
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
                      <button className={styles.btnPrimary} onClick={() => handleSubmit(d.id)}>Submit</button>
                    )}
                    {role === 'associate' && d.status === 'pending_associate' && (<>
                      <button className={styles.btnSuccess} onClick={() => handleApprove(d.id)}>Approve</button>
                      <button className={styles.btnSuccess} onClick={() => setEscalateModal(d.id)}>Escalate</button>
                      <button className={styles.btnDanger} onClick={() => setRejectModal(d.id)}>Reject</button>
                    </>)}
                    {role === 'associate' && d.status === 'approved' && (
                      <button className={styles.btnSuccess} onClick={() => handleFile(d.id)}>Mark Filed</button>
                    )}
                    {role === 'partner' && d.status === 'pending_partner' && (<>
                      <button className={styles.btnSuccess} onClick={() => handleApprove(d.id)}>Approve</button>
                      <button className={styles.btnDanger} onClick={() => setRejectModal(d.id)}>Reject</button>
                    </>)}
                    {role === 'admin' && d.status === 'filed' && (
                      <button className={styles.btnSuccess} onClick={() => handleServe(d.id)}>Mark Served</button>
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

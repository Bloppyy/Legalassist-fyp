import { useState, useEffect } from 'react';
import { getFirmDeadlines, createFirmDeadline, updateFirmDeadline, toggleFirmDeadline, deleteFirmDeadline } from '../../api/firmDeadlines';
import { getCases } from '../../api/cases';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const CATEGORIES = [
  { value: 'internal_drafting',   label: 'Internal Drafting',   icon: '📝' },
  { value: 'client_update',       label: 'Client Update',       icon: '👤' },
  { value: 'file_review',         label: 'File Review',         icon: '📁' },
  { value: 'document_retention',  label: 'Document Retention',  icon: '🗄' },
  { value: 'billing',             label: 'Billing',             icon: '💰' },
  { value: 'trust_accounting',    label: 'Trust Accounting',    icon: '🏦' },
  { value: 'cle',                 label: 'CLE',                 icon: '🎓' },
  { value: 'insurance',           label: 'Insurance',           icon: '🛡' },
  { value: 'other',               label: 'Other',               icon: '📌' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));

const EMPTY_FORM = {
  title: '', category: '', deadline_date: '', court_name: '',
  case_id: '', remarks: '', buffer_days: '', actual_deadline_date: '',
};

function isOverdue(dateStr, completed) {
  if (completed) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function FirmDeadlines() {
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [deadlines, setDeadlines] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        getFirmDeadlines({ category: categoryFilter || undefined }),
        getCases(),
      ]);
      setDeadlines(dRes.data.data ?? []);
      setCases(cRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [categoryFilter]);

  const openNew = () => {
    setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError('');
  };
  const openEdit = (d) => {
    setEditing(d.id);
    setForm({
      title:                d.title ?? '',
      category:             d.category ?? '',
      deadline_date:        d.deadline_date?.slice(0, 10) ?? '',
      court_name:           d.court_name ?? '',
      case_id:              d.case_id ?? '',
      remarks:              d.remarks ?? '',
      buffer_days:          d.buffer_days ?? '',
      actual_deadline_date: d.actual_deadline_date?.slice(0, 10) ?? '',
    });
    setShowForm(true); setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        case_id:              form.case_id || undefined,
        court_name:           form.court_name || undefined,
        remarks:              form.remarks || undefined,
        buffer_days:          form.buffer_days ? parseInt(form.buffer_days) : undefined,
        actual_deadline_date: form.actual_deadline_date || undefined,
        category:             form.category || undefined,
      };
      if (editing) await updateFirmDeadline(editing, payload);
      else         await createFirmDeadline(payload);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try { await toggleFirmDeadline(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deadline?')) return;
    try { await deleteFirmDeadline(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  const active    = deadlines.filter(d => !d.is_completed);
  const completed = deadlines.filter(d => d.is_completed);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h2>Firm Deadlines</h2>
          <p className={styles.subtitle}>Internal, administrative, and practice management deadlines</p>
        </div>
        {canWrite && <button className={styles.btnPrimary} onClick={openNew}>+ New Deadline</button>}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
        </select>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Deadline' : 'New Firm Deadline'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Submit pre-bill for April" />
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="">— None —</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Due Date *</label>
                <input type="date" value={form.deadline_date} onChange={e => setForm({ ...form, deadline_date: e.target.value })} required />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Case File</label>
                <select value={form.case_id} onChange={e => setForm({ ...form, case_id: e.target.value })}>
                  <option value="">None (firm-wide)</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Court Name</label>
                <input value={form.court_name} onChange={e => setForm({ ...form, court_name: e.target.value })} placeholder="e.g. Mahkamah Tinggi Melaka" />
              </div>
            </div>

            {/* Buffer deadline fields */}
            <div className={styles.bufferBox}>
              <div className={styles.bufferTitle}>Buffer Deadline (optional)</div>
              <div className={styles.bufferSub}>
                Set this deadline earlier than the actual external deadline to create a safety buffer.
              </div>
              <div className={styles.row} style={{ marginTop: 10 }}>
                <div className={styles.field}>
                  <label>Days Early</label>
                  <input
                    type="number" min="0" max="365"
                    value={form.buffer_days}
                    onChange={e => setForm({ ...form, buffer_days: e.target.value })}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className={styles.field}>
                  <label>Actual External Deadline</label>
                  <input
                    type="date"
                    value={form.actual_deadline_date}
                    onChange={e => setForm({ ...form, actual_deadline_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label>Remarks</label>
              <textarea rows={2} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Active deadlines table */}
      {loading ? <p>Loading…</p> : (
        <>
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Due Date</th>
                  <th>Case</th>
                  <th>Buffer</th>
                  <th>Remarks</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {active.length === 0 && (
                  <tr><td colSpan={8} className={styles.empty}>No active deadlines.</td></tr>
                )}
                {active.map(d => {
                  const overdue = isOverdue(d.deadline_date, d.is_completed);
                  const cat = CAT_MAP[d.category];
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.title}</strong></td>
                      <td>{cat ? `${cat.icon} ${cat.label}` : '—'}</td>
                      <td className={overdue ? styles.overdue : ''}>
                        {new Date(d.deadline_date + 'T00:00:00').toLocaleDateString('en-MY')}
                      </td>
                      <td>{d.case_file?.case_number ?? <span style={{ color: 'var(--color-text-muted)' }}>Firm-wide</span>}</td>
                      <td>
                        {d.buffer_days
                          ? <span className={styles.bufferBadge}>{d.buffer_days}d early</span>
                          : '—'}
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 160 }}>{d.remarks ?? '—'}</td>
                      <td>
                        {overdue
                          ? <span className={styles.overdue} style={{ fontSize: 12 }}>Overdue</span>
                          : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pending</span>}
                      </td>
                      <td className={styles.rowActions}>
                        <button className={styles.btnToggle} onClick={() => handleToggle(d.id)}>Done</button>
                        {canWrite && <button onClick={() => openEdit(d)}>Edit</button>}
                        {canWrite && <button className={styles.btnDanger} onClick={() => handleDelete(d.id)}>Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Completed section */}
          {completed.length > 0 && (
            <div className={styles.completedSection}>
              <button
                className={styles.completedToggle}
                onClick={() => setShowCompleted(v => !v)}
              >
                {showCompleted ? '▲' : '▼'} Completed Deadlines ({completed.length})
              </button>
              {showCompleted && (
                <div className={styles.tableWrap} style={{ marginTop: 0, borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)' }}>
                  <table>
                    <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Case</th><th colSpan={3}>Remarks</th><th></th></tr></thead>
                    <tbody>
                      {completed.map(d => {
                        const cat = CAT_MAP[d.category];
                        return (
                          <tr key={d.id} style={{ opacity: 0.6 }}>
                            <td><strong>{d.title}</strong></td>
                            <td>{cat ? `${cat.icon} ${cat.label}` : '—'}</td>
                            <td>{new Date(d.deadline_date + 'T00:00:00').toLocaleDateString('en-MY')}</td>
                            <td>{d.case_file?.case_number ?? <span style={{ color: 'var(--color-text-muted)' }}>Firm-wide</span>}</td>
                            <td colSpan={3}>{d.remarks ?? '—'}</td>
                            <td className={styles.rowActions}>
                              <button className={styles.btnToggleDone} onClick={() => handleToggle(d.id)}>Undo</button>
                              {canWrite && <button className={styles.btnDanger} onClick={() => handleDelete(d.id)}>Delete</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

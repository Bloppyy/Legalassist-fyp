import { useEffect, useState } from 'react';
import { getDeadlines, createDeadline, updateDeadline, toggleComplete, deleteDeadline } from '../../api/deadlines';
import { getCases } from '../../api/cases';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const EMPTY_FORM = { title: '', case_id: '', court_name: '', deadline_date: '', court_directions: '' };

function isOverdue(dateStr, completed) {
  if (completed) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function Deadlines() {
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [deadlines, setDeadlines] = useState([]);
  const [cases, setCases] = useState([]);
  const [caseFilter, setCaseFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        getDeadlines({ case_id: caseFilter || undefined }),
        getCases(),
      ]);
      setDeadlines(dRes.data.data ?? []);
      setCases(cRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [caseFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(''); };
  const openEdit = (d) => {
    setEditing(d.id);
    setForm({
      title: d.title ?? '',
      case_id: d.case_id ?? '',
      court_name: d.court_name ?? '',
      deadline_date: d.deadline_date?.slice(0, 10) ?? '',
      court_directions: d.court_directions ?? '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, case_id: form.case_id || undefined };
      if (editing) await updateDeadline(editing, payload);
      else await createDeadline(payload);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id) => {
    try { await toggleComplete(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this deadline?')) return;
    try { await deleteDeadline(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Court Deadlines</h2>
        {canWrite && <button className={styles.btnPrimary} onClick={openNew}>+ New Deadline</button>}
      </div>

      <div className={styles.filters}>
        <select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value)}>
          <option value="">All cases</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Deadline' : 'New Deadline'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Case Management Conference" /></div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Case File</label>
                <select value={form.case_id} onChange={(e) => setForm({ ...form, case_id: e.target.value })}>
                  <option value="">None</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.case_number} — {c.client_name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label>Deadline Date *</label>
                <input type="date" value={form.deadline_date} onChange={(e) => setForm({ ...form, deadline_date: e.target.value })} required />
              </div>
            </div>
            <div className={styles.field}><label>Court Name *</label><input value={form.court_name} onChange={(e) => setForm({ ...form, court_name: e.target.value })} required placeholder="e.g. Mahkamah Tinggi Melaka" /></div>
            <div className={styles.field}><label>Court Directions / Other Remarks</label><textarea rows={2} value={form.court_directions} onChange={(e) => setForm({ ...form, court_directions: e.target.value })} /></div>
            <div className={styles.actions}>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Loading…</p> : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Court</th>
                <th>Date</th>
                <th>Case</th>
                <th>Court Directions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deadlines.length === 0 && <tr><td colSpan={7} className={styles.empty}>No deadlines found.</td></tr>}
              {deadlines.map((d) => {
                const overdue = isOverdue(d.deadline_date, d.is_completed);
                return (
                  <tr key={d.id} className={d.is_completed ? styles.completed : ''}>
                    <td><strong>{d.title}</strong></td>
                    <td>{d.court_name}</td>
                    <td className={overdue ? styles.overdue : ''}>{new Date(d.deadline_date).toLocaleDateString()}</td>
                    <td>{d.case_file?.case_number ?? '—'}</td>
                    <td style={{ maxWidth: 200, fontSize: 13 }}>{d.court_directions ?? '—'}</td>
                    <td>
                      {d.is_completed ? (
                        <span style={{ color: 'var(--color-success)', fontSize: 13 }}>Done</span>
                      ) : overdue ? (
                        <span className={styles.overdue} style={{ fontSize: 13 }}>Overdue</span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Pending</span>
                      )}
                    </td>
                    <td className={styles.rowActions}>
                      <button
                        className={d.is_completed ? styles.btnToggleDone : styles.btnToggle}
                        onClick={() => handleToggle(d.id)}
                      >
                        {d.is_completed ? 'Undo' : 'Done'}
                      </button>
                      {canWrite && <button onClick={() => openEdit(d)}>Edit</button>}
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
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCases, createCase, updateCase, deleteCase } from '../../api/cases';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const EMPTY_FORM = {
  case_number: '', file_number: '', year: new Date().getFullYear(),
  client_name: '', description: '',
  storage_room: '', storage_box: '', storage_notes: '',
};

export default function Cases() {
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);
  const canDelete = ['partner', 'admin'].includes(profile?.role);

  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCases({ search: search || undefined, status: statusFilter || undefined });
      setCases(res.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(''); };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({
      case_number: c.case_number, file_number: c.file_number ?? '',
      year: c.year, client_name: c.client_name, description: c.description ?? '',
      storage_room: c.storage_room ?? '', storage_box: c.storage_box ?? '', storage_notes: c.storage_notes ?? '',
    });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, file_number: form.file_number || undefined };
      if (editing) await updateCase(editing, payload);
      else await createCase(payload);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this case file?')) return;
    try { await deleteCase(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Case Files</h2>
        {canWrite && <button className={styles.btnPrimary} onClick={openNew}>+ New Case</button>}
      </div>

      <div className={styles.filters}>
        <input placeholder="Search case number, file number, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Case' : 'New Case File'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.field}><label>Case Number *</label><input value={form.case_number} onChange={(e) => setForm({ ...form, case_number: e.target.value })} required /></div>
              <div className={styles.field}><label>File Number</label><input value={form.file_number} onChange={(e) => setForm({ ...form, file_number: e.target.value })} placeholder="Internal file reference" /></div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>Year *</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: +e.target.value })} required /></div>
              <div className={styles.field}><label>Client Name *</label><input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} required /></div>
            </div>
            <div className={styles.field}><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className={styles.row}>
              <div className={styles.field}><label>Storage Room</label><input value={form.storage_room} onChange={(e) => setForm({ ...form, storage_room: e.target.value })} placeholder="e.g. Room A" /></div>
              <div className={styles.field}><label>Storage Box</label><input value={form.storage_box} onChange={(e) => setForm({ ...form, storage_box: e.target.value })} placeholder="e.g. Box 12" /></div>
            </div>
            <div className={styles.field}><label>Storage Notes</label><input value={form.storage_notes} onChange={(e) => setForm({ ...form, storage_notes: e.target.value })} placeholder="Additional storage details" /></div>
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
            <thead><tr><th>Case No.</th><th>File No.</th><th>Year</th><th>Client</th><th>Status</th><th>Assigned To</th><th></th></tr></thead>
            <tbody>
              {cases.length === 0 && <tr><td colSpan={7} className={styles.empty}>No cases found.</td></tr>}
              {cases.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/cases/${c.id}`}>{c.case_number}</Link></td>
                  <td>{c.file_number ?? '—'}</td>
                  <td>{c.year}</td>
                  <td>{c.client_name}</td>
                  <td><span className={`${styles.badge} ${c.status === 'active' ? styles.active : styles.closed}`}>{c.status}</span></td>
                  <td>{c.assigned_user?.name ?? '—'}</td>
                  <td className={styles.rowActions}>
                    {canWrite && <button onClick={() => openEdit(c)}>Edit</button>}
                    {canDelete && <button className={styles.btnDanger} onClick={() => handleDelete(c.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

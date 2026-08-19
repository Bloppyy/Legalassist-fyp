import { useEffect, useState } from 'react';
import { getContacts, createContact, updateContact, deleteContact } from '../../api/contacts';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const EMPTY_FORM = { name: '', job_title: '', address: '', state: '', phone: '', email: '' };

export default function Contacts() {
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getContacts({ search: search || undefined });
      setContacts(res.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(''); };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({ name: c.name, job_title: c.job_title ?? '', address: c.address ?? '', state: c.state ?? '', phone: c.phone ?? '', email: c.email ?? '' });
    setShowForm(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editing) await updateContact(editing, form);
      else await createContact(form);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try { await deleteContact(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Contacts</h2>
        {canWrite && <button className={styles.btnPrimary} onClick={openNew}>+ New Contact</button>}
      </div>

      <div className={styles.filters}>
        <input placeholder="Search name, address, state…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Contact' : 'New Contact'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.field}><label>Full Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className={styles.field}><label>Job Title</label><input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Mahkamah Tinggi Melaka" /></div>
              <div className={styles.field}><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Melaka" /></div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className={styles.field}><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
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
                <th>Name</th>
                <th>Job Title</th>
                <th>Address</th>
                <th>State</th>
                <th>Phone</th>
                <th>Email</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && <tr><td colSpan={canWrite ? 7 : 6} className={styles.empty}>No contacts found.</td></tr>}
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.job_title ?? '—'}</td>
                  <td>{c.address ?? '—'}</td>
                  <td>{c.state ?? '—'}</td>
                  <td className={styles.phone}>{c.phone ?? '—'}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
                  {canWrite && (
                    <td className={styles.rowActions}>
                      <button onClick={() => openEdit(c)}>Edit</button>
                      <button className={styles.btnDanger} onClick={() => handleDelete(c.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, downloadTemplate, getCategories, createCategory, deleteCategory } from '../../api/templates';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const EMPTY_FORM = { title: '', category_id: '', instructions: '' };

export default function Templates() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canWrite = ['associate', 'partner', 'admin'].includes(role);

  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fileInput, setFileInput] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, cRes] = await Promise.all([
        getTemplates({ search: search || undefined, category_id: catFilter || undefined }),
        getCategories(),
      ]);
      setTemplates(tRes.data.data ?? []);
      setCategories(cRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, catFilter]);

  const openNew = () => {
    setEditing(null); setForm(EMPTY_FORM); setFileInput(null); setShowForm(true); setError('');
    if (fileRef.current) fileRef.current.value = '';
  };
  const openEdit = (t) => {
    setEditing(t.id);
    setForm({ title: t.title, category_id: t.category_id ?? '', instructions: t.instructions ?? '' });
    setFileInput(null);
    setShowForm(true);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      if (form.category_id) fd.append('category_id', form.category_id);
      if (form.instructions) fd.append('instructions', form.instructions);
      if (fileInput) fd.append('file', fileInput);
      if (editing) await updateTemplate(editing, fd);
      else await createTemplate(fd);
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDownload = async (id) => {
    setDownloading(id);
    try {
      const res = await downloadTemplate(id);
      window.open(res.data.data.url, '_blank');
    } catch (err) {
      alert(err.response?.data?.message ?? 'Download failed');
    } finally { setDownloading(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try { await deleteTemplate(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      await createCategory({ name: newCatName.trim() });
      setNewCatName('');
      load();
    } catch (err) { alert(err.response?.data?.message ?? 'Failed to create category'); }
    finally { setSavingCat(false); }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"? Templates using it will lose their category.`)) return;
    try { await deleteCategory(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete category'); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Templates</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {role === 'admin' && (
            <button onClick={() => setShowCatManager((v) => !v)}>
              {showCatManager ? 'Hide Categories' : 'Manage Categories'}
            </button>
          )}
          {canWrite && <button className={styles.btnPrimary} onClick={openNew}>+ New Template</button>}
        </div>
      </div>

      {showCatManager && (
        <div className={styles.formCard} style={{ marginBottom: 20 }}>
          <h3>Template Categories</h3>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              style={{ flex: 1 }}
              placeholder="New category name…"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              required
            />
            <button type="submit" className={styles.btnPrimary} disabled={savingCat}>
              {savingCat ? 'Adding…' : 'Add'}
            </button>
          </form>
          {categories.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No categories yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c) => (
                <span key={c.id} className={styles.badge} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {c.name}
                  <button
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1 }}
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.filters}>
        <input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Template' : 'New Template'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className={styles.field}>
              <label>Category</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className={styles.field}><label>Instructions</label><textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Usage instructions for interns…" /></div>
            <div className={styles.field}>
              <label>Word File (.docx){editing ? ' — upload to replace' : ''}</label>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={(e) => setFileInput(e.target.files[0] ?? null)}
              />
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
                <th>Title</th>
                <th>Category</th>
                <th>Instructions</th>
                <th>File</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 && <tr><td colSpan={5} className={styles.empty}>No templates found.</td></tr>}
              {templates.map((t) => (
                <>
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.category?.name ? <span className={styles.badge}>{t.category.name}</span> : '—'}</td>
                    <td style={{ maxWidth: 240, fontSize: 13, color: 'var(--color-text-muted)' }}>{t.instructions ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{t.file_name ?? '—'}</td>
                    <td className={styles.rowActions}>
                      {t.file_url && (
                        <button
                          className={styles.btnSuccess}
                          onClick={() => handleDownload(t.id)}
                          disabled={downloading === t.id}
                        >
                          {downloading === t.id ? '…' : 'Download'}
                        </button>
                      )}
                      {!t.file_url && <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}>{expanded === t.id ? 'Hide' : 'View'}</button>}
                      {canWrite && <button onClick={() => openEdit(t)}>Edit</button>}
                      {['partner', 'admin'].includes(role) && <button className={styles.btnDanger} onClick={() => handleDelete(t.id)}>Delete</button>}
                    </td>
                  </tr>
                  {expanded === t.id && (
                    <tr key={`${t.id}-preview`}>
                      <td colSpan={5}>
                        <div className={styles.previewBox}>{t.content ?? '(no content)'}</div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

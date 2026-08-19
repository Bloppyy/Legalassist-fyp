import { useEffect, useRef, useState } from 'react';
import { getGuidelines, createGuideline, updateGuideline, deleteGuideline, downloadGuideline } from '../../api/guidelines';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import styles from './styles.module.css';

const CATEGORIES = [
  { value: 'court_filing_website', label: 'Court Filing Website' },
  { value: 'case_management', label: 'Case Management' },
  { value: 'payment_for_filing', label: 'Payment for Filing' },
  { value: 'file_new_cases', label: 'File New Cases' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = { title: '', content: '', category: '', state: '', registry_url: '', order_index: 0 };

export default function Guidelines() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const toast = useToast();

  const [guidelines, setGuidelines] = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fileInput, setFileInput] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getGuidelines({ category: catFilter || undefined });
      setGuidelines(res.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [catFilter]);

  const openNew = () => {
    setEditing(null); setForm(EMPTY_FORM); setFileInput(null); setShowForm(true); setError('');
    if (fileRef.current) fileRef.current.value = '';
  };
  const openEdit = (g) => {
    setEditing(g.id);
    setForm({
      title: g.title, content: g.content ?? '', category: g.category ?? '',
      state: g.state ?? '', registry_url: g.registry_url ?? '', order_index: g.order_index ?? 0,
    });
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
      if (form.content) fd.append('content', form.content);
      if (form.category) fd.append('category', form.category);
      if (form.state) fd.append('state', form.state);
      if (form.registry_url) fd.append('registry_url', form.registry_url);
      fd.append('order_index', form.order_index ?? 0);
      if (fileInput) fd.append('file', fileInput);
      if (editing) { await updateGuideline(editing, fd); toast('Guideline updated'); }
      else { await createGuideline(fd); toast('Guideline created'); }
      setShowForm(false); load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleViewPdf = async (g) => {
    if (pdfUrl?.id === g.id) { setPdfUrl(null); return; }
    setDownloading(g.id);
    try {
      const res = await downloadGuideline(g.id);
      setPdfUrl({ id: g.id, url: res.data.data.url });
    } catch (err) {
      alert(err.response?.data?.message ?? 'Failed to load PDF');
    } finally { setDownloading(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this guideline?')) return;
    try { await deleteGuideline(id); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Court Guidelines</h2>
        {isAdmin && <button className={styles.btnPrimary} onClick={openNew}>+ New Guideline</button>}
      </div>

      {/* Category tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${catFilter === '' ? styles.tabActive : ''}`}
          onClick={() => setCatFilter('')}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            className={`${styles.tab} ${catFilter === c.value ? styles.tabActive : ''}`}
            onClick={() => setCatFilter(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h3>{editing ? 'Edit Guideline' : 'New Guideline'}</h3>
          {error && <div className={styles.error}>{error}</div>}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.row}>
              <div className={styles.field}><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className={styles.field}>
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">None</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.field}><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Melaka" /></div>
              <div className={styles.field}><label>Order</label><input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: e.target.value })} /></div>
            </div>
            <div className={styles.field}><label>Registry URL</label><input value={form.registry_url} onChange={(e) => setForm({ ...form, registry_url: e.target.value })} placeholder="https://…" /></div>
            <div className={styles.field}><label>PDF File{editing ? ' — upload to replace' : ''}</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFileInput(e.target.files[0] ?? null)}
              />
            </div>
            <div className={styles.field}><label>Content / Notes</label><textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Optional text notes…" /></div>
            <div className={styles.actions}>
              <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Loading…</p> : guidelines.length === 0 ? (
        <div className={styles.empty}>No guidelines found.</div>
      ) : (
        <div className={styles.grid}>
          {guidelines.map((g) => (
            <div key={g.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardTitle}>{g.title}</div>
                  {g.category && (
                    <div className={styles.cardSection}>
                      {CATEGORIES.find(c => c.value === g.category)?.label ?? g.category}
                    </div>
                  )}
                </div>
                <div className={styles.cardHeaderRight}>
                  {g.file_url && (
                    <button
                      className={styles.btnSuccess}
                      onClick={() => handleViewPdf(g)}
                      disabled={downloading === g.id}
                    >
                      {downloading === g.id ? '…' : pdfUrl?.id === g.id ? 'Hide PDF' : 'View PDF'}
                    </button>
                  )}
                  {g.registry_url && (
                    <a className={styles.registryLink} href={g.registry_url} target="_blank" rel="noopener noreferrer">
                      ↗ Registry
                    </a>
                  )}
                  {isAdmin && <button onClick={() => openEdit(g)}>Edit</button>}
                  {isAdmin && <button className={styles.btnDanger} onClick={() => handleDelete(g.id)}>Delete</button>}
                </div>
              </div>

              {g.content && (
                <div className={styles.cardBody}>
                  <div className={styles.contentText}>{g.content}</div>
                </div>
              )}

              {pdfUrl?.id === g.id && (
                <div className={styles.pdfWrap}>
                  <iframe
                    src={pdfUrl.url}
                    title={g.title}
                    className={styles.pdfFrame}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

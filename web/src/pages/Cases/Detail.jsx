import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCase, getCaseHistory, updateCase } from '../../api/cases';
import { getDeadlines, createDeadline, updateDeadline, toggleComplete, deleteDeadline } from '../../api/deadlines';
import { useAuth } from '../../context/AuthContext';
import styles from './detail.module.css';

const EMPTY_DL = { title: '', court_name: '', deadline_date: '', court_directions: '' };

function isOverdue(dateStr, completed) {
  if (completed) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [caseFile, setCaseFile] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Case edit state
  const [editingCase, setEditingCase] = useState(false);
  const [caseForm, setCaseForm] = useState({});
  const [caseSaving, setCaseSaving] = useState(false);
  const [caseError, setCaseError] = useState('');

  // Deadline form state
  const [showDlForm, setShowDlForm] = useState(false);
  const [dlForm, setDlForm] = useState(EMPTY_DL);
  const [dlEditing, setDlEditing] = useState(null);
  const [dlSaving, setDlSaving] = useState(false);
  const [dlError, setDlError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([getCase(id), getDeadlines({ case_id: id })]);
      setCaseFile(cRes.data.data);
      setDeadlines(dRes.data.data ?? []);
    } catch {
      navigate('/cases', { replace: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getCaseHistory(id);
      setHistory(res.data.data ?? []);
    } finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) loadHistory();
    setShowHistory((v) => !v);
  };

  const startEditCase = () => {
    setCaseForm({
      case_number: caseFile.case_number,
      file_number: caseFile.file_number ?? '',
      year: caseFile.year,
      client_name: caseFile.client_name,
      description: caseFile.description ?? '',
      storage_room: caseFile.storage_room ?? '',
      storage_box: caseFile.storage_box ?? '',
      storage_notes: caseFile.storage_notes ?? '',
    });
    setEditingCase(true);
    setCaseError('');
  };

  const handleSaveCase = async (e) => {
    e.preventDefault(); setCaseSaving(true); setCaseError('');
    try {
      await updateCase(id, caseForm);
      setEditingCase(false);
      load();
      if (showHistory) loadHistory();
    } catch (err) {
      setCaseError(err.response?.data?.message ?? 'Failed to save');
    } finally { setCaseSaving(false); }
  };

  const openNewDl = () => { setDlEditing(null); setDlForm(EMPTY_DL); setShowDlForm(true); setDlError(''); };
  const openEditDl = (d) => {
    setDlEditing(d.id);
    setDlForm({
      title: d.title ?? '',
      court_name: d.court_name ?? '',
      deadline_date: d.deadline_date?.slice(0, 10) ?? '',
      court_directions: d.court_directions ?? '',
    });
    setShowDlForm(true);
    setDlError('');
  };

  const handleSaveDl = async (e) => {
    e.preventDefault(); setDlSaving(true); setDlError('');
    try {
      const payload = { ...dlForm, case_id: id };
      if (dlEditing) await updateDeadline(dlEditing, payload);
      else await createDeadline(payload);
      setShowDlForm(false);
      load();
    } catch (err) {
      setDlError(err.response?.data?.message ?? 'Failed to save');
    } finally { setDlSaving(false); }
  };

  const handleToggle = async (dlId) => {
    try { await toggleComplete(dlId); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed'); }
  };

  const handleDeleteDl = async (dlId) => {
    if (!window.confirm('Delete this deadline?')) return;
    try { await deleteDeadline(dlId); load(); }
    catch (err) { alert(err.response?.data?.message ?? 'Failed to delete'); }
  };

  if (loading) return <p>Loading…</p>;
  if (!caseFile) return null;

  return (
    <div>
      <Link to="/cases" className={styles.back}>← Back to Case Files</Link>

      {/* Case header */}
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2>{caseFile.case_number}</h2>
          <span className={`${styles.badge} ${caseFile.status === 'active' ? styles.active : styles.closed}`}>
            {caseFile.status}
          </span>
        </div>
        {canWrite && !editingCase && (
          <div className={styles.headerActions}>
            <button className={styles.btnPrimary} onClick={startEditCase}>Edit Case</button>
          </div>
        )}
      </div>

      {/* Case edit form */}
      {editingCase && (
        <div className={styles.section} style={{ marginBottom: 20 }}>
          <div className={styles.sectionHeader}><h3>Edit Case</h3></div>
          <div style={{ padding: '16px 20px' }}>
            {caseError && <div className={styles.error}>{caseError}</div>}
            <form onSubmit={handleSaveCase} className={styles.form}>
              <div className={styles.row}>
                <div className={styles.field}><label>Case Number *</label><input value={caseForm.case_number} onChange={(e) => setCaseForm({ ...caseForm, case_number: e.target.value })} required /></div>
                <div className={styles.field}><label>File Number</label><input value={caseForm.file_number} onChange={(e) => setCaseForm({ ...caseForm, file_number: e.target.value })} /></div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}><label>Year *</label><input type="number" value={caseForm.year} onChange={(e) => setCaseForm({ ...caseForm, year: +e.target.value })} required /></div>
                <div className={styles.field}><label>Client Name *</label><input value={caseForm.client_name} onChange={(e) => setCaseForm({ ...caseForm, client_name: e.target.value })} required /></div>
              </div>
              <div className={styles.field}><label>Description</label><textarea rows={2} value={caseForm.description} onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })} /></div>
              <div className={styles.row}>
                <div className={styles.field}><label>Storage Room</label><input value={caseForm.storage_room} onChange={(e) => setCaseForm({ ...caseForm, storage_room: e.target.value })} /></div>
                <div className={styles.field}><label>Storage Box</label><input value={caseForm.storage_box} onChange={(e) => setCaseForm({ ...caseForm, storage_box: e.target.value })} /></div>
              </div>
              <div className={styles.field}><label>Storage Notes</label><input value={caseForm.storage_notes} onChange={(e) => setCaseForm({ ...caseForm, storage_notes: e.target.value })} /></div>
              <div className={styles.formActions}>
                <button type="button" onClick={() => setEditingCase(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={caseSaving}>{caseSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Case info cards */}
      <div className={styles.infoGrid}>
        <div className={styles.infoCard}>
          <div className={styles.infoLabel}>Client</div>
          <div className={styles.infoValue}>{caseFile.client_name}</div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoLabel}>Year</div>
          <div className={styles.infoValue}>{caseFile.year}</div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoLabel}>File Number</div>
          <div className={styles.infoValue}>{caseFile.file_number ?? '—'}</div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoLabel}>Assigned To</div>
          <div className={styles.infoValue}>{caseFile.assigned_user?.name ?? '—'}</div>
        </div>
        {(caseFile.storage_room || caseFile.storage_box) && (
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Storage</div>
            <div className={styles.infoValue}>
              {[caseFile.storage_room, caseFile.storage_box].filter(Boolean).join(' / ')}
              {caseFile.storage_notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{caseFile.storage_notes}</div>}
            </div>
          </div>
        )}
      </div>

      {caseFile.description && (
        <div className={styles.section} style={{ marginBottom: 20 }}>
          <div className={styles.sectionHeader}><h3>Description</h3></div>
          <div style={{ padding: '14px 20px' }}>
            <div className={styles.descBlock}>{caseFile.description}</div>
          </div>
        </div>
      )}

      {/* Deadlines section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Court Deadlines ({deadlines.length})</h3>
          {canWrite && <button className={styles.btnPrimary} onClick={openNewDl}>+ Add Deadline</button>}
        </div>

        {showDlForm && (
          <div style={{ padding: '0 20px 4px' }}>
            <div className={styles.formCard}>
              <h4>{dlEditing ? 'Edit Deadline' : 'New Deadline'}</h4>
              {dlError && <div className={styles.error}>{dlError}</div>}
              <form onSubmit={handleSaveDl} className={styles.form}>
                <div className={styles.field}><label>Title *</label><input value={dlForm.title} onChange={(e) => setDlForm({ ...dlForm, title: e.target.value })} required placeholder="e.g. Case Management Conference" /></div>
                <div className={styles.row}>
                  <div className={styles.field}><label>Court Name *</label><input value={dlForm.court_name} onChange={(e) => setDlForm({ ...dlForm, court_name: e.target.value })} required /></div>
                  <div className={styles.field}><label>Date *</label><input type="date" value={dlForm.deadline_date} onChange={(e) => setDlForm({ ...dlForm, deadline_date: e.target.value })} required /></div>
                </div>
                <div className={styles.field}><label>Court Directions / Other Remarks</label><textarea rows={2} value={dlForm.court_directions} onChange={(e) => setDlForm({ ...dlForm, court_directions: e.target.value })} /></div>
                <div className={styles.formActions}>
                  <button type="button" onClick={() => setShowDlForm(false)}>Cancel</button>
                  <button type="submit" className={styles.btnPrimary} disabled={dlSaving}>{dlSaving ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deadlines.length === 0 ? (
          <div className={styles.empty}>No deadlines for this case.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Court</th>
                <th>Date</th>
                <th>Court Directions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deadlines.map((d) => {
                const overdue = isOverdue(d.deadline_date, d.is_completed);
                return (
                  <tr key={d.id} style={d.is_completed ? { opacity: 0.55 } : {}}>
                    <td><strong>{d.title}</strong></td>
                    <td>{d.court_name}</td>
                    <td className={overdue ? styles.overdue : ''}>{new Date(d.deadline_date).toLocaleDateString()}</td>
                    <td style={{ fontSize: 13, maxWidth: 200 }}>{d.court_directions ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {d.is_completed ? <span style={{ color: 'var(--color-success)' }}>Done</span>
                        : overdue ? <span className={styles.overdue}>Overdue</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>Pending</span>}
                    </td>
                    <td className={styles.rowActions}>
                      <button
                        className={d.is_completed ? styles.btnToggleDone : styles.btnToggle}
                        onClick={() => handleToggle(d.id)}
                      >
                        {d.is_completed ? 'Undo' : 'Done'}
                      </button>
                      {canWrite && <button onClick={() => openEditDl(d)}>Edit</button>}
                      {canWrite && <button className={styles.btnDanger} onClick={() => handleDeleteDl(d.id)}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Case History */}
      <div className={styles.section} style={{ marginTop: 20 }}>
        <div className={styles.sectionHeader} style={{ cursor: 'pointer' }} onClick={toggleHistory}>
          <h3>Case History</h3>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{showHistory ? '▲ Hide' : '▼ Show'}</span>
        </div>
        {showHistory && (
          historyLoading ? <div style={{ padding: '14px 20px' }}><p>Loading…</p></div> :
          history.length === 0 ? <div className={styles.empty}>No history recorded.</div> :
          <div style={{ padding: '4px 20px 14px' }}>
            {history.map((h) => (
              <div key={h.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(h.created_at).toLocaleString()}
                </span>
                <span style={{ fontSize: 13 }}>
                  <strong>{h.performer?.name ?? 'System'}</strong> — {h.action}
                  {h.notes && <span style={{ color: 'var(--color-text-muted)' }}> ({h.notes})</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

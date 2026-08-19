import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getCase, getCaseHistory, updateCase } from '../../api/cases';
import { getDocuments } from '../../api/documents';
import {
  getCaseChecklist, getTemplates, applyTemplate,
  addCaseItem, updateCaseItem, deleteCaseItem,
} from '../../api/checklist';

import { useAuth } from '../../context/AuthContext';
import CaseTimeline from './CaseTimeline';
import { STATUS_COLORS } from '../../constants/colors';
import styles from './detail.module.css';

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [caseFile, setCaseFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [editingCase, setEditingCase] = useState(false);
  const [caseForm, setCaseForm] = useState({});
  const [caseSaving, setCaseSaving] = useState(false);
  const [caseError, setCaseError] = useState('');

  const [caseDocs, setCaseDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [suggestions, setSuggestions] = useState([]);
  const [suggStageId, setSuggStageId] = useState(null);
  const [markingItemId, setMarkingItemId] = useState(null);
  const [clReloadKey, setClReloadKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const cRes = await getCase(id);
      setCaseFile(cRes.data.data);
    } catch {
      navigate('/cases', { replace: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    setDocsLoading(true);
    getDocuments({ case_id: id })
      .then(r => setCaseDocs(r.data.data ?? []))
      .finally(() => setDocsLoading(false));
  }, [id]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getCaseHistory(id);
      setHistory(res.data.data ?? []);
    } finally { setHistoryLoading(false); }
  };

  const toggleHistory = () => {
    if (!showHistory && history.length === 0) loadHistory();
    setShowHistory(v => !v);
  };

  const startEditCase = () => {
    setCaseForm({
      case_number:   caseFile.case_number,
      file_number:   caseFile.file_number ?? '',
      year:          caseFile.year,
      client_name:   caseFile.client_name,
      description:   caseFile.description ?? '',
      storage_room:  caseFile.storage_room ?? '',
      storage_box:   caseFile.storage_box ?? '',
      storage_notes: caseFile.storage_notes ?? '',
      party_role:    caseFile.party_role ?? '',
      intake_brief:  caseFile.intake_brief ?? '',
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

  const handleDirectionSaved = (matches, stageId) => {
    const valid = matches.filter(m => m.matched_item_id);
    if (valid.length === 0) return;
    // deduplicate by matched_item_id (same item can match multiple actions)
    const seen = new Set();
    const unique = valid.filter(m => seen.has(m.matched_item_id) ? false : seen.add(m.matched_item_id));
    setSuggestions(unique);
    setSuggStageId(stageId);
  };

  const handleMarkSuggestionDone = async (itemId) => {
    setMarkingItemId(itemId);
    try {
      await updateCaseItem(id, itemId, { status: 'done', linked_stage_id: suggStageId });
      setSuggestions(prev => prev.filter(m => m.matched_item_id !== itemId));
      setClReloadKey(k => k + 1);
    } catch { /* ignore */ }
    finally { setMarkingItemId(null); }
  };

  const dismissSuggestion = (itemId) => setSuggestions(prev => prev.filter(m => m.matched_item_id !== itemId));

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
                <div className={styles.field}><label>Case Number *</label><input value={caseForm.case_number} onChange={e => setCaseForm({ ...caseForm, case_number: e.target.value })} required /></div>
                <div className={styles.field}><label>File Number</label><input value={caseForm.file_number} onChange={e => setCaseForm({ ...caseForm, file_number: e.target.value })} /></div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}><label>Year *</label><input type="number" value={caseForm.year} onChange={e => setCaseForm({ ...caseForm, year: +e.target.value })} required /></div>
                <div className={styles.field}><label>Client Name *</label><input value={caseForm.client_name} onChange={e => setCaseForm({ ...caseForm, client_name: e.target.value })} required /></div>
              </div>
              <div className={styles.field}><label>Description</label><textarea rows={2} value={caseForm.description} onChange={e => setCaseForm({ ...caseForm, description: e.target.value })} /></div>
              <div className={styles.row}>
                <div className={styles.field}><label>Storage Room</label><input value={caseForm.storage_room} onChange={e => setCaseForm({ ...caseForm, storage_room: e.target.value })} /></div>
                <div className={styles.field}><label>Storage Box</label><input value={caseForm.storage_box} onChange={e => setCaseForm({ ...caseForm, storage_box: e.target.value })} /></div>
              </div>
              <div className={styles.field}><label>Storage Notes</label><input value={caseForm.storage_notes} onChange={e => setCaseForm({ ...caseForm, storage_notes: e.target.value })} /></div>
              <div className={styles.field}>
                <label>Party Role</label>
                <select value={caseForm.party_role} onChange={e => setCaseForm({ ...caseForm, party_role: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="plaintiff">Plaintiff</option>
                  <option value="defendant">Defendant</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Case Brief — Initial Facts &amp; Advice</label>
                <textarea rows={5} value={caseForm.intake_brief} onChange={e => setCaseForm({ ...caseForm, intake_brief: e.target.value })} placeholder="Summary of client's situation, key facts, and initial legal advice given at first meeting…" />
              </div>
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
        {caseFile.party_role && (
          <div className={styles.infoCard}>
            <div className={styles.infoLabel}>Party Role</div>
            <div className={styles.infoValue} style={{ textTransform: 'capitalize' }}>{caseFile.party_role}</div>
          </div>
        )}
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

      {caseFile.intake_brief && (
        <div className={styles.briefBlock}>
          <div className={styles.briefLabel}>Case Brief — Initial Facts &amp; Advice</div>
          <div className={styles.briefText}>{caseFile.intake_brief}</div>
        </div>
      )}

      {/* Case Timeline */}
      <div className={styles.section} style={{ marginTop: 20 }}>
        <CaseTimeline caseId={id} canWrite={canWrite} onDirectionSaved={handleDirectionSaved} />
      </div>

      {/* AI Suggestion Banner */}
      {suggestions.length > 0 && (
        <div className={styles.suggBanner}>
          <div className={styles.suggHeader}>
            <span>🤖</span>
            <strong style={{ fontSize: 13 }}>
              AI Suggestion{suggestions.length > 1 ? 's' : ''} — checklist item{suggestions.length > 1 ? 's' : ''} that may match this direction:
            </strong>
            <button className={styles.suggDismissAll} onClick={() => setSuggestions([])}>Dismiss all</button>
          </div>
          {suggestions.map(m => (
            <div key={m.matched_item_id} className={styles.suggRow}>
              <div className={styles.suggRowText}>
                <em style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>"{m.action}"</em>
                {' → '}
                <strong>{m.matched_item_title}</strong>
                <span className={styles.suggScore}>{Math.round(m.similarity * 100)}% match</span>
              </div>
              <div className={styles.suggRowActions}>
                <button
                  className={styles.btnPrimary}
                  style={{ fontSize: 12, padding: '4px 12px' }}
                  disabled={markingItemId === m.matched_item_id}
                  onClick={() => handleMarkSuggestionDone(m.matched_item_id)}
                >
                  {markingItemId === m.matched_item_id ? '…' : 'Mark done'}
                </button>
                <button
                  style={{ fontSize: 12, padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                  onClick={() => dismissSuggestion(m.matched_item_id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case Checklist */}
      <ChecklistSection caseId={id} canWrite={canWrite} reloadKey={clReloadKey} />

      {/* Case Documents */}
      <div className={styles.section} style={{ marginTop: 20 }}>
        <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Documents</h3>
          <Link to={`/documents?case_id=${id}`} style={{ fontSize: 13, color: 'var(--color-primary)' }}>View all →</Link>
        </div>
        {docsLoading ? (
          <div style={{ padding: '14px 20px' }}><p>Loading…</p></div>
        ) : caseDocs.length === 0 ? (
          <div className={styles.empty}>No documents linked to this case.</div>
        ) : (
          <div style={{ padding: '4px 20px 14px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px 6px 0', fontWeight: 600 }}>Title</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 0 6px 8px', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {caseDocs.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '7px 8px 7px 0' }}>
                      <Link to={`/documents/${d.id}`}>{d.title}</Link>
                    </td>
                    <td style={{ padding: '7px 8px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                        background: (STATUS_COLORS[d.status] ?? '#6b7280') + '20',
                        color: STATUS_COLORS[d.status] ?? '#6b7280' }}>
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '7px 0 7px 8px', color: 'var(--color-text-muted)' }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            {history.map(h => (
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

// ---------------------------------------------------------------------------
// Checklist Section
// ---------------------------------------------------------------------------

function ChecklistSection({ caseId, canWrite, reloadKey }) {
  const { profile } = useAuth();
  const [checklist, setChecklist] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyModal, setApplyModal] = useState(false);
  const [addForm, setAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    getCaseChecklist(caseId)
      .then(r => setChecklist(r.data.data))
      .catch(() => setChecklist({ items: [], total: 0, done: 0, progress_pct: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [caseId, reloadKey]);

  useEffect(() => {
    if (canWrite) {
      getTemplates().then(r => setTemplates(r.data.data ?? []));
    }
  }, [canWrite]);

  const handleApply = async (templateId) => {
    setApplying(true); setErr('');
    try {
      await applyTemplate(caseId, templateId);
      setApplyModal(false);
      load();
    } catch (e) { setErr(e.response?.data?.message ?? 'Failed'); }
    finally { setApplying(false); }
  };

  const handleAddItem = async (e) => {
    e.preventDefault(); if (!newTitle.trim()) return;
    setSaving(true); setErr('');
    try {
      await addCaseItem(caseId, { title: newTitle.trim() });
      setNewTitle(''); setAddForm(false); load();
    } catch (e) { setErr(e.response?.data?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  const handleTick = async (item) => {
    const newStatus = item.status === 'done' ? 'pending' : 'done';
    try {
      await updateCaseItem(caseId, item.id, { status: newStatus });
      load();
    } catch (e) { setErr(e.response?.data?.message ?? 'Failed to update item'); }
  };

  const handleSkip = async (item) => {
    try { await updateCaseItem(caseId, item.id, { status: 'skipped' }); load(); }
    catch (e) { setErr(e.response?.data?.message ?? 'Failed to skip item'); }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Remove this checklist item?')) return;
    try { await deleteCaseItem(caseId, itemId); load(); }
    catch (e) { setErr(e.response?.data?.message ?? 'Failed to delete item'); }
  };

  if (loading) return null;

  const { items = [], total, done, progress_pct } = checklist ?? {};

  return (
    <div className={styles.section} style={{ marginTop: 20 }}>
      <div className={styles.sectionHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3>Case Checklist</h3>
          {total > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{done}/{total} done</span>
          )}
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setApplyModal(true); setErr(''); }}>
              Apply Template
            </button>
            <button style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setAddForm(v => !v); setErr(''); }}>
              + Add Item
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ padding: '10px 20px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div className={styles.clProgressTrack}>
            <div className={styles.clProgressFill} style={{ width: `${progress_pct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10, textAlign: 'right' }}>
            {progress_pct}% complete
          </div>
        </div>
      )}

      {err && <div className={styles.error} style={{ margin: '8px 20px 0' }}>{err}</div>}

      {/* Add item inline form */}
      {addForm && canWrite && (
        <form onSubmit={handleAddItem} style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 8 }}>
          <input
            autoFocus
            style={{ flex: 1, fontSize: 13 }}
            placeholder="Checklist item title…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <button type="submit" className={styles.btnPrimary} style={{ fontSize: 12, padding: '5px 14px' }} disabled={saving || !newTitle.trim()}>
            {saving ? '…' : 'Add'}
          </button>
          <button type="button" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setAddForm(false)}>Cancel</button>
        </form>
      )}

      {/* Item list */}
      {items.length === 0 ? (
        <div className={styles.empty}>
          No checklist items yet.{canWrite && ' Apply a template or add items manually.'}
        </div>
      ) : (
        <div style={{ padding: '4px 20px 12px' }}>
          {items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              canWrite={canWrite}
              onTick={handleTick}
              onSkip={handleSkip}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Apply template modal */}
      {applyModal && (
        <div className={styles.modalOverlay} onClick={() => setApplyModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Apply Checklist Template</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8 }}>
              Pending items will be replaced. Done and skipped items are kept.
            </p>
            {err && <div className={styles.error}>{err}</div>}
            {templates.length === 0 ? (
              <p style={{ fontSize: 13 }}>No templates available.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    disabled={applying}
                    onClick={() => handleApply(t.id)}
                    style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 13 }}
                  >
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{t.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{(t.items ?? []).length} steps</div>
                  </button>
                ))}
              </div>
            )}
            <div className={styles.modalActions}>
              <button onClick={() => setApplyModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ item, canWrite, onTick, onSkip, onDelete }) {
  const isDone    = item.status === 'done';
  const isSkipped = item.status === 'skipped';

  return (
    <div className={styles.clItem} style={{ opacity: isSkipped ? 0.45 : 1 }}>
      <button
        className={`${styles.clCheckbox} ${isDone ? styles.clChecked : ''}`}
        onClick={() => !isSkipped && onTick(item)}
        disabled={isSkipped}
        title={isDone ? 'Mark as pending' : 'Mark as done'}
      >
        {isDone && '✓'}
      </button>
      <div className={styles.clContent}>
        <span style={{ fontSize: 13, fontWeight: 500, textDecoration: isDone || isSkipped ? 'line-through' : 'none', color: isDone || isSkipped ? 'var(--color-text-muted)' : 'var(--color-text)' }}>
          {item.title}
        </span>
        {isDone && item.completer && (
          <span style={{ fontSize: 11, color: 'var(--color-success)', marginLeft: 8 }}>
            ✓ {item.completer.name} · {new Date(item.completed_at).toLocaleDateString()}
          </span>
        )}
        {isSkipped && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>skipped</span>}
        {item.linked_stage && (
          <span style={{ fontSize: 11, color: 'var(--color-primary)', marginLeft: 8 }}>
            ↗ {item.linked_stage.title}
          </span>
        )}
      </div>
      {canWrite && !isDone && (
        <div className={styles.rowActions}>
          {!isSkipped && (
            <button onClick={() => onSkip(item)} title="Skip">Skip</button>
          )}
          <button onClick={() => onDelete(item.id)} title="Delete" className={styles.btnDanger}>✕</button>
        </div>
      )}
    </div>
  );
}

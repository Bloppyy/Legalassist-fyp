import { useState, useEffect } from 'react';
import {
  getCaseStages, createCaseStage, updateCaseStage, deleteCaseStage,
  toggleCaseStageComplete, parseDirection, downloadStageFile,
} from '../../api/caseStages';
import styles from './detail.module.css';

const STAGE_COLORS = {
  court_appearance: '#1c64f2',
  court_direction: '#d97706',
  meeting:          '#057a55',
  filing_deadline:  '#e02424',
  year_end_review:  '#7e3af2',
  other:            '#6b7280',
};

const STAGE_LABELS = {
  court_appearance: 'Court Appearance',
  court_direction:  'Court Direction',
  meeting:          'Meeting',
  filing_deadline:  'Filing Deadline',
  year_end_review:  'Year End Review',
  other:            'Other',
};

const STAGE_ICONS = {
  court_appearance: '⚖',
  court_direction:  '📄',
  meeting:          '📅',
  filing_deadline:  '⏰',
  year_end_review:  '★',
  other:            'ℹ',
};

const STAGE_TYPES = Object.keys(STAGE_LABELS);
const SOURCE_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'website',  label: 'Website' },
  { value: 'physical', label: 'Physical' },
  { value: 'both',     label: 'Both' },
];
const SOURCE_LABELS = { website: 'Website', physical: 'Physical', both: 'Both' };

const EMPTY_FORM = {
  stage_type: 'court_appearance',
  title: '',
  stage_date: '',
  next_court_date: '',
  directions: '',
  direction_source: '',
};

function findCurrentStageId(stages) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = stages.filter(s => !s.is_completed && new Date(s.stage_date) >= today);
  if (!upcoming.length) return null;
  return upcoming.reduce((min, s) =>
    new Date(s.stage_date) < new Date(min.stage_date) ? s : min
  ).id;
}

function nodeState(stage, currentId) {
  if (stage.is_completed) return 'completed';
  if (stage.id === currentId) return 'current';
  return 'upcoming';
}

export default function CaseTimeline({ caseId, canWrite }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedStage, setSelectedStage] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMeta, setFormMeta] = useState({ aiParsed: false, fileUrl: null, fileName: null });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [arahanFile, setArahanFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await getCaseStages(caseId);
      setStages(res.data.data ?? []);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Failed to load timeline');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [caseId]);

  const openAddManual = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormMeta({ aiParsed: false, fileUrl: null, fileName: null });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (stage) => {
    setSelectedStage(null);
    setEditingId(stage.id);
    setForm({
      stage_type: stage.stage_type,
      title: stage.title,
      stage_date: stage.stage_date ?? '',
      next_court_date: stage.next_court_date ?? '',
      directions: stage.directions ?? '',
      direction_source: stage.direction_source ?? '',
    });
    setFormMeta({ aiParsed: stage.ai_parsed ?? false, fileUrl: stage.file_url ?? null, fileName: stage.file_name ?? null });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormSaving(true); setFormError('');
    try {
      const payload = {
        ...form,
        case_id: caseId,
        next_court_date: form.next_court_date || null,
        direction_source: form.direction_source || null,
        ai_parsed: formMeta.aiParsed,
        file_url: formMeta.fileUrl || null,
        file_name: formMeta.fileName || null,
      };
      if (editingId) await updateCaseStage(editingId, payload);
      else await createCaseStage(payload);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to save');
    } finally { setFormSaving(false); }
  };

  const handleToggleComplete = async (id) => {
    try { await toggleCaseStageComplete(id); setSelectedStage(null); load(); }
    catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stage?')) return;
    try { await deleteCaseStage(id); setSelectedStage(null); load(); }
    catch {}
  };

  const handleDownload = async (id) => {
    try {
      const res = await downloadStageFile(id);
      window.open(res.data.data.url, '_blank');
    } catch {}
  };

  const handleParseArahan = async (e) => {
    e.preventDefault();
    if (!arahanFile) return;
    setParsing(true); setParseError('');
    try {
      const fd = new FormData();
      fd.append('file', arahanFile);
      const res = await parseDirection(caseId, fd);
      const parsed = res.data.data;

      setForm({
        stage_type: 'court_direction',
        title: parsed.court_name || 'Court Direction',
        stage_date: new Date().toISOString().slice(0, 10),
        next_court_date: parsed.next_court_date || '',
        directions: [
          ...parsed.required_actions,
          parsed.parties.length > 0 ? `Parties: ${parsed.parties.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        direction_source: 'physical',
      });
      setFormMeta({ aiParsed: true, fileUrl: parsed.file_url ?? null, fileName: parsed.file_name ?? null });
      setEditingId(null);
      setFormError('');
      setShowUpload(false);
      setShowForm(true);
    } catch (err) {
      setParseError(err.response?.data?.message ?? 'Parsing failed — check the AI service is running');
    } finally { setParsing(false); }
  };

  const currentId = findCurrentStageId(stages);

  if (loading) return <div className={styles.empty}>Loading timeline…</div>;
  if (error) return <div className={styles.empty} style={{ color: 'var(--color-danger)' }}>{error}</div>;

  return (
    <>
      {/* Section header */}
      <div className={styles.sectionHeader}>
        <h3>Case Timeline ({stages.length})</h3>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: 13 }}
              onClick={() => { setShowUpload(true); setParseError(''); setArahanFile(null); }}
            >
              Upload Arahan
            </button>
            <button className={styles.btnPrimary} onClick={openAddManual}>+ Add Stage</button>
          </div>
        )}
      </div>

      {/* Add / Edit stage form */}
      {showForm && (
        <div style={{ padding: '0 20px 4px' }}>
          <div className={styles.formCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingId ? 'Edit Stage' : 'Add Stage'}
                {formMeta.aiParsed && <span className={styles.aiBadge}>AI Pre-filled</span>}
              </h4>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, lineHeight: 1, color: 'var(--color-text-muted)', padding: '0 4px' }}>×</button>
            </div>
            {formError && <div className={styles.error} style={{ marginBottom: 12 }}>{formError}</div>}
            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Stage Type *</label>
                  <select value={form.stage_type} onChange={(e) => setForm({ ...form, stage_type: e.target.value })} required>
                    {STAGE_TYPES.map(t => <option key={t} value={t}>{STAGE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Stage Date *</label>
                  <input type="date" value={form.stage_date} onChange={(e) => setForm({ ...form, stage_date: e.target.value })} required />
                </div>
              </div>
              <div className={styles.field}>
                <label>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Case Management Conference" />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Next Court Date</label>
                  <input type="date" value={form.next_court_date} onChange={(e) => setForm({ ...form, next_court_date: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label>Direction Source</label>
                  <select value={form.direction_source} onChange={(e) => setForm({ ...form, direction_source: e.target.value })}>
                    {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label>Directions / Notes</label>
                <textarea rows={3} value={form.directions} onChange={(e) => setForm({ ...form, directions: e.target.value })} />
              </div>
              {formMeta.fileName && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>📎 {formMeta.fileName}</div>
              )}
              <div className={styles.formActions}>
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={formSaving}>
                  {formSaving ? 'Saving…' : editingId ? 'Update Stage' : 'Save Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload arahan modal */}
      {showUpload && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Upload Arahan</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8 }}>
              Upload a court direction document (PDF or Word). AI will extract the key fields automatically for you to review before saving.
            </p>
            {parseError && <div className={styles.error}>{parseError}</div>}
            <form onSubmit={handleParseArahan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className={styles.field}>
                <label>Arahan File *</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                  onChange={(e) => setArahanFile(e.target.files[0] ?? null)}
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={parsing || !arahanFile}>
                  {parsing ? 'Parsing…' : 'Parse with AI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline */}
      {stages.length === 0 ? (
        <div className={styles.empty}>No stages recorded yet. Add a stage manually or upload an arahan to get started.</div>
      ) : (
        <div className={styles.timeline}>
          {stages.map((stage) => {
            const state = nodeState(stage, currentId);
            const color = STAGE_COLORS[stage.stage_type] ?? '#6b7280';
            const isSelected = selectedStage?.id === stage.id;
            return (
              <div
                key={stage.id}
                className={`${styles.timelineRow} ${stage.is_completed ? styles.rowCompleted : ''} ${isSelected ? styles.rowSelected : ''}`}
                onClick={() => setSelectedStage(isSelected ? null : stage)}
              >
                <div
                  className={`${styles.nodeCircle} ${state === 'current' ? styles.nodeCurrent : ''}`}
                  style={{
                    background: state === 'completed' ? color : 'var(--color-surface)',
                    borderColor: color,
                    color: state === 'completed' ? '#fff' : color,
                    '--pulse-color': color,
                  }}
                >
                  <span style={{ fontSize: 15, lineHeight: 1 }}>{STAGE_ICONS[stage.stage_type]}</span>
                </div>
                <div className={styles.nodeContent}>
                  <div className={styles.nodeTitle}>
                    {stage.title}
                    {stage.ai_parsed && <span className={styles.aiBadge}>AI</span>}
                  </div>
                  <div className={styles.nodeMeta}>
                    <span>{STAGE_LABELS[stage.stage_type]}</span>
                    <span className={styles.nodeDot}>·</span>
                    <span>
                      {new Date(stage.stage_date + 'T00:00:00').toLocaleDateString('en-MY', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                    {state === 'current' && <span className={styles.currentBadge}>Current</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail side panel */}
      {selectedStage && (
        <>
          <div className={styles.panelOverlay} onClick={() => setSelectedStage(null)} />
          <div className={styles.detailPanel}>
            <div className={styles.panelTop}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  className={styles.stageTypeBadge}
                  style={{
                    background: (STAGE_COLORS[selectedStage.stage_type] ?? '#6b7280') + '20',
                    color: STAGE_COLORS[selectedStage.stage_type] ?? '#6b7280',
                  }}
                >
                  {STAGE_ICONS[selectedStage.stage_type]} {STAGE_LABELS[selectedStage.stage_type]}
                </span>
                {selectedStage.ai_parsed && <span className={styles.aiBadge}>AI Parsed</span>}
              </div>
              <button
                onClick={() => setSelectedStage(null)}
                style={{ background: 'none', border: 'none', fontSize: 22, lineHeight: 1, color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            <h3 className={styles.panelTitle}>{selectedStage.title}</h3>

            <div className={styles.panelMeta}>
              <div className={styles.panelMetaRow}>
                <span className={styles.panelMetaLabel}>Stage Date</span>
                <span>{new Date(selectedStage.stage_date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              {selectedStage.next_court_date && (
                <div className={styles.panelMetaRow}>
                  <span className={styles.panelMetaLabel}>Next Court Date</span>
                  <span style={{ fontWeight: 500 }}>
                    {new Date(selectedStage.next_court_date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {selectedStage.direction_source && (
                <div className={styles.panelMetaRow}>
                  <span className={styles.panelMetaLabel}>Source</span>
                  <span>{SOURCE_LABELS[selectedStage.direction_source]}</span>
                </div>
              )}
              {selectedStage.recorder?.name && (
                <div className={styles.panelMetaRow}>
                  <span className={styles.panelMetaLabel}>Recorded by</span>
                  <span>{selectedStage.recorder.name}</span>
                </div>
              )}
              <div className={styles.panelMetaRow}>
                <span className={styles.panelMetaLabel}>Status</span>
                <span style={{ color: selectedStage.is_completed ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {selectedStage.is_completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>

            {selectedStage.directions && (
              <div className={styles.panelDirections}>
                <div className={styles.panelMetaLabel} style={{ marginBottom: 6 }}>Directions / Notes</div>
                <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedStage.directions}</div>
              </div>
            )}

            <div className={styles.panelActions}>
              {selectedStage.file_url && (
                <button style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: 13 }} onClick={() => handleDownload(selectedStage.id)}>
                  Download Arahan
                </button>
              )}
              {canWrite && (
                <>
                  <button
                    className={selectedStage.is_completed ? '' : styles.btnToggle}
                    style={{ fontSize: 13 }}
                    onClick={() => handleToggleComplete(selectedStage.id)}
                  >
                    {selectedStage.is_completed ? 'Mark Incomplete' : 'Mark Complete'}
                  </button>
                  <button style={{ fontSize: 13, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }} onClick={() => openEdit(selectedStage)}>Edit</button>
                  <button className={styles.btnDanger} style={{ fontSize: 13 }} onClick={() => handleDelete(selectedStage.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

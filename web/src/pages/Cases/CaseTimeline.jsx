import { useState, useEffect } from 'react';
import {
  getCaseStages, createCaseStage, updateCaseStage, deleteCaseStage,
  toggleCaseStageComplete, parseDirection, parseDirectionText, downloadStageFile,
} from '../../api/caseStages';
import { matchDirection } from '../../api/checklist';
import { STAGE_COLORS } from '../../constants/colors';
import styles from './detail.module.css';

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
  { value: '',         label: '— none —' },
  { value: 'website',  label: 'Website' },
  { value: 'physical', label: 'Physical' },
  { value: 'both',     label: 'Both' },
];
const SOURCE_LABELS = { website: 'Website', physical: 'Physical', both: 'Both' };

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  stage_type: 'court_appearance',
  title: '',
  stage_date: today(),
  court_name: '',
  next_court_date: '',
  directions: '',
  direction_source: '',
};

function suggestStageType(title) {
  const t = title.toLowerCase();
  if (/hearing|appear|mention|mahkamah|tarikh court/.test(t)) return 'court_appearance';
  if (/direction|arahan|order|perintah/.test(t))              return 'court_direction';
  if (/meeting|consult|discuss|mesyuarat/.test(t))            return 'meeting';
  if (/file|filing|submit|deadline|serve|kemukakan/.test(t))  return 'filing_deadline';
  if (/review|annual|year|tahunan/.test(t))                   return 'year_end_review';
  return null;
}

function findCurrentStageId(stages) {
  const now = today();
  const upcoming = stages.filter(s => !s.is_completed && s.stage_date >= now);
  if (!upcoming.length) return null;
  return upcoming.reduce((min, s) => s.stage_date < min.stage_date ? s : min).id;
}

function nodeState(stage, currentId) {
  if (stage.is_completed) return 'completed';
  if (stage.id === currentId) return 'current';
  return 'upcoming';
}

export default function CaseTimeline({ caseId, canWrite, onDirectionSaved }) {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedStage, setSelectedStage] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiParsed, setAiParsed] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [arahanMode, setArahanMode] = useState('file'); // 'file' | 'text'
  const [arahanFile, setArahanFile] = useState(null);
  const [arahanText, setArahanText] = useState('');
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

  const closeForm = () => { setShowForm(false); setFormError(''); setAiConfidence(null); };

  const openAddManual = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, stage_date: today() });
    setAiParsed(false);
    setAiConfidence(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (stage) => {
    setSelectedStage(null);
    setEditingId(stage.id);
    setForm({
      stage_type:       stage.stage_type,
      title:            stage.title,
      stage_date:       stage.stage_date ?? today(),
      court_name:       stage.court_name ?? '',
      next_court_date:  stage.next_court_date ?? '',
      directions:       stage.directions ?? '',
      direction_source: stage.direction_source ?? '',
    });
    setAiParsed(stage.ai_parsed ?? false);
    setAiConfidence(null);
    setFormError('');
    setShowForm(true);
  };

  const handleTitleChange = (value) => {
    const suggested = suggestStageType(value);
    setForm(f => ({ ...f, title: value, stage_type: suggested ?? f.stage_type }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormSaving(true); setFormError('');
    try {
      const payload = {
        ...form,
        case_id:          caseId,
        court_name:       form.court_name || null,
        next_court_date:  form.next_court_date || null,
        direction_source: form.direction_source || null,
        ai_parsed:        aiParsed,
      };
      if (editingId) {
        await updateCaseStage(editingId, payload);
      } else {
        const res = await createCaseStage(payload);
        // Fire-and-forget: do not await — AI cold start must not block form close
        if (form.stage_type === 'court_direction' && form.directions && onDirectionSaved) {
          const stageId = res.data.data?.id;
          const actions = form.directions.split('\n').map(s => s.trim()).filter(Boolean);
          if (stageId && actions.length > 0) {
            matchDirection(caseId, actions)
              .then(matchRes => {
                const matchData = matchRes.data.data;
                if (matchData?.has_suggestions) onDirectionSaved(matchData.matches, stageId);
              })
              .catch(() => {});
          }
        }
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to save');
    } finally { setFormSaving(false); }
  };

  const handleToggleComplete = async (id) => {
    try { await toggleCaseStageComplete(id); setSelectedStage(null); load(); } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stage?')) return;
    try { await deleteCaseStage(id); setSelectedStage(null); load(); } catch {}
  };

  const handleDownload = async (id) => {
    try {
      const res = await downloadStageFile(id);
      window.open(res.data.data.url, '_blank');
    } catch {}
  };

  const handleParseArahan = async (e) => {
    e.preventDefault();
    if (arahanMode === 'file' && !arahanFile) return;
    if (arahanMode === 'text' && !arahanText.trim()) return;
    setParsing(true); setParseError('');
    try {
      let res;
      if (arahanMode === 'text') {
        res = await parseDirectionText(caseId, arahanText.trim());
      } else {
        const fd = new FormData();
        fd.append('file', arahanFile);
        res = await parseDirection(caseId, fd);
      }
      const parsed = res.data.data;
      setForm({
        stage_type:       'court_direction',
        title:            parsed.court_name || 'Court Direction',
        stage_date:       today(),
        court_name:       parsed.court_name || '',
        next_court_date:  parsed.next_court_date || '',
        directions: [
          ...parsed.required_actions,
          parsed.parties.length > 0 ? `Parties: ${parsed.parties.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
        direction_source: 'physical',
      });
      setAiParsed(true);
      setAiConfidence(parsed.confidence ?? null);
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

      {/* Add / Edit form */}
      {showForm && (
        <div style={{ padding: '0 20px 4px' }}>
          <div className={styles.formCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingId ? 'Edit Stage' : 'Add Stage'}
                {aiParsed && (
                  <span className={styles.aiBadge}>
                    AI Pre-filled{aiConfidence != null ? ` · ${Math.round(aiConfidence * 100)}% confidence` : ''}
                  </span>
                )}
              </h4>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', fontSize: 20, lineHeight: 1, color: 'var(--color-text-muted)', padding: '0 4px' }}>×</button>
            </div>
            {formError && <div className={styles.error} style={{ marginBottom: 12 }}>{formError}</div>}
            <form onSubmit={handleSave} className={styles.form}>
              <div className={styles.field}>
                <label>Title *</label>
                <input value={form.title} onChange={e => handleTitleChange(e.target.value)} required placeholder="e.g. Case Management Conference" />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Stage Type *</label>
                  <select value={form.stage_type} onChange={e => setForm({ ...form, stage_type: e.target.value })} required>
                    {STAGE_TYPES.map(t => <option key={t} value={t}>{STAGE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Stage Date *</label>
                  <input type="date" value={form.stage_date} onChange={e => setForm({ ...form, stage_date: e.target.value })} required />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Court Name</label>
                  <input value={form.court_name} onChange={e => setForm({ ...form, court_name: e.target.value })} placeholder="e.g. Mahkamah Tinggi Melaka" />
                </div>
                <div className={styles.field}>
                  <label>Next Court Date</label>
                  <input type="date" value={form.next_court_date} onChange={e => setForm({ ...form, next_court_date: e.target.value })} />
                </div>
              </div>
              <div className={styles.field}>
                <label>Directions / Notes</label>
                <textarea rows={3} value={form.directions} onChange={e => setForm({ ...form, directions: e.target.value })} placeholder="Type court directions, required actions, or notes here" />
              </div>
              <div className={styles.field}>
                <label>Direction Source</label>
                <select value={form.direction_source} onChange={e => setForm({ ...form, direction_source: e.target.value })}>
                  {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className={styles.formActions}>
                <button type="button" onClick={closeForm}>Cancel</button>
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
              Upload a court direction document (PDF or Word). AI will extract the key fields and pre-fill the stage form.
            </p>
            {parseError && <div className={styles.error}>{parseError}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setArahanMode('file')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: arahanMode === 'file' ? 'var(--color-primary)' : 'var(--color-surface)', color: arahanMode === 'file' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13 }}
              >Upload File</button>
              <button
                type="button"
                onClick={() => setArahanMode('text')}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: arahanMode === 'text' ? 'var(--color-primary)' : 'var(--color-surface)', color: arahanMode === 'text' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13 }}
              >Paste Text</button>
            </div>
            <form onSubmit={handleParseArahan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {arahanMode === 'file' ? (
                <div className={styles.field}>
                  <label>Arahan File *</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                    onChange={e => setArahanFile(e.target.files[0] ?? null)}
                  />
                </div>
              ) : (
                <div className={styles.field}>
                  <label>Arahan Text *</label>
                  <textarea
                    rows={5}
                    value={arahanText}
                    onChange={e => setArahanText(e.target.value)}
                    placeholder="Paste the court direction text here…"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" onClick={() => { setShowUpload(false); setArahanText(''); setArahanFile(null); }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={parsing || (arahanMode === 'file' ? !arahanFile : !arahanText.trim())}>
                  {parsing ? 'Parsing…' : 'Parse with AI'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vertical timeline */}
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
                    {stage.court_name && <><span className={styles.nodeDot}>·</span><span>{stage.court_name}</span></>}
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
              >×</button>
            </div>

            <h3 className={styles.panelTitle}>{selectedStage.title}</h3>

            <div className={styles.panelMeta}>
              <div className={styles.panelMetaRow}>
                <span className={styles.panelMetaLabel}>Stage Date</span>
                <span>{new Date(selectedStage.stage_date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              {selectedStage.court_name && (
                <div className={styles.panelMetaRow}>
                  <span className={styles.panelMetaLabel}>Court</span>
                  <span>{selectedStage.court_name}</span>
                </div>
              )}
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

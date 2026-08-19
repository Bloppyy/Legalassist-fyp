import { useState, useEffect } from 'react';
import { getCases, getCase } from '../../api/cases';
import {
  getCaseStages, createCaseStage, updateCaseStage, deleteCaseStage,
  toggleCaseStageComplete, parseDirection, parseDirectionText, downloadStageFile,
} from '../../api/caseStages';
import { useAuth } from '../../context/AuthContext';
import { STAGE_COLORS } from '../../constants/colors';
import styles from './styles.module.css';

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
  case_opened:      '📂',
};

const STAGE_TYPES = Object.keys(STAGE_LABELS);
const SOURCE_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'website', label: 'Website' },
  { value: 'physical', label: 'Physical' },
  { value: 'both', label: 'Both' },
];

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

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function buildNodes(caseFile, stages) {
  if (!caseFile) return [];
  const todayStr = today();

  const caseOpenedNode = {
    _id: '__case_opened__',
    _type: 'case_opened',
    _date: caseFile.created_at.slice(0, 10),
    title: 'Case Opened',
    subtitle: caseFile.case_number,
    is_completed: true,
  };

  const stageNodes = [...stages]
    .sort((a, b) => {
      const d = a.stage_date.localeCompare(b.stage_date);
      return d !== 0 ? d : a.created_at.localeCompare(b.created_at);
    })
    .map(s => ({ ...s, _id: s.id, _type: 'stage', _date: s.stage_date }));

  const merged = [caseOpenedNode, ...stageNodes];

  // Insert today marker between nodes
  const result = [];
  let todayInserted = false;
  for (const node of merged) {
    if (!todayInserted && node._date > todayStr) {
      result.push({ _id: '__today__', _type: 'today', _date: todayStr });
      todayInserted = true;
    }
    result.push(node);
  }
  if (!todayInserted) {
    result.push({ _id: '__today__', _type: 'today', _date: todayStr });
  }

  // Assign alternating label position (skip today marker in count)
  let nodeIdx = 0;
  return result.map(node => {
    if (node._type === 'today') return node;
    const n = { ...node, _up: nodeIdx % 2 === 0 };
    nodeIdx++;
    return n;
  });
}

function findCurrentStageId(stages) {
  const now = today();
  const upcoming = stages.filter(s => !s.is_completed && s.stage_date >= now);
  if (!upcoming.length) return null;
  return upcoming.reduce((min, s) => s.stage_date < min.stage_date ? s : min).id;
}

export default function Timeline() {
  const { profile } = useAuth();
  const canWrite = ['associate', 'partner', 'admin'].includes(profile?.role);

  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseFile, setCaseFile] = useState(null);
  const [stages, setStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  const [stagesError, setStagesError] = useState('');

  const [detailNode, setDetailNode] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiParsed, setAiParsed] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [arahanMode, setArahanMode] = useState('file');
  const [arahanFile, setArahanFile] = useState(null);
  const [arahanText, setArahanText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    getCases()
      .then(r => setCases(r.data.data ?? []))
      .finally(() => setCasesLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCaseId) { setStages([]); setCaseFile(null); return; }
    setStagesLoading(true);
    setStagesError('');
    Promise.all([getCase(selectedCaseId), getCaseStages(selectedCaseId)])
      .then(([cRes, sRes]) => {
        setCaseFile(cRes.data.data);
        setStages(sRes.data.data ?? []);
      })
      .catch(() => setStagesError('Failed to load timeline'))
      .finally(() => setStagesLoading(false));
  }, [selectedCaseId]);

  const loadStages = async () => {
    if (!selectedCaseId) return;
    const res = await getCaseStages(selectedCaseId);
    setStages(res.data.data ?? []);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, stage_date: today() });
    setAiParsed(false);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (stage) => {
    setDetailNode(null);
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
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setFormError(''); };

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
        case_id:          selectedCaseId,
        court_name:       form.court_name || null,
        next_court_date:  form.next_court_date || null,
        direction_source: form.direction_source || null,
        ai_parsed:        aiParsed,
      };
      if (editingId) await updateCaseStage(editingId, payload);
      else           await createCaseStage(payload);
      closeForm();
      loadStages();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Failed to save');
    } finally { setFormSaving(false); }
  };

  const handleToggleComplete = async (id) => {
    try { await toggleCaseStageComplete(id); setDetailNode(null); loadStages(); } catch {}
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stage?')) return;
    try { await deleteCaseStage(id); setDetailNode(null); loadStages(); } catch {}
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
        res = await parseDirectionText(selectedCaseId, arahanText.trim());
      } else {
        const fd = new FormData();
        fd.append('file', arahanFile);
        res = await parseDirection(selectedCaseId, fd);
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
      setEditingId(null);
      setFormError('');
      setShowUpload(false);
      setShowForm(true);
    } catch (err) {
      setParseError(err.response?.data?.message ?? 'Parsing failed — check the AI service is running');
    } finally { setParsing(false); }
  };

  const nodes = buildNodes(caseFile, stages);
  const currentId = findCurrentStageId(stages);

  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <h2>Case Timeline</h2>
        {canWrite && selectedCaseId && (
          <div className={styles.headerActions}>
            <button
              className={styles.btnOutline}
              onClick={() => { setShowUpload(true); setParseError(''); setArahanFile(null); }}
            >
              Upload Arahan
            </button>
            <button className={styles.btnPrimary} onClick={openAdd}>+ Add Stage</button>
          </div>
        )}
      </div>

      {/* Case picker */}
      <div className={styles.pickerBar}>
        <label className={styles.pickerLabel}>Case File</label>
        <select
          className={styles.pickerSelect}
          value={selectedCaseId}
          onChange={e => { setSelectedCaseId(e.target.value); setShowForm(false); setDetailNode(null); }}
          disabled={casesLoading}
        >
          <option value="">— Select a case to view its timeline —</option>
          {cases.map(c => (
            <option key={c.id} value={c.id}>
              {c.case_number} — {c.client_name} ({c.status})
            </option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {!selectedCaseId && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <p>Select a case file above to view its timeline</p>
        </div>
      )}

      {/* Loading */}
      {selectedCaseId && stagesLoading && (
        <div className={styles.emptyState}><p>Loading timeline…</p></div>
      )}

      {/* Error */}
      {selectedCaseId && stagesError && (
        <div className={styles.emptyState} style={{ color: 'var(--color-danger)' }}>{stagesError}</div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formCardHeader}>
            <h3>
              {editingId ? 'Edit Stage' : 'Add Stage'}
              {aiParsed && <span className={styles.aiBadge}>AI Pre-filled</span>}
            </h3>
            <button className={styles.closeBtn} onClick={closeForm}>×</button>
          </div>
          {formError && <div className={styles.formError}>{formError}</div>}
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.field}>
              <label>Title *</label>
              <input
                value={form.title}
                onChange={e => handleTitleChange(e.target.value)}
                required
                placeholder="e.g. Case Management Conference"
              />
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
                {formSaving ? 'Saving…' : editingId ? 'Update' : 'Save Stage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Horizontal timeline */}
      {selectedCaseId && !stagesLoading && !stagesError && (
        <div className={styles.timelineContainer}>
          <div className={styles.timelineScroll}>
            <div className={styles.timelineTrack}>
              {nodes.map(node => {
                if (node._type === 'today') {
                  return (
                    <div key="__today__" className={styles.todayItem}>
                      <div className={styles.todayLabelTop}>TODAY</div>
                      <div className={styles.todayLine} />
                      <div className={styles.todayLabelBottom} />
                    </div>
                  );
                }

                const isCaseOpened = node._type === 'case_opened';
                const color = STAGE_COLORS[isCaseOpened ? 'case_opened' : node.stage_type] ?? '#6b7280';
                const state = isCaseOpened ? 'completed'
                  : node.is_completed ? 'completed'
                  : node.id === currentId ? 'current'
                  : 'upcoming';
                const isSelected = detailNode?._id === node._id;

                const circleStyle = {
                  background: state === 'completed' ? color : 'var(--color-surface)',
                  borderColor: color,
                  color: state === 'completed' ? '#fff' : color,
                  '--pulse-color': color,
                  opacity: state === 'completed' && !isCaseOpened ? 0.5 : 1,
                };

                const label = (
                  <div className={styles.nodeLabel}>
                    <div className={styles.nodeLabelTitle}>{node.title}</div>
                    {node.subtitle && <div className={styles.nodeLabelSub}>{node.subtitle}</div>}
                    <div className={styles.nodeLabelDate}>{formatDate(node._date)}</div>
                    {state === 'current' && <span className={styles.currentDot}>●</span>}
                  </div>
                );

                return (
                  <div
                    key={node._id}
                    className={`${styles.nodeItem} ${isSelected ? styles.nodeSelected : ''}`}
                    onClick={() => !isCaseOpened && setDetailNode(isSelected ? null : node)}
                  >
                    {node._up ? (
                      <>
                        {label}
                        <div className={styles.stem} />
                        <div
                          className={`${styles.circle} ${state === 'current' ? styles.circleCurrent : ''}`}
                          style={circleStyle}
                        >
                          <span style={{ fontSize: 14 }}>{STAGE_ICONS[isCaseOpened ? 'case_opened' : node.stage_type]}</span>
                        </div>
                        <div className={styles.stem} />
                        <div className={styles.nodeLabel} style={{ visibility: 'hidden' }}>&nbsp;</div>
                      </>
                    ) : (
                      <>
                        <div className={styles.nodeLabel} style={{ visibility: 'hidden' }}>&nbsp;</div>
                        <div className={styles.stem} />
                        <div
                          className={`${styles.circle} ${state === 'current' ? styles.circleCurrent : ''}`}
                          style={circleStyle}
                        >
                          <span style={{ fontSize: 14 }}>{STAGE_ICONS[isCaseOpened ? 'case_opened' : node.stage_type]}</span>
                        </div>
                        <div className={styles.stem} />
                        {label}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {stages.length === 0 && selectedCaseId && !stagesLoading && (
        <div className={styles.emptyStages}>
          No stages recorded yet.{canWrite ? ' Use "+ Add Stage" or "Upload Arahan" to get started.' : ''}
        </div>
      )}

      {/* Upload Arahan modal */}
      {showUpload && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Upload Arahan</h3>
            <p className={styles.modalSub}>
              Upload a court direction document (PDF or Word). AI will extract the key fields and pre-fill the stage form.
            </p>
            {parseError && <div className={styles.formError}>{parseError}</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button type="button" onClick={() => setArahanMode('file')} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: arahanMode === 'file' ? 'var(--color-primary)' : 'var(--color-surface)', color: arahanMode === 'file' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13 }}>Upload File</button>
              <button type="button" onClick={() => setArahanMode('text')} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid var(--color-border)', background: arahanMode === 'text' ? 'var(--color-primary)' : 'var(--color-surface)', color: arahanMode === 'text' ? '#fff' : 'inherit', cursor: 'pointer', fontSize: 13 }}>Paste Text</button>
            </div>
            <form onSubmit={handleParseArahan} className={styles.form}>
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
                  <textarea rows={5} value={arahanText} onChange={e => setArahanText(e.target.value)} placeholder="Paste the court direction text here…" style={{ resize: 'vertical' }} />
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

      {/* Stage detail popup */}
      {detailNode && detailNode._type === 'stage' && (
        <div className={styles.modalOverlay} onClick={() => setDetailNode(null)}>
          <div className={styles.detailModal} onClick={e => e.stopPropagation()}>
            <div className={styles.detailTop}>
              <span
                className={styles.typeBadge}
                style={{
                  background: (STAGE_COLORS[detailNode.stage_type] ?? '#6b7280') + '20',
                  color: STAGE_COLORS[detailNode.stage_type] ?? '#6b7280',
                }}
              >
                {STAGE_ICONS[detailNode.stage_type]} {STAGE_LABELS[detailNode.stage_type]}
              </span>
              {detailNode.ai_parsed && <span className={styles.aiBadge}>AI Parsed</span>}
              <button className={styles.closeBtn} onClick={() => setDetailNode(null)}>×</button>
            </div>

            <h2 className={styles.detailTitle}>{detailNode.title}</h2>

            <div className={styles.detailMeta}>
              <div className={styles.detailMetaRow}>
                <span className={styles.metaLabel}>Stage Date</span>
                <span>{formatDate(detailNode._date)}</span>
              </div>
              {detailNode.court_name && (
                <div className={styles.detailMetaRow}>
                  <span className={styles.metaLabel}>Court</span>
                  <span>{detailNode.court_name}</span>
                </div>
              )}
              {detailNode.next_court_date && (
                <div className={styles.detailMetaRow}>
                  <span className={styles.metaLabel}>Next Court Date</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{formatDate(detailNode.next_court_date)}</span>
                </div>
              )}
              {detailNode.direction_source && (
                <div className={styles.detailMetaRow}>
                  <span className={styles.metaLabel}>Source</span>
                  <span style={{ textTransform: 'capitalize' }}>{detailNode.direction_source}</span>
                </div>
              )}
              {detailNode.recorder?.name && (
                <div className={styles.detailMetaRow}>
                  <span className={styles.metaLabel}>Recorded by</span>
                  <span>{detailNode.recorder.name}</span>
                </div>
              )}
              <div className={styles.detailMetaRow}>
                <span className={styles.metaLabel}>Status</span>
                <span style={{ color: detailNode.is_completed ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {detailNode.is_completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>

            {detailNode.directions && (
              <div className={styles.detailDirections}>
                <div className={styles.metaLabel} style={{ marginBottom: 6 }}>Directions / Notes</div>
                <div className={styles.detailDirectionsText}>{detailNode.directions}</div>
              </div>
            )}

            <div className={styles.detailActions}>
              {detailNode.file_url && (
                <button className={styles.btnOutline} onClick={() => handleDownload(detailNode.id)}>
                  Download Arahan
                </button>
              )}
              {canWrite && (
                <>
                  <button
                    className={detailNode.is_completed ? styles.btnOutline : styles.btnSuccess}
                    onClick={() => handleToggleComplete(detailNode.id)}
                  >
                    {detailNode.is_completed ? 'Mark Incomplete' : 'Mark Complete'}
                  </button>
                  <button className={styles.btnOutline} onClick={() => openEdit(detailNode)}>Edit</button>
                  <button className={styles.btnDanger} onClick={() => handleDelete(detailNode.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

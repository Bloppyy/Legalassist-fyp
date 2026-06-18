import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getDocument, updateDocument, submitDocument, escalateDocument,
  approveDocument, rejectDocument, fileDocument, serveDocument,
  downloadDocument, reuploadDocument, checkCompliance, checkSimilarity, extractEntities,
  uploadFilingPdf, stripAnnotationsDoc,
} from '../../api/documents';
import { useAuth } from '../../context/AuthContext';
import { STATUS_COLORS } from '../../constants/colors';
import styles from './detail.module.css';

const LEVEL_1 = ['intern', 'junior_associate', 'chambering'];

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role;

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [editError, setEditError] = useState('');
  const [actionError, setActionError] = useState('');
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [liveCompliance, setLiveCompliance] = useState(null);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [escalateModal, setEscalateModal] = useState(false);
  const [reuploadFile, setReuploadFile] = useState(null);
  const [reuploading, setReuploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [entities, setEntities] = useState(null);
  const [extractingEntities, setExtractingEntities] = useState(false);
  const [filingPdfFile, setFilingPdfFile] = useState(null);
  const [uploadingFilingPdf, setUploadingFilingPdf] = useState(false);
  const [filingChecks, setFilingChecks] = useState(null);
  const [filingAcknowledged, setFilingAcknowledged] = useState(false);
  const [strippingAnnotations, setStrippingAnnotations] = useState(false);
  const reuploadRef = useRef();
  const filingPdfRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const res = await getDocument(id);
      const loaded = res.data.data;
      setDoc(loaded);
      if (loaded?.filing_checks) setFilingChecks(loaded.filing_checks);
    } catch {
      navigate('/documents', { replace: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSaveTitle = async (e) => {
    e.preventDefault(); setSavingTitle(true); setEditError('');
    try {
      await updateDocument(id, { title: editTitle });
      setEditingTitle(false);
      load();
    } catch (err) {
      setEditError(err.response?.data?.message ?? 'Failed to save');
    } finally { setSavingTitle(false); }
  };

  const handleReupload = async (e) => {
    e.preventDefault();
    if (!reuploadFile) return;
    setReuploading(true); setActionError('');
    try {
      const fd = new FormData();
      fd.append('file', reuploadFile);
      await reuploadDocument(id, fd);
      setReuploadFile(null);
      if (reuploadRef.current) reuploadRef.current.value = '';
      load();
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Reupload failed');
    } finally { setReuploading(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadDocument(id);
      window.open(res.data.data.url, '_blank');
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Download failed');
    } finally { setDownloading(false); }
  };

  const handleSubmit = async () => {
    setActionError('');
    try { await submitDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleApprove = async () => {
    setActionError('');
    try { await approveDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleFile = async () => {
    setActionError('');
    try { await fileDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleServe = async () => {
    setActionError('');
    try { await serveDocument(id); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleReject = async (comments) => {
    setActionError('');
    try { await rejectDocument(id, { reviewer_comments: comments }); setRejectModal(false); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleEscalate = async (reason) => {
    setActionError('');
    try { await escalateDocument(id, { escalation_reason: reason }); setEscalateModal(false); load(); }
    catch (err) { setActionError(err.response?.data?.message ?? 'Failed'); }
  };

  const handleUploadFilingPdf = async (e) => {
    e.preventDefault();
    if (!filingPdfFile) return;
    setUploadingFilingPdf(true); setActionError('');
    try {
      const fd = new FormData();
      fd.append('file', filingPdfFile);
      const res = await uploadFilingPdf(id, fd);
      setFilingChecks(res.data.data.filing_checks);
      setFilingAcknowledged(false);
      setFilingPdfFile(null);
      if (filingPdfRef.current) filingPdfRef.current.value = '';
      load();
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Upload failed');
    } finally { setUploadingFilingPdf(false); }
  };

  const handleStripAnnotations = async () => {
    setStrippingAnnotations(true); setActionError('');
    try {
      const res = await stripAnnotationsDoc(id);
      setFilingChecks(res.data.data.filing_checks);
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Strip failed');
    } finally { setStrippingAnnotations(false); }
  };

  const handleExtractEntities = async () => {
    setExtractingEntities(true); setEntities(null); setActionError('');
    try {
      const res = await extractEntities(id);
      setEntities(res.data.data);
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'Entity extraction failed');
    } finally { setExtractingEntities(false); }
  };

  const handleCheck = async () => {
    setCheckingCompliance(true); setLiveCompliance(null); setActionError('');
    try {
      const res = await checkCompliance(id);
      setLiveCompliance(res.data.data.compliance);
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'AI service unavailable');
    } finally { setCheckingCompliance(false); }
  };

  const handleCheckSimilarity = async () => {
    setCheckingSimilarity(true); setSimilarityResult(null); setActionError('');
    try {
      const res = await checkSimilarity(id);
      setSimilarityResult(res.data.data);
    } catch (err) {
      setActionError(err.response?.data?.message ?? 'AI service unavailable');
    } finally { setCheckingSimilarity(false); }
  };

  if (loading) return <p>Loading…</p>;
  if (!doc) return null;

  const isOwner = doc.created_by === profile?.id;
  const canSubmit = [...LEVEL_1, 'associate'].includes(role) && ['draft', 'rejected'].includes(doc.status) && isOwner;
  const canReupload = isOwner && ['draft', 'rejected'].includes(doc.status);
  const canEditTitle = isOwner && ['draft', 'rejected'].includes(doc.status);
  const canEscalate = role === 'associate' && doc.status === 'pending_associate';
  const canApprove = (role === 'associate' && doc.status === 'pending_associate') ||
                     (role === 'partner' && doc.status === 'pending_partner');
  const canReject = (role === 'associate' && doc.status === 'pending_associate') ||
                   (role === 'partner' && doc.status === 'pending_partner');
  const canMarkFiled = role === 'associate' && doc.status === 'approved';
  const canMarkServed = role === 'admin' && doc.status === 'filed';

  const displayedCompliance = liveCompliance ?? (doc.errors_flagged?.length ? { issues: doc.errors_flagged } : null);

  return (
    <div>
      <Link to="/documents" className={styles.back}>← Back to Documents</Link>

      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2>{doc.title}</h2>
          <span
            className={styles.badge}
            style={{ background: (STATUS_COLORS[doc.status] ?? '#6b7280') + '20', color: STATUS_COLORS[doc.status] ?? '#6b7280' }}
          >
            {doc.status.replace(/_/g, ' ')}
          </span>
          {doc.file_version > 1 && <span className={styles.versionBadge}>v{doc.file_version}</span>}
        </div>
        <div className={styles.actions}>
          <button onClick={handleCheck} disabled={checkingCompliance}>
            {checkingCompliance ? 'Checking…' : 'Check Compliance'}
          </button>
          <button onClick={handleCheckSimilarity} disabled={checkingSimilarity}>
            {checkingSimilarity ? 'Scoring…' : 'Similarity Score'}
          </button>
          <button onClick={handleExtractEntities} disabled={extractingEntities}>
            {extractingEntities ? 'Extracting…' : 'Extract Entities'}
          </button>
          {doc.file_url && (
            <button onClick={handleDownload} disabled={downloading} className={styles.btnSuccess}>
              {downloading ? '…' : 'Download'}
            </button>
          )}
          {canEditTitle && !editingTitle && <button onClick={() => { setEditTitle(doc.title); setEditingTitle(true); }}>Edit Title</button>}
          {canSubmit && <button className={styles.btnPrimary} onClick={handleSubmit}>Submit for Review</button>}
          {canEscalate && <button className={styles.btnSuccess} onClick={() => setEscalateModal(true)}>Escalate to Partner</button>}
          {canApprove && <button className={styles.btnSuccess} onClick={handleApprove}>Approve</button>}
          {canReject && <button className={styles.btnDanger} onClick={() => setRejectModal(true)}>Reject</button>}
          {canMarkServed && <button className={styles.btnPrimary} onClick={handleServe}>Mark as Served</button>}
        </div>
      </div>

      <div className={styles.meta}>
        <span><strong>Created:</strong> {new Date(doc.created_at).toLocaleString()}</span>
        {doc.submitted_at && <span><strong>Submitted:</strong> {new Date(doc.submitted_at).toLocaleString()}</span>}
        {doc.reviewed_at && <span><strong>Reviewed:</strong> {new Date(doc.reviewed_at).toLocaleString()}</span>}
        {doc.creator?.name && <span><strong>Author:</strong> {doc.creator.name}</span>}
        {doc.reviewer?.name && <span><strong>Reviewer:</strong> {doc.reviewer.name}</span>}
        {doc.file_name && <span><strong>File:</strong> {doc.file_name} (v{doc.file_version})</span>}
      </div>

      {doc.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {doc.tags.map(t => (
            <span key={t} style={{ fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', color: 'var(--color-primary)', border: '1px solid #bfdbfe' }}>{t}</span>
          ))}
        </div>
      )}

      {actionError && <div className={styles.error}>{actionError}</div>}

      {doc.status === 'rejected' && doc.reviewer_comments && (
        <div className={`${styles.infoBox} ${styles.infoBoxDanger}`}>
          <strong>Rejected:</strong> {doc.reviewer_comments}
        </div>
      )}

      {doc.escalation_reason && (
        <div className={`${styles.infoBox} ${styles.infoBoxWarn}`}>
          <strong>Escalation reason:</strong> {doc.escalation_reason}
        </div>
      )}

      {doc.status === 'approved' && role !== 'associate' && (
        <div className={`${styles.infoBox} ${styles.infoBoxSuccess}`}>Document approved — associate will upload the court-ready PDF and mark as filed.</div>
      )}
      {doc.status === 'filed' && (
        <div className={`${styles.infoBox} ${styles.infoBoxSuccess}`}>Document filed in court.</div>
      )}
      {doc.status === 'served' && (
        <div className={`${styles.infoBox} ${styles.infoBoxSuccess}`}>Document served to opponent. Workflow complete.</div>
      )}

      {doc.status === 'approved' && role === 'associate' && (
        <FilingPanel
          doc={doc}
          filingChecks={filingChecks}
          filingPdfFile={filingPdfFile}
          setFilingPdfFile={setFilingPdfFile}
          filingPdfRef={filingPdfRef}
          uploadingFilingPdf={uploadingFilingPdf}
          handleUploadFilingPdf={handleUploadFilingPdf}
          strippingAnnotations={strippingAnnotations}
          handleStripAnnotations={handleStripAnnotations}
          filingAcknowledged={filingAcknowledged}
          setFilingAcknowledged={setFilingAcknowledged}
          handleFile={handleFile}
          styles={styles}
        />
      )}

      {editingTitle && (
        <div className={styles.card}>
          <h3>Edit Title</h3>
          {editError && <div className={styles.error}>{editError}</div>}
          <form onSubmit={handleSaveTitle} className={styles.editForm}>
            <div className={styles.field}>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className={styles.formActions}>
              <button type="button" onClick={() => setEditingTitle(false)}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={savingTitle}>{savingTitle ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {canReupload && (
        <div className={styles.card}>
          <h3>Upload Revised File</h3>
          <form onSubmit={handleReupload} className={styles.editForm}>
            <div className={styles.field}>
              <input
                ref={reuploadRef}
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                onChange={(e) => setReuploadFile(e.target.files[0] ?? null)}
              />
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.btnPrimary} disabled={reuploading || !reuploadFile}>
                {reuploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {entities && <EntitiesPanel entities={entities.entities ?? []} onClose={() => setEntities(null)} styles={styles} />}

      {displayedCompliance && (
        <div className={styles.compliancePanel}>
          <div className={styles.complianceHeader}>
            <span>Compliance Report</span>
            <span style={{ color: displayedCompliance.issues?.length === 0 ? '#057a55' : '#e02424', fontWeight: 400 }}>
              {displayedCompliance.issues?.length === 0
                ? '✓ Passed'
                : `✗ ${displayedCompliance.issues?.length} issue(s)`}
            </span>
          </div>
          {(displayedCompliance.issues ?? []).map((issue, i) => (
            <div key={i} className={`${styles.issue} ${issue.severity === 'error' ? styles.issueError : styles.issueWarn}`}>
              <span><strong>{(issue.field ?? '').replace(/_/g, ' ')}</strong>: {issue.issue}</span>
              {issue.confidence != null && (
                <span className={styles.confidence}>{Math.round(issue.confidence * 100)}% confidence</span>
              )}
            </div>
          ))}
        </div>
      )}

      {similarityResult && (
        <SimilarityPanel result={similarityResult} onClose={() => setSimilarityResult(null)} styles={styles} />
      )}

      {rejectModal && (
        <CommentModal
          title="Reject Document"
          label="Reviewer comments *"
          onConfirm={handleReject}
          onCancel={() => setRejectModal(false)}
          styles={styles}
        />
      )}
      {escalateModal && (
        <CommentModal
          title="Escalate to Partner"
          label="Escalation reason *"
          onConfirm={handleEscalate}
          onCancel={() => setEscalateModal(false)}
          styles={styles}
        />
      )}
    </div>
  );
}

const ENTITY_LABELS = {
  PERSON: 'Persons', ORG: 'Organisations', DATE: 'Dates', MONEY: 'Monetary',
  LAW: 'Laws / Acts', COURT_NAME: 'Courts', CASE_NUMBER: 'Case Numbers',
  IC_NUMBER: 'IC Numbers', MONETARY_AMOUNT: 'Amounts', MALAYSIAN_STATE: 'States',
  LAW_FIRM: 'Law Firms', LAND_TITLE: 'Land Titles', GPE: 'Places',
};

function EntitiesPanel({ entities, onClose, styles }) {
  const grouped = entities.reduce((acc, e) => {
    const key = ENTITY_LABELS[e.label] ?? e.label;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e.text);
    return acc;
  }, {});

  return (
    <div className={styles.compliancePanel} style={{ marginBottom: 16 }}>
      <div className={styles.complianceHeader}>
        <span>Extracted Entities</span>
        <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {entities.length} found
        </span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
      {Object.keys(grouped).length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No entities detected.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(grouped).map(([label, values]) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 110 }}>{label}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...new Set(values)].map((v, i) => (
                  <span key={i} style={{ fontSize: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '2px 8px' }}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SimilarityPanel({ result, onClose, styles }) {
  const overallPct = Math.round(result.overall_score * 100);
  const overallColor = overallPct >= 70 ? 'var(--color-success)' : overallPct >= 45 ? '#c27803' : 'var(--color-danger)';

  return (
    <div className={styles.compliancePanel} style={{ marginBottom: 16 }}>
      <div className={styles.complianceHeader}>
        <span>Similarity Score — <span style={{ textTransform: 'capitalize' }}>{result.document_type.replace(/_/g, ' ')}</span></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: result.compliant ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 400 }}>
            {result.compliant ? '✓ Compliant' : '✗ Below threshold'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>
      </div>

      <div className={styles.simOverall}>
        <span style={{ fontSize: 36, fontWeight: 700, color: overallColor }}>{overallPct}%</span>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 10 }}>
          overall match · threshold {Math.round(result.threshold * 100)}%
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {result.sections.map((s) => {
          const pct = Math.round(s.score * 100);
          const barColor = s.compliant ? 'var(--color-success)' : 'var(--color-danger)';
          return (
            <div key={s.section} className={styles.simRow}>
              <div className={styles.simLabel}>
                {s.label}
                {!s.compliant && <span className={styles.simBadgeFail}>below threshold</span>}
              </div>
              <div className={styles.simBarWrap}>
                <div className={styles.simBarTrack}>
                  <div className={styles.simBarFill} style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className={styles.simPct} style={{ color: barColor }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilingPanel({
  doc, filingChecks, filingPdfFile, setFilingPdfFile, filingPdfRef,
  uploadingFilingPdf, handleUploadFilingPdf,
  strippingAnnotations, handleStripAnnotations,
  filingAcknowledged, setFilingAcknowledged,
  handleFile, styles,
}) {
  const checks = filingChecks;
  const allPass = checks && checks.size_ok && checks.copyable_ok && checks.annotations_ok;
  const canFile = !!doc.final_pdf_url && (allPass || filingAcknowledged);

  return (
    <div className={styles.filingPanel}>
      <h3>Court Filing PDF</h3>

      <p className={styles.filingHint}>
        {doc.final_pdf_url
          ? `Current file: ${doc.final_pdf_name}`
          : 'Export the approved Word document to PDF and upload it here to run pre-filing checks before marking as filed.'}
      </p>

      <form onSubmit={handleUploadFilingPdf} className={styles.filingUploadRow}>
        <input
          ref={filingPdfRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFilingPdfFile(e.target.files[0] ?? null)}
        />
        <button type="submit" className={styles.btnPrimary} disabled={uploadingFilingPdf || !filingPdfFile}>
          {uploadingFilingPdf ? 'Uploading…' : doc.final_pdf_url ? 'Re-upload & Re-validate' : 'Upload & Validate'}
        </button>
      </form>

      {checks && (
        <div className={styles.filingChecks}>
          <div className={styles.filingCheckRow}>
            <span className={checks.size_ok ? styles.filingPass : styles.filingFail}>{checks.size_ok ? '✓' : '✗'}</span>
            <span className={styles.filingCheckLabel}>File Size</span>
            <span className={styles.filingCheckValue}>
              {checks.size_mb} MB {!checks.size_ok && '— exceeds 50 MB limit'}
            </span>
          </div>

          <div className={styles.filingCheckRow}>
            <span className={checks.copyable_ok ? styles.filingPass : styles.filingFail}>{checks.copyable_ok ? '✓' : '✗'}</span>
            <span className={styles.filingCheckLabel}>PDF Copyable</span>
            <span className={styles.filingCheckValue}>
              {checks.copyable_ok ? 'Text-extractable' : 'Scanned / image PDF — not copyable'}
            </span>
          </div>

          <div className={styles.filingCheckRow}>
            <span className={checks.annotations_ok ? styles.filingPass : styles.filingFail}>{checks.annotations_ok ? '✓' : '✗'}</span>
            <span className={styles.filingCheckLabel}>No Annotations</span>
            <span className={styles.filingCheckValue}>
              {checks.annotations_ok ? 'Clean' : 'Annotation objects found'}
            </span>
            {!checks.annotations_ok && (
              <button className={styles.filingFixBtn} onClick={handleStripAnnotations} disabled={strippingAnnotations}>
                {strippingAnnotations ? 'Removing…' : 'Remove Annotations'}
              </button>
            )}
          </div>

          {!allPass && (
            <label className={styles.filingAcknowledge}>
              <input
                type="checkbox"
                checked={filingAcknowledged}
                onChange={(e) => setFilingAcknowledged(e.target.checked)}
              />
              <span>I acknowledge the above issues and will resolve them before court submission</span>
            </label>
          )}

          <div className={styles.filingActions}>
            <button className={styles.btnPrimary} onClick={handleFile} disabled={!canFile}>
              Mark as Filed
            </button>
          </div>
        </div>
      )}

      {!checks && doc.final_pdf_url && (
        <div className={styles.filingActions}>
          <button className={styles.btnPrimary} onClick={handleFile}>Mark as Filed</button>
        </div>
      )}
    </div>
  );
}

function CommentModal({ title, label, onConfirm, onCancel, styles }) {
  const [text, setText] = useState('');
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3>{title}</h3>
        <div className={styles.field}>
          <label>{label}</label>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
        <div className={styles.modalActions}>
          <button onClick={onCancel}>Cancel</button>
          <button
            className={styles.btnPrimary}
            onClick={() => { if (text.trim()) onConfirm(text.trim()); }}
            disabled={!text.trim()}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

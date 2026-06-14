import { useEffect, useState } from 'react';
import { getCaseStageStats } from '../../api/caseStages';
import { getAggregateEvaluation, runBatchEvaluation } from '../../api/evaluation';
import styles from './styles.module.css';

export default function ParserStats() {
  const [stats, setStats]         = useState(null);
  const [evalData, setEvalData]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      getCaseStageStats(),
      getAggregateEvaluation(),
    ])
      .then(([statsRes, evalRes]) => {
        setStats(statsRes.data.data);
        setEvalData(evalRes.data.data);
      })
      .catch(e => setError(e.response?.data?.message ?? 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  const handleRunBatch = async () => {
    setEvalLoading(true);
    try {
      const res = await runBatchEvaluation();
      setEvalData(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message ?? 'Batch evaluation failed');
    } finally {
      setEvalLoading(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (error) return <div style={{ color: 'var(--color-danger)', padding: 16 }}>{error}</div>;

  const confPct = stats.avg_confidence != null ? Math.round(stats.avg_confidence * 100) : null;

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>AI Parser Statistics</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 28 }}>
        Evaluation metrics for the court direction parser across all case stages.
      </p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{stats.total}</div>
          <div className={styles.statLabel}>Total Stages</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum} style={{ color: 'var(--color-success)' }}>{stats.ai_parsed}</div>
          <div className={styles.statLabel}>AI-Parsed Stages</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{stats.manual}</div>
          <div className={styles.statLabel}>Manually Added</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{stats.ai_parsed_pct}%</div>
          <div className={styles.statLabel}>AI-Parsed Rate</div>
        </div>
      </div>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><h3>AI Parse Rate</h3></div>
          <div className={styles.panelBody}>
            <div className={styles.barWrap}>
              <div className={styles.barLabel}>AI Parsed</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${stats.ai_parsed_pct}%`, background: 'var(--color-success)' }} />
              </div>
              <div className={styles.barPct}>{stats.ai_parsed_pct}%</div>
            </div>
            <div className={styles.barWrap}>
              <div className={styles.barLabel}>Manual</div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${100 - stats.ai_parsed_pct}%`, background: 'var(--color-text-muted)' }} />
              </div>
              <div className={styles.barPct}>{100 - stats.ai_parsed_pct}%</div>
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}><h3>Average Confidence</h3></div>
          <div className={styles.panelBody}>
            {confPct != null ? (
              <>
                <div style={{ fontSize: 48, fontWeight: 700, color: confPct >= 70 ? 'var(--color-success)' : confPct >= 40 ? 'var(--color-warning)' : 'var(--color-danger)', marginBottom: 8 }}>
                  {confPct}%
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                  Based on {stats.ai_parsed} AI-parsed stage{stats.ai_parsed !== 1 ? 's' : ''}
                </div>
                <div className={styles.barWrap} style={{ marginTop: 16 }}>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{
                      width: `${confPct}%`,
                      background: confPct >= 70 ? 'var(--color-success)' : confPct >= 40 ? '#c27803' : 'var(--color-danger)'
                    }} />
                  </div>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>
                No confidence data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.panel} style={{ marginTop: 20 }}>
        <div className={styles.panelHeader}><h3>Extracted Field Coverage</h3></div>
        <div className={styles.panelBody}>
          <FieldRow label="Next Court Date extracted" count={stats.with_next_court_date} total={stats.ai_parsed} />
          <FieldRow label="Directions / required actions extracted" count={stats.with_directions} total={stats.ai_parsed} />
        </div>
      </div>

      {/* ── Evaluation comparison table ─────────────────────────────────────── */}
      <div className={styles.panel} style={{ marginTop: 28 }}>
        <div className={styles.panelHeader} style={{ justifyContent: 'space-between' }}>
          <h3>Rule-Based vs ML Parser — Precision / Recall / F1</h3>
          <button
            className={styles.runBtn}
            onClick={handleRunBatch}
            disabled={evalLoading}
          >
            {evalLoading ? 'Running…' : 'Run Evaluation'}
          </button>
        </div>
        <div className={styles.panelBody}>
          {!evalData?.available ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
              {evalData?.message ?? 'No evaluation data. Click "Run Evaluation" to compute metrics across annotated arahan documents.'}
            </p>
          ) : (
            <>
              {evalData.evaluated_at && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 16 }}>
                  Last run: {new Date(evalData.evaluated_at).toLocaleString()} — {evalData.document_count} document{evalData.document_count !== 1 ? 's' : ''}
                </p>
              )}
              <EvalTable evalData={evalData} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const FIELDS = [
  { key: 'next_court_date', label: 'Next Court Date' },
  { key: 'court_name',      label: 'Court Name' },
  { key: 'parties',         label: 'Parties' },
  { key: 'required_actions', label: 'Required Actions' },
];

function pct(val) {
  if (val == null) return '—';
  return `${Math.round(val * 100)}%`;
}

function MetricCell({ val, highlight }) {
  const pctVal = val != null ? val * 100 : null;
  const color = pctVal == null
    ? 'var(--color-text-muted)'
    : pctVal >= 70
      ? 'var(--color-success)'
      : pctVal >= 40
        ? 'var(--color-warning)'
        : 'var(--color-danger)';
  return (
    <td className={styles.metricCell} style={{ color: highlight ? color : undefined, fontWeight: highlight ? 700 : undefined }}>
      {pct(val)}
    </td>
  );
}

function EvalTable({ evalData }) {
  const rb = evalData.rule_based;
  const ml = evalData.ml;

  return (
    <div className={styles.evalTableWrap}>
      <table className={styles.evalTable}>
        <thead>
          <tr>
            <th rowSpan={2} className={styles.fieldCol}>Field</th>
            <th colSpan={4} className={styles.parserHeader}>Rule-Based Parser</th>
            {ml && <th colSpan={4} className={`${styles.parserHeader} ${styles.mlHeader}`}>Fine-Tuned ML Parser</th>}
          </tr>
          <tr>
            <th>P</th><th>R</th><th>F1</th><th>Support</th>
            {ml && <><th>P</th><th>R</th><th>F1</th><th>Support</th></>}
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(({ key, label }) => {
            const rbm = rb?.fields?.[key];
            const mlm = ml?.fields?.[key];
            return (
              <tr key={key}>
                <td className={styles.fieldName}>{label}</td>
                <MetricCell val={rbm?.precision} />
                <MetricCell val={rbm?.recall} />
                <MetricCell val={rbm?.f1} highlight />
                <td className={styles.metricCell}>{rbm?.support ?? '—'}</td>
                {ml && <>
                  <MetricCell val={mlm?.precision} />
                  <MetricCell val={mlm?.recall} />
                  <MetricCell val={mlm?.f1} highlight />
                  <td className={styles.metricCell}>{mlm?.support ?? '—'}</td>
                </>}
              </tr>
            );
          })}
          <tr className={styles.macroRow}>
            <td className={styles.fieldName}>Macro F1</td>
            <td /><td />
            <MetricCell val={rb?.macro_f1} highlight />
            <td />
            {ml && <><td /><td />
              <MetricCell val={ml?.macro_f1} highlight />
              <td />
            </>}
          </tr>
        </tbody>
      </table>
      {!ml && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 12 }}>
          ML parser column will appear after training is complete and the model is loaded.
        </p>
      )}
    </div>
  );
}

function FieldRow({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.barWrap} style={{ flex: 1 }}>
        <div className={styles.barTrack}>
          <div className={styles.barFill} style={{ width: `${pct}%`, background: 'var(--color-primary)' }} />
        </div>
      </div>
      <div className={styles.fieldCount}>{count} / {total} ({pct}%)</div>
    </div>
  );
}

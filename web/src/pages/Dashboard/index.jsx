import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCases } from '../../api/cases';
import { getDocuments } from '../../api/documents';
import { getFirmDeadlines } from '../../api/firmDeadlines';
import { getNotifications } from '../../api/notifications';
import { getUpcomingCaseStages } from '../../api/caseStages';
import { STATUS_COLORS, STAGE_COLORS } from '../../constants/colors';
import styles from './styles.module.css';

function StageList({ stages }) {
  if (!stages.length) return <div className={styles.empty}>No upcoming stages.</div>;
  return (
    <ul className={styles.stageList}>
      {stages.map(s => (
        <li key={s.id} className={styles.stageItem}>
          <span className={styles.stageDot} style={{ background: STAGE_COLORS[s.stage_type] ?? '#6b7280' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{s.title}</div>
            <div className={styles.stageMeta}>
              {s.case_file?.case_number ?? '—'} · {new Date(s.stage_date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              {s.court_name && ` · ${s.court_name}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function DeadlineList({ deadlines }) {
  const today = new Date().toISOString().split('T')[0];
  if (!deadlines.length) return <div className={styles.empty}>No upcoming deadlines.</div>;
  return (
    <ul className={styles.deadlineList}>
      {deadlines.map(d => {
        const overdue = d.deadline_date < today && !d.is_completed;
        return (
          <li key={d.id} className={styles.deadlineItem}>
            <div className={styles.deadlineTitle} style={{ color: overdue ? 'var(--color-danger)' : undefined }}>
              {d.title}
            </div>
            <div className={styles.deadlineMeta}>
              {d.category?.replace(/_/g, ' ') ?? '—'} · {new Date(d.deadline_date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
              {overdue && <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}> · Overdue</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DocTable({ docs }) {
  if (!docs.length) return <div className={styles.empty}>None.</div>;
  return (
    <table className={styles.docTable}>
      <thead>
        <tr><th>Title</th><th>Status</th><th>Date</th></tr>
      </thead>
      <tbody>
        {docs.map(d => (
          <tr key={d.id}>
            <td><Link to={`/documents/${d.id}`}>{d.title}</Link></td>
            <td>
              <span className={styles.badge}
                style={{ background: (STATUS_COLORS[d.status] ?? '#6b7280') + '20', color: STATUS_COLORS[d.status] ?? '#6b7280' }}>
                {d.status.replace(/_/g, ' ')}
              </span>
            </td>
            <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{new Date(d.created_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;
  const userId = profile?.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [stats, setStats] = useState({ cases: 0, documents: 0, deadlines: 0, unread: 0 });
  const [upcomingStages, setUpcomingStages] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [pendingAssociateDocs, setPendingAssociateDocs] = useState([]);
  const [rejectedMyDocs, setRejectedMyDocs] = useState([]);
  const [pendingPartnerDocs, setPendingPartnerDocs] = useState([]);
  const [filedDocs, setFiledDocs] = useState([]);
  const [overdueDeadlines, setOverdueDeadlines] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const base = [
          getCases(),
          getDocuments(),
          getFirmDeadlines({ upcoming: 'true' }),
          getNotifications({ unread: true }),
          getUpcomingCaseStages(7),
        ];

        const extra = [];
        if (role === 'associate') {
          extra.push(getDocuments({ status: 'pending_associate' }));
          extra.push(getDocuments({ status: 'rejected' }));
        } else if (role === 'partner') {
          extra.push(getDocuments({ status: 'pending_partner' }));
        } else if (role === 'admin') {
          extra.push(getDocuments({ status: 'filed' }));
          extra.push(getFirmDeadlines());
        }

        const results = await Promise.all([...base, ...extra]);
        const [casesRes, docsRes, deadlinesRes, notifRes, stagesRes, ...extraRes] = results;

        setStats({
          cases: casesRes.data.data?.length ?? 0,
          documents: docsRes.data.data?.length ?? 0,
          deadlines: deadlinesRes.data.data?.length ?? 0,
          unread: notifRes.data.data?.length ?? 0,
        });
        setUpcomingStages(stagesRes.data.data ?? []);
        setUpcomingDeadlines(deadlinesRes.data.data ?? []);

        if (role === 'associate') {
          setPendingAssociateDocs(extraRes[0]?.data.data ?? []);
          const allRejected = extraRes[1]?.data.data ?? [];
          setRejectedMyDocs(allRejected.filter(d => d.created_by === userId));
        } else if (role === 'partner') {
          setPendingPartnerDocs(extraRes[0]?.data.data ?? []);
        } else if (role === 'admin') {
          setFiledDocs(extraRes[0]?.data.data ?? []);
          const allDeadlines = extraRes[1]?.data.data ?? [];
          const today = new Date().toISOString().split('T')[0];
          setOverdueDeadlines(allDeadlines.filter(d => d.deadline_date < today && !d.is_completed));
        }
      } catch (err) {
        setLoadError('Could not load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    if (role) load();
  }, [role, userId]);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      {loadError && <div style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>{loadError}</div>}
      <h2 className={styles.greeting}>Welcome back, {profile?.name?.split(' ')[0] ?? 'there'}</h2>
      <p className={styles.role}>Signed in as <strong>{role}</strong></p>

      <div className={styles.statsGrid}>
        <Link to="/cases" className={styles.statCard}>
          <div className={styles.statNum}>{stats.cases}</div>
          <div className={styles.statLabel}>Case Files</div>
        </Link>
        <Link to="/documents" className={styles.statCard}>
          <div className={styles.statNum}>{stats.documents}</div>
          <div className={styles.statLabel}>My Documents</div>
        </Link>
        <Link to="/firm-deadlines" className={styles.statCard}>
          <div className={styles.statNum}>{stats.deadlines}</div>
          <div className={styles.statLabel}>Upcoming Firm Deadlines</div>
        </Link>
        <Link to="/notifications" className={styles.statCard}>
          <div className={styles.statNum}>{stats.unread}</div>
          <div className={styles.statLabel}>Unread Notifications</div>
        </Link>
      </div>

      {/* All roles: upcoming case stages + firm deadlines */}
      <div className={styles.section}>
        <div className={styles.panels}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>Upcoming Case Stages — Next 7 Days</h3>
              <Link to="/timeline">View timeline</Link>
            </div>
            <StageList stages={upcomingStages.slice(0, 8)} />
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>Upcoming Firm Deadlines</h3>
              <Link to="/firm-deadlines">View all</Link>
            </div>
            <DeadlineList deadlines={upcomingDeadlines.slice(0, 8)} />
          </div>
        </div>
      </div>

      {/* Associate: review queue + rejected */}
      {role === 'associate' && (
        <div className={styles.section}>
          <div className={styles.panels}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Pending Your Review</h3>
                <Link to="/documents">View all</Link>
              </div>
              <DocTable docs={pendingAssociateDocs.slice(0, 6)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Your Rejected Documents</h3>
                <Link to="/documents">View all</Link>
              </div>
              <DocTable docs={rejectedMyDocs.slice(0, 6)} />
            </div>
          </div>
        </div>
      )}

      {/* Partner: pending partner approval */}
      {role === 'partner' && (
        <div className={styles.section}>
          <div className={styles.panelsFull}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Pending Partner Approval</h3>
                <Link to="/documents">View all</Link>
              </div>
              <DocTable docs={pendingPartnerDocs.slice(0, 8)} />
            </div>
          </div>
        </div>
      )}

      {/* Admin: filed docs + overdue deadlines */}
      {role === 'admin' && (
        <div className={styles.section}>
          <div className={styles.panels}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Documents Filed — Awaiting Served</h3>
                <Link to="/documents">View all</Link>
              </div>
              <DocTable docs={filedDocs.slice(0, 6)} />
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3>Overdue Firm Deadlines</h3>
                <Link to="/firm-deadlines">View all</Link>
              </div>
              <DeadlineList deadlines={overdueDeadlines.slice(0, 8)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

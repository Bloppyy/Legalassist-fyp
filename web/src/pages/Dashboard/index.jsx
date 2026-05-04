import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCases } from '../../api/cases';
import { getDocuments } from '../../api/documents';
import { getDeadlines } from '../../api/deadlines';
import { getNotifications } from '../../api/notifications';
import { Link } from 'react-router-dom';
import styles from './styles.module.css';

const STATUS_COLORS = {
  draft: '#6b7280',
  pending_associate: '#c27803',
  pending_partner: '#7e3af2',
  approved: '#057a55',
  rejected: '#e02424',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ cases: 0, documents: 0, deadlines: 0, unread: 0 });
  const [recentDocs, setRecentDocs] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [casesRes, docsRes, deadlinesRes, notifRes] = await Promise.all([
          getCases(),
          getDocuments(),
          getDeadlines({ upcoming: true }),
          getNotifications({ unread: true }),
        ]);
        setStats({
          cases: casesRes.data.data?.length ?? 0,
          documents: docsRes.data.data?.length ?? 0,
          deadlines: deadlinesRes.data.data?.length ?? 0,
          unread: notifRes.data.data?.length ?? 0,
        });
        setRecentDocs((docsRes.data.data ?? []).slice(0, 5));
        setUpcomingDeadlines((deadlinesRes.data.data ?? []).slice(0, 5));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h2 className={styles.greeting}>
        Welcome back, {profile?.name?.split(' ')[0] ?? 'there'} 👋
      </h2>
      <p className={styles.role}>Signed in as <strong>{profile?.role}</strong></p>

      <div className={styles.statsGrid}>
        <Link to="/cases" className={styles.statCard}>
          <div className={styles.statNum}>{stats.cases}</div>
          <div className={styles.statLabel}>Case Files</div>
        </Link>
        <Link to="/documents" className={styles.statCard}>
          <div className={styles.statNum}>{stats.documents}</div>
          <div className={styles.statLabel}>My Documents</div>
        </Link>
        <Link to="/deadlines" className={styles.statCard}>
          <div className={styles.statNum}>{stats.deadlines}</div>
          <div className={styles.statLabel}>Upcoming Deadlines</div>
        </Link>
        <Link to="/notifications" className={styles.statCard}>
          <div className={styles.statNum}>{stats.unread}</div>
          <div className={styles.statLabel}>Unread Notifications</div>
        </Link>
      </div>

      <div className={styles.panels}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Recent Documents</h3>
            <Link to="/documents">View all</Link>
          </div>
          {recentDocs.length === 0 ? (
            <p className={styles.empty}>No documents yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Title</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/documents/${d.id}`}>{d.title}</Link>
                    </td>
                    <td>
                      <span
                        className={styles.badge}
                        style={{ background: STATUS_COLORS[d.status] + '20', color: STATUS_COLORS[d.status] }}
                      >
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Upcoming Deadlines</h3>
            <Link to="/deadlines">View all</Link>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className={styles.empty}>No upcoming deadlines.</p>
          ) : (
            <ul className={styles.deadlineList}>
              {upcomingDeadlines.map((d) => (
                <li key={d.id} className={styles.deadlineItem}>
                  <div className={styles.deadlineTitle}>{d.court_name}</div>
                  <div className={styles.deadlineMeta}>
                    {d.case_file?.case_number ?? '—'} · {new Date(d.deadline_date).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

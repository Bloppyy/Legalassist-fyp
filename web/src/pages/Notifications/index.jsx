import { useEffect, useState } from 'react';
import { getNotifications, markRead, markAllRead } from '../../api/notifications';
import styles from './styles.module.css';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(unreadOnly ? { unread: true } : undefined);
      setNotifications(res.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [unreadOnly]);

  const handleMarkRead = async (id) => {
    try { await markRead(id); load(); }
    catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    try { await markAllRead(); load(); }
    catch { /* ignore */ }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div className={styles.header}>
        <h2>Notifications {unreadCount > 0 && <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 400 }}>({unreadCount} unread)</span>}</h2>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button className={styles.btnPrimary} onClick={handleMarkAll}>Mark all read</button>
          )}
        </div>
      </div>

      <div className={styles.filters}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
      </div>

      {loading ? <p>Loading…</p> : notifications.length === 0 ? (
        <div className={styles.empty}>No notifications.</div>
      ) : (
        <div className={styles.list}>
          {notifications.map((n) => (
            <div key={n.id} className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}>
              <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                {!n.is_read && <span className={styles.unreadDot} />}
                <div className={styles.itemContent}>
                  <div className={styles.title}>{n.title}</div>
                  <div className={styles.message}>{n.message}</div>
                  <div className={styles.meta}>{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
              {!n.is_read && (
                <button className={styles.markBtn} onClick={() => handleMarkRead(n.id)}>Mark read</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

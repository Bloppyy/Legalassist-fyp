import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const NAV_ITEMS = [
  { to: '/',               label: 'Dashboard',       icon: '⊞' },
  { to: '/cases',          label: 'Case Files',      icon: '🗂' },
  { to: '/documents',      label: 'Documents',       icon: '📄' },
  { to: '/templates',           label: 'Templates',       icon: '📋' },
  { to: '/checklist-templates', label: 'Checklists',      icon: '☑' },
  { to: '/timeline',       label: 'Timeline',        icon: '📅' },
  { to: '/firm-deadlines', label: 'Firm Deadlines',  icon: '🗓' },
  { to: '/contacts',       label: 'Contacts',        icon: '📇' },
  { to: '/guidelines',     label: 'Guidelines',      icon: '⚖️'  },
  { to: '/notifications',  label: 'Notifications',   icon: '🔔' },
  { to: '/users',          label: 'Users',           icon: '👥', adminOnly: true },
  { to: '/admin/parser-stats', label: 'Parser Stats', icon: '📊', adminOnly: true },
];

export default function Layout({ children }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQ.trim();
    if (q.length >= 3) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchQ('');
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>LegalAssist</div>
        <nav className={styles.nav}>
          {NAV_ITEMS.filter(({ adminOnly }) => !adminOnly || profile?.role === 'admin').map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.icon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.userBlock}>
          <div className={styles.userName}>{profile?.name ?? '—'}</div>
          <div className={styles.userRole}>{profile?.role}</div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search cases, documents, contacts… (min 3 chars)"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <button type="submit" className={styles.searchBtn}>Search</button>
          </form>
        </div>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

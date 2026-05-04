import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './styles.module.css';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',     icon: '⊞' },
  { to: '/cases',        label: 'Case Files',    icon: '🗂' },
  { to: '/documents',    label: 'Documents',     icon: '📄' },
  { to: '/templates',    label: 'Templates',     icon: '📋' },
  { to: '/deadlines',    label: 'Deadlines',     icon: '📅' },
  { to: '/contacts',     label: 'Contacts',      icon: '📇' },
  { to: '/guidelines',   label: 'Guidelines',    icon: '⚖️'  },
  { to: '/notifications',label: 'Notifications', icon: '🔔' },
  { to: '/users',        label: 'Users',         icon: '👥', adminOnly: true },
];

export default function Layout({ children }) {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

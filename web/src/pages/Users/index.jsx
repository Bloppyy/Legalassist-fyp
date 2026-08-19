import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getUsers, createUser, updateUserRole, updateUserSupervisor, deleteUser } from '../../api/users';
import styles from './styles.module.css';

const ALL_ROLES = ['intern', 'junior_associate', 'chambering', 'associate', 'partner', 'admin'];
const LEVEL_1_ROLES = ['intern', 'junior_associate', 'chambering'];

const ROLE_LABEL = {
  intern: 'Intern',
  junior_associate: 'Junior Associate',
  chambering: 'Chambering',
  associate: 'Associate',
  partner: 'Partner',
  admin: 'Admin',
};

const ROLE_CLASS = {
  intern: styles.roleIntern,
  junior_associate: styles.roleIntern,
  chambering: styles.roleIntern,
  associate: styles.roleAssociate,
  partner: styles.rolePartner,
  admin: styles.roleAdmin,
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'intern', supervisor_id: '' };

function initials(name) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function Users() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Role edit modal
  const [editModal, setEditModal] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editSupervisor, setEditSupervisor] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [usersRes, assocRes] = await Promise.all([
        getUsers({ search: search || undefined, role: roleFilter || undefined }),
        getUsers({ role: 'associate' }),
      ]);
      setUsers(usersRes.data.data ?? []);
      setAssociates(assocRes.data.data ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [search, roleFilter]);

  const openEdit = (user) => {
    setEditModal(user);
    setEditRole(user.role);
    setEditSupervisor(user.supervisor_id ?? '');
    setSaveError('');
  };

  const handleSaveRole = async () => {
    setSaving(true); setSaveError('');
    try {
      await updateUserRole(editModal.id, editRole);
      if (LEVEL_1_ROLES.includes(editRole)) {
        await updateUserSupervisor(editModal.id, editSupervisor || null);
      }
      setEditModal(null);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.message ?? 'Failed to update');
    } finally { setSaving(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true); setCreateError('');
    try {
      const payload = { ...form, supervisor_id: LEVEL_1_ROLES.includes(form.role) ? (form.supervisor_id || undefined) : undefined };
      await createUser(payload);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setCreateError(err.response?.data?.message ?? 'Failed to create user');
    } finally { setCreating(false); }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete ${user.name ?? user.email}? This cannot be undone.`)) return;
    try {
      await deleteUser(user.id);
      load();
    } catch (err) {
      alert(err.response?.data?.message ?? 'Failed to delete user');
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>User Management</h2>
        <button className={styles.btnPrimary} onClick={() => { setShowCreate(true); setCreateError(''); setForm(EMPTY_FORM); }}>
          + New User
        </button>
      </div>

      <div className={styles.filters}>
        <input placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>

      {loading ? <p>Loading…</p> : (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Supervisor</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={6} className={styles.empty}>No users found.</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.avatar}>{initials(u.name)}</span>
                      {u.name ?? '—'}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`${styles.badge} ${ROLE_CLASS[u.role] ?? ''}`}>{ROLE_LABEL[u.role] ?? u.role}</span>
                  </td>
                  <td>{LEVEL_1_ROLES.includes(u.role) ? (associates.find(a => a.id === u.supervisor_id)?.name ?? '—') : '—'}</td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td className={styles.rowActions}>
                    <button className={styles.editBtn} onClick={() => openEdit(u)}>Edit</button>
                    {u.id !== profile?.id && (
                      <button className={styles.btnDanger} onClick={() => handleDelete(u)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>New User</h3>
            {createError && <div className={styles.error}>{createError}</div>}
            <form onSubmit={handleCreate} className={styles.form}>
              <div className={styles.field}>
                <label>Full Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className={styles.field}>
                <label>Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className={styles.field}>
                <label>Role *</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, supervisor_id: '' })}>
                  {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              {LEVEL_1_ROLES.includes(form.role) && (
                <div className={styles.field}>
                  <label>Supervisor (Associate)</label>
                  <select value={form.supervisor_id} onChange={(e) => setForm({ ...form, supervisor_id: e.target.value })}>
                    <option value="">None</option>
                    {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={creating}>
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Edit — {editModal.name}</h3>
            {saveError && <div className={styles.error}>{saveError}</div>}
            <div className={styles.field}>
              <label>Role</label>
              <select value={editRole} onChange={(e) => { setEditRole(e.target.value); setEditSupervisor(''); }}>
                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            {LEVEL_1_ROLES.includes(editRole) && (
              <div className={styles.field}>
                <label>Supervisor (Associate)</label>
                <select value={editSupervisor} onChange={(e) => setEditSupervisor(e.target.value)}>
                  <option value="">None</option>
                  {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className={styles.modalActions}>
              <button onClick={() => setEditModal(null)}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={handleSaveRole}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

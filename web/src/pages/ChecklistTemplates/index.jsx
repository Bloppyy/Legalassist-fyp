import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  getTemplates, createTemplate, updateTemplate, deleteTemplate,
  addTemplateItem, updateTemplateItem, removeTemplateItem,
} from '../../api/checklist';
import styles from './styles.module.css';

const ROLES = ['intern', 'junior_associate', 'chambering', 'associate', 'partner', 'admin'];
const CAN_WRITE = ['associate', 'partner', 'admin'];

const EMPTY_ITEM_FORM = { title: '', expected_role: '', notes: '' };

export default function ChecklistTemplates() {
  const { profile } = useAuth();
  const role = profile?.role;
  const canWrite = CAN_WRITE.includes(role);
  const toast = useToast();
  const isAdmin = role === 'admin';

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', description: '' });
  const [savingNew, setSavingNew] = useState(false);

  const [editTpl, setEditTpl] = useState(null);
  const [addItemFor, setAddItemFor] = useState(null);
  const [addItemForm, setAddItemForm] = useState(EMPTY_ITEM_FORM);
  const [savingItem, setSavingItem] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTemplates();
      setTemplates(res.data.data ?? []);
    } catch {
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setSavingNew(true);
    try {
      await createTemplate(newForm);
      toast('Template created');
      setShowNew(false);
      setNewForm({ name: '', description: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to create template.');
    } finally { setSavingNew(false); }
  };

  const handleUpdateTemplate = async (e) => {
    e.preventDefault();
    try {
      await updateTemplate(editTpl.id, { name: editTpl.name, description: editTpl.description });
      toast('Template updated');
      setEditTpl(null);
      load();
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to update.'); }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template? Items applied to cases will not be removed.')) return;
    try {
      await deleteTemplate(id);
      if (expanded === id) setExpanded(null);
      load();
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to delete.'); }
  };

  const handleAddItem = async (e, templateId) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      await addTemplateItem(templateId, addItemForm);
      toast('Step added');
      setAddItemFor(null);
      setAddItemForm(EMPTY_ITEM_FORM);
      load();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to add step.');
    } finally { setSavingItem(false); }
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    try {
      const { templateId, item } = editItem;
      await updateTemplateItem(templateId, item.id, {
        title: item.title,
        expected_role: item.expected_role || null,
        notes: item.notes || null,
      });
      toast('Step updated');
      setEditItem(null);
      load();
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to update step.'); }
  };

  const handleDeleteItem = async (templateId, itemId) => {
    try {
      await removeTemplateItem(templateId, itemId);
      load();
    } catch (err) { setError(err.response?.data?.message ?? 'Failed to remove step.'); }
  };

  const handleMoveItem = async (templateId, items, idx, dir) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    await Promise.all([
      updateTemplateItem(templateId, items[idx].id, { order_index: items[swap].order_index }),
      updateTemplateItem(templateId, items[swap].id, { order_index: items[idx].order_index }),
    ]);
    load();
  };

  return (
    <div>
      <div className={styles.header}>
        <h2>Checklist Templates</h2>
        {canWrite && (
          <button className={styles.btnPrimary} onClick={() => { setShowNew(true); setError(''); }}>
            + New Template
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      {showNew && (
        <form onSubmit={handleCreateTemplate} className={styles.newForm}>
          <h3>New Template</h3>
          <div className={styles.field}>
            <label>Name *</label>
            <input
              value={newForm.name}
              onChange={e => setNewForm({ ...newForm, name: e.target.value })}
              placeholder="e.g. Standard Civil Suit (Plaintiff)"
              required autoFocus
            />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <input
              value={newForm.description}
              onChange={e => setNewForm({ ...newForm, description: e.target.value })}
              placeholder="When to use this template"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={savingNew}>
              {savingNew ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {loading ? <p>Loading…</p> : templates.length === 0 ? (
        <div className={styles.empty}>
          No checklist templates yet.{canWrite ? ' Create one to get started.' : ''}
        </div>
      ) : templates.map(tpl => {
        const isOpen = expanded === tpl.id;
        const isEditingTpl = editTpl?.id === tpl.id;

        return (
          <div key={tpl.id} className={styles.tplCard}>

            {isEditingTpl ? (
              <form onSubmit={handleUpdateTemplate} className={styles.tplEditForm}>
                <input
                  className={styles.editNameInput}
                  value={editTpl.name}
                  onChange={e => setEditTpl({ ...editTpl, name: e.target.value })}
                  required
                />
                <input
                  className={styles.editDescInput}
                  value={editTpl.description ?? ''}
                  onChange={e => setEditTpl({ ...editTpl, description: e.target.value })}
                  placeholder="Description"
                />
                <div className={styles.formActions} style={{ flexShrink: 0 }}>
                  <button type="button" onClick={() => setEditTpl(null)}>Cancel</button>
                  <button type="submit" className={styles.btnPrimary}>Save</button>
                </div>
              </form>
            ) : (
              <div
                className={styles.tplHeader}
                onClick={() => setExpanded(isOpen ? null : tpl.id)}
              >
                <div className={styles.tplLeft}>
                  <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                  <div>
                    <div className={styles.tplName}>{tpl.name}</div>
                    {tpl.description && <div className={styles.tplDesc}>{tpl.description}</div>}
                  </div>
                </div>
                <div className={styles.tplRight} onClick={e => e.stopPropagation()}>
                  <span className={styles.countChip}>{tpl.items?.length ?? 0} steps</span>
                  {canWrite && (
                    <button onClick={() => setEditTpl({ id: tpl.id, name: tpl.name, description: tpl.description ?? '' })}>
                      Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button className={styles.btnDanger} onClick={() => handleDeleteTemplate(tpl.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}

            {isOpen && (
              <div className={styles.tplBody}>
                {(!tpl.items || tpl.items.length === 0) ? (
                  <p className={styles.emptyItems}>No steps yet.{canWrite ? ' Add one below.' : ''}</p>
                ) : tpl.items.map((item, idx) => {
                  const isEditingItem = editItem?.item.id === item.id;

                  if (isEditingItem) {
                    return (
                      <form key={item.id} onSubmit={handleUpdateItem} className={styles.itemEditRow}>
                        <span className={styles.itemIdx}>{item.order_index}</span>
                        <input
                          className={styles.itemTitleInput}
                          value={editItem.item.title}
                          onChange={e => setEditItem({ ...editItem, item: { ...editItem.item, title: e.target.value } })}
                          required placeholder="Step title"
                        />
                        <select
                          className={styles.itemRoleSelect}
                          value={editItem.item.expected_role ?? ''}
                          onChange={e => setEditItem({ ...editItem, item: { ...editItem.item, expected_role: e.target.value } })}
                        >
                          <option value="">Any role</option>
                          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                        </select>
                        <input
                          className={styles.itemNotesInput}
                          value={editItem.item.notes ?? ''}
                          onChange={e => setEditItem({ ...editItem, item: { ...editItem.item, notes: e.target.value } })}
                          placeholder="Notes"
                        />
                        <button type="button" onClick={() => setEditItem(null)}>Cancel</button>
                        <button type="submit" className={styles.btnPrimary}>Save</button>
                      </form>
                    );
                  }

                  return (
                    <div key={item.id} className={styles.item}>
                      <span className={styles.itemIdx}>{item.order_index}</span>
                      <div className={styles.itemContent}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        {item.expected_role && (
                          <span className={styles.roleChip}>{item.expected_role.replace(/_/g, ' ')}</span>
                        )}
                        {item.notes && <span className={styles.itemNotes}>{item.notes}</span>}
                      </div>
                      {canWrite && (
                        <div className={styles.itemActions}>
                          <button onClick={() => handleMoveItem(tpl.id, tpl.items, idx, -1)} disabled={idx === 0} title="Move up">↑</button>
                          <button onClick={() => handleMoveItem(tpl.id, tpl.items, idx, 1)} disabled={idx === tpl.items.length - 1} title="Move down">↓</button>
                          <button onClick={() => setEditItem({ templateId: tpl.id, item: { ...item } })}>Edit</button>
                          <button className={styles.btnDanger} onClick={() => handleDeleteItem(tpl.id, item.id)}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {canWrite && (
                  addItemFor === tpl.id ? (
                    <form onSubmit={e => handleAddItem(e, tpl.id)} className={styles.addItemForm}>
                      <input
                        className={styles.itemTitleInput}
                        placeholder="Step title *"
                        value={addItemForm.title}
                        onChange={e => setAddItemForm({ ...addItemForm, title: e.target.value })}
                        required autoFocus
                      />
                      <select
                        className={styles.itemRoleSelect}
                        value={addItemForm.expected_role}
                        onChange={e => setAddItemForm({ ...addItemForm, expected_role: e.target.value })}
                      >
                        <option value="">Any role</option>
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                      </select>
                      <input
                        className={styles.itemNotesInput}
                        placeholder="Notes (optional)"
                        value={addItemForm.notes}
                        onChange={e => setAddItemForm({ ...addItemForm, notes: e.target.value })}
                      />
                      <button type="button" onClick={() => { setAddItemFor(null); setAddItemForm(EMPTY_ITEM_FORM); }}>Cancel</button>
                      <button type="submit" className={styles.btnPrimary} disabled={savingItem}>
                        {savingItem ? '…' : 'Add'}
                      </button>
                    </form>
                  ) : (
                    <button
                      className={styles.addStepBtn}
                      onClick={() => { setAddItemFor(tpl.id); setAddItemForm(EMPTY_ITEM_FORM); }}
                    >
                      + Add Step
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

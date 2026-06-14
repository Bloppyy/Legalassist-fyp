const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');
const aiService = require('../services/aiService');

const CAN_WRITE = ['associate', 'partner', 'admin'];

// ---------------------------------------------------------------------------
// Checklist Templates
// ---------------------------------------------------------------------------

const listTemplates = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('checklist_templates')
      .select(`*, items:checklist_template_items(*)`)
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Sort items by order_index
    const sorted = (data ?? []).map(t => ({
      ...t,
      items: (t.items ?? []).sort((a, b) => a.order_index - b.order_index),
    }));
    return sendSuccess(res, sorted);
  } catch (err) { next(err); }
};

const createTemplate = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const { data, error } = await supabase
      .from('checklist_templates')
      .insert({ name, description: description || null, created_by: req.user.id })
      .select()
      .single();
    if (error) throw error;
    return sendSuccess(res, { ...data, items: [] }, 'Template created', 201);
  } catch (err) { next(err); }
};

const updateTemplate = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('checklist_templates')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error || !data) return next(createError(404, 'Template not found'));
    return sendSuccess(res, data, 'Template updated');
  } catch (err) { next(err); }
};

const deleteTemplate = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('checklist_templates')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Template deleted');
  } catch (err) { next(err); }
};

const addTemplateItem = async (req, res, next) => {
  try {
    const { title, order_index, expected_role, notes } = req.body;

    // Default order_index to max + 1 if not provided
    let idx = order_index;
    if (idx == null) {
      const { data: existing } = await supabase
        .from('checklist_template_items')
        .select('order_index')
        .eq('template_id', req.params.id)
        .order('order_index', { ascending: false })
        .limit(1);
      idx = existing?.length ? existing[0].order_index + 1 : 1;
    }

    const { data, error } = await supabase
      .from('checklist_template_items')
      .insert({
        template_id: req.params.id,
        title,
        order_index: idx,
        expected_role: expected_role || null,
        notes: notes || null,
      })
      .select()
      .single();
    if (error) throw error;
    return sendSuccess(res, data, 'Item added', 201);
  } catch (err) { next(err); }
};

const updateTemplateItem = async (req, res, next) => {
  try {
    const { title, order_index, expected_role, notes } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (order_index !== undefined) updates.order_index = order_index;
    if (expected_role !== undefined) updates.expected_role = expected_role;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase
      .from('checklist_template_items')
      .update(updates)
      .eq('id', req.params.itemId)
      .eq('template_id', req.params.id)
      .select()
      .single();
    if (error || !data) return next(createError(404, 'Item not found'));
    return sendSuccess(res, data, 'Item updated');
  } catch (err) { next(err); }
};

const removeTemplateItem = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('checklist_template_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('template_id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Item removed');
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// Case Checklist
// ---------------------------------------------------------------------------

const getCaseChecklist = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_checklist_items')
      .select(`
        *,
        completer:users!case_checklist_items_completed_by_fkey(id, name, role),
        linked_stage:case_stages!case_checklist_items_linked_stage_id_fkey(id, title, stage_type, stage_date)
      `)
      .eq('case_id', req.params.caseId)
      .order('order_index', { ascending: true });
    if (error) throw error;

    const items = data ?? [];
    const total = items.length;
    const done  = items.filter(i => i.status === 'done').length;

    return sendSuccess(res, { items, total, done, progress_pct: total ? Math.round((done / total) * 100) : 0 });
  } catch (err) { next(err); }
};

const applyTemplate = async (req, res, next) => {
  try {
    const { template_id } = req.body;
    const { caseId } = req.params;

    // Fetch template items
    const { data: templateItems, error: tErr } = await supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', template_id)
      .order('order_index', { ascending: true });
    if (tErr) throw tErr;
    if (!templateItems?.length) return next(createError(400, 'Template has no items'));

    // Delete existing pending items only — preserve done/skipped
    const { error: delErr } = await supabase
      .from('case_checklist_items')
      .delete()
      .eq('case_id', caseId)
      .eq('status', 'pending');
    if (delErr) throw delErr;

    // Find max order_index among kept (done/skipped) items
    const { data: kept } = await supabase
      .from('case_checklist_items')
      .select('order_index')
      .eq('case_id', caseId)
      .order('order_index', { ascending: false })
      .limit(1);
    const baseIdx = kept?.length ? kept[0].order_index + 1 : 1;

    // Insert template items as new pending items
    const newItems = templateItems.map((item, i) => ({
      case_id: caseId,
      title: item.title,
      order_index: baseIdx + i,
      status: 'pending',
      notes: item.notes || null,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('case_checklist_items')
      .insert(newItems)
      .select();
    if (insErr) throw insErr;

    return sendSuccess(res, inserted, 'Template applied', 201);
  } catch (err) { next(err); }
};

const addCaseItem = async (req, res, next) => {
  try {
    const { title, order_index, notes } = req.body;
    const { caseId } = req.params;

    let idx = order_index;
    if (idx == null) {
      const { data: existing } = await supabase
        .from('case_checklist_items')
        .select('order_index')
        .eq('case_id', caseId)
        .order('order_index', { ascending: false })
        .limit(1);
      idx = existing?.length ? existing[0].order_index + 1 : 1;
    }

    const { data, error } = await supabase
      .from('case_checklist_items')
      .insert({ case_id: caseId, title, order_index: idx, status: 'pending', notes: notes || null })
      .select()
      .single();
    if (error) throw error;
    return sendSuccess(res, data, 'Item added', 201);
  } catch (err) { next(err); }
};

const updateCaseItem = async (req, res, next) => {
  try {
    const { status, title, order_index, notes, linked_stage_id } = req.body;
    const { role, id: userId } = req.user;
    const isWriter = CAN_WRITE.includes(role);

    // Fetch current item to check ownership logic
    const { data: item, error: fetchErr } = await supabase
      .from('case_checklist_items')
      .select('*')
      .eq('id', req.params.itemId)
      .eq('case_id', req.params.caseId)
      .single();
    if (fetchErr || !item) return next(createError(404, 'Item not found'));

    // Only associate+ can edit title / order / skip; anyone can tick done
    if ((title !== undefined || order_index !== undefined || status === 'skipped') && !isWriter) {
      return next(createError(403, 'Only associates or above can edit items'));
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (order_index !== undefined) updates.order_index = order_index;
    if (notes !== undefined) updates.notes = notes;
    if (linked_stage_id !== undefined) updates.linked_stage_id = linked_stage_id;

    if (status !== undefined) {
      updates.status = status;
      if (status === 'done') {
        updates.completed_by = userId;
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_by = null;
        updates.completed_at = null;
      }
    }

    const { data, error } = await supabase
      .from('case_checklist_items')
      .update(updates)
      .eq('id', req.params.itemId)
      .eq('case_id', req.params.caseId)
      .select(`
        *,
        completer:users!case_checklist_items_completed_by_fkey(id, name, role)
      `)
      .single();
    if (error) throw error;
    return sendSuccess(res, data, 'Item updated');
  } catch (err) { next(err); }
};

const deleteCaseItem = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('case_checklist_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('case_id', req.params.caseId);
    if (error) throw error;
    return sendSuccess(res, null, 'Item deleted');
  } catch (err) { next(err); }
};

const matchDirection = async (req, res, next) => {
  try {
    const { required_actions } = req.body;
    const { caseId } = req.params;

    if (!required_actions?.length) {
      return sendSuccess(res, { matches: [] });
    }

    // Fetch pending checklist items for this case
    const { data: items, error } = await supabase
      .from('case_checklist_items')
      .select('id, title')
      .eq('case_id', caseId)
      .eq('status', 'pending');
    if (error) throw error;
    if (!items?.length) return sendSuccess(res, { matches: [] });

    const result = await aiService.matchChecklistItems(required_actions, items);
    return sendSuccess(res, result);
  } catch (err) {
    if (err.message?.includes('AI service error') || err.cause?.code === 'ECONNREFUSED') {
      return next(createError(503, 'AI service is unavailable'));
    }
    next(err);
  }
};

module.exports = {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  addTemplateItem, updateTemplateItem, removeTemplateItem,
  getCaseChecklist, applyTemplate, addCaseItem, updateCaseItem, deleteCaseItem, matchDirection,
};

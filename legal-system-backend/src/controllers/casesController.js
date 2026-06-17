const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

const WITH_RELATIONS = `
  *,
  assigned_user:users!case_files_assigned_to_fkey(id, name, email, role),
  partner_user:users!case_files_partner_id_fkey(id, name, email, role)
`;

const logHistory = async (caseId, action, userId, notes = null) => {
  await supabase.from('case_history').insert({
    case_id: caseId,
    action,
    performed_by: userId,
    notes,
  });
};

const getAll = async (req, res, next) => {
  try {
    const { search, status } = req.query;

    let query = supabase
      .from('case_files')
      .select(WITH_RELATIONS)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) {
      query = query.or(
        `case_number.ilike.%${search}%,client_name.ilike.%${search}%,file_number.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_files')
      .select(WITH_RELATIONS)
      .eq('id', req.params.id)
      .single();

    if (error || !data) return next(createError(404, 'Case file not found'));
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const getHistory = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('case_history')
      .select('*, performed_by_user:users!case_history_performed_by_fkey(id, name, role)')
      .eq('case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { case_number, file_number, year, client_name, description, storage_room, storage_box, storage_notes, assigned_to, partner_id } = req.body;

    const { data, error } = await supabase
      .from('case_files')
      .insert({
        case_number,
        file_number: file_number || null,
        year,
        client_name,
        description: description || null,
        storage_room: storage_room || null,
        storage_box: storage_box || null,
        storage_notes: storage_notes || null,
        assigned_to: assigned_to || null,
        partner_id: partner_id || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return next(createError(409, 'Case number already exists'));
      throw error;
    }

    await logHistory(data.id, 'Case created', req.user.id);
    return sendSuccess(res, data, 'Case file created', 201);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('case_files').select('id, status').eq('id', req.params.id).single();

    if (fetchError || !existing) return next(createError(404, 'Case file not found'));

    const { case_number, file_number, year, client_name, description, status, storage_room, storage_box, storage_notes, assigned_to, partner_id } = req.body;

    const { data, error } = await supabase
      .from('case_files')
      .update({
        case_number, file_number, year, client_name, description,
        status, storage_room, storage_box, storage_notes, assigned_to,
        partner_id: partner_id !== undefined ? (partner_id || null) : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return next(createError(409, 'Case number already exists'));
      throw error;
    }

    if (status && status !== existing.status) {
      await logHistory(data.id, `Status changed to ${status}`, req.user.id);
    } else {
      await logHistory(data.id, 'Case details updated', req.user.id);
    }

    return sendSuccess(res, data, 'Case file updated');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await supabase
      .from('case_files').select('id').eq('id', req.params.id).single();

    if (fetchError || !existing) return next(createError(404, 'Case file not found'));

    const { error } = await supabase.from('case_files').delete().eq('id', req.params.id);
    if (error) throw error;
    return sendSuccess(res, null, 'Case file deleted');
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, getHistory, create, update, remove };

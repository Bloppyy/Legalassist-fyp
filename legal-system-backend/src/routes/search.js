const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { sendSuccess, createError } = require('../utils/response');

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 3) return next(createError(400, 'Query must be at least 3 characters'));

    const term = q.trim();

    const [casesRes, docsRes, contactsRes] = await Promise.all([
      supabase.from('case_files').select('id, case_number, client_name, file_number, status')
        .or(`case_number.ilike.%${term}%,client_name.ilike.%${term}%,file_number.ilike.%${term}%`)
        .limit(10),
      supabase.from('documents').select('id, title, status, created_at')
        .ilike('title', `%${term}%`)
        .limit(10),
      supabase.from('contacts').select('id, name, job_title, phone, email')
        .or(`name.ilike.%${term}%,job_title.ilike.%${term}%`)
        .limit(10),
    ]);

    return sendSuccess(res, {
      cases: casesRes.data ?? [],
      documents: docsRes.data ?? [],
      contacts: contactsRes.data ?? [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

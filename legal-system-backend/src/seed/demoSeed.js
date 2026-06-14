require('dotenv').config();
const supabase = require('../config/supabase');

const ADMIN_ID     = '13f635ac-1415-42a2-b03b-b487eecb12a6';
const ASSOCIATE_ID = '15970048-141f-41dd-b977-30e316493099';
const PARTNER_ID   = '3087b473-0177-4849-9486-2e6c1c8c1097';
const TEMPLATE_ID  = '110479b0-54eb-4a9f-8eb1-c4fa6ee64d29';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function dateOnly(iso) {
  return iso.split('T')[0];
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('Cleaning up existing DEMO data…');

  const { data: cases } = await supabase
    .from('case_files').select('id').like('case_number', 'DEMO-%');

  if (cases?.length) {
    const ids = cases.map(c => c.id);
    await supabase.from('documents').delete().in('case_id', ids);
    await supabase.from('firm_deadlines').delete().in('case_id', ids);
    await supabase.from('case_files').delete().in('id', ids);
  }

  await supabase.from('firm_deadlines').delete().like('title', 'DEMO:%');
  await supabase.from('contacts').delete().like('name', 'DEMO:%');
  await supabase.from('court_guidelines').delete().like('title', 'DEMO:%');

  console.log('  Done.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertOrThrow(table, rows, label) {
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function applyChecklist(caseId, doneCount, doneBy) {
  const { data: items, error } = await supabase
    .from('checklist_template_items')
    .select('title, order_index, notes')
    .eq('template_id', TEMPLATE_ID)
    .order('order_index');
  if (error) throw new Error('fetch template items: ' + error.message);

  const rows = items.map((item, i) => ({
    case_id: caseId,
    title: item.title,
    order_index: item.order_index,
    status: i < doneCount ? 'done' : 'pending',
    completed_by: i < doneCount ? doneBy : null,
    completed_at: i < doneCount ? daysAgo(Math.max(1, (doneCount - i) * 8)) : null,
  }));

  await insertOrThrow('case_checklist_items', rows, `checklist for ${caseId}`);
}

// ── Contacts ──────────────────────────────────────────────────────────────────

async function seedContacts() {
  console.log('Seeding contacts…');
  await insertOrThrow('contacts', [
    {
      name: 'DEMO: Encik Faizal Harun',
      job_title: 'Court Runner',
      phone: '012-3456789',
      state: 'Selangor',
      notes: 'Available weekdays 9am–5pm. Covers Shah Alam and KL courts.',
    },
    {
      name: 'DEMO: Puan Zainab binti Yusof',
      job_title: 'Court Registrar',
      phone: '03-26928000',
      email: 'registrar@mahkamah.gov.my',
      state: 'Wilayah Persekutuan Kuala Lumpur',
      notes: 'Mahkamah Tinggi KL, Counter 3. Available 9am–4pm.',
    },
    {
      name: 'DEMO: Cik Priya Ramasamy',
      job_title: 'Court Interpreter (BM / EN / Tamil)',
      phone: '016-7654321',
      email: 'priya.interpreter@gmail.com',
      state: 'Wilayah Persekutuan Kuala Lumpur',
      notes: 'Freelance. 48-hour notice preferred. Fluent in Bahasa Malaysia, English, and Tamil.',
    },
    {
      name: 'DEMO: GDex Express Sdn Bhd',
      job_title: 'Legal Courier',
      phone: '1300-88-8899',
      state: 'Selangor',
      notes: 'Account no. GDX-L09934. Same-day delivery before 2pm cutoff.',
    },
  ], 'contacts');
  console.log('  4 contacts created.');
}

// ── Guidelines ────────────────────────────────────────────────────────────────

async function seedGuidelines() {
  console.log('Seeding guidelines…');
  await insertOrThrow('court_guidelines', [
    {
      title: 'DEMO: e-Filing (EFS) — Panduan Pemfailan Elektronik',
      content:
        'Sistem e-Filing membolehkan peguam cara memfailkan dokumen mahkamah secara elektronik melalui portal Kehakiman Malaysia.\n\n' +
        'Log masuk di https://efiling.kehakiman.gov.my menggunakan nombor kad bar peguam dan kata laluan MyBar.\n\n' +
        'Dokumen mesti dalam format PDF/A sebelum dimuat naik. Saiz fail maksimum ialah 10MB setiap dokumen.\n\n' +
        'Setelah pemfailan berjaya, cetakan resit e-Filing sebagai bukti. Salinan keras perlu diserahkan ke kaunter mahkamah dalam masa 3 hari bekerja.',
      state: 'Wilayah Persekutuan Kuala Lumpur',
      category: 'court_filing_website',
      order_index: 1,
    },
    {
      title: 'DEMO: Kod Amalan Peguam Cara Sivil 2024',
      content:
        'Peguam cara dikehendaki hadir di mahkamah dengan pakaian rasmi — jubah hitam dan jabot putih.\n\n' +
        'Telefon bimbit mesti dimatikan atau diletakkan pada mod senyap semasa prosiding. Tangkapan skrin atau rakaman prosiding adalah dilarang.\n\n' +
        'Semua dokumen mahkamah mesti diserahkan kepada pihak lawan sekurang-kurangnya 2 hari bekerja sebelum tarikh perbicaraan.\n\n' +
        'Sebarang permohonan untuk penangguhan perlu dikemukakan secara bertulis dengan alasan yang kukuh.',
      state: null,
      category: 'other',
      order_index: 2,
    },
  ], 'guidelines');
  console.log('  2 guidelines created.');
}

// ── Case A — New, early stage ─────────────────────────────────────────────────

async function seedCaseA() {
  console.log('Seeding Case A (new — letter of demand sent)…');

  const { data, error } = await supabase.from('case_files').insert([{
    case_number: 'DEMO-BA-22NCvC-01-01/2025',
    year: 2025,
    client_name: 'Ahmad Shahril bin Aziz',
    description:
      'Tuntutan sivil terhadap Syarikat Bina Maju Sdn Bhd atas hutang komersial berjumlah RM 85,000. ' +
      'Surat tuntutan telah dihantar pada ' + dateOnly(daysAgo(90)) + '. Defendan belum memberi respons. ' +
      'Peringkat seterusnya: fail Writ Saman.',
    status: 'active',
    assigned_to: ASSOCIATE_ID,
    file_number: 'PF/2025/001',
    storage_room: 'A',
    storage_box: '01',
  }]).select('id');
  if (error) throw new Error('Case A insert: ' + error.message);
  const caseId = data[0].id;

  await insertOrThrow('case_stages', [
    {
      case_id: caseId,
      stage_type: 'filing_deadline',
      title: 'Hantar Surat Tuntutan (Letter of Demand)',
      stage_date: dateOnly(daysAgo(90)),
      is_completed: true,
      recorded_by: ASSOCIATE_ID,
    },
    {
      case_id: caseId,
      stage_type: 'filing_deadline',
      title: 'Fail Writ Saman + Pernyataan Tuntutan',
      stage_date: dateOnly(daysFromNow(21)),
      is_completed: false,
      recorded_by: ASSOCIATE_ID,
      court_name: 'Mahkamah Sesyen Shah Alam',
    },
  ], 'Case A stages');

  await insertOrThrow('documents', [{
    case_id: caseId,
    created_by: ASSOCIATE_ID,
    title: 'DEMO: Letter of Demand — Syarikat Bina Maju Sdn Bhd',
    status: 'draft',
    content:
      'Kepada: Syarikat Bina Maju Sdn Bhd (No. Syarikat: [REG_NO])\n\n' +
      'Tuan/Puan,\n\n' +
      'TUNTUTAN HUTANG BERJUMLAH RM 85,000.00\n\n' +
      'Kami bertindak bagi pihak Ahmad Shahril bin Aziz (IC: [IC_NUMBER]) ("Anak Guam Kami").\n\n' +
      'Surat ini adalah notis rasmi bahawa Anak Guam Kami menuntut bayaran sejumlah RM 85,000.00 ' +
      '(Lapan Puluh Lima Ribu Ringgit Malaysia) dalam masa 14 hari dari tarikh surat ini.\n\n' +
      'Sekiranya pembayaran tidak diterima dalam tempoh yang dinyatakan, Anak Guam Kami ' +
      'berhak mengambil tindakan undang-undang tanpa notis lanjut.',
    tags: ['letter-of-demand', 'debt-recovery'],
    file_version: 1,
  }], 'Case A document');

  await applyChecklist(caseId, 1, ASSOCIATE_ID);

  await insertOrThrow('firm_deadlines', [{
    case_id: caseId,
    title: 'DEMO: Failkan Writ Saman — Ahmad Shahril',
    deadline_date: dateOnly(daysFromNow(21)),
    category: null,
    created_by: ASSOCIATE_ID,
    is_completed: false,
    remarks: 'Pernyataan Tuntutan perlu disemak oleh rakan kongsi sebelum pemfailan. Bayaran pemfailan RM 500.',
  }], 'Case A deadline');

  console.log(`  Case A: ${caseId}`);
}

// ── Case B — Mid-litigation ───────────────────────────────────────────────────

async function seedCaseB() {
  console.log('Seeding Case B (mid-litigation — discovery stage)…');

  const { data, error } = await supabase.from('case_files').insert([{
    case_number: 'DEMO-KL-22B-05-03/2024',
    year: 2024,
    client_name: 'Lim Wei Xian',
    description:
      'Tuntutan sivil atas hutang perniagaan berjumlah RM 210,000 terhadap Encik Rosli bin Hamid. ' +
      'Writ Saman telah difailkan dan disampaikan. Defendan memfailkan Pembelaan pada ' + dateOnly(daysAgo(55)) + '. ' +
      'Kes kini dalam peringkat pertukaran dokumen (discovery). Sebutan seterusnya: ' + dateOnly(daysFromNow(30)) + '.',
    status: 'active',
    assigned_to: ASSOCIATE_ID,
    file_number: 'PF/2024/005',
    storage_room: 'B',
    storage_box: '03',
  }]).select('id');
  if (error) throw new Error('Case B insert: ' + error.message);
  const caseId = data[0].id;

  const stages = [
    {
      stage_type: 'filing_deadline',
      title: 'Fail Writ Saman + Pernyataan Tuntutan',
      stage_date: dateOnly(daysAgo(120)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
    },
    {
      stage_type: 'court_appearance',
      title: 'Sebutan Pertama',
      stage_date: dateOnly(daysAgo(90)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
    },
    {
      stage_type: 'court_direction',
      title: 'Arahan: Defendan Failkan Pembelaan',
      stage_date: dateOnly(daysAgo(75)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
      directions: ['Defendan dikehendaki memfailkan Pembelaan dalam masa 21 hari dari tarikh ini.'],
      direction_source: 'website',
      next_court_date: dateOnly(daysAgo(45)),
      ai_parsed: true,
      confidence: 0.91,
    },
    {
      stage_type: 'court_appearance',
      title: 'Pengurusan Kes',
      stage_date: dateOnly(daysAgo(45)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
    },
    {
      stage_type: 'court_direction',
      title: 'Arahan: Pertukaran Senarai Dokumen',
      stage_date: dateOnly(daysAgo(30)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
      directions: ['Plaintif diarahkan mengemukakan senarai dokumen (Borang 19) kepada Defendan dalam masa 14 hari.'],
      direction_source: 'website',
      next_court_date: dateOnly(daysAgo(10)),
      ai_parsed: true,
      confidence: 0.88,
    },
    {
      stage_type: 'court_appearance',
      title: 'Pengurusan Kes (Pra-Perbicaraan)',
      stage_date: dateOnly(daysAgo(10)),
      is_completed: true,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
    },
    {
      stage_type: 'court_direction',
      title: 'Arahan: Kemukakan Pernyataan Saksi',
      stage_date: dateOnly(daysAgo(10)),
      is_completed: false,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
      directions: ['Kedua-dua pihak diarahkan mengemukakan pernyataan saksi dalam tempoh 45 hari dari tarikh ini.'],
      direction_source: 'website',
      next_court_date: dateOnly(daysFromNow(30)),
      ai_parsed: true,
      confidence: 0.85,
    },
    {
      stage_type: 'court_appearance',
      title: 'Sebutan',
      stage_date: dateOnly(daysFromNow(30)),
      is_completed: false,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
    },
  ];

  for (const s of stages) {
    await insertOrThrow('case_stages', [{ case_id: caseId, recorded_by: ASSOCIATE_ID, ...s }], `Case B stage: ${s.title}`);
  }

  const documents = [
    {
      title: 'DEMO: Writ of Summons — Encik Rosli bin Hamid',
      status: 'filed',
      content:
        'IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR (CIVIL DIVISION)\n' +
        'Civil Suit No. DEMO-KL-22B-05-03/2024\n\n' +
        'BETWEEN\nLim Wei Xian (NRIC: [IC_NUMBER]) ... Plaintiff\n\nAND\n\nEncik Rosli bin Hamid (NRIC: [IC_NUMBER]) ... Defendant\n\n' +
        'TO the Defendant:\nYOU ARE HEREBY COMMANDED that within 14 days after the service of this Writ on you, ' +
        'exclusive of the day of service, you do cause an appearance to be entered for you in an action ' +
        'at the suit of the above-named Plaintiff.',
      tags: ['writ', 'filing'],
      file_version: 2,
      submitted_at: daysAgo(110),
      reviewed_at: daysAgo(105),
      reviewed_by: PARTNER_ID,
    },
    {
      title: 'DEMO: Statement of Claim — Encik Rosli bin Hamid',
      status: 'approved',
      content:
        'IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\n\n' +
        'STATEMENT OF CLAIM\n\n' +
        '1. The Plaintiff is a businessman residing at [ADDRESS].\n' +
        '2. The Defendant is an individual residing at [ADDRESS].\n' +
        '3. On or about 15 March 2023, the Plaintiff advanced a loan of RM 210,000.00 to the Defendant pursuant to a Loan Agreement.\n' +
        '4. Despite repeated demands, the Defendant has failed to repay the said sum.\n' +
        'WHEREFORE the Plaintiff claims against the Defendant: (a) the sum of RM 210,000.00; (b) interest; (c) costs.',
      tags: ['pleading', 'claim'],
      file_version: 1,
      submitted_at: daysAgo(100),
      reviewed_at: daysAgo(95),
      reviewed_by: ASSOCIATE_ID,
    },
    {
      title: 'DEMO: Affidavit in Support — Encik Rosli bin Hamid',
      status: 'pending_associate',
      content:
        'I, Lim Wei Xian (NRIC: [IC_NUMBER]), hereby make oath and state as follows:\n\n' +
        '1. I am the Plaintiff in this action and I have personal knowledge of the facts herein deposed.\n' +
        '2. I refer to the Loan Agreement dated 15 March 2023 marked "LWX-1".\n' +
        '3. Despite my demand letter dated [DATE], the Defendant has refused to repay.',
      tags: ['affidavit', 'evidence'],
      file_version: 1,
      submitted_at: daysAgo(5),
      reviewed_at: null,
      reviewed_by: null,
    },
    {
      title: 'DEMO: Reply to Defence — Encik Rosli bin Hamid',
      status: 'draft',
      content:
        'REPLY TO DEFENCE\n\n' +
        'The Plaintiff joins issue with the Defendant on the Defence filed herein.\n' +
        'Save as herein expressly admitted, the Plaintiff denies each and every allegation of fact contained in the Defence as if each allegation were set out and traversed seriatim.',
      tags: ['pleading', 'reply'],
      file_version: 1,
      submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
    },
  ];

  for (const { submitted_at, reviewed_at, reviewed_by, ...rest } of documents) {
    await insertOrThrow('documents', [{
      case_id: caseId,
      created_by: ASSOCIATE_ID,
      submitted_at,
      reviewed_at,
      reviewed_by,
      ...rest,
    }], `Case B doc: ${rest.title}`);
  }

  // 7 of 13 items done
  await applyChecklist(caseId, 7, ASSOCIATE_ID);

  await insertOrThrow('firm_deadlines', [
    {
      case_id: caseId,
      title: 'DEMO: Kemukakan Pernyataan Saksi — Lim Wei Xian',
      deadline_date: dateOnly(daysFromNow(35)),
      category: null,
      created_by: ASSOCIATE_ID,
      is_completed: false,
      court_name: 'Mahkamah Tinggi Kuala Lumpur',
      remarks: 'Per court direction dated ' + dateOnly(daysAgo(10)) + '. Exchange witness statements with Defendant simultaneously.',
    },
    {
      case_id: caseId,
      title: 'DEMO: Bayaran Yuran Mahkamah — Kes KL-22B',
      deadline_date: dateOnly(daysFromNow(14)),
      category: null,
      created_by: ADMIN_ID,
      is_completed: false,
      remarks: 'Yuran sebutan RM 200. Bayar di kaunter Mahkamah Tinggi KL atau via JuruBayar portal.',
    },
  ], 'Case B deadlines');

  console.log(`  Case B: ${caseId}`);
}

// ── Case C — Closed ───────────────────────────────────────────────────────────

async function seedCaseC() {
  console.log('Seeding Case C (closed — judgment obtained)…');

  const { data, error } = await supabase.from('case_files').insert([{
    case_number: 'DEMO-PJ-B25-10-02/2023',
    year: 2023,
    client_name: 'Puan Nurul Ain binti Othman',
    description:
      'Tuntutan sivil terhadap ABC Trading Co atas hutang perniagaan berjumlah RM 42,500. ' +
      'Penghakiman diperoleh pada ' + dateOnly(daysAgo(30)) + '. Perlaksanaan penghakiman selesai. Kes ditutup.',
    status: 'closed',
    assigned_to: ASSOCIATE_ID,
    file_number: 'PF/2023/010',
    storage_room: 'C',
    storage_box: '02',
  }]).select('id');
  if (error) throw new Error('Case C insert: ' + error.message);
  const caseId = data[0].id;

  const stages = [
    { stage_type: 'filing_deadline', title: 'Fail Writ Saman + Pernyataan Tuntutan', stage_date: dateOnly(daysAgo(300)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    { stage_type: 'court_appearance', title: 'Sebutan Pertama', stage_date: dateOnly(daysAgo(270)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    {
      stage_type: 'court_direction',
      title: 'Arahan: Defendan Failkan Pembelaan',
      stage_date: dateOnly(daysAgo(240)),
      is_completed: true,
      court_name: 'Mahkamah Majistret Petaling Jaya',
      directions: ['Defendan diarahkan memfailkan Pembelaan dalam masa 14 hari dari tarikh ini.'],
      direction_source: 'website',
      next_court_date: dateOnly(daysAgo(180)),
      ai_parsed: true,
      confidence: 0.93,
    },
    { stage_type: 'court_appearance', title: 'Pengurusan Kes', stage_date: dateOnly(daysAgo(180)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    {
      stage_type: 'court_direction',
      title: 'Arahan: Kemukakan Pernyataan Saksi',
      stage_date: dateOnly(daysAgo(150)),
      is_completed: true,
      court_name: 'Mahkamah Majistret Petaling Jaya',
      directions: ['Pihak-pihak diarahkan mengemukakan pernyataan saksi sebelum tarikh sebutan seterusnya.'],
      direction_source: 'website',
      next_court_date: dateOnly(daysAgo(90)),
      ai_parsed: true,
      confidence: 0.87,
    },
    { stage_type: 'court_appearance', title: 'Pengurusan Kes (Pra-Perbicaraan)', stage_date: dateOnly(daysAgo(90)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    { stage_type: 'court_appearance', title: 'Perbicaraan', stage_date: dateOnly(daysAgo(60)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    { stage_type: 'court_appearance', title: 'Penghakiman (Judgment)', stage_date: dateOnly(daysAgo(30)), is_completed: true, court_name: 'Mahkamah Majistret Petaling Jaya' },
    { stage_type: 'filing_deadline', title: 'Tindakan Pasca-Penghakiman (Execution/Perlaksanaan)', stage_date: dateOnly(daysAgo(15)), is_completed: true, court_name: null },
  ];

  for (const s of stages) {
    await insertOrThrow('case_stages', [{ case_id: caseId, recorded_by: ASSOCIATE_ID, ...s }], `Case C stage: ${s.title}`);
  }

  const documents = [
    {
      title: 'DEMO: Writ of Summons — ABC Trading Co',
      status: 'served',
      content:
        'IN THE MAGISTRATE\'S COURT AT PETALING JAYA\n' +
        'Civil Suit No. DEMO-PJ-B25-10-02/2023\n\n' +
        'BETWEEN\nPuan Nurul Ain binti Othman (NRIC: [IC_NUMBER]) ... Plaintiff\n\nAND\n\nABC Trading Co (Reg: [REG_NO]) ... Defendant\n\n' +
        'YOU ARE HEREBY SUMMONED to appear before this Court on [DATE] at 9.00 a.m.',
      tags: ['writ', 'served'],
      file_version: 1,
      submitted_at: daysAgo(295),
      reviewed_at: daysAgo(290),
      reviewed_by: ASSOCIATE_ID,
    },
    {
      title: 'DEMO: Affidavit of Service — ABC Trading Co',
      status: 'served',
      content:
        'I, [NAME] (NRIC: [IC_NUMBER]), a Bailiff / Process Server, make oath and state:\n\n' +
        '1. On [DATE] at approximately [TIME], I duly served the Defendant ABC Trading Co with a true copy of the Writ of Summons ' +
        'by leaving same at its registered business address at [ADDRESS].\n' +
        '2. The said copy was received by a person who identified themselves as the office manager.',
      tags: ['affidavit', 'service', 'proof-of-service'],
      file_version: 1,
      submitted_at: daysAgo(260),
      reviewed_at: daysAgo(255),
      reviewed_by: ASSOCIATE_ID,
    },
  ];

  for (const { submitted_at, reviewed_at, reviewed_by, ...rest } of documents) {
    await insertOrThrow('documents', [{
      case_id: caseId,
      created_by: ASSOCIATE_ID,
      submitted_at,
      reviewed_at,
      reviewed_by,
      ...rest,
    }], `Case C doc: ${rest.title}`);
  }

  // All 13 done
  await applyChecklist(caseId, 13, ASSOCIATE_ID);

  console.log(`  Case C: ${caseId}`);
}

// ── Firm-level deadlines (no case) ───────────────────────────────────────────

async function seedFirmDeadlines() {
  console.log('Seeding firm-level deadlines…');
  await insertOrThrow('firm_deadlines', [
    {
      title: 'DEMO: Penghantaran Mata CPD — Bar Council Malaysia',
      deadline_date: dateOnly(daysFromNow(45)),
      category: null,
      created_by: ADMIN_ID,
      is_completed: false,
      remarks: 'Minimum 16 CPD points required. Submit via MyBar portal at www.malaysianbar.org.my.',
    },
    {
      title: 'DEMO: Pembaharuan Sijil Amalan 2026',
      deadline_date: dateOnly(daysFromNow(60)),
      category: null,
      created_by: ADMIN_ID,
      is_completed: false,
      remarks: 'Semua peguam cara mesti membaharui sijil amalan sebelum 31 Januari 2026. Kemukakan ke Bar Council.',
    },
  ], 'firm deadlines');
  console.log('  2 firm-level deadlines created.');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Demo Seed ===\n');
  try {
    await cleanup();
    await seedContacts();
    await seedGuidelines();
    await seedCaseA();
    await seedCaseB();
    await seedCaseC();
    await seedFirmDeadlines();
    console.log('\n=== Demo seed completed successfully. ===');
  } catch (err) {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  }
}

main();

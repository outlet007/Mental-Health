const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')
const multer  = require('multer')
const os      = require('os')

const dataDir = path.join(__dirname, '../../../data')
function readData(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function writeData(file, data) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2)) }

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 5 * 1024 * 1024 } })

// ── CSV helpers ───────────────────────────────────────────────────
function toCSV(rows, headers) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = headers.map(h => esc(h.label)).join(',')
  const body = rows.map(r => headers.map(h => esc(r[h.label] ?? '')).join(','))
  return [head, ...body].join('\r\n')
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseLine(lines[0])
  return lines.slice(1)
    .map(line => {
      const vals = parseLine(line)
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] || '').trim()]))
    })
    .filter(r => Object.values(r).some(v => v))
}

function parseLine(line) {
  const out = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// ── Schemas ───────────────────────────────────────────────────────
const SCHEMAS = {
  clients: {
    label: 'ผู้รับบริการ',
    icon:  'users',
    file:  'clients.json',
    headers: [
      { key: 'name',   label: 'ชื่อ-นามสกุล',        required: true  },
      { key: 'email',  label: 'อีเมล',                required: true  },
      { key: 'phone',  label: 'เบอร์โทร',              required: false },
      { key: 'age',    label: 'อายุ',                  required: false },
      { key: 'gender', label: 'เพศ',                   required: false },
      { key: 'status', label: 'สถานะ',                 required: false },
    ],
    sample: {
      'ชื่อ-นามสกุล': 'นายตัวอย่าง ข้อมูล',
      'อีเมล':         'example@email.com',
      'เบอร์โทร':      '081-000-0000',
      'อายุ':          '25',
      'เพศ':           'ชาย',
      'สถานะ':         'active',
    },
    validate: r => r['ชื่อ-นามสกุล'] && r['อีเมล'],
    uniqueKey: 'email',
    transform: (r, i) => ({
      id:            'u' + Date.now().toString().slice(-6) + i,
      name:          r['ชื่อ-นามสกุล'] || '',
      email:         (r['อีเมล'] || '').toLowerCase().trim(),
      phone:         r['เบอร์โทร'] || '',
      age:           parseInt(r['อายุ']) || 0,
      gender:        r['เพศ'] || '',
      status:        r['สถานะ'] || 'active',
      registeredAt:  new Date().toISOString().split('T')[0],
      totalSessions: 0,
      lastSession:   '',
    }),
  },
  counselors: {
    label: 'นักจิตวิทยาให้คำปรึกษา',
    icon:  'user-check',
    file:  'counselors.json',
    headers: [
      { key: 'name',            label: 'ชื่อ-นามสกุล',            required: true  },
      { key: 'title',           label: 'ตำแหน่ง',                  required: true  },
      { key: 'email',           label: 'อีเมล',                    required: true  },
      { key: 'phone',           label: 'เบอร์โทร',                  required: false },
      { key: 'bio',             label: 'ประวัติย่อ',                required: false },
      { key: 'specialties',     label: 'ความเชี่ยวชาญ (คั่นด้วย |)', required: false },
      { key: 'languages',       label: 'ภาษา (คั่นด้วย |)',         required: false },
      { key: 'sessionDuration', label: 'ระยะเวลาต่อครั้ง (นาที)',  required: false },
    ],
    sample: {
      'ชื่อ-นามสกุล':              'ดร.ชื่อ นามสกุล',
      'ตำแหน่ง':                   'นักจิตวิทยาคลินิก',
      'อีเมล':                     'counselor@MindCare.th',
      'เบอร์โทร':                   '081-000-0000',
      'ประวัติย่อ':                 'ผู้เชี่ยวชาญด้านสุขภาพจิต',
      'ความเชี่ยวชาญ (คั่นด้วย |)': 'ความวิตกกังวล|ภาวะซึมเศร้า',
      'ภาษา (คั่นด้วย |)':          'ไทย|อังกฤษ',
      'ระยะเวลาต่อครั้ง (นาที)':   '60',
    },
    validate: r => r['ชื่อ-นามสกุล'] && r['อีเมล'],
    uniqueKey: 'email',
    transform: (r, i) => {
      const name = r['ชื่อ-นามสกุล'] || ''
      return {
        id:              'c' + Date.now().toString().slice(-6) + i,
        name,
        title:           r['ตำแหน่ง'] || '',
        email:           (r['อีเมล'] || '').toLowerCase().trim(),
        phone:           r['เบอร์โทร'] || '',
        bio:             r['ประวัติย่อ'] || '',
        specialties:     (r['ความเชี่ยวชาญ (คั่นด้วย |)'] || '').split('|').map(s => s.trim()).filter(Boolean),
        languages:       (r['ภาษา (คั่นด้วย |)'] || 'ไทย').split('|').map(s => s.trim()).filter(Boolean),
        sessionDuration: parseInt(r['ระยะเวลาต่อครั้ง (นาที)']) || 60,
        rating:          0,
        reviewCount:     0,
        status:          'pending',
        isApproved:      false,
        avatar:          name.slice(0, 2).toUpperCase(),
        photo:           null,
        createdAt:       new Date().toISOString().split('T')[0],
      }
    },
  },
  appointments: {
    label: 'นัดหมาย',
    icon:  'calendar-check',
    file:  'appointments.json',
    headers: [
      { key: 'clientId',    label: 'รหัสผู้รับบริการ',      required: true  },
      { key: 'counselorId', label: 'รหัสนักจิตวิทยา',       required: true  },
      { key: 'date',        label: 'วันที่ (YYYY-MM-DD)',    required: true  },
      { key: 'time',        label: 'เวลา (HH:MM)',           required: true  },
      { key: 'type',        label: 'รูปแบบ (online/onsite)', required: false },
      { key: 'duration',    label: 'ระยะเวลา (นาที)',        required: false },
      { key: 'note',        label: 'บันทึก',                  required: false },
    ],
    sample: {
      'รหัสผู้รับบริการ':      'u001',
      'รหัสนักจิตวิทยา':       'c001',
      'วันที่ (YYYY-MM-DD)':    '2026-07-01',
      'เวลา (HH:MM)':           '10:00',
      'รูปแบบ (online/onsite)': 'online',
      'ระยะเวลา (นาที)':        '60',
      'บันทึก':                  '',
    },
    validate: r => r['รหัสผู้รับบริการ'] && r['รหัสนักจิตวิทยา'] && r['วันที่ (YYYY-MM-DD)'] && r['เวลา (HH:MM)'],
    uniqueKey: null,
    transform: (r, i, extra) => {
      const client     = (extra.clients     || []).find(c => c.id === r['รหัสผู้รับบริการ']) || {}
      const counselor  = (extra.counselors  || []).find(c => c.id === r['รหัสนักจิตวิทยา']) || {}
      return {
        id:            'a' + Date.now().toString().slice(-6) + i,
        clientId:      r['รหัสผู้รับบริการ'] || '',
        clientName:    client.name  || r['รหัสผู้รับบริการ'],
        counselorId:   r['รหัสนักจิตวิทยา'] || '',
        counselorName: counselor.name || r['รหัสนักจิตวิทยา'],
        date:          r['วันที่ (YYYY-MM-DD)'] || '',
        time:          r['เวลา (HH:MM)'] || '',
        duration:      parseInt(r['ระยะเวลา (นาที)']) || 60,
        type:          r['รูปแบบ (online/onsite)'] || 'online',
        status:        'pending',
        note:          r['บันทึก'] || '',
        createdAt:     new Date().toISOString().split('T')[0],
      }
    },
  },
}

// ── GET page ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const tab    = req.query.tab    || 'import'
  const type   = req.query.type   || 'clients'
  const result = req.query.result || null
  const count  = parseInt(req.query.count) || 0
  const error  = req.query.error  || null
  const schema = SCHEMAS[type] || SCHEMAS.clients

  const counts = {}
  Object.entries(SCHEMAS).forEach(([k, s]) => {
    try { counts[k] = readData(s.file).length } catch { counts[k] = 0 }
  })

  res.render('admin/import-export', {
    page: 'import-export', title: 'นำเข้า-ส่งออก ข้อมูล',
    tab, type, schema, SCHEMAS, counts, result, count, error,
  })
})

// ── GET template CSV ──────────────────────────────────────────────
router.get('/template/:type', (req, res) => {
  const schema = SCHEMAS[req.params.type]
  if (!schema) return res.redirect('/admin/import-export')
  const csv = toCSV([schema.sample], schema.headers)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="template_${req.params.type}.csv"`)
  res.send('﻿' + csv)
})

// ── GET export CSV ────────────────────────────────────────────────
router.get('/export/:type', (req, res) => {
  const schema = SCHEMAS[req.params.type]
  if (!schema) return res.redirect('/admin/import-export')

  const data = readData(schema.file)
  const rows = data.map(item => {
    const row = {}
    schema.headers.forEach(h => {
      let val = item[h.key]
      if (Array.isArray(val)) val = val.join('|')
      row[h.label] = val ?? ''
    })
    return row
  })

  const csv = toCSV(rows, schema.headers)
  const date = new Date().toISOString().split('T')[0]
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="export_${req.params.type}_${date}.csv"`)
  res.send('﻿' + csv)
})

// ── POST import ───────────────────────────────────────────────────
router.post('/import', upload.single('file'), (req, res) => {
  const type   = req.body.type || 'clients'
  const schema = SCHEMAS[type]
  const back   = `/admin/import-export?tab=import&type=${type}`

  if (!schema || !req.file) return res.redirect(back + '&error=no_file')

  try {
    const text = fs.readFileSync(req.file.path, 'utf8').replace(/^﻿/, '')
    fs.unlinkSync(req.file.path)

    const rows   = parseCSV(text)
    const valid  = rows.filter(r => schema.validate(r))
    const data   = readData(schema.file)
    const extra  = { clients: readData('clients.json'), counselors: readData('counselors.json') }

    let imported = 0
    valid.forEach((row, i) => {
      if (schema.uniqueKey) {
        const header = schema.headers.find(h => h.key === schema.uniqueKey)?.label || schema.uniqueKey
        const val = (row[header] || '').toLowerCase().trim()
        if (data.some(d => (d[schema.uniqueKey] || '').toLowerCase() === val)) return
      }
      data.push(schema.transform(row, i, extra))
      imported++
    })

    writeData(schema.file, data)
    res.redirect(back + `&result=success&count=${imported}`)
  } catch (e) {
    try { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path) } catch {}
    res.redirect(back + '&error=parse_error')
  }
})

module.exports = router

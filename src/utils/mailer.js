require('dotenv').config()
const nodemailer = require('nodemailer')

// ── Transporter ───────────────────────────────────────────────────────────────

function getTransporter() {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-email@gmail.com') {
    return null
  }
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function typeLabel(type) {
  return type === 'online' ? '🌐 ออนไลน์ (Video Call)' : '📍 เข้ารับบริการด้วยตนเอง (On-site)'
}

// ── Shared Email Wrapper ──────────────────────────────────────────────────────

function emailWrapper(title, accentColor, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,${accentColor.from},${accentColor.to});padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:10px;padding:6px 14px;margin-bottom:16px;">
                  <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:1px;">MINDWELL</span>
                </div>
                <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;line-height:1.3;">${title}</h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px 28px;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
          <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;line-height:1.6;">
            อีเมลนี้ถูกส่งโดยระบบอัตโนมัติจาก MindWell · ข้อมูลทุกอย่างได้รับการคุ้มครองตาม พ.ร.บ. PDPA<br>
            กรุณาอย่าตอบกลับอีเมลนี้โดยตรง หากมีคำถามติดต่อ <a href="mailto:${process.env.SMTP_FROM_EMAIL || 'hello@mindwell.th'}" style="color:#05967e;text-decoration:none;">${process.env.SMTP_FROM_EMAIL || 'hello@mindwell.th'}</a>
          </p>
          <p style="margin:0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} MindWell · ระบบจองนัดหมายการให้คำปรึกษาทางสุขภาพจิต</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`
}

// ── Info Box Component ────────────────────────────────────────────────────────

function infoBox(heading, rows, bgColor = '#f8fafc', borderColor = '#e2e8f0') {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid ${borderColor};vertical-align:top;">
        <span style="font-size:12px;color:#94a3b8;font-weight:500;min-width:120px;display:inline-block;">${label}</span>
      </td>
      <td style="padding:8px 0;border-bottom:1px solid ${borderColor};vertical-align:top;">
        <span style="font-size:13px;color:#1e293b;font-weight:500;">${value || '—'}</span>
      </td>
    </tr>`).join('')

  return `
    <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:12px;padding:20px;margin-bottom:20px;">
      <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${heading}</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowsHtml}
      </table>
    </div>`
}

// ── Tag Component ─────────────────────────────────────────────────────────────

function tags(items) {
  return items.map(t =>
    `<span style="display:inline-block;padding:3px 10px;background:#dbeafe;color:#1e40af;border-radius:99px;font-size:11px;font-weight:500;margin:2px 3px 2px 0;">${t}</span>`
  ).join('')
}

// ── Template: ยืนยันนัดหมาย → ส่งให้ผู้รับบริการ ─────────────────────────────

function clientEmailHtml({ appointment, client, counselor, concern }) {
  const dateStr  = formatDate(appointment.date)
  const specList = Array.isArray(counselor.specialties) ? counselor.specialties : []

  const body = `
    <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.7;">
      สวัสดี <strong style="color:#1e293b;">${client.name}</strong><br>
      ระบบได้บันทึกการนัดหมายของคุณเรียบร้อยแล้ว ด้านล่างนี้คือรายละเอียดทั้งหมด
    </p>

    <!-- Appointment Badge -->
    <div style="background:linear-gradient(135deg,#ecfdf9,#e0f2fe);border:1px solid #a0f3e1;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#05967e;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">✅ ยืนยันนัดหมายแล้ว</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#1e293b;">${dateStr}</p>
      <p style="margin:4px 0 0;font-size:16px;color:#05967e;font-weight:600;">เวลา ${appointment.time} น. (${appointment.duration} นาที)</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">${typeLabel(appointment.type)}</p>
    </div>

    ${infoBox('🧑‍⚕️ ข้อมูลนักจิตวิทยาให้คำปรึกษา', [
      ['ชื่อ', `<strong>${counselor.name}</strong>`],
      ['ตำแหน่ง', counselor.title || ''],
      ['โทรศัพท์', counselor.phone || ''],
      ['อีเมล', counselor.email ? `<a href="mailto:${counselor.email}" style="color:#05967e;text-decoration:none;">${counselor.email}</a>` : ''],
      ['ความเชี่ยวชาญ', specList.length ? tags(specList) : ''],
    ], '#f0fdf4', '#bbf7d0')}

    ${infoBox('📋 รายละเอียดการนัดหมาย', [
      ['รหัสการนัด', `<span style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:12px;">${appointment.id}</span>`],
      ['วันที่', dateStr],
      ['เวลา', `${appointment.time} น.`],
      ['ระยะเวลา', `${appointment.duration} นาที`],
      ['รูปแบบ', appointment.type === 'online' ? 'ออนไลน์ (Video Call)' : 'เข้ารับบริการด้วยตนเอง (On-site)'],
      ...(concern ? [['เรื่องที่ปรึกษา', concern]] : []),
      ...(appointment.note ? [['หมายเหตุ', appointment.note]] : []),
    ])}

    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        ⏰ <strong>โปรดจำ:</strong> กรุณาเข้าสู่ระบบล่วงหน้า 5–10 นาทีก่อนเวลานัดหมาย
        หากต้องการยกเลิกหรือเลื่อนนัด กรุณาติดต่อล่วงหน้าไม่น้อยกว่า 24 ชั่วโมง
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;">
      ขอบคุณที่ไว้วางใจ MindWell ในการดูแลสุขภาพจิตของคุณ 💚<br>
      หากมีคำถามใด กรุณาติดต่อทีมงานผ่านอีเมล ${process.env.SMTP_FROM_EMAIL || 'hello@mindwell.th'}
    </p>`

  return emailWrapper(
    'ยืนยันการนัดหมายของคุณ',
    { from: '#05967e', to: '#06b6d4' },
    body
  )
}

// ── Template: แจ้งนัดหมายใหม่ → ส่งให้นักจิตวิทยา ──────────────────────────

function counselorEmailHtml({ appointment, client, counselor, concern }) {
  const dateStr = formatDate(appointment.date)

  const body = `
    <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.7;">
      สวัสดี <strong style="color:#1e293b;">${counselor.name}</strong><br>
      คุณมีนัดหมายใหม่จากระบบ MindWell กรุณาตรวจสอบรายละเอียดด้านล่าง
    </p>

    <!-- Alert Badge -->
    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe);border:1px solid #ddd6fe;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">📅 นัดหมายใหม่</p>
      <p style="margin:0;font-size:20px;font-weight:700;color:#1e293b;">${dateStr}</p>
      <p style="margin:4px 0 0;font-size:16px;color:#7c3aed;font-weight:600;">เวลา ${appointment.time} น. (${appointment.duration} นาที)</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">${typeLabel(appointment.type)}</p>
    </div>

    ${infoBox('👤 ข้อมูลผู้รับบริการ', [
      ['ชื่อ', `<strong>${client.name}</strong>`],
      ['โทรศัพท์', client.phone || ''],
      ['อีเมล', client.email ? `<a href="mailto:${client.email}" style="color:#05967e;text-decoration:none;">${client.email}</a>` : ''],
      ...(concern ? [['เรื่องที่ต้องการ', concern]] : []),
    ], '#faf5ff', '#e9d5ff')}

    ${infoBox('📋 รายละเอียดการนัดหมาย', [
      ['รหัสการนัด', `<span style="font-family:monospace;background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:12px;">${appointment.id}</span>`],
      ['วันที่', dateStr],
      ['เวลา', `${appointment.time} น.`],
      ['ระยะเวลา', `${appointment.duration} นาที`],
      ['รูปแบบ', appointment.type === 'online' ? 'ออนไลน์ (Video Call)' : 'เข้ารับบริการด้วยตนเอง (On-site)'],
      ...(appointment.note ? [['หมายเหตุ', appointment.note]] : []),
    ])}

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
        💡 <strong>เตรียมความพร้อม:</strong> กรุณาตรวจสอบข้อมูลผู้รับบริการและเตรียมเนื้อหาเซสชันล่วงหน้า
        หากลูกค้ายังไม่ได้ติดต่อมา สามารถโทรยืนยันนัดหมายได้ที่ ${client.phone || 'เบอร์ในระบบ'}
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;">
      ขอบคุณสำหรับการให้บริการผ่านระบบ MindWell 💚<br>
      หากมีคำถามใด กรุณาติดต่อทีมงานผ่านอีเมล ${process.env.SMTP_FROM_EMAIL || 'hello@mindwell.th'}
    </p>`

  return emailWrapper(
    `นัดหมายใหม่ — ${client.name}`,
    { from: '#7c3aed', to: '#6366f1' },
    body
  )
}

// ── Main Export ───────────────────────────────────────────────────────────────

async function sendAppointmentEmails({ appointment, client, counselor, concern }) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[Email] SMTP ยังไม่ได้ตั้งค่า — ข้ามการส่งอีเมล (แก้ไขไฟล์ .env เพื่อเปิดใช้งาน)')
    return { skipped: true }
  }

  const fromName  = process.env.SMTP_FROM_NAME  || 'MindWell'
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER
  const from      = `"${fromName}" <${fromEmail}>`
  const bcc       = process.env.SMTP_BCC || undefined
  const dateStr   = formatDate(appointment.date)

  const results = []

  // ── ส่งให้ผู้รับบริการ ──────────────────────────────────────────────────────
  if (client.email) {
    try {
      const info = await transporter.sendMail({
        from,
        to:      client.email,
        bcc,
        subject: `[MindWell] ✅ ยืนยันการนัดหมาย — ${dateStr} เวลา ${appointment.time} น.`,
        html:    clientEmailHtml({ appointment, client, counselor, concern }),
      })
      console.log(`[Email] ✅ ส่งให้ผู้รับบริการ ${client.email} — ${info.messageId}`)
      results.push({ to: 'client', ok: true })
    } catch (err) {
      console.error(`[Email] ❌ ส่งให้ผู้รับบริการล้มเหลว: ${err.message}`)
      results.push({ to: 'client', ok: false, error: err.message })
    }
  } else {
    console.log(`[Email] ⚠️  ผู้รับบริการ "${client.name}" ไม่มีอีเมล — ข้ามการส่ง`)
  }

  // ── ส่งให้นักจิตวิทยา ──────────────────────────────────────────────────────
  if (counselor.email) {
    try {
      const info = await transporter.sendMail({
        from,
        to:      counselor.email,
        bcc,
        subject: `[MindWell] 📅 นัดหมายใหม่ — ${client.name} ${dateStr} เวลา ${appointment.time} น.`,
        html:    counselorEmailHtml({ appointment, client, counselor, concern }),
      })
      console.log(`[Email] ✅ ส่งให้นักจิตวิทยา ${counselor.email} — ${info.messageId}`)
      results.push({ to: 'counselor', ok: true })
    } catch (err) {
      console.error(`[Email] ❌ ส่งให้นักจิตวิทยาล้มเหลว: ${err.message}`)
      results.push({ to: 'counselor', ok: false, error: err.message })
    }
  } else {
    console.log(`[Email] ⚠️  นักจิตวิทยา "${counselor.name}" ไม่มีอีเมล — ข้ามการส่ง`)
  }

  return { sent: results }
}

module.exports = { sendAppointmentEmails }

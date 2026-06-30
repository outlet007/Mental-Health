require('dotenv').config()
const nodemailer = require('nodemailer')

function isPlaceholder(value, placeholders = []) {
  return !value || placeholders.includes(String(value).trim())
}

function getTransporter() {
  const host = process.env.SMTP_HOST || 'localhost'
  const port = parseInt(process.env.SMTP_PORT || '1025', 10)
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const authDisabled = process.env.SMTP_AUTH === 'false'
  const canAuth = !authDisabled && !isPlaceholder(user, ['your-email@gmail.com']) && !isPlaceholder(pass, ['your-app-password'])
  const options = { host, port, secure }
  if (canAuth) options.auth = { user, pass }
  return nodemailer.createTransport(options)
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function typeLabel(type, lang = 'th') {
  if (lang === 'en') return type === 'online' ? 'Online video call' : 'On-site service'
  return type === 'online' ? '\u0e2d\u0e2d\u0e19\u0e44\u0e25\u0e19\u0e4c (Video Call)' : '\u0e40\u0e02\u0e49\u0e32\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e14\u0e49\u0e27\u0e22\u0e15\u0e19\u0e40\u0e2d\u0e07 (On-site)'
}

function icon(name, color = '#05967e') {
  const paths = {
    'heart-handshake': '<path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 0 1 7.1-7.1l.4.4.4-.4a5 5 0 0 1 7.1 7.1Z"/><path d="M12 20l-2-2 2-2 2 2-2 2Z"/>',
    video: '<path d="m16 13 5 3V8l-5 3"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
    calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/>',
    user: '<path d="M19 21a7 7 0 0 0-14 0"/><circle cx="12" cy="7" r="4"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    'smile-plus': '<path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/><circle cx="12" cy="12" r="10"/><path d="M20 5v6M23 8h-6"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    meh: '<circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><path d="M9 9h.01M15 9h.01"/>',
    frown: '<circle cx="12" cy="12" r="10"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01M15 9h.01"/>',
    'circle-alert': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
  }
  return `<svg data-email-icon="${name}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-4px;margin-right:8px;">${paths[name] || paths.clipboard}</svg>`
}

function row(label, value) {
  return `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:38%;">${label}</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">${value || '-'}</td></tr>`
}

function card(title, rows, color = '#05967e') {
  return `<div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin:18px 0;background:#ffffff;"><h3 style="margin:0 0 10px;color:${color};font-size:15px;">${title}</h3><table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table></div>`
}

function languageToggle(thHtml, enHtml) {
  return `<input id="email-lang-th" name="email-lang" type="radio" checked style="display:none;"><input id="email-lang-en" name="email-lang" type="radio" style="display:none;"><style>#email-lang-th:checked ~ .email-lang-th{display:block!important}#email-lang-th:checked ~ .email-lang-en{display:none!important}#email-lang-en:checked ~ .email-lang-th{display:none!important}#email-lang-en:checked ~ .email-lang-en{display:block!important}#email-lang-th:checked ~ .lang-switch label[for="email-lang-th"],#email-lang-en:checked ~ .lang-switch label[for="email-lang-en"]{background:#05967e!important;color:#fff!important;border-color:#05967e!important}.lang-switch label{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:7px 14px;margin-right:8px;font-size:13px;font-weight:700;color:#334155;background:#fff;cursor:pointer}</style><div data-email-language-switch="true" class="lang-switch" style="margin:0 0 20px;"><label for="email-lang-th">TH</label><label for="email-lang-en">EN</label></div><div class="email-lang-th" style="display:block;">${thHtml}</div><div class="email-lang-en" style="display:none;">${enHtml}</div>`
}

function emailWrapper(title, accentColor, thHtml, enHtml) {
  const body = languageToggle(thHtml, enHtml)
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif;"><tr><td align="center" style="padding:28px 14px;"><table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08);"><tr><td style="background:linear-gradient(135deg,${accentColor.from},${accentColor.to});padding:30px 36px;color:#fff;"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;margin-bottom:10px;">MindCare</div><h1 style="margin:0;font-size:23px;line-height:1.35;">${title}</h1></td></tr><tr><td style="padding:30px 36px;">${body}</td></tr><tr><td style="border-top:1px solid #e2e8f0;padding:18px 36px;color:#94a3b8;font-size:12px;line-height:1.7;">\u0e2d\u0e35\u0e40\u0e21\u0e25\u0e19\u0e35\u0e49\u0e2a\u0e48\u0e07\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a MindCare \u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34<br>&copy; ${new Date().getFullYear()} MindCare</td></tr></table></td></tr></table></body></html>`
}

function appointmentDetails({ appointment, client, counselor, concern }, lang = 'th') {
  const dateStr = formatDate(appointment.date)
  if (lang === 'en') {
    return card(`${icon('calendar')}Appointment details`, [
      row('Appointment ID', appointment.id), row('Date', dateStr), row('Time', `${appointment.time}`), row('Duration', `${appointment.duration} minutes`), row('Type', typeLabel(appointment.type, 'en')), row('Topic', concern || '-')
    ]) + card(`${icon('user')}Counselor`, [row('Name', counselor.name), row('Email', counselor.email || '-'), row('Phone', counselor.phone || '-')])
  }
  return card(`${icon('calendar')}\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22`, [
    row('\u0e23\u0e2b\u0e31\u0e2a\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14', appointment.id), row('\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48', dateStr), row('\u0e40\u0e27\u0e25\u0e32', `${appointment.time} \u0e19.`), row('\u0e23\u0e30\u0e22\u0e30\u0e40\u0e27\u0e25\u0e32', `${appointment.duration} \u0e19\u0e32\u0e17\u0e35`), row('\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a', typeLabel(appointment.type)), row('\u0e40\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e17\u0e35\u0e48\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32', concern || '-')
  ]) + card(`${icon('user')}\u0e19\u0e31\u0e01\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32`, [row('\u0e0a\u0e37\u0e48\u0e2d', counselor.name), row('\u0e2d\u0e35\u0e40\u0e21\u0e25', counselor.email || '-'), row('\u0e42\u0e17\u0e23\u0e28\u0e31\u0e1e\u0e17\u0e4c', counselor.phone || '-')])
}

function clientEmailHtml(data) {
  const th = `<p style="font-size:15px;line-height:1.8;color:#334155;margin:0 0 18px;">${icon('heart-handshake')}\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35 <strong>${data.client.name}</strong><br>\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13\u0e40\u0e23\u0e35\u0e22\u0e1a\u0e23\u0e49\u0e2d\u0e22\u0e41\u0e25\u0e49\u0e27</p>${appointmentDetails(data, 'th')}<p>${icon('video')}\u0e42\u0e1b\u0e23\u0e14\u0e40\u0e02\u0e49\u0e32\u0e23\u0e48\u0e27\u0e21\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e27\u0e25\u0e32 5-10 \u0e19\u0e32\u0e17\u0e35</p>`
  const en = `<p style="font-size:15px;line-height:1.8;color:#334155;margin:0 0 18px;">${icon('heart-handshake')}Hello <strong>${data.client.name}</strong><br>Your appointment has been confirmed.</p>${appointmentDetails(data, 'en')}<p>${icon('video')}Please join 5-10 minutes before the appointment time.</p>`
  return emailWrapper('\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22', { from: '#05967e', to: '#06b6d4' }, th, en)
}

function counselorEmailHtml(data) {
  const th = `<p style="font-size:15px;line-height:1.8;color:#334155;margin:0 0 18px;">${icon('heart-handshake')}\u0e2a\u0e27\u0e31\u0e2a\u0e14\u0e35 <strong>${data.counselor.name}</strong><br>\u0e04\u0e38\u0e13\u0e21\u0e35\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22\u0e43\u0e2b\u0e21\u0e48\u0e08\u0e32\u0e01 MindCare</p>${appointmentDetails(data, 'th')}<p>${icon('video')}\u0e42\u0e1b\u0e23\u0e14\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e23\u0e39\u0e1b\u0e41\u0e1a\u0e1a\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22\u0e01\u0e48\u0e2d\u0e19\u0e40\u0e27\u0e25\u0e32</p>`
  const en = `<p style="font-size:15px;line-height:1.8;color:#334155;margin:0 0 18px;">${icon('heart-handshake')}Hello <strong>${data.counselor.name}</strong><br>You have a new appointment from MindCare.</p>${appointmentDetails(data, 'en')}<p>${icon('video')}Please check the appointment format before the session.</p>`
  return emailWrapper('\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22\u0e43\u0e2b\u0e21\u0e48', { from: '#7c3aed', to: '#6366f1' }, th, en)
}

function surveyEmailHtml({ appointment, client, counselor }) {
  const icons = ['smile-plus', 'smile', 'meh', 'frown', 'circle-alert'].map((name, idx) => `<span style="display:inline-block;margin:4px 5px;padding:10px 12px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;color:#92400e;">${icon(name, '#f59e0b')}${5 - idx}</span>`).join('')
  const detailTh = card(`${icon('clipboard')}\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22`, [row('\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48', formatDate(appointment.date)), row('\u0e40\u0e27\u0e25\u0e32', `${appointment.time} \u0e19.`), row('\u0e19\u0e31\u0e01\u0e08\u0e34\u0e15\u0e27\u0e34\u0e17\u0e22\u0e32', counselor.name)])
  const detailEn = card(`${icon('clipboard')}Appointment details`, [row('Date', formatDate(appointment.date)), row('Time', appointment.time), row('Counselor', counselor.name)])
  const feedbackTh = `<div style="border:1px solid #fde68a;border-radius:14px;padding:18px;margin-bottom:18px;background:#fff7ed;text-align:center;"><h3 style="margin:0 0 8px;color:#92400e;">${icon('smile-plus', '#f59e0b')}\u0e04\u0e27\u0e32\u0e21\u0e04\u0e34\u0e14\u0e40\u0e2b\u0e47\u0e19\u0e02\u0e2d\u0e07\u0e17\u0e48\u0e32\u0e19\u0e0a\u0e48\u0e27\u0e22\u0e43\u0e2b\u0e49\u0e40\u0e23\u0e32\u0e1e\u0e31\u0e12\u0e19\u0e32\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e14\u0e35\u0e22\u0e34\u0e48\u0e07\u0e02\u0e36\u0e49\u0e19</h3><p style="margin:0 0 12px;color:#b45309;">\u0e17\u0e33\u0e41\u0e1a\u0e1a\u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08</p>${icons}</div>`
  const feedbackEn = `<div style="border:1px solid #fde68a;border-radius:14px;padding:18px;margin-bottom:18px;background:#fff7ed;text-align:center;"><h3 style="margin:0 0 8px;color:#92400e;">${icon('smile-plus', '#f59e0b')}Your feedback helps us improve our service.</h3><p style="margin:0 0 12px;color:#b45309;">Please rate your satisfaction</p>${icons}</div>`
  return emailWrapper('\u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08', { from: '#f59e0b', to: '#f97316' }, feedbackTh + detailTh, feedbackEn + detailEn)
}

function fromAddress() {
  const fromName = process.env.SMTP_FROM_NAME || 'MindCare'
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'mindcare@example.test'
  return `"${fromName}" <${fromEmail}>`
}

async function sendSurveyEmail({ appointment, client, counselor, surveyUrl }) {
  const transporter = getTransporter()
  if (!client.email) return { skipped: true }
  const info = await transporter.sendMail({
    from: fromAddress(),
    to: client.email,
    subject: `[MindCare] \u0e1b\u0e23\u0e30\u0e40\u0e21\u0e34\u0e19\u0e04\u0e27\u0e32\u0e21\u0e1e\u0e36\u0e07\u0e1e\u0e2d\u0e43\u0e08 - ${formatDate(appointment.date)}`,
    html: surveyEmailHtml({ appointment, client, counselor, surveyUrl }),
  })
  return { sent: true, messageId: info.messageId }
}

async function sendAppointmentEmails({ appointment, client, counselor, concern }) {
  const transporter = getTransporter()
  const bcc = process.env.SMTP_BCC || undefined
  const sent = []
  if (client.email) {
    const info = await transporter.sendMail({ from: fromAddress(), to: client.email, bcc, subject: `[MindCare] \u0e22\u0e37\u0e19\u0e22\u0e31\u0e19\u0e01\u0e32\u0e23\u0e19\u0e31\u0e14\u0e2b\u0e21\u0e32\u0e22 - ${formatDate(appointment.date)} ${appointment.time}`, html: clientEmailHtml({ appointment, client, counselor, concern }) })
    sent.push({ to: 'client', ok: true, messageId: info.messageId })
  }
  if (counselor.email) {
    const info = await transporter.sendMail({ from: fromAddress(), to: counselor.email, bcc, subject: `[MindCare] New appointment - ${client.name} ${formatDate(appointment.date)} ${appointment.time}`, html: counselorEmailHtml({ appointment, client, counselor, concern }) })
    sent.push({ to: 'counselor', ok: true, messageId: info.messageId })
  }
  return { sent }
}

module.exports = { sendAppointmentEmails, sendSurveyEmail }

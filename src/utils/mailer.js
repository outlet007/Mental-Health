require('dotenv').config()
const nodemailer = require('nodemailer')
const { renderTemplateFields, hasClosingVariants } = require('./email-templates')
const { displayAppointmentNumber } = require('./case-management')

function isPlaceholder(value, placeholders = []) {
  return !value || placeholders.includes(String(value).trim())
}

function getTransporter(config) {
  if (config) {
    const options = { host: config.host, port: config.port, secure: !!config.secure }
    if (config.auth) options.auth = { user: config.user, pass: config.pass }
    return nodemailer.createTransport(options)
  }
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

function buildVars({ appointment, client, counselor }) {
  return {
    clientName: client?.name || '',
    counselorName: counselor?.name || '',
    date: formatDate(appointment.date),
    time: appointment.time,
    duration: appointment.duration,
    appointmentId: displayAppointmentNumber(appointment),
  }
}

function typeLabel(type, lang = 'th') {
  if (lang === 'en') {
    if (type === 'phone') return 'Phone call'
    return type === 'online' ? 'Online video call' : 'On-site service'
  }
  if (type === 'phone') return 'โทรศัพท์ (Phone call)'
  return type === 'online' ? 'ออนไลน์ (Video Call)' : 'เข้ารับบริการด้วยตนเอง (On-site)'
}

function icon(name, color = '#05967e', standalone = false) {
  const paths = {
    'heart-handshake': '<path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 0 1 7.1-7.1l.4.4.4-.4a5 5 0 0 1 7.1 7.1Z"/><path d="M12 20l-2-2 2-2 2 2-2 2Z"/>',
    video: '<path d="m16 13 5 3V8l-5 3"/><rect width="14" height="12" x="2" y="6" rx="2"/>',
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.59 2.61a2 2 0 0 1-.45 2.11L8 9.63a16 16 0 0 0 6.37 6.37l1.19-1.19a2 2 0 0 1 2.11-.45c.84.27 1.71.47 2.61.59A2 2 0 0 1 22 16.92Z"/>',
    calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/>',
    user: '<path d="M19 21a7 7 0 0 0-14 0"/><circle cx="12" cy="7" r="4"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    'smile-plus': '<path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/><circle cx="12" cy="12" r="10"/><path d="M20 5v6M23 8h-6"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    meh: '<circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><path d="M9 9h.01M15 9h.01"/>',
    frown: '<circle cx="12" cy="12" r="10"/><path d="M8 16s1.5-2 4-2 4 2 4 2"/><path d="M9 9h.01M15 9h.01"/>',
    'circle-alert': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
  }
  const style = standalone ? '' : 'vertical-align:-4px;margin-right:8px;'
  return `<svg data-email-icon="${name}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="${style}">${paths[name] || paths.clipboard}</svg>`
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function row(label, value) {
  return `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:38%;">${label}</td><td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">${value || '-'}</td></tr>`
}

function card(title, rows, color = '#05967e') {
  return `<div style="border:1px solid #e2e8f0;border-radius:14px;padding:18px;margin:18px 0;background:#ffffff;"><h3 style="margin:0 0 10px;color:${color};font-size:15px;">${title}</h3><table width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table></div>`
}

function appointmentAccessDetails({ appointment, client }, lang = 'th', audience = 'client', accessDetails = {}) {
  const fallback = lang === 'en'
    ? {
        onlineTitle: 'Video call link',
        onlineLinkLabel: 'Join link',
        phoneTitle: 'Phone counseling',
        phoneCounselorPhoneLabel: 'Client phone',
        phoneClientNoticeLabel: 'Notice',
        phoneClientNoticeText: 'The counselor will call you for counseling.',
      }
    : {
        onlineTitle: '\u0e25\u0e34\u0e07\u0e01\u0e4c\u0e40\u0e02\u0e49\u0e32\u0e23\u0e48\u0e27\u0e21\u0e27\u0e34\u0e14\u0e35\u0e42\u0e2d\u0e04\u0e2d\u0e25',
        onlineLinkLabel: '\u0e25\u0e34\u0e07\u0e01\u0e4c',
        phoneTitle: '\u0e01\u0e32\u0e23\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32\u0e17\u0e32\u0e07\u0e42\u0e17\u0e23\u0e28\u0e31\u0e1e\u0e17\u0e4c',
        phoneCounselorPhoneLabel: '\u0e40\u0e1a\u0e2d\u0e23\u0e4c\u0e42\u0e17\u0e23\u0e1c\u0e39\u0e49\u0e23\u0e31\u0e1a\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23',
        phoneClientNoticeLabel: '\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21',
        phoneClientNoticeText: '\u0e08\u0e34\u0e15\u0e41\u0e1e\u0e17\u0e22\u0e4c\u0e08\u0e30\u0e42\u0e17\u0e23\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e01\u0e25\u0e31\u0e1a\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e43\u0e2b\u0e49\u0e04\u0e33\u0e1b\u0e23\u0e36\u0e01\u0e29\u0e32',
      }
  const text = key => accessDetails[key] || fallback[key]
  if (appointment.type === 'online' && appointment.meetingLink) {
    const safeLink = escapeHtml(appointment.meetingLink)
    const linkHtml = `<a href="${safeLink}" target="_blank" rel="noopener noreferrer" style="color:#05967e;text-decoration:underline;word-break:break-all;">${safeLink}</a>`
    return card(icon('video') + text('onlineTitle'), [row(text('onlineLinkLabel'), linkHtml)])
  }
  if (appointment.type === 'phone') {
    if (audience === 'counselor') {
      return card(icon('phone') + text('phoneTitle'), [row(text('phoneCounselorPhoneLabel'), client.phone || '-')])
    }
    return card(icon('phone') + text('phoneTitle'), [row(text('phoneClientNoticeLabel'), text('phoneClientNoticeText'))])
  }
  return ''
}

function paragraph(iconName, iconColor, html) {
  return `<p style="font-size:15px;line-height:1.8;color:#334155;margin:0 0 18px;">${icon(iconName, iconColor)}${html}</p>`
}

// Highlighted "don't miss this" card for the arrival/join/call instruction —
// more eye-catching than a plain paragraph so clients notice it. For online
// appointments, `link` appends a clickable "join now" button right after the
// text, on the same line.
function noticeCard(iconName, html, link) {
  const linkHtml = link
    ? ` <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;vertical-align:middle;margin-left:8px;background:#05967e;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:6px 14px;border-radius:999px;">${icon('video', '#ffffff', true)}${escapeHtml(link.label)}</a>`
    : ''
  return `<div style="border:1.5px solid #a0f3e1;border-radius:14px;padding:14px 18px;margin:18px 0;background:#f0fdfa;"><div style="display:flex;align-items:center;gap:12px;"><div style="flex-shrink:0;width:38px;height:38px;border-radius:10px;background:#05967e;display:flex;align-items:center;justify-content:center;">${icon(iconName, '#ffffff', true)}</div><p style="margin:0;font-size:15px;font-weight:700;line-height:1.6;color:#065f56;">${html}${linkHtml}</p></div></div>`
}

function languageToggle(thHtml, enHtml) {
  return `<input id="email-lang-th" name="email-lang" type="radio" checked style="display:none;"><input id="email-lang-en" name="email-lang" type="radio" style="display:none;"><style>#email-lang-th:checked ~ .email-lang-th{display:block!important}#email-lang-th:checked ~ .email-lang-en{display:none!important}#email-lang-en:checked ~ .email-lang-th{display:none!important}#email-lang-en:checked ~ .email-lang-en{display:block!important}#email-lang-th:checked ~ .lang-switch label[for="email-lang-th"],#email-lang-en:checked ~ .lang-switch label[for="email-lang-en"]{background:#05967e!important;color:#fff!important;border-color:#05967e!important}.lang-switch label{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:7px 14px;margin-right:8px;font-size:13px;font-weight:700;color:#334155;background:#fff;cursor:pointer}</style><div data-email-language-switch="true" class="lang-switch" style="margin:0 0 20px;"><label for="email-lang-th">TH</label><label for="email-lang-en">EN</label></div><div class="email-lang-th" style="display:block;">${thHtml}</div><div class="email-lang-en" style="display:none;">${enHtml}</div>`
}

function emailWrapper(title, accentColor, thHtml, enHtml) {
  const body = languageToggle(thHtml, enHtml)
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;font-family:'Noto Sans Thai','Segoe UI',Arial,sans-serif;"><tr><td align="center" style="padding:28px 14px;"><table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08);"><tr><td style="background:linear-gradient(135deg,${accentColor.from},${accentColor.to});padding:30px 36px;color:#fff;"><div style="font-size:13px;font-weight:700;letter-spacing:.08em;margin-bottom:10px;">MindCare</div><h1 style="margin:0;font-size:23px;line-height:1.35;">${title}</h1></td></tr><tr><td style="padding:30px 36px;">${body}</td></tr><tr><td style="border-top:1px solid #e2e8f0;padding:18px 36px;color:#94a3b8;font-size:12px;line-height:1.7;">อีเมลนี้ส่งจากระบบ MindCare อัตโนมัติ<br>&copy; ${new Date().getFullYear()} MindCare</td></tr></table></td></tr></table></body></html>`
}

function appointmentDetails({ appointment, client, counselor, concern }, lang = 'th', audience = 'client', accessDetails) {
  const dateStr = formatDate(appointment.date)
  if (lang === 'en') {
    return card(`${icon('calendar')}Appointment details`, [
      row('Appointment ID', displayAppointmentNumber(appointment)), row('Date', dateStr), row('Time', `${appointment.time}`), row('Duration', `${appointment.duration} minutes`), row('Type', typeLabel(appointment.type, 'en')), row('Topic', concern || '-')
    ]) + appointmentAccessDetails({ appointment, client }, 'en', audience, accessDetails) + card(`${icon('user')}Counselor`, [row('Name', counselor.name), row('Email', counselor.email || '-'), row('Phone', counselor.phone || '-')])
  }
  return card(`${icon('calendar')}รายละเอียดการนัดหมาย`, [
    row('รหัสการนัด', displayAppointmentNumber(appointment)), row('วันที่', dateStr), row('เวลา', `${appointment.time} น.`), row('ระยะเวลา', `${appointment.duration} นาที`), row('รูปแบบ', typeLabel(appointment.type)), row('เรื่องที่ปรึกษา', concern || '-')
  ]) + appointmentAccessDetails({ appointment, client }, 'th', audience, accessDetails) + card(`${icon('user')}นักจิตวิทยา`, [row('ชื่อ', counselor.name), row('อีเมล', counselor.email || '-'), row('โทรศัพท์', counselor.phone || '-')])
}

// Shared shape for the 3 email types that are just: greeting paragraph +
// the standard appointment-details cards + an optional closing paragraph.
// For appointmentClient/reminder, the closing line (and its icon) depend on
// whether the appointment is online ("join") or onsite ("arrive").
function standardEmailHtml(type, data, accentColor, greetingIcon, closingIcon, templateOverride, audience = 'client') {
  const vars = buildVars(data)
  const apptType = data.appointment.type
  const resolvedClosingIcon = hasClosingVariants(type)
    ? (apptType === 'onsite' ? ['map-pin', '#05967e'] : (apptType === 'phone' ? ['phone', '#05967e'] : ['video', '#05967e']))
    : closingIcon
  const build = lang => {
    const t = renderTemplateFields(type, lang, vars, templateOverride, apptType)
    const joinLink = (hasClosingVariants(type) && apptType === 'online' && data.appointment.meetingLink)
      ? { url: data.appointment.meetingLink, label: lang === 'en' ? 'Join video call' : 'เข้าร่วมวิดีโอคอล' }
      : null
    const closingHtml = t.closing
      ? (hasClosingVariants(type) ? noticeCard(resolvedClosingIcon[0], t.closing, joinLink) : paragraph(...resolvedClosingIcon, t.closing))
      : ''
    return { title: t.title, html: paragraph(...greetingIcon, t.greeting) + appointmentDetails(data, lang, audience, t.accessDetails) + closingHtml }
  }
  const th = build('th')
  const en = build('en')
  return emailWrapper(th.title, accentColor, th.html, en.html)
}

function clientEmailHtml(data, templateOverride) {
  return standardEmailHtml('appointmentClient', data, { from: '#05967e', to: '#06b6d4' }, ['heart-handshake', '#05967e'], ['video', '#05967e'], templateOverride, 'client')
}

function counselorEmailHtml(data, templateOverride) {
  return standardEmailHtml('appointmentCounselor', data, { from: '#3874FF', to: '#6366f1' }, ['heart-handshake', '#05967e'], ['video', '#05967e'], templateOverride, 'counselor')
}

function reminderEmailHtml(data, templateOverride) {
  return standardEmailHtml('reminder', data, { from: '#f59e0b', to: '#fb923c' }, ['calendar', '#f59e0b'], ['video', '#05967e'], templateOverride)
}

function surveyEmailHtml({ appointment, client, counselor, surveyUrl }, templateOverride) {
  const vars = buildVars({ appointment, client, counselor })
  const th = renderTemplateFields('survey', 'th', vars, templateOverride)
  const en = renderTemplateFields('survey', 'en', vars, templateOverride)
  const ratingIcons = ['smile-plus', 'smile', 'meh', 'frown', 'circle-alert'].map((name, idx) => {
    const rating = 5 - idx
    const separator = String(surveyUrl || '').includes('?') ? '&' : '?'
    const ratingUrl = `${surveyUrl || '#'}${surveyUrl ? `${separator}rating=${rating}` : ''}`
    return `<a href="${escapeHtml(ratingUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Rate ${rating} out of 5" style="display:inline-block;margin:4px 5px;padding:10px 12px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;color:#92400e;text-decoration:none;font-weight:700;">${icon(name, '#f59e0b')}${rating}</a>`
  }).join('')
  const detailTh = card(`${icon('clipboard')}รายละเอียดการนัดหมาย`, [row('วันที่', formatDate(appointment.date)), row('เวลา', `${appointment.time} น.`), row('นักจิตวิทยา', counselor.name)])
  const detailEn = card(`${icon('clipboard')}Appointment details`, [row('Date', formatDate(appointment.date)), row('Time', appointment.time), row('Counselor', counselor.name)])
  const feedbackBlock = (heading, subtext) => `<div style="border:1px solid #fde68a;border-radius:14px;padding:18px;margin-bottom:18px;background:#fff7ed;text-align:center;"><h3 style="margin:0 0 8px;color:#92400e;">${icon('smile-plus', '#f59e0b')}${heading}</h3><p style="margin:0 0 12px;color:#b45309;">${subtext}</p>${ratingIcons}</div>`
  return emailWrapper(th.title, { from: '#f59e0b', to: '#f97316' }, feedbackBlock(th.greeting, th.closing) + detailTh, feedbackBlock(en.greeting, en.closing) + detailEn)
}

function counselorReassignedEmailHtml({ appointment, client, counselor }, templateOverride) {
  const vars = buildVars({ appointment, client, counselor })
  const th = renderTemplateFields('counselorReassigned', 'th', vars, templateOverride)
  const en = renderTemplateFields('counselorReassigned', 'en', vars, templateOverride)
  const dateStr = formatDate(appointment.date)
  const detailTh = card(`${icon('calendar')}รายละเอียดนัดหมายที่ถูกนำออกจากคิว`, [
    row('รหัสการนัด', displayAppointmentNumber(appointment)), row('ผู้รับบริการ', client.name), row('วันที่เดิม', dateStr), row('เวลาเดิม', `${appointment.time} น.`)
  ], '#ef4444')
  const detailEn = card(`${icon('calendar')}Appointment removed from your schedule`, [
    row('Appointment ID', displayAppointmentNumber(appointment)), row('Client', client.name), row('Original date', dateStr), row('Original time', appointment.time)
  ], '#ef4444')
  const thHtml = paragraph('circle-alert', '#ef4444', th.greeting) + detailTh + (th.closing ? paragraph('video', '#05967e', th.closing) : '')
  const enHtml = paragraph('circle-alert', '#ef4444', en.greeting) + detailEn + (en.closing ? paragraph('video', '#05967e', en.closing) : '')
  return emailWrapper(th.title, { from: '#ef4444', to: '#f97316' }, thHtml, enHtml)
}

function fromAddress(config) {
  if (config) return `"${config.fromName}" <${config.fromEmail}>`
  const fromName = process.env.SMTP_FROM_NAME || 'MindCare'
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'mindcare@example.test'
  return `"${fromName}" <${fromEmail}>`
}

async function sendReminderEmail({ appointment, client, counselor, concern, deliveryConfig }) {
  const transporter = getTransporter(deliveryConfig)
  if (!client.email) return { skipped: true }
  const title = renderTemplateFields('reminder', 'th', buildVars({ appointment, client, counselor })).title
  const info = await transporter.sendMail({
    from: fromAddress(deliveryConfig),
    to: client.email,
    subject: `[MindCare] ${title} - ${formatDate(appointment.date)} ${appointment.time}`,
    html: reminderEmailHtml({ appointment, client, counselor, concern }),
  })
  return { sent: true, messageId: info.messageId }
}

async function sendCounselorReassignedEmail({ appointment, client, counselor, deliveryConfig }) {
  const transporter = getTransporter(deliveryConfig)
  if (!counselor.email) return { skipped: true }
  const title = renderTemplateFields('counselorReassigned', 'th', buildVars({ appointment, client, counselor })).title
  const info = await transporter.sendMail({
    from: fromAddress(deliveryConfig),
    to: counselor.email,
    subject: `[MindCare] ${title} - ${client.name} ${formatDate(appointment.date)} ${appointment.time}`,
    html: counselorReassignedEmailHtml({ appointment, client, counselor }),
  })
  return { sent: true, messageId: info.messageId }
}

async function sendSurveyEmail({ appointment, client, counselor, surveyUrl, deliveryConfig }) {
  const transporter = getTransporter(deliveryConfig)
  if (!client.email) return { skipped: true }
  const title = renderTemplateFields('survey', 'th', buildVars({ appointment, client, counselor })).title
  const info = await transporter.sendMail({
    from: fromAddress(deliveryConfig),
    to: client.email,
    subject: `[MindCare] ${title} - ${formatDate(appointment.date)}`,
    html: surveyEmailHtml({ appointment, client, counselor, surveyUrl }),
  })
  return { sent: true, messageId: info.messageId }
}

async function sendAppointmentEmails({ appointment, client, counselor, concern, skipClient, skipCounselor, deliveryConfig }) {
  const transporter = getTransporter(deliveryConfig)
  const bcc = process.env.SMTP_BCC || undefined
  const sent = []
  const vars = buildVars({ appointment, client, counselor })
  if (!skipClient && client.email) {
    const title = renderTemplateFields('appointmentClient', 'th', vars).title
    const info = await transporter.sendMail({ from: fromAddress(deliveryConfig), to: client.email, bcc, subject: `[MindCare] ${title} - ${formatDate(appointment.date)} ${appointment.time}`, html: clientEmailHtml({ appointment, client, counselor, concern }) })
    sent.push({ to: 'client', ok: true, messageId: info.messageId })
  }
  if (!skipCounselor && counselor.email) {
    const title = renderTemplateFields('appointmentCounselor', 'th', vars).title
    const info = await transporter.sendMail({ from: fromAddress(deliveryConfig), to: counselor.email, bcc, subject: `[MindCare] ${title} - ${client.name} ${formatDate(appointment.date)} ${appointment.time}`, html: counselorEmailHtml({ appointment, client, counselor, concern }) })
    sent.push({ to: 'counselor', ok: true, messageId: info.messageId })
  }
  return { sent }
}

module.exports = {
  sendAppointmentEmails,
  sendSurveyEmail,
  sendCounselorReassignedEmail,
  sendReminderEmail,
  clientEmailHtml,
  counselorEmailHtml,
  counselorReassignedEmailHtml,
  surveyEmailHtml,
  reminderEmailHtml,
  buildVars,
}

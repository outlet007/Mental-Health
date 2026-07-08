const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const templatesPath = path.join(__dirname, '..', 'data', 'email-templates.json')

function withTempTemplatesFile(fn) {
  const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null
  return Promise.resolve().then(fn).finally(() => {
    if (before === null) fs.rmSync(templatesPath, { force: true })
    else fs.writeFileSync(templatesPath, before)
  })
}

test('EMAIL_TYPES catalog covers all 5 outbound email kinds', () => {
  const { EMAIL_TYPES, EMAIL_TYPE_IDS, DEFAULT_TEMPLATES } = require('../src/utils/email-templates')
  assert.deepEqual(EMAIL_TYPE_IDS.sort(), ['appointmentClient', 'appointmentCounselor', 'counselorReassigned', 'reminder', 'survey'].sort())
  for (const id of EMAIL_TYPE_IDS) {
    assert.ok(DEFAULT_TEMPLATES[id], `missing default template for ${id}`)
    assert.ok(DEFAULT_TEMPLATES[id].title.th, `missing default TH title for ${id}`)
  }
})

test('readEmailTemplates returns blank overrides by default (no file yet)', () => {
  withTempTemplatesFile(() => {
    fs.rmSync(templatesPath, { force: true })
    const { readEmailTemplates } = require('../src/utils/email-templates')
    const templates = readEmailTemplates()
    assert.equal(templates.appointmentClient.title.th, '')
    assert.equal(templates.appointmentClient.greeting.en, '')
  })
})

test('writeEmailTemplate saves one type without touching the others', () => {
  return withTempTemplatesFile(() => {
    const { writeEmailTemplate, readEmailTemplates } = require('../src/utils/email-templates')
    writeEmailTemplate('reminder', { title: { th: 'เตือนแบบกำหนดเอง', en: 'Custom reminder' }, greeting: { th: 'ทดสอบ', en: 'test' }, closing: { th: '', en: '' } })
    const all = readEmailTemplates()
    assert.equal(all.reminder.title.th, 'เตือนแบบกำหนดเอง')
    assert.equal(all.survey.title.th, '')
  })
})

test('writeEmailTemplate rejects unknown email types', () => {
  const { writeEmailTemplate } = require('../src/utils/email-templates')
  assert.throws(() => writeEmailTemplate('not-a-type', {}))
})

test('applyPlaceholders substitutes known tokens and leaves unknown ones untouched', () => {
  const { applyPlaceholders } = require('../src/utils/email-templates')
  assert.equal(
    applyPlaceholders('สวัสดี {{clientName}} นัดวันที่ {{date}}', { clientName: 'สมชาย', date: '7 กรกฎาคม' }),
    'สวัสดี สมชาย นัดวันที่ 7 กรกฎาคม'
  )
  assert.equal(applyPlaceholders('{{unknownToken}}', {}), '{{unknownToken}}')
  assert.equal(applyPlaceholders('', { clientName: 'x' }), '')
})

test('renderTemplateFields falls back to defaults for blank fields and applies overrides otherwise', () => {
  return withTempTemplatesFile(() => {
    const { writeEmailTemplate, renderTemplateFields, DEFAULT_TEMPLATES } = require('../src/utils/email-templates')
    writeEmailTemplate('survey', { title: { th: 'หัวข้อใหม่', en: 'หัวข้อใหม่' }, greeting: { th: '', en: '' }, closing: { th: 'ปิดท้ายใหม่ {{clientName}}', en: '' } })

    const fields = renderTemplateFields('survey', 'th', { clientName: 'สมหญิง' })
    assert.equal(fields.title, 'หัวข้อใหม่')
    assert.equal(fields.greeting, DEFAULT_TEMPLATES.survey.greeting.th)
    assert.equal(fields.closing, 'ปิดท้ายใหม่ สมหญิง')
  })
})

test('closing text differs between online and onsite for appointmentClient/reminder, and falls back per-variant', () => {
  return withTempTemplatesFile(() => {
    const { writeEmailTemplate, renderTemplateFields } = require('../src/utils/email-templates')

    // No override yet — defaults already differ by appointment type.
    const defaultOnline = renderTemplateFields('appointmentClient', 'th', {}, undefined, 'online')
    const defaultOnsite = renderTemplateFields('appointmentClient', 'th', {}, undefined, 'onsite')
    assert.notEqual(defaultOnline.closing, defaultOnsite.closing)
    assert.match(defaultOnline.closing, /เข้าร่วม/)
    assert.match(defaultOnsite.closing, /มาถึง/)

    // Override only the onsite variant — online keeps using the built-in default.
    writeEmailTemplate('appointmentClient', {
      title: { th: '', en: '' },
      greeting: { th: '', en: '' },
      closing: { th: { online: '', onsite: 'กรุณามาถึงศูนย์ก่อนเวลา {{time}}' }, en: { online: '', onsite: '' } },
    })
    const afterOverride = renderTemplateFields('appointmentClient', 'th', { time: '10:00' }, undefined, 'onsite')
    assert.equal(afterOverride.closing, 'กรุณามาถึงศูนย์ก่อนเวลา 10:00')
    const onlineStillDefault = renderTemplateFields('appointmentClient', 'th', {}, undefined, 'online')
    assert.equal(onlineStillDefault.closing, defaultOnline.closing)
  })
})

test('closing variants are unaffected by an unrecognized/missing appointment type (falls back to online)', () => {
  const { renderTemplateFields } = require('../src/utils/email-templates')
  const noType = renderTemplateFields('reminder', 'th', {}, undefined, undefined)
  const online = renderTemplateFields('reminder', 'th', {}, undefined, 'online')
  assert.equal(noType.closing, online.closing)
})

test('email types without closing variants keep a plain {th, en} closing shape', () => {
  const { renderTemplateFields, hasClosingVariants } = require('../src/utils/email-templates')
  assert.equal(hasClosingVariants('appointmentCounselor'), false)
  assert.equal(hasClosingVariants('counselorReassigned'), false)
  assert.equal(hasClosingVariants('survey'), false)
  assert.equal(hasClosingVariants('appointmentClient'), true)
  assert.equal(hasClosingVariants('reminder'), true)
  // apptType is irrelevant for non-variant types.
  const onsite = renderTemplateFields('appointmentCounselor', 'th', {}, undefined, 'onsite')
  const online = renderTemplateFields('appointmentCounselor', 'th', {}, undefined, 'online')
  assert.equal(onsite.closing, online.closing)
})

test('stripHtml removes tags but keeps placeholders and readable spacing', () => {
  const { stripHtml } = require('../src/utils/email-templates')
  assert.equal(
    stripHtml('สวัสดี <strong>{{clientName}}</strong><br>ยืนยันการนัดหมายของคุณเรียบร้อยแล้ว'),
    'สวัสดี {{clientName}} ยืนยันการนัดหมายของคุณเรียบร้อยแล้ว'
  )
  assert.equal(stripHtml(''), '')
  assert.equal(stripHtml(undefined), '')
})

test('getPlainDefaultTemplates strips tags from every type default for placeholder display', () => {
  const { getPlainDefaultTemplates, EMAIL_TYPE_IDS, hasClosingVariants } = require('../src/utils/email-templates')
  const plain = getPlainDefaultTemplates()
  for (const id of EMAIL_TYPE_IDS) {
    for (const field of ['title', 'greeting']) {
      assert.doesNotMatch(plain[id][field].th, /<[^>]+>/)
      assert.doesNotMatch(plain[id][field].en, /<[^>]+>/)
    }
    if (hasClosingVariants(id)) {
      assert.doesNotMatch(plain[id].closing.th.online, /<[^>]+>/)
      assert.doesNotMatch(plain[id].closing.th.onsite, /<[^>]+>/)
    } else {
      assert.doesNotMatch(plain[id].closing.th, /<[^>]+>/)
      assert.doesNotMatch(plain[id].closing.en, /<[^>]+>/)
    }
  }
  assert.match(plain.appointmentClient.greeting.th, /\{\{clientName\}\}/)
})

test('renderTemplateFields accepts a draft override without touching the saved file', () => {
  return withTempTemplatesFile(() => {
    const { renderTemplateFields } = require('../src/utils/email-templates')
    const before = fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null

    const fields = renderTemplateFields('survey', 'th', {}, {
      title: { th: 'draft title', en: 'draft title' },
      greeting: { th: 'draft greeting', en: '' },
      closing: { th: '', en: '' },
    })
    assert.equal(fields.title, 'draft title')
    assert.equal(fields.greeting, 'draft greeting')
    assert.equal(fs.existsSync(templatesPath) ? fs.readFileSync(templatesPath, 'utf8') : null, before)
  })
})

test('phone closing and appointment access detail text are template-driven', () => {
  return withTempTemplatesFile(() => {
    const { writeEmailTemplate, renderTemplateFields } = require('../src/utils/email-templates')
    const defaultPhone = renderTemplateFields('appointmentClient', 'en', {}, undefined, 'phone')
    assert.equal(defaultPhone.closing, 'Please keep your phone available at the appointment time.')
    assert.equal(defaultPhone.accessDetails.onlineTitle, 'Video call link')
    assert.equal(defaultPhone.accessDetails.phoneClientNoticeText, 'The counselor will call you for counseling.')

    writeEmailTemplate('appointmentClient', {
      title: { th: '', en: '' },
      greeting: { th: '', en: '' },
      closing: { th: { online: '', phone: '', onsite: '' }, en: { online: '', phone: 'Phone closing for {{clientName}}', onsite: '' } },
      accessDetails: {
        en: {
          onlineTitle: 'Custom video room',
          phoneClientNoticeText: 'Custom phone notice for {{clientName}}',
        },
      },
    })

    const fields = renderTemplateFields('appointmentClient', 'en', { clientName: 'Alex' }, undefined, 'phone')
    assert.equal(fields.closing, 'Phone closing for Alex')
    assert.equal(fields.accessDetails.onlineTitle, 'Custom video room')
    assert.equal(fields.accessDetails.onlineLinkLabel, defaultPhone.accessDetails.onlineLinkLabel)
    assert.equal(fields.accessDetails.phoneClientNoticeText, 'Custom phone notice for Alex')
  })
})

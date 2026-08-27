const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const {
  deleteConsultationAttachment,
  isAllowedDocument,
  readConsultationAttachment,
  saveConsultationAttachment,
} = require('../src/utils/consultation-attachments')

test('consultation attachments validate document type and encrypt contents at rest', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-attachment-'))
  const previousKey = process.env.DATA_ENCRYPTION_KEY
  const contents = Buffer.from('%PDF-1.7\nprivate consultation document')
  const file = {
    originalname: 'consultation.pdf',
    mimetype: 'application/pdf',
    size: contents.length,
    buffer: contents,
  }

  try {
    process.env.DATA_ENCRYPTION_KEY = 'ab'.repeat(32)
    assert.equal(isAllowedDocument(file, { verifySignature: true }), true)
    assert.equal(isAllowedDocument({ ...file, originalname: 'consultation.exe' }), false)

    const metadata = saveConsultationAttachment(file, directory)
    assert.equal(metadata.originalName, 'consultation.pdf')
    assert.equal(metadata.encrypted, true)

    const stored = fs.readFileSync(path.join(directory, metadata.storedName))
    assert.equal(stored.includes(Buffer.from('private consultation document')), false)
    assert.deepEqual(readConsultationAttachment(metadata, directory), contents)

    deleteConsultationAttachment(metadata, directory)
    assert.equal(fs.existsSync(path.join(directory, metadata.storedName)), false)
  } finally {
    if (previousKey === undefined) delete process.env.DATA_ENCRYPTION_KEY
    else process.env.DATA_ENCRYPTION_KEY = previousKey
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('consultation attachments reject a renamed file with an invalid signature', () => {
  const fakePdf = {
    originalname: 'renamed.pdf',
    mimetype: 'application/pdf',
    size: 12,
    buffer: Buffer.from('not a PDF'),
  }

  assert.equal(isAllowedDocument(fakePdf), true)
  assert.equal(isAllowedDocument(fakePdf, { verifySignature: true }), false)
})

test('attachment reads use shared client care-team access while note edits remain appointment-owner only', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'appointments.js'), 'utf8')
  const viewAccess = source.slice(source.indexOf('function canViewAppointment'), source.indexOf('function canUseClient'))
  const downloadRoute = source.slice(source.indexOf("router.get('/:id/consultation-attachment'"), source.indexOf("router.post('/:id/edit-note'"))
  const editNoteRoute = source.slice(source.indexOf("router.post('/:id/edit-note'"), source.indexOf("router.post('/:id/complete'"))

  assert.match(viewAccess, /canUseClient\(req, appointment\.clientId\)/)
  assert.match(downloadRoute, /if \(!canViewAppointment\(req, appointment\)\) return forbidden\(res\)/)
  assert.match(editNoteRoute, /if \(!canUseAppointment\(req, data\[idx\]\)\) return forbidden\(res\)/)
})
test('completed status can only be set through the consultation completion route', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'appointments.js'), 'utf8')
  const editRoute = source.slice(source.indexOf("router.post('/:id/edit'"), source.indexOf("router.post('/:id/delete'"))
  const completeRoute = source.slice(source.indexOf("router.post('/:id/complete'"))

  assert.match(editRoute, /status && status !== 'completed'/)
  assert.doesNotMatch(editRoute, /if \(status\) data\[idx\]\.status = status/)
  assert.match(completeRoute, /appt\.status = 'completed'/)
})
test('completion flow stores structured case, risk, disposition, and referral fields', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'appointments.js'), 'utf8')
  const viewSource = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'appointments.ejs'), 'utf8')
  const completeRoute = routeSource.slice(routeSource.indexOf("router.post('/:id/complete'"))

  ;['symptoms', 'riskLevel', 'riskDetail', 'caseDisposition', 'closedReason', 'referralRequired', 'referralDestination', 'referralReason'].forEach(field => {
    assert.ok(viewSource.includes(`name="${field}"`))
  })
  assert.ok(completeRoute.includes('normalizeRiskLevel(req.body.riskLevel)'))
  assert.ok(completeRoute.includes('normalizeDisposition(req.body.caseDisposition)'))
  assert.ok(completeRoute.includes('closeCase(cases, appt.caseId'))
  assert.ok(completeRoute.includes('futureAppointments.forEach(item => { item.caseId = nextCase.id })'))
})
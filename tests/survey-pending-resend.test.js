const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const ejs = require('ejs')

const { readJSON, writeJSON } = require('../src/utils/json-store')
const { getPendingSurveyAppointments, recordSurveyEmailSent } = require('../src/utils/survey-delivery')

test('pending surveys include only completed unevaluated appointments and respect counselor ownership', () => {
  const appointments = [
    { id: 'a1', counselorId: 'c1', status: 'completed', date: '2026-08-01' },
    { id: 'a2', counselorId: 'c1', status: 'completed', date: '2026-08-02' },
    { id: 'a3', counselorId: 'c2', status: 'completed', date: '2026-08-03' },
    { id: 'a4', counselorId: 'c1', status: 'confirmed', date: '2026-08-04' },
  ]
  const surveys = [{ appointmentId: 'a2' }]

  assert.deepEqual(getPendingSurveyAppointments(appointments, surveys).map(item => item.id), ['a3', 'a1'])
  assert.deepEqual(getPendingSurveyAppointments(appointments, surveys, 'c1').map(item => item.id), ['a1'])
})

test('successful survey email delivery records the latest time and increments its send count', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mindcare-survey-delivery-'))
  try {
    writeJSON(path.join(directory, 'appointments.json'), [{ id: 'a1', surveyEmailSendCount: 1 }])
    recordSurveyEmailSent('a1', directory, '2026-08-17T10:00:00.000Z')
    const [appointment] = readJSON(path.join(directory, 'appointments.json'))
    assert.equal(appointment.surveyEmailSendCount, 2)
    assert.equal(appointment.surveyEmailSentAt, '2026-08-17T10:00:00.000Z')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('pending survey tab renders resend tracking and a CSRF-protected resend action', async () => {
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'admin', 'surveys.ejs'), {
    title: 'Surveys', page: 'surveys', content: {}, csrfToken: 'test-token',
    session: { userType: 'admin' }, query: { tab: 'pending' },
    surveys: [], total: 0, avgRating: null,
    ratingCounts: [5, 4, 3, 2, 1].map(rating => ({ rating, count: 0 })),
    counselorSummaries: [], counselors: [], selectedCounselorId: 'all',
    isCounselorUser: false, dateFrom: '', dateTo: '', activeSurveyTab: 'pending',
    pendingSurveyAppointments: [{
      id: 'appointment-1', clientName: 'Client One', counselorName: 'Counselor One',
      date: '2026-08-01', time: '10:00', surveyEmailSendCount: 2,
      surveyEmailSentAt: '2026-08-17T10:00:00.000Z',
    }],
  })

  assert.match(html, /รอการประเมิน/)
  assert.match(html, /จำนวนครั้งที่ส่ง/)
  assert.match(html, /ส่งอีกครั้ง/)
  assert.match(html, /action="\/admin\/surveys\/appointments\/appointment-1\/resend"/)
  assert.match(html, /name="_csrf" value="test-token"/)
})

test('resend route limits counselors to their own appointments and rechecks completed surveys', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'admin', 'surveys.js'), 'utf8')
  const resend = source.slice(source.indexOf("router.post('/appointments/:id/resend'"), source.indexOf('module.exports'))
  assert.match(resend, /appointment\.counselorId !== req\.session\.counselorId/)
  assert.match(resend, /getSurveys\(\)\.some\(item => item\.appointmentId === appointment\.id\)/)
  assert.match(resend, /recordSurveyEmailSent\(appointment\.id, dataDir\)/)
})

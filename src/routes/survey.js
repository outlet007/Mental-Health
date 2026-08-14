const express = require('express')
const router = express.Router()
const path = require('path')
const rateLimit = require('express-rate-limit')
const { readJSON, writeJSON } = require('../utils/json-store')
const {
  createFormToken,
  verifyFormToken,
  isHoneypotClear,
  getTurnstileConfig,
  verifyTurnstile,
} = require('../utils/public-form-protection')

const dataDir = path.join(__dirname, '../../data')

function read(file) { return readJSON(path.join(dataDir, file)) }
function write(file, data) { writeJSON(path.join(dataDir, file), data) }
function getSurveys() { return readJSON(path.join(dataDir, 'surveys.json'), []) }

function publicFormLocals() {
  const turnstile = getTurnstileConfig()
  return {
    publicFormToken: createFormToken(),
    turnstileSiteKey: turnstile.enabled ? turnstile.siteKey : '',
  }
}

const surveyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

router.get('/:token', (req, res) => {
  const { token } = req.params
  const appointments = read('appointments.json')
  const appt = appointments.find(item => item.surveyToken === token)
  const formLocals = publicFormLocals()

  if (!appt) return res.render('survey', { error: 'not_found', appt: null, counselor: null, ...formLocals })
  if (appt.status !== 'completed') return res.render('survey', { error: 'not_ready', appt, counselor: null, ...formLocals })

  const surveys = getSurveys()
  if (surveys.some(item => item.appointmentId === appt.id)) {
    return res.render('survey', { error: 'already_done', appt, counselor: null, ...formLocals })
  }

  const counselors = read('counselors.json')
  const counselor = counselors.find(item => item.id === appt.counselorId) || {}
  res.render('survey', { error: null, appt, counselor, ...formLocals })
})

router.post('/:token', surveyLimiter, async (req, res) => {
  const { token } = req.params
  const returnToSurvey = () => res.redirect(`/survey/${encodeURIComponent(token)}`)
  const body = req.body || {}

  if (!isHoneypotClear(body.company_website) || !verifyFormToken(body.form_token)) return returnToSurvey()

  const rating = Number.parseInt(body.rating, 10)
  const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 2000) return returnToSurvey()

  const turnstileOk = await verifyTurnstile({
    token: body['cf-turnstile-response'],
    remoteIp: req.ip,
    action: 'survey',
  })
  if (!turnstileOk) return returnToSurvey()

  const appointments = read('appointments.json')
  const appt = appointments.find(item => item.surveyToken === token)
  if (!appt || appt.status !== 'completed') return returnToSurvey()

  const surveys = getSurveys()
  if (surveys.some(item => item.appointmentId === appt.id)) return returnToSurvey()

  const maxNum = surveys.reduce((max, survey) => {
    const match = String(survey.id).match(/^srv-(\d+)$/)
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max
  }, 0)

  surveys.push({
    id: 'srv-' + String(maxNum + 1).padStart(5, '0'),
    appointmentId: appt.id,
    clientId: appt.clientId,
    clientName: appt.clientName,
    counselorId: appt.counselorId,
    counselorName: appt.counselorName,
    appointmentDate: appt.date,
    rating,
    comment,
    submittedAt: new Date().toISOString(),
  })

  write('surveys.json', surveys)
  res.render('survey-thanks', { rating })
})

module.exports = router

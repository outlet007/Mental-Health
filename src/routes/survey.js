const express = require('express')
const router  = express.Router()
const fs      = require('fs')
const path    = require('path')

const dataDir = path.join(__dirname, '../../data')

function read(file) { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) }
function write(file, d) { fs.writeFileSync(path.join(dataDir, file), JSON.stringify(d, null, 2)) }

function getSurveys() {
  const f = path.join(dataDir, 'surveys.json')
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
}

router.get('/:token', (req, res) => {
  const { token } = req.params
  const appointments = read('appointments.json')
  const appt = appointments.find(a => a.surveyToken === token)

  if (!appt) {
    return res.render('survey', { error: 'not_found', appt: null, counselor: null })
  }
  if (appt.status !== 'completed') {
    return res.render('survey', { error: 'not_ready', appt, counselor: null })
  }

  const surveys = getSurveys()
  if (surveys.some(s => s.appointmentId === appt.id)) {
    return res.render('survey', { error: 'already_done', appt, counselor: null })
  }

  const counselors = read('counselors.json')
  const counselor  = counselors.find(c => c.id === appt.counselorId) || {}

  res.render('survey', { error: null, appt, counselor })
})

router.post('/:token', (req, res) => {
  const { token }           = req.params
  const { rating, comment } = req.body

  const appointments = read('appointments.json')
  const appt = appointments.find(a => a.surveyToken === token)
  if (!appt || appt.status !== 'completed') return res.redirect(`/survey/${token}`)

  const surveys = getSurveys()
  if (surveys.some(s => s.appointmentId === appt.id)) return res.redirect(`/survey/${token}`)

  const maxNum = surveys.reduce((max, s) => {
    const m = String(s.id).match(/^srv-(\d+)$/)
    return m ? Math.max(max, parseInt(m[1])) : max
  }, 0)

  surveys.push({
    id:              'srv-' + String(maxNum + 1).padStart(5, '0'),
    appointmentId:   appt.id,
    clientId:        appt.clientId,
    clientName:      appt.clientName,
    counselorId:     appt.counselorId,
    counselorName:   appt.counselorName,
    appointmentDate: appt.date,
    rating:          Math.min(5, Math.max(1, parseInt(rating) || 3)),
    comment:         (comment || '').trim(),
    submittedAt:     new Date().toISOString(),
  })

  write('surveys.json', surveys)

  res.render('survey-thanks', { rating: parseInt(rating) || 3 })
})

module.exports = router

const express = require('express')
const router = express.Router()
const {
  readSurveyEmailSettings,
  writeSurveyEmailSettings,
} = require('../../utils/survey-email-settings')

router.get('/', (req, res) => {
  res.render('admin/survey-email', {
    page: 'survey-email',
    title: 'อีเมลประเมินความพึงพอใจ',
    settings: readSurveyEmailSettings(),
    query: req.query,
  })
})

router.post('/', (req, res) => {
  writeSurveyEmailSettings({
    recipientMode: req.body.recipientMode,
    customEmail: req.body.customEmail,
    deliveryMode: req.body.deliveryMode,
    gmailUser: req.body.gmailUser,
    gmailAppPassword: req.body.gmailAppPassword,
    fromName: req.body.fromName,
    fromEmail: req.body.fromEmail,
  })
  res.redirect('/admin/survey-email?saved=1')
})

module.exports = router


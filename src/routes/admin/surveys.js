const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '../../../data')
const RATING_LABELS = { 5: 'มากที่สุด', 4: 'มาก', 3: 'ปานกลาง', 2: 'น้อย', 1: 'น้อยที่สุด' }

function getSurveys() {
  const f = path.join(dataDir, 'surveys.json')
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
}

function getCounselors() {
  const f = path.join(dataDir, 'counselors.json')
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []
}

function pct(count, total) {
  return total ? Math.round((count / total) * 100) : 0
}

function buildCounselorSummaries(counselors, surveys) {
  const counselorById = new Map(counselors.map(counselor => [counselor.id, counselor]))
  const grouped = surveys.reduce((acc, survey) => {
    const id = survey.counselorId || 'unknown-counselor'
    const counselor = counselorById.get(survey.counselorId)
    const rating = Number(survey.rating) || 0
    const submittedAt = survey.submittedAt || survey.createdAt || ''

    if (!acc[id]) {
      acc[id] = {
        id,
        name: counselor?.name || survey.counselorName || 'ไม่ระบุนักจิตวิทยา',
        title: counselor?.title || '',
        photo: counselor?.photo || '',
        avatar: counselor?.avatar || (survey.counselorName || '?').slice(0, 2),
        count: 0,
        ratingSum: 0,
        fiveStarCount: 0,
        latestAt: '',
        latestComment: '',
      }
    }

    acc[id].count += 1
    acc[id].ratingSum += rating
    if (rating === 5) acc[id].fiveStarCount += 1
    if (submittedAt >= acc[id].latestAt) {
      acc[id].latestAt = submittedAt
      acc[id].latestComment = survey.comment || survey.feedback || survey.message || survey.note || ''
    }

    return acc
  }, {})

  const rows = Object.values(grouped)
  const maxCount = Math.max(1, ...rows.map(item => item.count))

  return rows
    .map(item => ({
      ...item,
      avgRating: item.count ? (item.ratingSum / item.count).toFixed(1) : '-',
      fiveStarPercent: pct(item.fiveStarCount, item.count),
      countPercent: pct(item.count, maxCount),
    }))
    .sort((a, b) => Number(b.avgRating) - Number(a.avgRating) || b.count - a.count || a.name.localeCompare(b.name, 'th'))
}

function getSurveyContext(req) {
  const isCounselor = req.session.userType === 'counselor'
  const counselors = getCounselors()
  const allowedCounselors = isCounselor
    ? counselors.filter(counselor => counselor.id === req.session.counselorId)
    : counselors

  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateFrom || '') ? req.query.dateFrom : ''
  const dateTo   = /^\d{4}-\d{2}-\d{2}$/.test(req.query.dateTo   || '') ? req.query.dateTo   : ''

  const byCounselor = isCounselor
    ? getSurveys().filter(s => s.counselorId === req.session.counselorId)
    : getSurveys()

  const all = byCounselor.filter(s => {
    const submittedDate = (s.submittedAt || s.createdAt || '').slice(0, 10)
    if (dateFrom && submittedDate < dateFrom) return false
    if (dateTo   && submittedDate > dateTo)   return false
    return true
  })

  const requestedCounselorId = String(req.query.counselorId || 'all')
  const selectedCounselorId = !isCounselor && allowedCounselors.some(counselor => counselor.id === requestedCounselorId)
    ? requestedCounselorId
    : 'all'

  let surveys = all

  if (selectedCounselorId !== 'all') {
    surveys = surveys.filter(s => s.counselorId === selectedCounselorId)
  }

  const { rating: rFilter } = req.query
  if (rFilter && rFilter !== 'all') {
    surveys = surveys.filter(s => s.rating === parseInt(rFilter, 10))
  }

  surveys = surveys.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))

  return {
    isCounselor,
    counselors,
    allowedCounselors,
    all,
    surveys,
    selectedCounselorId,
    dateFrom,
    dateTo,
  }
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function surveyRowsToCsv(surveys) {
  const headers = ['วันที่ประเมิน', 'ผู้รับบริการ', 'นักจิตวิทยา', 'วันที่นัดหมาย', 'คะแนน', 'ระดับ', 'ข้อเสนอแนะ']
  const lines = surveys.map(survey => [
    survey.submittedAt || '',
    survey.clientName || '',
    survey.counselorName || '',
    survey.appointmentDate || '',
    survey.rating || '',
    RATING_LABELS[survey.rating] || survey.rating || '',
    survey.comment || survey.feedback || survey.message || survey.note || '',
  ].map(csvEscape).join(','))

  return `\uFEFF${headers.map(csvEscape).join(',')}\r\n${lines.join('\r\n')}`
}

router.get('/export.csv', (req, res) => {
  const { surveys, selectedCounselorId } = getSurveyContext(req)
  const rating = req.query.rating || 'all'
  const filename = `surveys-${selectedCounselorId}-${rating}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(surveyRowsToCsv(surveys))
})

router.get('/', (req, res) => {
  const {
    isCounselor,
    allowedCounselors,
    all,
    surveys,
    selectedCounselorId,
    dateFrom,
    dateTo,
  } = getSurveyContext(req)

  const total = all.length
  const avgRating = total ? (all.reduce((sum, s) => sum + s.rating, 0) / total).toFixed(1) : null
  const ratingCounts = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: all.filter(s => s.rating === r).length,
  }))
  const counselorSummaries = buildCounselorSummaries(allowedCounselors, all)

  res.render('admin/surveys', {
    page: 'surveys',
    title: 'แบบประเมินความพึงพอใจ',
    surveys,
    total,
    avgRating,
    ratingCounts,
    counselorSummaries,
    counselors: allowedCounselors,
    selectedCounselorId,
    isCounselorUser: isCounselor,
    query: req.query,
    dateFrom,
    dateTo,
  })
})

module.exports = router



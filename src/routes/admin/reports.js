const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '../../../data')
const REPORT_PAGE_SIZE_OPTIONS = [20, 40, 60]
const DEFAULT_REPORT_PAGE_SIZE = 20

const REPORT_TYPES = {
  all: 'ทั้งหมด',
  appointments: 'นัดหมาย',
  clients: 'ผู้รับบริการ',
  contacts: 'คำขอฝากข้อมูล',
  surveys: 'แบบประเมินความพึงพอใจ',
  counselors: 'นักจิตวิทยา',
}

const STATUS_LABELS = {
  active: 'ใช้งานอยู่',
  inactive: 'ปิดใช้งาน',
  pending: 'รอดำเนินการ',
  confirmed: 'ยืนยันแล้ว',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
  converted: 'แปลงเป็นนัดหมายแล้ว',
  new: 'รายการใหม่',
  approved: 'อนุมัติแล้ว',
}

function readData(file) {
  const filePath = path.join(dataDir, file)
  if (!fs.existsSync(filePath)) return []

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch (error) {
    return []
  }
}

function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function normalizeDate(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return fmtDate(date)
}

function getDefaultRange() {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: fmtDate(firstDay), to: fmtDate(today) }
}

function getFilters(query) {
  const defaults = getDefaultRange()
  let from = normalizeDate(query.from) || defaults.from
  let to = normalizeDate(query.to) || defaults.to
  if (from > to) [from, to] = [to, from]

  const type = REPORT_TYPES[query.type] ? query.type : 'all'
  const graphMonth = /^\d{4}-\d{2}$/.test(query.graphMonth || '') ? query.graphMonth : from.slice(0, 7)
  return { from, to, type, graphMonth }
}

function getRequestedPage(query) {
  const page = Number.parseInt(query.page, 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function getRequestedPageSize(query) {
  const pageSize = Number.parseInt(query.pageSize, 10)
  return REPORT_PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : DEFAULT_REPORT_PAGE_SIZE
}

function reportPageUrl(filters, page, pageSize) {
  const params = new URLSearchParams({ ...filters, page: String(page), pageSize: String(pageSize) })
  return `/admin/reports?${params.toString()}`
}

function buildPaginationItems(page, totalPages, filters, pageSize) {
  if (totalPages <= 1) return []
  const rawItems = []

  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i += 1) rawItems.push(i)
  } else {
    rawItems.push(1)
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)

    if (start > 2) rawItems.push('ellipsis')
    for (let i = start; i <= end; i += 1) rawItems.push(i)
    if (end < totalPages - 1) rawItems.push('ellipsis')
    rawItems.push(totalPages)
  }

  return rawItems.map((item, index) => item === 'ellipsis'
    ? { type: 'ellipsis', key: `ellipsis-${index}` }
    : { type: 'page', page: item, url: reportPageUrl(filters, item, pageSize), current: item === page })
}

function paginateRows(rows, query, filters) {
  const pageSize = getRequestedPageSize(query)
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const page = Math.min(getRequestedPage(query), totalPages)
  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalRows)

  return {
    rows: rows.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      pageSizeOptions: REPORT_PAGE_SIZE_OPTIONS,
      totalRows,
      totalPages,
      startRow: totalRows ? startIndex + 1 : 0,
      endRow: endIndex,
      prevUrl: page > 1 ? reportPageUrl(filters, page - 1, pageSize) : '',
      nextUrl: page < totalPages ? reportPageUrl(filters, page + 1, pageSize) : '',
      firstUrl: reportPageUrl(filters, 1, pageSize),
      lastUrl: reportPageUrl(filters, totalPages, pageSize),
      pages: buildPaginationItems(page, totalPages, filters, pageSize),
    },
  }
}

function inRange(value, filters) {
  const date = normalizeDate(value)
  if (!date) return false
  return date >= filters.from && date <= filters.to
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || '-'
}

function serviceTypeLabel(type) {
  if (type === 'online') return 'ออนไลน์'
  if (type === 'onsite') return 'ที่ศูนย์ให้คำปรึกษา'
  return type || '-'
}

function percent(count, total) {
  return total ? Math.round((count / total) * 100) : 0
}

function groupCount(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || '-'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function buildDateBuckets(filters) {
  const days = []
  const start = new Date(`${filters.from}T00:00:00`)
  const end = new Date(`${filters.to}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return days

  const maxDays = 31
  for (let d = new Date(start); d <= end && days.length < maxDays; d.setDate(d.getDate() + 1)) {
    days.push(fmtDate(d))
  }
  return days
}

function buildMonthDateBuckets(month) {
  const days = []
  if (!/^\d{4}-\d{2}$/.test(month || '')) return days

  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(year, monthNumber - 1, 1)
  const end = new Date(year, monthNumber, 0)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return days

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(fmtDate(d))
  }
  return days
}

function buildReportRows(data, filters) {
  const rowsByType = {
    appointments: data.appointments.map(item => ({
      type: 'นัดหมาย',
      date: normalizeDate(item.date || item.createdAt),
      id: item.id,
      name: item.clientName || '-',
      detail: [item.counselorName, serviceTypeLabel(item.type), item.time].filter(Boolean).join(' | '),
      status: statusLabel(item.status),
      score: '',
    })),
    clients: data.clients.map(item => ({
      type: 'ผู้รับบริการ',
      date: normalizeDate(item.registeredAt || item.createdAt),
      id: item.id,
      name: item.name || '-',
      detail: [item.email, item.phone].filter(Boolean).join(' | '),
      status: statusLabel(item.status),
      score: '',
    })),
    contacts: data.contacts.map(item => ({
      type: 'คำขอฝากข้อมูล',
      date: normalizeDate(item.createdAt),
      id: item.id,
      name: item.name || '-',
      detail: [item.concern, serviceTypeLabel(item.sessionType), item.email].filter(Boolean).join(' | '),
      status: statusLabel(item.status),
      score: '',
    })),
    surveys: data.surveys.map(item => ({
      type: 'แบบประเมินความพึงพอใจ',
      date: normalizeDate(item.submittedAt || item.createdAt || item.date),
      id: item.id,
      name: item.clientName || item.name || item.counselorName || '-',
      detail: item.comment || item.feedback || item.message || item.note || item.counselorName || '-',
      status: 'ส่งแบบประเมินแล้ว',
      score: item.rating || '',
    })),
    counselors: data.counselors.map(item => ({
      type: 'นักจิตวิทยา',
      date: normalizeDate(item.createdAt),
      id: item.id,
      name: item.name || '-',
      detail: [item.title, item.email].filter(Boolean).join(' | '),
      status: item.isApproved ? 'อนุมัติแล้ว' : statusLabel(item.status || 'pending'),
      score: item.rating || '',
    })),
  }

  const selectedRows = filters.type === 'all'
    ? Object.values(rowsByType).flat()
    : rowsByType[filters.type] || []

  return selectedRows
    .filter(row => inRange(row.date, filters))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

function buildCounselorSurveyStats(counselors, surveys) {
  const counselorById = new Map(counselors.map(counselor => [counselor.id, counselor]))
  const grouped = surveys.reduce((acc, survey) => {
    const id = survey.counselorId || `unknown-${survey.counselorName || 'counselor'}`
    const counselor = counselorById.get(survey.counselorId)
    const rating = Number(survey.rating) || 0
    const date = normalizeDate(survey.submittedAt || survey.createdAt || survey.date || survey.appointmentDate)

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
        latestDate: '',
        latestComment: '',
      }
    }

    acc[id].count += 1
    acc[id].ratingSum += rating
    if (rating === 5) acc[id].fiveStarCount += 1
    if (date >= acc[id].latestDate) {
      acc[id].latestDate = date
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
      fiveStarPercent: percent(item.fiveStarCount, item.count),
      countPercent: percent(item.count, maxCount),
    }))
    .sort((a, b) => Number(b.avgRating) - Number(a.avgRating) || b.count - a.count || a.name.localeCompare(b.name, 'th'))
}
function buildStats(data, filters) {
  const appointments = data.appointments.filter(item => inRange(item.date || item.createdAt, filters))
  const contacts = data.contacts.filter(item => inRange(item.createdAt, filters))
  const clients = data.clients.filter(item => inRange(item.registeredAt || item.createdAt, filters))
  const surveys = data.surveys.filter(item => inRange(item.submittedAt || item.createdAt || item.date, filters))

  const completedAppointments = appointments.filter(item => item.status === 'completed').length
  const activeAppointments = appointments.filter(item => item.status !== 'cancelled')
  const avgRating = surveys.length
    ? (surveys.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / surveys.length).toFixed(1)
    : null

  const serviceCounts = groupCount(activeAppointments, item => serviceTypeLabel(item.type))
  const maxServiceCount = Math.max(1, ...Object.values(serviceCounts))
  const dailyBuckets = buildMonthDateBuckets(filters.graphMonth)
  const dailyUsage = dailyBuckets.map(date => ({
    date,
    count: data.appointments.filter(item => normalizeDate(item.date || item.createdAt) === date).length,
  }))
  const dailyContactRequests = dailyBuckets.map(date => ({
    date,
    count: data.contacts.filter(item => normalizeDate(item.createdAt) === date).length,
  }))
  const maxDailyCount = Math.max(1, ...dailyUsage.map(item => item.count), ...dailyContactRequests.map(item => item.count))
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: surveys.filter(item => Number(item.rating) === rating).length,
  }))
  const counselorSatisfaction = buildCounselorSurveyStats(data.counselors, surveys)
  const statusCounts = groupCount(appointments, item => statusLabel(item.status))
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts))

  return {
    totalAppointments: appointments.length,
    completedAppointments,
    pendingAppointments: appointments.filter(item => item.status === 'pending').length,
    totalClients: clients.length,
    activeClients: clients.filter(item => item.status === 'active').length,
    totalContacts: contacts.length,
    newContacts: contacts.filter(item => item.status === 'new' || item.status === 'pending').length,
    surveyCount: surveys.length,
    avgRating,
    completionRate: percent(completedAppointments, activeAppointments.length),
    serviceUsage: Object.entries(serviceCounts).map(([label, count]) => ({
      label,
      count,
      percent: percent(count, maxServiceCount),
    })),
    dailyUsage: dailyUsage.map(item => ({
      ...item,
      percent: percent(item.count, maxDailyCount),
    })),
    dailyContactRequests: dailyContactRequests.map(item => ({
      ...item,
      percent: percent(item.count, maxDailyCount),
    })),
    ratingCounts,
    counselorSatisfaction,
    statusBreakdown: Object.entries(statusCounts).map(([label, count]) => ({
      label,
      count,
      percent: percent(count, maxStatusCount),
    })),
  }
}

function loadReportData() {
  return {
    appointments: readData('appointments.json'),
    clients: readData('clients.json'),
    contacts: readData('contacts.json'),
    surveys: readData('surveys.json'),
    counselors: readData('counselors.json'),
  }
}


function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function rowsToCSV(rows) {
  const headers = ['ประเภท', 'วันที่', 'รหัส', 'ชื่อ', 'รายละเอียด', 'สถานะ', 'คะแนน']
  const lines = rows.map(row => [
    row.type,
    row.date,
    row.id,
    row.name,
    row.detail,
    row.status,
    row.score,
  ].map(csvEscape).join(','))
  return `\uFEFF${headers.map(csvEscape).join(',')}\r\n${lines.join('\r\n')}`
}

router.get('/', (req, res) => {
  const filters = getFilters(req.query)
  const data = loadReportData()
  const stats = buildStats(data, filters)
  const allReportRows = buildReportRows(data, filters)
  const { rows: reportRows, pagination } = paginateRows(allReportRows, req.query, filters)
  const searchParams = new URLSearchParams(filters).toString()

  res.render('admin/reports', {
    page: 'reports',
    title: '\u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e2a\u0e16\u0e34\u0e15\u0e34',
    filters,
    reportTypes: REPORT_TYPES,
    stats,
    reportRows,
    pagination,
    exportUrl: `/admin/reports/export.csv?${searchParams}`,
  })
})

router.get('/export.csv', (req, res) => {
  const filters = getFilters(req.query)
  const data = loadReportData()
  const rows = buildReportRows(data, filters)
  const filename = `reports-${filters.type}-${filters.from}-${filters.to}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(rowsToCSV(rows))
})

module.exports = router





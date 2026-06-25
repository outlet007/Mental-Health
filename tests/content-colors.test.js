const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const test = require('node:test')
const express = require('express')

const contentPath = require('node:path').join(__dirname, '..', 'data', 'content.json')

function postForm(path, fields) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use('/admin/content', require('../src/routes/admin/content'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port
      const body = new URLSearchParams(fields).toString()
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      }, res => {
        res.resume()
        res.on('end', () => server.close(() => resolve(res)))
      })
      req.on('error', err => server.close(() => reject(err)))
      req.end(body)
    })
  })
}

test('sections form saves per-text colors beside section copy', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const res = await postForm('/admin/content/sections', {
      counselorsHeading: 'นักจิตวิทยา',
      counselorsSubtext: 'ทีมผู้เชี่ยวชาญ',
      bookHeading: 'ฝากข้อมูล',
      bookSubtext: 'รายละเอียด',
      bookFormHeading: 'หัวข้อฟอร์ม',
      contactEmail: 'hello@example.com',
      contactPhone: '02-000-0000',
      contactHours: '08:30-17:00',
      textColor_counselors_heading: '#123456',
      textColor_counselors_subtext: '#654321',
      textColor_book_heading: '#abcdef',
      textColor_book_subtext: '#fedcba',
      textColor_book_formHeading: '#112233',
    })

    assert.equal(res.statusCode, 302)
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.backgrounds.counselors.textColors.heading, '#123456')
    assert.equal(saved.backgrounds.counselors.textColors.subtext, '#654321')
    assert.equal(saved.backgrounds.book.textColors.heading, '#abcdef')
    assert.equal(saved.backgrounds.book.textColors.subtext, '#fedcba')
    assert.equal(saved.backgrounds.book.textColors.formHeading, '#112233')
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})


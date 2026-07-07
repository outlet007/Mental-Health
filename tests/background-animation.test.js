const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const test = require('node:test')
const express = require('express')
const ejs = require('ejs')

const contentPath = path.join(__dirname, '..', 'data', 'content.json')

function renderIndex(backgrounds) {
  const content = {
    hero: { badge: 'badge', heading1: 'h1', heading2: 'h2', subtext: 'sub', ctaMain: 'main', ctaSub: 'sub' },
    counselors: { heading: 'counselors', subtext: 'team' },
    book: { heading: 'book', subtext: 'book sub', formHeading: 'form' },
    faqs: [{ q: 'q1', a: 'a1' }],
    contact: { hours: 'hours' },
    backgrounds,
    en: {},
  }

  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join(__dirname, '..', 'views', 'index.ejs'),
      { content, counselors: [], query: {} },
      {},
      (err, html) => err ? reject(err) : resolve(html)
    )
  })
}

test('home page navbar has a persistent drop shadow', async () => {
  const html = await renderIndex({})

  assert.match(html, /<nav class="[^"]*shadow-\[0_1px_2px_rgba\(15,23,42,0\.06\),0_8px_20px_rgba\(15,23,42,0\.12\)\][^"]*"/)
})

function postBackgrounds(fields) {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use('/admin/content', require('../src/routes/admin/content'))

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const body = new URLSearchParams(fields).toString()
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path: '/admin/content/backgrounds',
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

test('section background images use configurable slow zoom animation with reduced-motion fallback', async () => {
  const html = await renderIndex({
    hero: { image: '/uploads/content/hero.jpg', imgOpacity: 0.6, color: '', opacity: 1, motionEnabled: true, motionDuration: 24, motionScale: 1.22, textColors: {} },
    counselors: { image: '/uploads/content/counselors.jpg', imgOpacity: 0.5, color: '', opacity: 1, textColors: {} },
  })

  assert.match(html, /@keyframes _bgzm_hero/)
  assert.match(html, /transform:scale\(1\.22\)/)
  assert.match(html, /animation:_bgzm_hero 24s ease-in-out infinite alternate/)
  assert.match(html, /class="section-bg-motion"/)
  assert.match(html, /prefers-reduced-motion:\s*reduce/)
})

test('section backgrounds render configurable bottom-only edge blend overlays per section', async () => {
  const html = await renderIndex({
    hero: { color: '#ffffff', opacity: 0.2, blend: 120, blendColor: '#f8fafc', textColors: {} },
    features: { image: '/uploads/content/features.jpg', imgOpacity: 0.7, blend: 80, blendColor: '#05967e', textColors: {} },
  })

  assert.doesNotMatch(html, /class="section-bg-blend section-bg-blend-top"/)
  assert.match(html, /class="section-bg-blend section-bg-blend-bottom"/)
  assert.match(html, /height:120px/)
  assert.match(html, /height:80px/)
  assert.match(html, /linear-gradient\(to top,rgba\(5,150,126,1\),rgba\(5,150,126,0\)\)/)
})
test('background settings form saves movement controls per section', async () => {
  const before = fs.readFileSync(contentPath, 'utf8')
  try {
    const res = await postBackgrounds({
      color_hero: '#ffffff',
      opacity_hero: '0.5',
      imgOpacity_hero: '0.8',
      blend_hero: '180',
      blendColor_hero: '#f8fafc',
      motionEnabled_hero: 'on',
      motionDuration_hero: '26',
      motionScale_hero: '1.18',
      color_counselors: '', opacity_counselors: '1', imgOpacity_counselors: '1', blend_counselors: '260', blendColor_counselors: '#badhex', motionEnabled_counselors: 'off', motionDuration_counselors: '30', motionScale_counselors: '1.1',
      color_features: '', opacity_features: '1', imgOpacity_features: '1', blend_features: '0', blendColor_features: '#ffffff', motionEnabled_features: 'on', motionDuration_features: '38', motionScale_features: '1.12',
      color_book: '', opacity_book: '1', imgOpacity_book: '1', blend_book: '0', blendColor_book: '#ffffff', motionEnabled_book: 'on', motionDuration_book: '38', motionScale_book: '1.12',
      color_faq: '', opacity_faq: '1', imgOpacity_faq: '1', blend_faq: '0', blendColor_faq: '#ffffff', motionEnabled_faq: 'on', motionDuration_faq: '38', motionScale_faq: '1.12',
      color_footer: '', opacity_footer: '1', imgOpacity_footer: '1', blend_footer: '0', blendColor_footer: '#0f172a', motionEnabled_footer: 'on', motionDuration_footer: '38', motionScale_footer: '1.12',
    })

    assert.equal(res.statusCode, 302)
    const saved = JSON.parse(fs.readFileSync(contentPath, 'utf8'))
    assert.equal(saved.backgrounds.hero.blend, 180)
    assert.equal(saved.backgrounds.hero.blendColor, '#f8fafc')
    assert.equal(saved.backgrounds.counselors.blend, 220)
    assert.equal(saved.backgrounds.counselors.blendColor, '')
    assert.equal(saved.backgrounds.hero.motionEnabled, true)
    assert.equal(saved.backgrounds.hero.motionDuration, 26)
    assert.equal(saved.backgrounds.hero.motionScale, 1.18)
    assert.equal(saved.backgrounds.counselors.motionEnabled, false)
  } finally {
    fs.writeFileSync(contentPath, before)
  }
})

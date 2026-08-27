// Sample counselors/clients/appointments for a fresh install, so the
// landing page and admin panel aren't completely empty on first boot.
//
// Traced back to this project's actual first commit (0d1e96c, 2026-06-17,
// before any real client ever used the app) - fabricated names, emails,
// and phone numbers, not real people. Verified before restoring: generic
// placeholder names/domains, sequential fake phone numbers, and dates that
// predate this repo's own history. See MindWell-Save-Stage.md, entry dated
// 2026-07-17, for the verification that went into that decision.
//
// Only consumed by ensureDataFiles() (src/utils/json-store.js) when the
// corresponding data/*.json file doesn't exist yet - never overwrites real
// data. admins.json is deliberately NOT seeded here: shipping even a
// placeholder password hash in a public repo would hand every clone a
// known login to brute-force. Use scripts/create-admin.js instead.
function daysFromNow(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function getSeedData() {
  const counselors = [
    {
      id: 'c001', name: 'ดร.สุภาพร เมธาวี', title: 'นักจิตวิทยาให้คำปรึกษา',
      specialties: ['ความวิตกกังวล', 'ภาวะซึมเศร้า', 'ความสัมพันธ์'],
      languages: ['ไทย', 'อังกฤษ'], rating: 4.9, reviewCount: 87,
      status: 'active', isApproved: true, avatar: 'SP', photo: null,
      email: 'supaporn@example.com', phone: '081-234-5678',
      bio: 'ผู้เชี่ยวชาญด้านจิตวิทยาคลินิกกว่า 12 ปี เน้นการบำบัดแบบ CBT และ Mindfulness',
      createdAt: daysFromNow(-420),
    },
    {
      id: 'c002', name: 'อาจารย์ธีรพงษ์ สันติสุข', title: 'นักบำบัดจิตใจ',
      specialties: ['ความเครียดจากงาน', 'การเปลี่ยนผ่านชีวิต', 'การสูญเสีย'],
      languages: ['ไทย'], rating: 4.7, reviewCount: 54,
      status: 'active', isApproved: true, avatar: 'TP', photo: null,
      email: 'theerapong@example.com', phone: '082-345-6789',
      bio: 'ประสบการณ์ 8 ปีในการช่วยเหลือผู้ที่ผ่านการสูญเสียและการเปลี่ยนผ่านชีวิต',
      createdAt: daysFromNow(-400),
    },
    {
      id: 'c003', name: 'ดร.พิมพ์ใจ รัตนกุล', title: 'จิตแพทย์',
      specialties: ['โรคไบโพลาร์', 'โรควิตกกังวล', 'ADHD'],
      languages: ['ไทย', 'อังกฤษ', 'จีน'], rating: 4.8, reviewCount: 112,
      status: 'active', isApproved: true, avatar: 'PR', photo: null,
      email: 'pimjai@example.com', phone: '083-456-7890',
      bio: 'จิตแพทย์ที่มีประสบการณ์ด้านโรคอารมณ์และการพัฒนาเด็กวัยรุ่น',
      createdAt: daysFromNow(-440),
    },
    {
      id: 'c004', name: 'คุณวรรณา เจริญสุข', title: 'นักให้คำปรึกษา',
      specialties: ['ปัญหาครอบครัว', 'การเลี้ยงดูบุตร', 'การสื่อสารในคู่รัก'],
      languages: ['ไทย'], rating: 4.6, reviewCount: 38,
      status: 'pending', isApproved: false, avatar: 'WJ', photo: null,
      email: 'wanna@example.com', phone: '084-567-8901',
      bio: 'เชี่ยวชาญด้านการให้คำปรึกษาครอบครัวและคู่รัก ด้วยประสบการณ์ 5 ปี',
      createdAt: daysFromNow(-14),
    },
  ]

  const clients = [
    { id: 'u001', name: 'นายกิตติพงษ์ ใจดี', studentId: '', email: 'kitti@example.com', phone: '089-111-2222', age: 28, gender: 'ชาย', registeredAt: daysFromNow(-120), totalSessions: 6, status: 'active', lastSession: daysFromNow(-9) },
    { id: 'u002', name: 'นางสาวมาลี สุขสันต์', studentId: '', email: 'malee@example.com', phone: '089-222-3333', age: 34, gender: 'หญิง', registeredAt: daysFromNow(-150), totalSessions: 12, status: 'active', lastSession: daysFromNow(-4) },
    { id: 'u003', name: 'นายอนุชา พรมมา', studentId: '', email: 'anucha@example.com', phone: '089-333-4444', age: 22, gender: 'ชาย', registeredAt: daysFromNow(-90), totalSessions: 3, status: 'active', lastSession: daysFromNow(-13) },
    { id: 'u004', name: 'นางสาวปิยะดา เกษมสุข', studentId: '', email: 'piyada@example.com', phone: '089-444-5555', age: 41, gender: 'หญิง', registeredAt: daysFromNow(-170), totalSessions: 18, status: 'active', lastSession: daysFromNow(-5) },
    { id: 'u005', name: 'นายสมชาย วงษ์ดี', studentId: '', email: 'somchai@example.com', phone: '089-555-6666', age: 55, gender: 'ชาย', registeredAt: daysFromNow(-75), totalSessions: 2, status: 'inactive', lastSession: daysFromNow(-58) },
  ]

  const appointments = [
    { id: 'a001', clientId: 'u001', clientName: 'นายกิตติพงษ์ ใจดี', counselorId: 'c001', counselorName: 'ดร.สุภาพร เมธาวี', date: daysFromNow(3), time: '10:00', duration: 60, type: 'online', status: 'confirmed', note: 'ติดตามอาการหลังเริ่มบำบัด', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-2) },
    { id: 'a002', clientId: 'u002', clientName: 'นางสาวมาลี สุขสันต์', counselorId: 'c002', counselorName: 'อาจารย์ธีรพงษ์ สันติสุข', date: daysFromNow(-4), time: '14:00', duration: 60, type: 'onsite', status: 'completed', note: '', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-6) },
    { id: 'a003', clientId: 'u003', clientName: 'นายอนุชา พรมมา', counselorId: 'c001', counselorName: 'ดร.สุภาพร เมธาวี', date: daysFromNow(6), time: '09:00', duration: 60, type: 'online', status: 'pending', note: 'ครั้งแรก', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-1) },
    { id: 'a004', clientId: 'u004', clientName: 'นางสาวปิยะดา เกษมสุข', counselorId: 'c003', counselorName: 'ดร.พิมพ์ใจ รัตนกุล', date: daysFromNow(2), time: '16:00', duration: 45, type: 'online', status: 'confirmed', note: 'ตรวจติดตาม', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-3) },
    { id: 'a005', clientId: 'u005', clientName: 'นายสมชาย วงษ์ดี', counselorId: 'c002', counselorName: 'อาจารย์ธีรพงษ์ สันติสุข', date: daysFromNow(9), time: '11:00', duration: 60, type: 'onsite', status: 'cancelled', note: '', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-8) },
    { id: 'a006', clientId: 'u002', clientName: 'นางสาวมาลี สุขสันต์', counselorId: 'c001', counselorName: 'ดร.สุภาพร เมธาวี', date: daysFromNow(-7), time: '13:00', duration: 60, type: 'online', status: 'cancelled', note: 'ผู้รับบริการยกเลิก', counselorNote: '', concern: '', surveyToken: null, createdAt: daysFromNow(-9) },
  ]

  return {
    'counselors.json': counselors,
    'clients.json': clients,
    'appointments.json': appointments,
  }
}

module.exports = { getSeedData }

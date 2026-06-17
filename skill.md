# Skill: ระบบจองนัดหมายการให้คำปรึกษาทางจิตใจ (Mental Health Counseling Booking System)

## ภาพรวมโครงการ

เว็บแอปพลิเคชันสำหรับจองนัดหมายการให้คำปรึกษาทางด้านสุขภาพจิต ครอบคลุมตั้งแต่การลงทะเบียนผู้ใช้ การเลือกนักจิตวิทยา/นักให้คำปรึกษา การจัดการตารางนัดหมาย และการติดตามการรักษา

---

## UX/UI Design & Theme

### แนวคิดการออกแบบ (Design Philosophy)

ระบบสุขภาพจิตต้องสื่อถึงความ **ปลอดภัย ไว้วางใจ และอบอุ่น** ผู้ใช้มักมาในสภาวะเปราะบาง การออกแบบจึงต้องลด cognitive load และสร้างความรู้สึกสงบตั้งแต่หน้าแรก

---

### Color Palette

#### Primary — Sage Green (ความสงบ, การเยียวยา)
```
--color-primary-50:  #f0f7f4   /* พื้นหลังอ่อน */
--color-primary-100: #d9ede6
--color-primary-200: #b3dace
--color-primary-300: #7ec0aa
--color-primary-400: #4da68a
--color-primary-500: #2d8a6e   /* main brand */
--color-primary-600: #22705a
--color-primary-700: #1c5a48
--color-primary-800: #174739
--color-primary-900: #113a2e
```

#### Secondary — Warm Lavender (ความไว้ใจ, ความสุขุม)
```
--color-secondary-100: #ede9f7
--color-secondary-200: #d5ccf0
--color-secondary-300: #b3a6e3
--color-secondary-400: #8f7dd4
--color-secondary-500: #6c56c4   /* accent */
--color-secondary-600: #5643a8
```

#### Neutral — Warm Gray (ไม่เย็นชา, เป็นมิตร)
```
--color-neutral-50:  #faf9f7
--color-neutral-100: #f2f0ec
--color-neutral-200: #e5e1da
--color-neutral-300: #ccc6bc
--color-neutral-400: #a89f93
--color-neutral-500: #7d7469
--color-neutral-700: #4a443c
--color-neutral-900: #1e1b17
```

#### Semantic Colors
```
--color-success: #3d9970   /* นัดยืนยันแล้ว */
--color-warning: #e8a838   /* รอการยืนยัน */
--color-error:   #d45f5f   /* ยกเลิก/ผิดพลาด */
--color-info:    #4a90c4   /* แจ้งเตือนทั่วไป */
```

---

### Typography

```css
/* Heading — อ่านง่าย มีน้ำหนัก ไม่เกร็ง */
font-family: 'Sarabun', 'Inter', sans-serif;

/* Body — สบายตา สำหรับข้อความยาว */
font-family: 'Sarabun', 'Inter', sans-serif;

/* Font Scale (rem) */
--text-xs:   0.75rem   /* 12px — label เล็ก */
--text-sm:   0.875rem  /* 14px — caption, helper */
--text-base: 1rem      /* 16px — body default */
--text-lg:   1.125rem  /* 18px — body emphasis */
--text-xl:   1.25rem   /* 20px — card title */
--text-2xl:  1.5rem    /* 24px — section heading */
--text-3xl:  1.875rem  /* 30px — page heading */
--text-4xl:  2.25rem   /* 36px — hero */

/* Font Weight */
--font-normal:   400
--font-medium:   500
--font-semibold: 600
--font-bold:     700

/* Line Height */
--leading-tight:  1.25   /* heading */
--leading-normal: 1.5    /* body */
--leading-relaxed: 1.75  /* long-form content */
```

> **ทำไมถึงใช้ Sarabun** — รองรับภาษาไทยอ่านง่าย น้ำหนักครบ และฟรีจาก Google Fonts

---

### Spacing & Layout

```css
/* Base unit: 4px */
--space-1:  0.25rem  /*  4px */
--space-2:  0.5rem   /*  8px */
--space-3:  0.75rem  /* 12px */
--space-4:  1rem     /* 16px */
--space-6:  1.5rem   /* 24px */
--space-8:  2rem     /* 32px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */

/* Container */
--container-sm:  640px
--container-md:  768px
--container-lg:  1024px
--container-xl:  1280px
--container-max: 1440px

/* Border Radius — โค้งมน สื่อถึงความอ่อนโยน */
--radius-sm:   0.375rem  /*  6px — input, badge */
--radius-md:   0.75rem   /* 12px — card */
--radius-lg:   1rem      /* 16px — modal, panel */
--radius-xl:   1.5rem    /* 24px — hero card */
--radius-full: 9999px    /* pill button, avatar */
```

---

### Component Design Tokens

#### Shadows (ให้ความลึก ไม่ harsh)
```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md:  0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
--shadow-lg:  0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);
--shadow-xl:  0 16px 40px rgba(0,0,0,0.12);
```

#### Cards
- พื้นหลัง `white` หรือ `neutral-50`
- border `1px solid neutral-200`
- radius `radius-md` (12px)
- shadow `shadow-sm` ปกติ, `shadow-md` เมื่อ hover
- padding `space-6` (24px)

#### Buttons
```
Primary   — bg: primary-500, text: white, hover: primary-600
Secondary — bg: white, border: primary-300, text: primary-600, hover: primary-50
Ghost     — bg: transparent, text: neutral-600, hover: neutral-100
Danger    — bg: error, text: white, hover: darker error
Disabled  — bg: neutral-200, text: neutral-400, cursor: not-allowed
```
- height: `40px` (sm), `44px` (md/default), `52px` (lg)
- padding horizontal: `space-4`–`space-6`
- radius: `radius-full` สำหรับ CTA หลัก, `radius-sm` สำหรับ action รอง

#### Form Inputs
- border: `1.5px solid neutral-300`
- focus border: `primary-400` + `ring: primary-100`
- error border: `error` + helper text สีแดง
- height: `44px`
- radius: `radius-sm`

---

### Page-by-Page UX Guidelines

#### หน้า Landing / Home
- Hero section: พื้นหลัง gradient จาก `primary-50` → `white`
- ข้อความ hero ใช้ภาษาอ่อนโยน เช่น "เริ่มต้นดูแลใจของคุณ"
- แสดง trust signals: จำนวนนักให้คำปรึกษา, รีวิว, ความปลอดภัยของข้อมูล
- CTA หลัก: "ค้นหานักให้คำปรึกษา" — สี `primary-500`, radius pill

#### หน้าค้นหา / รายการนักให้คำปรึกษา
- Layout: filter sidebar ซ้าย + card grid ขวา (desktop), filter drawer บน (mobile)
- CounselorCard: แสดง avatar กลม, ชื่อ, ความเชี่ยวชาญ (chip สี `secondary-100`), rating, ราคา
- Skeleton loading แทน spinner เพื่อลดความวิตก

#### หน้าโปรไฟล์นักให้คำปรึกษา
- Avatar ขนาดใหญ่ + cover background สี `primary-50`
- แบ่ง section ชัดเจน: ข้อมูลทั่วไป / ความเชี่ยวชาญ / รีวิว / จองนัด
- ปฏิทิน inline ด้านขวา (desktop sticky), ด้านล่าง (mobile)

#### หน้าจองนัดหมาย (Booking Flow)
- Stepper 3 ขั้น: เลือกวันเวลา → ระบุรายละเอียด → ยืนยัน
- Time slot แสดงแบบ grid ปุ่มกลม 48px
- ช่อง "บอกเล่าเรื่องราวของคุณ" ใช้ textarea พื้นหลัง `primary-50` ไม่ใช่ขาวล้วน เพื่อความรู้สึกอบอุ่น
- ปุ่มยืนยันสุดท้ายใช้สี `primary-500` + icon check

#### หน้า Dashboard (Client)
- Greeting section: "สวัสดี [ชื่อ] 👋 วันนี้เป็นยังไงบ้าง?"
- Upcoming appointment card โดดเด่น ด้านบนสุด
- ใช้ color coding สถานะ: `warning` (pending), `success` (confirmed), `neutral` (completed), `error` (cancelled)

---

### Responsive Breakpoints

```
mobile:  < 640px   — single column, bottom nav
tablet:  640–1023px — 2 column grid, side nav optional
desktop: ≥ 1024px  — 3 column grid, full sidebar
```

- Navigation: Top navbar (desktop) → Bottom tab bar (mobile)
- Font ลดขนาด 1 step บน mobile (เช่น `text-3xl` → `text-2xl`)
- Card padding: `space-6` desktop → `space-4` mobile

---

### Accessibility (WCAG 2.1 AA)

- Contrast ratio ≥ 4.5:1 สำหรับข้อความปกติ, ≥ 3:1 สำหรับ large text
- Focus ring ชัดเจน: `outline: 2px solid primary-400`, `outline-offset: 2px`
- Form fields ทุกตัวต้องมี `<label>` ที่ associate กัน
- Error messages เชื่อมกับ input ด้วย `aria-describedby`
- Interactive elements ขนาด ≥ 44×44px (touch target)
- ไม่ใช้สีเป็นสัญญาณเดียว เสมอมี icon หรือ text ประกอบ

---

### Tailwind Config สำหรับ Theme นี้

```js
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7f4', 100: '#d9ede6', 200: '#b3dace',
          300: '#7ec0aa', 400: '#4da68a', 500: '#2d8a6e',
          600: '#22705a', 700: '#1c5a48', 800: '#174739', 900: '#113a2e',
        },
        secondary: {
          100: '#ede9f7', 200: '#d5ccf0', 300: '#b3a6e3',
          400: '#8f7dd4', 500: '#6c56c4', 600: '#5643a8',
        },
        neutral: {
          50: '#faf9f7', 100: '#f2f0ec', 200: '#e5e1da',
          300: '#ccc6bc', 400: '#a89f93', 500: '#7d7469',
          700: '#4a443c', 900: '#1e1b17',
        },
      },
      fontFamily: {
        sans: ['Sarabun', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.375rem', md: '0.75rem',
        lg: '1rem',     xl: '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        lg: '0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)',
      },
    },
  },
}
```

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Node.js + Express หรือ Next.js (API Routes) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + OAuth) |
| Realtime | Supabase Realtime (การแจ้งเตือนนัดหมาย) |
| Deployment | Vercel (frontend) + Supabase (backend/db) |

---

## บทบาทผู้ใช้ (User Roles)

### 1. ผู้รับบริการ (Client)
- ลงทะเบียน/เข้าสู่ระบบ
- ค้นหาและดูโปรไฟล์นักให้คำปรึกษา
- จองนัดหมาย เลื่อนนัด หรือยกเลิกนัด
- ดูประวัติการนัดหมายและบันทึกการรักษา
- รับการแจ้งเตือนผ่านอีเมล/ระบบ

### 2. นักให้คำปรึกษา (Counselor/Therapist)
- จัดการโปรไฟล์และความเชี่ยวชาญ
- ตั้งค่าตารางเวลาว่าง (availability)
- ยืนยัน/ปฏิเสธการจอง
- บันทึกโน้ตการให้คำปรึกษา (session notes)
- ดูรายการนัดหมายของตัวเอง

### 3. ผู้ดูแลระบบ (Admin)
- จัดการบัญชีผู้ใช้ทั้งหมด
- อนุมัติการลงทะเบียนนักให้คำปรึกษา
- ดูรายงานสถิติการใช้งาน
- จัดการหมวดหมู่ประเภทการให้คำปรึกษา

---

## โครงสร้างฐานข้อมูล (Database Schema)

### ตาราง `profiles`
```sql
id          uuid PRIMARY KEY (ต่อจาก auth.users)
full_name   text NOT NULL
role        text CHECK (role IN ('client', 'counselor', 'admin'))
phone       text
avatar_url  text
created_at  timestamptz DEFAULT now()
```

### ตาราง `counselors`
```sql
id              uuid PRIMARY KEY REFERENCES profiles(id)
bio             text
specialties     text[]          -- เช่น ['anxiety', 'depression', 'relationship']
languages       text[]          -- ภาษาที่สื่อสารได้
session_fee     numeric(10,2)
session_duration int DEFAULT 60 -- นาที
is_approved     boolean DEFAULT false
rating          numeric(3,2)
```

### ตาราง `availability`
```sql
id            uuid PRIMARY KEY
counselor_id  uuid REFERENCES counselors(id)
day_of_week   int CHECK (day_of_week BETWEEN 0 AND 6)
start_time    time NOT NULL
end_time      time NOT NULL
is_active     boolean DEFAULT true
```

### ตาราง `appointments`
```sql
id              uuid PRIMARY KEY
client_id       uuid REFERENCES profiles(id)
counselor_id    uuid REFERENCES counselors(id)
scheduled_at    timestamptz NOT NULL
duration        int DEFAULT 60
status          text CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'))
meeting_type    text CHECK (meeting_type IN ('online', 'onsite'))
meeting_link    text          -- สำหรับ online
notes_client    text          -- บันทึกจากผู้รับบริการ
notes_counselor text          -- บันทึกจากนักให้คำปรึกษา (ลับ)
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### ตาราง `reviews`
```sql
id              uuid PRIMARY KEY
appointment_id  uuid REFERENCES appointments(id)
client_id       uuid REFERENCES profiles(id)
counselor_id    uuid REFERENCES counselors(id)
rating          int CHECK (rating BETWEEN 1 AND 5)
comment         text
created_at      timestamptz DEFAULT now()
```

---

## โครงสร้างไฟล์โปรเจกต์

```
mental-health-booking/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (client)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── counselors/
│   │   │   │   ├── page.tsx        # รายการนักให้คำปรึกษา
│   │   │   │   └── [id]/page.tsx   # โปรไฟล์นักให้คำปรึกษา
│   │   │   └── appointments/
│   │   │       ├── page.tsx        # ประวัตินัดหมาย
│   │   │       └── book/[counselorId]/page.tsx
│   │   ├── (counselor)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── schedule/page.tsx   # จัดการตารางเวลา
│   │   │   └── appointments/page.tsx
│   │   ├── (admin)/
│   │   │   ├── dashboard/page.tsx
│   │   │   └── users/page.tsx
│   │   └── api/
│   │       ├── appointments/route.ts
│   │       ├── availability/route.ts
│   │       └── notifications/route.ts
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── booking/
│   │   │   ├── CalendarPicker.tsx
│   │   │   ├── TimeSlotSelector.tsx
│   │   │   └── BookingConfirmModal.tsx
│   │   ├── counselor/
│   │   │   ├── CounselorCard.tsx
│   │   │   ├── CounselorProfile.tsx
│   │   │   └── AvailabilityManager.tsx
│   │   └── appointment/
│   │       ├── AppointmentCard.tsx
│   │       └── StatusBadge.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── hooks/
│   │   │   ├── useAppointments.ts
│   │   │   ├── useCounselors.ts
│   │   │   └── useAvailability.ts
│   │   └── utils/
│   │       ├── dateTime.ts         -- helper สำหรับ timezone (Asia/Bangkok)
│   │       └── validation.ts
│   └── types/
│       └── index.ts                -- TypeScript interfaces ทั้งหมด
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_functions.sql
├── public/
└── ...config files
```

---

## Row Level Security (RLS) Policies หลัก

```sql
-- ผู้รับบริการดูได้เฉพาะนัดหมายของตัวเอง
CREATE POLICY "clients_own_appointments" ON appointments
  FOR ALL USING (auth.uid() = client_id);

-- นักให้คำปรึกษาดูนัดหมายที่มีตัวเองเป็นผู้รับ
CREATE POLICY "counselors_own_appointments" ON appointments
  FOR SELECT USING (auth.uid() = counselor_id);

-- นักให้คำปรึกษาแก้ไขเฉพาะ notes และ status ของตัวเอง
CREATE POLICY "counselors_update_appointments" ON appointments
  FOR UPDATE USING (auth.uid() = counselor_id)
  WITH CHECK (auth.uid() = counselor_id);

-- โปรไฟล์นักให้คำปรึกษาที่ approved แล้วเปิดสาธารณะ
CREATE POLICY "public_approved_counselors" ON counselors
  FOR SELECT USING (is_approved = true);
```

---

## ฟีเจอร์หลักและ Implementation

### 1. ระบบค้นหานักให้คำปรึกษา
- กรองตามความเชี่ยวชาญ (specialty), ภาษา, ราคา, รูปแบบ (online/onsite)
- แสดง rating และจำนวนรีวิว
- ดู time slot ที่ว่างแบบ real-time

### 2. ระบบจองนัดหมาย
- แสดงปฏิทินพร้อม time slot ที่ว่าง
- ป้องกัน double booking ด้วย database transaction
- ส่งอีเมลยืนยันอัตโนมัติผ่าน Supabase Edge Functions
- รองรับ timezone ไทย (Asia/Bangkok)

### 3. การแจ้งเตือน (Notifications)
- แจ้งเตือนก่อนนัด 24 ชั่วโมงและ 1 ชั่วโมง
- แจ้งเตือนเมื่อสถานะนัดหมายเปลี่ยน
- รองรับผ่านอีเมลและ in-app notification

### 4. ระบบรีวิว
- รีวิวได้หลังจากนัดหมายสถานะ `completed` เท่านั้น
- 1 นัด = 1 รีวิว (ป้องกัน duplicate)
- คะแนนเฉลี่ยอัปเดต real-time

---

## ประเด็นด้านความเป็นส่วนตัวและความปลอดภัย

- **session notes** ของนักให้คำปรึกษา: RLS ให้เข้าถึงได้เฉพาะนักให้คำปรึกษาที่เป็นเจ้าของ ไม่แชร์กับ client
- **ข้อมูลส่วนตัว**: ปฏิบัติตาม PDPA (พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)
- **การเข้ารหัส**: ใช้ HTTPS ตลอด, ไม่เก็บข้อมูลสุขภาพที่ sensitive ใน plaintext
- **Audit log**: บันทึกการแก้ไขข้อมูลสำคัญด้วย `updated_at` และ trigger

---

## การพัฒนาทีละขั้น (Milestones)

### Phase 1 — Core
- [ ] ตั้งค่า Supabase project และ schema
- [ ] ระบบ Auth (register, login, role-based routing)
- [ ] โปรไฟล์นักให้คำปรึกษา (CRUD)
- [ ] ระบบ Availability (ตารางเวลา)

### Phase 2 — Booking
- [ ] UI ปฏิทินและ time slot
- [ ] สร้าง/ยกเลิก/เลื่อนนัดหมาย
- [ ] สถานะนัดหมายและ workflow

### Phase 3 — Communication
- [ ] Email notification (Supabase Edge Functions + Resend)
- [ ] In-app notifications (Supabase Realtime)
- [ ] ระบบรีวิวและ rating

### Phase 4 — Admin & Polish
- [ ] Admin dashboard + รายงาน
- [ ] SEO และ performance optimization
- [ ] การทดสอบ (unit + integration)
- [ ] Deploy และ monitoring

---

## คำสั่งเริ่มต้นโปรเจกต์

```bash
# สร้างโปรเจกต์ Next.js
npx create-next-app@latest mental-health-booking --typescript --tailwind --app

# ติดตั้ง dependencies หลัก
npm install @supabase/supabase-js @supabase/ssr
npm install @radix-ui/react-dialog @radix-ui/react-select
npm install date-fns react-day-picker
npm install react-hook-form zod @hookform/resolvers
npm install lucide-react clsx tailwind-merge

# เชื่อมต่อ Supabase
npx supabase init
npx supabase link --project-ref <your-project-ref>
```

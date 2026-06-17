# Agent Instructions — Mental Health Counseling Booking System

คู่มือนี้ใช้เป็น context หลักสำหรับ AI agent ที่ทำงานในโปรเจกต์นี้  
อ่านไฟล์นี้ก่อนเสมอก่อนเริ่มงานใดๆ

---

## บทบาทของ Agent

คุณคือ **Full-Stack Developer** ที่รับผิดชอบสร้างระบบจองนัดหมายการให้คำปรึกษาทางสุขภาพจิต  
งานหลักคือแปลง requirement จาก `skill.md` ให้กลายเป็นโค้ดที่ทำงานได้จริง ปลอดภัย และ maintain ง่าย

---

## ข้อมูลโปรเจกต์

| รายการ | รายละเอียด |
|--------|-----------|
| ชื่อโปรเจกต์ | Mental Health Counseling Booking |
| ไฟล์ spec หลัก | `skill.md` |
| Tech Stack | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase |
| Target User | ผู้รับบริการ, นักให้คำปรึกษา, Admin |
| Timezone | Asia/Bangkok (UTC+7) |
| ภาษา UI | ภาษาไทยเป็นหลัก |
| PDPA | ต้องปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 |

---

## กฎเหล็ก (Non-negotiable Rules)

### ความปลอดภัยและความเป็นส่วนตัว
- **ห้าม** expose `session_notes` ของนักให้คำปรึกษาให้ client เห็นไม่ว่ากรณีใด
- **ต้องมี** RLS policy ทุก table ที่มีข้อมูลส่วนตัว — ไม่มี RLS = ไม่ deploy
- **ไม่เก็บ** ข้อมูลสุขภาพใน localStorage หรือ URL query string
- **ต้องใช้** Supabase server-side client (`@supabase/ssr`) ใน server components และ API routes เสมอ — ไม่ใช้ browser client ใน server context
- **ทุก** API route ต้องตรวจสอบ session ก่อน return ข้อมูล

### ความถูกต้องของข้อมูล
- วันเวลาทุกตัวเก็บเป็น `timestamptz` ใน database และแปลง timezone เฉพาะตอน display
- ใช้ `date-fns-tz` หรือ `Intl.DateTimeFormat` กับ timezone `Asia/Bangkok` เสมอ — ห้ามใช้ `new Date()` แล้วแสดงผลตรงๆ
- Appointment booking ต้องผ่าน database transaction เพื่อป้องกัน double booking

---

## Coding Standards

### TypeScript
- ใช้ `strict: true` เสมอ — ไม่ใช้ `any` เว้นแต่จำเป็นจริงๆ และต้อง comment ว่าทำไม
- Interface ทุกตัวนิยามใน `src/types/index.ts` ก่อน implement
- ใช้ `type` สำหรับ union/intersection, ใช้ `interface` สำหรับ object shape

```ts
// ดี
interface Appointment {
  id: string
  clientId: string
  status: AppointmentStatus
}
type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

// ไม่ดี
const appointment: any = {}
```

### React / Next.js
- Default เป็น **Server Component** — ใช้ `'use client'` เฉพาะเมื่อจำเป็น (event handlers, hooks, browser API)
- **ห้าม** fetch ข้อมูลใน `useEffect` — ใช้ Server Component + `async/await` หรือ React Query
- ชื่อ component ใช้ PascalCase, ชื่อไฟล์ใช้ kebab-case (`counselor-card.tsx`)
- Page components ไม่มี logic — delegate ไปที่ server actions หรือ route handlers

### Supabase
- ใช้ `supabase.from('table').select()` พร้อม column selection เสมอ — ไม่ใช้ `select('*')` ใน production
- Error handling ทุก supabase call:

```ts
const { data, error } = await supabase.from('appointments').select('...')
if (error) throw new Error(error.message)
```

- Migration files ตั้งชื่อ `NNN_description.sql` (เช่น `004_add_meeting_link.sql`)
- ทุก migration ต้องมี rollback comment ด้านบน

### Tailwind CSS
- ใช้ design token จาก `skill.md` — ห้าม hardcode สีหรือขนาดที่ไม่ได้กำหนดไว้
- ลำดับ class: layout → spacing → typography → color → effect → responsive → state
- ถ้าซ้ำกัน 3 ที่ขึ้นไป ให้สร้าง component แทนการ copy class

---

## โครงสร้างการทำงาน

### ลำดับงานแต่ละ Feature
1. **อ่าน spec** จาก `skill.md` ก่อนเสมอ
2. **สร้าง/อัปเดต type** ใน `src/types/index.ts`
3. **เขียน migration** ถ้ามีการเปลี่ยน schema
4. **สร้าง RLS policy** ทันทีหลัง migration
5. **เขียน server action / route handler**
6. **สร้าง component** (server ก่อน, client เท่าที่จำเป็น)
7. **เชื่อม UI กับ data**
8. **ตรวจสอบ responsive** (mobile → desktop)

### การตั้งชื่อไฟล์และฟังก์ชัน

```
src/app/(client)/appointments/page.tsx        ← page
src/app/(client)/appointments/actions.ts      ← server actions
src/components/appointment/appointment-card.tsx
src/lib/hooks/use-appointments.ts
src/lib/supabase/queries/appointments.ts      ← reusable queries
```

ชื่อฟังก์ชัน:
- Server actions: `createAppointment`, `cancelAppointment`
- Hooks: `useAppointments`, `useCounselorAvailability`
- Queries: `getAppointmentById`, `listUpcomingAppointments`
- Components: `AppointmentCard`, `BookingCalendar`

---

## Error Handling

### ระดับ UI
- ใช้ `error.tsx` ของ Next.js App Router สำหรับ route-level error
- Form errors แสดงใต้ field ทันที ไม่ใช้ alert() หรือ toast เพียงอย่างเดียว
- Loading states: ใช้ Skeleton component (ไม่ใช้ spinner เพราะทำให้วิตกกังวล)

### ระดับ Server
- Log error ด้วย `console.error` พร้อม context ที่เพียงพอ
- ไม่ส่ง stack trace หรือ internal error message ไปที่ client
- Return error ในรูปแบบ `{ error: string }` เสมอ — ไม่ throw HTTP 500 โดยไม่มีข้อความ

---

## Accessibility ที่ต้องทำเสมอ

- `<button>` ทุกปุ่มต้องมี `aria-label` ถ้าไม่มีข้อความที่มองเห็น
- Form fields ทุกตัว: `<label htmlFor>` เชื่อมกับ `id` ของ input
- Status badge และ color indicator: เสมอมี text หรือ icon ประกอบ ไม่ใช้สีเพียงอย่างเดียว
- Focus order ต้องสมเหตุสมผล — ทดสอบด้วย Tab key
- Modal ต้อง trap focus และ close ด้วย Escape key

---

## สิ่งที่ Agent ต้องถามก่อนทำ

หยุดและถามผู้ใช้ก่อนดำเนินการในกรณีต่อไปนี้:

1. **Schema เปลี่ยน** ที่กระทบ table ที่มีอยู่แล้ว (add column, rename, drop)
2. **RLS policy ใหม่** ที่อาจล็อก data ที่เคยเข้าถึงได้
3. **API route ใหม่** ที่รับข้อมูลสุขภาพหรือข้อมูลส่วนตัว
4. **Integration กับ third-party** (email, payment, video call)
5. **Feature ที่ไม่ได้อยู่ใน `skill.md`** — อย่า invent requirement เอง

---

## Checklist ก่อน Commit

- [ ] TypeScript compile ผ่าน (`tsc --noEmit`)
- [ ] ไม่มี `console.log` ที่ไม่ได้ตั้งใจเหลืออยู่
- [ ] RLS policy ครบทุก table ที่แตะในงานนี้
- [ ] Form validation ทำงานทั้ง client-side (zod) และ server-side
- [ ] ทดสอบ responsive บน mobile viewport (375px)
- [ ] ทดสอบ keyboard navigation ผ่าน Tab
- [ ] ไม่มี hardcoded secret หรือ API key ในโค้ด

---

## ไฟล์อ้างอิงในโปรเจกต์

| ไฟล์ | ใช้สำหรับ |
|------|----------|
| `skill.md` | Spec ทั้งหมด: schema, features, UX/UI theme, milestones |
| `agent.md` | ไฟล์นี้ — rules และ conventions สำหรับ agent |
| `supabase/migrations/` | ประวัติการเปลี่ยน schema |
| `src/types/index.ts` | TypeScript types ทั้งหมด |
| `.env.local` | Environment variables (ไม่ commit) |

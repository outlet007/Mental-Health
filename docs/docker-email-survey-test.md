# Docker email and survey test

ใช้ชุดนี้เพื่อจำลองระบบ MindCare ใน Docker และทดสอบอีเมลโดยไม่ส่งออกไปยังอีเมลจริง ระบบจะส่ง SMTP เข้า Mailpit แทน

## Start

```powershell
docker compose up --build
```

เปิดระบบ:

- App: http://localhost:3010
- Mailpit inbox: http://localhost:8025

ค่าที่ compose ตั้งไว้:

- `SMTP_AUTH=false`
- `SMTP_HOST=mailpit`
- `SMTP_PORT=1025`
- `BASE_URL=http://localhost:3010`

## Smoke test ผ่าน command

หลัง container ทำงานแล้ว เปิด PowerShell อีกหน้าต่างแล้วรัน:

```powershell
docker compose exec app node scripts/docker-email-survey-smoke.js
```

ผลลัพธ์จะมี `surveyUrl` และ `submitRatingExample` ให้ใช้ทดสอบการให้คะแนน อีเมล 3 ฉบับควรเข้า Mailpit:

- ยืนยันนัดหมายถึงผู้รับบริการ
- แจ้งนัดหมายใหม่ถึงนักจิตวิทยา
- ลิงก์แบบประเมินความพึงพอใจ

## ทดสอบคะแนนบริการ

1. เปิด Mailpit ที่ http://localhost:8025
2. เปิดอีเมลแบบประเมิน หรือใช้ `surveyUrl` จาก smoke script
3. เลือกคะแนนและส่งแบบประเมิน
4. ตรวจข้อมูลในหน้า `/admin/surveys` หรือดูไฟล์ `data/surveys.json` ภายใน container

## Reset

```powershell
docker compose down
docker compose up --build
```

ข้อมูลทดสอบของ app ถูกเก็บใน Docker volume `mindcare-data` เพื่อให้ survey token จากอีเมลยังใช้ได้หลัง rebuild container ถ้าต้องการล้างข้อมูลทดสอบทั้งหมดให้ใช้ `docker compose down -v`



## สลับโหมดทดสอบ/ใช้งานจริง

เข้าเมนูระบบ `อีเมลประเมินความพึงพอใจ`

- เลือก `ทดสอบ` เพื่อส่งอีเมลเข้า Mailpit ที่ http://localhost:8025
- เลือก `ใช้งานจริง Gmail` เพื่อส่งผ่าน Gmail SMTP จริง

สำหรับ Gmail ต้องกรอก:

- Gmail sender
- Gmail App Password
- ชื่อผู้ส่ง
- อีเมลผู้ส่ง

Gmail App Password ไม่ใช่รหัสผ่าน Gmail ปกติ ต้องเปิด 2-Step Verification ในบัญชี Gmail ก่อน แล้วสร้าง App Password จาก Google Account

สามารถรัน compose พร้อมไฟล์ override สำหรับ production-like env ได้ด้วย:

```powershell
docker compose -f docker-compose.yml -f docker-compose.gmail.yml up --build -d
```

ค่าลับ Gmail ไม่ควรใส่ลงไฟล์ repo ให้กรอกจากหน้า admin หรือใส่ผ่าน environment ส่วนตัวของเครื่องแทน

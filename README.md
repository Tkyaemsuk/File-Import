# File Import for Budibase — Svelte 3

ปลั๊กอิน Component สำหรับนำเข้าไฟล์ **CSV / TSV / JSON** ลงฐานข้อมูลผ่าน **Saved write query ของ Budibase** พัฒนาด้วย **Svelte 3.59.2 เท่านั้น** ไม่มี React หรือ Svelte 4/5

เป้าหมายการใช้งาน: Budibase **3.4.1 ขึ้นไป** ที่รองรับ component plugin แบบ Svelte 3 และ SDK `API.fetchQueryDefinition` / `API.executeQuery` ปลั๊กอินระบุ `metadata.svelteMajor: 3` และใช้ runtime ของ host

## ติดตั้ง

1. ดาวน์โหลด [bb-file-import-1.0.0.tar.gz](https://github.com/Tkyaemsuk/File-Import/raw/main/releases/bb-file-import-1.0.0.tar.gz) เป็นไฟล์ ห้ามแตกไฟล์ก่อนอัปโหลด
2. ใน Budibase ไปที่ **Settings → Plugins** และเพิ่มปลั๊กอินด้วยการอัปโหลด `.tar.gz` (ชื่อเมนูอาจต่างตามรุ่น/สิทธิ์)
3. เปิดแอปใน Builder แล้วเพิ่ม component **File Import** ลงในหน้าที่ต้องการ
4. ตั้งค่า query และ mapping ตามด้านล่าง แล้วเปิด **Preview** หรือแอปที่ publish แล้วเพื่อใช้งาน การนำเข้าถูกปิดใน canvas ของ Builder

หาก instance ไม่มีเมนูติดตั้ง custom plugins ต้องเปิดใช้ความสามารถนี้ตามรุ่น/แผนบริการและสิทธิ์ผู้ดูแลก่อน

## เตรียม query และฐานข้อมูล

สร้างการเชื่อมต่อฐานข้อมูลและตารางผ่าน Budibase ตามปกติ จากนั้นสร้าง **Custom query ที่เขียนข้อมูล** ตั้งค่าเป็น write query (`readable=false`) และกำหนด named parameters ให้ครบทุกช่อง เช่น `name` และ `email`

ตัวอย่าง PostgreSQL (สร้างตารางแยกก่อนนำเข้า):

```sql
CREATE TABLE people (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
```

ตัวอย่าง saved query ใช้ bindings ของ Budibase:

```sql
INSERT INTO people (full_name, email)
VALUES ({{ name }}, {{ email }})
ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;
```

กำหนด parameters `name`, `email` ใน query editor และทดสอบ query กับ datasource ของคุณก่อน ชื่อ binding และ syntax ต้องตรงกับ connector ที่ใช้งาน ตัวอย่าง `ON CONFLICT` ใช้กับ PostgreSQL เท่านั้น ใช้ parameter bindings ของ connector เสมอ ไม่ต่อข้อความ SQL จากข้อมูลไฟล์ ไม่ใส่ credentials ใน component

ตั้งค่า component:

| Setting | ตัวอย่าง / ความหมาย |
| --- | --- |
| Title | File Import |
| Saved write query ID | ID จริงของ query เช่น `query_...` ไม่ใช่ชื่อ query หรือ datasource ID |
| Parameter mapping JSON | `{"name":"full_name","email":"email"}` โดย key เป็นชื่อ query parameter และ value เป็นชื่อคอลัมน์ไฟล์ |
| Stop after first failed record | เปิดเป็นค่าเริ่มต้น; ปิดเพื่อข้ามแถวที่ผิดพลาดและทำแถวถัดไป |
| Disabled | ปิดการเลือกไฟล์และเริ่มนำเข้า; ถ้าเปลี่ยนเป็น true ระหว่างนำเข้าจะหยุดหลังคำขอปัจจุบัน |
| On import finished | Actions หลังงานจบหรือหยุด พร้อม context `succeeded`, `failed`, `processed`, `total`, `cancelled` |

หา query ID จาก request ของ query ใน browser DevTools ของ Budibase หรือจากข้อมูล query ที่ export จากแอป ตั้งค่าตาม environment ที่ใช้งาน ไม่ใช้ชื่อ query แทน ID

ถ้าไม่ระบุ mapping (`{}`) ชื่อคอลัมน์ต้องตรงกับชื่อ parameter ทุกตัว mapping บางส่วนได้ ส่วนที่ไม่ได้ระบุจะใช้ชื่อ parameter เดิม ทุก parameter ต้องมีคอลัมน์อยู่จริงในทุกแถว ไม่มีการใช้ค่า default ของ query แทนคอลัมน์ที่ขาด

## ใช้งาน

1. เลือกไฟล์ UTF-8 (`.csv`, `.tsv`, `.json`) ขนาดไม่เกิน **5 MiB / 10,000 records**
2. ตรวจ preview 5 แถวแรก (แสดงสูงสุด 10 คอลัมน์)
3. ติ๊กยืนยันแล้วกด **Import records** ปลั๊กอินตรวจ mapping ของทุกแถวก่อนส่ง query ครั้งแรก
4. ดูจำนวนสำเร็จ ล้มเหลว และคงเหลือ กด **Stop after current record** เพื่อหยุดส่งแถวถัดไป
5. ใช้ On import finished → Execute Query หรือ Refresh Data Provider ตามแอป เพื่อรีเฟรชข้อมูลที่แสดง

ตัวอย่างพร้อมใช้: [CSV](examples/people.csv), [JSON](examples/people.json)

- CSV/TSV ต้องมี header; รองรับ BOM, CRLF, quoted delimiter และ newline ใน quoted field
- CSV/TSV เก็บทุกค่าเป็นข้อความเพื่อรักษาศูนย์นำหน้า ค่าว่างเป็น `""`
- JSON ต้องเป็น array ของ object ที่มีค่า scalar; number/boolean จะส่งเป็นข้อความ ส่วน `null` คงเป็น null ให้ connector จัดการ
- ไม่รองรับ XLS/XLSX, nested JSON หรือการเก็บไฟล์ต้นฉบับลงฐานข้อมูล
- ไม่ส่ง SQL จากหน้าเว็บ ปลั๊กอินส่งเฉพาะ parameter values เข้า saved query ผ่าน SDK โดยใช้ session และสิทธิ์ของ Budibase
- ตั้งสิทธิ์ query/datasource ใน Budibase ให้เหมาะสม การซ่อน component ไม่ได้ทดแทนสิทธิ์ฝั่ง server

## การหยุดและข้อผิดพลาด

ทำงานทีละแถว **ไม่มี transaction ครอบทั้งไฟล์** แถวสำเร็จจะคงอยู่ การหยุดไม่ยกเลิก query ที่กำลังรันอยู่ และไม่ rollback แถวก่อนหน้า กรณีเครือข่ายขาดหาย query อาจบันทึกแล้วแม้ client รายงานล้มเหลว จึงไม่มี automatic retry

หลังเริ่มเขียนแล้ว ปุ่ม import จะถูกปิดสำหรับชุดไฟล์นั้น ต้องเลือกไฟล์อีกครั้งเพื่อเริ่มรอบใหม่ การเลือกไฟล์ซ้ำอาจทำให้ข้อมูลซ้ำ ควรใช้ unique constraint และ upsert query ตาม business key หากต้องการนำเข้าซ้ำอย่างปลอดภัย UI แสดง error สูงสุด 20 รายการ โดยเลข record เริ่มที่ 1 ไม่นับ header ของ CSV

## พัฒนาและทดสอบ

ใช้ Node.js 22 ขึ้นไป:

```sh
npm ci
npm test
npm run check
npm run build
```

ไฟล์ติดตั้งอยู่ที่ `dist/bb-file-import-1.0.0.tar.gz` ภายในมี `plugin.min.js`, `schema.json` พร้อม SHA-1 hash ตามรูปแบบ Budibase และ `package.json` ที่ root ของ archive

Browser smoke test (ต้องติดตั้ง Chromium ไว้แล้ว):

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

ตรวจ IIFE registration และ component จริงใน Chromium โดยใช้ Svelte 3 host พร้อม **SDK จำลอง**: upload ภาษาไทย, preview, confirmation, query payload, ป้องกันกดซ้ำ และ reject ไฟล์ผิดรูปแบบ ภาพผลลัพธ์อยู่ที่ `dist/browser-smoke.png`

Unit tests ครอบคลุม malformed CSV/JSON, encoding, size/row limits, mapping ทุกแถว, parameter payload, partial failure และ cancellation CI build แนบไฟล์ติดตั้งให้ดาวน์โหลดผ่าน GitHub Actions

## สถานะความเข้ากันได้

ตรวจ contract กับ source Budibase tag `3.4.1` commit `251974d0b3b25ce630c80c54e6c7dab755d72037`:

- `packages/client/src/sdk.js` เปิดเผย `API` ผ่าน Svelte context `sdk`
- `packages/frontend-core/src/api/queries.ts` มี `fetchQueryDefinition` และ `executeQuery(queryId, { parameters })`
- `packages/client/src/index.js` เปิดเผย `window.svelte` / `window.svelte_internal`
- component registry ใช้ `##BUDIBASE_CUSTOM_COMPONENTS##` และ `registerCustomComponent`
- รูปแบบ schema และ archive ตรงตาม plugin validator / metadata loader ของรุ่นดังกล่าว

**ยังไม่ได้ทดสอบ end-to-end กับ Budibase instance หรือฐานข้อมูลจริง และไม่ได้รับประกันทุกรุ่นในอนาคต** ก่อนใช้งานจริงให้ทดสอบบน staging ของรุ่นที่ติดตั้ง: ติดตั้ง plugin, บันทึกและ publish query, import ตัวอย่าง, ตรวจข้อมูลในฐานข้อมูล, ทดสอบสิทธิ์ของผู้ใช้งาน และตรวจ error/duplicate ตาม schema ของคุณ หาก host เปลี่ยน SDK หรือยกเลิก Svelte 3 ต้องปรับ compatibility ก่อน

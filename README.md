# محمية نقاط البيع — Muhiya POS

نظام نقاط بيع وإدارة متكامل يدعم اللغة العربية، متعدد الفروع والمستخدمين، مع وضع غير متصل بالإنترنت.

## التقنيات

- React 19 + TypeScript + Vite
- Supabase (Auth, Database, Storage, Edge Functions)
- Tailwind CSS 4
- Dexie.js (IndexedDB للتخزين المحلي)
- Zustand (إدارة الحالة)
- Paymob (بوابة الدفع)

## التشغيل محلياً

```bash
npm install
npm run dev
```

## البيئة

```
VITE_SUPABASE_URL=https://qdkwkmezlitqjxrapuip.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

النشر التلقائي عبر Vercel.

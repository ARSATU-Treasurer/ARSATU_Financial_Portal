// js/supabase-client.js

// 1. นำค่า URL และ Key จากหน้า API ของ Supabase มาวางแทนที่ข้อความด้านล่าง
const supabaseUrl = 'https://dcglyqyyvfylgogdutza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZ2x5cXl5dmZ5bGdvZ2R1dHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NDE3OTUsImV4cCI6MjA5NjIxNzc5NX0.HreDNy-Xi6sm9jTp1US7Zco-vtoRR1tQh0oagAbjvAk';

// สร้างตัวเชื่อมต่อโดยใช้ชื่อ supabaseClient (ไม่ให้ซ้ำกับระบบ)
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase Client พร้อมทำงาน!");
// js/supabase-client.js

// 1. นำค่า URL และ Key จากหน้า API ของ Supabase มาวางแทนที่ข้อความด้านล่าง
const supabaseUrl = 'https://runskpzhgsvvfdqdjxdf.supabase.co';
const supabaseKey = 'sb_publishable_3PbjecPyG7GZGv9DltScug_3uC_oQhV';

// สร้างตัวเชื่อมต่อโดยใช้ชื่อ supabaseClient (ไม่ให้ซ้ำกับระบบ)
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("Supabase Client พร้อมทำงาน!");
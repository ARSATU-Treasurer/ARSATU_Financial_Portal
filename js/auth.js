document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const messageDiv = document.getElementById('message'); // ใช้แสดงข้อความแจ้งเตือน

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บรีเฟรช
            messageDiv.style.color = 'blue';
            messageDiv.textContent = 'กำลังตรวจสอบข้อมูล...';

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // 1. ส่งคำขอเข้าสู่ระบบไปยัง Supabase
            const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (authError) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
                console.error(authError);
                return;
            }

            const userId = authData.user.id;

            // 2. ดึงข้อมูลสิทธิ์ (Role) จากตาราง profiles
            const { data: profileData, error: profileError } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (profileError || !profileData) {
                messageDiv.style.color = 'red';
                messageDiv.textContent = 'เข้าสู่ระบบสำเร็จ แต่ไม่พบข้อมูลโปรไฟล์ (Role)';
                return;
            }

            // 3. เปลี่ยนหน้าไปยัง URL ตามสิทธิ์การใช้งาน
            if (profileData.role === 'admin') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'member.html';
            }
        });
    }
});
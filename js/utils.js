// ==========================================
// 🌟 ARSATU Financial Portal - Utility Functions
// (ฟังก์ชันส่วนกลางที่ใช้ร่วมกันทุกหน้า)
// ==========================================

// 1. ระบบแจ้งเตือน (Toast) ด้วย SweetAlert2
window.showToast = function(title, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end', 
        icon: icon,          
        title: title,
        showConfirmButton: false,
        timer: 5000,         
        timerProgressBar: true,
        customClass: {
            popup: 'colored-toast' 
        }
    });
};

// 2. ระบบส่งข้อความแจ้งเตือนเข้า LINE (GAS)
window.sendLineMessage = function(msg) {
    const gasUrl = 'https://script.google.com/macros/s/AKfycbxwOJ9BznMdOSDscRglTNsykif2N1NdMgb8_X7UAmyJd3vZx0mb-y9pJ9xdUI93b4Bt/exec'; 
    fetch(gasUrl, { 
        method: 'POST', 
        mode: 'no-cors', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ action: 'notify_admin', message: msg }) 
    }).catch(e => console.log("Line Notify Error:", e));
};
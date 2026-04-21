document.addEventListener('DOMContentLoaded', () => {
    loadTransparencyData();
});

async function loadTransparencyData() {
    try {
        // 1. ดึงข้อมูลสรุปยอดเงิน
        const { data: bankData } = await supabaseClient.from('bank_accounts').select('balance');
        const { data: txData } = await supabaseClient.from('transactions').select('amount, transaction_type');

        let totalIncome = 0;
        let totalExpense = 0;
        let netBalance = bankData ? bankData.reduce((sum, b) => sum + b.balance, 0) : 0;

        if (txData) {
            txData.forEach(tx => {
                if (tx.transaction_type === 'income') totalIncome += tx.amount;
                else totalExpense += tx.amount;
            });
        }

        document.getElementById('sum-net').textContent = `฿${netBalance.toLocaleString()}`;
        document.getElementById('sum-income').textContent = `฿${totalIncome.toLocaleString()}`;
        document.getElementById('sum-expense').textContent = `฿${totalExpense.toLocaleString()}`;

        // 2. โหลดสมุดบัญชี (Ledger)
        const { data: ledger } = await supabaseClient.from('transactions').select('*').order('created_at', { ascending: false });
        const ledgerBody = document.querySelector('#ledger-table tbody');
        ledgerBody.innerHTML = ledger ? ledger.map(tx => `
            <tr>
                <td>${new Date(tx.created_at).toLocaleDateString('th-TH')}</td>
                <td><span class="badge" style="background:#eff6ff; color:#3b82f6;">${tx.department || 'ส่วนกลาง'}</span></td>
                <td>${tx.description}</td>
                <td style="text-align:right; color:var(--success);">${tx.transaction_type === 'income' ? '฿' + tx.amount.toLocaleString() : '-'}</td>
                <td style="text-align:right; color:var(--danger);">${tx.transaction_type === 'expense' ? '฿' + tx.amount.toLocaleString() : '-'}</td>
                <td><button onclick="viewTxDetail('${tx.id}')" style="cursor:pointer; border:none; background:none; color:var(--primary);">🔍 ดู</button></td>
            </tr>
        `).join('') : '<tr><td colspan="6">ไม่พบข้อมูล</td></tr>';

        // 3. โหลดรายการเบิกจ่าย (Clearances)
        const { data: clearances } = await supabaseClient.from('clearances').select('*, profiles(full_name)').neq('status', 'draft').order('created_at', { ascending: false });
        const clearanceBody = document.querySelector('#clearance-table tbody');
        clearanceBody.innerHTML = clearances ? clearances.map(c => `
            <tr>
                <td>${new Date(c.created_at).toLocaleDateString('th-TH')}</td>
                <td>${c.profiles?.full_name || 'ไม่ระบุชื่อ'}</td>
                <td>${c.purpose}</td>
                <td style="font-weight:600;">฿${(c.total_actual_amount || c.requested_amount).toLocaleString()}</td>
                <td><span class="badge" style="${getStatusStyle(c.status)}">${translateStatus(c.status)}</span></td>
                <td><button onclick="viewClearanceDetail('${c.id}')" style="cursor:pointer; border:none; background:none; color:var(--primary);">🔍 รายละเอียด</button></td>
            </tr>
        `).join('') : '<tr><td colspan="6">ไม่พบข้อมูล</td></tr>';

        // 4. โหลดประวัติแก้ไข (Audit Log)
        const { data: audits } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
        const auditBody = document.querySelector('#audit-table tbody');
        auditBody.innerHTML = audits ? audits.map(a => `
            <tr>
                <td>${new Date(a.created_at).toLocaleString('th-TH')}</td>
                <td><span class="badge" style="background:#f1f5f9;">${a.action_type}</span></td>
                <td>${a.record_id.substring(0,8)}...</td>
                <td>${a.reason || '-'}</td>
            </tr>
        `).join('') : '<tr><td colspan="4">ไม่มีประวัติการแก้ไข</td></tr>';

    } catch (e) {
        console.error(e);
    }
}

function getStatusStyle(status) {
    if (status === 'cleared') return 'background:#d1fae5; color:#059669;';
    if (status === 'cancelled') return 'background:#fee2e2; color:#ef4444;';
    return 'background:#fef3c7; color:#d97706;';
}

function translateStatus(status) {
    const map = { 'pending_advance': 'รอโอนเงิน', 'advance_transferred': 'โอนแล้ว/รอเคลียร์', 'pending_clearance': 'รอตรวจบิล', 'cleared': 'อนุมัติเรียบร้อย', 'cancelled': 'ยกเลิก' };
    return map[status] || status;
}

// ฟังก์ชันเปิดดูรายละเอียด (Read-only)
async function viewClearanceDetail(id) {
    const { data: c } = await supabaseClient.from('clearances').select('*, clearance_items(*)').eq('id', id).single();
    if (!c) return;
    
    let itemsHtml = c.clearance_items.map(i => `<li>${i.item_name}: ฿${i.amount.toLocaleString()}</li>`).join('');
    
    document.getElementById('modal-body').innerHTML = `
        <h2 style="color:var(--primary);">${c.purpose}</h2>
        <p><b>ผู้เบิก:</b> ${c.member_id}</p>
        <p><b>วันที่:</b> ${new Date(c.created_at).toLocaleString('th-TH')}</p>
        <hr>
        <h4>รายการบิลย่อย:</h4>
        <ul>${itemsHtml}</ul>
        <p style="font-size:18px; font-weight:bold;">ยอดรวมสุทธิ: ฿${(c.total_actual_amount || c.requested_amount).toLocaleString()}</p>
        ${c.statement_url ? `<img src="${c.statement_url}" style="width:100%; border-radius:10px; margin-top:10px;">` : '<p style="color:gray;">* ไม่มีรูปภาพหลักฐาน</p>'}
    `;
    document.getElementById('detail-modal').style.display = 'flex';
}

function closeModal() { document.getElementById('detail-modal').style.display = 'none'; }
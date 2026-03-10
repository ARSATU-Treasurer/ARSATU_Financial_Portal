document.addEventListener('DOMContentLoaded', async () => {

    let currentUser = null;
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data.session) { window.location.replace('index.html'); return; }
        currentUser = data.session.user;
    } catch (err) { alert("กรุณาล็อกอินใหม่"); window.location.replace('index.html'); return; }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });

    // ==========================================
    // โหลดข้อมูล Dashboard
    // ==========================================
    window.loadDashboardWidgets = async function() {
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('*');
            if(document.querySelector('#bank-table tbody')) document.querySelector('#bank-table tbody').innerHTML = banks && banks.length ? banks.map(b => `<tr><td>${b.bank_name}</td><td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td></tr>`).join('') : `<tr><td style="text-align:center;">ไม่มีข้อมูล</td></tr>`;

            const { data: funds } = await supabaseClient.from('funds').select('*');
            if(document.querySelector('#fund-table tbody')) document.querySelector('#fund-table tbody').innerHTML = funds && funds.length ? funds.map(f => `<tr><td>${f.fund_name}</td><td style="text-align:right; color:var(--info); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td></tr>`).join('') : `<tr><td style="text-align:center;">ไม่มีข้อมูล</td></tr>`;

            const { data: txs } = await supabaseClient.from('transactions').select('amount, transaction_type').eq('status', 'approved');
            let tInc = 0, tExp = 0, donCash = 0, donTrans = 0;
            if (txs) {
                txs.forEach(t => {
                    const amt = parseFloat(t.amount) || 0;
                    if (t.transaction_type === 'income') tInc += amt;
                    else if (t.transaction_type === 'expense') tExp += amt;
                    else if (t.transaction_type === 'donation_cash') { donCash += amt; tInc += amt; }
                    else if (t.transaction_type === 'donation_transfer') { donTrans += amt; tInc += amt; }
                });
            }

            if(document.getElementById('total-donation')) document.getElementById('total-donation').textContent = `฿${(donCash + donTrans).toLocaleString()}`;
            if(document.getElementById('total-donation-cash')) document.getElementById('total-donation-cash').textContent = `฿${donCash.toLocaleString()}`;
            if(document.getElementById('total-donation-transfer')) document.getElementById('total-donation-transfer').textContent = `฿${donTrans.toLocaleString()}`;
            if(document.getElementById('total-income')) document.getElementById('total-income').textContent = `฿${tInc.toLocaleString()}`;
            if(document.getElementById('total-expense')) document.getElementById('total-expense').textContent = `฿${tExp.toLocaleString()}`;
            if(document.getElementById('net-balance')) document.getElementById('net-balance').textContent = `฿${(tInc - tExp).toLocaleString()}`;
        } catch (e) { console.error(e); }
    };

    // ==========================================
    // โหลดรายการรออนุมัติ
    // ==========================================
    window.loadPendingDonations = async function() {
        const tbody = document.querySelector('#pending-donations-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('transactions').select(`*, profiles!transactions_created_by_fkey(full_name)`).eq('status', 'pending').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบครับ</td></tr>`; return; }

            const { data: banks } = await supabaseClient.from('bank_accounts').select('*');
            const bankOpts = banks ? banks.map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('') : '';
            const { data: funds } = await supabaseClient.from('funds').select('*');
            const fundOpts = funds ? funds.map(f => `<option value="${f.id}">${f.fund_name}</option>`).join('') : '';

            tbody.innerHTML = data.map(req => {
                const date = req.transaction_date ? new Date(req.transaction_date).toLocaleDateString('th-TH') : '-';
                let typeLabel = '';
                if(req.transaction_type === 'donation_cash') typeLabel = '💝 บริจาค (เงินสด)';
                else if(req.transaction_type === 'donation_transfer') typeLabel = '💝 บริจาค (โอน)';
                else if(req.transaction_type === 'income') typeLabel = '📈 รายรับเข้าชุมนุม';
                else typeLabel = '📉 รายจ่าย (หักออก)';

                const color = req.transaction_type === 'expense' ? 'var(--danger)' : 'var(--success)';
                const slipLink = req.slip_url ? `<a href="${req.slip_url}" target="_blank" style="color:var(--info); font-size:13px;">📎 ดูหลักฐาน</a>` : '-';
                const locationText = req.location ? `<br><small style="color:var(--primary);">📍 สถานที่: ${req.location}</small>` : '';

                return `<tr>
                    <td>${date}</td><td style="color:${color}; font-weight:500;">${typeLabel}</td>
                    <td>${req.description || '-'}${locationText}<br><small style="color:gray;">ผู้แจ้ง: ${req.profiles?.full_name||'-'}</small></td>
                    <td style="font-weight:bold; color:${color};">฿${parseFloat(req.amount).toLocaleString()}</td><td>${slipLink}</td>
                    <td>
                        <div style="display:flex; flex-direction:column; gap:5px;">
                            <select id="bank-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;"><option value="">-- เลือกบัญชี --</option>${bankOpts}</select>
                            <select id="fund-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;"><option value="">-- เลือกกองทุน --</option>${fundOpts}</select>
                            <button onclick="approveDonation('${req.id}', ${req.amount}, '${req.transaction_type}')" class="btn btn-success" style="padding:5px 10px; font-size:12px;">✅ อนุมัติเข้าบัญชี</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        } catch (e) { console.error(e); }
    };

    window.approveDonation = async function(id, amount, type) {
        const bankId = document.getElementById(`bank-for-${id}`)?.value;
        const fundId = document.getElementById(`fund-for-${id}`)?.value;
        if (!bankId || !fundId) { alert("⚠️ กรุณาเลือก 'บัญชีธนาคาร' และ 'กองทุน' ให้ครบถ้วน"); return; }
        
        if (confirm(`ยืนยันการนำรายการ ฿${amount.toLocaleString()} อัปเดตเข้าบัญชีและกองทุน?`)) {
            try {
                const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', bankId).single();
                let nBal = parseFloat(bData.balance); nBal += (type === 'expense' ? -parseFloat(amount) : parseFloat(amount));
                await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', bankId);

                const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', fundId).single();
                let nFun = parseFloat(fData.remaining_budget); nFun += (type === 'expense' ? -parseFloat(amount) : parseFloat(amount));
                await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', fundId);
                
                await supabaseClient.from('transactions').update({ status: 'approved', bank_account_id: bankId, fund_id: fundId }).eq('id', id);
                alert("✅ อนุมัติเรียบร้อย!"); window.loadAllAdminData();
            } catch (err) { alert("เกิดข้อผิดพลาด: " + err.message); }
        }
    };

    window.loadPendingRequests = async function() {
        const tbody = document.querySelector('#requests-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('clearances').select(`*, profiles (full_name)`).in('status', ['pending_advance', 'pending_clearance']).order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบครับ</td></tr>`; return; }

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const amt = req.status === 'pending_advance' ? req.requested_amount : req.total_actual_amount;
                let typeL = '', statL = '';
                if (req.status === 'pending_advance') { typeL = '<span style="color:var(--info); font-weight:bold;">เบิกล่วงหน้า</span>'; statL = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">รอโอนตั้งต้น</span>'; } 
                else { typeL = req.request_type === 'advance' ? '<span style="color:var(--info); font-weight:bold;">เคลียร์บิลล่วงหน้า</span>' : '<span style="color:var(--primary); font-weight:bold;">สำรองจ่าย</span>'; statL = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">รอตรวจบิล</span>'; }
                return `<tr><td>${date}</td><td>${req.profiles?.full_name||'-'}</td><td>${typeL}</td><td>${req.purpose}</td><td style="font-weight:bold;">฿${amt.toLocaleString()}</td><td>${statL}</td><td><button onclick="openModal('${req.id}')" class="btn btn-info" style="padding:6px 12px; font-size:12px;">🔍 ตรวจสอบ</button></td></tr>`;
            }).join('');
        } catch (e) { console.error(e); }
    };

    // ==========================================
    // โหลดสมุดบัญชี (เพิ่มปุ่ม ดูข้อมูล)
    // ==========================================
    window.loadLedger = async function() {
        const tbody = document.querySelector('#ledger-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('transactions').select(`*, profiles!transactions_created_by_fkey(full_name), bank_accounts(bank_name), funds(fund_name)`).eq('status', 'approved').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">ยังไม่มีประวัติในสมุดบัญชี</td></tr>`; return; }

            tbody.innerHTML = data.map(tx => {
                const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
                const amt = parseFloat(tx.amount) || 0;
                let inc = '-', exp = '-';
                if (tx.transaction_type === 'expense') exp = `<span style="color:var(--danger); font-weight:bold;">฿${amt.toLocaleString()}</span>`;
                else inc = `<span style="color:var(--success); font-weight:bold;">฿${amt.toLocaleString()}</span>`;

                return `<tr>
                    <td>${date}</td>
                    <td>${tx.description || '-'}${tx.location ? ` (ส: ${tx.location})` : ''}</td>
                    <td style="font-size:12px; color:gray;">🏦 ${tx.bank_accounts?.bank_name||'-'}<br>💼 ${tx.funds?.fund_name||'-'}</td>
                    <td style="text-align:right; background:#f0fdf4;">${inc}</td><td style="text-align:right; background:#fef2f2;">${exp}</td>
                    <td style="font-size:13px; color:var(--text-muted);">${tx.profiles?.full_name || 'ระบบ / แอดมิน'}</td>
                    <td style="text-align:center;"><button onclick="viewTransaction('${tx.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">🔍 ดูสลิป</button></td>
                </tr>`;
            }).join('');

            const { data: bList } = await supabaseClient.from('bank_accounts').select('*');
            const { data: fList } = await supabaseClient.from('funds').select('*');
            if(document.getElementById('direct-bank')) document.getElementById('direct-bank').innerHTML = '<option value="">-- บัญชี --</option>' + (bList||[]).map(b=>`<option value="${b.id}">${b.bank_name}</option>`).join('');
            if(document.getElementById('direct-fund')) document.getElementById('direct-fund').innerHTML = '<option value="">-- กองทุน --</option>' + (fList||[]).map(f=>`<option value="${f.id}">${f.fund_name}</option>`).join('');
        } catch (e) { console.error(e); }
    };

    // ฟอร์มบันทึกโดยตรง
    const directForm = document.getElementById('direct-transaction-form');
    if (directForm) {
        directForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('direct-msg');
            const subBtn = directForm.querySelector('button');
            subBtn.disabled = true;
            if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังบันทึก...'; }

            try {
                const type = document.getElementById('direct-type').value;
                const desc = document.getElementById('direct-desc').value;
                const amt = parseFloat(document.getElementById('direct-amount').value);
                const bankId = document.getElementById('direct-bank').value;
                const fundId = document.getElementById('direct-fund').value;

                const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', bankId).single();
                const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', fundId).single();
                let nBal = parseFloat(bData.balance), nFun = parseFloat(fData.remaining_budget);
                if (type === 'income') { nBal += amt; nFun += amt; } else { nBal -= amt; nFun -= amt; }

                await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', bankId);
                await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', fundId);
                await supabaseClient.from('transactions').insert([{ transaction_date: new Date().toISOString().split('T')[0], transaction_type: type, description: desc, amount: amt, bank_account_id: bankId, fund_id: fundId, status: 'approved', created_by: currentUser.id }]);

                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ บันทึกลงสมุดบัญชีเรียบร้อย!'; }
                directForm.reset(); window.loadAllAdminData();
                setTimeout(()=> { if(msg) msg.textContent = ''; }, 3000);
            } catch (err) { if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; } } 
            finally { subBtn.disabled = false; }
        });
    }

    // ==========================================
    // โหลดประวัติเบิกเงิน (เพิ่มปุ่ม ดูบิลย่อย)
    // ==========================================
    window.loadClearanceHistory = async function() {
        const tbody = document.querySelector('#clearance-history-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('clearances').select(`*, profiles (full_name)`).not('status', 'in', '("draft","pending_advance","pending_clearance")').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">ไม่มีประวัติการอนุมัติครับ</td></tr>`; return; }

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                const typeL = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย';
                let statL = req.status === 'advance_transferred' ? '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">โอนตั้งต้นแล้ว</span>' : '<span class="status-badge" style="background:#d1fae5; color:#059669;">อนุมัติ/เคลียร์แล้ว</span>';
                
                return `<tr>
                    <td>${date}</td><td>${req.profiles?.full_name||'-'}</td><td>${typeL}</td><td>${req.purpose}</td>
                    <td style="font-weight:bold; color:var(--success);">฿${parseFloat(amt).toLocaleString()}</td><td>${statL}</td>
                    <td style="text-align:center;"><button onclick="viewClearance('${req.id}')" class="btn btn-info" style="padding:4px 8px; font-size:12px;">🔍 ดูบิลย่อย</button></td>
                </tr>`;
            }).join('');
        } catch (e) { console.error(e); }
    };


    // ==========================================
    // 💡 ฟังก์ชันใหม่: เรียกดูข้อมูลย้อนหลัง (Read-Only)
    // ==========================================
    
    // ดูรายละเอียดสมุดบัญชี
    window.viewTransaction = async function(id) {
        document.getElementById('view-tx-modal').style.display = 'flex';
        const content = document.getElementById('view-tx-content');
        content.innerHTML = 'กำลังโหลดข้อมูล...';

        try {
            const { data: tx } = await supabaseClient.from('transactions').select(`*, profiles!transactions_created_by_fkey(full_name), bank_accounts(bank_name), funds(fund_name)`).eq('id', id).single();
            if (!tx) throw new Error("ไม่พบข้อมูล");

            const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
            const imgHtml = tx.slip_url ? `<div style="margin-top:15px; text-align:center;"><img src="${tx.slip_url}" style="max-width:100%; max-height:300px; border-radius:8px; border:1px solid #ccc; cursor:pointer;" onclick="window.open(this.src, '_blank')"></div>` : `<div style="margin-top:15px; padding:20px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีการแนบรูปหลักฐาน</div>`;

            content.innerHTML = `
                <table style="width:100%; font-size:14px;">
                    <tr><td style="padding:5px 0; color:gray; width:30%;">วันที่:</td><td style="font-weight:bold;">${date}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">รายละเอียด:</td><td>${tx.description || '-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">สถานที่:</td><td>${tx.location || '-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">ยอดเงิน:</td><td style="font-weight:bold; color:var(--primary);">฿${parseFloat(tx.amount).toLocaleString()}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">บัญชี / กองทุน:</td><td>🏦 ${tx.bank_accounts?.bank_name||'-'} <br> 💼 ${tx.funds?.fund_name||'-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">ผู้บันทึก:</td><td>${tx.profiles?.full_name || 'แอดมิน'}</td></tr>
                </table>
                ${imgHtml}
            `;
        } catch (err) { content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ: '+err.message+'</span>'; }
    };

    // ดูรายละเอียดการเบิกเงิน/บิลย่อย
    window.viewClearance = async function(id) {
        document.getElementById('view-clearance-modal').style.display = 'flex';
        const content = document.getElementById('view-clearance-content');
        content.innerHTML = 'กำลังโหลดข้อมูล...';

        try {
            const { data: c } = await supabaseClient.from('clearances').select(`*, profiles(full_name)`).eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            let itemsHtml = '<div style="padding:15px; text-align:center; color:gray; background:#f4f6f9; border-radius:6px;">ไม่มีรายการย่อย</div>';
            if (items && items.length > 0) {
                itemsHtml = `
                    <table style="width:100%; background:#f8fafc; border-radius:6px; margin-top:10px;">
                        <thead><tr><th style="padding:8px;">รายการ</th><th style="text-align:center;">จำนวน</th><th style="text-align:right; padding-right:8px;">ราคารวม</th></tr></thead>
                        <tbody>
                            ${items.map(it => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${it.item_name}</td><td style="text-align:center; border-bottom:1px solid #eee;">${it.quantity}</td><td style="text-align:right; padding-right:8px; border-bottom:1px solid #eee;">฿${parseFloat(it.total_price).toLocaleString()}</td></tr>`).join('')}
                        </tbody>
                    </table>
                `;
            }

            const imgList = [];
            if(c.statement_url) imgList.push(`<div><p style="margin:0 0 5px 0; color:gray; font-size:12px;">สลิป Member/ใบเสร็จ:</p><img src="${c.statement_url}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            if(c.member_return_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--danger); font-size:12px;">สลิป Member คืนเงินทอน:</p><img src="${c.member_return_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            if(c.admin_transfer_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--success); font-size:12px;">สลิป Admin โอนเงินจ่าย:</p><img src="${c.admin_transfer_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            
            const imgsHtml = imgList.length > 0 ? `<div style="display:flex; gap:10px; margin-top:15px; overflow-x:auto; padding-bottom:10px;">${imgList.join('')}</div>` : `<div style="margin-top:15px; padding:15px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีรูปหลักฐานแนบไว้เลย</div>`;

            content.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:300px;">
                        <table style="width:100%; font-size:14px;">
                            <tr><td style="padding:4px 0; color:gray; width:35%;">ผู้เบิก:</td><td style="font-weight:bold;">${c.profiles?.full_name||'-'}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">หัวข้อ:</td><td>${c.purpose}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">ยอดขอตั้งต้น:</td><td>฿${parseFloat(c.requested_amount).toLocaleString()}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">ยอดอนุมัติจริง:</td><td style="font-weight:bold; color:var(--success);">฿${parseFloat(c.total_actual_amount).toLocaleString()}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">บัญชีรับเงิน (Member):</td><td>${c.member_bank_details || '-'}</td></tr>
                        </table>
                        ${imgsHtml}
                    </div>
                    <div style="flex:1.2; min-width:300px;">
                        <h4 style="margin:0 0 5px 0; color:var(--primary);">🛒 รายการสินค้า / บิลย่อย</h4>
                        ${itemsHtml}
                    </div>
                </div>
            `;
        } catch (err) { content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ: '+err.message+'</span>'; }
    };


    // ==========================================
    // ระบบ Modal อนุมัติ (ของเดิม)
    // ==========================================
    const actionModal = document.getElementById('action-modal');
    window.openModal = async function(id) {
        if(actionModal) actionModal.style.display = 'flex';
        const msg = document.getElementById('modal-msg');
        if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังดึงข้อมูล...'; }
        try {
            const { data: c } = await supabaseClient.from('clearances').select('*').eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            document.getElementById('modal-req-id').value = c.id;
            document.getElementById('modal-req-type').value = c.request_type;
            window.currentClearance = c;

            const targetImg = c.statement_url || c.member_return_slip;
            if (targetImg && document.getElementById('modal-statement-img')) {
                document.getElementById('modal-statement-img').src = targetImg;
                document.getElementById('modal-statement-preview').style.display = 'block';
                document.getElementById('modal-no-statement').style.display = 'none';
            } else {
                document.getElementById('modal-statement-preview').style.display = 'none';
                document.getElementById('modal-no-statement').style.display = 'block';
            }

            const iTbody = document.getElementById('modal-items-tbody');
            if (items && items.length > 0 && iTbody) {
                document.getElementById('modal-items-section').style.display = 'block';
                iTbody.innerHTML = items.map(it => `<tr><td>${it.item_name}</td><td style="text-align:center;">${it.quantity}</td><td style="text-align:right; color:gray;">${it.total_price.toLocaleString()}</td><td style="text-align:right;"><input type="number" class="admin-edit-price" data-id="${it.id}" data-original="${it.total_price}" value="${it.total_price}" step="0.01" style="width:70px; padding:4px; text-align:right; color:var(--primary); font-weight:bold;"></td></tr>`).join('');
                document.querySelectorAll('.admin-edit-price').forEach(inp => inp.addEventListener('input', window.recalculateAdminTotal));
            } else document.getElementById('modal-items-section').style.display = 'none';

            const { data: bList } = await supabaseClient.from('bank_accounts').select('*');
            const { data: fList } = await supabaseClient.from('funds').select('*');
            if(document.getElementById('admin-bank-select')) document.getElementById('admin-bank-select').innerHTML = '<option value="">-- เลือกบัญชี --</option>' + (bList||[]).map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('');
            if(document.getElementById('admin-fund-select')) document.getElementById('admin-fund-select').innerHTML = '<option value="">-- หักจากกองทุน --</option>' + (fList||[]).map(f => `<option value="${f.id}">${f.fund_name}</option>`).join('');

            window.recalculateAdminTotal();
            if(msg) msg.textContent = '';
        } catch (err) { if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'โหลดข้อมูลไม่สำเร็จ'; } }
    };

    window.closeModal = function() {
        if(actionModal) actionModal.style.display = 'none';
        document.getElementById('admin-action-form')?.reset();
    };

    window.recalculateAdminTotal = function() {
        const c = window.currentClearance;
        if(!c) return;
        let totalAppr = 0, isEdited = false;
        const inputs = document.querySelectorAll('.admin-edit-price');
        if (inputs.length > 0) {
            inputs.forEach(inp => { const val = parseFloat(inp.value)||0, orig = parseFloat(inp.dataset.original)||0; totalAppr += val; if (val !== orig) isEdited = true; });
        } else totalAppr = c.status === 'pending_advance' ? c.requested_amount : c.total_actual_amount;

        if(document.getElementById('modal-diff-warning')) document.getElementById('modal-diff-warning').style.display = isEdited ? 'block' : 'none';
        if(document.getElementById('modal-recalc-total')) document.getElementById('modal-recalc-total').textContent = totalAppr.toLocaleString();

        let processAmt = 0, actionDir = 'none';
        if (c.status === 'pending_advance') { processAmt = totalAppr; actionDir = 'pay'; } 
        else if (c.status === 'pending_clearance') {
            if (c.request_type === 'advance') {
                const diff = c.requested_amount - totalAppr; processAmt = Math.abs(diff);
                if (diff > 0) actionDir = 'receive'; else if (diff < 0) actionDir = 'pay'; else actionDir = 'none'; 
            } else { processAmt = totalAppr; actionDir = 'pay'; }
        }

        const amtP = document.getElementById('modal-amount-display'), title = document.getElementById('modal-title'), slipSec = document.getElementById('admin-slip-section');
        if (actionDir === 'pay') { if(amtP) amtP.innerHTML = `💸 ชุมนุมต้องโอนจ่าย: <strong style="color:var(--danger); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; if(title) title.textContent = '💸 ยืนยันการโอนเงินออก'; if(slipSec) slipSec.style.display = 'block'; } 
        else if (actionDir === 'receive') { if(amtP) amtP.innerHTML = `📥 ชุมนุมได้รับเงินทอน: <strong style="color:var(--success); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; if(title) title.textContent = '📥 ยืนยันรับเงินทอน'; if(slipSec) slipSec.style.display = 'none';  } 
        else { if(amtP) amtP.innerHTML = `✅ <strong style="color:gray; font-size:20px;">บิลพอดี (ไม่ต้องโอนเงินเพิ่ม)</strong>`; if(title) title.textContent = '✅ อนุมัติเคลียร์บิล'; if(slipSec) slipSec.style.display = 'none'; }

        if(document.getElementById('modal-req-amount')) document.getElementById('modal-req-amount').value = processAmt;
        if(document.getElementById('modal-final-total')) document.getElementById('modal-final-total').value = totalAppr;
        if(document.getElementById('modal-action-dir')) document.getElementById('modal-action-dir').value = actionDir;
    };

    const modalForm = document.getElementById('admin-action-form');
    if (modalForm) {
        modalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('modal-msg'), btn = document.getElementById('confirm-action-btn');
            if(btn) btn.disabled = true; if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังประมวลผล...'; }

            const reqId = document.getElementById('modal-req-id')?.value, reqType = document.getElementById('modal-req-type')?.value, finalTotal = parseFloat(document.getElementById('modal-final-total')?.value), processAmt = parseFloat(document.getElementById('modal-req-amount')?.value), actionDir = document.getElementById('modal-action-dir')?.value, bankId = document.getElementById('admin-bank-select')?.value, fundId = document.getElementById('admin-fund-select')?.value, slipFile = document.getElementById('admin-slip')?.files[0];

            if (actionDir === 'pay' && processAmt > 0 && !slipFile) { if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณาแนบสลิปโอนเงินจ่ายด้วยครับ'; } if(btn) btn.disabled = false; return; }

            try {
                const inputs = document.querySelectorAll('.admin-edit-price');
                if (inputs.length > 0) { for (let inp of inputs) { const iId = inp.dataset.id, val = parseFloat(inp.value)||0, orig = parseFloat(inp.dataset.original)||0; if (val !== orig) await supabaseClient.from('clearance_items').update({ total_price: val }).eq('id', iId); } }

                let aSlipUrl = null;
                if (slipFile) { const p = `admin-slip-${Date.now()}.${slipFile.name.split('.').pop()}`; await supabaseClient.storage.from('slips').upload(p, slipFile); aSlipUrl = supabaseClient.storage.from('slips').getPublicUrl(p).data.publicUrl; }

                if (actionDir !== 'none' && processAmt > 0) {
                    const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', bankId).single();
                    const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', fundId).single();
                    let nBal = parseFloat(bData.balance), nFun = parseFloat(fData.remaining_budget);
                    if (actionDir === 'pay') { nBal -= processAmt; nFun -= processAmt; } else { nBal += processAmt; nFun += processAmt; }
                    await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', bankId);
                    await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', fundId);
                    await supabaseClient.from('transactions').insert([{ transaction_date: new Date().toISOString().split('T')[0], transaction_type: actionDir === 'pay' ? 'expense' : 'income', amount: processAmt, description: `[ระบบ] เคลียร์เบิกจ่ายรหัส ${reqId.substring(0,6)}`, fund_id: fundId, bank_account_id: bankId, slip_url: aSlipUrl, status: 'approved', created_by: currentUser.id }]);
                }

                let newStat = (reqType === 'advance' && window.currentClearance.status === 'pending_advance') ? 'advance_transferred' : 'cleared';
                const upData = { status: newStat, total_actual_amount: finalTotal };
                if (aSlipUrl) upData.admin_transfer_slip = aSlipUrl;
                await supabaseClient.from('clearances').update(upData).eq('id', reqId);

                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ อนุมัติสำเร็จ!'; }
                setTimeout(() => { window.closeModal(); window.loadAllAdminData(); }, 2000);
            } catch (err) { if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; } } finally { if(btn) btn.disabled = false; }
        });
    }

    // ==========================================
    // Export Excel
    // ==========================================
    window.exportLedgerToCSV = function() {
        const table = document.getElementById("ledger-table");
        if (!table) return;
        let csvContent = "\uFEFF"; 
        const rows = table.querySelectorAll("tr");
        let hasData = false;

        rows.forEach((row) => {
            let rowData = [];
            const cols = row.querySelectorAll("td, th");
            if (cols.length === 1 && cols[0].innerText.includes('กำลังโหลด')) return;
            if (cols.length > 1 && row.parentNode.tagName === 'TBODY') hasData = true;

            cols.forEach((col) => {
                let data = col.innerText.replace(/🔍 ดูสลิป/g, '').replace(/฿/g, '').replace(/,/g, '').replace(/\n/g, ' ').trim();
                rowData.push('"' + data + '"');
            });
            csvContent += rowData.join(",") + "\r\n";
        });

        if (!hasData) { alert("ไม่มีข้อมูลในสมุดบัญชีสำหรับ Export ครับ"); return; }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Ledger_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    window.loadAllAdminData = function() {
        if (!currentUser) return;
        window.loadDashboardWidgets();
        window.loadPendingDonations();
        window.loadPendingRequests();
        window.loadLedger();
        window.loadClearanceHistory();
    };

    window.loadAllAdminData();
});
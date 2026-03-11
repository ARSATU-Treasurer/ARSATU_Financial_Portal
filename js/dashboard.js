document.addEventListener('DOMContentLoaded', async () => {

    let currentUser = null;
    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data.session) {
            window.location.replace('index.html');
            return;
        }
        currentUser = data.session.user;
    } catch (err) {
        alert("กรุณาล็อกอินใหม่");
        window.location.replace('index.html');
        return;
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('index.html');
    });

    // ==========================================
    // 1. โหลดข้อมูลภาพรวม Dashboard
    // ==========================================
    window.loadDashboardWidgets = async function() {
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('*');
            const bankTbody = document.querySelector('#bank-table tbody');
            if (bankTbody) {
                bankTbody.innerHTML = banks && banks.length 
                    ? banks.map(b => `<tr><td>${b.bank_name}</td><td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td></tr>`).join('') 
                    : `<tr><td style="text-align:center;">ไม่มีข้อมูล</td></tr>`;
            }

            const { data: funds } = await supabaseClient.from('funds').select('*');
            const fundTbody = document.querySelector('#fund-table tbody');
            if (fundTbody) {
                fundTbody.innerHTML = funds && funds.length 
                    ? funds.map(f => `<tr><td>${f.fund_name}</td><td style="text-align:right; color:var(--info); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td></tr>`).join('') 
                    : `<tr><td style="text-align:center;">ไม่มีข้อมูล</td></tr>`;
            }

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
        } catch (e) { console.error("Widget Error:", e); }
    };

    // ==========================================
    // 2. โหลดรายการรออนุมัติรับเงิน (บริจาค/รายรับ)
    // ==========================================
    window.loadPendingDonations = async function() {
        const tbody = document.querySelector('#pending-donations-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('transactions').select(`*, profiles!transactions_created_by_fkey(full_name)`).eq('status', 'pending').order('created_at', { ascending: false });
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบ</td></tr>`; 
                return; 
            }

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

                return `
                    <tr>
                        <td>${date}</td>
                        <td style="color:${color}; font-weight:500;">${typeLabel}</td>
                        <td>${req.description || '-'}${locationText}<br><small style="color:gray;">ผู้แจ้ง: ${req.profiles?.full_name||'-'}</small></td>
                        <td style="font-weight:bold; color:${color};">฿${parseFloat(req.amount).toLocaleString()}</td>
                        <td>${slipLink}</td>
                        <td>
                            <div style="display:flex; flex-direction:column; gap:5px;">
                                <select id="bank-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;"><option value="">-- เลือกบัญชี --</option>${bankOpts}</select>
                                <select id="fund-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;"><option value="">-- เลือกกองทุน --</option>${fundOpts}</select>
                                <button onclick="approveDonation('${req.id}', ${req.amount}, '${req.transaction_type}')" class="btn btn-success" style="padding:5px 10px; font-size:12px;">✅ อนุมัติ</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) { console.error(e); }
    };

    window.approveDonation = async function(id, amount, type) {
        const bankId = document.getElementById(`bank-for-${id}`)?.value;
        const fundId = document.getElementById(`fund-for-${id}`)?.value;
        if (!bankId || !fundId) { alert("⚠️ กรุณาเลือกบัญชีและกองทุนให้ครบ"); return; }
        
        if (confirm(`ยืนยันนำรายการ ฿${amount.toLocaleString()} เข้าบัญชีและกองทุน?`)) {
            try {
                const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', bankId).single();
                let nBal = parseFloat(bData.balance); 
                nBal += (type === 'expense' ? -parseFloat(amount) : parseFloat(amount));
                await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', bankId);

                const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', fundId).single();
                let nFun = parseFloat(fData.remaining_budget); 
                nFun += (type === 'expense' ? -parseFloat(amount) : parseFloat(amount));
                await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', fundId);
                
                await supabaseClient.from('transactions').update({ status: 'approved', bank_account_id: bankId, fund_id: fundId }).eq('id', id);
                alert("✅ อนุมัติเรียบร้อย!"); 
                window.loadAllAdminData();
            } catch (err) { alert("เกิดข้อผิดพลาด: " + err.message); }
        }
    };

    // ==========================================
    // 3. โหลดคำขอรอตรวจสอบ (แยกโอนเงินล่วงหน้า / ตรวจบิล)
    // ==========================================
    window.loadPendingRequests = async function() {
        const tbody = document.querySelector('#requests-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('clearances').select(`*, profiles (full_name)`).in('status', ['pending_advance', 'pending_clearance']).order('created_at', { ascending: false });
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบ</td></tr>`; 
                return; 
            }

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const amt = req.status === 'pending_advance' ? req.requested_amount : req.total_actual_amount;
                let typeL = '', statL = '', btnL = '';
                
                // ถ้ารอโอนตั้งต้น
                if (req.status === 'pending_advance') { 
                    typeL = '<span style="color:var(--info); font-weight:bold;">ขอเบิกล่วงหน้า</span>'; 
                    statL = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">รอโอนตั้งต้น</span>'; 
                    btnL = `<button onclick="openModal('${req.id}')" class="btn btn-warning" style="padding:6px 12px; font-size:12px;">💸 โอนเงิน</button>`;
                } 
                // ถ้ารอเคลียร์บิล (หรือสำรองจ่ายปกติ)
                else { 
                    typeL = req.request_type === 'advance' ? '<span style="color:var(--info); font-weight:bold;">เคลียร์บิล (ล่วงหน้า)</span>' : '<span style="color:var(--primary); font-weight:bold;">สำรองจ่าย (เบิกคืน)</span>'; 
                    statL = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">รอตรวจบิล</span>'; 
                    btnL = `<button onclick="openModal('${req.id}')" class="btn btn-info" style="padding:6px 12px; font-size:12px;">🔍 ตรวจบิล</button>`;
                }
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${req.profiles?.full_name||'-'}</td>
                        <td>${typeL}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:bold;">฿${amt.toLocaleString()}</td>
                        <td>${statL}</td>
                        <td>${btnL}</td>
                    </tr>`;
            }).join('');
        } catch (e) { console.error(e); }
    };

    // ==========================================
    // 4. ระบบ Modal อนุมัติแบบแยก 2 สเต็ป (Advance Flow)
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

            // จัดการรูปภาพ (ตอนขอตั้งต้นยังไม่มีรูป ให้ซ่อนไว้ก่อน)
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
            // 🌟 ถ้ารอโอนตั้งต้น ซ่อนรายการย่อย เพราะยังไม่ได้ซื้อของจริง
            if (c.status === 'pending_advance') {
                document.getElementById('modal-items-section').style.display = 'none';
            } else {
                if (items && items.length > 0 && iTbody) {
                    document.getElementById('modal-items-section').style.display = 'block';
                    iTbody.innerHTML = items.map(it => `
                        <tr>
                            <td>${it.item_name}</td>
                            <td style="text-align:center;">${it.quantity}</td>
                            <td style="text-align:right; color:gray;">${it.total_price.toLocaleString()}</td>
                            <td style="text-align:right;"><input type="number" class="admin-edit-price" data-id="${it.id}" data-original="${it.total_price}" value="${it.total_price}" step="0.01" style="width:70px; padding:4px; text-align:right; color:var(--primary); font-weight:bold;"></td>
                        </tr>`).join('');
                    document.querySelectorAll('.admin-edit-price').forEach(inp => inp.addEventListener('input', window.recalculateAdminTotal));
                } else {
                    document.getElementById('modal-items-section').style.display = 'none';
                }
            }

            // โหลดบัญชี/กองทุนให้แอดมินเลือกตัดเงิน
            const { data: bList } = await supabaseClient.from('bank_accounts').select('*');
            const { data: fList } = await supabaseClient.from('funds').select('*');
            if(document.getElementById('admin-bank-select')) document.getElementById('admin-bank-select').innerHTML = '<option value="">-- เลือกบัญชี --</option>' + (bList||[]).map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('');
            if(document.getElementById('admin-fund-select')) document.getElementById('admin-fund-select').innerHTML = '<option value="">-- หัก/รับเข้า กองทุน --</option>' + (fList||[]).map(f => `<option value="${f.id}">${f.fund_name}</option>`).join('');

            window.recalculateAdminTotal();
            if(msg) msg.textContent = '';
        } catch (err) { 
            if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'โหลดข้อมูลไม่สำเร็จ'; } 
        }
    };

    window.closeModal = function() {
        if(actionModal) actionModal.style.display = 'none';
        document.getElementById('admin-action-form')?.reset();
    };

    // คำนวณยอดเงินที่แอดมินต้องทำรายการ
    window.recalculateAdminTotal = function() {
        const c = window.currentClearance;
        if(!c) return;
        let totalAppr = 0, isEdited = false;

        // 🌟 ถ้ารอโอนตั้งต้น ยอดคือสิ่งที่ขอมาเต็มๆ
        if (c.status === 'pending_advance') {
            totalAppr = c.requested_amount;
        } else {
            const inputs = document.querySelectorAll('.admin-edit-price');
            if (inputs.length > 0) {
                inputs.forEach(inp => { 
                    const val = parseFloat(inp.value)||0; 
                    const orig = parseFloat(inp.dataset.original)||0; 
                    totalAppr += val; 
                    if (val !== orig) isEdited = true; 
                });
            } else totalAppr = c.total_actual_amount;
        }

        if(document.getElementById('modal-diff-warning')) document.getElementById('modal-diff-warning').style.display = isEdited ? 'block' : 'none';
        if(document.getElementById('modal-recalc-total')) document.getElementById('modal-recalc-total').textContent = totalAppr.toLocaleString();

        let processAmt = 0, actionDir = 'none';
        
        // 🌟 วิเคราะห์ทิศทางเงิน (จ่ายออก หรือ รับเข้า)
        if (c.status === 'pending_advance') {
            processAmt = totalAppr; 
            actionDir = 'pay'; // แอดมินต้องจ่ายเงินตั้งต้น
        } 
        else if (c.status === 'pending_clearance') {
            if (c.request_type === 'advance') {
                const diff = c.requested_amount - totalAppr; 
                processAmt = Math.abs(diff);
                if (diff > 0) actionDir = 'receive'; // ซื้อของถูกกว่าที่ขอ (Member ต้องคืนเงินทอน)
                else if (diff < 0) actionDir = 'pay'; // ซื้อของแพงกว่าที่ขอ (Admin ต้องจ่ายเพิ่ม)
                else actionDir = 'none'; // พอดีเป๊ะ
            } else {
                processAmt = totalAppr; 
                actionDir = 'pay'; // Reimbursement ปกติ (จ่ายคืนเต็มจำนวนที่เบิก)
            }
        }

        const amtP = document.getElementById('modal-amount-display');
        const title = document.getElementById('modal-title');
        const slipSec = document.getElementById('admin-slip-section');
        
        if (actionDir === 'pay') { 
            if(amtP) amtP.innerHTML = `💸 ชุมนุมต้องโอนจ่าย: <strong style="color:var(--danger); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; 
            if(title) title.textContent = c.status === 'pending_advance' ? '💸 ยืนยันโอนเงินตั้งต้น (Advance)' : '💸 ยืนยันการโอนเงินออก'; 
            if(slipSec) slipSec.style.display = 'block'; // บังคับให้แอดมินแนบสลิป
        } 
        else if (actionDir === 'receive') { 
            if(amtP) amtP.innerHTML = `📥 ชุมนุมได้รับเงินทอน: <strong style="color:var(--success); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; 
            if(title) title.textContent = '📥 ยืนยันรับเงินทอนเคลียร์บิล'; 
            if(slipSec) slipSec.style.display = 'none';  // แอดมินแค่รับยอดเข้าสมุด ไม่ต้องแนบสลิป
        } 
        else { 
            if(amtP) amtP.innerHTML = `✅ <strong style="color:gray; font-size:20px;">บิลพอดี (ไม่ต้องโอนเงินเพิ่ม)</strong>`; 
            if(title) title.textContent = '✅ อนุมัติเคลียร์บิล'; 
            if(slipSec) slipSec.style.display = 'none'; 
        }

        if(document.getElementById('modal-req-amount')) document.getElementById('modal-req-amount').value = processAmt;
        if(document.getElementById('modal-final-total')) document.getElementById('modal-final-total').value = totalAppr;
        if(document.getElementById('modal-action-dir')) document.getElementById('modal-action-dir').value = actionDir;
    };

    const modalForm = document.getElementById('admin-action-form');
    if (modalForm) {
        modalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById('modal-msg');
            const btn = document.getElementById('confirm-action-btn');
            
            if(btn) btn.disabled = true; 
            if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังประมวลผล...'; }

            const reqId = document.getElementById('modal-req-id')?.value;
            const finalTotal = parseFloat(document.getElementById('modal-final-total')?.value);
            const processAmt = parseFloat(document.getElementById('modal-req-amount')?.value);
            const actionDir = document.getElementById('modal-action-dir')?.value;
            const bankId = document.getElementById('admin-bank-select')?.value;
            const fundId = document.getElementById('admin-fund-select')?.value;
            const slipFile = document.getElementById('admin-slip')?.files[0];

            if (actionDir === 'pay' && processAmt > 0 && !slipFile) {
                if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณาแนบสลิปโอนเงินจ่าย'; }
                if(btn) btn.disabled = false; return;
            }

            try {
                // อัปเดตราคาในฐานข้อมูลถ้าแอดมินแก้ตัวเลขรายการย่อย
                const inputs = document.querySelectorAll('.admin-edit-price');
                if (inputs.length > 0) { 
                    for (let inp of inputs) { 
                        const iId = inp.dataset.id;
                        const val = parseFloat(inp.value)||0;
                        const orig = parseFloat(inp.dataset.original)||0; 
                        if (val !== orig) {
                            await supabaseClient.from('clearance_items').update({ total_price: val }).eq('id', iId); 
                        }
                    } 
                }

                let aSlipUrl = null;
                if (slipFile) { 
                    const p = `admin-slip-${Date.now()}.${slipFile.name.split('.').pop()}`; 
                    await supabaseClient.storage.from('slips').upload(p, slipFile); 
                    aSlipUrl = supabaseClient.storage.from('slips').getPublicUrl(p).data.publicUrl; 
                }

                // 🌟 หัก/เพิ่ม ยอดเงินในธนาคาร และลงสมุดบัญชี
                if (actionDir !== 'none' && processAmt > 0) {
                    const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', bankId).single();
                    const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', fundId).single();
                    let nBal = parseFloat(bData.balance), nFun = parseFloat(fData.remaining_budget);
                    
                    if (actionDir === 'pay') { nBal -= processAmt; nFun -= processAmt; } 
                    else { nBal += processAmt; nFun += processAmt; }
                    
                    await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', bankId);
                    await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', fundId);
                    
                    // ลงสมุดบัญชี
                    // ดึงหัวข้อรายการมาจัดรูปแบบใหม่: [ประเภท] หัวข้อ (รหัส)
                    const reqPurpose = window.currentClearance.purpose || '-';
                    const shortId = reqId.substring(0,6);
                    const logDesc = window.currentClearance.status === 'pending_advance' ? `[โอนตั้งต้น] ${reqPurpose} (${shortId})` : `[เคลียร์บิล] ${reqPurpose} (${shortId})`;
                    await supabaseClient.from('transactions').insert([{ 
                        transaction_date: new Date().toISOString().split('T')[0], 
                        transaction_type: actionDir === 'pay' ? 'expense' : 'income', 
                        amount: processAmt, 
                        description: logDesc, 
                        fund_id: fundId, 
                        bank_account_id: bankId, 
                        slip_url: aSlipUrl, 
                        status: 'approved', 
                        created_by: currentUser.id 
                    }]);
                }

                // 🌟 สลับสถานะของคำขอ
                let newStat = window.currentClearance.status === 'pending_advance' ? 'advance_transferred' : 'cleared';
                const upData = { status: newStat, total_actual_amount: finalTotal };
                if (aSlipUrl) upData.admin_transfer_slip = aSlipUrl;
                
                await supabaseClient.from('clearances').update(upData).eq('id', reqId);

                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ ดำเนินการสำเร็จ!'; }
                setTimeout(() => { window.closeModal(); window.loadAllAdminData(); }, 2000);
                
            } catch (err) { 
                if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; } 
            } finally { 
                if(btn) btn.disabled = false; 
            }
        });
    }

    // ==========================================
    // 5. โหลดสมุดบัญชีรายรับ-รายจ่าย (Ledger)
    // ==========================================
    window.loadLedger = async function() {
        // 🌟 แก้ไข: ย้ายการโหลด Dropdown มาไว้บนสุด ป้องกันกรณีไม่มีประวัติแล้วโค้ดหยุดทำงาน
        try {
            const { data: bList } = await supabaseClient.from('bank_accounts').select('*');
            const { data: fList } = await supabaseClient.from('funds').select('*');
            if(document.getElementById('direct-bank')) document.getElementById('direct-bank').innerHTML = '<option value="">-- เลือกบัญชี --</option>' + (bList||[]).map(b=>`<option value="${b.id}">${b.bank_name}</option>`).join('');
            if(document.getElementById('direct-fund')) document.getElementById('direct-fund').innerHTML = '<option value="">-- เลือกกองทุน --</option>' + (fList||[]).map(f=>`<option value="${f.id}">${f.fund_name}</option>`).join('');
        } catch(e) { console.error("โหลด Dropdown ไม่สำเร็จ:", e); }

        const tbody = document.querySelector('#ledger-table tbody');
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('transactions')
                .select(`*, profiles!transactions_created_by_fkey(full_name), bank_accounts(bank_name), funds(fund_name)`)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">ยังไม่มีประวัติในสมุดบัญชี</td></tr>`; 
                return; 
            }

            tbody.innerHTML = data.map(tx => {
                const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
                const amt = parseFloat(tx.amount) || 0;
                let inc = '-', exp = '-';
                
                if (tx.transaction_type === 'expense') {
                    exp = `<span style="color:var(--danger); font-weight:bold;">฿${amt.toLocaleString()}</span>`;
                } else {
                    inc = `<span style="color:var(--success); font-weight:bold;">฿${amt.toLocaleString()}</span>`;
                }

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${tx.description || '-'}${tx.location ? ` (ส: ${tx.location})` : ''}</td>
                        <td style="font-size:12px; color:gray;">🏦 ${tx.bank_accounts?.bank_name||'-'}<br>💼 ${tx.funds?.fund_name||'-'}</td>
                        <td style="text-align:right; background:#f0fdf4;">${inc}</td>
                        <td style="text-align:right; background:#fef2f2;">${exp}</td>
                        <td style="font-size:13px; color:var(--text-muted);">${tx.profiles?.full_name || 'ระบบ / แอดมิน'}</td>
                        <td style="text-align:center;"><button onclick="viewTransaction('${tx.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">🔍 ดูสลิป</button></td>
                    </tr>`;
            }).join('');
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
                await supabaseClient.from('transactions').insert([{ 
                    transaction_date: new Date().toISOString().split('T')[0], 
                    transaction_type: type, 
                    description: desc, 
                    amount: amt, 
                    bank_account_id: bankId, 
                    fund_id: fundId, 
                    status: 'approved', 
                    created_by: currentUser.id 
                }]);

                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ บันทึกลงสมุดบัญชีเรียบร้อย!'; }
                directForm.reset(); 
                window.loadAllAdminData();
                setTimeout(()=> { if(msg) msg.textContent = ''; }, 3000);
            } catch (err) { 
                if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; } 
            } finally { 
                subBtn.disabled = false; 
            }
        });
    }

    // ==========================================
    // 6. โหลดประวัติคำขอเบิกเงิน
    // ==========================================
    window.loadClearanceHistory = async function() {
        const tbody = document.querySelector('#clearance-history-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('clearances').select(`*, profiles (full_name)`).not('status', 'in', '("draft","pending_advance","pending_clearance")').order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">ไม่มีประวัติการอนุมัติ</td></tr>`; return; }

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                const typeL = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย';
                let statL = req.status === 'advance_transferred' ? '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">โอนตั้งต้นแล้ว (รอเคลียร์)</span>' : '<span class="status-badge" style="background:#d1fae5; color:#059669;">อนุมัติ/เคลียร์แล้ว</span>';
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${req.profiles?.full_name||'-'}</td>
                        <td>${typeL}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:bold; color:var(--success);">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${statL}</td>
                        <td style="text-align:center;"><button onclick="viewClearance('${req.id}')" class="btn btn-info" style="padding:4px 8px; font-size:12px;">🔍 ดูบิลย่อย</button></td>
                    </tr>`;
            }).join('');
        } catch (e) { console.error(e); }
    };

    // ==========================================
    // 7. V.3.1: หน้าตั้งค่าระบบ (Settings)
    // ==========================================
    window.loadSettingsData = async function() {
        // ดึงข้อมูลบัญชี
        const { data: banks } = await supabaseClient.from('bank_accounts').select('*');
        const bTbody = document.querySelector('#manage-bank-table tbody');
        if(bTbody) bTbody.innerHTML = banks.map(b => `<tr><td>${b.bank_name}</td><td>฿${b.balance.toLocaleString()}</td><td style="text-align:center;"><button onclick="deleteBank('${b.id}')" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button></td></tr>`).join('');

        // ดึงข้อมูลกองทุน
        const { data: funds } = await supabaseClient.from('funds').select('*');
        const fTbody = document.querySelector('#manage-fund-table tbody');
        if(fTbody) fTbody.innerHTML = funds.map(f => `<tr><td>${f.fund_name}</td><td>฿${f.remaining_budget.toLocaleString()}</td><td style="text-align:center;"><button onclick="deleteFund('${f.id}')" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button></td></tr>`).join('');
    };

   window.addBank = async function() {
        const name = document.getElementById('add-bank-name').value;
        const bal = parseFloat(document.getElementById('add-bank-bal').value);
        if(!name || isNaN(bal)) return alert("กรุณากรอกข้อมูลให้ครบ");

        const subBtn = event.target;
        subBtn.disabled = true;
        subBtn.textContent = "กำลังเพิ่ม...";

        try {
            const { error } = await supabaseClient.from('bank_accounts').insert([{ bank_name: name, balance: bal }]);
            if (error) throw error;
            
            document.getElementById('add-bank-name').value = ''; 
            document.getElementById('add-bank-bal').value = '';
            alert("✅ เพิ่มบัญชีสำเร็จ!");
            window.loadAllAdminData(); 
        } catch (err) {
            alert("❌ ไม่สามารถเพิ่มบัญชีได้: " + err.message);
        } finally {
            subBtn.disabled = false;
            subBtn.textContent = "+ เพิ่มบัญชี";
        }
    };

    window.deleteBank = async function(id) {
        if(confirm("ยืนยันการลบบัญชีนี้? (ยอดเงินจะถูกลบไปด้วย แต่ประวัติสมุดบัญชียังอยู่)")) {
            try {
                const { error } = await supabaseClient.from('bank_accounts').delete().eq('id', id);
                if (error) throw error;
                window.loadAllAdminData(); 
            } catch (err) {
                alert("❌ ไม่สามารถลบได้: " + err.message);
            }
        }
    };

    window.addFund = async function() {
        const name = document.getElementById('add-fund-name').value;
        const bal = parseFloat(document.getElementById('add-fund-bal').value);
        if(!name || isNaN(bal)) return alert("กรุณากรอกข้อมูลให้ครบ");

        const subBtn = event.target;
        subBtn.disabled = true;
        subBtn.textContent = "กำลังเพิ่ม...";

        try {
            const { error } = await supabaseClient.from('funds').insert([{ fund_name: name, remaining_budget: bal }]);
            if (error) throw error;

            document.getElementById('add-fund-name').value = ''; 
            document.getElementById('add-fund-bal').value = '';
            alert("✅ เพิ่มกองทุนสำเร็จ!");
            window.loadAllAdminData(); 
        } catch (err) {
            alert("❌ ไม่สามารถเพิ่มกองทุนได้: " + err.message);
        } finally {
            subBtn.disabled = false;
            subBtn.textContent = "+ เพิ่มกองทุน";
        }
    };

    window.deleteFund = async function(id) {
        if(confirm("ยืนยันการลบกองทุนนี้?")) {
            try {
                const { error } = await supabaseClient.from('funds').delete().eq('id', id);
                if (error) throw error;
                window.loadAllAdminData(); 
            } catch (err) {
                alert("❌ ไม่สามารถลบได้: " + err.message);
            }
        }
    };

    // ==========================================
    // 8. ฟังก์ชันเรียกดูข้อมูลย้อนหลัง (Read-Only)
    // ==========================================
    window.viewTransaction = async function(id) {
        document.getElementById('view-tx-modal').style.display = 'flex';
        const content = document.getElementById('view-tx-content');
        content.innerHTML = 'กำลังโหลดข้อมูล...';

        try {
            const { data: tx } = await supabaseClient.from('transactions').select(`*, profiles!transactions_created_by_fkey(full_name), bank_accounts(bank_name), funds(fund_name)`).eq('id', id).single();
            if (!tx) throw new Error("ไม่พบข้อมูล");

            const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
            const imgHtml = tx.slip_url ? `<div style="margin-top:15px; text-align:center;"><img src="${tx.slip_url}" style="max-width:100%; max-height:300px; border-radius:8px; border:1px solid #ccc; cursor:pointer;" onclick="window.open(this.src, '_blank')"></div>` : `<div style="margin-top:15px; padding:20px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีรูปหลักฐาน</div>`;

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
        } catch (err) { content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ</span>'; }
    };

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
            if(c.statement_url) imgList.push(`<div><p style="margin:0 0 5px 0; color:gray; font-size:12px;">ใบเสร็จรวม/สลิปจ่าย:</p><img src="${c.statement_url}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            if(c.member_return_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--warning); font-size:12px;">สลิปเงินทอน (คืนค่าย):</p><img src="${c.member_return_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            if(c.admin_transfer_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--danger); font-size:12px;">สลิปโอนเงิน (ออกค่าย):</p><img src="${c.admin_transfer_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            
            const imgsHtml = imgList.length > 0 ? `<div style="display:flex; gap:10px; margin-top:15px; overflow-x:auto; padding-bottom:10px;">${imgList.join('')}</div>` : `<div style="margin-top:15px; padding:15px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีรูปหลักฐานแนบไว้เลย</div>`;

            content.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:300px;">
                        <table style="width:100%; font-size:14px;">
                            <tr><td style="padding:4px 0; color:gray; width:35%;">ผู้เบิก:</td><td style="font-weight:bold;">${c.profiles?.full_name||'-'}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">หัวข้อ:</td><td>${c.purpose}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">ยอดขอเบิกล่วงหน้า:</td><td>฿${parseFloat(c.requested_amount).toLocaleString()}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">ยอดใช้จ่ายจริง:</td><td style="font-weight:bold; color:var(--success);">฿${parseFloat(c.total_actual_amount).toLocaleString()}</td></tr>
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
        } catch (err) { content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ</span>'; }
    };

    // ==========================================
    // 9. ฟังก์ชัน Export Excel (แบบแจกแจงรายการย่อย V.4.0)
    // ==========================================
    window.exportLedgerToCSV = async function() {
        const btn = document.querySelector('button[onclick="exportLedgerToCSV()"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังดึงข้อมูล...'; }

        try {
            // 1. ดึงสมุดบัญชีทั้งหมด
            const { data: txs } = await supabaseClient.from('transactions')
                .select(`*, profiles!transactions_created_by_fkey(full_name), bank_accounts(bank_name), funds(fund_name)`)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            // 2. ดึงรายการย่อย (บิลย่อย) ทั้งหมดมาเตรียมไว้
            const { data: cItems } = await supabaseClient.from('clearance_items').select('*');

            if (!txs || txs.length === 0) {
                alert("ไม่มีข้อมูลในสมุดบัญชีสำหรับ Export ครับ");
                return;
            }

            // ใส่ BOM ให้ Excel อ่านภาษาไทยได้
            let csvContent = "\uFEFF"; 
            // หัวตาราง
            csvContent += "วันที่,รายการ,บัญชี/กองทุน,รายรับ (฿),รายจ่าย (฿),ผู้บันทึก\n";

            txs.forEach(tx => {
                const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
                const desc = (tx.description || '-') + (tx.location ? ` (ส: ${tx.location})` : '');
                const bankFund = `[บ] ${tx.bank_accounts?.bank_name||'-'} / [ก] ${tx.funds?.fund_name||'-'}`;
                const amt = parseFloat(tx.amount) || 0;
                let inc = '', exp = '';
                
                if (tx.transaction_type === 'expense') exp = amt; else inc = amt;
                const user = tx.profiles?.full_name || 'แอดมิน';

                // 1) เพิ่มบรรทัด "หัวข้อหลัก"
                csvContent += `"${date}","${desc}","${bankFund}","${inc}","${exp}","${user}"\n`;

                // 2) ค้นหาว่ามีรายการย่อยไหม (โดยดึงรหัส 6 ตัวในวงเล็บมาเทียบ)
                const match = desc.match(/\(([a-zA-Z0-9]{6})\)/);
                if (match) {
                    const shortId = match[1];
                    // กรองหารายการที่ clearance_id ตรงกับรหัสนี้
                    const items = cItems.filter(i => i.clearance_id && i.clearance_id.startsWith(shortId));
                    
                    if (items.length > 0) {
                        items.forEach(it => {
                            // จัดรูปแบบรายการย่อย (นำราคาไปรวมในชื่อรายการ เพื่อไม่ให้ช่องตัวเลขถูก Sum ซ้ำ)
                            const itemName = `   ↳ ${it.item_name} (จำนวน: ${it.quantity}) = ฿${parseFloat(it.total_price).toLocaleString()}`;
                            
                            // ปล่อยช่องวันที่, บัญชี, รายรับ-จ่าย ให้ว่างไว้ จะได้ดูเป็น Hierarchy
                            csvContent += `"","${itemName}","","","",""\n`;
                        });
                    }
                }
            });

            // สร้างไฟล์ดาวน์โหลด
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `ARSATU_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error(e);
            alert("เกิดข้อผิดพลาดในการ Export Excel: " + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '📥 Export Excel'; }
        }
    };

    // ==========================================
    // ตัวรวบรวมคำสั่งโหลดข้อมูลทั้งหมด (เรียกใช้ตอนเริ่ม)
    // ==========================================
    window.loadAllAdminData = async function() {
        if (!currentUser) return;

        // 🌟 V.3.2: โหลดชื่อผู้ใช้ และ กระดิ่งแจ้งเตือน
        try {
            // ดึงชื่อมาแสดง
            const { data: profile } = await supabaseClient.from('profiles').select('full_name').eq('id', currentUser.id).single();
            if (profile && document.getElementById('current-user-name')) {
                document.getElementById('current-user-name').textContent = profile.full_name || 'Admin';
            }

            // คำนวณตัวเลขแจ้งเตือนบนกระดิ่ง
            const { count: c1 } = await supabaseClient.from('clearances').select('*', { count: 'exact', head: true }).in('status', ['pending_advance', 'pending_clearance']);
            const { count: c2 } = await supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            const totalPending = (c1 || 0) + (c2 || 0);

            const badge = document.getElementById('noti-badge');
            if (badge) {
                if (totalPending > 0) {
                    badge.textContent = totalPending;
                    badge.style.display = 'inline-block';
                    document.getElementById('noti-bell').onclick = () => alert(`🚨 มีรายการรอตรวจสอบทั้งหมด ${totalPending} รายการครับ!`);
                } else {
                    badge.style.display = 'none';
                    document.getElementById('noti-bell').onclick = () => alert(`✅ ไม่มีรายการค้างตรวจสอบครับ`);
                }
            }
        } catch(e) { console.error("Profile/Noti Error:", e); }

        // โหลดข้อมูลตารางอื่นๆ ตามปกติ
        window.loadDashboardWidgets();
        window.loadPendingDonations();
        window.loadPendingRequests();
        window.loadLedger();
        window.loadClearanceHistory();
        window.loadSettingsData(); 
    };

    // สั่งรันตอนเปิดหน้าเว็บ
    window.loadAllAdminData();
});
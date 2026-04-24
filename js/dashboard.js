document.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // 🌟 ระบบเช็กล็อกอิน (V7.0 ดั้งเดิม เสถียรที่สุด)
    // ==========================================
    let currentUser = null;
try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) { 
        window.location.replace('index.html'); 
        return; 
    }
    currentUser = data.session.user;

    // เช็ก Role ต่อทันที
    const { data: profileData, error: profileErr } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single();

    if (profileErr || !profileData || profileData.role !== 'admin') {
        showToast("คุณไม่มีสิทธิ์เข้าถึงหน้านี้","warning");
        window.location.replace('member.html'); // เตะกลับไปหน้า member
        return;
    }

} catch (err) { 
    window.location.replace('index.html'); 
    return; 
}

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            localStorage.removeItem('loginSource');
            window.location.replace('index.html');
        });
    }

    async function getProfileMap() {
        const { data } = await supabaseClient.from('profiles').select('id, full_name, department');
        const map = {};
        if (data) {
            data.forEach(p => map[p.id] = p);
        }
        return map;
    }

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
        } catch (e) { 
            console.error("Widget Error:", e); 
        }
    };

    // ==========================================
    // 2. โหลดรายการรออนุมัติรับเงิน
    // ==========================================
    window.loadPendingDonations = async function() {
        const tbody = document.querySelector('#pending-donations-table tbody');
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('transactions')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบ</td></tr>`; 
                return; 
            }

            const pMap = await getProfileMap();
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
                const uName = pMap[req.created_by]?.full_name || '-';

                return `
                    <tr>
                        <td>${date}</td>
                        <td style="color:${color}; font-weight:500;">${typeLabel}</td>
                        <td>${req.description || '-'}${locationText}<br><small style="color:gray;">ผู้แจ้ง: ${uName}</small></td>
                        <td style="font-weight:bold; color:${color};">฿${parseFloat(req.amount).toLocaleString()}</td>
                        <td>${slipLink}</td>
                        <td>
                            <div style="display:flex; flex-direction:column; gap:5px;">
                                <select id="bank-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;">
                                    <option value="">-- เลือกบัญชี --</option>${bankOpts}
                                </select>
                                <select id="fund-for-${req.id}" style="padding:5px; border-radius:4px; font-size:12px;">
                                    <option value="">-- เลือกกองทุน --</option>${fundOpts}
                                </select>
                                <button onclick="approveDonation('${req.id}', ${req.amount}, '${req.transaction_type}')" class="btn btn-success" style="padding:5px 10px; font-size:12px;">✅ อนุมัติ</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) { 
            console.error(e); 
        }
    };

    window.approveDonation = async function(id, amount, type) {
        const bankId = document.getElementById(`bank-for-${id}`)?.value;
        const fundId = document.getElementById(`fund-for-${id}`)?.value;
        
        if (!bankId || !fundId) { 
            showToast("กรุณาเลือกบัญชีและกองทุนให้ครบ", "warning");
            return; 
        }
        
        if (confirm(`ยืนยันนำรายการ ฿${amount.toLocaleString()} เข้าบัญชีและกองทุน?`)) {
            try {
                // คำนวณค่าที่จะบวกเข้าไป (ถ้าเป็นรายจ่ายให้ส่งค่าติดลบ)
const finalAmount = type === 'expense' ? -parseFloat(amount) : parseFloat(amount);

// ยิงคำสั่งให้ Database บวกเลขให้โดยตรง หมดปัญหาคนกดพร้อมกัน
const { error: bankError } = await supabaseClient.rpc('update_bank_balance', { bank_id: bankId, amount: finalAmount });
if (bankError) throw bankError;

const { error: fundError } = await supabaseClient.rpc('update_fund_balance', { fund_id: fundId, amount: finalAmount });
if (fundError) throw fundError;
                
                await supabaseClient.from('transactions').update({ status: 'approved', bank_account_id: bankId, fund_id: fundId }).eq('id', id);
                
                showToast("อนุมัติเรียบร้อย", "success");
                
                const alertMsg = `✅ อนุมัติรายการเข้าบัญชีแล้ว\n\n💰 ยอดเงิน: ฿${parseFloat(amount).toLocaleString()}\n🏷️ ประเภท: ${type === 'expense' ? 'รายจ่าย' : 'รายรับ/บริจาค'}\n\nระบบบันทึกลงสมุดบัญชีและอัปเดตยอดกองทุนเรียบร้อยแล้วครับ!`;
                if (window.sendLineMessage) window.sendLineMessage(alertMsg);

                window.loadAllAdminData();
            } catch (err) { 
                showToast("เกิดข้อผิดพลาด: " + err.message, "error");
            }
        }
    };

    // ==========================================
    // 3. โหลดคำขอรอตรวจสอบ (เคลียร์บิล)
    // ==========================================
    window.loadPendingRequests = async function() {
        const tbody = document.querySelector('#requests-table tbody');
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('clearances')
                .select('*')
                .in('status', ['pending_advance', 'pending_clearance'])
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">🎉 ไม่มีรายการค้างตรวจสอบ</td></tr>`; 
                return; 
            }

            const pMap = await getProfileMap();

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const amt = req.status === 'pending_advance' ? req.requested_amount : req.total_actual_amount;
                let typeL = '', statL = '', btnL = '';
                
                if (req.status === 'pending_advance') { 
                    typeL = '<span style="color:var(--info); font-weight:bold;">ขอเบิกล่วงหน้า</span>'; 
                    statL = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">รอโอนตั้งต้น</span>'; 
                    btnL = `<button onclick="openModal('${req.id}')" class="btn btn-warning" style="padding:6px 12px; font-size:12px; margin-bottom:5px;">💸 โอนเงิน</button>`;
                } else { 
                    typeL = req.request_type === 'advance' ? '<span style="color:var(--info); font-weight:bold;">เคลียร์บิล (ล่วงหน้า)</span>' : '<span style="color:var(--primary); font-weight:bold;">สำรองจ่าย (เบิกคืน)</span>'; 
                    statL = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">รอตรวจบิล</span>'; 
                    btnL = `<button onclick="openModal('${req.id}')" class="btn btn-info" style="padding:6px 12px; font-size:12px; margin-bottom:5px;">🔍 ตรวจบิล</button>`;
                }
                
                const editBtn = `<button onclick="openEditModal('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; border-color:var(--warning); color:var(--warning); width:100%;">✏️ แก้ไข</button>`;
                
                const deptBadge = req.department && req.department !== '-' ? `<br><small style="color:var(--primary); background:#e0e7ff; padding:2px 6px; border-radius:4px; font-size:11px;">📂 ${req.department}</small>` : '';
                const uName = pMap[req.member_id]?.full_name || '-';

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${uName} ${deptBadge}</td>
                        <td>${typeL}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:bold;">฿${amt.toLocaleString()}</td>
                        <td>${statL}</td>
                        <td>
                            <div style="display:flex; flex-direction:column;">
                                ${btnL}
                                ${editBtn}
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        } catch (e) { 
            console.error(e); 
        }
    };

    // ==========================================
    // 4. ระบบแก้ไขข้อมูล & แอดมินเคลียร์แทน (Edit Modal)
    // ==========================================
    window.openEditModal = async function(id) {
        document.getElementById('edit-req-modal').style.display = 'flex';
        document.getElementById('edit-msg').textContent = 'กำลังโหลดข้อมูล...';
        document.getElementById('edit-items-tbody').innerHTML = '';
        
        try {
            const { data: c } = await supabaseClient.from('clearances').select('*').eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            document.getElementById('edit-req-id').value = c.id;
            document.getElementById('edit-req-type').value = c.request_type;
            
            const deptSelect = document.getElementById('edit-req-dept');
            if (c.department && c.department !== '-') deptSelect.value = c.department;
            
            document.getElementById('edit-req-purpose').value = c.purpose;
            document.getElementById('edit-req-reason').value = ''; 
            
            const advSec = document.getElementById('edit-advance-section');
            const amtInput = document.getElementById('edit-req-amount');
            
            if (c.request_type === 'advance' && c.status === 'pending_advance') {
                advSec.style.display = 'block'; 
                amtInput.value = c.requested_amount; 
                document.getElementById('edit-items-section').style.display = 'none';
            } else {
                advSec.style.display = 'none'; 
                document.getElementById('edit-items-section').style.display = 'block';
                
                const tbody = document.getElementById('edit-items-tbody');
                if (items && items.length > 0) {
                    items.forEach(it => {
                        const tr = document.createElement('tr');
                        // จัดการหลีกเลี่ยงเครื่องหมายคำพูดในชื่อ
                        let safeName = it.item_name.replace(/"/g, '&quot;');
                        tr.innerHTML = `
                            <td><input type="hidden" class="edit-item-id" value="${it.id}">
                            <input type="text" class="edit-item-name" value="${safeName}" style="width:100%; padding:5px;" required></td>
                            <td><input type="number" class="edit-item-qty" min="1" value="${it.quantity}" style="width:100%; padding:5px; text-align:center;" required></td>
                            <td><input type="number" class="edit-item-price" min="0" step="0.01" value="${it.total_price}" style="width:100%; padding:5px; text-align:right;" required></td>
                            <td style="text-align: center;"><button type="button" class="btn btn-danger edit-del-btn" style="padding: 4px 8px; font-size: 11px;">ลบ</button></td>
                        `;
                        tbody.appendChild(tr);
                        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', window.calculateEditTotal));
                        tr.querySelector('.edit-del-btn')?.addEventListener('click', () => { tr.remove(); window.calculateEditTotal(); });
                    });
                }
            }
            window.calculateEditTotal(); 
            document.getElementById('edit-msg').textContent = '';
        } catch (err) { 
            document.getElementById('edit-msg').innerHTML = `<span style="color:red;">โหลดข้อมูลไม่สำเร็จ: ${err.message}</span>`; 
        }
    };

    window.closeEditModal = function() {
        const isSub = document.getElementById('edit-is-substitute'); 
        if (isSub) isSub.value = 'false';
        
        const fileSec = document.getElementById('substitute-file-section'); 
        if (fileSec) fileSec.style.display = 'none';
        
        const reasonCont = document.getElementById('edit-reason-container'); 
        if (reasonCont) reasonCont.style.display = 'block';
        
        const title = document.querySelector('#edit-req-modal h3'); 
        if (title) title.innerHTML = '✏️ แก้ไขข้อมูลคำขอเบิกเงิน';
        
        const btn = document.getElementById('save-edit-btn'); 
        if (btn) { btn.innerHTML = '💾 บันทึกการแก้ไข'; btn.className = 'btn btn-warning'; }
        
        const stmt = document.getElementById('substitute-statement'); 
        if (stmt) stmt.value = '';
        const retSlip = document.getElementById('substitute-return-slip'); 
        if (retSlip) retSlip.value = '';
        
        document.getElementById('edit-req-modal').style.display = 'none';
    };

    window.calculateEditTotal = function() {
    let total = 0; 
    document.querySelectorAll('.edit-item-price').forEach(inp => { 
        total += parseFloat(inp.value) || 0; 
    });
    // ✅ เพิ่มบรรทัดนี้เพื่อปัดเศษ
    total = Math.round(total * 100) / 100;
    document.getElementById('edit-total-actual').textContent = total.toLocaleString();
};

    document.getElementById('edit-add-item-btn')?.addEventListener('click', () => {
        const tbody = document.getElementById('edit-items-tbody'); 
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="hidden" class="edit-item-id" value="new">
            <input type="text" class="edit-item-name" placeholder="ชื่อรายการ" style="width:100%; padding:5px;" required></td>
            <td><input type="number" class="edit-item-qty" min="1" value="1" style="width:100%; padding:5px; text-align:center;" required></td>
            <td><input type="number" class="edit-item-price" min="0" step="0.01" value="0" style="width:100%; padding:5px; text-align:right;" required></td>
            <td style="text-align: center;"><button type="button" class="btn btn-danger edit-del-btn" style="padding: 4px 8px; font-size: 11px;">ลบ</button></td>
        `;
        tbody.appendChild(tr); 
        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', window.calculateEditTotal));
        tr.querySelector('.edit-del-btn')?.addEventListener('click', () => { tr.remove(); window.calculateEditTotal(); });
    });

    const editForm = document.getElementById('edit-req-form');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-edit-btn'); 
            const msg = document.getElementById('edit-msg'); 
            btn.disabled = true;
            
            if (msg) { 
                msg.style.color = 'var(--primary)'; 
                msg.textContent = 'กำลังบันทึกข้อมูลและประวัติ...'; 
            }

            const reqId = document.getElementById('edit-req-id').value; 
            const reqType = document.getElementById('edit-req-type').value;
            const dept = document.getElementById('edit-req-dept').value; 
            const purpose = document.getElementById('edit-req-purpose').value;
            const reason = document.getElementById('edit-req-reason').value; 
            const isSubstitute = document.getElementById('edit-is-substitute')?.value === 'true';

            try {
                const { data: oldData } = await supabaseClient.from('clearances').select('*').eq('id', reqId).single();
                let updatePayload = { department: dept, purpose: purpose }; 
                let logDetails = `แก้ไขฝ่ายเป็น ${dept}, หัวข้อเป็น ${purpose}`;

                if (reqType === 'advance' && oldData.status === 'pending_advance' && !isSubstitute) {
                    const newAmt = parseFloat(document.getElementById('edit-req-amount').value); 
                    updatePayload.requested_amount = newAmt;
                    logDetails += `, แก้ไขยอดเงินล่วงหน้าจาก ${oldData.requested_amount} เป็น ${newAmt}`;
                } else {
                    let newTotalActual = 0; 
                    const currentItems = [];
                    document.querySelectorAll('#edit-items-tbody tr').forEach(tr => {
                        const name = tr.querySelector('.edit-item-name').value;
                        const qty = parseFloat(tr.querySelector('.edit-item-qty').value);
                        const price = parseFloat(tr.querySelector('.edit-item-price').value);
                        if (name) { 
                            newTotalActual += price; 
                            currentItems.push({ clearance_id: reqId, item_name: name, quantity: qty, total_price: price }); 
                        }
                    });
                    
                    updatePayload.total_actual_amount = newTotalActual; 
                    logDetails += `, แก้ไขยอดรวมบิลเป็น ${newTotalActual} บาท`;
                    
                    await supabaseClient.from('clearance_items').delete().eq('clearance_id', reqId);
                    if (currentItems.length > 0) {
                        await supabaseClient.from('clearance_items').insert(currentItems);
                    }
                }

                if (isSubstitute) {
                    const sFile = document.getElementById('substitute-statement')?.files[0]; 
                    const rFile = document.getElementById('substitute-return-slip')?.files[0];
                    
                    if (!sFile) throw new Error("กรุณาแนบใบเสร็จหรือ Statement");
                    
                    if (msg) msg.textContent = 'กำลังอัปโหลดไฟล์หลักฐาน...'; 
                    let sUrl = null, rUrl = null;
                    
                    const path1 = `statement-${Date.now()}.${sFile.name.split('.').pop()}`; 
                    await supabaseClient.storage.from('receipts').upload(path1, sFile); 
                    sUrl = supabaseClient.storage.from('receipts').getPublicUrl(path1).data.publicUrl;
                    
                    if (rFile) { 
                        const path2 = `return-${Date.now()}.${rFile.name.split('.').pop()}`; 
                        await supabaseClient.storage.from('slips').upload(path2, rFile); 
                        rUrl = supabaseClient.storage.from('slips').getPublicUrl(path2).data.publicUrl; 
                    }
                    
                    updatePayload.statement_url = sUrl; 
                    if (rUrl) updatePayload.member_return_slip = rUrl; 
                    updatePayload.status = 'pending_clearance'; 
                }

                if (msg) msg.textContent = 'กำลังอัปเดตฐานข้อมูล...';
                await supabaseClient.from('clearances').update(updatePayload).eq('id', reqId);
                
                await supabaseClient.from('audit_logs').insert([{ 
                    clearance_id: reqId, 
                    admin_id: currentUser.id, 
                    action_type: isSubstitute ? 'substitute_clearance' : 'admin_edit', 
                    old_value: `ฝ่าย: ${oldData.department||'-'}, หัวข้อ: ${oldData.purpose}`, 
                    new_value: logDetails, 
                    edit_reason: reason 
                }]);

                if (msg) { 
                    msg.style.color = 'var(--success)'; 
                    msg.innerHTML = isSubstitute ? '✅ ส่งเคลียร์บิลแทนเรียบร้อย!' : '✅ บันทึกการแก้ไขสำเร็จ!'; 
                }
                
                setTimeout(() => { 
                    window.closeEditModal(); 
                    window.loadPendingRequests(); 
                    window.loadClearanceHistory(); 
                    if (typeof window.loadAuditLogs === 'function') window.loadAuditLogs(); 
                }, 1500);

            } catch (err) { 
                if (msg) msg.innerHTML = `<span style="color:red;">ผิดพลาด: ${err.message}</span>`; 
            } finally { 
                btn.disabled = false; 
            }
        });
    }

    window.openSubstituteClearance = async function(id) {
        await window.openEditModal(id); 
        document.getElementById('edit-is-substitute').value = 'true'; 
        document.querySelector('#edit-req-modal h3').innerHTML = '👑 เคลียร์บิลแทนผู้เบิก';
        document.getElementById('substitute-file-section').style.display = 'block'; 
        document.getElementById('edit-req-reason').value = 'แอดมินทำการเคลียร์บิลแทนผู้เบิก (Substitute Clearance)';
        document.getElementById('edit-reason-container').style.display = 'none';
        
        const btn = document.getElementById('save-edit-btn'); 
        if (btn) { 
            btn.innerHTML = '🚀 ส่งบิลเคลียร์เงิน (แทน Member)'; 
            btn.className = 'btn btn-primary'; 
        }
    };

    // ==========================================
    // 5. ระบบ Modal อนุมัติโอนเงิน (action-modal)
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
            const previewDiv = document.getElementById('modal-statement-preview');
            
            if (targetImg) {
                previewDiv.style.display = 'block'; 
                document.getElementById('modal-no-statement').style.display = 'none';
                
                let pwdText = c.statement_password ? `<div style="color:var(--danger); font-size:13px; font-weight:bold; margin-top:8px; padding:6px; background:#fee2e2; border-radius:6px;">🔑 รหัสผ่านไฟล์: ${c.statement_password}</div>` : '';
                
                if (targetImg.toLowerCase().includes('.pdf')) { 
                    previewDiv.innerHTML = `<label style="color: var(--text-muted); display: block; margin-bottom: 10px;">📎 ไฟล์หลักฐาน / Statement</label><a href="${targetImg}" target="_blank" class="btn btn-info" style="display:block; width:100%; text-align:center; padding:10px; box-sizing:border-box; text-decoration:none;">📄 คลิกเพื่อเปิดดูไฟล์ PDF</a>${pwdText}`; 
                } else { 
                    previewDiv.innerHTML = `<label style="color: var(--text-muted); display: block; margin-bottom: 10px;">📎 ภาพหลักฐาน / Statement</label><img src="${targetImg}" style="max-width: 100%; max-height: 250px; border-radius: 6px; cursor: pointer; border: 1px solid #ccc;" onclick="window.open(this.src, '_blank')">${pwdText}`; 
                }
            } else { 
                previewDiv.style.display = 'none'; 
                document.getElementById('modal-no-statement').style.display = 'block'; 
            }

            const iTbody = document.getElementById('modal-items-tbody');
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
                        </tr>
                    `).join('');
                    document.querySelectorAll('.admin-edit-price').forEach(inp => inp.addEventListener('input', window.recalculateAdminTotal));
                } else { 
                    document.getElementById('modal-items-section').style.display = 'none'; 
                }
            }

            const { data: bList } = await supabaseClient.from('bank_accounts').select('*'); 
            const { data: fList } = await supabaseClient.from('funds').select('*');
            
            const bankSel = document.getElementById('admin-bank-select');
            const fundSel = document.getElementById('admin-fund-select');
            if(bankSel) bankSel.innerHTML = '<option value="">-- เลือกบัญชี --</option>' + (bList||[]).map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('');
            if(fundSel) fundSel.innerHTML = '<option value="">-- เลือกกองทุน --</option>' + (fList||[]).map(f => `<option value="${f.id}">${f.fund_name}</option>`).join('');

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

    window.recalculateAdminTotal = function() {
        const c = window.currentClearance; 
        if(!c) return;
        
        let totalAppr = 0, isEdited = false;

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
            } else {
                totalAppr = c.total_actual_amount;
            }
        }
        totalAppr = Math.round(totalAppr * 100) / 100;

        if(document.getElementById('modal-diff-warning')) document.getElementById('modal-diff-warning').style.display = isEdited ? 'block' : 'none';
        if(document.getElementById('modal-recalc-total')) document.getElementById('modal-recalc-total').textContent = totalAppr.toLocaleString();

        let processAmt = 0, actionDir = 'none';
        
        if (c.status === 'pending_advance') { 
            processAmt = totalAppr; 
            actionDir = 'pay'; 
        } else if (c.status === 'pending_clearance') {
            if (c.request_type === 'advance') {
                const diff = c.requested_amount - totalAppr; 
                processAmt = Math.abs(diff);
                if (diff > 0) actionDir = 'receive'; 
                else if (diff < 0) actionDir = 'pay'; 
                else actionDir = 'none';
            } else { 
                processAmt = totalAppr; 
                actionDir = 'pay'; 
            }
        }

        const amtP = document.getElementById('modal-amount-display');
        const title = document.getElementById('modal-title');
        const slipSec = document.getElementById('admin-slip-section');
        const bankSel = document.getElementById('admin-bank-select');
        const fundSel = document.getElementById('admin-fund-select');
        const bankFundWrapper = document.getElementById('admin-bank-fund-wrapper');
        const bankDiv = document.getElementById('modal-member-bank');
        const bankText = document.getElementById('modal-bank-text');

        if (bankSel) bankSel.required = false;
        if (fundSel) fundSel.required = false;

        if(bankDiv && bankText) {
            if(actionDir === 'pay' && c.member_bank_details) { 
                bankDiv.style.display = 'block'; 
                bankText.textContent = c.member_bank_details; 
            } else { 
                bankDiv.style.display = 'none'; 
            }
        }
        
        if (actionDir === 'pay') { 
            if(amtP) amtP.innerHTML = `💸 ชุมนุมต้องโอนจ่าย: <strong style="color:var(--danger); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; 
            if(title) title.textContent = c.status === 'pending_advance' ? '💸 ยืนยันโอนเงินตั้งต้น (Advance)' : '💸 ยืนยันการโอนเงินออก'; 
            if(slipSec) slipSec.style.display = 'block'; 
            if(bankFundWrapper) bankFundWrapper.style.display = 'flex';
            if (bankSel) bankSel.required = true;
            if (fundSel) fundSel.required = true;
        } 
        else if (actionDir === 'receive') { 
            if(amtP) amtP.innerHTML = `📥 ชุมนุมได้รับเงินทอน: <strong style="color:var(--success); font-size:20px;">${processAmt.toLocaleString()}</strong> บาท`; 
            if(title) title.textContent = '📥 ยืนยันรับเงินทอนเคลียร์บิล'; 
            if(slipSec) slipSec.style.display = 'none';  
            if(bankFundWrapper) bankFundWrapper.style.display = 'flex'; 
            if (bankSel) bankSel.required = true;
            if (fundSel) fundSel.required = true;
        } 
        else { 
            if(amtP) amtP.innerHTML = `✅ <strong style="color:gray; font-size:20px;">บิลพอดี (ไม่ต้องโอนเงินเพิ่ม)</strong>`; 
            if(title) title.textContent = '✅ อนุมัติเคลียร์บิล'; 
            if(slipSec) slipSec.style.display = 'none'; 
            if(bankFundWrapper) bankFundWrapper.style.display = 'none'; 
        }

        if(document.getElementById('modal-req-amount')) document.getElementById('modal-req-amount').value = processAmt;
        if(document.getElementById('modal-final-total')) document.getElementById('modal-final-total').value = totalAppr;
        if(document.getElementById('modal-action-dir')) document.getElementById('modal-action-dir').value = actionDir;
    };

    const modalForm = document.getElementById('admin-action-form');
    if (modalForm) {
        // ==========================================
    // 🌟 ระบบประมวลผลคำขอ (V9.3: อนุมัติ / ตีกลับ / ปฏิเสธ)
    // ==========================================
    window.processAdminAction = async function(actionType) {
        const modalForm = document.getElementById('admin-action-form');
        if (modalForm.dataset.submitting === 'true') return;
        modalForm.dataset.submitting = 'true';

        const msg = document.getElementById('modal-msg');
        const reqId = document.getElementById('modal-req-id')?.value;
        const finalTotal = parseFloat(document.getElementById('modal-final-total')?.value);
        const processAmt = parseFloat(document.getElementById('modal-req-amount')?.value);
        const actionDir = document.getElementById('modal-action-dir')?.value;
        const bankId = document.getElementById('admin-bank-select')?.value;
        const fundId = document.getElementById('admin-fund-select')?.value;
        const slipFile = document.getElementById('admin-slip')?.files[0];
        const adminNote = document.getElementById('admin-note-input')?.value.trim();

        const btnApprove = document.getElementById('btn-admin-approve');
        const btnReturn = document.getElementById('btn-admin-return');
        const btnReject = document.getElementById('btn-admin-reject');

        if(btnApprove) btnApprove.disabled = true;
        if(btnReturn) btnReturn.disabled = true;
        if(btnReject) btnReject.disabled = true;

        try {
            // 1. ตรวจสอบเงื่อนไข
            if (actionType === 'approve') {
                if (actionDir === 'pay' && processAmt > 0 && !slipFile) {
                    throw new Error('กรุณาแนบสลิปโอนเงินจ่าย สำหรับการอนุมัติ');
                }
            } else if (actionType === 'return' || actionType === 'reject') {
                if (!adminNote) {
                    throw new Error('กรุณาระบุ "เหตุผล / หมายเหตุ" ให้ Member ทราบ');
                }
            }

            if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังประมวลผล...'; }

            // 2. อัปเดตราคาในตาราง items ย่อยก่อนเสมอ (กรณีแอดมินแก้ตัวเลข)
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

            let upData = {};

            // 3. แยกการทำงานตาม Action
            if (actionType === 'approve') {
                let aSlipUrl = null;
                if (slipFile) {
                    const p = `admin-slip-${Date.now()}.${slipFile.name.split('.').pop()}`;
                    await supabaseClient.storage.from('slips').upload(p, slipFile);
                    aSlipUrl = supabaseClient.storage.from('slips').getPublicUrl(p).data.publicUrl;
                }

                if (actionDir !== 'none' && processAmt > 0) {
                    const finalAmount = actionDir === 'pay' ? -processAmt : processAmt;
                    await supabaseClient.rpc('update_bank_balance', { bank_id: bankId, amount: finalAmount });
                    await supabaseClient.rpc('update_fund_balance', { fund_id: fundId, amount: finalAmount });

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
                        department: window.currentClearance.department || '-',
                        clearance_id: reqId,
                        created_by: currentUser.id
                    }]);
                }

                upData.status = window.currentClearance.status === 'pending_advance' ? 'advance_transferred' : 'cleared';
                upData.total_actual_amount = finalTotal;
                if (aSlipUrl) upData.admin_transfer_slip = aSlipUrl;
                upData.admin_note = null; // ล้างโน้ตถ้าอนุมัติผ่าน

                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ อนุมัติสำเร็จ'; }

            } else if (actionType === 'return') {
                upData.status = 'returned_for_edit';
                upData.admin_note = adminNote;
                upData.total_actual_amount = finalTotal; // บันทึกยอดที่แอดมินแก้ไข
                if(msg) { msg.style.color = 'var(--warning)'; msg.textContent = '🔙 ตีกลับให้ Member แก้ไขสำเร็จ'; }
                
            } else if (actionType === 'reject') {
                upData.status = 'rejected';
                upData.admin_note = adminNote;
                if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = '❌ ปฏิเสธคำขอสำเร็จ'; }
            }

            await supabaseClient.from('clearances').update(upData).eq('id', reqId);

            // 4. ส่งแจ้งเตือน LINE
            const reqPurpose = window.currentClearance?.purpose || '-';
            let alertMsg = '';
            if (actionType === 'approve') {
                const actionText = upData.status === 'advance_transferred' ? '💸 แอดมินโอนเงินล่วงหน้าให้แล้ว' : '✅ แอดมินอนุมัติเคลียร์บิลสำเร็จ';
                alertMsg = `${actionText}\n\n📌 หัวข้อ: ${reqPurpose}\n💰 ยอดอนุมัติ: ฿${finalTotal.toLocaleString()}`;
            } else if (actionType === 'return') {
                alertMsg = `⚠️ แอดมินตีกลับคำขอ (รอการยืนยัน/แก้ไข)\n\n📌 หัวข้อ: ${reqPurpose}\n💬 เหตุผล: ${adminNote}\n\nกรุณาเข้าสู่ระบบเพื่อตรวจสอบและยืนยันยอดใหม่`;
            } else if (actionType === 'reject') {
                alertMsg = `❌ แอดมินปฏิเสธคำขอ\n\n📌 หัวข้อ: ${reqPurpose}\n💬 เหตุผล: ${adminNote}`;
            }
            if (window.sendLineMessage && alertMsg) window.sendLineMessage(alertMsg);

            setTimeout(() => { window.closeModal(); window.loadAllAdminData(); }, 2000);

        } catch (err) {
            if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = '❌ ผิดพลาด: ' + err.message; }
        } finally {
            if(btnApprove) btnApprove.disabled = false;
            if(btnReturn) btnReturn.disabled = false;
            if(btnReject) btnReject.disabled = false;
            modalForm.dataset.submitting = 'false';
        }
    };

    // ผูกปุ่มเข้ากับฟังก์ชัน
    document.getElementById('btn-admin-approve')?.addEventListener('click', () => window.processAdminAction('approve'));
    document.getElementById('btn-admin-return')?.addEventListener('click', () => window.processAdminAction('return'));
    document.getElementById('btn-admin-reject')?.addEventListener('click', () => window.processAdminAction('reject'));
    }
    // ==========================================
    // 6. สมุดบัญชีรายรับ-รายจ่าย (Ledger)
    // ==========================================
    window.loadLedger = async function() {
        try {
            const { data: bList } = await supabaseClient.from('bank_accounts').select('*');
            const { data: fList } = await supabaseClient.from('funds').select('*');
            
            if(document.getElementById('direct-bank')) {
                document.getElementById('direct-bank').innerHTML = '<option value="">-- เลือกบัญชี --</option>' + (bList||[]).map(b=>`<option value="${b.id}">${b.bank_name}</option>`).join('');
            }
            if(document.getElementById('direct-fund')) {
                document.getElementById('direct-fund').innerHTML = '<option value="">-- เลือกกองทุน --</option>' + (fList||[]).map(f=>`<option value="${f.id}">${f.fund_name}</option>`).join('');
            }
        } catch(e) {}

        const tbody = document.querySelector('#ledger-table tbody');
        if (!tbody) return;
        
        try {
            const selectedDept = document.getElementById('filter-dept')?.value;
            let query = supabaseClient.from('transactions').select(`*`).eq('status', 'approved').order('created_at', { ascending: false });
            if (selectedDept) query = query.eq('department', selectedDept);
            
            const { data, error } = await query;
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:gray;">ยังไม่มีประวัติในสมุดบัญชี ${selectedDept ? 'สำหรับฝ่ายนี้' : ''}</td></tr>`; 
                return; 
            }

            const pMap = await getProfileMap();
            const { data: bData } = await supabaseClient.from('bank_accounts').select('id, bank_name');
            const { data: fData } = await supabaseClient.from('funds').select('id, fund_name');
            const bankMap = {}, fundMap = {};
            if(bData) bData.forEach(b => bankMap[b.id] = b.bank_name);
            if(fData) fData.forEach(f => fundMap[f.id] = f.fund_name);

            tbody.innerHTML = data.map(tx => {
                const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
                const amt = parseFloat(tx.amount) || 0;
                let inc = '-', exp = '-';
                
                if (tx.transaction_type === 'expense') { 
                    exp = `<span style="color:var(--danger); font-weight:bold;">฿${amt.toLocaleString()}</span>`; 
                } else { 
                    inc = `<span style="color:var(--success); font-weight:bold;">฿${amt.toLocaleString()}</span>`; 
                }
                
                const deptLabel = tx.department && tx.department !== '-' ? `<span style="color:var(--primary); background:#e0e7ff; padding:2px 6px; border-radius:4px; font-size:11px;">📂 ${tx.department}</span>` : '<span style="color:gray; font-size:11px;">ส่วนกลาง</span>';

                return `
                    <tr>
                        <td>${date}</td>
                        <td style="text-align:center;">${deptLabel}</td>
                        <td>${tx.description || '-'}${tx.location ? ` (ส: ${tx.location})` : ''}</td>
                        <td style="font-size:12px; color:gray;">🏦 ${bankMap[tx.bank_account_id]||'-'}<br>💼 ${fundMap[tx.fund_id]||'-'}</td>
                        <td style="text-align:right; background:#f0fdf4;">${inc}</td>
                        <td style="text-align:right; background:#fef2f2;">${exp}</td>
                        <td style="font-size:13px; color:var(--text-muted);">${pMap[tx.created_by]?.full_name || 'ระบบ / แอดมิน'}</td>
                        <td style="text-align:center;"><button onclick="viewTransaction('${tx.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">🔍 ดูสลิป</button></td>
                    </tr>
                `;
            }).join('');
        } catch (e) { 
            console.error(e); 
        }
    };

    const directForm = document.getElementById('direct-transaction-form');
    if (directForm) {
        directForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 🚨 ป้องกันการกดเบิ้ล
            if (directForm.dataset.submitting === 'true') return;
            directForm.dataset.submitting = 'true';

            const msg = document.getElementById('direct-msg');
            const subBtn = directForm.querySelector('button');
            if(subBtn) subBtn.disabled = true;
            
            if(msg) { msg.style.color = 'var(--info)'; msg.textContent = 'กำลังบันทึก...'; }
            
            try {
                const type = document.getElementById('direct-type').value;
                const desc = document.getElementById('direct-desc').value;
                const amt = parseFloat(document.getElementById('direct-amount').value);
                const bankId = document.getElementById('direct-bank').value;
                const fundId = document.getElementById('direct-fund').value;
                
                const finalAmount = type === 'income' ? amt : -amt;
                await supabaseClient.rpc('update_bank_balance', { bank_id: bankId, amount: finalAmount });
                await supabaseClient.rpc('update_fund_balance', { fund_id: fundId, amount: finalAmount });
                
                await supabaseClient.from('transactions').insert([{ 
                    transaction_date: new Date().toISOString().split('T')[0], 
                    transaction_type: type, 
                    description: desc, 
                    amount: amt, 
                    bank_account_id: bankId, 
                    fund_id: fundId, 
                    status: 'approved', 
                    department: 'ส่วนกลาง', 
                    created_by: currentUser.id 
                }]);
                
                if(msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ บันทึกลงสมุดบัญชีแล้ว'; }
                directForm.reset(); 
                window.loadAllAdminData();
                setTimeout(()=> { if(msg) msg.textContent = ''; }, 3000);
            } catch (err) { 
                if(msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; } 
            } finally { 
                if(subBtn) subBtn.disabled = false; 
                // 🚨 ปลดล็อกคิว
                directForm.dataset.submitting = 'false';
            }
        });
    }

    // ==========================================
    // 7. โหลดประวัติคำขอเบิกเงินทั้งหมด (Admin)
    // ==========================================
    window.loadClearanceHistory = async function() {
        const tbody = document.querySelector('#clearance-history-table tbody');
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('clearances').select('*').order('created_at', { ascending: false }); 
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:gray;">ไม่มีประวัติ</td></tr>`; 
                return; 
            }

            const pMap = await getProfileMap();

            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const name = pMap[req.member_id]?.full_name || 'Unknown';
                const typeLabel = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย';
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                
                let stat = '';
                let btn = `<button type="button" onclick="viewClearance('${req.id}')" class="btn btn-info" style="padding:4px 8px; font-size:12px; width:100%;">🔍 ดูบิลย่อย</button>`;

                if (req.status === 'draft') stat = '<span class="status-badge" style="background:#e2e8f0; color:#475569;">📝 ร่าง</span>';
                else if (req.status === 'pending_advance') stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอโอนตั้งต้น</span>';
                else if (req.status === 'pending_clearance') stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอตรวจบิล</span>';
                else if (req.status === 'advance_transferred') { 
                    stat = '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">💸 รอ Member เคลียร์</span>'; 
                    btn = `
                        <div style="display:flex; gap:5px; justify-content:center; flex-direction:column;">
                            <button type="button" onclick="viewClearance('${req.id}')" class="btn btn-info" style="padding:4px 8px; font-size:12px;">🔍 ดู</button>
                            <button type="button" onclick="openSubstituteClearance('${req.id}')" class="btn btn-warning" style="padding:4px 8px; font-size:12px; color:white;">📝 เคลียร์แทน</button>
                        </div>
                    `; 
                }
                else if (req.status === 'cleared') stat = '<span class="status-badge" style="background:#d1fae5; color:#059669;">✅ อนุมัติเคลียร์แล้ว</span>';
                else if (req.status === 'cancelled') stat = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">❌ ยกเลิก/ไม่อนุมัติ</span>';

                const cwBtn = `<button type="button" onclick="openCoWorkerModal('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; display:block; margin-top:5px; width:100%; border-color:var(--primary); color:var(--primary);">👥 จัดการ Co-Worker</button>`;

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${name}</td>
                        <td>${typeLabel}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:600;">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td style="text-align:center;">
                            <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
                                ${btn}
                                ${cwBtn}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch(e) { 
            console.error(e); 
        }
    };

    // ==========================================
    // 8. โหลดตารางประวัติแก้ไข (Audit Log)
    // ==========================================
    window.loadAuditLogs = async function() {
        const tbody = document.querySelector('#audit-log-table tbody');
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:gray;">ไม่มีประวัติการแก้ไข / ยกเลิก</td></tr>`; 
                return; 
            }

            const pMap = await getProfileMap();
            const { data: cData } = await supabaseClient.from('clearances').select('id, purpose');
            const cMap = {};
            if(cData) cData.forEach(c => cMap[c.id] = c.purpose);

            tbody.innerHTML = data.map(log => {
                const date = new Date(log.created_at).toLocaleString('th-TH');
                const adminName = pMap[log.admin_id]?.full_name || 'Admin';
                const purpose = cMap[log.clearance_id] || 'บิลถูกลบไปแล้ว';
                
                let actionBadge = '';
                if (log.action_type === 'reject_clearance') actionBadge = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">❌ ยกเลิกบิล</span>';
                else if (log.action_type === 'return_clearance') actionBadge = '<span class="status-badge" style="background:#ffedd5; color:#b45309;">🔙 ตีกลับบิล</span>';
                else if (log.action_type === 'substitute_clearance') actionBadge = '<span class="status-badge" style="background:#e0e7ff; color:#4f46e5;">👑 เคลียร์แทน</span>';
                else actionBadge = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">✏️ แก้ไขข้อมูล</span>';

                return `
                    <tr>
                        <td style="font-size:12px;">${date}</td>
                        <td style="font-weight:bold;">${adminName}</td>
                        <td>${actionBadge}</td>
                        <td>${purpose}</td>
                        <td style="color:var(--danger); font-weight:500;">${log.edit_reason || '-'}</td>
                        <td style="font-size:12px; color:gray;">${log.new_value || '-'}</td>
                    </tr>
                `;
            }).join('');
        } catch (e) { 
            console.error(e); 
        }
    };

    // ==========================================
    // 🌟 ระบบจัดการ Co-Worker (Admin)
    // ==========================================
    window.openCoWorkerModal = async function(id) {
        document.getElementById('coworker-modal').style.display = 'flex'; 
        document.getElementById('cw-edit-id').value = id; 
        const listDiv = document.getElementById('cw-edit-list'); 
        listDiv.innerHTML = '⏳ กำลังโหลด...';
        
        try {
            const { data: c } = await supabaseClient.from('clearances').select('co_worker_ids, member_id').eq('id', id).single();
            const existingIds = c.co_worker_ids || [];
            const { data: users } = await supabaseClient.from('profiles').select('id, full_name, department').eq('status', 'approved').neq('id', c.member_id);
            
            listDiv.innerHTML = '';
            if (users && users.length > 0) {
                users.forEach(user => {
                    const isChecked = existingIds.includes(user.id) ? 'checked' : '';
                    const lbl = document.createElement('label'); 
                    lbl.style.display = 'block'; 
                    lbl.style.marginBottom = '8px'; 
                    lbl.style.cursor = 'pointer'; 
                    lbl.style.padding = '8px'; 
                    lbl.style.background = 'white'; 
                    lbl.style.border = '1px solid #e2e8f0'; 
                    lbl.style.borderRadius = '6px';
                    
                    lbl.innerHTML = `
                        <input type="checkbox" class="cw-quick-cb" value="${user.id}" ${isChecked} style="margin-right:8px; transform: scale(1.2);"> 
                        <strong>${user.full_name}</strong> 
                        <span style="color:gray; font-size:12px;">(${user.department || '-'})</span>
                    `;
                    listDiv.appendChild(lbl);
                });
            } else { 
                listDiv.innerHTML = '<span style="color:gray; font-size:13px;">ไม่มีรายชื่อผู้ใช้งานคนอื่นในระบบ</span>'; 
            }
        } catch(e) { 
            listDiv.innerHTML = '❌ โหลดข้อมูลไม่สำเร็จ'; 
        }
    };

    window.saveCoWorkersQuick = async function() {
        const id = document.getElementById('cw-edit-id').value; 
        const coWorkerIds = []; 
        document.querySelectorAll('.cw-quick-cb:checked').forEach(cb => coWorkerIds.push(cb.value));
        
        const btn = document.querySelector('#coworker-modal .btn-primary'); 
        btn.disabled = true; 
        btn.textContent = 'กำลังบันทึก...';
        
        try {
            await supabaseClient.from('clearances').update({ co_worker_ids: coWorkerIds }).eq('id', id);
            showToast("อัปเดตรายชื่อ Co-Worker สำเร็จ","success"); 
            document.getElementById('coworker-modal').style.display = 'none'; 
            window.loadClearanceHistory(); 
            window.loadPendingRequests(); 
        } catch(e) { 
            showToast("เกิดข้อผิดพลาด: " + e.message, "error"); 
        } finally { 
            btn.disabled = false; 
            btn.textContent = '💾 บันทึกรายชื่อ'; 
        }
    };

    // ==========================================
    // 9. ตั้งค่าระบบ 
    // ==========================================
    window.loadSettingsData = async function() {
        const { data: banks } = await supabaseClient.from('bank_accounts').select('*'); 
        const bTbody = document.querySelector('#manage-bank-table tbody'); 
        if(bTbody) {
            bTbody.innerHTML = banks.map(b => `<tr><td>${b.bank_name}</td><td>฿${b.balance.toLocaleString()}</td><td style="text-align:center;"><button onclick="deleteBank('${b.id}')" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button></td></tr>`).join('');
        }

        const { data: funds } = await supabaseClient.from('funds').select('*'); 
        const fTbody = document.querySelector('#manage-fund-table tbody'); 
        if(fTbody) {
            fTbody.innerHTML = funds.map(f => `<tr><td>${f.fund_name}</td><td>฿${f.remaining_budget.toLocaleString()}</td><td style="text-align:center;"><button onclick="deleteFund('${f.id}')" style="background:none; border:none; color:red; cursor:pointer;">🗑️</button></td></tr>`).join('');
        }
    };

    window.addBank = async function() {
        const name = document.getElementById('add-bank-name').value; 
        const bal = parseFloat(document.getElementById('add-bank-bal').value);
        if(!name || isNaN(bal)) return showToast("กรุณากรอกข้อมูลให้ครบ", "warning");
        
        const subBtn = event.target; 
        subBtn.disabled = true; 
        subBtn.textContent = "กำลังเพิ่ม...";
        
        try { 
            await supabaseClient.from('bank_accounts').insert([{ bank_name: name, balance: bal }]); 
            document.getElementById('add-bank-name').value = ''; 
            document.getElementById('add-bank-bal').value = ''; 
            showToast("เพิ่มบัญชีสำเร็จ!", "success"); 
            window.loadAllAdminData(); 
        } catch (err) { 
            showToast("ไม่สามารถเพิ่มบัญชีได้: " + err.message, "error"); 
        } finally { 
            subBtn.disabled = false; 
            subBtn.textContent = "+ เพิ่มบัญชี"; 
        }
    };

    window.deleteBank = async function(id) { 
        if(confirm("ยืนยันการลบบัญชีนี้?")) { 
            try { 
                await supabaseClient.from('bank_accounts').delete().eq('id', id); 
                window.loadAllAdminData(); 
            } catch (err) { 
                showToast("ไม่สามารถลบได้: " + err.message, "error"); 
            } 
        } 
    };

    window.addFund = async function() {
        const name = document.getElementById('add-fund-name').value; 
        const bal = parseFloat(document.getElementById('add-fund-bal').value);
        if(!name || isNaN(bal)) return showToast("กรุณากรอกข้อมูลให้ครบ", "warning");
        
        const subBtn = event.target; 
        subBtn.disabled = true; 
        subBtn.textContent = "กำลังเพิ่ม...";
        
        try { 
            await supabaseClient.from('funds').insert([{ fund_name: name, remaining_budget: bal }]); 
            document.getElementById('add-fund-name').value = ''; 
            document.getElementById('add-fund-bal').value = ''; 
            showToast("เพิ่มกองทุนสำเร็จ", "success"); 
            window.loadAllAdminData(); 
        } catch (err) { 
            showToast("ไม่สามารถเพิ่มกองทุนได้: " + err.message, "error"); 
        } finally { 
            subBtn.disabled = false; 
            subBtn.textContent = "+ เพิ่มกองทุน"; 
        }
    };

    window.deleteFund = async function(id) { 
        if(confirm("ยืนยันการลบกองทุนนี้?")) { 
            try { 
                await supabaseClient.from('funds').delete().eq('id', id); 
                window.loadAllAdminData(); 
            } catch (err) { 
                showToast("ไม่สามารถลบได้: " + err.message, "error"); 
            } 
        } 
    };

    // ==========================================
    // 10. ระบบดูบิลย่อย และ สมุดบัญชี (Read-Only)
    // ==========================================
    
    // ฟังก์ชันช่วยจัดการสื่อ (รูปภาพ และ PDF)
    function renderMedia(url, label, color) {
        if (!url) return '';
        const isPdf = url.toLowerCase().endsWith('.pdf');
        let mediaHtml = isPdf 
            ? `<iframe src="${url}" style="width:100%; height:450px; border:1px solid #e2e8f0; border-radius:8px; margin-top:5px;"></iframe>`
            : `<a href="${url}" target="_blank"><img src="${url}" style="width:100%; border-radius:8px; margin-top:5px; background:#f1f5f9; max-height:450px; object-fit:contain;"></a>`;
        
        return `<div style="margin-bottom: 20px; border-bottom: 1px dashed #eee; padding-bottom: 15px;">
                    <span style="font-size:13px; color:${color}; font-weight:bold;">${label}:</span>
                    ${mediaHtml}
                    ${isPdf ? '' : '<p style="text-align:center; font-size:11px; color:gray; margin-top:5px;">(คลิกที่รูปเพื่อดูขนาดเต็ม)</p>'}
                </div>`;
    }

    window.viewTransaction = async function(id) {
        document.getElementById('view-tx-modal').style.display = 'flex'; 
        const content = document.getElementById('view-tx-content'); 
        content.innerHTML = '<div style="text-align:center; padding:20px; color:gray;">กำลังโหลดข้อมูล...</div>';
        
        try {
            const { data: tx } = await supabaseClient.from('transactions').select(`*`).eq('id', id).single(); 
            if (!tx) throw new Error("ไม่พบข้อมูล"); 
            
            const pMap = await getProfileMap();
            const { data: bData } = await supabaseClient.from('bank_accounts').select('bank_name').eq('id', tx.bank_account_id).single(); 
            const { data: fData } = await supabaseClient.from('funds').select('fund_name').eq('id', tx.fund_id).single();

            const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
            
            let allMedia = '';
            
            // 🌟 เช็กว่ารายการนี้มาจากการเบิกเงินหรือไม่
            if (tx.clearance_id) {
                const { data: c } = await supabaseClient.from('clearances').select('receipt_url, return_slip_url, statement_url').eq('id', tx.clearance_id).single();
                if (c) {
                    allMedia += renderMedia(c.receipt_url, '📄 ใบเสร็จ/สลิป (ผู้เบิกแนบ)', '#64748b');
                    allMedia += renderMedia(c.return_slip_url, '💸 สลิปเงินทอน (ผู้เบิกแนบ)', '#ef4444');
                    // ใช้ statement_url จาก clearance หรือถ้าไม่มีก็ดึงจาก tx.slip_url
                    allMedia += renderMedia(c.statement_url || tx.slip_url, '🏦 หลักฐานการทำธุรกรรม (เหรัญญิกแนบ)', '#10b981');
                }
            } else {
                // รายการรับบริจาค หรือ รายจ่ายทั่วไป
                allMedia += renderMedia(tx.slip_url, '📄 หลักฐานการทำรายการ', '#64748b');
            }

            if (!allMedia) allMedia = '<div style="margin-top:15px; padding:20px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีหลักฐานแนบในระบบ</div>';

            content.innerHTML = `
                <table style="width:100%; font-size:14px;">
                    <tr><td style="padding:5px 0; color:gray; width:30%;">วันที่:</td><td style="font-weight:bold;">${date}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">รายละเอียด:</td><td>${tx.description || '-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">ฝ่าย / แผนก:</td><td style="color:var(--primary);">${tx.department || 'ส่วนกลาง'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">สถานที่:</td><td>${tx.location || '-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">ยอดเงิน:</td><td style="font-weight:bold; color:var(--primary);">฿${parseFloat(tx.amount).toLocaleString()}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">บัญชี / กองทุน:</td><td>🏦 ${bData?.bank_name||'-'} <br> 💼 ${fData?.fund_name||'-'}</td></tr>
                    <tr><td style="padding:5px 0; color:gray;">ผู้บันทึก:</td><td>${pMap[tx.created_by]?.full_name || 'แอดมิน'}</td></tr>
                </table>
                
                <div style="margin-top: 25px;">
                    <h4 style="margin-bottom: 15px; color: #475569; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">📸 ภาพหลักฐานอ้างอิง</h4>
                    ${allMedia}
                </div>
                
                <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #ccc; display:flex; justify-content:center;">
                    <button onclick="undoTransaction('${tx.id}')" class="btn btn-danger" style="width:100%; padding:10px; font-size:14px;">🗑️ ยกเลิกรายการนี้ (Undo & คืนเงิน)</button>
                </div>
            `;
        } catch (err) { 
            content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ</span>'; 
        }
    };

    window.viewClearance = async function(id) {
        document.getElementById('view-clearance-modal').style.display = 'flex'; 
        const content = document.getElementById('view-clearance-content'); 
        content.innerHTML = 'กำลังโหลดข้อมูล...';
        
        try {
            const { data: c } = await supabaseClient.from('clearances').select(`*, profiles!member_id(full_name)`).eq('id', id).single(); 
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id); 
            const pMap = await getProfileMap();

            let itemsHtml = '<div style="padding:15px; text-align:center; color:gray; background:#f4f6f9; border-radius:6px;">ไม่มีรายการย่อย</div>';
            if (items && items.length > 0) {
                itemsHtml = `
                    <table style="width:100%; background:#f8fafc; border-radius:6px; margin-top:10px;">
                        <thead>
                            <tr><th style="padding:8px;">รายการ</th><th style="text-align:center;">จำนวน</th><th style="text-align:right; padding-right:8px;">ราคารวม</th></tr>
                        </thead>
                        <tbody>
                            ${items.map(it => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${it.item_name}</td><td style="text-align:center; border-bottom:1px solid #eee;">${it.quantity}</td><td style="text-align:right; padding-right:8px; border-bottom:1px solid #eee;">฿${parseFloat(it.total_price).toLocaleString()}</td></tr>`).join('')}
                        </tbody>
                    </table>
                `;
            }

            const imgList = []; 
            let pwdHtml = c.statement_password ? `<p style="margin:5px 0 0 0; color:var(--danger); font-size:12px; font-weight:bold; background:#fee2e2; padding:3px 6px; border-radius:4px; display:inline-block;">🔑 รหัส: ${c.statement_password}</p>` : '';
            
            if(c.statement_url) {
                if (c.statement_url.toLowerCase().includes('.pdf')) { 
                    imgList.push(`<div><p style="margin:0 0 5px 0; color:gray; font-size:12px;">ใบเสร็จรวม/สลิปจ่าย:</p><a href="${c.statement_url}" target="_blank" class="btn btn-outline" style="display:inline-block; padding:10px 15px; text-decoration:none;">📄 ดู PDF</a><br>${pwdHtml}</div>`); 
                } else { 
                    imgList.push(`<div><p style="margin:0 0 5px 0; color:gray; font-size:12px;">ใบเสร็จรวม/สลิปจ่าย:</p><img src="${c.statement_url}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"><br>${pwdHtml}</div>`); 
                }
            }
            if(c.member_return_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--warning); font-size:12px;">สลิปเงินทอน (คืนค่าย):</p><img src="${c.member_return_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            if(c.admin_transfer_slip) imgList.push(`<div><p style="margin:0 0 5px 0; color:var(--danger); font-size:12px;">สลิปโอนเงิน (ออกค่าย):</p><img src="${c.admin_transfer_slip}" style="max-width:100%; height:150px; border-radius:6px; cursor:pointer; object-fit:cover; border:1px solid #ccc;" onclick="window.open(this.src, '_blank')"></div>`);
            
            const imgsHtml = imgList.length > 0 ? `<div style="display:flex; gap:10px; margin-top:15px; overflow-x:auto; padding-bottom:10px;">${imgList.join('')}</div>` : `<div style="margin-top:15px; padding:15px; text-align:center; background:#f4f6f9; color:gray; border-radius:8px;">ไม่มีรูปหลักฐานแนบไว้เลย</div>`;

            content.innerHTML = `
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:300px;">
                        <table style="width:100%; font-size:14px;">
                            <tr><td style="padding:4px 0; color:gray; width:35%;">ผู้เบิก:</td><td style="font-weight:bold;">${pMap[c.member_id]?.full_name||'-'}</td></tr>
                            <tr><td style="padding:4px 0; color:gray;">ฝ่าย / แผนก:</td><td style="color:var(--primary);">${c.department || '-'}</td></tr>
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
        } catch (err) { 
            content.innerHTML = '<span style="color:red;">โหลดข้อมูลไม่สำเร็จ</span>'; 
        }
    };

    // ==========================================
    // 🌟 ระบบ Export CSV (เวอร์ชันดั้งเดิม)
    // ==========================================
    window.exportLedgerToCSV = async function() {
        const btn = document.querySelector('button[onclick="exportLedgerToCSV()"]'); 
        if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังดึงข้อมูล...'; }
        
        try {
            const selectedDept = document.getElementById('filter-dept')?.value;
            let query = supabaseClient.from('transactions').select(`*`).eq('status', 'approved').order('created_at', { ascending: false });
            if (selectedDept) query = query.eq('department', selectedDept);
            
            const { data: txs, error: exportErr } = await query; 
            if (exportErr) throw exportErr;
            
            const { data: cItems } = await supabaseClient.from('clearance_items').select('*');
            
            if (!txs || txs.length === 0) { 
                showToast(`ไม่มีข้อมูลในสมุดบัญชีสำหรับ Export`, "warning"); 
                return; 
            }

            const pMap = await getProfileMap(); 
            const { data: bData } = await supabaseClient.from('bank_accounts').select('*'); 
            const bankMap = {}; 
            bData?.forEach(b => bankMap[b.id] = b.bank_name); 
            
            const { data: fData } = await supabaseClient.from('funds').select('*'); 
            const fundMap = {}; 
            fData?.forEach(f => fundMap[f.id] = f.fund_name);

            let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
            csvContent += "วันที่,ฝ่าย,รายการ,บัญชี/กองทุน,รายรับ (฿),รายจ่าย (฿),ผู้บันทึก\n";
            
            txs.forEach(tx => {
                const date = tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString('th-TH') : new Date(tx.created_at).toLocaleDateString('th-TH');
                let desc = (tx.description || '-') + (tx.location ? ` (ส: ${tx.location})` : '');
                desc = desc.replace(/"/g, '""'); 
                
                const bankFund = `[บ] ${bankMap[tx.bank_account_id]||'-'} / [ก] ${fundMap[tx.fund_id]||'-'}`;
                const amt = parseFloat(tx.amount) || 0; 
                let inc = '', exp = ''; 
                if (tx.transaction_type === 'expense') exp = amt; else inc = amt;
                
                csvContent += `"${date}","${tx.department || 'ส่วนกลาง'}","${desc}","${bankFund}","${inc}","${exp}","${pMap[tx.created_by]?.full_name || 'แอดมิน'}"\n`;
                
                const match = desc.match(/(?:รหัส |\()([a-zA-Z0-9]{6})/);
                if (match) {
                    const shortId = match[1]; 
                    const items = cItems.filter(i => i.clearance_id && i.clearance_id.startsWith(shortId));
                    if (items.length > 0) { 
                        items.forEach(it => { 
                            let iName = it.item_name.replace(/"/g, '""');
                            csvContent += `"","","   ↳ ${iName} (จำนวน: ${it.quantity}) = ฿${parseFloat(it.total_price).toLocaleString()}","","","",""\n`; 
                        }); 
                    }
                }
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            const filenameLabel = selectedDept ? `_${selectedDept}` : '_All';
            link.setAttribute("download", `ARSATU_Ledger${filenameLabel}_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link); 
            link.click(); 
            document.body.removeChild(link);

        } catch (e) { 
            showToast("เกิดข้อผิดพลาดในการ Export: " + e.message, "error"); 
        } finally { 
            if (btn) { btn.disabled = false; btn.innerHTML = '📥 Export Excel'; } 
        }
    };

    window.loadPendingUsers = async function() {
        const tbody = document.querySelector('#pending-users-table tbody'); 
        if (!tbody) return;
        
        try {
            const { data, error } = await supabaseClient.from('profiles').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            if (error) throw error; 
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:gray;">✅ ไม่มีผู้ใช้งานรออนุมัติ</td></tr>`; 
                return; 
            }
            
            tbody.innerHTML = data.map(user => { 
                return `
                    <tr>
                        <td>${user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH') : '-'}</td>
                        <td style="font-weight:bold; color:var(--text-main);">${user.full_name || 'ไม่มีชื่อ'}</td>
                        <td style="color:var(--primary);"><span style="background:#e0e7ff; padding:4px 8px; border-radius:6px; font-size:12px;">📂 ${user.department || '-'}</span></td>
                        <td><span class="status-badge" style="background:#fef3c7; color:#d97706;">รออนุมัติ</span></td>
                        <td><button onclick="approveUser('${user.id}', '${user.full_name}')" class="btn btn-primary" style="padding:6px 12px; font-size:12px;">✅ อนุมัติผู้ใช้</button></td>
                    </tr>
                `; 
            }).join('');
        } catch (e) { 
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">❌ เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`; 
        }
    };

    window.approveUser = async function(id, currentName) {
        const finalName = prompt('ตรวจสอบ/แก้ไข ชื่อที่จะให้แสดงในระบบ:', currentName); 
        if (!finalName) return; 
        
        const isSetAsAdmin = confirm('ต้องการให้สิทธิ์เป็น 👑 Admin (ผู้ดูแลระบบ) หรือไม่?\n\n- กด [OK] = เป็น Admin\n- กด [Cancel] = เป็น Member ทั่วไป');
        
        try { 
            await supabaseClient.from('profiles').update({ status: 'approved', role: isSetAsAdmin ? 'admin' : 'member', full_name: finalName }).eq('id', id); 
            showToast(`อนุมัติคุณ ${finalName} เรียบร้อยแล้ว!`, "success"); 
            window.loadPendingUsers(); 
        } catch (err) { 
            showToast("เกิดข้อผิดพลาด: " + err.message, "error"); 
        }
    };

    window.undoTransaction = async function(txId) {
        if(!confirm('⚠️ ยืนยันการ "ยกเลิก (Undo)" รายการนี้ใช่ไหม?\n\nระบบจะทำการ:\n1. ดึงยอดเงินกลับอัตโนมัติ\n2. ตีกลับบิลไปสถานะรอตรวจสอบใหม่')) return;
        
        try {
            const { data: tx } = await supabaseClient.from('transactions').select('*').eq('id', txId).single(); 
            if (!tx) throw new Error("ไม่พบข้อมูลรายการนี้");
            
            document.getElementById('view-tx-content').innerHTML = '<div style="text-align:center; padding:20px; color:var(--info);">⏳ กำลังดึงเงินกลับและถอยสถานะ...</div>';

            const { data: bData } = await supabaseClient.from('bank_accounts').select('balance').eq('id', tx.bank_account_id).single(); 
            const { data: fData } = await supabaseClient.from('funds').select('remaining_budget').eq('id', tx.fund_id).single();
            
            let nBal = parseFloat(bData.balance || 0), nFun = parseFloat(fData.remaining_budget || 0); 
            const amt = parseFloat(tx.amount || 0);

            if (['income', 'donation_cash', 'donation_transfer'].includes(tx.transaction_type)) { 
                nBal -= amt; nFun -= amt; 
            } else { 
                nBal += amt; nFun += amt; 
            }
            
            await supabaseClient.from('bank_accounts').update({ balance: nBal }).eq('id', tx.bank_account_id); 
            await supabaseClient.from('funds').update({ remaining_budget: nFun }).eq('id', tx.fund_id);

            if (tx.clearance_id) { 
                let revertStatus = tx.description.includes('[โอนตั้งต้น]') ? 'pending_advance' : 'pending_clearance'; 
                await supabaseClient.from('clearances').update({ status: revertStatus }).eq('id', tx.clearance_id); 
                await supabaseClient.from('transactions').delete().eq('id', txId); 
            } else { 
                if (tx.transaction_type === 'income' || tx.transaction_type === 'expense') {
                    await supabaseClient.from('transactions').delete().eq('id', txId); 
                } else {
                    await supabaseClient.from('transactions').update({ status: 'pending' }).eq('id', txId); 
                }
            }
            
            showToast("ยกเลิกรายการและคืนยอดเงินเรียบร้อย", "success"); 
            document.getElementById('view-tx-modal').style.display = 'none'; 
            window.loadAllAdminData(); 
        } catch (err) { 
            showToast("ผิดพลาด: " + err.message, "error"); 
            document.getElementById('view-tx-modal').style.display = 'none'; 
        }
    };

    window.loadAllAdminData = async function() {
        if (!currentUser) return;
        
        try {
            const pMap = await getProfileMap(); 
            if (pMap[currentUser.id] && document.getElementById('current-user-name')) {
                document.getElementById('current-user-name').textContent = pMap[currentUser.id].full_name || 'Admin';
            }

            const { count: c1 } = await supabaseClient.from('clearances').select('*', { count: 'exact', head: true }).in('status', ['pending_advance', 'pending_clearance']); 
            const { count: c2 } = await supabaseClient.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'); 
            const totalPending = (c1 || 0) + (c2 || 0);
            
            const badge = document.getElementById('noti-badge');
            if (badge) { 
                if (totalPending > 0) { 
                    badge.textContent = totalPending; 
                    badge.style.display = 'inline-block'; 
                    document.getElementById('noti-bell').onclick = () => showToast(`มีรายการรอตรวจสอบทั้งหมด ${totalPending} รายการ`, "warning"); 
                } else { 
                    badge.style.display = 'none'; 
                    document.getElementById('noti-bell').onclick = () => showToast(`ไม่มีรายการค้างตรวจสอบ`, "success"); 
                } 
            }
        } catch(e) { 
            console.error(e); 
        }

        window.loadDashboardWidgets(); 
        window.loadPendingDonations(); 
        window.loadPendingRequests(); 
        window.loadLedger(); 
        window.loadClearanceHistory(); 
        window.loadSettingsData(); 
        window.loadPendingUsers(); 
        if (typeof window.loadAuditLogs === 'function') window.loadAuditLogs();
        if (typeof window.loadCeilings === 'function') window.loadCeilings();
        if (typeof window.loadAdminPlans === 'function') window.loadAdminPlans();
    };

    // ==========================================
    // 🌟 ระบบยกเลิกรายการและเก็บประวัติ (Soft Delete + Audit Log)
    // ==========================================
    window.cancelRecord = async function(recordId, tableName) {
        // 1. ถามเหตุผลด้วย SweetAlert2 แบบบังคับกรอก
        const { value: reason } = await Swal.fire({
            title: 'ยืนยันการยกเลิก?',
            text: "รายการนี้จะถูกยกเลิก และระบบจะบันทึกประวัติการทำรายการนี้ไว้",
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'พิมพ์เหตุผลที่ต้องการยกเลิก (เช่น คีย์เลขผิด, บิลซ้ำ)...',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: '🗑️ ใช่, ยกเลิกรายการ',
            cancelButtonText: 'ปิด',
            inputValidator: (value) => {
                if (!value) return 'กรุณาระบุเหตุผล';
            }
        });

        // 2. ถ้าระบุเหตุผลและกดตกลง
        if (reason) {
            try {
                // โชว์แจ้งเตือนกำลังโหลด
                Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

                // 2.1 อัปเดตสถานะในตารางหลักให้เป็น 'cancelled'
                const { error: updateErr } = await supabaseClient
                    .from(tableName)
                    .update({ status: 'cancelled' })
                    .eq('id', recordId);
                
                if (updateErr) throw updateErr;

                // 2.2 บันทึกประวัติลงตาราง audit_logs
                const { error: logErr } = await supabaseClient
                    .from('audit_logs')
                    .insert([{
                        table_name: tableName,
                        record_id: recordId,
                        action: 'CANCEL',
                        performed_by: currentUser.id,
                        reason: reason
                    }]);
                
                if (logErr) throw logErr;

                showToast("ยกเลิกรายการและบันทึกประวัติเรียบร้อย", "success");
                
                // 2.3 สั่งให้ตารางโหลดข้อมูลใหม่เพื่อแสดงผลอัปเดต
                if (typeof window.loadData === 'function') window.loadData();
                if (typeof window.loadAllAdminData === 'function') window.loadAllAdminData();
                
            } catch (err) {
                showToast("เกิดข้อผิดพลาด: " + err.message, "error");
                console.error("Cancel Error:", err);
            }
        }
    };

    // ==========================================
    // 🌟 ระบบปิดค่าย (ยืนยัน 3 ชั้น + Backup & Reset)
    // ==========================================
    window.closeCampAndReset = async function() {
        // 🛑 ด่านที่ 1: คำเตือนแรก
        const step1 = await Swal.fire({
            title: '⚠️ คำเตือนระดับสูงสุด',
            text: "คุณกำลังจะโหลด Backup และ ล้างข้อมูลทุกอย่างในระบบเพื่อเริ่มค่ายใหม่ ใช่หรือไม่?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ใช่, ฉันต้องการปิดค่าย',
            cancelButtonText: 'ยกเลิก'
        });
        if (!step1.isConfirmed) return;

        // 🛑 ด่านที่ 2: บังคับพิมพ์ข้อความเพื่อยืนยัน (ป้องกันมือลั่น)
        const step2 = await Swal.fire({
            title: 'พิมพ์เพื่อยืนยัน',
            html: 'เพื่อป้องกันความผิดพลาด กรุณาพิมพ์คำว่า <strong style="color:red;">ปิดค่าย</strong> ลงในช่องว่าง',
            input: 'text',
            inputPlaceholder: 'พิมพ์คำว่า ปิดค่าย',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'ยืนยันตัวอักษร',
            cancelButtonText: 'ยกเลิก',
            inputValidator: (value) => {
                if (value !== 'ปิดค่าย') {
                    return 'พิมพ์ไม่ถูกต้อง กรุณาลองใหม่!';
                }
            }
        });
        if (!step2.isConfirmed) return;

        // 🛑 ด่านที่ 3: ยืนยันครั้งสุดท้าย
        const step3 = await Swal.fire({
            title: '🔥 การตัดสินใจครั้งสุดท้าย',
            text: "เมื่อกดปุ่มด้านล่าง ระบบจะดาวน์โหลดไฟล์และล้างข้อมูลทันที (ไม่สามารถย้อนกลับได้)",
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#000',
            cancelButtonColor: 'gray',
            confirmButtonText: 'ดำเนินการ Backup & ล้างข้อมูลเดี๋ยวนี้!',
            cancelButtonText: 'เปลี่ยนใจ ยกเลิกดีกว่า'
        });
        if (!step3.isConfirmed) return;

        // เริ่มโหลดข้อมูล...
        Swal.fire({ title: 'กำลังดึงข้อมูลทำ Backup...', text: 'ห้ามปิดหน้าต่างนี้เด็ดขาด', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

        try {
            // ดึงข้อมูล "ทุกตาราง" ในฐานข้อมูล
            const { data: clearances } = await supabaseClient.from('clearances').select('*');
            const { data: clearanceItems } = await supabaseClient.from('clearance_items').select('*');
            const { data: transactions } = await supabaseClient.from('transactions').select('*');
            const { data: auditLogs } = await supabaseClient.from('audit_logs').select('*');
            const { data: bankAccounts } = await supabaseClient.from('bank_accounts').select('*');
            const { data: funds } = await supabaseClient.from('funds').select('*');
            const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name, department'); // เก็บชื่อคนไว้ด้วย

            // แพ็กข้อมูลใส่กล่อง JSON
            const backupData = {
                export_date: new Date().toISOString(),
                total_clearances: clearances?.length || 0,
                total_transactions: transactions?.length || 0,
                data: {
                    profiles: profiles || [],
                    clearances: clearances || [],
                    clearance_items: clearanceItems || [],
                    transactions: transactions || [],
                    audit_logs: auditLogs || [],
                    ending_balances: bankAccounts || [],
                    ending_funds: funds || []
                }
            };

            // สั่งให้เบราว์เซอร์ดาวน์โหลดไฟล์อัตโนมัติ
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `ARSATU_Archive_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(dlAnchorElem);
            dlAnchorElem.click();
            dlAnchorElem.remove();

            Swal.fire({ title: 'ดาวน์โหลดสำเร็จ!', text: 'กำลังล้างข้อมูลและรีเซ็ตระบบ...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

            // ล้างข้อมูลตาราง
            const dummyUUID = '00000000-0000-0000-0000-000000000000';
            await supabaseClient.from('audit_logs').delete().neq('id', dummyUUID);
            await supabaseClient.from('clearance_items').delete().neq('id', dummyUUID);
            await supabaseClient.from('clearances').delete().neq('id', dummyUUID);
            await supabaseClient.from('transactions').delete().neq('id', dummyUUID);

            // รีเซ็ตยอดเงินบัญชีและกองทุนให้กลับเป็น 0
            if (bankAccounts && bankAccounts.length > 0) {
                for (let bank of bankAccounts) {
                    await supabaseClient.from('bank_accounts').update({ balance: 0 }).eq('id', bank.id);
                }
            }
            if (funds && funds.length > 0) {
                for (let fund of funds) {
                    await supabaseClient.from('funds').update({ remaining_budget: 0 }).eq('id', fund.id);
                }
            }

            Swal.fire({
                title: 'สำเร็จ! เริ่มต้นค่ายใหม่',
                text: 'เก็บไฟล์ Backup ไว้ให้ดี! คุณสามารถนำไฟล์นั้นไปเปิดอ่านในหน้า Archive ได้ทุกเมื่อ',
                icon: 'success',
                confirmButtonText: 'ตกลง'
            }).then(() => {
                window.location.reload(); 
            });

        } catch (err) {
            console.error("Backup & Reset Error:", err);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถรีเซ็ตระบบได้: ' + err.message, 'error');
        }
    };

    window.loadAllAdminData();
});

// ==========================================
// 🌟 ระบบปิดค่าย (ยืนยัน 3 ชั้น + Backup & Reset)
// ==========================================
window.closeCampAndReset = async function() {
    // 🛑 ด่านที่ 1: คำเตือนแรก
    const step1 = await Swal.fire({
        title: '⚠️ คำเตือนระดับสูงสุด',
        text: "คุณกำลังจะโหลด Backup และ ล้างข้อมูลทุกอย่างในระบบเพื่อเริ่มค่ายใหม่ ใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ฉันต้องการปิดค่าย',
        cancelButtonText: 'ยกเลิก'
    });
    if (!step1.isConfirmed) return;

    // 🛑 ด่านที่ 2: บังคับพิมพ์ข้อความเพื่อยืนยัน
    const step2 = await Swal.fire({
        title: 'พิมพ์เพื่อยืนยัน',
        html: 'กรุณาพิมพ์คำว่า <strong style="color:red;">ปิดค่าย</strong> เพื่อดำเนินการต่อ',
        input: 'text',
        inputPlaceholder: 'พิมพ์คำว่า ปิดค่าย',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (value !== 'ปิดค่าย') return 'พิมพ์ไม่ถูกต้อง กรุณาลองใหม่!';
        }
    });
    if (!step2.isConfirmed) return;

    // 🛑 ด่านที่ 3: ยืนยันครั้งสุดท้าย
    const step3 = await Swal.fire({
        title: '🔥 การตัดสินใจครั้งสุดท้าย',
        text: "ระบบจะดาวน์โหลดไฟล์และล้างข้อมูลทันที (ไม่สามารถย้อนกลับได้)",
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#000',
        confirmButtonText: 'ดำเนินการเดี๋ยวนี้!',
        cancelButtonText: 'ยกเลิก'
    });
    if (!step3.isConfirmed) return;

    Swal.fire({ title: 'กำลังทำ Backup...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    try {
        // ดึงข้อมูลทุกตาราง
        const { data: clearances } = await supabaseClient.from('clearances').select('*');
        const { data: clearanceItems } = await supabaseClient.from('clearance_items').select('*');
        const { data: transactions } = await supabaseClient.from('transactions').select('*');
        const { data: auditLogs } = await supabaseClient.from('audit_logs').select('*');
        const { data: bankAccounts } = await supabaseClient.from('bank_accounts').select('*');
        const { data: funds } = await supabaseClient.from('funds').select('*');
        const { data: profiles } = await supabaseClient.from('profiles').select('id, full_name, department');

        // แพ็ก JSON
        const backupData = {
            export_date: new Date().toISOString(),
            data: { profiles, clearances, clearance_items, transactions, audit_logs, bank_accounts: bankAccounts, funds }
        };

        // ดาวน์โหลดไฟล์
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `ARSATU_Archive_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        dlAnchorElem.remove();

        // ล้างตาราง
        const dummy = '00000000-0000-0000-0000-000000000000';
        await supabaseClient.from('audit_logs').delete().neq('id', dummy);
        await supabaseClient.from('clearance_items').delete().neq('id', dummy);
        await supabaseClient.from('clearances').delete().neq('id', dummy);
        await supabaseClient.from('transactions').delete().neq('id', dummy);

        // รีเซ็ตยอดเงิน
        for (let b of (bankAccounts || [])) await supabaseClient.from('bank_accounts').update({ balance: 0 }).eq('id', b.id);
        for (let f of (funds || [])) await supabaseClient.from('funds').update({ remaining_budget: 0 }).eq('id', f.id);

        Swal.fire('สำเร็จ!', 'เริ่มต้นค่ายใหม่เรียบร้อยแล้ว', 'success').then(() => window.location.reload());
    } catch (err) {
        Swal.fire('ผิดพลาด', err.message, 'error');
    }
};

// ==========================================
    // 🌟 ระบบจัดการแผนงบประมาณ (Admin Budget Plan)
    // ==========================================
    
    // โหลดเพดานงบ (เวอร์ชันล็อกชื่อฝ่ายให้อัตโนมัติ ป้องกันการพิมพ์ผิด)
    window.loadCeilings = async function() {
        const tbody = document.querySelector('#ceiling-table tbody');
        if (!tbody) return;

        // รายชื่อฝ่ายอ้างอิงจาก Dropdown ในหน้า Member เป๊ะๆ
        const allDepts = [
            'อำนวยการ', 'สวัสดิการ', 'โครงงาน', 'อุปกรณ์', 'สถานที่', 
            'สันทนาการ', 'เหรัญญิก', 'สปอนเซอร์', 'PR', 'สัมพันธ์ชาวบ้าน', 'อื่นๆ'
        ];

        try {
            const { data, error } = await supabaseClient.from('department_ceilings').select('*');
            if (error) throw error;
            
            // จับคู่ข้อมูลที่มีอยู่ใน Database
            const dbDepts = {};
            if (data) {
                data.forEach(c => dbDepts[c.department] = c.ceiling_amount);
            }

            // สร้างตารางตามรายชื่อฝ่ายทั้งหมด (แม้จะยังไม่เคยกินหนดค่า ก็จะขึ้น 0)
            tbody.innerHTML = allDepts.map(dept => {
                const amt = dbDepts[dept] || 0;
                return `
                    <tr>
                        <td style="font-weight: 500; color: var(--primary);">${dept}</td>
                        <td><input type="number" id="ceil-amt-${dept}" value="${amt}" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"></td>
                        <td style="text-align:center;"><button onclick="saveCeiling('${dept}')" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px; border-color: var(--success); color: var(--success);">💾 บันทึก</button></td>
                    </tr>
                `;
            }).join('');
        } catch(e) { 
            console.error(e); 
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red;">โหลดข้อมูลไม่ได้: ${e.message}</td></tr>`;
        }
    };

    window.saveCeiling = async function(dept) {
        let saveDept = dept;
        let saveAmt = 0;
        
        if (dept === 'new') {
            saveDept = document.getElementById('new-ceiling-dept').value;
            saveAmt = parseFloat(document.getElementById('new-ceiling-amt').value) || 0;
            if(!saveDept) return showToast('กรุณากรอกชื่อฝ่าย', 'warning');
        } else {
            saveAmt = parseFloat(document.getElementById(`ceil-amt-${dept}`).value) || 0;
        }

        try {
            // 🚨 ใส่ onConflict: 'department' เพื่อบังคับให้เซฟทับของเดิมได้
            const { error } = await supabaseClient.from('department_ceilings').upsert(
                [{ department: saveDept, ceiling_amount: saveAmt }], 
                { onConflict: 'department' }
            );
            
            if (error) throw error; 

            showToast(`บันทึกงบของฝ่าย "${saveDept}" สำเร็จ`, 'success');
            if(dept === 'new') {
                document.getElementById('new-ceiling-dept').value = '';
                document.getElementById('new-ceiling-amt').value = '';
            }
            window.loadCeilings(); // โหลดใหม่เพื่ออัปเดตตาราง
        } catch(err) {
            showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
            console.error("Save Ceiling Error:", err);
        }
    };
    // โหลดตารางคำขอแผน
    window.loadAdminPlans = async function() {
        const tbody = document.querySelector('#admin-plans-table tbody');
        if (!tbody) return;
        try {
            const { data, error } = await supabaseClient.from('budget_plans').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            if(!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:gray;">ไม่มีแผนงบประมาณ</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(plan => {
                const date = new Date(plan.created_at).toLocaleDateString('th-TH');
                let stat = '';
                if(plan.status === 'pending') stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">รอตรวจสอบ</span>';
                else if(plan.status === 'approved') stat = '<span class="status-badge" style="background:#d1fae5; color:#059669;">✅ อนุมัติ</span>';
                else if(plan.status === 'rejected') stat = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">❌ ปฏิเสธ</span>';

                return `
                    <tr>
                        <td>${date}</td>
                        <td style="color:var(--primary); font-weight:500;">${plan.department}</td>
                        <td>${plan.purpose}</td>
                        <td style="font-weight:bold;">฿${parseFloat(plan.total_amount).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td style="text-align:center;"><button onclick="viewAdminPlan('${plan.id}')" class="btn btn-info" style="padding:4px 8px; font-size:11px;">🔍 ดูรายละเอียด</button></td>
                    </tr>
                `;
            }).join('');
        } catch(e) { console.error(e); }
    };

    window.viewAdminPlan = async function(id) {
        document.getElementById('view-plan-modal').style.display = 'flex';
        const content = document.getElementById('view-plan-content');
        content.innerHTML = 'กำลังโหลด...';

        try {
            const { data: plan } = await supabaseClient.from('budget_plans').select('*, profiles(full_name)').eq('id', id).single();
            const { data: items } = await supabaseClient.from('budget_plan_items').select('*').eq('plan_id', id).order('priority', { ascending: true });
            const { data: ceil } = await supabaseClient.from('department_ceilings').select('ceiling_amount').eq('department', plan.department).single();
            
            const ceilingAmt = ceil ? parseFloat(ceil.ceiling_amount) : 0;
            const diff = ceilingAmt - parseFloat(plan.total_amount);
            const diffHtml = diff >= 0 
                ? `<span style="color:var(--success);">✅ อยู่ในงบ (เหลือ ฿${diff.toLocaleString()})</span>` 
                : `<span style="color:var(--danger);">🚨 เกินงบ! (เกินไป ฿${Math.abs(diff).toLocaleString()})</span>`;

            const prioColor = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#64748b', 5: '#94a3b8' };
            const prioText = { 1: 'จำเป็นมาก', 2: 'ค่อนข้างจำเป็น', 3: 'ควรมี', 4: 'ตัดได้หากจำเป็น', 5: 'ตัดได้' };

            let itemsHtml = `
                <table style="width:100%; background:#f8fafc; font-size:13px; margin-top:15px; border-radius:6px; overflow:hidden;">
                    <thead style="background:#e2e8f0;">
                        <tr><th style="padding:8px;">รายการ</th><th style="text-align:center;">จำนวน</th><th style="text-align:right;">ราคา/หน่วย</th><th style="text-align:right;">ราคารวม</th><th style="text-align:center;">ความสำคัญ</th><th>หมายเหตุ</th></tr>
                    </thead>
                    <tbody>
                        ${items.map(it => `
                            <tr style="border-bottom:1px solid #e2e8f0;">
                                <td style="padding:8px;">${it.item_name}</td>
                                <td style="text-align:center;">${it.quantity}</td>
                                <td style="text-align:right;">฿${parseFloat(it.unit_price).toLocaleString()}</td>
                                <td style="text-align:right; font-weight:bold;">฿${parseFloat(it.total_price).toLocaleString()}</td>
                                <td style="text-align:center;"><span style="background:${prioColor[it.priority]}20; color:${prioColor[it.priority]}; padding:2px 6px; border-radius:4px; font-weight:bold;">(${it.priority}) ${prioText[it.priority]}</span></td>
                                <td>${it.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // 🚨 [อัปเดต V9.3] เพิ่มช่องกรอกเหตุผลและปุ่ม 3 แบบ
            let actionBtns = '';
            if (plan.status === 'pending' || plan.status === 'returned_for_edit') {
                actionBtns = `
                    <div style="margin-top:20px; background: #fff1f2; padding: 12px; border-radius: 8px; border: 1px solid #fecaca;">
                        <label style="color: var(--danger); font-size:13px; margin-bottom:5px; display:block;">💬 เหตุผล / หมายเหตุ (จำเป็นหากต้องการตีกลับ หรือ ปฏิเสธ)</label>
                        <textarea id="plan-admin-note" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #fca5a5; font-family: 'Prompt';" rows="2" placeholder="ระบุเหตุผลให้ Member ทราบ..."></textarea>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:15px; justify-content:center;">
                        <button onclick="updatePlanStatus('${plan.id}', 'approved')" class="btn btn-success" style="flex:2; padding:10px;">✅ อนุมัติแผนนี้</button>
                        <button onclick="updatePlanStatus('${plan.id}', 'returned_for_edit')" class="btn btn-warning" style="flex:1; padding:10px;">🔙 ตีกลับให้แก้ไข</button>
                        <button onclick="updatePlanStatus('${plan.id}', 'rejected')" class="btn btn-danger" style="flex:1; padding:10px;">❌ ปฏิเสธแผน</button>
                    </div>
                `;
            }

            content.innerHTML = `
                <div style="background:#f0f9ff; padding:15px; border-radius:8px; border:1px solid #bae6fd;">
                    <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div>
                            <p style="margin:0 0 5px 0;"><b>หัวข้อ:</b> ${plan.purpose}</p>
                            <p style="margin:0 0 5px 0;"><b>ฝ่าย:</b> ${plan.department} <small>(ผู้เสนอ: ${plan.profiles?.full_name})</small></p>
                            <p style="margin:0;"><b>วันที่ต้องการใช้เงิน:</b> ${new Date(plan.date_needed).toLocaleDateString('th-TH')}</p>
                        </div>
                        <div style="text-align:right; background:white; padding:10px; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                            <div style="font-size:12px; color:gray;">ยอดรวมในแผน:</div>
                            <div style="font-size:24px; font-weight:bold; color:var(--primary);">฿${parseFloat(plan.total_amount).toLocaleString()}</div>
                            <div style="font-size:12px; margin-top:5px;">เพดานงบ: ฿${ceilingAmt.toLocaleString()} <br> ${diffHtml}</div>
                        </div>
                    </div>
                </div>
                ${itemsHtml}
                ${actionBtns}
            `;
        } catch(e) { content.innerHTML = '<span style="color:red;">โหลดไม่สำเร็จ</span>'; }
    };

    window.updatePlanStatus = async function(id, status) {
        const noteInput = document.getElementById('plan-admin-note');
        const adminNote = noteInput ? noteInput.value.trim() : '';

        // บังคับให้ใส่เหตุผลถ้ากดตีกลับหรือปฏิเสธ
        if ((status === 'returned_for_edit' || status === 'rejected') && !adminNote) {
            return showToast('⚠️ กรุณาระบุเหตุผลในช่องหมายเหตุก่อนตีกลับหรือปฏิเสธ', 'warning');
        }

        let confirmMsg = 'ยืนยันการอนุมัติแผนงบประมาณนี้?';
        if (status === 'returned_for_edit') confirmMsg = 'ยืนยันการตีกลับแผนให้ Member แก้ไข?';
        if (status === 'rejected') confirmMsg = 'ยืนยันการปฏิเสธแผนงบประมาณนี้?';

        if(!confirm(confirmMsg)) return;

        try {
            await supabaseClient.from('budget_plans').update({ 
                status: status, 
                admin_note: adminNote || null 
            }).eq('id', id);
            
            showToast('อัปเดตสถานะสำเร็จ', 'success');
            document.getElementById('view-plan-modal').style.display = 'none';
            window.loadAdminPlans();
        } catch(e) { 
            showToast('ผิดพลาด: ' + e.message, 'error'); 
        }
    };

    
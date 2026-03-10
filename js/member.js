document.addEventListener('DOMContentLoaded', async () => {

    let currentUser = null;
    window.isClearingAdvance = false; // ตัวแปรเช็กว่ากำลังเคลียร์บิลจากเงินตั้งต้นอยู่หรือไม่

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
    // 1. UI ควบคุมฟอร์มเบิกเงิน
    // ==========================================
    function setupClearanceUI() {
        const reqType = document.getElementById('req-type');
        const advSec = document.getElementById('advance-section');
        const reqAmt = document.getElementById('req-amount');
        const itemsTbody = document.getElementById('items-tbody');
        const addBtn = document.getElementById('add-item-btn');
        const totalSpan = document.getElementById('total-actual');
        const diffSummary = document.getElementById('diff-summary');
        const returnSlip = document.getElementById('return-slip-section');

        window.calculateTotal = () => {
            try {
                let total = 0;
                if (itemsTbody) {
                    itemsTbody.querySelectorAll('tr').forEach(tr => {
                        const priceInput = tr.querySelector('.item-price');
                        if (priceInput) total += (parseFloat(priceInput.value) || 0);
                    });
                }
                if (totalSpan) totalSpan.textContent = total.toLocaleString();

                const amt = parseFloat(reqAmt?.value) || 0;
                
                // คำนวณเงินทอน เฉพาะตอน "กำลังเคลียร์บิล (Advance)" เท่านั้น
                if (reqType?.value === 'advance' && amt > 0 && window.isClearingAdvance) {
                    if (diffSummary) diffSummary.style.display = 'block';
                    const diff = amt - total;
                    
                    if (diff > 0 && total > 0) {
                        if (diffSummary) diffSummary.innerHTML = `🚨 มีเงินเหลือทอนชุมนุม: <br><span style="font-size:18px;">${diff.toLocaleString()} บาท</span>`;
                        if (returnSlip) returnSlip.style.display = 'block';
                    } else if (diff < 0) {
                        if (diffSummary) diffSummary.innerHTML = `💡 คุณสำรองจ่ายเกินไป (ชุมนุมจะโอนเพิ่มให้): <br><span style="font-size:18px;">${Math.abs(diff).toLocaleString()} บาท</span>`;
                        if (returnSlip) returnSlip.style.display = 'none';
                    } else {
                        if (diffSummary) diffSummary.style.display = 'none';
                        if (returnSlip) returnSlip.style.display = 'none';
                    }
                } else {
                    if (diffSummary) diffSummary.style.display = 'none';
                    if (returnSlip) returnSlip.style.display = 'none';
                }
            } catch (e) { console.error(e); }
        };

        if (reqType) {
            reqType.addEventListener('change', () => {
                if (reqType.value === 'advance') {
                    if (advSec) advSec.style.display = 'block';
                } else {
                    if (advSec) advSec.style.display = 'none';
                    if (reqAmt && !window.isClearingAdvance) reqAmt.value = 0;
                }
                window.calculateTotal();
            });
        }

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                if (!itemsTbody) return;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" class="item-name" placeholder="ชื่อรายการ" required></td>
                    <td><input type="number" class="item-qty" min="1" value="1" required></td>
                    <td><input type="number" class="item-price" min="0" step="0.01" value="0" required></td>
                    <td style="text-align: center;"><button type="button" class="btn btn-danger del-btn" style="padding: 6px 10px; font-size: 12px;">ลบ</button></td>
                `;
                itemsTbody.appendChild(tr);
                tr.querySelectorAll('input').forEach(input => input.addEventListener('input', window.calculateTotal));
                tr.querySelector('.del-btn')?.addEventListener('click', () => { tr.remove(); window.calculateTotal(); });
            });
        }
        if (reqAmt) reqAmt.addEventListener('input', window.calculateTotal);
        if (reqType) reqType.dispatchEvent(new Event('change'));
        if (addBtn) addBtn.click();
    }
    setupClearanceUI();

    // ==========================================
    // 2. ส่งข้อมูลเบิก / เคลียร์บิล
    // ==========================================
    async function processRequest(isDraft) {
        const msg = document.getElementById('req-msg');
        const saveBtn = document.getElementById('save-draft-btn');
        const subBtn = document.getElementById('submit-req-btn');

        if (saveBtn) saveBtn.disabled = true; 
        if (subBtn) subBtn.disabled = true;
        if (msg) { msg.style.color = 'var(--primary)'; msg.textContent = 'กำลังเตรียมข้อมูล...'; }

        const draftId = document.getElementById('current-draft-id')?.value || '';
        const typeVal = document.getElementById('req-type')?.value || '';
        const purposeVal = document.getElementById('req-purpose')?.value || '';
        const reqAmtVal = parseFloat(document.getElementById('req-amount')?.value) || 0;
        const bankVal = document.getElementById('req-bank')?.value || '';

        if (!isDraft && purposeVal.trim() === '') {
            if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณากรอกหัวข้อของการเบิกครับ'; }
            if (saveBtn) saveBtn.disabled = false; if (subBtn) subBtn.disabled = false; return;
        }

        const items = [];
        let totalActual = 0;
        document.getElementById('items-tbody')?.querySelectorAll('tr').forEach(tr => {
            const nInput = tr.querySelector('.item-name');
            const qInput = tr.querySelector('.item-qty');
            const pInput = tr.querySelector('.item-price');
            if (nInput && nInput.value.trim() !== '') {
                const price = parseFloat(pInput.value) || 0;
                items.push({ 
                    item_name: nInput.value, 
                    quantity: parseFloat(qInput.value)||1, 
                    total_price: price 
                });
                totalActual += price;
            }
        });

        // 🌟 ตั้งสถานะตาม Flow ใหม่
        let finalStatus = 'draft';
        if (!isDraft) {
            if (window.isClearingAdvance) {
                finalStatus = 'pending_clearance'; // เคลียร์บิล -> ส่งให้แอดมินตรวจใบเสร็จ
            } else {
                // ขอครั้งแรก: ถ้าเป็น Advance ให้รอแอดมินโอนตั้งต้น ถ้าเป็น Reimbursement ให้รอตรวจบิลเลย
                finalStatus = (typeVal === 'advance') ? 'pending_advance' : 'pending_clearance';
            }
        }

        const sFile = document.getElementById('req-statement')?.files[0];
        const rFile = document.getElementById('req-return-slip')?.files[0];

        try {
            let sUrl = null, rUrl = null;
            if (sFile) {
                if(msg) msg.textContent = 'กำลังอัปโหลดใบเสร็จ...';
                const path = `statement-${Date.now()}.${sFile.name.split('.').pop()}`;
                await supabaseClient.storage.from('receipts').upload(path, sFile);
                sUrl = supabaseClient.storage.from('receipts').getPublicUrl(path).data.publicUrl;
            }
            if (rFile) {
                if(msg) msg.textContent = 'กำลังอัปโหลดสลิปคืนเงินทอน...';
                const path = `return-${Date.now()}.${rFile.name.split('.').pop()}`;
                await supabaseClient.storage.from('slips').upload(path, rFile);
                rUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
            }

            if(msg) msg.textContent = 'กำลังบันทึกข้อมูล...';
            let clearanceId = draftId;

            if (draftId) {
                const upData = { 
                    request_type: typeVal, 
                    purpose: purposeVal, 
                    requested_amount: reqAmtVal, 
                    total_actual_amount: totalActual, 
                    status: finalStatus, 
                    member_bank_details: bankVal 
                };
                if (sUrl) upData.statement_url = sUrl; 
                if (rUrl) upData.member_return_slip = rUrl;
                
                await supabaseClient.from('clearances').update(upData).eq('id', draftId);
                await supabaseClient.from('clearance_items').delete().eq('clearance_id', draftId);
            } else {
                const { data } = await supabaseClient.from('clearances').insert([{ 
                    member_id: currentUser.id, 
                    request_type: typeVal, 
                    purpose: purposeVal, 
                    requested_amount: reqAmtVal, 
                    total_actual_amount: totalActual, 
                    status: finalStatus, 
                    member_bank_details: bankVal, 
                    statement_url: sUrl, 
                    member_return_slip: rUrl 
                }]).select();
                clearanceId = data[0].id;
            }

            if (items.length > 0) {
                const itemsToInsert = items.map(i => ({ 
                    clearance_id: clearanceId, 
                    item_name: i.item_name, 
                    quantity: i.quantity, 
                    total_price: i.total_price 
                }));
                await supabaseClient.from('clearance_items').insert(itemsToInsert);
            }

            if (msg) { 
                msg.style.color = 'var(--success)'; 
                msg.textContent = isDraft ? '💾 บันทึกแบบร่างเรียบร้อย!' : '✅ ส่งคำขอเรียบร้อย!'; 
            }
            
            // ล้างฟอร์ม
            const formObj = document.getElementById('complex-clearance-form');
            if (formObj) {
                formObj.reset();
                formObj.dispatchEvent(new Event('reset')); // ทริกเกอร์ให้ดึงเลขบัญชี V3.1 กลับมา
            }
            
            document.getElementById('current-draft-id').value = '';
            document.getElementById('req-type').disabled = false;
            document.getElementById('req-purpose').disabled = false;
            document.getElementById('req-amount').disabled = false;
            document.getElementById('submit-req-btn').innerHTML = '🚀 ส่งคำขอให้ Admin';
            window.isClearingAdvance = false;

            const tbody = document.getElementById('items-tbody');
            if (tbody) tbody.innerHTML = '';
            document.getElementById('add-item-btn')?.click();
            window.calculateTotal();
            
            if (typeof window.loadData === 'function') window.loadData();
            setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);

        } catch (err) {
            console.error(err);
            if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; }
        } finally {
            if (saveBtn) saveBtn.disabled = false; 
            if (subBtn) subBtn.disabled = false;
        }
    }

    document.getElementById('save-draft-btn')?.addEventListener('click', () => processRequest(true));
    document.getElementById('submit-req-btn')?.addEventListener('click', () => processRequest(false));


    // ==========================================
    // 3. 🌟 ฟังก์ชันใหม่: ดึงยอดเบิกล่วงหน้ามาเคลียร์บิล
    // ==========================================
    window.clearAdvance = async function(id) {
        window.isClearingAdvance = true;
        
        // สลับไปแท็บเบิกเงิน
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-clearance').classList.add('active');
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active'); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 

        const msg = document.getElementById('req-msg');
        if (msg) { msg.style.color = 'var(--primary)'; msg.textContent = 'กำลังโหลดข้อมูลเพื่อเคลียร์บิล...'; }

        try {
            const { data: c } = await supabaseClient.from('clearances').select('*').eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            document.getElementById('current-draft-id').value = c.id;
            
            // ล็อกข้อมูลห้ามแก้ (บังคับให้เป็นเคลียร์ของบิลเดิม)
            const typeSelect = document.getElementById('req-type');
            typeSelect.value = 'advance'; 
            typeSelect.disabled = true;
            typeSelect.dispatchEvent(new Event('change'));

            const purposeInput = document.getElementById('req-purpose');
            purposeInput.value = c.purpose; 
            purposeInput.disabled = true;

            const amtInput = document.getElementById('req-amount');
            amtInput.value = c.requested_amount; 
            amtInput.disabled = true;

            document.getElementById('submit-req-btn').innerHTML = '🚀 ส่งบิลเคลียร์เงิน';

            const tbody = document.getElementById('items-tbody');
            if (tbody) {
                tbody.innerHTML = '';
                if (items && items.length > 0) {
                    items.forEach(it => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td><input type="text" class="item-name" value="${it.item_name}" required></td>
                            <td><input type="number" class="item-qty" min="1" value="${it.quantity}" required></td>
                            <td><input type="number" class="item-price" min="0" step="0.01" value="${it.total_price}" required></td>
                            <td style="text-align: center;"><button type="button" class="btn btn-danger del-btn" style="padding: 6px 10px; font-size: 12px;">ลบ</button></td>
                        `;
                        tbody.appendChild(tr);
                        tr.querySelectorAll('input').forEach(i => i.addEventListener('input', window.calculateTotal));
                        tr.querySelector('.del-btn')?.addEventListener('click', () => { tr.remove(); window.calculateTotal(); });
                    });
                } else {
                    document.getElementById('add-item-btn')?.click();
                }
            }
            window.calculateTotal();
            if (msg) { msg.style.color = 'var(--success)'; msg.textContent = 'กรุณาแก้ไขราคาสินค้าตามจริง และแนบใบเสร็จครับ'; }
            setTimeout(() => { if(msg) msg.textContent = ''; }, 4000);
        } catch (err) {
            console.error(err); 
            if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'โหลดข้อมูลไม่สำเร็จ'; }
        }
    };


    // ==========================================
    // 4. แจ้งยอดบริจาค & รายรับ
    // ==========================================
    async function handleTransactionForm(formId, prefix) {
        const form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = document.getElementById(`${prefix}-msg`);
            const subBtn = form.querySelector('button[type="submit"]');
            
            if (subBtn) subBtn.disabled = true;
            if (msg) { msg.style.color = 'var(--primary)'; msg.textContent = 'กำลังส่งข้อมูล...'; }

            const type = document.getElementById(`${prefix}-type`)?.value || '';
            const date = document.getElementById(`${prefix}-date`)?.value || '';
            const desc = document.getElementById(`${prefix}-desc`)?.value || '';
            const amount = document.getElementById(`${prefix}-amount`)?.value || 0;
            const slipFile = document.getElementById(`${prefix}-slip`)?.files[0];
            const locInput = document.getElementById(`${prefix}-location`);
            const locationVal = locInput ? locInput.value : null;

            try {
                let slipUrl = null;
                if (slipFile) {
                    const path = `trans-${Date.now()}.${slipFile.name.split('.').pop()}`;
                    await supabaseClient.storage.from('slips').upload(path, slipFile);
                    slipUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
                }
                
                await supabaseClient.from('transactions').insert([{ 
                    transaction_date: date, 
                    transaction_type: type, 
                    description: desc, 
                    location: locationVal, 
                    amount: parseFloat(amount), 
                    slip_url: slipUrl, 
                    status: 'pending', 
                    created_by: currentUser.id 
                }]);
                
                if (msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ ส่งรายการเรียบร้อย รอ Admin ตรวจสอบครับ!'; }
                form.reset(); 
                if (document.getElementById(`${prefix}-date`)) document.getElementById(`${prefix}-date`).valueAsDate = new Date();
                setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);
            } catch (err) { 
                if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ผิดพลาด: ' + err.message; }
            } finally { 
                if (subBtn) subBtn.disabled = false; 
            }
        });
    }
    handleTransactionForm('donation-form', 'don');
    handleTransactionForm('other-trans-form', 'other');


    // ==========================================
    // 5. โหลดข้อมูลตารางและประวัติ
    // ==========================================
    window.loadData = async function() {
        if (!currentUser) return; 
        
        // โหลดธนาคาร
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('bank_name, balance');
            const bBody = document.querySelector('#member-bank-table tbody');
            if (bBody) {
                bBody.innerHTML = banks && banks.length > 0 ? 
                    banks.map(b => `<tr><td>${b.bank_name}</td><td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td></tr>`).join('') : 
                    `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`;
            }
        } catch(e) { console.error(e); }

        // โหลดกองทุน
        try {
            const { data: funds } = await supabaseClient.from('funds').select('fund_name, remaining_budget');
            const fBody = document.querySelector('#member-fund-table tbody');
            if (fBody) {
                fBody.innerHTML = funds && funds.length > 0 ? 
                    funds.map(f => `<tr><td>${f.fund_name}</td><td style="text-align:right; color:var(--primary); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td></tr>`).join('') : 
                    `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`;
            }
        } catch(e) { console.error(e); }

        // โหลดประวัติการเบิกเงิน
        try {
            const tbody = document.querySelector('#member-history-table tbody');
            if (!tbody) return;
            
            const { data, error } = await supabaseClient.from('clearances').select('*').eq('member_id', currentUser.id).order('created_at', { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`; 
                return; 
            }
            
            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const typeLabel = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย';
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                
                let stat = ''; 
                let btn = '-';
                
                if (req.status === 'draft') { 
                    stat = '<span class="status-badge" style="background:#e2e8f0; color:#475569;">📝 ร่าง</span>'; 
                    btn = `<button type="button" onclick="clearAdvance('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">✏️ แก้ไข</button>`;
                }
                else if (req.status === 'pending_advance') { 
                    stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอโอนตั้งต้น</span>'; 
                }
                else if (req.status === 'pending_clearance') { 
                    stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอแอดมินตรวจบิล</span>'; 
                }
                else if (req.status === 'advance_transferred') {
                    // 🌟 เพิ่มปุ่มเคลียร์บิลให้ Member
                    stat = '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">💸 ได้รับเงินแล้ว (รอเคลียร์)</span>';
                    btn = `<button type="button" onclick="clearAdvance('${req.id}')" class="btn btn-primary" style="padding:4px 8px; font-size:12px;">📝 เคลียร์บิล</button>`;
                }
                else if (req.status === 'cleared') { 
                    stat = '<span class="status-badge" style="background:#d1fae5; color:#059669;">✅ อนุมัติเคลียร์แล้ว</span>'; 
                }
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${typeLabel}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:600;">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td style="text-align:center;">${btn}</td>
                    </tr>
                `;
            }).join('');
        } catch(e) { console.error(e); }
    };

    window.loadData();
});
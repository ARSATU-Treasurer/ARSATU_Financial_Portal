document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. ตรวจสอบสิทธิ์ผู้ใช้งาน (Auth)
    // ==========================================
    let currentUser = null;
    
    try {
        // ดึงข้อมูล session จาก Supabase
        const { data, error } = await supabaseClient.auth.getSession();
        
        if (error) {
            throw error;
        }
        
        if (!data.session) {
            console.warn("ไม่พบข้อมูล Session กำลังพากลับหน้า Login...");
            window.location.replace('index.html');
            return;
        }
        
        currentUser = data.session.user;
        
    } catch (err) {
        alert("พบปัญหาการเข้าสู่ระบบ: " + err.message + "\n(กรุณากด OK เพื่อกลับไปล็อกอินใหม่)");
        window.location.replace('index.html');
        return;
    }

    // ฟังก์ชันออกจากระบบ
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            window.location.replace('index.html');
        });
    }


    // ==========================================
    // 2. ระบบ UI ของฟอร์มเบิกเงิน (ทำงานแยกส่วน)
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

        // ฟังก์ชันคำนวณยอดเงินรวม
        window.calculateTotal = () => {
            try {
                let total = 0;
                
                // หาผลรวมจากทุกบรรทัดในตาราง
                if (itemsTbody) {
                    itemsTbody.querySelectorAll('tr').forEach(tr => {
                        const priceInput = tr.querySelector('.item-price');
                        if (priceInput) {
                            total += (parseFloat(priceInput.value) || 0);
                        }
                    });
                }
                
                // แสดงผลรวม
                if (totalSpan) {
                    totalSpan.textContent = total.toLocaleString();
                }

                // คำนวณส่วนต่าง กรณีเบิกล่วงหน้า
                const amt = parseFloat(reqAmt?.value) || 0;
                
                if (reqType?.value === 'advance' && amt > 0) {
                    if (diffSummary) diffSummary.style.display = 'block';
                    
                    const diff = amt - total;
                    
                    if (diff > 0 && total > 0) {
                        if (diffSummary) diffSummary.innerHTML = `🚨 มีเงินเหลือทอนชุมนุม: <br><span style="font-size:18px;">${diff.toLocaleString()} บาท</span>`;
                        if (returnSlip) returnSlip.style.display = 'block';
                    } else if (diff < 0) {
                        if (diffSummary) diffSummary.innerHTML = `💡 คุณสำรองจ่ายเกินไป (ชุมนุมจะโอนคืนให้): <br><span style="font-size:18px;">${Math.abs(diff).toLocaleString()} บาท</span>`;
                        if (returnSlip) returnSlip.style.display = 'none';
                    } else {
                        if (diffSummary) diffSummary.style.display = 'none';
                        if (returnSlip) returnSlip.style.display = 'none';
                    }
                } else {
                    if (diffSummary) diffSummary.style.display = 'none';
                    if (returnSlip) returnSlip.style.display = 'none';
                }
            } catch (e) {
                console.error("Calculate Error:", e);
            }
        };

        // เปลี่ยนประเภทการเบิก (โชว์/ซ่อน ช่องกรอกเงินล่วงหน้า)
        if (reqType) {
            reqType.addEventListener('change', () => {
                if (reqType.value === 'advance') {
                    if (advSec) advSec.style.display = 'block';
                } else {
                    if (advSec) advSec.style.display = 'none';
                    if (reqAmt) reqAmt.value = 0;
                }
                window.calculateTotal();
            });
        }

        // ปุ่มเพิ่มรายการสินค้า
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
                
                // สั่งให้คำนวณใหม่เมื่อมีการพิมพ์ตัวเลข
                tr.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', window.calculateTotal);
                });
                
                // ปุ่มลบบรรทัด
                const delBtn = tr.querySelector('.del-btn');
                if (delBtn) {
                    delBtn.addEventListener('click', () => { 
                        tr.remove(); 
                        window.calculateTotal(); 
                    });
                }
            });
        }

        if (reqAmt) {
            reqAmt.addEventListener('input', window.calculateTotal);
        }

        // กระตุ้นให้คำสั่งทำงาน 1 ครั้ง เพื่อให้ตารางบรรทัดแรกโผล่ขึ้นมา
        if (reqType) reqType.dispatchEvent(new Event('change'));
        if (addBtn) addBtn.click();
    }
    
    // เรียกใช้งานการตั้งค่า UI ทันที
    setupClearanceUI();


    // ==========================================
    // 3. ระบบจัดการฐานข้อมูล (เบิกเงิน)
    // ==========================================
    
    // ดึงแบบร่างกลับมาทำต่อ
    window.editDraft = async function(id) {
        const msg = document.getElementById('req-msg');
        if (msg) { 
            msg.style.color = 'var(--primary)'; 
            msg.textContent = 'กำลังโหลดแบบร่าง...'; 
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' }); 

        try {
            const { data: clearance } = await supabaseClient.from('clearances').select('*').eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);
            
            const draftIdInput = document.getElementById('current-draft-id');
            const reqType = document.getElementById('req-type');
            
            if (draftIdInput) draftIdInput.value = clearance.id;
            
            if (reqType) {
                reqType.value = clearance.request_type;
                reqType.dispatchEvent(new Event('change')); // กระตุ้นให้ฟอร์มเปลี่ยนรูป
            }

            const purposeInput = document.getElementById('req-purpose');
            const reqAmtInput = document.getElementById('req-amount');
            const bankInput = document.getElementById('req-bank');

            if (purposeInput) purposeInput.value = clearance.purpose;
            if (reqAmtInput) reqAmtInput.value = clearance.requested_amount;
            if (bankInput && clearance.member_bank_details) bankInput.value = clearance.member_bank_details;

            const tbody = document.getElementById('items-tbody');
            if (tbody) {
                tbody.innerHTML = ''; // ล้างรายการเก่า
                
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
                        const dBtn = tr.querySelector('.del-btn');
                        if (dBtn) {
                            dBtn.addEventListener('click', () => { 
                                tr.remove(); 
                                window.calculateTotal(); 
                            });
                        }
                    });
                } else {
                    const addBtn = document.getElementById('add-item-btn');
                    if (addBtn) addBtn.click();
                }
            }
            
            window.calculateTotal();
            
            if (msg) { 
                msg.textContent = '✏️ โหลดแบบร่างเรียบร้อย แก้ไขต่อได้เลยครับ'; 
                setTimeout(() => { msg.textContent = ''; }, 3000); 
            }
        } catch (err) {
            console.error(err);
            if (msg) { 
                msg.style.color = 'var(--danger)'; 
                msg.textContent = 'โหลดแบบร่างไม่สำเร็จ'; 
            }
        }
    };

    // บันทึกคำขอเบิกเงิน
    async function processRequest(isDraft) {
        const msg = document.getElementById('req-msg');
        const saveBtn = document.getElementById('save-draft-btn');
        const subBtn = document.getElementById('submit-req-btn');

        if (saveBtn) saveBtn.disabled = true; 
        if (subBtn) subBtn.disabled = true;
        
        if (msg) { 
            msg.style.color = 'var(--primary)'; 
            msg.textContent = 'กำลังเตรียมข้อมูล...'; 
        }

        const draftIdInput = document.getElementById('current-draft-id');
        const draftId = draftIdInput ? draftIdInput.value : '';
        
        const typeInput = document.getElementById('req-type');
        const typeVal = typeInput ? typeInput.value : '';
        
        const purposeInput = document.getElementById('req-purpose');
        const purposeVal = purposeInput ? purposeInput.value : '';
        
        const reqAmtInput = document.getElementById('req-amount');
        const reqAmtVal = reqAmtInput ? (parseFloat(reqAmtInput.value) || 0) : 0;
        
        const bankInput = document.getElementById('req-bank');
        const bankVal = bankInput ? bankInput.value : '';

        // ตรวจสอบข้อมูลก่อนส่ง
        if (!isDraft && purposeVal.trim() === '') {
            if (msg) { 
                msg.style.color = 'var(--danger)'; 
                msg.textContent = 'กรุณากรอกหัวข้อของการเบิกครับ'; 
            }
            if (saveBtn) saveBtn.disabled = false; 
            if (subBtn) subBtn.disabled = false;
            return;
        }

        // ดึงรายการสินค้า
        const items = [];
        let totalActual = 0;
        
        const tbody = document.getElementById('items-tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const nInput = tr.querySelector('.item-name');
                const qInput = tr.querySelector('.item-qty');
                const pInput = tr.querySelector('.item-price');
                
                if (nInput && nInput.value.trim() !== '') {
                    const name = nInput.value;
                    const qty = qInput ? (parseFloat(qInput.value) || 1) : 1;
                    const price = pInput ? (parseFloat(pInput.value) || 0) : 0;
                    
                    items.push({ item_name: name, quantity: qty, total_price: price });
                    totalActual += price;
                }
            });
        }

        // กำหนดสถานะ
        let finalStatus = 'draft';
        if (!isDraft) {
            finalStatus = (typeVal === 'advance' && totalActual === 0) ? 'pending_advance' : 'pending_clearance';
        }

        let sUrl = null, rUrl = null;
        const sFileInput = document.getElementById('req-statement');
        const sFile = sFileInput && sFileInput.files ? sFileInput.files[0] : null;
        
        const rFileInput = document.getElementById('req-return-slip');
        const rFile = rFileInput && rFileInput.files ? rFileInput.files[0] : null;

        try {
            // อัปโหลดไฟล์
            if (sFile) {
                if (msg) msg.textContent = 'กำลังอัปโหลดใบเสร็จ...';
                const path = `statement-${Date.now()}.${sFile.name.split('.').pop()}`;
                await supabaseClient.storage.from('receipts').upload(path, sFile);
                sUrl = supabaseClient.storage.from('receipts').getPublicUrl(path).data.publicUrl;
            }
            if (rFile) {
                if (msg) msg.textContent = 'กำลังอัปโหลดสลิปคืนเงิน...';
                const path = `return-${Date.now()}.${rFile.name.split('.').pop()}`;
                await supabaseClient.storage.from('slips').upload(path, rFile);
                rUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
            }

            if (msg) msg.textContent = 'กำลังบันทึกข้อมูล...';
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
                msg.textContent = isDraft ? '💾 บันทึกแบบร่างเรียบร้อย!' : '✅ ส่งคำขอให้ Admin เรียบร้อย!'; 
            }
            
            // รีเซ็ตฟอร์ม
            const formObj = document.getElementById('complex-clearance-form');
            if (formObj) formObj.reset();
            
            if (draftIdInput) draftIdInput.value = '';
            
            if (tbody) tbody.innerHTML = '';
            
            const addBtn = document.getElementById('add-item-btn');
            if (addBtn) addBtn.click();
            
            window.calculateTotal();
            
            // โหลดตารางใหม่
            if (typeof window.loadData === 'function') {
                window.loadData();
            }
            
            setTimeout(() => { if (msg) msg.textContent = ''; }, 4000);

        } catch (err) {
            console.error(err);
            if (msg) { 
                msg.style.color = 'var(--danger)'; 
                msg.textContent = 'เกิดข้อผิดพลาด: ' + err.message; 
            }
        } finally {
            if (saveBtn) saveBtn.disabled = false; 
            if (subBtn) subBtn.disabled = false;
        }
    }

    const sBtn = document.getElementById('save-draft-btn');
    if (sBtn) sBtn.addEventListener('click', () => processRequest(true));
    
    const submitBtn = document.getElementById('submit-req-btn');
    if (submitBtn) submitBtn.addEventListener('click', () => processRequest(false));


    // ==========================================
    // 4. ระบบฟอร์มแจ้งรายการ (บริจาค & รายรับรายจ่าย)
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

        // ดึงข้อมูลสถานที่ (ถ้าฟอร์มนั้นมีช่องนี้)
        const locInput = document.getElementById(`${prefix}-location`);
        const locationVal = locInput ? locInput.value : null;

        try {
            let slipUrl = null;
            if (slipFile) {
                if (msg) msg.textContent = 'กำลังอัปโหลดหลักฐาน...';
                const path = `trans-${Date.now()}.${slipFile.name.split('.').pop()}`;
                await supabaseClient.storage.from('slips').upload(path, slipFile);
                slipUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
            }

            if (msg) msg.textContent = 'บันทึกข้อมูล...';

            await supabaseClient.from('transactions').insert([{ 
                transaction_date: date, 
                transaction_type: type, 
                description: desc, 
                location: locationVal, // ส่งสถานที่เข้า DB
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
            console.error(err);
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
        
        // 5.1 โหลด Dashboard บัญชีธนาคาร
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('bank_name, balance');
            const bBody = document.querySelector('#member-bank-table tbody');
            if (bBody) {
                if (banks && banks.length > 0) {
                    bBody.innerHTML = banks.map(b => `
                        <tr>
                            <td>${b.bank_name}</td>
                            <td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td>
                        </tr>
                    `).join('');
                } else {
                    bBody.innerHTML = `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูลบัญชี</td></tr>`;
                }
            }
        } catch(e) { 
            console.error("Bank Load Error", e); 
        }

        // 5.2 โหลด Dashboard กองทุน
        try {
            const { data: funds } = await supabaseClient.from('funds').select('fund_name, remaining_budget');
            const fBody = document.querySelector('#member-fund-table tbody');
            if (fBody) {
                if (funds && funds.length > 0) {
                    fBody.innerHTML = funds.map(f => `
                        <tr>
                            <td>${f.fund_name}</td>
                            <td style="text-align:right; color:var(--primary); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td>
                        </tr>
                    `).join('');
                } else {
                    fBody.innerHTML = `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูลกองทุน</td></tr>`;
                }
            }
        } catch(e) { 
            console.error("Fund Load Error", e); 
        }

        // 5.3 โหลดประวัติขอเบิกเงิน (History)
        try {
            const tbody = document.querySelector('#member-history-table tbody');
            if (!tbody) return;
            
            const { data, error } = await supabaseClient
                .from('clearances')
                .select('*')
                .eq('member_id', currentUser.id)
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            if (!data || data.length === 0) { 
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">ยังไม่มีประวัติการเบิกเงิน</td></tr>`; 
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
                    btn = `<button type="button" onclick="editDraft('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">✏️ ทำต่อ</button>`; 
                }
                else if (req.status.includes('pending')) {
                    stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอตรวจ</span>';
                }
                else if (req.status === 'advance_transferred') {
                    stat = '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">💸 รอเคลียร์บิล</span>';
                }
                else if (req.status === 'cleared') {
                    stat = '<span class="status-badge" style="background:#d1fae5; color:#059669;">✅ อนุมัติ</span>';
                }
                
                return `
                    <tr>
                        <td>${date}</td>
                        <td>${typeLabel}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:600;">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td>${btn}</td>
                    </tr>
                `;
            }).join('');
            
        } catch(e) { 
            console.error("History Load Error", e); 
            const tbody = document.querySelector('#member-history-table tbody');
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">โหลดประวัติไม่สำเร็จ กรุณากด F5</td></tr>`;
        }
    };

    // เรียกโหลดข้อมูลตารางต่างๆ 
    window.loadData();

});

// โหลดเลขบัญชีเดิมมาแสดง
async function loadMyProfile() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data: profile } = await supabaseClient.from('profiles').select('bank_details').eq('id', user.id).single();
    if (profile && profile.bank_details) {
        document.getElementById('my-bank-info').value = profile.bank_details;
        // ถ้ามีข้อมูล ให้ใส่ในช่องเลขบัญชีของฟอร์มเบิกเงินรอไว้เลย
        if(document.getElementById('member-bank-details')) {
            document.getElementById('member-bank-details').value = profile.bank_details;
        }
    }
}

// บันทึกเลขบัญชีใหม่
async function saveProfileBank() {
    const btn = document.getElementById('save-bank-btn');
    const info = document.getElementById('my-bank-info').value;
    btn.disabled = true;
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { error } = await supabaseClient.from('profiles').update({ bank_details: info }).eq('id', user.id);
    
    if (error) alert("เกิดข้อผิดพลาด: " + error.message);
    else {
        alert("บันทึกเลขบัญชีเรียบร้อย!");
        if(document.getElementById('member-bank-details')) {
            document.getElementById('member-bank-details').value = info;
        }
    }
    btn.disabled = false;
}

// เรียกใช้ตอนโหลดหน้า
loadMyProfile();
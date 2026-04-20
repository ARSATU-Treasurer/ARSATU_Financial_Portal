document.addEventListener('DOMContentLoaded', async () => {
    

    // ==========================================
    // 🌟 ระบบเช็กล็อกอิน (V7.0 ดั้งเดิม เสถียรที่สุด)
    // ==========================================
    let currentUser = null;
    window.isClearingAdvance = false;

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error || !data.session) { 
            window.location.replace('index.html'); 
            return; 
        }
        currentUser = data.session.user;
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

    // ==========================================
    // 🌟 ฟังก์ชัน Co-Worker (V7.0)
    // ==========================================
    window.loadCoWorkers = async function() {
        try {
            const { data, error } = await supabaseClient.from('profiles').select('id, full_name, department').eq('status', 'approved').neq('id', currentUser.id);
            if (error) throw error;
            
            const cwList = document.getElementById('select-coworker-list');
            if (cwList) {
                cwList.innerHTML = ''; 
                if (data && data.length > 0) {
                    data.forEach(user => {
                        const lbl = document.createElement('label');
                        lbl.style.display = 'block'; 
                        lbl.style.marginBottom = '10px'; 
                        lbl.style.cursor = 'pointer'; 
                        lbl.style.fontSize = '14px'; 
                        lbl.style.padding = '10px'; 
                        lbl.style.background = '#f8fafc'; 
                        lbl.style.border = '1px solid #e2e8f0'; 
                        lbl.style.borderRadius = '8px';
                        
                        lbl.innerHTML = `
                            <input type="checkbox" class="co-worker-cb-create" value="${user.id}" data-name="${user.full_name}" style="margin-right:10px; transform: scale(1.3);"> 
                            <strong style="color:var(--text-main);">${user.full_name}</strong> <br>
                            <span style="color:gray; font-size:12px; margin-left: 26px;">ฝ่าย: ${user.department || 'ส่วนกลาง'}</span>
                        `;
                        cwList.appendChild(lbl);
                    });
                } else { 
                    cwList.innerHTML = '<span style="color:gray; font-size:13px;">ไม่มีรายชื่อผู้ใช้งานคนอื่นในระบบ</span>'; 
                }
            }
        } catch(e) { 
            console.error("โหลดรายชื่อ Co-Worker ไม่สำเร็จ:", e); 
        }
    };

    window.openSelectCoWorkerModal = function() { 
        document.getElementById('select-coworker-modal').style.display = 'flex'; 
    };

    window.confirmCoWorkerSelection = function() {
        const checkboxes = document.querySelectorAll('.co-worker-cb-create:checked');
        const summary = document.getElementById('coworker-summary');
        
        if (checkboxes.length === 0) {
            summary.innerHTML = 'ไม่มี Co-Worker (ทำรายการของตัวเอง)'; 
            summary.style.color = 'var(--text-muted)';
        } else {
            const names = Array.from(checkboxes).map(cb => cb.getAttribute('data-name'));
            let text = names.length > 2 ? `${names[0]}, ${names[1]} และอีก ${names.length - 2} คน` : names.join(', ');
            summary.innerHTML = `✅ เพิ่มแล้ว <strong style="font-size:15px;">${checkboxes.length}</strong> คน: <br><span style="font-size:12px; color:var(--text-main); font-weight:normal;">${text}</span>`;
            summary.style.color = 'var(--success)';
        }
        document.getElementById('select-coworker-modal').style.display = 'none';
    };

    // ==========================================
    // 🌟 ระบบเพิ่มรายการเบิก (1. ส่วนการคำนวณและปุ่มแมนนวล)
    // ==========================================
    function setupClearanceUI() {
        window.calculateTotal = () => {
            try { 
                let total = 0;
                const tbody = document.getElementById('items-tbody');
                if (tbody) { 
                    tbody.querySelectorAll('tr').forEach(tr => { 
                        const priceInput = tr.querySelector('.item-price'); 
                        if (priceInput) total += (parseFloat(priceInput.value) || 0); 
                    }); 
                }
                
                total = Math.round(total * 100) / 100;
                
                const totalSpan = document.getElementById('total-actual');
                if (totalSpan) totalSpan.textContent = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                
                const reqType = document.getElementById('req-type');
                const reqAmt = document.getElementById('req-amount');
                const diffSummary = document.getElementById('diff-summary'); 
                const returnSlip = document.getElementById('return-slip-section');
                
                const amt = parseFloat(reqAmt?.value) || 0;
                if (reqType?.value === 'advance' && window.isClearingAdvance === true) {
                    if (diffSummary) diffSummary.style.display = 'block'; 
                    const diff = amt - total;
                    if (diff > 0) {
                        if (diffSummary) { 
                            diffSummary.innerHTML = `🚨 มีเงินเหลือทอนชุมนุม: <br><span style="font-size:18px;">${diff.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>`; 
                            diffSummary.style.color = 'var(--danger)'; 
                        }
                        if (returnSlip) returnSlip.style.display = 'block';
                    } else if (diff < 0) {
                        if (diffSummary) { 
                            diffSummary.innerHTML = `💡 คุณสำรองจ่ายเกินไป (ชุมนุมจะโอนเพิ่มให้): <br><span style="font-size:18px;">${Math.abs(diff).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>`; 
                            diffSummary.style.color = 'var(--warning)'; 
                        }
                        if (returnSlip) returnSlip.style.display = 'none';
                    } else {
                        if (diffSummary) { 
                            diffSummary.innerHTML = `✅ ยอดพอดี (ไม่มีเงินทอน)`; 
                            diffSummary.style.color = 'var(--success)'; 
                        }
                        if (returnSlip) returnSlip.style.display = 'none';
                    }
                } else { 
                    if (diffSummary) diffSummary.style.display = 'none'; 
                    if (returnSlip) returnSlip.style.display = 'none'; 
                }
            } catch (e) { 
                console.error("Calculation Error:", e); 
            }
        };

        const reqType = document.getElementById('req-type');
        if (reqType) {
            reqType.onchange = () => {
                const advSec = document.getElementById('advance-section');
                const reqAmt = document.getElementById('req-amount');
                if (reqType.value === 'advance') {
                    if (advSec) advSec.style.display = 'block';
                } else {
                    if (advSec) advSec.style.display = 'none';
                    if (reqAmt && !window.isClearingAdvance) reqAmt.value = 0;
                }
                window.calculateTotal();
            };
        }

        const addBtn = document.getElementById('add-item-btn');
        if (addBtn) {
            addBtn.onclick = () => {
                const tbody = document.getElementById('items-tbody');
                if (!tbody) return; 
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" class="item-name" placeholder="ชื่อรายการ" required></td>
                    <td><input type="number" class="item-qty" min="1" value="1" required></td>
                    <td><input type="number" class="item-price" min="0" step="0.01" value="0" required></td>
                    <td style="text-align: center;"><button type="button" class="btn btn-danger del-btn" style="padding: 6px 10px; font-size: 12px;">ลบ</button></td>
                `;
                tbody.appendChild(tr); 
                
                tr.querySelectorAll('input').forEach(input => input.oninput = window.calculateTotal); 
                const delBtn = tr.querySelector('.del-btn');
                if (delBtn) delBtn.onclick = () => { tr.remove(); window.calculateTotal(); };
            };
        }

        const reqAmt = document.getElementById('req-amount');
        if (reqAmt) reqAmt.oninput = window.calculateTotal;

        if (reqType) reqType.dispatchEvent(new Event('change'));
        if (addBtn) addBtn.onclick(); 
    }
    
    setupClearanceUI();

    // ==========================================
    // 🌟 ระบบ CSV และปุ่มเมนู (2. ใช้ Event Delegation แบบเรดาร์ตรวจจับ)
    // ==========================================
    
    // เรดาร์ตรวจจับการคลิก (เปิด-ปิดเมนู CSV)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'toggle-import-btn') {
            const importSec = document.getElementById('import-section');
            if (importSec) {
                importSec.style.display = (importSec.style.display === 'none' || importSec.style.display === '') ? 'block' : 'none';
            }
        }
    });

    // เรดาร์ตรวจจับการอัปโหลดไฟล์ (CSV Upload)
    document.addEventListener('change', function(e) {
        if (e.target && e.target.id === 'csv-upload') {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const text = event.target.result;
                    
                    // 🌟 ฟังก์ชันอ่าน CSV แบบมาตรฐาน (รองรับ Enter และลูกน้ำในช่อง)
                    function parseCSV(str) {
                        const arr = [];
                        let quote = false;
                        let row = 0, col = 0;
                        for (let c = 0; c < str.length; c++) {
                            let cc = str[c], nc = str[c+1];
                            arr[row] = arr[row] || [];
                            arr[row][col] = arr[row][col] || '';
                            
                            if (cc === '"' && quote && nc === '"') { arr[row][col] += cc; ++c; continue; }
                            if (cc === '"') { quote = !quote; continue; }
                            if (cc === ',' && !quote) { ++col; continue; }
                            if (cc === '\r' && nc === '\n' && !quote) { ++row; col = 0; ++c; continue; }
                            if (cc === '\n' && !quote) { ++row; col = 0; continue; }
                            if (cc === '\r' && !quote) { ++row; col = 0; continue; }
                            
                            arr[row][col] += cc;
                        }
                        return arr;
                    }

                    const rows = parseCSV(text);
                    const tbody = document.getElementById('items-tbody');
                    if (!tbody) return;

                    let count = 0;
                    // เริ่มอ่านแถวที่ 2 (ข้ามหัวตาราง)
                    for (let i = 1; i < rows.length; i++) {
                        const cols = rows[i];
                        // ฟอร์แมตต้องมีอย่างน้อย 5 คอลัมน์
                        if (!cols || cols.length < 5) continue; 

                        // 1. ดึงชื่อรายการ (คอลัมน์ที่ 2 / Index 1)
                        let itemName = cols[1] ? cols[1].trim() : '';

                        // 🎯 2. ตัวกรองสุดเข้มงวด (กรองของปลอมทิ้งให้หมด)
                        if (!itemName) continue; // ข้ามบรรทัดที่รายการว่างเปล่า
                        if (itemName === 'รายการ') continue; // ข้ามหัวตาราง
                        if (itemName.includes('รวม') || itemName.toLowerCase().includes('insert row')) continue; // ข้ามบรรทัดสรุปและคำแนะนำ

                        // 3. ดึงจำนวน (คอลัมน์ที่ 4 / Index 3)
                        const qtyStr = cols[3] ? cols[3].replace(/,/g, '').trim() : '1';
                        let qty = parseFloat(qtyStr);
                        if (isNaN(qty) || qty <= 0) qty = 1; // ถ้าแปลงเป็นตัวเลขไม่ได้ ให้บังคับเป็น 1
                        
                        // 4. ดึงราคารวม (คอลัมน์ที่ 5 / Index 4)
                        const priceStr = cols[4] ? cols[4].replace(/,/g, '').trim() : '0';
                        let price = parseFloat(priceStr);
                        if (isNaN(price) || price < 0) price = 0; // ถ้าแปลงเป็นตัวเลขไม่ได้ (NaN) ให้บังคับเป็น 0

                        // 5. สร้างบรรทัดในตาราง
                        const tr = document.createElement('tr');
                        const safeItemName = itemName.replace(/"/g, '&quot;'); // กัน Error เครื่องหมายคำพูด
                        
                        tr.innerHTML = `
                            <td><input type="text" class="item-name" value="${safeItemName}" required></td>
                            <td><input type="number" class="item-qty" min="1" value="${qty}" required></td>
                            <td><input type="number" class="item-price" min="0" step="0.01" value="${price}" required></td>
                            <td style="text-align: center;"><button type="button" class="btn btn-danger del-btn" style="padding: 6px 10px; font-size: 12px;">ลบ</button></td>
                        `;
                        tbody.appendChild(tr);
                        
                        tr.querySelectorAll('input').forEach(inp => inp.oninput = window.calculateTotal);
                        const delBtn = tr.querySelector('.del-btn');
                        if (delBtn) delBtn.onclick = () => { tr.remove(); window.calculateTotal(); };
                        count++;
                    }
                    
                    window.calculateTotal();
                    if(typeof showToast === 'function') {
                        showToast(`ดึงข้อมูลสำเร็จ ${count} รายการ!`, 'success');
                    } else {
                        alert(`ดึงข้อมูลสำเร็จ ${count} รายการ!`);
                    }
                    
                    const importSec = document.getElementById('import-section');
                    if(importSec) importSec.style.display = 'none'; 
                    
                } catch (err) {
                    if(typeof showToast === 'function') {
                        showToast('รูปแบบไฟล์ CSV ไม่ถูกต้อง', 'error');
                    } else {
                        alert('รูปแบบไฟล์ CSV ไม่ถูกต้อง');
                    }
                    console.error("CSV Parse Error:", err);
                }
                e.target.value = ''; // รีเซ็ตเพื่อให้อัปโหลดไฟล์เดิมซ้ำได้
            };
            reader.readAsText(file);
        }
    });

    // ==========================================
    // 🌟 ระบบส่งข้อมูล / บันทึกร่าง
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
        const deptVal = document.getElementById('req-dept')?.value || '';

        if (!isDraft) {
            if (purposeVal.trim() === '') { 
                if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณากรอกหัวข้อการเบิก'; } 
                if (saveBtn) saveBtn.disabled = false; if (subBtn) subBtn.disabled = false; 
                return; 
            }
            if (!window.isClearingAdvance && deptVal === '') { 
                if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณาเลือกฝ่าย'; } 
                if (saveBtn) saveBtn.disabled = false; if (subBtn) subBtn.disabled = false; 
                return; 
            }
        }

        const items = []; let totalActual = 0;
        document.getElementById('items-tbody')?.querySelectorAll('tr').forEach(tr => {
            const nInput = tr.querySelector('.item-name'); 
            const qInput = tr.querySelector('.item-qty'); 
            const pInput = tr.querySelector('.item-price');
            
            if (nInput && nInput.value.trim() !== '') { 
                const price = parseFloat(pInput.value) || 0; 
                items.push({ item_name: nInput.value, quantity: parseFloat(qInput.value)||1, total_price: price }); 
                totalActual += price; 
            }
        });

        let finalStatus;
        if (isDraft) { 
            finalStatus = window.isClearingAdvance ? 'advance_transferred' : 'draft'; 
        } else { 
            finalStatus = window.isClearingAdvance ? 'pending_clearance' : (typeVal === 'advance' ? 'pending_advance' : 'pending_clearance'); 
        }

        const sFile = document.getElementById('req-statement')?.files[0]; 
        const rFile = document.getElementById('req-return-slip')?.files[0];

        try {
            let sUrl = null, rUrl = null;
            if (sFile) {
                if(msg) msg.textContent = 'กำลังอัปโหลดไฟล์หลักฐาน...';
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
            const stmtPwd = document.getElementById('req-statement-password')?.value || null;

            const coWorkerIds = []; 
            document.querySelectorAll('.co-worker-cb-create:checked').forEach(cb => coWorkerIds.push(cb.value));

            const clearanceData = { 
                member_id: currentUser.id, 
                co_worker_ids: coWorkerIds.length > 0 ? coWorkerIds : null, 
                request_type: typeVal, 
                purpose: purposeVal, 
                requested_amount: reqAmtVal, 
                total_actual_amount: totalActual, 
                status: finalStatus, 
                member_bank_details: bankVal, 
                statement_password: stmtPwd 
            };
            
            if (!window.isClearingAdvance) { clearanceData.department = deptVal || '-'; }
            if (sUrl) clearanceData.statement_url = sUrl; 
            if (rUrl) clearanceData.member_return_slip = rUrl;

            if (draftId) { 
    const { error: updateErr } = await supabaseClient.from('clearances').update(clearanceData).eq('id', draftId); 
    if (updateErr) throw new Error("บันทึกบิลหลักไม่สำเร็จ: " + updateErr.message);
    await supabaseClient.from('clearance_items').delete().eq('clearance_id', draftId); 
} else { 
    const { data, error: insertErr } = await supabaseClient.from('clearances').insert([clearanceData]).select(); 
    if (insertErr) throw new Error("สร้างบิลหลักไม่สำเร็จ: " + insertErr.message);
    clearanceId = data[0].id; 
}

// ใช้งาน Manual Rollback
if (items.length > 0) { 
    const itemsToInsert = items.map(i => ({ 
        clearance_id: clearanceId, 
        item_name: i.item_name, 
        quantity: i.quantity, 
        total_price: i.total_price 
    })); 
    
    const { error: itemError } = await supabaseClient.from('clearance_items').insert(itemsToInsert); 
    
    // ถ้าเซฟรายการย่อยพัง และไม่ใช่การแก้ดราฟต์ ให้ลบบิลหลักทิ้งทันที
    if (itemError) {
        if (!draftId) {
            await supabaseClient.from('clearances').delete().eq('id', clearanceId);
        }
        throw new Error("บันทึกรายการสินค้าไม่สำเร็จ ระบบได้ยกเลิกคำขอนี้แล้ว กรุณาลองใหม่");
    }
}

            if (msg) { 
                msg.style.color = 'var(--success)'; 
                msg.textContent = isDraft ? '💾 บันทึกแบบร่างเรียบร้อย' : '✅ ส่งคำขอเรียบร้อย'; 
            }

            if (!isDraft) {
                const typeLabel = typeVal === 'advance' ? 'ขอเบิกล่วงหน้า (Advance)' : 'เคลียร์บิล / สำรองจ่าย';
                let memberName = document.getElementById('current-user-name')?.textContent || 'สมาชิกค่าย';
                if (memberName === 'กำลังโหลด...' || !memberName) memberName = 'สมาชิกค่าย';
                
                const finalAmt = reqAmtVal > 0 && typeVal === 'advance' && !window.isClearingAdvance ? reqAmtVal : totalActual;
                
                const alertMessage = `🚨 มีรายการเบิกเงินใหม่ 🚨\n\n👤 ผู้เบิก: ${memberName}\n📁 ฝ่าย: ${deptVal || '-'}\n📌 หัวข้อ: ${purposeVal}\n💰 ยอดเงิน: ฿${finalAmt.toLocaleString()}\n🏷️ ประเภท: ${typeLabel}\n\n🙏 เหรัญญิกตรวจสอบได้ที่ Admin Dashboard ครับ`;
                if (window.sendLineMessage) window.sendLineMessage(alertMessage);
            }
            
            const formObj = document.getElementById('complex-clearance-form'); 
            if (formObj) { 
                formObj.reset(); 
                formObj.dispatchEvent(new Event('reset')); 
            }
            
            document.getElementById('current-draft-id').value = ''; 
            document.getElementById('req-type').disabled = false; 
            document.getElementById('req-purpose').disabled = false; 
            document.getElementById('req-amount').disabled = false; 
            document.getElementById('req-amount').readOnly = false;
            
            const deptSelect = document.getElementById('req-dept'); 
            if(deptSelect) deptSelect.disabled = false;

            document.querySelectorAll('.co-worker-cb-create').forEach(cb => cb.checked = false); 
            window.confirmCoWorkerSelection();

            document.getElementById('submit-req-btn').innerHTML = '🚀 ส่งคำขอ'; 
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

    window.clearAdvance = async function(id) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active')); 
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('tab-clearance').classList.add('active'); 
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active'); 
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
        
        const msg = document.getElementById('req-msg'); 
        if (msg) { msg.style.color = 'var(--primary)'; msg.textContent = 'กำลังโหลดข้อมูล...'; }

        try {
            const { data: c } = await supabaseClient.from('clearances').select('*').eq('id', id).single();
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            document.getElementById('current-draft-id').value = c.id;
            
            const typeSelect = document.getElementById('req-type'); 
            const purposeInput = document.getElementById('req-purpose'); 
            const amtInput = document.getElementById('req-amount'); 
            const deptSelect = document.getElementById('req-dept'); 
            const submitBtn = document.getElementById('submit-req-btn');

            typeSelect.value = c.request_type || 'reimbursement'; 
            purposeInput.value = c.purpose || ''; 
            amtInput.value = c.requested_amount || 0; 
            if (deptSelect && c.department) deptSelect.value = c.department;

            document.querySelectorAll('.co-worker-cb-create').forEach(cb => { 
                cb.checked = c.co_worker_ids && c.co_worker_ids.includes(cb.value); 
            }); 
            window.confirmCoWorkerSelection();

            if (c.status === 'draft') {
                window.isClearingAdvance = false; 
                typeSelect.disabled = false; 
                purposeInput.disabled = false; 
                amtInput.disabled = false; 
                amtInput.readOnly = false; 
                if (deptSelect) deptSelect.disabled = false; 
                submitBtn.innerHTML = '🚀 ส่งคำขอ'; 
                if (msg) msg.textContent = '✏️ โหมดแก้ไขแบบร่าง';
            } else {
                window.isClearingAdvance = true; 
                typeSelect.disabled = true; 
                purposeInput.disabled = true; 
                amtInput.disabled = true; 
                amtInput.readOnly = true; 
                if (deptSelect) deptSelect.disabled = true; 
                submitBtn.innerHTML = '🚀 ส่งบิลเคลียร์เงิน'; 
                if (msg) msg.textContent = '📝 โหมดเคลียร์บิล: กรุณาแก้ไขราคาตามจริงและแนบสลิป';
            }

            typeSelect.dispatchEvent(new Event('change'));

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
            setTimeout(() => { if(msg) msg.textContent = ''; }, 4000);
        } catch (err) { 
            console.error(err); 
            if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'โหลดข้อมูลไม่สำเร็จ'; } 
        }
    };

    // ==========================================
    // 🌟 ธุรกรรมอื่นๆ (บริจาค/รายรับ/รายจ่าย)
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
                    department: 'ส่วนกลาง', 
                    created_by: currentUser.id 
                }]);
                
                if (msg) { msg.style.color = 'var(--success)'; msg.textContent = '✅ ส่งรายการเพื่อตรวจสอบเรียบร้อย'; }

                let typeLabel = 'รายการ';
                if (type === 'donation_cash') typeLabel = 'รับบริจาค (เงินสด)'; 
                else if (type === 'donation_transfer') typeLabel = 'รับบริจาค (โอน)'; 
                else if (type === 'income') typeLabel = 'รายรับเข้าชุมนุม'; 
                else if (type === 'expense') typeLabel = 'รายจ่ายอื่นๆ';
                
                let memberName = document.getElementById('current-user-name')?.textContent || 'สมาชิกค่าย'; 
                if (memberName === 'กำลังโหลด...' || !memberName) memberName = 'สมาชิกค่าย';
                
                const alertMsg = `📥 มีรายการแจ้งเงินใหม่ (รอตรวจสอบ)\n\n👤 ผู้แจ้ง: ${memberName}\n🏷️ ประเภท: ${typeLabel}\n📝 รายละเอียด: ${desc}\n💰 ยอดเงิน: ฿${parseFloat(amount).toLocaleString()}\n\n🙏 เหรัญญิกตรวจสอบได้ที่หน้า Dashboard ครับ`;
                if (window.sendLineMessage) window.sendLineMessage(alertMsg);

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
    // 🌟 โหลดสรุปยอดเงินสำหรับ Member (Dashboard)
    // ==========================================
    window.loadMemberDashboard = async function() {
        if (!currentUser) return;
        try {
            const { data: clearances } = await supabaseClient
                .from('clearances')
                .select('requested_amount, total_actual_amount, status')
                .eq('member_id', currentUser.id)
                .neq('status', 'cancelled');

            let received = 0;
            let pending = 0;

            if (clearances) {
                clearances.forEach(req => {
                    if (['advance_transferred', 'cleared'].includes(req.status)) {
                        received += (req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount);
                    } else if (['pending_advance', 'pending_clearance'].includes(req.status)) {
                        pending += (req.requested_amount > 0 ? req.requested_amount : req.total_actual_amount);
                    }
                });
            }

            if(document.getElementById('mem-dash-received')) document.getElementById('mem-dash-received').textContent = `฿${received.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            if(document.getElementById('mem-dash-pending')) document.getElementById('mem-dash-pending').textContent = `฿${pending.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

        } catch (err) {
            console.error("Member Dashboard Error:", err);
        }
    };
    
    // ==========================================
    // 🌟 โหลดข้อมูลเข้าตาราง (V7.0)
    // ==========================================
    window.loadData = async function() {
        if (!currentUser) return; 
        
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('bank_name, balance'); 
            const bBody = document.querySelector('#member-bank-table tbody');
            if (bBody) { 
                bBody.innerHTML = banks && banks.length > 0 ? banks.map(b => `<tr><td>${b.bank_name}</td><td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td></tr>`).join('') : `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`; 
            }
        } catch(e) {}

        try {
            const { data: funds } = await supabaseClient.from('funds').select('fund_name, remaining_budget'); 
            const fBody = document.querySelector('#member-fund-table tbody');
            if (fBody) { 
                fBody.innerHTML = funds && funds.length > 0 ? funds.map(f => `<tr><td>${f.fund_name}</td><td style="text-align:right; color:var(--primary); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td></tr>`).join('') : `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`; 
            }
        } catch(e) {}

        try {
            const tbody = document.querySelector('#member-history-table tbody'); 
            if (!tbody) return;
            
            const { data, error } = await supabaseClient.from('clearances')
                .select('*, profiles!member_id(full_name)')
                .or(`member_id.eq.${currentUser.id},co_worker_ids.cs.{${currentUser.id}}`)
                .order('created_at', { ascending: false });
            
            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH'); 
                const typeLabel = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย'; 
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                
                let stat = '', btn = '-';
                
                if (req.status === 'draft') { 
                    stat = '<span class="status-badge" style="background:#e2e8f0; color:#475569;">📝 ร่าง</span>'; 
                    btn = `<button type="button" onclick="clearAdvance('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:12px; width:100%;">✏️ แก้ไข</button>`; 
                }
                else if (req.status === 'pending_advance') { stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอโอนตั้งต้น</span>'; }
                else if (req.status === 'pending_clearance') { stat = '<span class="status-badge" style="background:#fef3c7; color:#d97706;">⏳ รอตรวจบิล</span>'; }
                else if (req.status === 'advance_transferred') { 
                    stat = '<span class="status-badge" style="background:#dbeafe; color:#2563eb;">💸 รอเคลียร์บิล</span>'; 
                    btn = `<button type="button" onclick="clearAdvance('${req.id}')" class="btn btn-primary" style="padding:4px 8px; font-size:12px; width:100%;">📝 เคลียร์บิล</button>`; 
                }
                else if (req.status === 'cleared') { stat = '<span class="status-badge" style="background:#d1fae5; color:#059669;">✅ อนุมัติเคลียร์แล้ว</span>'; }
                else if (req.status === 'cancelled') { stat = '<span class="status-badge" style="background:#fee2e2; color:#ef4444;">❌ ยกเลิก/ไม่อนุมัติ</span>'; }
                
                let cwBtn = `<button type="button" onclick="openCoWorkerModal('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; display:block; margin-top:5px; width:100%; border-color:var(--primary); color:var(--primary);">👥 จัดการ Co-Worker</button>`;
                let viewBtn = `<button type="button" onclick="viewClearance('${req.id}')" class="btn btn-info" style="padding:4px 8px; font-size:11px; display:block; margin-top:5px; width:100%;">🔍 ดูบิลย่อย</button>`;
                
                // 👇 เพิ่มเงื่อนไขปุ่มยกเลิก: ให้กดได้เฉพาะบิลที่ยังไม่เสร็จสิ้น
                let cancelBtn = '';
                if (['draft', 'pending_advance', 'pending_clearance'].includes(req.status)) {
                    cancelBtn = `<button type="button" onclick="cancelRecord('${req.id}', 'clearances')" class="btn btn-danger" style="padding:4px 8px; font-size:11px; display:block; margin-top:5px; width:100%; background: #ef4444; color:white; border:none;">🗑️ ยกเลิก</button>`;
                }

                return `
                    <tr>
                        <td>${date}</td>
                        <td>${typeLabel}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:600;">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td style="text-align:center;">
                            <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
                                ${btn}
                                ${viewBtn}
                                ${cwBtn}
                                ${cancelBtn} </div>
                        </td>
                    </tr>
                        <td>${date}</td>
                        <td>${typeLabel}</td>
                        <td>${req.purpose}</td>
                        <td style="font-weight:600;">฿${parseFloat(amt).toLocaleString()}</td>
                        <td>${stat}</td>
                        <td style="text-align:center;">
                            <div style="display:flex; flex-direction:column; gap:5px; align-items:center;">
                                ${btn}
                                ${viewBtn}
                                ${cwBtn}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch(e) { console.error(e); }
        window.loadMemberDashboard();
    };

    window.viewClearance = async function(id) {
        document.getElementById('view-clearance-modal').style.display = 'flex'; 
        const content = document.getElementById('view-clearance-content'); 
        content.innerHTML = 'กำลังโหลดข้อมูล...';
        
        try {
            const { data: c } = await supabaseClient.from('clearances').select(`*, profiles!member_id(full_name)`).eq('id', id).single(); 
            const { data: items } = await supabaseClient.from('clearance_items').select('*').eq('clearance_id', id);

            let itemsHtml = '<div style="padding:15px; text-align:center; color:gray; background:#f4f6f9; border-radius:6px;">ไม่มีรายการย่อย</div>';
            if (items && items.length > 0) {
                itemsHtml = `
                    <table style="width:100%; background:#f8fafc; border-radius:6px; margin-top:10px;">
                        <thead>
                            <tr>
                                <th style="padding:8px;">รายการ</th>
                                <th style="text-align:center;">จำนวน</th>
                                <th style="text-align:right; padding-right:8px;">ราคารวม</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(it => `
                                <tr>
                                    <td style="padding:8px; border-bottom:1px solid #eee;">${it.item_name}</td>
                                    <td style="text-align:center; border-bottom:1px solid #eee;">${it.quantity}</td>
                                    <td style="text-align:right; padding-right:8px; border-bottom:1px solid #eee;">฿${parseFloat(it.total_price).toLocaleString()}</td>
                                </tr>
                            `).join('')}
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
                            <tr><td style="padding:4px 0; color:gray; width:35%;">ผู้เบิก:</td><td style="font-weight:bold;">${c.profiles?.full_name||'-'}</td></tr>
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
            showToast("อัปเดตรายชื่อ Co-Worker สำเร็จ", "success"); 
            document.getElementById('coworker-modal').style.display = 'none'; 
            window.loadData();
        } catch(e) { 
            showToast("เกิดข้อผิดพลาด: " + e.message, "error"); 
        } finally { 
            btn.disabled = false; 
            btn.textContent = '💾 บันทึก'; 
        }
    };

    window.loadUserProfileAndNoti = async function() {
        if (!currentUser) return;
        try {
            const { data: profile } = await supabaseClient.from('profiles').select('full_name, role').eq('id', currentUser.id).single();
            if (profile) {
                document.getElementById('current-user-name').textContent = profile.full_name || 'Member';
                if (profile.role === 'admin') {
                    document.getElementById('switch-role-btn').style.display = 'block'; 
                    document.getElementById('current-user-role').textContent = 'ผู้ดูแลระบบ (โหมดจำลอง)'; 
                    document.getElementById('current-user-role').style.color = 'var(--success)';
                }
            }

            const { count } = await supabaseClient.from('clearances').select('*', { count: 'exact', head: true }).eq('member_id', currentUser.id).eq('status', 'advance_transferred');
            const badge = document.getElementById('noti-badge');
            
            if (count > 0 && badge) { 
                badge.textContent = count; 
                badge.style.display = 'inline-block'; 
                document.getElementById('noti-bell').onclick = () => showToast(`คุณมีเงินเบิกล่วงหน้าที่ต้องเคลียร์บิล จำนวน ${count} รายการ`, "warning"); 
            } else if (badge) { 
                badge.style.display = 'none'; 
                document.getElementById('noti-bell').onclick = () => showToast("คุณไม่มีบิลค้างเคลียร์", "success"); 
            }
        } catch(e) { 
            console.error("Noti Error:", e); 
        }
    };
    
    window.loadUserProfileAndNoti();
    window.loadData();
    window.loadCoWorkers();

    setTimeout(() => {
        if (!localStorage.getItem('hasSeenFlowchart')) {
            const howToModal = document.getElementById('howto-modal'); 
            if (howToModal) { 
                howToModal.style.display = 'flex'; 
                localStorage.setItem('hasSeenFlowchart', 'true'); 
            }
        }
    }, 1000);

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
});
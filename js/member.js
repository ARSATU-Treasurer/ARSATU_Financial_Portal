document.addEventListener('DOMContentLoaded', async () => {

    // 🌟 ฟังก์ชันผู้ช่วยส่ง LINE
    window.sendLineMessage = function(msg) {
        const gasUrl = '[https://script.google.com/macros/s/AKfycbxwOJ9BznMdOSDscRglTNsykif2N1NdMgb8_X7UAmyJd3vZx0mb-y9pJ9xdUI93b4Bt/exec](https://script.google.com/macros/s/AKfycbxwOJ9BznMdOSDscRglTNsykif2N1NdMgb8_X7UAmyJd3vZx0mb-y9pJ9xdUI93b4Bt/exec)'; 
        fetch(gasUrl, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify_admin', message: msg }) }).catch(e => console.log(e));
    };

    let currentUser = null;
    window.isClearingAdvance = false;

    // 🌟 V.7.1 โหลดรายชื่อเป็น Checkbox
    window.loadCoWorkers = async function() {
        try {
            const { data } = await supabaseClient.from('profiles').select('id, full_name, department').eq('status', 'approved').neq('id', currentUser.id);
            const cwList = document.getElementById('req-co-worker-list');
            if (cwList && data) {
                cwList.innerHTML = ''; 
                data.forEach(user => {
                    const lbl = document.createElement('label');
                    lbl.style.display = 'block';
                    lbl.style.marginBottom = '8px';
                    lbl.style.cursor = 'pointer';
                    lbl.style.fontSize = '14px';
                    lbl.innerHTML = `<input type="checkbox" class="co-worker-cb" value="${user.id}" style="margin-right:8px; transform: scale(1.2);"> ${user.full_name} <span style="color:gray; font-size:12px;">(${user.department || 'ส่วนกลาง'})</span>`;
                    cwList.appendChild(lbl);
                });
            }
        } catch(e) { console.error("โหลดรายชื่อเพื่อนไม่สำเร็จ:", e); }
    };

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

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            const source = localStorage.getItem('loginSource');
            localStorage.removeItem('loginSource');
            if (source === 'liff') window.location.replace('index-liff.html');
            else window.location.replace('index.html');
        });
    }

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
                if (totalSpan) totalSpan.textContent = total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

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

        const toggleImportBtn = document.getElementById('toggle-import-btn');
        const importSection = document.getElementById('import-section');
        const csvUpload = document.getElementById('csv-upload');

        if (toggleImportBtn) {
            toggleImportBtn.addEventListener('click', () => {
                importSection.style.display = importSection.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (csvUpload) {
            csvUpload.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                if (!file.name.endsWith('.csv')) {
                    alert('กรุณาอัปโหลดไฟล์นามสกุล .csv เท่านั้น');
                    csvUpload.value = '';
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(event) {
                    const text = event.target.result;
                    processCSV(text);
                    csvUpload.value = ''; 
                };
                reader.readAsText(file, 'UTF-8');
            });
        }

        function processCSV(csvText) {
            const rows = csvText.split('\n');
            let addedCount = 0;
            const tbody = document.getElementById('items-tbody');
            
            if(tbody && tbody.children.length === 1) {
                const firstRow = tbody.querySelector('tr');
                const itemName = firstRow.querySelector('.item-name')?.value;
                if(!itemName) tbody.innerHTML = ''; 
            }

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue;
                
                const cols = parseCSVRow(row);
                
                if (cols.length >= 3) {
                    const name = cols[1] ? cols[1].trim() : '';
                    if (!name || name === 'รวม') continue; 

                    let qtyStr = cols[3] ? cols[3].replace(/,/g, '') : '1';
                    const qty = parseFloat(qtyStr) || 1;
                    
                    let totalStr = cols[4] ? cols[4].replace(/,/g, '') : '0';
                    let total = parseFloat(totalStr);
                    
                    if (isNaN(total) || total === 0) {
                        let priceUnitStr = cols[2] ? cols[2].replace(/,/g, '') : '0';
                        total = (parseFloat(priceUnitStr) || 0) * qty;
                    }
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="text" class="item-name" value="${name}" required></td>
                        <td><input type="number" class="item-qty" min="1" value="${qty}" required></td>
                        <td><input type="number" class="item-price" min="0" step="0.01" value="${total}" required></td>
                        <td style="text-align: center;"><button type="button" class="btn btn-danger del-btn" style="padding: 6px 10px; font-size: 12px;">ลบ</button></td>
                    `;
                    tbody.appendChild(tr);
                    tr.querySelectorAll('input').forEach(input => input.addEventListener('input', window.calculateTotal));
                    tr.querySelector('.del-btn')?.addEventListener('click', () => { tr.remove(); window.calculateTotal(); });
                    addedCount++;
                }
            }
            
            window.calculateTotal();
            if(addedCount > 0) {
                alert(`✅ นำเข้ารายการสำเร็จ ${addedCount} รายการ\nกรุณาตรวจสอบความถูกต้องและยอดเงินรวมอีกครั้ง`);
                if (importSection) importSection.style.display = 'none'; 
            } else {
                alert('❌ ไม่พบข้อมูล หรือรูปแบบไฟล์ CSV ไม่ถูกต้อง');
            }
        }

        function parseCSVRow(str) {
            const arr = [];
            let quote = false;
            let col = '';
            for (let i = 0; i < str.length; i++) {
                let cc = str[i], nc = str[i+1];
                if (cc === '"' && quote && nc === '"') { col += '"'; i++; continue; }
                if (cc === '"') { quote = !quote; continue; }
                if (cc === ',' && !quote) { arr.push(col); col = ''; continue; }
                col += cc;
            }
            arr.push(col);
            return arr;
        }
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
        const deptVal = document.getElementById('req-dept')?.value || '';

        if (!isDraft) {
            if (purposeVal.trim() === '') {
                if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณากรอกหัวข้อการเบิก'; }
                if (saveBtn) saveBtn.disabled = false; if (subBtn) subBtn.disabled = false; return;
            }
            if (!window.isClearingAdvance && deptVal === '') {
                if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'กรุณาเลือกฝ่าย'; }
                if (saveBtn) saveBtn.disabled = false; if (subBtn) subBtn.disabled = false; return;
            }
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

        let finalStatus;
        if (isDraft) {
            if (window.isClearingAdvance) {
                finalStatus = 'advance_transferred';
            } else {
                finalStatus = 'draft';
            }
        } else {
            if (window.isClearingAdvance) {
                finalStatus = 'pending_clearance'; 
            } else {
                finalStatus = (typeVal === 'advance') ? 'pending_advance' : 'pending_clearance';
            }
        }

        const sFile = document.getElementById('req-statement')?.files[0];
        const rFile = document.getElementById('req-return-slip')?.files[0];

        try {
            let sUrl = null, rUrl = null;
            if (sFile) {
                if(msg) msg.textContent = 'กำลังอัปโหลดไฟล์หลักฐาน...';
                const path = `statement-${Date.now()}.${sFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabaseClient.storage.from('receipts').upload(path, sFile);
                if (uploadError) throw uploadError;
                sUrl = supabaseClient.storage.from('receipts').getPublicUrl(path).data.publicUrl;
            }
            if (rFile) {
                if(msg) msg.textContent = 'กำลังอัปโหลดสลิปคืนเงินทอน...';
                const path = `return-${Date.now()}.${rFile.name.split('.').pop()}`;
                const { error: uploadError } = await supabaseClient.storage.from('slips').upload(path, rFile);
                if (uploadError) throw uploadError;
                rUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
            }

            if(msg) msg.textContent = 'กำลังบันทึกข้อมูล...';
            let clearanceId = draftId;
            const stmtPwd = document.getElementById('req-statement-password')?.value || null;

            // 🌟 รวบรวม ID เพื่อนแบบหลายคน (Array)
            const coWorkerIds = [];
            document.querySelectorAll('.co-worker-cb:checked').forEach(cb => coWorkerIds.push(cb.value));

            const clearanceData = { 
                member_id: currentUser.id, 
                co_worker_ids: coWorkerIds.length > 0 ? coWorkerIds : null, // ส่งเป็น Array
                request_type: typeVal, 
                purpose: purposeVal, 
                requested_amount: reqAmtVal, 
                total_actual_amount: totalActual, 
                status: finalStatus, 
                member_bank_details: bankVal,
                statement_password: stmtPwd  
            };
            
            if (!window.isClearingAdvance) {
                clearanceData.department = deptVal || '-'; 
            }

            if (sUrl) clearanceData.statement_url = sUrl; 
            if (rUrl) clearanceData.member_return_slip = rUrl;

            if (draftId) {
                const { error: updateError } = await supabaseClient.from('clearances').update(clearanceData).eq('id', draftId);
                if (updateError) throw updateError;
                await supabaseClient.from('clearance_items').delete().eq('clearance_id', draftId);
            } else {
                const { data, error: insertError } = await supabaseClient.from('clearances').insert([clearanceData]).select();
                if (insertError) throw insertError;
                clearanceId = data[0].id;
            }

            if (items.length > 0) {
                const itemsToInsert = items.map(i => ({ 
                    clearance_id: clearanceId, 
                    item_name: i.item_name, 
                    quantity: i.quantity, 
                    total_price: i.total_price 
                }));
                const { error: itemsError } = await supabaseClient.from('clearance_items').insert(itemsToInsert);
                if (itemsError) throw itemsError;
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

            document.querySelectorAll('.co-worker-cb').forEach(cb => cb.checked = false);

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


    // ==========================================
    // 3. ฟังก์ชันดึงแบบร่าง / ยอดเบิกล่วงหน้ามาแก้ไข
    // ==========================================
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

            // 🌟 ดึงเพื่อนที่แท็กไว้กลับมาโชว์ (และอนุญาตให้แก้ได้ตลอดเวลา)
            document.querySelectorAll('.co-worker-cb').forEach(cb => {
                cb.checked = c.co_worker_ids && c.co_worker_ids.includes(cb.value);
                cb.disabled = false; 
            });

            if (c.status === 'draft') {
                window.isClearingAdvance = false; 
                typeSelect.disabled = false;
                purposeInput.disabled = false;
                amtInput.disabled = false;
                amtInput.readOnly = false;
                if (deptSelect) deptSelect.disabled = false;
                
                submitBtn.innerHTML = '🚀 ส่งคำขอ';
                if (msg) msg.textContent = '✏️ โหมดแก้ไขแบบร่าง (สามารถแก้ไขข้อมูลได้ทุกช่อง)';
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
                    const { error: uploadError } = await supabaseClient.storage.from('slips').upload(path, slipFile);
                    if (uploadError) throw uploadError;
                    slipUrl = supabaseClient.storage.from('slips').getPublicUrl(path).data.publicUrl;
                }
                
                const { error: insertError } = await supabaseClient.from('transactions').insert([{ 
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
                if (insertError) throw insertError;
                
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
    // 5. โหลดข้อมูลตารางและประวัติ
    // ==========================================
    window.loadData = async function() {
        if (!currentUser) return; 
        
        try {
            const { data: banks } = await supabaseClient.from('bank_accounts').select('bank_name, balance');
            const bBody = document.querySelector('#member-bank-table tbody');
            if (bBody) {
                bBody.innerHTML = banks && banks.length > 0 ? 
                    banks.map(b => `<tr><td>${b.bank_name}</td><td style="text-align:right; color:var(--success); font-weight:bold;">฿${b.balance.toLocaleString()}</td></tr>`).join('') : 
                    `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`;
            }
        } catch(e) { console.error(e); }

        try {
            const { data: funds } = await supabaseClient.from('funds').select('fund_name, remaining_budget');
            const fBody = document.querySelector('#member-fund-table tbody');
            if (fBody) {
                fBody.innerHTML = funds && funds.length > 0 ? 
                    funds.map(f => `<tr><td>${f.fund_name}</td><td style="text-align:right; color:var(--primary); font-weight:bold;">฿${f.remaining_budget.toLocaleString()}</td></tr>`).join('') : 
                    `<tr><td style="text-align:center; color:gray;">ไม่พบข้อมูล</td></tr>`;
            }
        } catch(e) { console.error(e); }

        try {
            const tbody = document.querySelector('#member-history-table tbody');
            if (!tbody) return;
            
            // 🌟 ดึงบิลที่ตัวเองสร้าง หรือบิลที่เพื่อนแท็กชื่อเราไว้
            const { data, error } = await supabaseClient.from('clearances')
                .select('*, profiles!member_id(full_name)')
                .or(`member_id.eq.${currentUser.id},co_worker_ids.cs.{${currentUser.id}}`) 
                .order('created_at', { ascending: false });
            
            tbody.innerHTML = data.map(req => {
                const date = new Date(req.created_at).toLocaleDateString('th-TH');
                const typeLabel = req.request_type === 'advance' ? 'เบิกล่วงหน้า' : 'สำรองจ่าย';
                const amt = req.total_actual_amount > 0 ? req.total_actual_amount : req.requested_amount;
                
                let stat = ''; 
                let btn = '-';
                
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
                
                // 🌟 เพิ่มปุ่มให้คนสร้างกด "แท็กเพื่อนเพิ่ม" ได้ตลอดเวลา
                let cwBtn = '';
                if (req.member_id === currentUser.id) {
                     cwBtn = `<button type="button" onclick="openCoWorkerModal('${req.id}')" class="btn btn-outline" style="padding:4px 8px; font-size:11px; display:block; margin-top:5px; width:100%; border-color:var(--primary); color:var(--primary);">👥 แท็กเพื่อนเพิ่ม</button>`;
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
                                ${cwBtn}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        } catch(e) { console.error(e); }
    };

    // ==========================================
    // 🌟 V.7.1 ฟังก์ชัน Modal จัดการผู้ร่วมเบิกย้อนหลัง
    // ==========================================
    window.openCoWorkerModal = async function(id) {
        document.getElementById('coworker-modal').style.display = 'flex';
        document.getElementById('cw-edit-id').value = id;
        const listDiv = document.getElementById('cw-edit-list');
        listDiv.innerHTML = '⏳ กำลังโหลด...';

        try {
            const { data: c } = await supabaseClient.from('clearances').select('co_worker_ids').eq('id', id).single();
            const existingIds = c.co_worker_ids || [];

            const { data: users } = await supabaseClient.from('profiles').select('id, full_name, department').eq('status', 'approved').neq('id', currentUser.id);
            
            listDiv.innerHTML = '';
            users.forEach(user => {
                const isChecked = existingIds.includes(user.id) ? 'checked' : '';
                const lbl = document.createElement('label');
                lbl.style.display = 'block';
                lbl.style.marginBottom = '8px';
                lbl.style.cursor = 'pointer';
                lbl.innerHTML = `<input type="checkbox" class="cw-quick-cb" value="${user.id}" ${isChecked} style="margin-right:8px; transform: scale(1.2);"> ${user.full_name} <span style="color:gray; font-size:12px;">(${user.department || '-'})</span>`;
                listDiv.appendChild(lbl);
            });
        } catch(e) { listDiv.innerHTML = '❌ โหลดข้อมูลไม่สำเร็จ'; }
    };

    window.saveCoWorkersQuick = async function() {
        const id = document.getElementById('cw-edit-id').value;
        const coWorkerIds = [];
        document.querySelectorAll('.cw-quick-cb:checked').forEach(cb => coWorkerIds.push(cb.value));

        const btn = document.querySelector('#coworker-modal .btn-primary');
        btn.disabled = true;
        btn.textContent = 'กำลังบันทึก...';

        try {
            const { error } = await supabaseClient.from('clearances').update({ co_worker_ids: coWorkerIds }).eq('id', id);
            if (error) throw error;
            alert('✅ แท็กรายชื่อเพื่อนสำเร็จ!');
            document.getElementById('coworker-modal').style.display = 'none';
            window.loadData();
        } catch(e) { 
            alert('❌ เกิดข้อผิดพลาด: ' + e.message); 
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 บันทึกรายชื่อ';
        }
    };


    // ==========================================
    // V.3.2: โหลดชื่อผู้ใช้, สลับหน้า Admin, และกระดิ่งแจ้งเตือน
    // ==========================================
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
                document.getElementById('noti-bell').onclick = () => alert(`🚨 คุณมีเงินเบิกล่วงหน้าที่ต้อง "เคลียร์บิล" จำนวน ${count} รายการ`);
            } else if (badge) {
                badge.style.display = 'none';
                document.getElementById('noti-bell').onclick = () => alert(`✅ คุณไม่มีบิลค้างเคลียร์`);
            }
        } catch(e) { console.error("Noti Error:", e); }
    };
    
    window.loadUserProfileAndNoti();
    window.loadData();
    window.loadCoWorkers();

    // 🌟 โชว์ Pop-up คู่มือครั้งแรกที่เข้าใช้งาน
    setTimeout(() => {
        if (!localStorage.getItem('hasSeenFlowchart')) {
            const howToModal = document.getElementById('howto-modal');
            if (howToModal) {
                howToModal.style.display = 'flex';
                localStorage.setItem('hasSeenFlowchart', 'true');
            }
        }
    }, 1000);
});
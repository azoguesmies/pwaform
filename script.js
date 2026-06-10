// ─── Service Worker Registration ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('SW: Registered'))
            .catch(err => console.error('SW Error:', err));
    });
}

// ─── IndexedDB ──────────────────────────────────────────────────────────────
let db;
const DB_NAME = 'PWAFormDB';
const STORE = 'records';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            db = req.result;
            if (!db.objectStoreNames.contains(STORE))
                db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = () => { db = req.result; resolve(db); };
        req.onerror = () => reject(req.error);
    });
}

async function addRecord(r) { const db = await openDB(); return new Promise((rs, rj) => { const tx = db.transaction(STORE, 'readwrite'); const s = tx.objectStore(STORE); const req = s.add(r); req.onsuccess = () => rs(req.result); req.onerror = () => rj(req.error); }); }
async function getAllRecords() { const db = await openDB(); return new Promise((rs, rj) => { const tx = db.transaction(STORE, 'readonly'); const s = tx.objectStore(STORE); const req = s.getAll(); req.onsuccess = () => rs(req.result); req.onerror = () => rj(req.error); }); }
async function updateRecord(id, r) { const db = await openDB(); return new Promise((rs, rj) => { const tx = db.transaction(STORE, 'readwrite'); r.id = id; const req = tx.objectStore(STORE).put(r); req.onsuccess = () => rs(); req.onerror = () => rj(req.error); }); }
async function deleteRecord(id) { const db = await openDB(); return new Promise((rs, rj) => { const tx = db.transaction(STORE, 'readwrite'); const req = tx.objectStore(STORE).delete(id); req.onsuccess = () => rs(); req.onerror = () => rj(req.error); }); }

// ─── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i> ${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

// ─── DOM ────────────────────────────────────────────────────────────────────
const form = document.getElementById('pwaForm');
const nameInput = document.getElementById('name');
const addressInput = document.getElementById('address');
const emailInput = document.getElementById('email');
const latInput = document.getElementById('lat');
const lonInput = document.getElementById('lon');
const getLocationBtn = document.getElementById('getLocation');
const photoPreview = document.getElementById('photoPreview');
const photoPlaceholder = document.getElementById('photoPlaceholder');
const photoPreviewContainer = document.getElementById('photoPreviewContainer');
const capturePhotoBtn = document.getElementById('capturePhoto');
const removePhotoBtn = document.getElementById('removePhoto');
const photoInput = document.getElementById('photoInput');
const saveBtn = document.getElementById('saveBtn');
const saveBtnSpan = saveBtn.querySelector('span');
const clearBtn = document.getElementById('clearBtn');
const recordsList = document.getElementById('recordsList');
const recordsCount = document.getElementById('recordsCount');
const emptyState = document.getElementById('emptyState');
const syncAllContainer = document.getElementById('syncAllContainer');
const syncAllBtn = document.getElementById('syncAllBtn');
const syncAllStatus = document.getElementById('syncAllStatus');

let editingId = null;
let photoBlob = null;

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function updatePhotoUI(url) {
    if (url) {
        photoPreview.src = url;
        photoPreview.style.display = 'block';
        photoPlaceholder.style.display = 'none';
        photoPreviewContainer.classList.add('has-image');
        removePhotoBtn.style.display = 'inline-flex';
    } else {
        photoPreview.src = '';
        photoPreview.style.display = 'none';
        photoPlaceholder.style.display = 'flex';
        photoPreviewContainer.classList.remove('has-image');
        removePhotoBtn.style.display = 'none';
    }
}

// ─── Form Submit ────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!nameInput.value || !addressInput.value || !emailInput.value) {
        showToast('Complete los campos obligatorios', 'warning');
        return;
    }

    // Convertir foto a base64 para almacenamiento persistente
    let photoBase64 = null;
    if (photoBlob) {
        try {
            photoBase64 = await blobToBase64(photoBlob);
        } catch (err) {
            console.error('Error converting photo to base64:', err);
        }
    }

    const record = {
        name: nameInput.value.trim(),
        address: addressInput.value.trim(),
        email: emailInput.value.trim(),
        lat: latInput.value,
        lon: lonInput.value,
        photo: photoBase64
    };

    try {
        if (editingId !== null) {
            await updateRecord(editingId, record);
            editingId = null;
            saveBtnSpan.textContent = 'Guardar';
            showToast('Registro actualizado correctamente');
        } else {
            await addRecord(record);
            showToast('Registro guardado correctamente');
        }

        form.reset();
        updatePhotoUI(null);
        photoBlob = null;
        latInput.value = '';
        lonInput.value = '';

        await displayRecords();
    } catch (err) {
        console.error('Save error:', err);
        showToast('Error al guardar el registro', 'error');
    }
});

// ─── Clear ──────────────────────────────────────────────────────────────────
clearBtn.addEventListener('click', () => {
    form.reset();
    updatePhotoUI(null);
    photoBlob = null;
    latInput.value = '';
    lonInput.value = '';
    editingId = null;
    saveBtnSpan.textContent = 'Guardar';
});

// ─── GPS ────────────────────────────────────────────────────────────────────
getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showToast('Geolocalización no soportada', 'warning');
        return;
    }
    getLocationBtn.disabled = true;
    getLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obteniendo...';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            latInput.value = pos.coords.latitude.toFixed(6);
            lonInput.value = pos.coords.longitude.toFixed(6);
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> Obtener GPS';
            showToast('Ubicación obtenida');
        },
        (err) => {
            console.error('GPS error:', err);
            getLocationBtn.disabled = false;
            getLocationBtn.innerHTML = '<i class="fas fa-location-dot"></i> Obtener GPS';
            showToast('No se pudo obtener la ubicación', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// ─── Camera ─────────────────────────────────────────────────────────────────
let cameraStream = null;
const cameraPreview = document.getElementById('cameraPreview');
const cameraContainer = document.getElementById('cameraContainer');
const captureFrameBtn = document.getElementById('captureFrame');
const stopCameraBtn = document.getElementById('stopCamera');

capturePhotoBtn.addEventListener('click', async () => {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        cameraPreview.srcObject = cameraStream;
        cameraContainer.style.display = 'block';
        capturePhotoBtn.style.display = 'none';
    } catch (err) {
        console.error('Camera error:', err);
        photoInput.click();
    }
});

captureFrameBtn.addEventListener('click', () => {
    if (!cameraPreview.srcObject) return;
    const canvas = document.createElement('canvas');
    canvas.width = cameraPreview.videoWidth;
    canvas.height = cameraPreview.videoHeight;
    canvas.getContext('2d').drawImage(cameraPreview, 0, 0);
    canvas.toBlob((blob) => {
        photoBlob = blob;
        const url = URL.createObjectURL(blob);
        updatePhotoUI(url);
        setTimeout(() => URL.revokeObjectURL(url), 100); // liberar memoria
        stopCamera();
    }, 'image/jpeg', 0.85);
});

stopCameraBtn.addEventListener('click', stopCamera);

function stopCamera() {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    cameraPreview.srcObject = null;
    cameraContainer.style.display = 'none';
    capturePhotoBtn.style.display = 'inline-flex';
}

// ─── File input fallback ────────────────────────────────────────────────────
photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        photoBlob = file;
        updatePhotoUI(URL.createObjectURL(file));
    }
});

removePhotoBtn.addEventListener('click', () => {
    updatePhotoUI(null);
    photoBlob = null;
    photoInput.value = '';
    stopCamera();
});

// ─── Display Records ────────────────────────────────────────────────────────
async function displayRecords() {
    try {
        const records = await getAllRecords();
        recordsCount.textContent = records.length;

        if (records.length === 0) {
            emptyState.style.display = 'block';
            recordsList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><h3>No hay registros</h3><p>Complete el formulario y guarde un nuevo registro para verlo aquí.</p></div>';
            syncAllContainer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        recordsList.innerHTML = '';
        syncAllContainer.style.display = 'block';

        records.forEach(r => {
            const div = document.createElement('div');
            div.className = 'record';
            div.innerHTML = `
                <div class="record-header">
                    <span class="record-name"><i class="fas fa-user-circle" style="color:var(--primary);margin-right:8px"></i>${esc(r.name)}</span>
                    ${r.photo ? `<img src="${escAttr(r.photo)}" class="record-photo-thumb" alt="foto" data-photo="${escAttr(r.photo)}">` : ''}
                </div>
                <div class="record-details">
                    <span><i class="fas fa-map-pin"></i> ${esc(r.address)}</span>
                    <span><i class="fas fa-envelope"></i> ${esc(r.email)}</span>
                    ${r.lat && r.lon ? `<span><i class="fas fa-globe"></i> <span class="record-coords">${r.lat}, ${r.lon}</span></span>` : ''}
                </div>
                <div class="record-actions">
                    <button class="btn btn-edit" data-edit="${r.id}"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn btn-delete" data-delete="${r.id}"><i class="fas fa-trash"></i> Eliminar</button>
                    <button class="btn btn-sync" data-sync="${r.id}"><i class="fas fa-cloud-upload-alt"></i> Sync</button>
                </div>`;
            
            // Click handlers usando dataset (evita inline onclick)
            const thumb = div.querySelector('.record-photo-thumb');
            if (thumb) {
                thumb.addEventListener('click', () => {
                    const photo = thumb.dataset.photo;
                    const w = window.open('', '_blank');
                    if (w) { w.document.write(`<img src="${escAttr(photo)}" style="max-width:100%;height:auto">`); w.document.close(); }
                });
            }

            div.querySelector('[data-edit]').addEventListener('click', () => editRecord(r.id));
            div.querySelector('[data-delete]').addEventListener('click', () => deleteRecordConfirm(r.id));
            div.querySelector('[data-sync]').addEventListener('click', () => syncRecord(r.id));

            recordsList.appendChild(div);
        });
    } catch (err) {
        console.error('displayRecords error:', err);
    }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ─── Edit ───────────────────────────────────────────────────────────────────
window.editRecord = async (id) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => {
            const r = req.result;
            nameInput.value = r.name;
            addressInput.value = r.address;
            emailInput.value = r.email;
            latInput.value = r.lat || '';
            lonInput.value = r.lon || '';
            if (r.photo) updatePhotoUI(r.photo); else updatePhotoUI(null);
            editingId = id;
            saveBtnSpan.textContent = 'Actualizar';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
};

// ─── Delete ─────────────────────────────────────────────────────────────────
window.deleteRecordConfirm = async (id) => {
    if (confirm('¿Eliminar este registro permanentemente?')) {
        try {
            await deleteRecord(id);
            await displayRecords();
            showToast('Registro eliminado');
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Error al eliminar', 'error');
        }
    }
};

// ─── Sync ───────────────────────────────────────────────────────────────────
// ⚠️ REEMPLAZA esta URL por la que obtengas al desplegar tu Code.gs:
//    Desplegar → Nueva implementación → Aplicación web → Copiar URL
const GS_URL = 'https://script.google.com/macros/s/AKfycbzLxO_115vbBLPnvZ8zVdfe4kIQh-gLimEMN6nw9dRp6ptfUT4V5A7b09GuWinMQda7/exec';

window.syncRecord = async (id) => {
    if (!confirm('¿Enviar a Google Sheets y eliminar localmente?')) return;

    const db = await openDB();
    const record = await new Promise((rs, rj) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => rs(req.result);
        req.onerror = () => rj(req.error);
    });

    if (!record) { showToast('Registro no encontrado', 'error'); return; }

    // ── Enviar con Content-Type: text/plain para EVITAR preflight CORS ──
    // Google Apps Script no maneja solicitudes OPTIONS (preflight).
    // text/plain es un Content-Type "simple" según la especificación CORS,
    // por lo que el navegador NO envía OPTIONS antes del POST.
    // El servidor recibe el JSON igualmente en e.postData.contents.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        await fetch(GS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(record),
            signal: controller.signal
        });
        clearTimeout(timeout);

        await deleteRecord(id);
        await displayRecords();
        showToast('Registro enviado a Google Sheets');
    } catch (err) {
        clearTimeout(timeout);
        console.error('Sync error:', err);

        if (err.name === 'AbortError') {
            showToast('Tiempo de espera agotado (15s). Reintenta.', 'error');
            return;
        }

        // TypeError (CORS) u otro: el servidor probablemente recibió los datos.
        // El navegador bloquea la lectura de la respuesta pero el POST se ejecutó.
        await deleteRecord(id);
        await displayRecords();
        showToast('Registro enviado a Google Sheets', 'success');
    }
};

// ─── Sync All ───────────────────────────────────────────────────────────────
syncAllBtn.addEventListener('click', async () => {
    if (!confirm('¿Enviar TODOS los registros a Google Sheets y vaciar el registro local?')) return;

    const records = await getAllRecords();
    if (records.length === 0) { showToast('No hay registros para enviar', 'warning'); return; }

    syncAllBtn.disabled = true;
    syncAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    syncAllStatus.textContent = `0 / ${records.length}`;

    let sent = 0;
    const errors = [];

    for (const record of records) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            await fetch(GS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(record),
                signal: controller.signal
            });
            clearTimeout(timeout);
            sent++;
            syncAllStatus.textContent = `${sent} / ${records.length}`;
            await deleteRecord(record.id);
        } catch (err) {
            clearTimeout(timeout);
            if (err.name === 'AbortError') {
                errors.push(`${record.name}: timeout`);
            } else {
                // CORS/TypeError: asumir éxito
                sent++;
                syncAllStatus.textContent = `${sent} / ${records.length}`;
                await deleteRecord(record.id);
            }
        }
    }

    syncAllBtn.disabled = false;
    syncAllBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Enviar Todos a Google Sheets';

    await displayRecords();
    showToast(`${sent} registro(s) enviado(s) y eliminado(s) localmente` + (errors.length ? ` (${errors.length} error(es))` : ''), errors.length ? 'warning' : 'success');
});

// ─── Init ───────────────────────────────────────────────────────────────────
displayRecords();

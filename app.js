// app.js (완성본, module)
// Firebase SDK import (앱에서 type="module"으로 로드해야 함)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/* -------------------------
   Firebase 설정 (기본값은 네가 제공한 값 유지)
   필요시 프로젝트 정보 바꿔 넣어 사용
   ------------------------- */
const firebaseConfig = {
    apiKey: "AIzaSyBSkdUP_bU60GiLY6w9Uo7e8g_pkLllFPg",
    authDomain: "my-nonono3.firebaseapp.com",
    projectId: "my-nonono3",
    storageBucket: "my-nonono3.firebasestorage.app",
    messagingSenderId: "167865896202",
    appId: "1:167865896202:web:2567994bd29509f9d6fef3",
    measurementId: "G-T126HT4T7X"
};
const appId = firebaseConfig.appId;
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const TABLE_DOC_ID = 'main_table_state';
let currentUserId = null;
let isAuthReady = false;
let initialLoadDone = false;

/* DOM refs */
const table = document.querySelector('.data-table');
const colorPaletteContainer = document.getElementById('colorPaletteContainer');
const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
const fontSizeInput = document.getElementById('fontSizeInput');
const downloadFullBtn = document.getElementById('downloadFullBtn');
const selectionBox = document.getElementById('selectionBox');

const leftMenu = document.getElementById('leftMenu');

const autoSaveToggleBtn = document.getElementById('autoSaveToggleBtn');
const saveNowBtn = document.getElementById('saveNowBtn');
const downloadBtn = document.getElementById('downloadBtn');

/* color palette */
const COLOR_PALETTE = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#FFA500', '#800080', '#008000', '#808000', '#000080', '#800000', '#C0C0C0', '#808080',
    '#FF4500', '#ADFF2F', '#1E90FF', '#FFD700', '#20B2AA', '#E9967A', '#9400D3', '#FF69B4',
    '#A0522D', '#D2B48C', '#87CEEB', '#F08080', '#4682B4', '#DA70D6', '#B0C4DE', '#F4A460',
    '#5F9EA0', '#DDA0DD', '#7FFF00', '#6495ED', '#DC143C', '#FF8C00', '#9ACD32', '#40E0D0'
];

/* Selection state */
let isDragging = false;
let startCell = null;
let endCell = null;
let selectedCells = new Set();
let autoSave = false;
let autoSaveDebounceMs = 800;
let saveTimer = null;

/* -------------------------
   Helpers
   ------------------------- */
const debounce = (fn, ms) => {
    return (...args) => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => fn(...args), ms);
    };
};

const getTableDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'table_data', TABLE_DOC_ID);

/* Serialize current table into a savable object */
const serializeTableState = () => {
    const cellStates = {};
    const rows = table.querySelectorAll('tr');
    rows.forEach((row, rIndex) => {
        row.querySelectorAll('td').forEach((cell, cIndex) => {
            const cellId = `r${rIndex}c${cIndex}`;
            cellStates[cellId] = {
                text: cell.innerHTML,
                color: cell.style.color || '',
                bg: cell.style.backgroundColor || '',
                fontSize: cell.style.fontSize || '',
            };
        });
    });

    const rowHeights = {};
    document.querySelectorAll('.height-apply-btn').forEach(button => {
        const target = button.dataset.target;
        let inputId = `${target.replace('-data', 'RowHeightInput')}`;
        if (target === 'middle-notice') inputId = 'middleNoticeRowHeightInput';
        const input = document.getElementById(inputId);
        if (input) rowHeights[target] = input.value;
    });

    return { cells: cellStates, rowHeights, timestamp: new Date().toISOString() };
};

const saveTableStateImmediate = async () => {
    if (!currentUserId || !isAuthReady) {
        // fallback: localStorage
        try {
            localStorage.setItem('noblesse_table_snapshot', JSON.stringify(serializeTableState()));
            console.log('Saved to localStorage (auth not ready).');
        } catch (e) {
            console.error('Local save failed', e);
        }
        return;
    }
    try {
        await setDoc(getTableDocRef(currentUserId), serializeTableState(), { merge: true });
        console.log('Saved to Firestore');
    } catch (e) {
        console.error('Save error', e);
    }
};
const saveTableStateDebounced = debounce(saveTableStateImmediate, autoSaveDebounceMs);

/* Apply loaded state from DB/local */
const applyLoadedState = (data) => {
    if (!data) return;
    if (data.cells) {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rIndex) => {
            row.querySelectorAll('td').forEach((cell, cIndex) => {
                const cellId = `r${rIndex}c${cIndex}`;
                const state = data.cells[cellId];
                if (state) {
                    if (cell.innerHTML !== state.text) cell.innerHTML = state.text;
                    cell.style.color = state.color || '';
                    cell.style.backgroundColor = state.bg || '';
                    cell.style.fontSize = state.fontSize || '';
                }
            });
        });
    }
    if (data.rowHeights) {
        for (const [key, value] of Object.entries(data.rowHeights)) {
            let inputId = `${key.replace('-data', 'RowHeightInput')}`;
            if (key === 'middle-notice') inputId = 'middleNoticeRowHeightInput';
            const input = document.getElementById(inputId);
            if (input) input.value = value;
            applyRowHeightGroup(key, value);
        }
    }
    clearSelection();
};

/* Listen live document in Firestore */
const loadTableState = (userId) => {
    const docRef = getTableDocRef(userId);
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            applyLoadedState(docSnap.data());
        } else if (!initialLoadDone) {
            saveTableStateImmediate();
        }
        initialLoadDone = true;
    }, (error) => console.error('Listen error', error));
};

/* Auth init (anonymous) */
const initAuth = async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
        } else {
            try {
                await signInAnonymously(auth);
                currentUserId = auth.currentUser.uid;
            } catch (e) {
                console.error('Auth failed', e);
                return;
            }
        }
        if (currentUserId && !isAuthReady) {
            isAuthReady = true;
            loadTableState(currentUserId);
        }
    });
};

/* -------------------------
   Selection utilities (drag to select cells)
   ------------------------- */
const clearSelection = () => {
    selectedCells.forEach(td => td.classList.remove('selected'));
    selectedCells.clear();
    selectionBox.style.display = 'none';
};

const getCellCoordinates = (cell) => ({ rowIndex: cell.closest('tr').rowIndex, cellIndex: cell.cellIndex });

const selectCellsInRect = (start, end) => {
    const startPos = getCellCoordinates(start);
    const endPos = getCellCoordinates(end);
    const r1 = Math.min(startPos.rowIndex, endPos.rowIndex);
    const r2 = Math.max(startPos.rowIndex, endPos.rowIndex);
    const c1 = Math.min(startPos.cellIndex, endPos.cellIndex);
    const c2 = Math.max(startPos.cellIndex, endPos.cellIndex);

    clearSelection();
    for (let r = r1; r <= r2; r++) {
        const row = table.rows[r];
        if (!row) continue;
        for (let c = c1; c <= c2; c++) {
            const cell = row.cells[c];
            if (!cell) continue;
            cell.classList.add('selected');
            selectedCells.add(cell);
        }
    }
};

const updateSelectionBoxVisual = (start, end) => {
    const wrapRect = document.querySelector('.wrap').getBoundingClientRect();
    const sRect = start.getBoundingClientRect();
    const eRect = end.getBoundingClientRect();
    const left = Math.min(sRect.left, eRect.left) - wrapRect.left + document.querySelector('.wrap').scrollLeft;
    const top = Math.min(sRect.top, eRect.top) - wrapRect.top + document.querySelector('.wrap').scrollTop;
    const right = Math.max(sRect.right, eRect.right) - wrapRect.left + document.querySelector('.wrap').scrollLeft;
    const bottom = Math.max(sRect.bottom, eRect.bottom) - wrapRect.top + document.querySelector('.wrap').scrollTop;
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${right - left}px`;
    selectionBox.style.height = `${bottom - top}px`;
    selectionBox.style.display = 'block';
};

/* Mouse handlers */
const handleMouseDown = (e) => {
    if (e.target.closest('.setting-panel')) return;
    const cell = e.target.closest('td');
    if (!cell) return;

    startCell = cell;
    endCell = cell;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e) => {
    if (!startCell) return;
    isDragging = true;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const cellUnder = target?.closest?.('td');
    if (cellUnder && cellUnder !== endCell) {
        endCell = cellUnder;
        selectCellsInRect(startCell, endCell);
        updateSelectionBoxVisual(startCell, endCell);
    }
};

const handleMouseUp = (e) => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    if (!isDragging && startCell) {
        // 클릭만 한 경우 단일 선택
        clearSelection();
        startCell.classList.add('selected');
        selectedCells.add(startCell);
    }
    isDragging = false;
    startCell = null;
    endCell = null;
};

/* -------------------------
   Color palette
   ------------------------- */
const renderColorPalette = () => {
    COLOR_PALETTE.forEach(col => {
        const d = document.createElement('div');
        d.className = 'color-swatch';
        d.style.backgroundColor = col;
        d.title = col;
        d.addEventListener('click', () => applyColorToSelection(col));
        colorPaletteContainer.appendChild(d);
    });
};

const applyColorToSelection = (color) => {
    const target = document.querySelector('input[name="colorTarget"]:checked')?.value || 'text';
    if (selectedCells.size === 0) {
        const active = document.activeElement;
        if (active && active.tagName === 'TD') {
            if (target === 'text') active.style.color = color;
            else active.style.backgroundColor = color;
            if (autoSave) saveTableStateDebounced();
            return;
        } else {
            alert('적용할 셀을 선택하거나 포커스하세요.');
            return;
        }
    }
    selectedCells.forEach(cell => {
        if (target === 'text') cell.style.color = color;
        else cell.style.backgroundColor = color;
    });
    if (autoSave) saveTableStateDebounced();
};

/* -------------------------
   Font size apply
   ------------------------- */
applyFontSizeBtn?.addEventListener('click', () => {
    const size = fontSizeInput.value + 'px';
    if (selectedCells.size === 0) {
        const active = document.activeElement;
        if (active && active.tagName === 'TD') {
            active.style.fontSize = size;
            if (autoSave) saveTableStateDebounced();
            return;
        } else { alert('적용할 셀을 선택하거나 포커스하세요.'); return; }
    }
    selectedCells.forEach(cell => cell.style.fontSize = size);
    if (autoSave) saveTableStateDebounced();
});

/* -------------------------
   Row height application (버그 수정 포함)
   - tr 뿐 아니라 내부 td에도 높이 적용
   - 그룹 지정(target)에 따라 각 그룹에 적용
   ------------------------- */
function applyRowHeightToElement(tr, value) {
    const val = (value === '' || value == null) ? '' : (isNaN(Number(value)) ? value : `${Number(value)}px`);
    tr.style.height = val;
    tr.querySelectorAll('td').forEach(td => {
        td.style.height = val;
        // preserve text wrapping and line-height for taller rows
        if (val) td.style.lineHeight = 'normal';
        else td.style.lineHeight = '';
    });
}

const applyRowHeightGroup = (target, value) => {
    if (target === 'top-data') {
        document.querySelectorAll('.top-data-row, .top-data-header').forEach(row => applyRowHeightToElement(row, value));
        document.querySelectorAll('#top-notice').forEach(row => applyRowHeightToElement(row, value)); // optional
    } else if (target === 'middle-notice') {
        document.querySelectorAll('.middle-notice-row').forEach(row => applyRowHeightToElement(row, value));
    } else if (target === 'bottom-data') {
        document.querySelectorAll('.bottom-data-row, .bottom-data-header').forEach(row => applyRowHeightToElement(row, value));
    } else if (target === 'super-top') {
        document.querySelectorAll('.super-top-row').forEach(row => applyRowHeightToElement(row, value));
    }
    if (autoSave) saveTableStateDebounced();
};

/* bind height apply buttons */
document.querySelectorAll('.height-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        let inputId = `${target.replace('-data', 'RowHeightInput')}`;
        if (target === 'middle-notice') inputId = 'middleNoticeRowHeightInput';
        const input = document.getElementById(inputId);
        if (input) applyRowHeightGroup(target, input.value);
    });
});

/* Observe data-row-height attribute changes and apply immediately (robust) */
const rowObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-row-height') {
            const tr = m.target;
            const newVal = tr.getAttribute('data-row-height');
            applyRowHeightToElement(tr, newVal);
        }
    }
});
table.querySelectorAll('tr').forEach(tr => rowObserver.observe(tr, { attributes: true }));

/* -------------------------
   Left menu scroll -> focus first editable cell in target row
   ------------------------- */
leftMenu?.addEventListener('click', (e) => {
    const btn = e.target.closest('.left-item');
    if (!btn) return;
    const targetId = btn.dataset.target;
    if (!targetId) return;
    scrollToSectionAndFocus(targetId);
    // active toggle
    leftMenu.querySelectorAll('.left-item').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
});

function scrollToSectionAndFocus(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    // Prefer to scroll the page so the row is visible
    const margin = 80;
    const rect = target.getBoundingClientRect();
    const topY = window.scrollY + rect.top - margin;
    window.scrollTo({ top: topY, behavior: 'smooth' });

    // Focus the first editable TD after a short delay (allow smooth scroll)
    setTimeout(() => {
        const editable = target.querySelector('[contenteditable="true"]');
        if (editable) {
            placeCaretAtEnd(editable);
            editable.focus();
        }
    }, 260);
}

function placeCaretAtEnd(el) {
    if (!el) return;
    el.focus();
    try {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } catch (e) {
        // ignore
    }
}

/* -------------------------
   Auto-save / manual save handlers
   ------------------------- */
autoSaveToggleBtn?.addEventListener('click', () => {
    autoSave = !autoSave;
    autoSaveToggleBtn.textContent = `자동저장: ${autoSave ? 'ON' : 'OFF'}`;
    if (autoSave) saveTableStateDebounced();
});

saveNowBtn?.addEventListener('click', () => saveTableStateImmediate());

/* -------------------------
   Image download (html2canvas)
   ------------------------- */
downloadFullBtn?.addEventListener('click', async () => {
    await downloadCapture('noblesse_table');
});
downloadBtn?.addEventListener('click', async () => {
    await downloadCapture('noblesse_table');
});

async function downloadCapture(prefix) {
    try {
        const el = document.getElementById('capture-area');
        // temporarily force white background for consistent PNG
        const prevBg = el.style.background;
        el.style.background = '#ffffff';
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        el.style.background = prevBg;
        const data = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = data;
        a.download = `${prefix}_${new Date().toISOString().slice(0,19).replaceAll(':','').replaceAll('T','_')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) {
        console.error('Capture failed', e);
        alert('이미지 생성 실패');
    }
}

/* -------------------------
   Load / restore from local if needed
   ------------------------- */
function populateFromSavedLocal() {
    const raw = localStorage.getItem('noblesse_table_snapshot');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        if (!data || !data.cells) return;
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, rIndex) => {
            row.querySelectorAll('td').forEach((cell, cIndex) => {
                const id = `r${rIndex}c${cIndex}`;
                const st = data.cells[id];
                if (st) {
                    cell.innerHTML = st.text || cell.innerHTML;
                    cell.style.color = st.color || '';
                    cell.style.backgroundColor = st.bg || '';
                    cell.style.fontSize = st.fontSize || '';
                }
            });
        });
        if (data.rowHeights) {
            for (const [k, v] of Object.entries(data.rowHeights)) {
                let inputId = `${k.replace('-data', 'RowHeightInput')}`;
                if (k === 'middle-notice') inputId = 'middleNoticeRowHeightInput';
                const input = document.getElementById(inputId);
                if (input) input.value = v;
                applyRowHeightGroup(k, v);
            }
        }
    } catch (e) {
        console.warn('Restore failed', e);
    }
}

/* -------------------------
   Misc: sync selection visual on scroll/resize
   ------------------------- */
const syncSelectionVisual = () => {
    if (selectedCells.size === 0) return;
    const arr = Array.from(selectedCells);
    updateSelectionBoxVisual(arr[0], arr[arr.length - 1]);
};

document.querySelector('.wrap')?.addEventListener('scroll', () => syncSelectionVisual());
window.addEventListener('resize', () => syncSelectionVisual());

/* -------------------------
   Init
   ------------------------- */
renderColorPalette();
initAuth();
populateFromSavedLocal();

/* Attach mouse handlers */
table.addEventListener('mousedown', handleMouseDown);
table.addEventListener('input', () => { if (autoSave) saveTableStateDebounced(); });

/* Expose manual save for console usage */
window.saveTableStateImmediate = saveTableStateImmediate;

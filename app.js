// app.js (완성판)
// Firebase SDK import (앱에서 type="module"으로 로드해야 함)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// DOM refs
const table = document.querySelector('.data-table');
const colorPaletteContainer = document.getElementById('colorPaletteContainer');
const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
const fontSizeInput = document.getElementById('fontSizeInput');
const downloadFullBtn = document.getElementById('downloadFullBtn');
const selectionBox = document.getElementById('selectionBox');

const leftMenu = document.getElementById('leftMenu');
const menuIndicator = document.getElementById('menuIndicator');
const topSubMenu = document.getElementById('topSubMenu');

// Tool buttons
const autoSaveToggleBtn = document.getElementById('autoSaveToggleBtn');
const saveNowBtn = document.getElementById('saveNowBtn');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const addRowBtn = document.getElementById('addRowBtn');
const addColBtn = document.getElementById('addColBtn');
const deleteRowBtn = document.getElementById('deleteRowBtn');
const deleteColBtn = document.getElementById('deleteColBtn');
const autoFitBtn = document.getElementById('autoFitBtn');
const toggleAdminBtn = document.getElementById('toggleAdminBtn');
const downloadBtn = document.getElementById('downloadBtn');

// constants
const COLOR_PALETTE = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
    '#FFA500', '#800080', '#008000', '#808000', '#000080', '#800000', '#C0C0C0', '#808080',
    '#FF4500', '#ADFF2F', '#1E90FF', '#FFD700', '#20B2AA', '#E9967A', '#9400D3', '#FF69B4',
    '#A0522D', '#D2B48C', '#87CEEB', '#F08080', '#4682B4', '#DA70D6', '#B0C4DE', '#F4A460',
    '#5F9EA0', '#DDA0DD', '#7FFF00', '#6495ED', '#DC143C', '#FF8C00', '#9ACD32', '#40E0D0'
];

// selection
let isDragging = false;
let startCell = null;
let endCell = null;
let selectedCells = new Set();
let autoSave = false;
let autoSaveDebounceMs = 800; // 디바운스 타임
let saveTimer = null;
let adminMode = false;

// helpers
const debounce = (fn, ms) => {
    return (...args) => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => fn(...args), ms);
    };
};

const getTableDocRef = (userId) => doc(db, 'artifacts', appId, 'users', userId, 'table_data', TABLE_DOC_ID);

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

    return { cells: cellStates, rowHeights, timestamp: new Date() };
};

const saveTableStateImmediate = async () => {
    if (!currentUserId || !isAuthReady) return;
    try {
        await setDoc(getTableDocRef(currentUserId), serializeTableState(), { merge: true });
        console.log('Saved');
    } catch (e) {
        console.error('Save error', e);
    }
};
const saveTableStateDebounced = debounce(saveTableStateImmediate, autoSaveDebounceMs);

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
            applyRowHeight(key, value);
        }
    }
    clearSelection();
};

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

// Selection utilities
const getCellRect = (cell) => cell.getBoundingClientRect();
const clearSelection = () => {
    selectedCells.forEach(td => td.classList.remove('selected'));
    selectedCells.clear();
    selectionBox.style.display = 'none';
};

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

const getCellCoordinates = (cell) => ({ rowIndex: cell.closest('tr').rowIndex, cellIndex: cell.cellIndex });

// Mouse handlers
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
        // show selection box around single cell
        updateSelectionBoxVisual(startCell, startCell);
    }
    isDragging = false;
    startCell = null;
    endCell = null;
};

// Color palette render
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
    const target = document.querySelector('input[name="colorTarget"]:checked').value;
    selectedCells.forEach(cell => {
        if (target === 'text') cell.style.color = color;
        else cell.style.backgroundColor = color;
    });
    if (autoSave) saveTableStateDebounced();
};

// Font size
applyFontSizeBtn?.addEventListener('click', () => {
    const size = fontSizeInput.value + 'px';
    selectedCells.forEach(cell => cell.style.fontSize = size);
    if (autoSave) saveTableStateDebounced();
});

// Row height apply
const applyRowHeight = (target, value) => {
    if (target === 'top-data') {
        document.querySelectorAll('.top-data-row').forEach(row => row.style.height = `${value}px`);
        document.querySelectorAll('.top-data-header').forEach(row => row.style.height = `${value}px`);
    } else if (target === 'middle-notice') {
        document.querySelectorAll('.middle-notice-row').forEach(row => row.style.height = `${value}px`);
    } else if (target === 'bottom-data') {
        document.querySelectorAll('.bottom-data-row').forEach(row => row.style.height = `${value}px`);
        document.querySelectorAll('.bottom-data-header').forEach(row => row.style.height = `${value}px`);
    }
    if (autoSave) saveTableStateDebounced();
};

document.querySelectorAll('.height-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        let inputId = `${target.replace('-data', 'RowHeightInput')}`;
        if (target === 'middle-notice') inputId = 'middleNoticeRowHeightInput';
        const input = document.getElementById(inputId);
        if (input) applyRowHeight(target, input.value);
    });
});

// Autosave toggle
autoSaveToggleBtn?.addEventListener('click', () => {
    autoSave = !autoSave;
    autoSaveToggleBtn.textContent = `자동저장: ${autoSave ? 'ON' : 'OFF'}`;
    if (autoSave) saveTableStateDebounced();
});

// Manual save
saveNowBtn?.addEventListener('click', () => saveTableStateImmediate());

// Copy / Paste (JSON clipboard)
copyBtn?.addEventListener('click', async () => {
    const data = [];
    selectedCells.forEach(cell => {
        const coords = getCellCoordinates(cell);
        data.push({ r: coords.rowIndex, c: coords.cellIndex, html: cell.innerHTML, color: cell.style.color || '', bg: cell.style.backgroundColor || '', fontSize: cell.style.fontSize || '' });
    });
    try {
        await navigator.clipboard.writeText(JSON.stringify(data));
        alert('복사 완료');
    } catch (e) { console.error(e); alert('복사 실패'); }
});

pasteBtn?.addEventListener('click', async () => {
    try {
        const txt = await navigator.clipboard.readText();
        const data = JSON.parse(txt);
        if (!Array.isArray(data)) throw new Error('Invalid');
        data.forEach(item => {
            const row = table.rows[item.r];
            if (!row) return;
            const cell = row.cells[item.c];
            if (!cell) return;
            cell.innerHTML = item.html;
            cell.style.color = item.color || '';
            cell.style.backgroundColor = item.bg || '';
            cell.style.fontSize = item.fontSize || '';
        });
        if (autoSave) saveTableStateDebounced();
        alert('붙여넣기 완료');
    } catch (e) { console.error(e); alert('붙여넣기 실패 - 클립보드에 복사한 데이터인지 확인하세요.'); }
});

// Add row/col
addRowBtn?.addEventListener('click', () => {
    const cols = table.rows[1]?.cells.length || 5;
    const tr = table.insertRow();
    tr.className = 'bottom-data-row';
    for (let i = 0; i < cols; i++) {
        const td = tr.insertCell();
        td.contentEditable = true;
        td.innerHTML = '';
    }
    if (autoSave) saveTableStateDebounced();
});

addColBtn?.addEventListener('click', () => {
    for (const tr of table.rows) {
        const td = tr.insertCell();
        td.contentEditable = true;
        td.innerHTML = '';
    }
    if (autoSave) saveTableStateDebounced();
});

// Delete row(s) - based on selection; if none selected, delete last data row (not headers)
deleteRowBtn?.addEventListener('click', () => {
    // gather unique row indexes from selected cells
    const rowIndexes = new Set();
    selectedCells.forEach(cell => rowIndexes.add(cell.closest('tr').rowIndex));
    const rows = Array.from(table.rows);
    // If no selection, try to delete last bottom-data-row, else last row
    if (rowIndexes.size === 0) {
        // find last deletable row (bottom-data-row or top-data-row but avoid header/notice rows)
        for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i];
            if (r.classList.contains('bottom-data-row') || r.classList.contains('top-data-row')) {
                table.deleteRow(i);
                if (autoSave) saveTableStateDebounced();
                return;
            }
        }
        alert('삭제 가능한 데이터 행이 없습니다.');
        return;
    }

    // Convert to array and sort descending to remove without index shift problems
    const sorted = Array.from(rowIndexes).sort((a,b)=>b-a);
    for (const idx of sorted) {
        const r = table.rows[idx];
        if (!r) continue;
        // prevent deleting special single-row headers/notice rows
        if (r.classList.contains('top-notice-row') || r.classList.contains('top-data-header') || r.classList.contains('middle-notice-row') || r.classList.contains('bottom-data-header')) {
            continue;
        }
        table.deleteRow(idx);
    }
    clearSelection();
    if (autoSave) saveTableStateDebounced();
});

// Delete column(s) - based on selection; if none selected, delete last column
deleteColBtn?.addEventListener('click', () => {
    const colIndexes = new Set();
    selectedCells.forEach(cell => colIndexes.add(cell.cellIndex));
    // build rows array snapshot
    const rows = Array.from(table.rows);
    if (colIndexes.size === 0) {
        // delete last column index (find max cell count -1)
        const lastRow = rows[0];
        if (!lastRow) return;
        const lastIndex = lastRow.cells.length - 1;
        if (lastIndex < 0) return;
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (row.cells.length > lastIndex) row.deleteCell(lastIndex);
        }
        if (autoSave) saveTableStateDebounced();
        return;
    }

    // sort descending and remove cells per row
    const sortedCols = Array.from(colIndexes).sort((a,b)=>b-a);
    for (const cIdx of sortedCols) {
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (row.cells.length > cIdx) row.deleteCell(cIdx);
        }
    }
    clearSelection();
    if (autoSave) saveTableStateDebounced();
});

// Auto-fit columns: measure content width and set table-layout to auto briefly
autoFitBtn?.addEventListener('click', () => {
    const colCount = table.rows[1]?.cells.length || 0;
    const widths = new Array(colCount).fill(0);
    for (let r=0;r<table.rows.length;r++){
        for (let c=0;c< (table.rows[r].cells.length); c++){
            const cell = table.rows[r].cells[c];
            const span = document.createElement('span');
            span.style.visibility='hidden';
            span.style.whiteSpace='nowrap';
            span.style.font = window.getComputedStyle(cell).font;
            span.innerHTML = cell.innerHTML.replace(/<br>/g,' ');
            document.body.appendChild(span);
            widths[c] = Math.max(widths[c]||0, span.offsetWidth + 20);
            document.body.removeChild(span);
        }
    }
    for (let c=0;c<colCount;c++){
        for (let r=0;r<table.rows.length;r++){
            const cell = table.rows[r].cells[c];
            if (cell) cell.style.width = widths[c] + 'px';
        }
    }
});

// Toggle admin / readonly
toggleAdminBtn?.addEventListener('click', () => {
    adminMode = !adminMode;
    toggleAdminBtn.textContent = `관리자 모드: ${adminMode ? 'ON' : 'OFF'}`;
    table.querySelectorAll('td').forEach(td => td.contentEditable = adminMode);
});

// Image download (html2canvas) - include left menu, exclude right setting panel during capture
const captureWithLeftMenu = async () => {
    // hide setting panel temporarily
    const settingPanel = document.getElementById('settingPanel');
    const prevDisplay = settingPanel.style.display;
    settingPanel.style.display = 'none';

    // ensure selection box hidden for cleaner capture
    const prevSelectionDisplay = selectionBox.style.display;
    selectionBox.style.display = 'none';

    try {
        // capture whole body to include left-menu (left-menu is fixed)
        const canvas = await html2canvas(document.body, { useCORS:true, allowTaint:false, scale:2, backgroundColor: null });
        const data = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = data;
        a.download = `noblesse_full_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) { console.error('Capture failed', e); alert('이미지 생성 실패'); }
    finally {
        // restore
        settingPanel.style.display = prevDisplay;
        selectionBox.style.display = prevSelectionDisplay;
    }
};

downloadFullBtn?.addEventListener('click', captureWithLeftMenu);
downloadBtn?.addEventListener('click', captureWithLeftMenu);

// Misc: keep selection visual in sync on scroll/resize
const syncSelectionVisual = () => {
    if (selectedCells.size === 0) return;
    const arr = Array.from(selectedCells);
    updateSelectionBoxVisual(arr[0], arr[arr.length-1]);
};

document.querySelector('.wrap').addEventListener('scroll', () => syncSelectionVisual());
window.addEventListener('resize', () => syncSelectionVisual());

// Init
renderColorPalette();
initAuth();

// Mouse listeners on table
table.addEventListener('mousedown', handleMouseDown);

// Save on content changes
table.addEventListener('input', () => { if (autoSave) saveTableStateDebounced(); });

// Expose manual save for external button
window.saveTableStateImmediate = saveTableStateImmediate;

/* --------------------------
   New: document click handler
   - 목적: 드래그 후 표시되는 네모(선택상태)를 문서의 아무 곳이나 클릭하면 사라지게.
   - 단, 드래그 중(isDragging)에는 동작하지 않음.
   -------------------------- */
document.addEventListener('click', (e) => {
    // if currently dragging, ignore (mouseup will handle)
    if (isDragging) return;

    // If click happened inside table but on a cell, don't immediately clear (let cell click handlers run)
    const clickedCell = e.target.closest('td');
    // If clicked on a control input/button/color swatch we still want to clear selection (spec requested "아무데나 클릭하면 없어지게")
    // So: ALWAYS clear selection except when click is within a selection action that should not clear (e.g., dragging start handled elsewhere)
    // We'll clear selection unconditionally (this matches "아무데나 클릭하면 없어지게")
    // But to allow clicking a cell to select it, we only clear before letting other handlers run.
    // Because event order: target handlers run first. This document click runs after them.
    // So clearing here is appropriate.
    clearSelection();
});

/* --------------------------
   New: Left menu & Top menu click behavior
   - 클릭 시 active 토글 & menuIndicator에 텍스트 표시
   -------------------------- */
if (leftMenu) {
    leftMenu.addEventListener('click', (e) => {
        const li = e.target.closest('.left-item');
        if (!li) return;
        // remove previous active
        leftMenu.querySelectorAll('.left-item').forEach(it => it.classList.remove('active'));
        li.classList.add('active');
        // 표시
        if (menuIndicator) menuIndicator.textContent = `선택: ${li.textContent.trim()}`;
    });
}
if (topSubMenu) {
    topSubMenu.addEventListener('click', (e) => {
        const it = e.target.closest('.menu');
        if (!it) return;
        topSubMenu.querySelectorAll('.menu').forEach(m=>m.classList.remove('active'));
        it.classList.add('active');
        if (menuIndicator) menuIndicator.textContent = `선택: ${it.textContent.trim()}`;
    });
}

/* --------------------------
   Utility: maintain selection visual if user clicks a single cell (we set selection in mouseup)
   but because we clear selection on document click (to satisfy req #1), we ensure that clicking a cell still selects it:
   -> table mousedown/mouseup handlers add selection; document click clears AFTER them, so previously we saw clearing.
   To ensure clicks on a cell keep the single selection visible, we re-add a small handler on table click to restore if needed.
   -------------------------- */
table.addEventListener('click', (e) => {
    const cell = e.target.closest('td');
    if (!cell) return;
    // if there was no pre-existing selection (because document click cleared), ensure this clicked cell becomes selected
    // (this handles normal click-select behavior)
    clearSelection();
    cell.classList.add('selected');
    selectedCells.add(cell);
    updateSelectionBoxVisual(cell, cell);
});

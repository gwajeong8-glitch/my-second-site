// app.js (완성본)
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
const leftMenu = document.querySelector('.left-menu'); // 왼쪽 메뉴 DOM 참조 추가

// Tool buttons
const autoSaveToggleBtn = document.getElementById('autoSaveToggleBtn');
const saveNowBtn = document.getElementById('saveNowBtn');
const copyBtn = document.getElementById('copyBtn');
const pasteBtn = document.getElementById('pasteBtn');
const addRowBtn = document.getElementById('addRowBtn');
const deleteRowBtn = document.getElementById('deleteRowBtn'); // 행 삭제 버튼 추가
const addColBtn = document.getElementById('addColBtn');
const deleteColBtn = document.getElementById('deleteColBtn'); // 열 삭제 버튼 추가
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
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, ms);
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
    // 모든 높이 조절 버튼의 data-target에 해당하는 input 값 저장
    document.querySelectorAll('.height-apply-btn').forEach(button => {
        const targetClass = button.dataset.target; // 예: top-notice-row, top-data-row
        let inputElement;
        if (targetClass === 'top-notice-row') {
            inputElement = document.getElementById('topNoticeRowHeightInput');
        } else if (targetClass === 'top-data-row') {
            inputElement = document.getElementById('topDataRowHeightInput');
        } else if (targetClass === 'middle-notice-row') {
            inputElement = document.getElementById('middleNoticeRowHeightInput');
        } else if (targetClass === 'bottom-data-row') {
            inputElement = document.getElementById('bottomDataRowHeightInput');
        }
        
        if (inputElement) {
            rowHeights[targetClass] = inputElement.value;
        }
    });

    return { cells: cellStates, rowHeights, timestamp: new Date(), tableHTML: table.outerHTML }; // 테이블 구조 자체를 저장
};

const saveTableStateImmediate = async () => {
    if (!currentUserId || !isAuthReady) return;
    try {
        await setDoc(getTableDocRef(currentUserId), serializeTableState(), { merge: true });
        console.log('Saved state to Firebase.');
    } catch (e) {
        console.error('Error saving state:', e);
    }
};
const saveTableStateDebounced = debounce(saveTableStateImmediate, autoSaveDebounceMs);

const applyLoadedState = (data) => {
    if (!data) return;

    // 테이블 구조 복원 (행/열 추가 삭제 후 새로고침 시 중요)
    if (data.tableHTML && !initialLoadDone) { // 초기 로드 시에만 HTML 구조를 복원하여 DOM을 재구성
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data.tableHTML;
        const loadedTable = tempDiv.querySelector('.data-table');
        if (loadedTable) {
            table.replaceWith(loadedTable);
            // 새로운 테이블 참조로 업데이트
            table = document.querySelector('.data-table'); 
            // 새로 생성된 셀에 이벤트 리스너 다시 바인딩 (컨텐츠 수정 시 저장)
            table.addEventListener('input', () => { if (autoSave) saveTableStateDebounced(); });
            table.addEventListener('mousedown', handleMouseDown);
            // 관리자 모드 상태에 따라 contentEditable 다시 설정
            table.querySelectorAll('td').forEach(td => td.contentEditable = adminMode);
        }
    }

    // 셀 내용 및 스타일 복원
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

    // 행 높이 복원 및 적용
    if (data.rowHeights) {
        for (const [targetClass, value] of Object.entries(data.rowHeights)) {
            let inputElement;
            if (targetClass === 'top-notice-row') {
                inputElement = document.getElementById('topNoticeRowHeightInput');
            } else if (targetClass === 'top-data-row') {
                inputElement = document.getElementById('topDataRowHeightInput');
            } else if (targetClass === 'middle-notice-row') {
                inputElement = document.getElementById('middleNoticeRowHeightInput');
            } else if (targetClass === 'bottom-data-row') {
                inputElement = document.getElementById('bottomDataRowHeightInput');
            }

            if (inputElement) {
                inputElement.value = value;
                applyRowHeight(targetClass, value); // 복원된 값으로 높이 즉시 적용
            }
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
            // 문서가 없으면 초기 상태 저장 (최초 로드 시)
            saveTableStateImmediate();
        }
        initialLoadDone = true;
    }, (error) => console.error('Listen error:', error));
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
                console.error('Anonymous authentication failed:', e);
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

const getCellCoordinates = (cell) => {
    const row = cell.closest('tr');
    if (!row) return { rowIndex: -1, cellIndex: -1 };
    return { rowIndex: row.rowIndex, cellIndex: cell.cellIndex };
};

// Mouse handlers for table selection
const handleMouseDown = (e) => {
    if (e.target.closest('.setting-panel')) return;
    const cell = e.target.closest('td');
    if (!cell) return;

    isDragging = false;
    startCell = cell;
    endCell = cell;
    // 클릭 시점에 바로 선택 상태 업데이트
    clearSelection();
    startCell.classList.add('selected');
    selectedCells.add(startCell);

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
        // 단일 클릭 시 이미 handleMouseDown에서 처리됨
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
const applyRowHeight = (targetClass, value) => {
    const heightPx = `${value}px`;
    document.querySelectorAll(`.${targetClass}`).forEach(row => {
        // top-data-header, bottom-data-header도 해당하는 경우에만 높이 적용
        if (targetClass === 'top-data-row' && row.classList.contains('top-data-header')) {
            row.style.height = heightPx;
        } else if (targetClass === 'bottom-data-row' && row.classList.contains('bottom-data-header')) {
            row.style.height = heightPx;
        } else if (row.classList.contains(targetClass)) {
            row.style.height = heightPx;
        }
    });
    if (autoSave) saveTableStateDebounced();
};

document.querySelectorAll('.height-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetClass = btn.dataset.target; // 예: top-notice-row, top-data-row
        let inputElement;
        if (targetClass === 'top-notice-row') {
            inputElement = document.getElementById('topNoticeRowHeightInput');
        } else if (targetClass === 'top-data-row') {
            inputElement = document.getElementById('topDataRowHeightInput');
        } else if (targetClass === 'middle-notice-row') {
            inputElement = document.getElementById('middleNoticeRowHeightInput');
        } else if (targetClass === 'bottom-data-row') {
            inputElement = document.getElementById('bottomDataRowHeightInput');
        }

        if (inputElement) {
            applyRowHeight(targetClass, inputElement.value);
        }
    });
});


// Autosave toggle
autoSaveToggleBtn?.addEventListener('click', () => {
    autoSave = !autoSave;
    autoSaveToggleBtn.textContent = `자동저장: ${autoSave ? 'ON' : 'OFF'}`;
    if (autoSave) saveTableStateImmediate(); // 자동저장 ON 시 즉시 한번 저장
});

// Manual save
saveNowBtn?.addEventListener('click', () => saveTableStateImmediate());

// Copy / Paste (JSON clipboard)
copyBtn?.addEventListener('click', async () => {
    if (selectedCells.size === 0) {
        alert('복사할 셀을 선택해주세요.');
        return;
    }
    const data = [];
    selectedCells.forEach(cell => {
        const coords = getCellCoordinates(cell);
        data.push({ r: coords.rowIndex, c: coords.cellIndex, html: cell.innerHTML, color: cell.style.color || '', bg: cell.style.backgroundColor || '', fontSize: cell.style.fontSize || '' });
    });
    try {
        await navigator.clipboard.writeText(JSON.stringify(data));
        alert('복사 완료');
    } catch (e) { console.error('복사 실패:', e); alert('복사 실패 - 보안 정책으로 인해 클립보드 접근이 제한될 수 있습니다.'); }
});

pasteBtn?.addEventListener('click', async () => {
    try {
        const txt = await navigator.clipboard.readText();
        const data = JSON.parse(txt);
        if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid or empty clipboard data.');

        // 선택된 셀이 있다면 그 셀을 기준으로 붙여넣기 시작
        let startR = 0, startC = 0;
        if (selectedCells.size > 0) {
            const firstSelected = Array.from(selectedCells)[0];
            const coords = getCellCoordinates(firstSelected);
            startR = coords.rowIndex;
            startC = coords.cellIndex;
        }

        data.forEach(item => {
            const targetRowIndex = startR + (item.r - data[0].r); // 첫 복사된 셀 기준으로 상대적 위치 계산
            const targetColIndex = startC + (item.c - data[0].c);

            const row = table.rows[targetRowIndex];
            if (!row) return;
            const cell = row.cells[targetColIndex];
            if (!cell) return;
            
            cell.innerHTML = item.html;
            cell.style.color = item.color || '';
            cell.style.backgroundColor = item.bg || '';
            cell.style.fontSize = item.fontSize || '';
        });
        if (autoSave) saveTableStateDebounced();
        alert('붙여넣기 완료');
    } catch (e) { console.error('붙여넣기 실패:', e); alert('붙여넣기 실패 - 클립보드 데이터가 유효하지 않거나 보안 정책으로 인해 제한될 수 있습니다.'); }
});


// Add row/col
addRowBtn?.addEventListener('click', () => {
    // 선택된 행 바로 아래에 추가하거나, 선택된 행이 없으면 마지막에 추가
    let targetRowIndex = table.rows.length - 1; // 기본은 마지막
    if (selectedCells.size > 0) {
        const lastSelectedCell = Array.from(selectedCells).reduce((prev, curr) => 
            getCellCoordinates(curr).rowIndex > getCellCoordinates(prev).rowIndex ? curr : prev
        );
        targetRowIndex = getCellCoordinates(lastSelectedCell).rowIndex;
    }

    const newRow = table.insertRow(targetRowIndex + 1);
    newRow.className = 'bottom-data-row'; // 기본 클래스
    const cols = table.rows[0]?.cells.length || 5; // 첫 번째 행의 셀 개수 기준
    for (let i = 0; i < cols; i++) {
        const td = newRow.insertCell();
        td.contentEditable = adminMode; // 관리자 모드에 따라 설정
        td.innerHTML = '';
        td.addEventListener('input', () => { if (autoSave) saveTableStateDebounced(); });
    }
    if (autoSave) saveTableStateDebounced();
});

deleteRowBtn?.addEventListener('click', () => {
    if (selectedCells.size === 0) {
        alert('삭제할 행의 셀을 하나 이상 선택해주세요.');
        return;
    }
    if (!confirm('선택된 행을 삭제하시겠습니까?')) return;

    const rowsToDelete = new Set();
    selectedCells.forEach(cell => {
        rowsToDelete.add(cell.closest('tr'));
    });

    const sortedRowsToDelete = Array.from(rowsToDelete).sort((a, b) => b.rowIndex - a.rowIndex); // 역순으로 정렬하여 삭제 시 인덱스 문제 방지
    sortedRowsToDelete.forEach(row => {
        if (row && row.parentNode) {
            // 헤더 행이나 중요한 공지 행은 삭제 방지 (필요시 클래스 등으로 구분)
            if (!row.classList.contains('top-notice-row') && !row.classList.contains('top-data-header') && !row.classList.contains('middle-notice-row') && !row.classList.contains('bottom-data-header')) {
                row.parentNode.removeChild(row);
            } else {
                console.warn("Important row blocked from deletion:", row);
            }
        }
    });
    clearSelection();
    if (autoSave) saveTableStateDebounced();
});


addColBtn?.addEventListener('click', () => {
    // 선택된 열 바로 오른쪽에 추가하거나, 선택된 열이 없으면 마지막에 추가
    let targetColIndex = table.rows[0]?.cells.length || 0; // 기본은 마지막
    if (selectedCells.size > 0) {
        const lastSelectedCell = Array.from(selectedCells).reduce((prev, curr) => 
            getCellCoordinates(curr).cellIndex > getCellCoordinates(prev).cellIndex ? curr : prev
        );
        targetColIndex = getCellCoordinates(lastSelectedCell).cellIndex;
    }

    for (const tr of table.rows) {
        const td = tr.insertCell(targetColIndex + 1);
        td.contentEditable = adminMode; // 관리자 모드에 따라 설정
        td.innerHTML = '';
        td.addEventListener('input', () => { if (autoSave) saveTableStateDebounced(); });
    }
    if (autoSave) saveTableStateDebounced();
});

deleteColBtn?.addEventListener('click', () => {
    if (selectedCells.size === 0) {
        alert('삭제할 열의 셀을 하나 이상 선택해주세요.');
        return;
    }
    if (!confirm('선택된 열을 삭제하시겠습니까?')) return;

    const colsToDelete = new Set();
    selectedCells.forEach(cell => {
        colsToDelete.add(cell.cellIndex);
    });

    const sortedColsToDelete = Array.from(colsToDelete).sort((a, b) => b - a); // 역순으로 정렬하여 삭제 시 인덱스 문제 방지

    table.querySelectorAll('tr').forEach(row => {
        sortedColsToDelete.forEach(colIndex => {
            if (row.cells[colIndex]) {
                row.deleteCell(colIndex);
            }
        });
    });
    clearSelection();
    if (autoSave) saveTableStateDebounced();
});


// Auto-fit columns: measure content width and set table-layout to auto briefly
autoFitBtn?.addEventListener('click', () => {
    const colCount = table.rows[0]?.cells.length || 0; // 첫 번째 행의 셀 개수를 기준으로 열 개수 파악
    const widths = new Array(colCount).fill(0);

    for (let r = 0; r < table.rows.length; r++) {
        const row = table.rows[r];
        for (let c = 0; c < row.cells.length; c++) {
            const cell = row.cells[c];
            if (c >= colCount) continue; // 열 개수 초과하는 셀은 무시 (colspan 등 예외 처리 필요시)

            const span = document.createElement('span');
            span.style.visibility = 'hidden';
            span.style.whiteSpace = 'nowrap';
            span.style.font = window.getComputedStyle(cell).font; // 셀의 폰트 스타일 적용
            span.innerHTML = cell.innerHTML.replace(/<br>/g, ' '); // <br> 태그 처리
            document.body.appendChild(span);
            widths[c] = Math.max(widths[c] || 0, span.offsetWidth + 20); // 패딩 추가
            document.body.removeChild(span);
        }
    }

    // 계산된 너비 적용
    for (let c = 0; c < colCount; c++) {
        // 모든 행의 해당 열 셀에 너비 적용
        for (let r = 0; r < table.rows.length; r++) {
            const cell = table.rows[r].cells[c];
            if (cell) cell.style.width = `${widths[c]}px`;
        }
    }
    if (autoSave) saveTableStateDebounced();
});


// Toggle admin / readonly
toggleAdminBtn?.addEventListener('click', () => {
    adminMode = !adminMode;
    toggleAdminBtn.textContent = `관리자 모드: ${adminMode ? 'ON' : 'OFF'}`;
    table.querySelectorAll('td').forEach(td => td.contentEditable = adminMode);
    if (autoSave) saveTableStateDebounced();
});


// Image download (html2canvas) - 왼쪽 메뉴 포함
downloadFullBtn?.addEventListener('click', async () => {
    // 캡처할 전체 영역 (body 또는 특정 wrapper)을 선택하여 left-menu와 table을 모두 포함
    const captureArea = document.body; // body 전체를 캡처 대상으로 설정

    // 임시 스타일 적용: left-menu와 wrap을 나란히 배치하여 캡처될 수 있도록
    const originalBodyOverflow = document.body.style.overflow;
    const originalWrapWidth = document.querySelector('.wrap').style.maxWidth;
    const originalWrapMarginLeft = document.querySelector('.wrap').style.marginLeft;
    const originalLeftMenuPosition = leftMenu.style.position;
    const originalLeftMenuLeft = leftMenu.style.left;

    document.body.style.overflow = 'hidden'; // 캡처 중 스크롤바 숨김
    document.querySelector('.wrap').style.maxWidth = 'none'; // wrap의 최대 너비 제한 해제
    document.querySelector('.wrap').style.marginLeft = '0'; // wrap 마진 초기화

    // left-menu를 일시적으로 document flow에 맞게 조정
    leftMenu.style.position = 'relative'; 
    leftMenu.style.left = '0';
    
    // 캡처할 요소들 모두 포함하는 새로운 임시 wrapper 생성
    const tempWrapper = document.createElement('div');
    tempWrapper.style.display = 'flex';
    tempWrapper.style.width = 'fit-content'; // 내용에 맞게 너비 조절
    tempWrapper.style.backgroundColor = '#1a1a1a'; // body 배경색과 동일하게 설정
    tempWrapper.appendChild(leftMenu.cloneNode(true)); // leftMenu 복사본 추가
    tempWrapper.appendChild(document.querySelector('.wrap').cloneNode(true)); // wrap 복사본 추가

    // 원본 요소들은 임시로 숨김
    leftMenu.style.visibility = 'hidden';
    document.querySelector('.wrap').style.visibility = 'hidden';

    // 임시 wrapper를 body에 추가 (화면에 보이지 않도록 절대 위치 사용)
    tempWrapper.style.position = 'absolute';
    tempWrapper.style.top = '-9999px';
    tempWrapper.style.left = '-9999px';
    document.body.appendChild(tempWrapper);


    try {
        const canvas = await html2canvas(tempWrapper, { 
            useCORS: true, 
            allowTaint: false, 
            scale: 2, 
            backgroundColor: '#1a1a1a', // 배경색 지정
            // capture 영역을 tempWrapper로 지정
            width: tempWrapper.offsetWidth,
            height: tempWrapper.offsetHeight
        });
        const data = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = data;
        a.download = `noblesse_full_capture_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) { 
        console.error('Capture failed:', e); 
        alert('이미지 생성 실패 - CORS 문제 또는 요소 렌더링 문제일 수 있습니다.'); 
    } finally {

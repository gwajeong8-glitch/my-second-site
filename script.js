// --- 1. 색상 팔레트 및 편집 기능 변수 설정 ---

const colors = [
    '#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#ADFF2F', '#00FF00', '#3CB371', '#00FFFF',
    '#1E90FF', '#0000FF', '#8A2BE2', '#9400D3', '#FF00FF', '#FF69B4', '#FFC0CB', '#FFFFFF',
    '#CCCCCC', '#999999', '#666666', '#333333', '#000000',
    '#800000', '#8B4513', '#D2B48C', '#F5DEB3', '#9ACD32', '#556B2F', '#008080', '#4682B4',
    '#4169E1', '#800080', '#DDA0DD', '#F08080', '#2F4F4F', '#A9A9A9', '#778899', '#C0C0C0',
    '#228B22', '#CD5C5C', '#6A5ACD'
];

const colorPalette = document.querySelector('.color-palette');
let dataTable = document.querySelector('.data-table');
const applyFontSizeBtn = document.getElementById('applyFontSizeBtn');
const fontSizeInput = document.getElementById('fontSizeInput');

// 📐 그룹별 높이 입력 필드 변수
const topRowHeightInput = document.getElementById('topRowHeightInput');
const middleRowHeightInput = document.getElementById('middleRowHeightInput');
const bottomRowHeightInput = document.getElementById('bottomRowHeightInput');
// 📐 그룹별 적용 버튼 변수
const applyTopRowHeightBtn = document.getElementById('applyTopRowHeightBtn');
const applyMiddleRowHeightBtn = document.getElementById('applyMiddleRowHeightBtn');
const applyBottomRowHeightBtn = document.getElementById('applyBottomRowHeightBtn');

const resizerDisplay = document.getElementById('resizerDisplay');


// 💡 드래그 선택을 위한 변수 추가
let isDragging = false;
let startCell = null; // 드래그 시작 셀
let endCell = null; // 드래그 종료 셀
let selectionBox = null; // 드래그 영역을 시각적으로 표시할 요소 (옵션)


// 🚀 LocalStorage에 테이블 내용을 저장하는 함수
function saveSettings() {
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
        // 'selected' 클래스를 저장하기 전에 제거하여 다음 로드 시 셀이 선택되지 않은 상태로 시작
        document.querySelectorAll('.data-table td.selected').forEach(c => c.classList.remove('selected'));

        localStorage.setItem('noblesseTableState', captureArea.innerHTML);

        if (topRowHeightInput) localStorage.setItem('topRowHeightValue', topRowHeightInput.value);
        if (middleRowHeightInput) localStorage.setItem('middleRowHeightValue', middleRowHeightInput.value);
        if (bottomRowHeightInput) localStorage.setItem('bottomRowHeightValue', bottomRowHeightInput.value);

        const colorTarget = document.querySelector('input[name="colorTarget"]:checked');
        if (colorTarget) localStorage.setItem('colorTarget', colorTarget.value);

        const activeMenuItem = document.querySelector('.left-item.active');
        if (activeMenuItem) {
            const index = Array.from(document.querySelectorAll('.left-item')).indexOf(activeMenuItem);
            localStorage.setItem('activeLeftMenuIndex', index.toString());
        }
    }
}

// 🚀 LocalStorage에서 저장된 내용을 불러와 적용하는 함수
function loadSettings() {
    const savedState = localStorage.getItem('noblesseTableState');
    if (savedState) {
        const captureArea = document.getElementById('capture-area');
        if (captureArea) {
            captureArea.innerHTML = savedState;
            dataTable = document.querySelector('.data-table');

            const savedTopHeight = localStorage.getItem('topRowHeightValue');
            const savedMiddleHeight = localStorage.getItem('middleRowHeightValue');
            const savedBottomHeight = localStorage.getItem('bottomRowHeightValue');

            if (topRowHeightInput && savedTopHeight) {
                topRowHeightInput.value = savedTopHeight;
            }
            if (middleRowHeightInput && savedMiddleHeight) {
                middleRowHeightInput.value = savedMiddleHeight;
            }
            if (bottomRowHeightInput && savedBottomHeight) {
                bottomRowHeightInput.value = savedBottomHeight;
            }

            const savedColorTarget = localStorage.getItem('colorTarget') || 'text';
            const targetInput = document.querySelector(`input[name="colorTarget"][value="${savedColorTarget}"]`);
            if(targetInput) targetInput.checked = true;

            console.log('이전 설정이 성공적으로 로드되었습니다. (Local Storage)');
        }
    }
}

// 🎨 색상 타겟 변경 이벤트 리스너 추가
function initializeColorTargetControl() {
    document.querySelectorAll('input[name="colorTarget"]').forEach(radio => {
        radio.addEventListener('change', saveSettings);
    });
}

// 팔레트 생성 (색상 스와치 화면에 표시)
function initializeColorPalette() {
    if (colorPalette.children.length > 0) return;

    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        swatch.addEventListener('click', () => {
            applyColor(color);
            saveSettings();
        });
        colorPalette.appendChild(swatch);
    });
}


// --- 드래그 선택 로직 구현 ---

/**
 * 주어진 두 셀을 포함하는 직사각형 영역 내의 모든 셀에 'selected' 클래스를 적용합니다.
 * @param {HTMLElement} startCell - 드래그 시작 셀
 * @param {HTMLElement} endCell - 드래그 종료 셀
 */
function selectCellsInDragArea(startCell, endCell) {
    if (!startCell || !endCell) return;

    // 테이블 전체 셀 목록을 가져옵니다.
    const allCells = Array.from(dataTable.querySelectorAll('td'));
    const rows = Array.from(dataTable.querySelectorAll('tr'));

    // 셀의 행/열 인덱스를 찾는 헬퍼 함수
    const getCellIndices = (cell) => {
        const row = cell.parentElement;
        if (!row) return null;
        const rowIndex = rows.indexOf(row);
        // colspan이 있는 셀은 제외하고 계산해야 하지만, 간단한 구현을 위해 cell.cellIndex 사용 (일반적인 테이블 구조 가정)
        const cellIndex = Array.from(row.children).indexOf(cell);
        return { rowIndex, cellIndex };
    };

    const start = getCellIndices(startCell);
    const end = getCellIndices(endCell);

    if (!start || !end) return;

    // 선택 영역의 최소/최대 행/열 인덱스 계산
    const minRow = Math.min(start.rowIndex, end.rowIndex);
    const maxRow = Math.max(start.rowIndex, end.rowIndex);
    const minCol = Math.min(start.cellIndex, end.cellIndex);
    const maxCol = Math.max(start.cellIndex, end.cellIndex);

    // 모든 셀의 선택을 해제합니다. (Shift 키를 누르지 않고 드래그 시작 시)
    // 드래그가 시작될 때 이미 해제되었어야 하지만, 안전을 위해 다시 확인
    if (!window.event.shiftKey) {
        document.querySelectorAll('.data-table td.selected').forEach(c => c.classList.remove('selected'));
    }

    // 선택 영역에 포함되는 셀을 찾아 'selected' 클래스를 추가합니다.
    rows.forEach((row, rIndex) => {
        if (rIndex >= minRow && rIndex <= maxRow) {
            Array.from(row.children).forEach((cell, cIndex) => {
                if (cIndex >= minCol && cIndex <= maxCol) {
                    // 크기 조절 요소에 가려지지 않도록 TD 요소 자체인지 확인
                    if (cell.tagName === 'TD') {
                        cell.classList.add('selected');
                    }
                }
            });
        }
    });
}

function handleDragStart(e) {
    // 🖱️ 왼쪽 메뉴나 설정 패널을 클릭한 경우에는 드래그 방지
    if (!e.target.closest('.data-table') || e.target.closest('.resizer-display') || e.target.closest('.col-resizer') || e.target.closest('.row-resizer')) return;

    // 💡 셀 내용 편집 모드에서는 드래그 선택 방지 (텍스트 선택이 우선되어야 함)
    if (e.target.closest('td') && e.target.closest('td').getAttribute('contenteditable') === 'true') {
        // 셀 내용이 이미 선택되어 있다면 텍스트 드래그를 허용
        const selection = window.getSelection();
        if (selection.toString().length > 0) return;
    }


    e.preventDefault(); // 기본 드래그 방지
    isDragging = true;

    // 드래그 시작 시 기존 선택 해제 (Shift 키를 누른 경우는 제외)
    if (!e.shiftKey) {
        document.querySelectorAll('.data-table td.selected').forEach(c => c.classList.remove('selected'));
    }

    startCell = e.target.closest('td');

    // 드래그 선택 시각적 요소 생성 (선택 사항)
    if (!selectionBox) {
        selectionBox = document.createElement('div');
        selectionBox.style.position = 'absolute';
        selectionBox.style.border = '1px dashed #FFD700';
        selectionBox.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
        selectionBox.style.pointerEvents = 'none'; // 마우스 이벤트를 통과시켜 셀을 선택할 수 있도록
        selectionBox.style.zIndex = '10';
        document.body.appendChild(selectionBox);
    }
    selectionBox.style.display = 'block';

    // 드래그 선택 초기 위치 설정 (dataTable 기준으로)
    const tableRect = dataTable.getBoundingClientRect();
    const cellRect = startCell.getBoundingClientRect();

    selectionBox.style.left = (cellRect.left - tableRect.left + dataTable.parentElement.offsetLeft) + 'px';
    selectionBox.style.top = (cellRect.top - tableRect.top + dataTable.parentElement.offsetTop) + 'px';
    selectionBox.style.width = cellRect.width + 'px';
    selectionBox.style.height = cellRect.height + 'px';

    document.addEventListener('mousemove', handleDragging);
    document.addEventListener('mouseup', handleDragEnd);
}

function handleDragging(e) {
    if (!isDragging) return;

    // 현재 마우스 위치 아래의 셀 찾기
    const cellUnderMouse = e.target.closest('td');

    if (cellUnderMouse && cellUnderMouse !== endCell) {
        endCell = cellUnderMouse;
        // 선택 영역에 포함된 셀에 클래스 적용
        selectCellsInDragArea(startCell, endCell);
    }

    // 뷰포트 내의 드래그 사각형 업데이트
    if (selectionBox && startCell && endCell) {
        const startRect = startCell.getBoundingClientRect();
        const endRect = endCell.getBoundingClientRect();
        const tableRect = dataTable.getBoundingClientRect();
        const wrapOffsetLeft = dataTable.parentElement.offsetLeft; // .wrap의 offset
        const wrapOffsetTop = dataTable.parentElement.offsetTop;

        const left = Math.min(startRect.left, endRect.left);
        const top = Math.min(startRect.top, endRect.top);
        const right = Math.max(startRect.right, endRect.right);
        const bottom = Math.max(startRect.bottom, endRect.bottom);

        // .wrap 기준으로 위치 조정
        selectionBox.style.left = (left - tableRect.left + wrapOffsetLeft) + 'px';
        selectionBox.style.top = (top - tableRect.top + wrapOffsetTop) + 'px';
        selectionBox.style.width = (right - left) + 'px';
        selectionBox.style.height = (bottom - top) + 'px';
    }
}

function handleDragEnd() {
    if (!isDragging) return;

    isDragging = false;
    startCell = null;
    endCell = null;

    if (selectionBox) {
        selectionBox.style.display = 'none';
    }

    document.removeEventListener('mousemove', handleDragging);
    document.removeEventListener('mouseup', handleDragEnd);

    // 드래그 종료 후 최종 상태 저장
    saveSettings();
}

// 💡 셀 클릭 이벤트: Shift 키를 사용하여 단일/다중 선택 토글
function initializeCellInteraction() {
    if (dataTable) {
        // 기존 리스너 제거
        dataTable.removeEventListener('click', handleCellClick);
        dataTable.removeEventListener('input', saveSettings);
        dataTable.removeEventListener('mousedown', handleDragStart); // 드래그 시작 이벤트 제거

    }

    dataTable = document.querySelector('.data-table');
    if (!dataTable) return;

    function handleCellClick(e) {
        if (e.target.tagName === 'TD') {
            const cell = e.target;

            // 크기 조절 중이거나 드래그 중인 경우에는 셀 선택을 막습니다.
            if (dataTable.classList.contains('resizing') || isDragging) return;

            if (e.shiftKey) {
                // Shift 키: 기존 선택 유지 및 현재 셀 토글
                cell.classList.toggle('selected');
            } else {
                // Shift 키 없음: 기존 선택 모두 해제 후 현재 셀만 선택
                document.querySelectorAll('.data-table td.selected').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
            }
        }
    }

    dataTable.addEventListener('click', handleCellClick);
    dataTable.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
            saveSettings();
        }
    });

    // 🚀 드래그 이벤트 리스너 추가 (dataTable 전체)
    dataTable.addEventListener('mousedown', handleDragStart);
    // mousemove, mouseup은 handleDragStart에서 동적으로 추가/제거됩니다.
}

// 🚀 색상 적용 함수
function applyColor(color) {
    const target = document.querySelector('input[name="colorTarget"]:checked').value;

    const cellsToApply = document.querySelectorAll('.data-table td.selected');

    cellsToApply.forEach(cell => {
        if (target === 'background') {
            cell.style.backgroundColor = color;
            cell.dataset.bgColor = color;
        } else { // target === 'text'
            cell.style.color = color;
        }
    });
}


// 📏 글꼴 크기 적용 함수
function initializeFontSizeControl() {
    if (applyFontSizeBtn) {
        applyFontSizeBtn.removeEventListener('click', handleApplyFontSize);
        applyFontSizeBtn.addEventListener('click', handleApplyFontSize);
    }
}

function handleApplyFontSize() {
    const newSize = fontSizeInput.value + 'px';
    document.querySelectorAll('.data-table td.selected').forEach(cell => {
        cell.style.fontSize = newSize;
        cell.style.lineHeight = '1.2';
    });
    saveSettings();
}


// --- 2. 🖼️ 이미지 다운로드 기능 (변경 없음) ---
function downloadImage(elementId, filename) {
    const element = document.getElementById(elementId);
    const settingPanel = document.getElementById('settingPanel');
    settingPanel.style.display = 'none';

    html2canvas(element, {
        scale: 2,
        backgroundColor: null,
        useCORS: true
    }).then(canvas => {
        settingPanel.style.display = 'block';

        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        console.error('이미지 캡처 중 오류 발생:', error);
        settingPanel.style.display = 'block';
    });
}


// --- 3. 📐 셀 크기 조절 (Resizer) 로직 (변경 없음) ---
let currentResizer = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let isRowResizer = false;

// 초기화: 각 셀에 리사이저 추가
function initializeResizers() {
    document.querySelectorAll('.col-resizer, .row-resizer').forEach(r => r.remove());

    dataTable = document.querySelector('.data-table');
    if (!dataTable) return;

    dataTable.querySelectorAll('tr:not(.middle-notice-row, .top-notice-row) td').forEach(td => {
        if (td.nextElementSibling) {
            let colResizer = document.createElement('div');
            colResizer.className = 'col-resizer';
            td.appendChild(colResizer);
            colResizer.addEventListener('mousedown', startResize);
        }

        const tr = td.parentElement;
        if (td.getAttribute('colspan') === null) {
            let rowResizer = document.createElement('div');
            rowResizer.className = 'row-resizer';
            td.appendChild(rowResizer);
            rowResizer.addEventListener('mousedown', startResize);
        }
    });
}

function startResize(e) {
    e.preventDefault();

    currentResizer = e.target;
    startX = e.clientX;
    startY = e.clientY;

    const cell = currentResizer.parentElement;

    if (currentResizer.classList.contains('col-resizer')) {
        isRowResizer = false;
        startWidth = cell.offsetWidth;
        dataTable.classList.add('resizing');
        if (resizerDisplay) resizerDisplay.style.opacity = 1;
    } else if (currentResizer.classList.contains('row-resizer')) {
        isRowResizer = true;
        startHeight = cell.offsetHeight;
        dataTable.classList.add('resizing');
        if (resizerDisplay) resizerDisplay.style.opacity = 1;
    }

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
}

function handleResize(e) {
    if (!currentResizer) return;

    const cell = currentResizer.parentElement;

    if (!isRowResizer) {
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        if (newWidth > 30) {
            cell.style.width = newWidth + 'px';
            cell.style.minWidth = newWidth + 'px';
        }

        if (resizerDisplay) {
            resizerDisplay.textContent = `${Math.round(newWidth)} px (가로)`;
            resizerDisplay.style.left = (e.clientX + 10) + 'px';
            resizerDisplay.style.top = (e.clientY + 10) + 'px';
        }

    } else {
        const deltaY = e.clientY - startY;
        const newHeight = startHeight + deltaY;

        if (newHeight > 20) {
            const row = cell.parentElement;
            row.style.height = newHeight + 'px';
            row.querySelectorAll('td').forEach(td => {
                td.style.height = newHeight + 'px';
            });
        }

        if (resizerDisplay) {
            resizerDisplay.textContent = `${Math.round(newHeight)} px (세로)`;
            resizerDisplay.style.left = (e.clientX + 10) + 'px';
            resizerDisplay.style.top = (e.clientY + 10) + 'px';
        }
    }
}

function stopResize() {
    currentResizer = null;
    dataTable.classList.remove('resizing');

    if (resizerDisplay) resizerDisplay.style.opacity = 0;

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);

    saveSettings();
}


// --- 4. 🖱️ 왼쪽 메뉴 항목 색상 토글 기능 (변경 없음) ---
function initializeLeftMenu() {
    const leftMenuItems = document.querySelectorAll('.left-item');

    const savedIndex = localStorage.getItem('activeLeftMenuIndex');
    if (savedIndex !== null) {
        leftMenuItems.forEach(i => i.classList.remove('active'));
        if (leftMenuItems[parseInt(savedIndex)]) {
            leftMenuItems[parseInt(savedIndex)].classList.add('active');
        }
    }

    leftMenuItems.forEach(item => {
        item.removeEventListener('click', handleLeftMenuClick);
        item.addEventListener('click', handleLeftMenuClick);
    });

    function handleLeftMenuClick() {
        leftMenuItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        saveSettings();
    }
}


// 🚀 특정 행 선택자에 강제 높이 스타일을 적용하는 함수 (변경 없음)
function applyRowHeight(selector, newHeight) {
    document.querySelectorAll(selector).forEach(row => {
        row.style.height = newHeight;
        row.querySelectorAll('td').forEach(td => {
            td.style.height = newHeight;
            td.style.lineHeight = '1.2';
        });
    });
}


// --- 5. 📏 그룹별 행 높이 조절 기능 (변경 없음) ---
function initializeRowHeightControl() {

    if (applyTopRowHeightBtn && topRowHeightInput) {
        applyTopRowHeightBtn.removeEventListener('click', handleApplyTopRowHeight);
        applyTopRowHeightBtn.addEventListener('click', handleApplyTopRowHeight);
        applyRowHeight('.top-data-header, .top-data-row', topRowHeightInput.value + 'px');
    }

    if (applyMiddleRowHeightBtn && middleRowHeightInput) {
        applyMiddleRowHeightBtn.removeEventListener('click', handleApplyMiddleRowHeight);
        applyMiddleRowHeightBtn.addEventListener('click', handleApplyMiddleRowHeight);
        applyRowHeight('.middle-notice-row', middleRowHeightInput.value + 'px');
    }

    if (applyBottomRowHeightBtn && bottomRowHeightInput) {
        applyBottomRowHeightBtn.removeEventListener('click', handleApplyBottomRowHeight);
        applyBottomRowHeightBtn.addEventListener('click', handleApplyBottomRowHeight);
        applyRowHeight('.bottom-data-header, .bottom-data-row', bottomRowHeightInput.value + 'px');
    }
}

function handleApplyTopRowHeight() {
    const newHeightValue = topRowHeightInput.value;
    const newHeight = newHeightValue + 'px';
    applyRowHeight('.top-data-header, .top-data-row', newHeight);
    saveSettings();
}

function handleApplyMiddleRowHeight() {
    const newHeightValue = middleRowHeightInput.value;
    const newHeight = newHeightValue + 'px';
    applyRowHeight('.middle-notice-row', newHeight);
    saveSettings();
}

function handleApplyBottomRowHeight() {
    const newHeightValue = bottomRowHeightInput.value;
    const newHeight = newHeightValue + 'px';
    applyRowHeight('.bottom-data-header, .bottom-data-row', newHeight);
    saveSettings();
}


// 페이지 로드 시 기능 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 1. 색상 팔레트 초기화
    initializeColorPalette();

    // 2. 저장된 설정을 먼저 로드하여 DOM 구조와 UI 입력값 복원
    loadSettings();

    // 3. 로드된 새로운 DOM 구조에 맞춰 모든 이벤트와 리사이저를 초기화
    initializeCellInteraction(); // 🚀 드래그 선택 리스너 포함
    initializeColorTargetControl();
    initializeFontSizeControl();
    initializeResizers();
    initializeLeftMenu();
    initializeRowHeightControl();

    // 다운로드 버튼에 이벤트 핸들러 할당
    document.querySelector('.download-button').removeEventListener('click', downloadImage);
    document.querySelector('.download-button').addEventListener('click', () => downloadImage('capture-area', 'noblesse_data_capture.png'));
});

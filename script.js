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
// dataTable은 DOMContentLoaded 이후에 다시 할당될 수 있음
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


// 🚀 LocalStorage에 테이블 내용을 저장하는 함수
function saveSettings() {
    const captureArea = document.getElementById('capture-area');
    if (captureArea) {
        // 테이블 내용 전체 저장
        localStorage.setItem('noblesseTableState', captureArea.innerHTML);
        
        // 📐 세 가지 높이 입력값 모두 저장
        if (topRowHeightInput) localStorage.setItem('topRowHeightValue', topRowHeightInput.value);
        // * 수정: middleRowRowHeightInput 오타 수정 (변수명이 이미 middleRowHeightInput이라 그대로 사용)
        if (middleRowHeightInput) localStorage.setItem('middleRowHeightValue', middleRowHeightInput.value); 
        if (bottomRowHeightInput) localStorage.setItem('bottomRowHeightValue', bottomRowHeightInput.value);

        // 🎨 현재 선택된 색상 타겟도 저장
        const colorTarget = document.querySelector('input[name="colorTarget"]:checked');
        if (colorTarget) localStorage.setItem('colorTarget', colorTarget.value);
        
        // 🖱️ 현재 활성화된 왼쪽 메뉴도 저장 (클래스를 문자열로 저장)
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
            // 저장된 HTML 상태로 DOM을 변경
            captureArea.innerHTML = savedState;
            
            // dataTable 변수를 새로 로드된 DOM 요소로 업데이트
            dataTable = document.querySelector('.data-table');
            
            // 📐 세 가지 높이 입력값 로드
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
            
            // 🎨 저장된 색상 타겟 로드
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
        radio.addEventListener('change', saveSettings); // 선택이 변경될 때마다 저장
    });
}

// 팔레트 생성 (색상 스와치 화면에 표시)
function initializeColorPalette() {
    // 팔레트가 이미 생성되어 있다면 중복 방지
    if (colorPalette.children.length > 0) return;
    
    colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.dataset.color = color;
        // 클릭 시 색상 적용 및 저장
        swatch.addEventListener('click', () => {
            applyColor(color);
            saveSettings();
        }); 
        colorPalette.appendChild(swatch);
    });
}


// 💡 셀 클릭 이벤트: Shift 키를 사용하여 다중 선택/토글 기능을 활성화
function initializeCellInteraction() {
    // 기존 dataTable 이벤트 리스너가 있다면 제거 후 다시 등록 (loadSettings 때문에)
    if (dataTable) {
        dataTable.removeEventListener('click', handleCellClick);
        dataTable.removeEventListener('input', saveSettings); 
    }
    
    // 로드된 새로운 DOM에서 dataTable 변수 재할당
    dataTable = document.querySelector('.data-table');
    if (!dataTable) return;

    function handleCellClick(e) {
        if (e.target.tagName === 'TD') {
            const cell = e.target;
            
            // 크기 조절 중에는 셀 선택을 막음
            if (dataTable.classList.contains('resizing')) return;

            if (e.shiftKey) {
                // Shift 키를 누른 경우: 기존 선택 상태를 유지하고 현재 셀의 선택 상태를 토글합니다.
                cell.classList.toggle('selected');
            } else {
                // Shift 키를 누르지 않은 경우: 기존 선택 모두 해제 후 현재 셀만 선택합니다.
                document.querySelectorAll('.data-table td.selected').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
            }
        }
    }
    
    dataTable.addEventListener('click', handleCellClick);
    
    // 셀 내용 편집 이벤트: 입력이 끝날 때마다 저장
    dataTable.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD' && e.target.contentEditable === 'true') {
            saveSettings();
        }
    });

}

// 🚀 색상 적용 함수
function applyColor(color) {
    const target = document.querySelector('input[name="colorTarget"]:checked').value; 
    
    // DOM에서 '.selected' 클래스를 가진 모든 TD를 다시 조회
    const cellsToApply = document.querySelectorAll('.data-table td.selected');

    cellsToApply.forEach(cell => {
        if (target === 'background') {
            cell.style.backgroundColor = color;
            // 배경색이 적용될 경우, 호버 스타일을 오버라이드하기 위해 인라인 스타일을 적용합니다.
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


// --- 2. 🖼️ 이미지 다운로드 기능 (수정됨: 캡처 전에 선택 상태 제거) ---
function downloadImage(elementId, filename) {
    const element = document.getElementById(elementId);
    const settingPanel = document.getElementById('settingPanel');
    
    // 1. 현재 선택된 셀을 저장합니다.
    const selectedCells = document.querySelectorAll('.data-table td.selected');
    
    // 2. 캡처 전에 모든 선택된 셀의 하이라이트(노란색 테두리)를 제거합니다.
    selectedCells.forEach(cell => cell.classList.remove('selected'));
    
    // 3. 설정 패널 숨기기
    settingPanel.style.display = 'none';

    html2canvas(element, {
        scale: 2, 
        backgroundColor: null, 
        useCORS: true 
    }).then(canvas => {
        // 4. 캡처 완료 후: 설정 패널 다시 표시
        settingPanel.style.display = 'block';

        // 5. 선택 상태 복원
        selectedCells.forEach(cell => cell.classList.add('selected'));

        const dataURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        console.error('이미지 캡처 중 오류 발생:', error);
        // 6. 오류 발생 시에도 설정 패널 다시 표시 및 선택 상태 복원
        settingPanel.style.display = 'block'; 
        selectedCells.forEach(cell => cell.classList.add('selected'));
    });
}


// --- 3. 📐 셀 크기 조절 (Resizer) 로직 --- 
let currentResizer = null; 
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let isRowResizer = false;

// 초기화: 각 셀에 리사이저 추가
function initializeResizers() {
    // DOM이 변경되었으므로, 기존 리사이저를 제거하고 새로 추가
    document.querySelectorAll('.col-resizer, .row-resizer').forEach(r => r.remove());

    // dataTable을 새로 로드된 DOM에서 다시 참조
    dataTable = document.querySelector('.data-table');
    if (!dataTable) return;
    
    dataTable.querySelectorAll('tr:not(.middle-notice-row, .top-notice-row) td').forEach(td => {
        
        // 열 리사이저 (td.nextElementSibling이 있는 경우에만 추가)
        if (td.nextElementSibling) {
            let colResizer = document.createElement('div');
            colResizer.className = 'col-resizer';
            td.appendChild(colResizer);
            colResizer.addEventListener('mousedown', startResize);
        }

        // 행 리사이저
        const tr = td.parentElement;
        // top-notice-row처럼 colspan이 있는 셀에도 리사이저가 추가되는 것을 방지
        if (td.getAttribute('colspan') === null) {
            let rowResizer = document.createElement('div');
            rowResizer.className = 'row-resizer';
            td.appendChild(rowResizer);
            rowResizer.addEventListener('mousedown', startResize);
        }
    });
}

// 리사이즈 로직 (변경 없음)
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


// --- 4. 🖱️ 왼쪽 메뉴 항목 색상 토글 기능 ---
function initializeLeftMenu() {
    const leftMenuItems = document.querySelectorAll('.left-item');
    
    // 저장된 인덱스를 로드하여 활성화
    const savedIndex = localStorage.getItem('activeLeftMenuIndex');
    if (savedIndex !== null) {
        leftMenuItems.forEach(i => i.classList.remove('active'));
        if (leftMenuItems[parseInt(savedIndex)]) {
            leftMenuItems[parseInt(savedIndex)].classList.add('active');
        }
    }
    
    leftMenuItems.forEach(item => {
        // 기존 리스너 제거 후 다시 등록
        item.removeEventListener('click', handleLeftMenuClick);
        item.addEventListener('click', handleLeftMenuClick);
    });
    
    function handleLeftMenuClick() {
        leftMenuItems.forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        saveSettings(); 
    }
}


// 🚀 특정 행 선택자에 강제 높이 스타일을 적용하는 함수
function applyRowHeight(selector, newHeight) {
    // 인라인 스타일로 적용
    document.querySelectorAll(selector).forEach(row => {
        row.style.height = newHeight;
        row.querySelectorAll('td').forEach(td => {
            td.style.height = newHeight;
            td.style.lineHeight = '1.2'; // 높이 변경 시 라인 높이 일관성 유지
        });
    });
}


// --- 5. 📏 그룹별 행 높이 조절 기능 ---
function initializeRowHeightControl() {
    
    if (applyTopRowHeightBtn && topRowHeightInput) {
        applyTopRowHeightBtn.removeEventListener('click', handleApplyTopRowHeight);
        applyTopRowHeightBtn.addEventListener('click', handleApplyTopRowHeight);
        // 로드 시에도 초기 높이 적용 (loadSettings가 값을 업데이트했을 경우)
        applyRowHeight('.top-data-header, .top-data-row', topRowHeightInput.value + 'px');
    }

    if (applyMiddleRowHeightBtn && middleRowHeightInput) {
        applyMiddleRowHeightBtn.removeEventListener('click', handleApplyMiddleRowHeight);
        applyMiddleRowHeightBtn.addEventListener('click', handleApplyMiddleRowHeight);
        // 로드 시에도 초기 높이 적용
        applyRowHeight('.middle-notice-row', middleRowHeightInput.value + 'px');
    }

    if (applyBottomRowHeightBtn && bottomRowHeightInput) {
        applyBottomRowHeightBtn.removeEventListener('click', handleApplyBottomRowHeight);
        applyBottomRowHeightBtn.addEventListener('click', handleApplyBottomRowHeight);
        // 로드 시에도 초기 높이 적용
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
    // middle-title-row가 HTML에 없으므로, middle-notice-row에만 적용
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
    // 1. 색상 팔레트 초기화 (DOM 구조와 무관)
    initializeColorPalette(); 
    
    // 2. 저장된 설정을 먼저 로드하여 DOM 구조와 UI 입력값 복원
    loadSettings(); 
    
    // 3. 로드된 새로운 DOM 구조에 맞춰 모든 이벤트와 리사이저를 초기화
    //    * 중요: 이 순서대로 실행되어야 DOM 요소에 이벤트 리스너가 정확히 연결됩니다.
    initializeCellInteraction(); 
    initializeColorTargetControl(); 
    initializeFontSizeControl();
    initializeResizers(); 
    initializeLeftMenu(); 
    initializeRowHeightControl(); // UI 입력값을 바탕으로 최종 높이 적용

    // 다운로드 버튼에 이벤트 핸들러 할당
    const downloadButton = document.querySelector('.download-button');
    // 기존 리스너가 있다면 제거
    downloadButton.removeEventListener('click', downloadImage); 
    downloadButton.addEventListener('click', () => downloadImage('capture-area', 'noblesse_data_capture.png'));
});

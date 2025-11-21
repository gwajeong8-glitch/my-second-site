// script.js

// data.js에서 변수 (managersData, fullRegions 등)를 가져와 사용합니다.

// 1. DOM 요소 및 상태 변수
const regionsDiv = document.getElementById('regions');
const managerListDiv = document.getElementById('managerList');
const moreRegionBtn = document.getElementById('moreRegionBtn');
const pageContents = document.querySelectorAll('.page-content');
const navItems = document.querySelectorAll('[data-page]');

let isRegionsExpanded = false; // 지역 필터 확장 상태
let currentActiveRegion = null; // 현재 선택된 지역

// 2. 페이지 전환 로직 (모든 메뉴 버튼 동작)
function showPage(pageId) {
    // 모든 페이지 숨기기
    pageContents.forEach(p => p.classList.remove('active'));
    // 요청된 페이지 보이기
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // 메뉴 활성화 상태 업데이트
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
}

// 3. 매니저 카드 렌더링 (필터링 적용)
function renderManagerList() {
    let managersToRender = managersData;

    // 현재 선택된 지역으로 필터링
    if (currentActiveRegion) {
        managersToRender = managersData.filter(m => m.region === currentActiveRegion);
    }

    // HTML 카드 생성 및 삽입
    managerListDiv.innerHTML = managersToRender.map(manager => `
        <div class="manager-card" data-region="${manager.region}">
            <span class="status-tag">${manager.status}</span>
            <img src="${manager.imgSrc}" alt="${manager.name} 매니저">
            <div class="region-label">${manager.region}</div>
            <div class="card-info">
                <div class="manager-name">${manager.name}</div>
                <div class="manager-status">
                    <span>👁️ ${manager.id}</span>
                    <span class="likes">❤ ${manager.likes}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// 4. 지역 태그 렌더링 및 클릭 이벤트 설정 (필터링 동작)
function renderRegionTags() {
    const displayRegions = isRegionsExpanded ? fullRegions : fullRegions.slice(0, initialRegionsDisplayed);

    regionsDiv.innerHTML = displayRegions.map(region => `
        <div class="region-tag ${currentActiveRegion === region ? 'active' : ''}" data-region="${region}">
            ${region}
        </div>
    `).join('');

    // 태그 클릭 시 필터링 실행
    document.querySelectorAll('.region-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            const newRegion = e.target.dataset.region;

            // 필터 토글: 동일 지역 클릭 시 필터 해제
            currentActiveRegion = (currentActiveRegion === newRegion) ? null : newRegion;
            
            // 리스트 및 UI 업데이트
            renderManagerList();
            
            // 활성 클래스 업데이트
            document.querySelectorAll('.region-tag').forEach(t => t.classList.remove('active'));
            if (currentActiveRegion === newRegion) {
                e.target.classList.add('active');
            }
        });
    });
}

// 5. 초기화 및 이벤트 리스너 통합
document.addEventListener("DOMContentLoaded", () => {
    // 초기 렌더링
    renderRegionTags();
    renderManagerList();
    showPage('homePage');

    // 페이지 전환 버튼 이벤트 (하단 메뉴와 단축 메뉴)
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const pageId = item.dataset.page;
            if (pageId) {
                showPage(pageId);
            }
        });
    });

    // '더보기' 버튼 이벤트
    if (moreRegionBtn) {
        moreRegionBtn.addEventListener('click', () => {
            isRegionsExpanded = !isRegionsExpanded;
            moreRegionBtn.textContent = isRegionsExpanded ? '간단히' : '+ 더 많은 지역' ; // 원본 이미지 문구 반영
            renderRegionTags();
        });
    }
});

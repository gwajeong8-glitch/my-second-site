// script.js

// data.js와 manager_card.js에서 변수/함수 사용 가능

const mainContentArea = document.getElementById('mainContentArea');
const navItems = document.querySelectorAll('.nav-item');
let currentActiveRegion = null;

// 1. 페이지 로드 함수 (경로 수정: pages/page_name.html)
async function loadPage(pageName) {
    const url = `pages/page_${pageName}.html`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const htmlContent = await response.text();
        mainContentArea.innerHTML = htmlContent;

        // 콘텐츠 로드 후, 해당 페이지의 동적 스크립트를 실행
        if (pageName === 'home') {
            initializeHomePage();
        }
        
    } catch (e) {
        mainContentArea.innerHTML = `<div style="padding: 50px; text-align: center; color: red;">페이지 로드 오류: ${pageName}</div>`;
        console.error("페이지 로드 실패:", e);
    }
}

// 2. 홈페이지 로드 및 이벤트 초기화 함수 (이전과 동일한 로직)
function initializeHomePage() {
    const regionsDiv = document.getElementById('regions');
    const managerListDiv = document.getElementById('managerList');
    const moreRegionBtn = document.getElementById('moreRegionBtn');
    let isRegionsExpanded = false;

    // 매니저 카드 렌더링
    function renderManagerList() {
        let managersToRender = managersData;
        if (currentActiveRegion) {
            managersToRender = managersData.filter(m => m.region === currentActiveRegion);
        }
        managerListDiv.innerHTML = managersToRender.map(manager => createManagerCard(manager)).join('');
    }

    // 지역 태그 렌더링 및 클릭 이벤트 설정
    function renderRegionTags() {
        const displayRegions = isRegionsExpanded ? fullRegions : fullRegions.slice(0, initialRegionsDisplayed);

        regionsDiv.innerHTML = displayRegions.map(region => `
            <div class="region-tag ${currentActiveRegion === region ? 'active' : ''}" data-region="${region}">
                ${region}
            </div>
        `).join('');

        document.querySelectorAll('.region-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const newRegion = e.target.dataset.region;
                currentActiveRegion = (currentActiveRegion === newRegion) ? null : newRegion;
                renderManagerList();
                document.querySelectorAll('.region-tag').forEach(t => t.classList.remove('active'));
                if (currentActiveRegion === newRegion) {
                    e.target.classList.add('active');
                }
            });
        });
    }

    // '더 많은 지역' 버튼 이벤트
    if (moreRegionBtn) {
        moreRegionBtn.addEventListener('click', () => {
            isRegionsExpanded = !isRegionsExpanded;
            moreRegionBtn.textContent = isRegionsExpanded ? '간단히' : '+ 더 많은 지역';
            renderRegionTags();
        });
    }
    
    // 단축 메뉴 버튼 이벤트 (페이지 전환)
    document.querySelectorAll('.shortcut-menu .menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });

    // 초기 실행
    renderRegionTags();
    renderManagerList();
}

// 3. 글로벌 페이지 전환 함수
function showPage(pageName) {
    loadPage(pageName);
    navItems.forEach(item => item.classList.remove('active'));
    
    // 하단 메뉴 활성화 업데이트
    const targetNav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
    if (targetNav) {
        targetNav.classList.add('active');
    }
}

// 4. 초기 로드
document.addEventListener("DOMContentLoaded", () => {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });
    showPage('home');
});

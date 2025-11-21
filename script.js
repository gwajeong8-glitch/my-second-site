// script.js

// 1. 가상 매니저 데이터 (서버 데이터를 시뮬레이션)
const managersData = [
    { name: "테스트", id: "26262616", likes: 16.0, region: "충청북도", imgSrc: "https://via.placeholder.com/200x300.png?text=Test_Mngr", status: "금방와" },
    { name: "지안", id: "151654646", likes: 10.0, region: "충청북도", imgSrc: "https://via.placeholder.com/200x300.png?text=Jian_Mngr", status: "금방와" },
    { name: "혜리", id: "987654321", likes: 12.5, region: "경기도", imgSrc: "https://via.placeholder.com/200x300.png?text=Hyeri_Mngr", status: "상담중" },
    { name: "은정", id: "11223344", likes: 22.1, region: "서울", imgSrc: "https://via.placeholder.com/200x300.png?text=Eunjeong_Mngr", status: "금방와" },
    { name: "소영", id: "55667788", likes: 14.9, region: "서울", imgSrc: "https://via.placeholder.com/200x300.png?text=Soyoung_Mngr", status: "상담중" },
    { name: "민지", id: "99001122", likes: 9.3, region: "제주도", imgSrc: "https://via.placeholder.com/200x300.png?text=Minji_Mngr", status: "금방와" },
];

// 2. 초기 지역 목록 (원본 이미지 참고)
const initialRegions = ['서울', '경기도', '강원도', '충청북도', '충청남도', '경상북도', '전라북도', '경상남도', '전라남도', '제주도'];

// 3. DOM 요소 및 상태 변수
const regionsDiv = document.getElementById('regions');
const managerListDiv = document.getElementById('managerList');
const moreRegionBtn = document.getElementById('moreRegionBtn');

let isRegionsExpanded = false; // 지역 확장 상태
let currentActiveRegion = null; // 현재 활성화된 지역 필터

// 4. 매니저 카드 렌더링 함수
function renderManagerList(filterRegion = null) {
    let managersToRender = managersData;

    // 필터링 로직
    if (filterRegion && filterRegion !== '전체') {
        managersToRender = managersData.filter(m => m.region === filterRegion);
    }

    managerListDiv.innerHTML = managersToRender.map(manager => `
        <div class="manager-card" data-region="${manager.region}">
            <span class="status-tag">${manager.status}</span>
            <img src="${manager.imgSrc}" alt="${manager.name} 매니저">
            <div class="card-info">
                <div class="manager-name">${manager.name}</div>
                <div class="manager-status">
                    <span>${manager.id}</span>
                    <span class="likes">❤ ${manager.likes}</span>
                </div>
                <span class="region-label">${manager.region}</span>
            </div>
        </div>
    `).join('');
}

// 5. 지역 태그 렌더링 및 이벤트 처리 함수
function renderRegionTags() {
    const displayRegions = isRegionsExpanded ? initialRegions : initialRegions.slice(0, 6); // 6개만 기본 표시

    regionsDiv.innerHTML = displayRegions.map(region => `
        <div class="region-tag ${currentActiveRegion === region ? 'active' : ''}" data-region="${region}">
            ${region}
        </div>
    `).join('');

    // 태그 클릭 이벤트 리스너 추가
    document.querySelectorAll('.region-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            const newRegion = e.target.dataset.region;

            // 활성 상태 토글 및 필터링
            if (currentActiveRegion === newRegion) {
                currentActiveRegion = null; // 필터 해제
                renderManagerList(null);
            } else {
                currentActiveRegion = newRegion;
                renderManagerList(newRegion);
            }
            
            // UI 활성 클래스 업데이트
            document.querySelectorAll('.region-tag').forEach(t => t.classList.remove('active'));
            if (currentActiveRegion === newRegion) {
                e.target.classList.add('active');
            }
        });
    });
}

// 6. '더보기' 버튼 이벤트 처리
moreRegionBtn.addEventListener('click', () => {
    isRegionsExpanded = !isRegionsExpanded;
    moreRegionBtn.textContent = isRegionsExpanded ? '간단히' : '더보기';
    renderRegionTags();
});

// 7. 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", () => {
    renderRegionTags();
    renderManagerList();
});

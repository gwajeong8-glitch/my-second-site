// data.js

/**
 * 매니저 데이터 (실제 서버 데이터 시뮬레이션)
 * * 주의: imgSrc 경로는 고객님이 제공하신 이미지 파일명과 일치해야 합니다.
 * 고객님 폴더에 다음 파일이 있어야 합니다: manager_test.jpg, manager_jian.jpg 등.
 */
const managersData = [
    { name: "테스트", id: "26262616", likes: 16.0, region: "충청북도", imgSrc: "manager_test.jpg", status: "금방와" },
    { name: "지안", id: "151654646", likes: 10.0, region: "충청북도", imgSrc: "manager_jian.jpg", status: "금방와" },
    { name: "박이슬", id: "987654321", likes: 12.5, region: "경기도", imgSrc: "manager_park.jpg", status: "상담중" },
    { name: "강은정", id: "11223344", likes: 22.1, region: "경기도", imgSrc: "manager_kang.jpg", status: "금방와" },
    { name: "혜나", id: "55667788", likes: 14.9, region: "서울", imgSrc: "manager_hena.jpg", status: "상담중" },
    { name: "유리", id: "99001122", likes: 9.3, region: "서울", imgSrc: "manager_yuri.jpg", status: "금방와" },
    // 추가 데이터
    { name: "새롬", id: "33445566", likes: 18.2, region: "강원도", imgSrc: "manager_saerom.jpg", status: "금방와" },
    { name: "미나", id: "77889900", likes: 11.0, region: "제주도", imgSrc: "manager_mina.jpg", status: "휴식" },
];

// 전체 지역 목록
const fullRegions = ['서울', '경기도', '강원도', '충청북도', '충청남도', '경상북도', '전라북도', '경상남도', '전라남도', '제주도'];
const initialRegionsDisplayed = 6;

-- 지역별 게시판: 글에 작성자의 거주지(시/군/구)를 저장해, 같은 지역(수원권/강남권/부평권)끼리만 보게 합니다.
-- region_city 예: '경기도 수원시', '서울특별시 강남구', '인천광역시 부평구'
ALTER TABLE posts ADD COLUMN IF NOT EXISTS region_city VARCHAR(60);

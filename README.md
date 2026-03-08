# 건물/아파트 정보 조회 도구

## 핵심 기능
- 주소/건물명 검색 + 자동완성
- 건축물대장 기반 건물 요약, 동/호 정보 조회
- 평형/전용/공급 면적 보강
- 교통/주변시설 정보 조회
- 매물 입력용 데이터 매핑 API 제공

## 실행 방법
1. 의존성 설치
```bash
npm install
```

2. 환경 변수 준비
```bash
cp .env.example .env
```

3. `.env` 설정
```env
PORT=3000
KAKAO_REST_API_KEY=
BUILDING_REGISTRY_SERVICE_KEY=
REB_APTID_SERVICE_KEY=
KAKAO_MAP_JS_KEY=
VWORLD_APT_PRICE_KEY=
LH_SUPPLY_API_URL=
LH_SUPPLY_SERVICE_KEY=
```

4. 실행
```bash
npm start
```

5. 접속
- `http://localhost:3000`

## 실제 데이터 연동 주의
- `KAKAO_REST_API_KEY`, `BUILDING_REGISTRY_SERVICE_KEY` 미설정 시 핵심 조회 기능이 제한됩니다.
- `VWORLD_APT_PRICE_KEY` 설정 시 공동주택가격 기반 동/호/면적 보강을 사용할 수 있습니다.
- `LH_SUPPLY_API_URL`, `LH_SUPPLY_SERVICE_KEY` 설정 시 공급면적 fallback(동/호 전용면적 기준 근사 매핑)을 추가로 적용합니다.

## API
- `GET /api/health`
- `GET /api/location/suggest?q=`
- `GET /api/location/search?q=&detail=0|1`
- `GET /api/location/diagnose?q=`
- `GET /api/apartment/py-types?q=`
- `GET /api/location/real-pyeong?q=`
- `GET /api/vworld/apart-price/hos?pnu=&dongNm=&stdrYear=`
- `POST /api/location/map-listings` (기존 매물 배열을 매핑. `q`로 실데이터 조회하거나, `hoCandidates/pyeongTypes`를 직접 보내면 public payload 기준으로 매핑)

# Toss Finance Auto Poster

`tossfeed`에서 금융 관련 글만 가져와 요약/톤 변환 후 워드프레스에 자동 포스팅하는 플러그인입니다.

## 주요 기능
- 소스 기본값: `https://toss.im/tossfeed/feed/` (RSS 우선)
- 금융 필터: 제목/본문 기준 금융 키워드 포함 글만 처리
- 제외 필터: 제목/본문에 `토스` 또는 `toss`가 포함되면 스킵
- 기존글 업데이트: 원문 URL이 같으면 새 글 생성 대신 기존 글 제목/본문 갱신
- 자동 실행: WP-Cron (`hourly`, 실행 시 매번 최신 1~N건 처리)
- 수동 실행: 설정 페이지에서 즉시 실행 버튼 제공
- 톤 변환:
  - 기본: 로컬 규칙 기반 한국어 블로그 톤 정리
  - 선택: OpenAI API로 요약+말투 재구성
- 제목 고정: 게시글 제목을 `금융정보`로 생성
- 본문 구조: 자연스러운 `H2/H3/H4` 섹션 포함
- 썸네일: 피드 enclosure/media:image/본문 첫 이미지 순으로 대표 이미지 설정
- 카테고리 자동화: `금융` 카테고리 자동 생성/매핑

## 설치
1. `wp-plugin/toss-finance-autoposter` 폴더를 `wp-content/plugins/`로 복사
2. 워드프레스 관리자 > 플러그인에서 `Toss Finance Auto Poster` 활성화
3. 워드프레스 관리자 > 설정 > `Toss Finance Auto Poster`에서 옵션 저장

## 주의
- 원문을 그대로/유사하게 재배포하지 말고 요약 중심으로 운영하세요.
- 사이트 이용약관/robots.txt/저작권 정책을 반드시 확인하세요.
- OpenAI API를 쓰는 경우 API 키 관리 정책을 별도로 적용하세요.

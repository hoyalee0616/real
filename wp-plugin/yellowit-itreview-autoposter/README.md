# YellowIT IT Review Auto Poster

`it-review` 피드만 가져와서 해요체의 긴 본문 형태로 워드프레스 글을 자동 생성하는 플러그인입니다.

## 기능
- 소스: `https://yellowit.co.kr/category/it-review/feed/` (기본값)
- 중복 방지: GUID 기준으로 이미 가져온 글은 건너뜀
- 자동 실행: 하루 1회 (`WP-Cron`)
- 수동 실행: 설정 페이지에서 즉시 실행 버튼 제공
- 출력 톤: 해요체 상세 정리
- 본문 구조: H1/H2/H3 + 문단 + 체크리스트
- 출처 표기: 원문 링크 미노출
- 썸네일: 피드 대표 이미지/본문 첫 이미지를 대표 이미지로 자동 지정

## 설치
1. `wp-plugin/yellowit-itreview-autoposter` 폴더를 통째로 워드프레스 `wp-content/plugins/` 아래에 복사
2. 관리자 > 플러그인에서 `YellowIT IT Review Auto Poster` 활성화
3. 관리자 > 설정 > `YellowIT Auto Poster`에서 옵션 저장

## 주의
- 타 사이트 콘텐츠는 저작권/이용약관을 확인하고 운영하세요.
- 전체 본문 복제가 아니라 요약·출처 표기를 권장합니다.
- WP-Cron은 사이트 트래픽이 있어야 실행될 수 있습니다.

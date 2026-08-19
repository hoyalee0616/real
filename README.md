# 콩콩 영어

초등학교 1학년 수준의 그림 영어 낱말카드 사이트입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.

## Android APK 빌드

Android Studio에 포함된 JDK를 사용할 경우:

```bash
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

생성된 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 저장됩니다.
현재 모바일/PWA·DB 동기화 통합 APK는 프로젝트 루트의 `KongKong-English-v1.5.apk`입니다.

## 포함 기능

- 기본 낱말카드 10개와 직접 제작한 그림
- 카드별 미국 영어 발음 듣기
- 배운 단어 별표 표시와 진도 저장
- 그림을 보고 답하는 5문제 퀴즈
- 영어 단어 입력 시 한글 뜻 자동 입력
- 기본 10개와 직접 만든 카드 모두 뜻·읽기·그림 수정 및 삭제
- 틀린 단어 자동 수집과 오답 퀴즈
- 날짜별 하루 10단어 추천과 일일 진도
- 등록순·알파벳순·신규순·오늘 추천 정렬
- 직접 사진 선택으로 카드 그림 등록
- 등록 단어와 진도를 브라우저에 자동 저장
- 홈 화면에 설치 가능한 PWA와 오프라인 캐시
- 320·360·390·412·600px 및 모바일 가로모드 반응형 검증
- 12자리 코드로 웹·앱·다른 휴대폰 간 SQLite 서버 DB 동기화

## Coolify 배포

프로젝트 루트를 Dockerfile 빌드 방식으로 배포하고 서비스 포트를 `3000`으로 지정합니다.
`/data`에 영구 볼륨을 연결해야 SQLite DB가 재배포 후에도 유지됩니다.
헬스체크 경로는 `/api/health`입니다.

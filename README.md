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
현재 모바일/PWA 통합 테스트 APK는 프로젝트 루트의 `KongKong-English-v1.1.apk`입니다.

## 포함 기능

- 기본 낱말카드 10개와 직접 제작한 그림
- 카드별 미국 영어 발음 듣기
- 배운 단어 별표 표시와 진도 저장
- 그림을 보고 답하는 5문제 퀴즈
- 사진과 함께 나만의 단어 등록 및 삭제
- 등록 단어와 진도를 브라우저에 자동 저장
- 홈 화면에 설치 가능한 PWA와 오프라인 캐시

## Coolify 배포

프로젝트 루트를 Dockerfile 빌드 방식으로 배포하고 서비스 포트를 `80`으로 지정합니다.
헬스체크와 모바일 PWA 설정이 포함되어 있습니다.

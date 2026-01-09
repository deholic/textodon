# MFM (Misskey Markup Language) 구현

Textodon에 MFM 렌더링 기능이 구현되었습니다. MFM은 Misskey 전용 마크업 언어로, 다양한 텍스트 서식과 애니메이션 효과를 지원합니다.

## 🎯 구현 목표

- **완벽한 MFM 호환성**: Misskey에서 사용되는 모든 MFM 문법 지원
- **통합된 사용자 경험**: Mastodon/Markdown과 일관된 인터페이스
- **성능 및 접근성**: CSS 애니메이션으로 최적화, 설정으로 제어
- **안정성**: 공식 라이브러리 + 단위 테스트로 신뢰성 보장

## 📁 파일 구조

```
src/
├── ui/
│   ├── utils/
│   │   ├── mfm.ts          # MFM 파서 및 렌더러
│   │   ├── mfm.test.ts      # MFM 단위 테스트
│   │   └── htmlSanitizer.ts # HTML 정화 (MFM 태그 지원 추가)
│   ├── styles/
│   │   └── mfm.css         # MFM 전용 스타일시트
│   ├── components/
│   │   └── TimelineItem.tsx # MFM 렌더링 통합
│   └── state/
│       └── AppContext.tsx   # 사용자 설정 (애니메이션 on/off)
└── infra/
    └── misskeyMapper.ts   # MFM 콘텐츠 감지 개선
```

## 🚀 주요 기능

### 1. MFM 파싱 및 렌더링

**지원하는 MFM 문법:**

- **기본 서식**: `**굵게**`, `*기울임*`, `~~취소선~~`, `<small>작게</small>`
- **인용문**: `> 인용된 텍스트`
- **코드**: `인라인 코드`, 코드 블록 (```\n코드\n```)
- **중앙 정렬**: `<center>중앙 정렬</center>`
- **링크**: `[링크 텍스트](URL)`, 자동 URL 감지
- **멘션**: `@username@example.com`
- **해시태그**: `#해시태그`
- **커스텀 이모지**: `:이모지이름:`

**MFM 함수:**

- **애니메이션**: `$[tada 텍스트]`, `$[spin 텍스트]`, `$[jump 텍스트]`, `$[bounce 텍스트]`
- **효과**: `$[rainbow 무지개]`, `$[sparkle 반짝]`, `$[blur 흐림]`
- **스타일링**: `$[fg.color=red 글자색]`, `$[bg.color=blue 배경색]`
- **변환**: `$[flip 뒤집기]`, `$[x2 2배]`, `$[position.x=2,y=3 이동]`

### 2. 사용자 설정

**사용자 환경설정:**
- `enableMfmAnimations`: MFM 애니메이션 활성화/비활성화
- `showCustomEmojis`: 커스텀 이모지 표시 설정
- `showReactions`: 리액션 표시 설정
- `showProfileImages`: 프로필 이미지 표시 설정

설정은 localStorage에 저장되며, 접근성 고려로 `prefers-reduced-motion`도 지원합니다.

### 3. 스타일시트

**주요 CSS 기능:**
- 다크/라이트 테마 호환
- 애니메이션 성능 최적화 (GPU 가속)
- 반응형 디자인
- 접근성 고려 (애니메이션 비활성화 지원)

## 📱 사용 예제

### 기본 MFM 렌더링

```typescript
import { renderMfm } from './utils/mfm';

const text = "**굵은 텍스트**와 $[tada 애니메이션] :이모지: 효과";
const html = renderMfm(text, customEmojis, {
  enableAnimation: true,
  enableEmoji: true
});

// 결과 HTML:
// <strong>굵은 텍스트</strong>와 <span class="mfm-tada">애니메이션</span> 
// <img src="..." alt=":이모지:" class="custom-emoji"> 효과
```

### 플랫폼별 렌더링

```typescript
// TimelineItem.tsx
const contentParts = useMemo(() => {
  if (account?.platform === "misskey" && isMfmText(text)) {
    // Misskey: MFM 렌더링
    const mfmHtml = renderMfm(text, displayStatus.customEmojis, {
      enableAnimation: enableMfmAnimations,
      enableEmoji: showCustomEmojis,
    });
    
    return <div dangerouslySetInnerHTML={{ __html: mfmHtml }} className="mfm-content" />;
  }
  
  // Mastodon: 기존 마크다운 렌더링
  return <div dangerouslySetInnerHTML={{ __html: markdownHtml }} className="rich-content" />;
}, [platform, text, preferences]);
```

## 🧪 테스트

MFM 기능은 포괄적인 단위 테스트로 검증됩니다:

```typescript
// 기본 기능 테스트
test("굵은 텍스트 렌더링", () => {
  const result = renderMfm("**Hello** world");
  expect(result).toContain("<strong>Hello</strong>");
});

// 애니메이션 테스트
test("MFM 함수 렌더링 - tada", () => {
  const result = renderMfm("$[tada Hello]");
  expect(result).toContain('<span class="mfm-tada">');
});

// 설정 테스트
test("애니메이션 비활성화 옵션", () => {
  const result = renderMfm("$[tada Hello]", [], { enableAnimation: false });
  expect(result).not.toContain('class="mfm-tada"');
});
```

## 🎨 스타일 가이드

### 애니메이션

```css
.mfm-tada {
  display: inline-block;
  font-size: 150%;
  animation: mfm-tada 1s ease-in-out infinite;
}

@keyframes mfm-tada {
  0% { transform: scale(1); }
  50% { transform: scale(1.3) rotate(3deg); }
  100% { transform: scale(1) rotate(0); }
}
```

### 접근성

```css
/* 사용자가 애니메이션을 선호하지 않는 경우 */
@media (prefers-reduced-motion: reduce) {
  .mfm-tada,
  .mfm-spin,
  .mfm-rainbow {
    animation: none !important;
  }
}

/* 명시적 애니메이션 비활성화 */
.mfm-no-animation .mfm-tada {
  animation: none !important;
}
```

## 🔧 기술적 특징

### 1. mfm-js 통합

- **공식 라이브러리**: 안정성과 완전한 문법 지원 보장
- **TypeScript 지원**: 완벽한 타입 안전성
- **커스텀 렌더링**: HTML 생성에 완전한 제어

### 2. 보안 고려

- **HTML 정화**: DOMPurify로 XSS 방어
- **허용 태그 확장**: MFM에 필요한 `ruby`, `rt`, `time` 태그 추가
- **data 속성 허용**: 애니메이션 제어를 위해 data 속성 활성화

### 3. 성능 최적화

- **CSS 애니메이션**: JavaScript 애니메이션보다 성능 우수
- **GPU 가속**: `transform` 속성으로 하드웨어 가속 활용
- **캐싱 고려**: 파싱 결과 캐싱 구조 마련

## 🚀 향후 개선 사항

1. **고급 MFM 기능**: 더 복잡한 MFM 함수 지원
2. **성능 최적화**: 파싱 결과 캐싱 구현
3. **편집기 통합**: MFM 작성을 위한 UI/UX 개선
4. **프리뷰 기능**: 실시간 MFM 미리보기 제공
5. **추가 테스트**: 통합 테스트 및 시각적 테스트 강화

## 📚 참고 자료

- [MFM 공식 문서](https://misskey-hub.net/ko/docs/for-users/features/mfm/)
- [mfm.js 라이브러리](https://github.com/misskey-dev/mfm.js)
- [Misskey 공식 문서](https://misskey-hub.net/ko/docs/)

---

이 구현을 통해 Textodon 사용자들은 Misskey 인스턴스의 모든 MFM 콘텐츠를 완벽하게 즐길 수 있습니다! 🎉
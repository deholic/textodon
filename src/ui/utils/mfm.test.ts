// MFM 유틸리티 테스트 - 기본적인 테스트 케이스
// TODO: 적절한 테스트 프레임워크 설정 후 활성화

import { 
  renderMfm, 
  isMfmText, 
  extractMentions, 
  extractHashtags, 
  mfmToPlain,
  MFM_FUNCTIONS 
} from "./mfm";

// 테스트용 가상 이모지 데이터
const mockEmojis = [
  { shortcode: "test", url: "https://example.com/emoji/test.png", category: "test" },
  { shortcode: "smile", url: "https://example.com/emoji/smile.png", category: "test" }
];

// 간단한 테스트 실행 함수
const test = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}:`, error);
  }
};

const expect = (actual: any) => ({
  toBe: (expected: any) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, but got ${actual}`);
    }
  },
  toContain: (expected: any) => {
    if (!actual.includes(expected)) {
      throw new Error(`Expected ${actual} to contain ${expected}`);
    }
  },
  toEqual: (expected: any) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Expected ${expected}, but got ${actual}`);
    }
  },
  not: {
    toContain: (expected: any) => {
      if (actual.includes(expected)) {
        throw new Error(`Expected ${actual} not to contain ${expected}`);
      }
    }
  }
});

// MFM 렌더링 테스트
console.log("🧪 MFM 렌더링 테스트 시작");

test("기본 텍스트 렌더링", () => {
  const input = "Hello world";
  const result = renderMfm(input);
  expect(result).toBe("Hello world");
});

test("굵은 텍스트 렌더링", () => {
  const input = "**Hello** world";
  const result = renderMfm(input);
  expect(result).toContain("<strong>Hello</strong>");
  expect(result).toContain(" world");
});

test("커스텀 이모지 렌더링", () => {
  const input = "Hello :test: world";
  const result = renderMfm(input, mockEmojis);
  expect(result).toContain('<img src="https://example.com/emoji/test.png"');
  expect(result).toContain('alt=":test:"');
});

test("MFM 함수 렌더링 - tada", () => {
  const input = "$[tada Hello]";
  const result = renderMfm(input);
  expect(result).toContain('<span class="mfm-tada">');
  expect(result).toContain("Hello");
});

test("애니메이션 비활성화 옵션", () => {
  const input = "$[tada Hello]";
  const result = renderMfm(input, [], { enableAnimation: false });
  expect(result).not.toContain('class="mfm-tada"');
});

// MFM 텍스트 감지 테스트
console.log("🧪 MFM 텍스트 감지 테스트");

test("MFM 함수 포함 텍스트 감지", () => {
  expect(isMfmText("$[tada Hello]")).toBe(true);
});

test("커스텀 이모지 감지", () => {
  expect(isMfmText("Hello :test: world")).toBe(true);
});

test("일반 텍스트는 감지하지 않음", () => {
  expect(isMfmText("Hello world")).toBe(false);
});

// MFM 함수 목록 테스트
console.log("🧪 MFM 함수 목록 테스트");

test("지원되는 MFM 함수 목록 확인", () => {
  expect(MFM_FUNCTIONS).toContain("tada");
  expect(MFM_FUNCTIONS).toContain("spin");
  expect(MFM_FUNCTIONS).toContain("rainbow");
});

console.log("🎉 MFM 테스트 완료!");
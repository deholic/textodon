import type { AccountPlatform, InstanceInfo, CharacterCountStatus } from "../../domain/types";

/**
 * 플랫폼별 문자 수를 계산합니다.
 * - Mastodon: URL을 23자로 계산
 * - Misskey: 순수 텍스트 글자 수 (CW 포함)
 */
export function calculateCharacterCount(
  text: string, 
  platform: AccountPlatform
): number {
  if (platform === "misskey") {
    // Misskey: 순수 텍스트 글자 수
    return text.length;
  }
  
  // Mastodon: URL을 23자로 계산
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  const urlCharCount = urls.length * 23;
  const textWithoutUrls = text.replace(urlRegex, '');
  return textWithoutUrls.length + urlCharCount;
}

/**
 * 인스턴스 정보에서 문자 수 제한을 가져옵니다.
 */
export function getCharacterLimit(instanceInfo: InstanceInfo): number {
  if (instanceInfo.platform === "misskey") {
    return instanceInfo.maxNoteLength || 3000;
  }
  return instanceInfo.max_toot_chars || 500;
}

/**
 * 현재 문자 수와 제한에 따른 상태를 반환합니다.
 */
export function getCharacterCountStatus(
  current: number, 
  limit: number
): CharacterCountStatus {
  const percentage = (current / limit) * 100;
  if (percentage >= 100) return "limit";
  if (percentage >= 80) return "warning";
  return "normal";
}

/**
 * 문자 수 상태에 따른 CSS 클래스명을 반환합니다.
 */
export function getCharacterCountClassName(status: CharacterCountStatus): string {
  return `compose-character-count-${status}`;
}

/**
 * 기본 문자 수 제한을 반환합니다.
 */
export function getDefaultCharacterLimit(platform: AccountPlatform): number {
  return platform === "misskey" ? 3000 : 500;
}
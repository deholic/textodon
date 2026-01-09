import * as mfm from 'mfm-js';
import { sanitizeHtml } from './htmlSanitizer';
import type { CustomEmoji } from '../../domain/types';

export type MfmRenderOptions = {
  enableAnimation?: boolean;
  enableEmoji?: boolean;
  customEmojiResolver?: (name: string) => string | null;
  linkResolver?: (url: string) => string | null;
};

const defaultOptions: MfmRenderOptions = {
  enableAnimation: true,
  enableEmoji: true,
};

/**
 * MFM 노드를 HTML로 변환합니다.
 */
const renderNode = (node: any, options: MfmRenderOptions, emojis: CustomEmoji[]): string => {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.props.text);
    
    case 'bold':
      return `<strong>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</strong>`;
    
    case 'italic':
      return `<em>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</em>`;
    
    case 'strike':
      return `<s>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</s>`;
    
    case 'small':
      return `<small>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</small>`;
    
    case 'center':
      return `<div style="text-align: center">${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</div>`;
    
    case 'quote':
      return `<blockquote>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</blockquote>`;
    
    case 'code':
      return `<code>${escapeHtml(node.props.code)}</code>`;
    
    case 'codeBlock':
      return `<pre><code>${escapeHtml(node.props.code)}</code></pre>`;
    
    case 'link':
      const url = node.props.url;
      const isExternal = url.startsWith('http://') || url.startsWith('https://');
      return `<a href="${escapeHtml(url)}" ${isExternal ? 'target="_blank" rel="noreferrer"' : ''}>${node.children.map((child: any) => renderNode(child, options, emojis)).join('')}</a>`;
    
    case 'url':
      const urlValue = node.props.url;
      return `<a href="${escapeHtml(urlValue)}" target="_blank" rel="noreferrer">${escapeHtml(urlValue)}</a>`;
    
    case 'mention':
      return `<a href="https://misskey.io/${escapeHtml(node.props.acct)}" class="mention" target="_blank" rel="noreferrer">@${escapeHtml(node.props.username)}</a>`;
    
    case 'hashtag':
      return `<a href="https://misskey.io/tags/${escapeHtml(node.props.hashtag)}" class="hashtag" target="_blank" rel="noreferrer">#${escapeHtml(node.props.hashtag)}</a>`;
    
    case 'emojiCode':
      if (!options.enableEmoji) return `:${escapeHtml(node.props.name)}:`;
      
      const emojiUrl = options.customEmojiResolver?.(node.props.name);
      if (emojiUrl) {
        return `<img src="${escapeHtml(emojiUrl)}" alt=":${escapeHtml(node.props.name)}:" class="custom-emoji" loading="lazy" />`;
      }
      return `:${escapeHtml(node.props.name)}:`;
    
    case 'unicodeEmoji':
      return node.props.emoji;
    
    case 'inlineCode':
      return `<code>${escapeHtml(node.props.code)}</code>`;
    
    case 'mathInline':
      return `<code>${escapeHtml(node.props.formula)}</code>`;
    
    case 'mathBlock':
      return `<pre><code>${escapeHtml(node.props.formula)}</code></pre>`;
    
    case 'search':
      return `<div class="search">${escapeHtml(node.props.query)}</div>`;
    
    case 'fn': // MFM 함수 ($[function ...])
      return renderMfmFunction(node, options, emojis);
    
    default:
      console.warn('알 수 없는 MFM 노드 타입:', node.type);
      return '';
  }
};

/**
 * MFM 함수를 렌더링합니다.
 */
const renderMfmFunction = (node: any, options: MfmRenderOptions, emojis: CustomEmoji[]): string => {
  const { name, args } = node.props;
  const content = node.children.map((child: any) => renderNode(child, options, emojis)).join('');
  
  // 애니메이션 비활성화 상태에서는 일반 텍스트로 반환
  if (!options.enableAnimation && ['tada', 'spin', 'jump', 'bounce', 'shake', 'twitch', 'jelly'].includes(name)) {
    return content;
  }
  
  const attrs: string[] = [];
  
  switch (name) {
    case 'tada':
      return `<span class="mfm-tada">${content}</span>`;
    
    case 'spin':
      const spinAttrs = [];
      if (args.x) spinAttrs.push('data-mfm-spin-x="true"');
      if (args.y) spinAttrs.push('data-mfm-spin-y="true"');
      if (args.left) spinAttrs.push('data-mfm-spin-left="true"');
      if (args.alternate) spinAttrs.push('data-mfm-spin-alternate="true"');
      if (args.speed) spinAttrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-spin" ${spinAttrs.join(' ')}>${content}</span>`;
    
    case 'jump':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-jump" ${attrs.join(' ')}>${content}</span>`;
    
    case 'bounce':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-bounce" ${attrs.join(' ')}>${content}</span>`;
    
    case 'shake':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-shake" ${attrs.join(' ')}>${content}</span>`;
    
    case 'twitch':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-twitch" ${attrs.join(' ')}>${content}</span>`;
    
    case 'jelly':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-jelly" ${attrs.join(' ')}>${content}</span>`;
    
    case 'rainbow':
      if (args.speed) attrs.push(`data-mfm-speed="${escapeHtml(args.speed)}"`);
      return `<span class="mfm-rainbow" ${attrs.join(' ')}>${content}</span>`;
    
    case 'sparkle':
      return `<span class="mfm-sparkle">${content}</span>`;
    
    case 'fade':
      return `<span class="mfm-fade">${content}</span>`;
    
    case 'flip':
      if (args.v && args.h) {
        return `<span class="mfm-flip" data-mfm-flip-v="true" data-mfm-flip-h="true">${content}</span>`;
      } else if (args.v) {
        return `<span class="mfm-flip" data-mfm-flip-v="true">${content}</span>`;
      } else if (args.h) {
        return `<span class="mfm-flip" data-mfm-flip-h="true">${content}</span>`;
      }
      return `<span class="mfm-flip">${content}</span>`;
    
    case 'font':
      const fontMap: Record<string, string> = {
        serif: 'serif',
        sansSerif: 'sans-serif',
        monospace: 'monospace',
        cursive: 'cursive',
        fantasy: 'fantasy'
      };
      const fontFamily = fontMap[args.font] || args.font;
      attrs.push(`style="font-family: ${escapeHtml(fontFamily)}"`);
      return `<span ${attrs.join(' ')}>${content}</span>`;
    
    case 'x2':
      return `<span class="mfm-x2">${content}</span>`;
    
    case 'x3':
      return `<span class="mfm-x3">${content}</span>`;
    
    case 'x4':
      return `<span class="mfm-x4">${content}</span>`;
    
    case 'scale':
      const scaleAttrs = [];
      if (args.x) scaleAttrs.push(`transform: scaleX(${args.x})`);
      if (args.y) scaleAttrs.push(`transform: scaleY(${args.y})`);
      attrs.push(`style="${scaleAttrs.join(' ')}"`);
      return `<span ${attrs.join(' ')}>${content}</span>`;
    
    case 'position':
      const posAttrs = [];
      if (args.x !== undefined) posAttrs.push(`--mfm-x: ${args.x}`);
      if (args.y !== undefined) posAttrs.push(`--mfm-y: ${args.y}`);
      attrs.push(`style="${posAttrs.join('; ')}"`);
      return `<span class="mfm-position" ${attrs.join(' ')}>${content}</span>`;
    
    case 'fg':
      return `<span style="color: ${escapeHtml(args.color)}">${content}</span>`;
    
    case 'bg':
      return `<span style="background-color: ${escapeHtml(args.color)}">${content}</span>`;
    
    case 'border':
      const borderStyles = [];
      if (args.style) borderStyles.push(`border-style: ${escapeHtml(args.style)}`);
      if (args.width) borderStyles.push(`border-width: ${escapeHtml(args.width)}px`);
      if (args.color) borderStyles.push(`border-color: ${escapeHtml(args.color)}`);
      if (args.radius) borderStyles.push(`border-radius: ${escapeHtml(args.radius)}px`);
      if (args.noclip) borderStyles.push(`overflow: visible`);
      return `<span style="${borderStyles.join('; ')}">${content}</span>`;
    
    case 'blur':
      return `<span class="mfm-blur">${content}</span>`;
    
    case 'ruby':
      if (args.rt) {
        return `<ruby>${content}<rt>${escapeHtml(args.rt)}</rt></ruby>`;
      }
      return content;
    
    case 'unixtime':
      const timestamp = parseInt(args.time) * 1000;
      const date = new Date(timestamp);
      return `<time datetime="${date.toISOString()}">${date.toLocaleString()}</time>`;
    
    case 'clickable':
      const eventId = args.ev;
      return `<span class="mfm-clickable" data-event-id="${escapeHtml(eventId)}">${content}</span>`;
    
    default:
      console.warn('알 수 없는 MFM 함수:', name);
      return content;
  }
};

/**
 * HTML 이스케이프
 */
const escapeHtml = (text: string): string => {
  // 서버 환경을 위한 fallback
  if (typeof document === 'undefined') {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * MFM 텍스트를 파싱하여 안전한 HTML로 렌더링합니다.
 */
export const renderMfm = (
  text: string,
  emojis: CustomEmoji[] = [],
  options: MfmRenderOptions = {}
): string => {
  const opts = { ...defaultOptions, ...options };
  
  try {
    const tree = mfm.parse(text);
    
    // MFM 노드 배열을 HTML로 변환
    const html = tree.map(node => renderNode(node, opts, emojis)).join('');
    
    // HTML 정화 (보안) - 서버 환경에서는 생략
    if (typeof document === 'undefined') {
      return html;
    }
    return sanitizeHtml(html);
  } catch (error) {
    console.error('MFM 렌더링 오류:', error);
    // 실패 시 평문으로 반환
    return sanitizeHtml(text);
  }
};

/**
 * MFM 텍스트가 포함된지 확인합니다.
 */
export const isMfmText = (text: string): boolean => {
  if (!text) return false;
  
  // MFM 특유의 문법 패턴 확인
  const mfmPatterns = [
    /\$\[.\b.*?\]/, // MFM 함수 ($[func ...])
    /:.[^:\s]+:/, // 커스텀 이모지 (:emoji:)
    /^>.*$/m, // 인용
    /^<center>.*<\/center>$/m, // 중앙 정렬
    /^\$\[ruby .+?\]$/, // 루비
  ];
  
  return mfmPatterns.some(pattern => pattern.test(text));
};

/**
 * MFM 텍스트에서 멘션을 추출합니다.
 */
export const extractMentions = (text: string): string[] => {
  try {
    const tree = mfm.parse(text);
    const mentions: string[] = [];
    
    const traverse = (node: any) => {
      if (node.type === 'mention') {
        mentions.push(node.props.acct);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    tree.forEach(traverse);
    return mentions;
  } catch (error) {
    console.error('멘션 추출 오류:', error);
    return [];
  }
};

/**
 * MFM 텍스트에서 해시태그를 추출합니다.
 */
export const extractHashtags = (text: string): string[] => {
  try {
    const tree = mfm.parse(text);
    const hashtags: string[] = [];
    
    const traverse = (node: any) => {
      if (node.type === 'hashtag') {
        hashtags.push(node.props.hashtag);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    tree.forEach(traverse);
    return hashtags;
  } catch (error) {
    console.error('해시태그 추출 오류:', error);
    return [];
  }
};

/**
 * MFM 텍스트를 평문으로 변환합니다.
 */
export const mfmToPlain = (text: string): string => {
  try {
    const tree = mfm.parse(text);
    return mfm.toString(tree);
  } catch (error) {
    console.error('MFM 평문 변환 오류:', error);
    return text;
  }
};

/**
 * MFM 함수 목록
 */
export const MFM_FUNCTIONS = [
  'fade', 'rainbow', 'sparkle', 'shake', 'twitch', 'spin', 'jump', 'bounce', 'flip', 
  'x2', 'x3', 'x4', 'scale', 'position', 'fg', 'bg', 'border', 'font', 'blur', 'ruby',
  'unixtime', 'clickable'
] as const;

export type MfmFunction = typeof MFM_FUNCTIONS[number];
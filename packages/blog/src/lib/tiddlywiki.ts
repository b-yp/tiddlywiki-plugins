import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Astro dev server 以 packages/blog 为 cwd
const TW_OUTPUT_DIR = resolve(process.cwd(), "../../demo/output/astro");

export interface TiddlerMeta {
  title: string;
  created: string;
  modified: string;
  tags: string[];
  slug: string;
}

/**
 * 将 TiddlyWiki 的时间戳（YYYYMMDDHHmmssSSS）解析为 Date 对象
 */
export function parseTWDate(ts: string): Date {
  if (!ts || ts.length < 14) return new Date(0);
  const y = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(8, 10);
  const mi = ts.slice(10, 12);
  const s = ts.slice(12, 14);
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

/**
 * 读取所有条目的元数据
 */
export function getAllPosts(): TiddlerMeta[] {
  const dbPath = resolve(TW_OUTPUT_DIR, "db.json");
  if (!existsSync(dbPath)) {
    console.warn(`[TiddlyWiki] db.json not found at: ${dbPath}`);
    return [];
  }
  const raw = readFileSync(dbPath, "utf-8");
  const posts: TiddlerMeta[] = JSON.parse(raw);
  // 按修改时间降序排列（最新的在前）
  return posts.sort((a, b) => b.modified.localeCompare(a.modified));
}

/**
 * 根据 title 读取条目的 HTML 正文内容
 */
export function getPostContent(title: string): string | null {
  const encodedTitle = encodeURIComponent(title);
  const htmlPath = resolve(TW_OUTPUT_DIR, `content/${encodedTitle}.html`);
  if (!existsSync(htmlPath)) {
    console.warn(`[TiddlyWiki] content file not found: ${htmlPath}`);
    return null;
  }
  return readFileSync(htmlPath, "utf-8");
}

/**
 * 用 created 时间戳作为路由 slug（纯数字，ASCII 安全，无中文 URL 问题）
 * 例如：20260304030000000
 */
export function postToSlug(post: TiddlerMeta): string {
  return post.created;
}

/**
 * 根据 slug（created 时间戳）查找对应的文章
 */
export function getPostBySlug(slug: string): TiddlerMeta | undefined {
  return getAllPosts().find((p) => p.created === slug);
}

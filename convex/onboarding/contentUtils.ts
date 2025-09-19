/**
 * Content processing utilities for onboarding flow
 * Handles URL normalization, content truncation, and deduplication
 */

export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    let pathname = url.pathname.replace(/\/+/g, "/");
    pathname = pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    const params = new URLSearchParams(url.search);
    const removeKeys: Array<string> = [
      "gclid",
      "fbclid",
      "ref",
      "referrer",
      "mc_cid",
      "mc_eid",
      "igshid",
    ];
    for (const key of [...params.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || removeKeys.includes(key.toLowerCase())) {
        params.delete(key);
      }
    }
    const sorted = new URLSearchParams();
    [...params.keys()].sort().forEach((k) => {
      for (const v of params.getAll(k)) sorted.append(k, v);
    });
    const query = sorted.toString();
    return `https://${hostname}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return input;
  }
}


export function truncateContent(content: string, maxLength = 6000): string {
  if (content.length <= maxLength) return content;
  
  // Try to truncate at a natural break point (paragraph, sentence)
  const truncated = content.slice(0, maxLength);
  const lastParagraph = truncated.lastIndexOf('\n\n');
  const lastSentence = truncated.lastIndexOf('. ');
  
  if (lastParagraph > maxLength * 0.7) {
    return truncated.slice(0, lastParagraph);
  } else if (lastSentence > maxLength * 0.7) {
    return truncated.slice(0, lastSentence + 1);
  } else {
    return truncated + '...';
  }
}

export function deduplicateUrls(urls: Array<string>): Array<string> {
  const seen = new Set<string>();
  const result: Array<string> = [];
  
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  
  return result;
}


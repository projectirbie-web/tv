export function countryName(code) {
  if (!code) return 'Negara tidak diketahui';
  const normalized = String(code).trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalized)) {
    try {
      return new Intl.DisplayNames(['id'], { type: 'region' }).of(normalized) || normalized;
    } catch {
      // Fall through to the raw code in older browsers.
    }
  }
  return normalized;
}

export function channelInitials(name = '') {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TV';
}

export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

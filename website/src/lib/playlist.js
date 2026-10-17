const COUNTRY_ALIASES = {
  ID: 'Indonesia', MY: 'Malaysia', TH: 'Thailand', KR: 'Korea Selatan', KP: 'Korea Utara',
  JP: 'Jepang', SA: 'Arab Saudi', AE: 'Uni Emirat Arab', QA: 'Qatar', KW: 'Kuwait',
  BH: 'Bahrain', OM: 'Oman', YE: 'Yaman', JO: 'Yordania', IQ: 'Irak', LB: 'Lebanon',
  PS: 'Palestina', IL: 'Israel', US: 'Amerika Serikat', GB: 'Britania Raya', UK: 'Britania Raya',
  CA: 'Kanada', AU: 'Australia', NZ: 'Selandia Baru',
};

export function countryName(code) {
  if (!code) return 'Negara tidak diketahui';
  const normalized = String(code).trim().toUpperCase();
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
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

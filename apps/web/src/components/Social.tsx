import type { ReactNode } from 'react';

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'whatsapp'] as const;
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
};

const ICONS: Record<SocialPlatform, ReactNode> = {
  facebook: <path d="M14 8.5h2V5h-2.4C11 5 9.6 6.6 9.6 9v1.6H7.5V14h2.1v6h3.4v-6h2.3l.4-3.4h-2.7V9c0-.6.2-1 1.2-1z" />,
  instagram: <><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="16.4" cy="7.6" r="1.1" /></>,
  x: <path d="M4.6 4h3.8l3.3 4.6L16 4h3l-5.2 6.9L19.6 20h-3.8l-3.7-5.1L7.8 20H4.7l5.6-7.4z" />,
  linkedin: <><rect x="4.5" y="4.5" width="15" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 10v6M8 7.6v.01M11.5 16v-3.2c0-1.4 1-2.3 2.2-2.3s2.3.9 2.3 2.5V16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>,
  youtube: <><rect x="3.5" y="6.5" width="17" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10.5 9.5v5l4.2-2.5z" /></>,
  tiktok: <path d="M13 4v9.4a2.9 2.9 0 1 1-2.4-2.85V13a1.1 1.1 0 1 0 .9 1.08V4h1.5c.3 1.6 1.6 2.9 3.2 3.1v1.6c-1.1-.05-2.1-.4-3-1z" />,
  whatsapp: <path d="M12 4a8 8 0 0 0-6.9 12l-1 3.7 3.8-1A8 8 0 1 0 12 4zm4.3 11c-.2.5-1 1-1.5 1.1-.4.05-.9.1-2.5-.6-2.1-.9-3.5-3-3.6-3.2-.1-.2-.9-1.2-.9-2.3s.6-1.6.8-1.8c.2-.2.4-.25.6-.25h.4c.15 0 .3-.05.5.4l.7 1.7c.05.15.1.3 0 .5l-.3.5c-.1.15-.2.3-.1.5.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.3.1.45-.05l.6-.7c.15-.2.3-.15.5-.1l1.6.75c.2.1.35.15.4.25.05.15.05.6-.15 1.1z" />,
};

export function SocialRow({ links }: { links: Partial<Record<SocialPlatform, string>> }) {
  const entries = SOCIAL_PLATFORMS
    .map((p) => [p, (links[p] || '').trim()] as const)
    .filter(([, url]) => /^https?:\/\//i.test(url));
  if (!entries.length) return null;
  return (
    <div className="social-row">
      {entries.map(([platform, url]) => (
        <a
          key={platform}
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={SOCIAL_LABELS[platform]}
          title={SOCIAL_LABELS[platform]}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{ICONS[platform]}</svg>
        </a>
      ))}
    </div>
  );
}

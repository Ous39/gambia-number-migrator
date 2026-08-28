import { useEffect, useState } from 'react';

// Real GNM app screenshots. Each entry prefers a compressed .webp and falls back
// to the original if the .webp isn't present yet — so dropping webp files into
// apps/web/public/screens/ needs no code change. Only the first is fetched on
// page load; the rest preload in the background so the carousel stays smooth.
const SHOTS = [
  { webp: '/screens/dashboard.webp', fallback: '/screens/dashboard.png', label: 'Dashboard' },
  { webp: '/screens/scan.webp', fallback: '/screens/scan.png', label: 'Scan complete' },
  { webp: '/screens/preview.webp', fallback: '/screens/preview.jpeg', label: 'Preview changes' },
  { webp: '/screens/history.webp', fallback: '/screens/history.png', label: 'History' },
  { webp: '/screens/settings.webp', fallback: '/screens/settings.png', label: 'Privacy & settings' },
];

function preload(webp: string, fallback: string, done: () => void) {
  const img = new Image();
  img.onload = done;
  img.onerror = () => {
    const alt = new Image();
    alt.onload = done;
    alt.src = fallback;
  };
  img.src = webp;
}

export function AppPreviewPhone() {
  const [index, setIndex] = useState(0);
  const [srcByIndex, setSrcByIndex] = useState<Record<number, string>>({ 0: SHOTS[0].webp });
  const [ready, setReady] = useState<Set<number>>(new Set([0]));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return;
    const timer = setTimeout(() => {
      SHOTS.forEach((shot, i) => {
        if (i === 0) return;
        preload(shot.webp, shot.fallback, () => setReady((r) => new Set(r).add(i)));
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [failed]);

  useEffect(() => {
    if (failed || SHOTS.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        for (let step = 1; step <= SHOTS.length; step += 1) {
          const next = (current + step) % SHOTS.length;
          if (ready.has(next)) return next;
        }
        return current;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [failed, ready]);

  const shot = SHOTS[index];
  const src = srcByIndex[index] ?? shot.webp;

  return (
    <div className="phone-showcase" aria-label="GNM app screens">
      <div className="phone-frame">
        {failed ? (
          <div className="phone-shot-fallback">
            <img className="brand-logo" src="/logo.png" alt="" width={56} height={56} />
            <b>GNM</b>
            <span>Contact migration, done safely</span>
          </div>
        ) : (
          <img
            key={`${index}-${src}`}
            className="phone-shot is-active"
            src={src}
            alt={`GNM app — ${shot.label}`}
            width={591}
            height={1280}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
            onError={() => {
              if (src === shot.webp) setSrcByIndex((m) => ({ ...m, [index]: shot.fallback }));
              else setFailed(true);
            }}
          />
        )}
      </div>
      {!failed && SHOTS.length > 1 && (
        <div className="phone-dots" role="tablist" aria-label="App screen">
          {SHOTS.map((s, i) => (
            <button
              key={s.fallback}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.label}
              className={i === index ? 'is-active' : ''}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

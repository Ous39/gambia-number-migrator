import { useEffect, useState } from 'react';

// Real GNM app screenshots. Only the first is fetched on page load; the rest are
// preloaded in the background after mount so the carousel is smooth without
// blocking first paint. Swap these to .webp once compressed versions exist.
const SHOTS = [
  { src: '/screens/dashboard.png', label: 'Dashboard' },
  { src: '/screens/scan.png', label: 'Scan complete' },
  { src: '/screens/preview.jpeg', label: 'Preview changes' }, // demo/placeholder contacts only
  { src: '/screens/history.png', label: 'History' },
  { src: '/screens/settings.png', label: 'Privacy & settings' },
];

export function AppPreviewPhone() {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState<Set<number>>(new Set([0]));
  const [failed, setFailed] = useState(false);

  // Preload the remaining screenshots a beat after mount (non-blocking).
  useEffect(() => {
    if (failed) return;
    const timer = setTimeout(() => {
      SHOTS.forEach((shot, i) => {
        if (i === 0) return;
        const img = new Image();
        img.onload = () => setReady((r) => new Set(r).add(i));
        img.src = shot.src;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [failed]);

  // Advance only to screenshots that have finished preloading.
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
            key={shot.src}
            className="phone-shot is-active"
            src={shot.src}
            alt={`GNM app — ${shot.label}`}
            width={591}
            height={1280}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      {!failed && SHOTS.length > 1 && (
        <div className="phone-dots" role="tablist" aria-label="App screen">
          {SHOTS.map((s, i) => (
            <button
              key={s.src}
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

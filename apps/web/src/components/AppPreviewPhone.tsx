import { useEffect, useState } from 'react';

// Real GNM app screenshots. Drop the PNGs into apps/web/public/screens/.
// The Dashboard is shown first; the rest cross-fade every few seconds.
const SHOTS = [
  { src: '/screens/dashboard.png', label: 'Dashboard' },
  { src: '/screens/scan.png', label: 'Scan complete' },
  { src: '/screens/preview.png', label: 'Preview changes' },
];

export function AppPreviewPhone() {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed || SHOTS.length < 2) return;
    const timer = setInterval(() => setIndex((v) => (v + 1) % SHOTS.length), 4500);
    return () => clearInterval(timer);
  }, [failed]);

  return (
    <div className="phone-showcase" aria-label="GNM app screens">
      <div className="phone-frame">
        {!failed && SHOTS.map((shot, i) => (
          <img
            key={shot.src}
            className={`phone-shot ${i === index ? 'is-active' : ''}`}
            src={shot.src}
            alt={i === index ? `GNM app — ${shot.label}` : ''}
            loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
          />
        ))}
        {failed && (
          <div className="phone-shot-fallback">
            <img className="brand-logo" src="/logo.png" alt="" width={56} height={56} />
            <b>GNM</b>
            <span>Contact migration, done safely</span>
          </div>
        )}
      </div>
      {!failed && SHOTS.length > 1 && (
        <div className="phone-dots" role="tablist" aria-label="App screen">
          {SHOTS.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={shot.label}
              className={i === index ? 'is-active' : ''}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

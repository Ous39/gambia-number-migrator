import { useEffect, useState } from 'react';
import { getStatus } from '../api/client';

type Cfg = { target: string; label: string | null };

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** Live hero countdown. Admin sets target + label in Website settings; renders
 *  nothing when disabled, unset, or already past. */
export function Countdown() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    getStatus()
      .then((s) => {
        if (!active) return;
        const t = s.countdown?.enabled && s.countdown.target ? Date.parse(s.countdown.target) : NaN;
        if (Number.isFinite(t) && t > Date.now()) setCfg({ target: s.countdown!.target as string, label: s.countdown!.label });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cfg) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cfg]);

  if (!cfg) return null;
  const left = Date.parse(cfg.target) - now;
  if (left <= 0) return null;
  const { days, hours, minutes, seconds } = parts(left);
  const units: Array<[number, string]> = [
    [days, 'days'],
    [hours, 'hrs'],
    [minutes, 'min'],
    [seconds, 'sec'],
  ];

  return (
    <div className="countdown" role="timer" aria-label={`${cfg.label || 'Countdown'}: ${days} days, ${hours} hours, ${minutes} minutes`}>
      {cfg.label && <span className="countdown-label">{cfg.label}</span>}
      <div className="countdown-units">
        {units.map(([value, name]) => (
          <div className="countdown-unit" key={name}>
            <b>{String(value).padStart(2, '0')}</b>
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

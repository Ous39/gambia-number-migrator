import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicContent, resolveAssetUrl, type PublicContent as PublicContentData } from '../api/client';

const VALUES = [
  ['🇬🇲', 'Local knowledge', 'Built in The Gambia, for Gambian numbers and networks.'],
  ['{ }', 'Software craft', 'Privacy-first engineering — contacts never leave the device.'],
  ['◈', 'Public service', 'A practical tool for a national transition, not a data product.'],
];

export function PublicContent() {
  const [team, setTeam] = useState<PublicContentData['team']>([]);

  useEffect(() => {
    let active = true;
    getPublicContent().then((data) => { if (active) setTeam(data.team || []); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  return (
    <section className="section" id="team">
      <div className="container">
        <div className="team-intro card tint">
          <div className="team-intro-copy">
            <span className="eyebrow">The people behind GNM</span>
            <h2>Built by young Gambians.<br />Built for everyone.</h2>
            <p>GNM is created by a youth-led Gambian technology team under <strong>OceanBrown</strong> — combining local knowledge, software development and public-service thinking.</p>
            <a className="link-arrow" href="https://oceanbrown.gm" target="_blank" rel="noreferrer">About OceanBrown</a>
          </div>
          <ul className="team-values">
            {VALUES.map(([icon, title, text]) => (
              <li key={title}>
                <span className="team-values-ic" aria-hidden="true">{icon}</span>
                <div><b>{title}</b><span>{text}</span></div>
              </li>
            ))}
          </ul>
        </div>

        {team.length > 0 && (
          <div className="team-people">
            {team.map((m) => (
              <article className="person" key={m.id}>
                {m.photoUrl
                  ? <img className="person-avatar" src={resolveAssetUrl(m.photoUrl)} alt={m.name} loading="lazy" />
                  : <span className="person-avatar">{m.initials}</span>}
                <h3>{m.name}</h3>
                <span className="person-role">{m.role}</span>
                <p>{m.bio}</p>
                <div className="person-links">
                  <Link className="link-arrow" to={`/team/${m.id}`}>Read more</Link>
                  {m.portfolioUrl && <a href={m.portfolioUrl} target="_blank" rel="noreferrer">Portfolio ↗</a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

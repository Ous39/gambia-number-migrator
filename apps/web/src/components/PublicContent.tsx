import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicContent, resolveAssetUrl, type PublicContent as PublicContentData } from '../api/client';

const fallbackTeam: PublicContentData['team'] = [
  { id: 'fallback', name: 'The GNM Team', role: 'Young Gambian innovators', initials: 'GNM', bio: 'A youth-led technology team building a practical national solution under OceanBrown.' },
];

export function PublicContent() {
  const [team, setTeam] = useState<PublicContentData['team']>([]);

  useEffect(() => {
    let active = true;
    getPublicContent().then((data) => { if (active) setTeam(data.team || []); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const shown = team.length ? team : fallbackTeam;

  return (
    <section className="section" id="team">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">The people behind GNM</span>
          <h2>Built by young Gambians. Built for everyone.</h2>
          <p>GNM is created by a youth-led Gambian technology team under OceanBrown — combining local knowledge, software development and public-service thinking.</p>
        </div>
        <div className="team-grid" style={{ marginTop: 32 }}>
          {shown.map((m) => (
            <article key={m.id}>
              {m.photoUrl
                ? <img className="avatar" src={resolveAssetUrl(m.photoUrl)} alt={m.name} />
                : <span className="avatar">{m.initials}</span>}
              <h3>{m.name}</h3>
              <b>{m.role}</b>
              <p style={{ marginTop: 8 }}>{m.bio}</p>
              {m.id !== 'fallback' && <Link className="link-arrow" to={`/team/${m.id}`}>Read more</Link>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

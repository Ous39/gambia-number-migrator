import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPublicContent, resolveAssetUrl, type PublicContent as PublicContentData } from '../api/client';

const fallbackTeam: PublicContentData['team'] = [
  { id: 'fallback', name: 'The GNM Team', role: 'Young Gambian Innovators', initials: 'GNM', bio: 'A youth-led technology team building a practical national solution under OceanBrown.' },
];

export function PublicContent() {
  const [team, setTeam] = useState<PublicContentData['team']>([]);
  const [news, setNews] = useState<PublicContentData['announcements']>([]);

  useEffect(() => {
    let active = true;
    getPublicContent().then((data) => {
      if (!active) return;
      setTeam(data.team || []);
      setNews(data.announcements || []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const shown = team.length ? team : fallbackTeam;

  return (
    <section className="section team-section" id="team">
      <div className="container">
        <div className="team-heading">
          <div><span className="kicker">THE PEOPLE BEHIND GNM</span><h2>Built by young Gambians.<br /><em>Built for everyone.</em></h2></div>
          <p>GNM is created by a young, youth-led Gambian technology team under OceanBrown—combining local knowledge, software development and public-service thinking.</p>
        </div>
        <div className="team-grid">
          {shown.map((m) => (
            <article key={m.id}>
              {m.photoUrl ? <img className="avatar avatar-photo" src={resolveAssetUrl(m.photoUrl)} alt={m.name} /> : <span className="avatar">{m.initials}</span>}
              <div>
                <h3>{m.name}</h3><b>{m.role}</b><p>{m.bio}</p>
                {m.id !== 'fallback' && <Link className="team-readmore" to={`/team/${m.id}`}>Read more →</Link>}
              </div>
            </article>
          ))}
        </div>
        {news.length > 0 && (
          <div className="news-board">
            <div><span className="live-dot" /> LATEST GNM UPDATES</div>
            {news.map((n) => <article key={n.id}><span>{new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><h3>{n.title}</h3><p>{n.body}</p></article>)}
          </div>
        )}
      </div>
    </section>
  );
}

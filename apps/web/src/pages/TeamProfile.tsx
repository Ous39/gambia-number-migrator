import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { SiteHeader, SiteFooter } from '../components/SiteShell';
import { getPublicContent, resolveAssetUrl, type TeamMember } from '../api/client';

type LoadState = 'loading' | 'found' | 'not-found';

export default function TeamProfile() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    let active = true;
    setState('loading');
    getPublicContent().then((data) => {
      if (!active) return;
      const found = data.team.find((m) => m.id === id) || null;
      setMember(found);
      setState(found ? 'found' : 'not-found');
    }).catch(() => { if (active) setState('not-found'); });
    return () => { active = false; };
  }, [id]);

  return (
    <main className="legal-page team-profile-page">
      <Seo title={member ? `${member.name} | Gambia Number Migrator Team` : 'Team member | Gambia Number Migrator'} description={member ? `${member.name}, ${member.role} at GNM.` : 'GNM team profile.'} />
      <SiteHeader />
      <div className="container team-profile">
        {state === 'loading' && <p className="body">Loading profile…</p>}
        {state === 'not-found' && (
          <div className="team-profile-missing">
            <span className="kicker">TEAM</span>
            <h1>Profile not found</h1>
            <p className="legal-lead">This team member's profile isn't available right now.</p>
            <Link className="button button-small" to="/#team">Back to the team</Link>
          </div>
        )}
        {state === 'found' && member && (
          <article className="team-profile-card">
            {member.photoUrl ? <img className="team-profile-photo" src={resolveAssetUrl(member.photoUrl)} alt={member.name} /> : <span className="team-profile-avatar">{member.initials}</span>}
            <span className="kicker">GNM TEAM</span>
            <h1>{member.name}</h1>
            <b className="team-profile-role">{member.role}</b>
            <p className="legal-lead">{member.longBio || member.bio}</p>
            <div className="team-profile-actions">
              {member.portfolioUrl && <a className="button button-small" href={member.portfolioUrl} target="_blank" rel="noreferrer">View portfolio ↗</a>}
              <Link className="text-link blue-link" to="/#team">← Back to the team</Link>
            </div>
          </article>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

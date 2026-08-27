import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
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
    <Page>
      <Seo
        title={member ? `${member.name} | GNM Team` : 'Team member | GNM'}
        description={member ? `${member.name}, ${member.role} at GNM.` : 'GNM team profile.'}
      />
      <article className="container section doc">
        {state === 'loading' && <p className="muted">Loading profile…</p>}
        {state === 'not-found' && (
          <>
            <span className="eyebrow">Team</span>
            <h1 style={{ marginTop: 12 }}>Profile not found</h1>
            <p className="lead">This team member's profile isn't available right now.</p>
            <Link className="btn small" to="/#team" style={{ marginTop: 16 }}>Back to the team</Link>
          </>
        )}
        {state === 'found' && member && (
          <>
            {member.photoUrl
              ? <img className="avatar" style={{ width: 96, height: 96, borderRadius: 24 }} src={resolveAssetUrl(member.photoUrl)} alt={member.name} />
              : <span className="avatar" style={{ width: 96, height: 96, borderRadius: 24, fontSize: 24 }}>{member.initials}</span>}
            <span className="eyebrow" style={{ marginTop: 16, display: 'inline-flex' }}>GNM team</span>
            <h1 style={{ marginTop: 10 }}>{member.name}</h1>
            <b style={{ color: 'var(--brand)' }}>{member.role}</b>
            <p className="lead" style={{ marginTop: 16 }}>{member.longBio || member.bio}</p>
            <div className="hero-cta">
              {member.portfolioUrl && <a className="btn small" href={member.portfolioUrl} target="_blank" rel="noreferrer">View portfolio ↗</a>}
              <Link className="link-arrow" to="/#team">Back to the team</Link>
            </div>
          </>
        )}
      </article>
    </Page>
  );
}

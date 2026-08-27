import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '../components/Seo';
import { Page } from '../components/SiteShell';
import { getUpdate, type UpdateEntry } from '../api/client';

type State = 'loading' | 'found' | 'missing';

export default function UpdatePost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<UpdateEntry | null>(null);
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    let active = true;
    setState('loading');
    getUpdate(slug || '')
      .then((d) => { if (active) { setPost(d); setState('found'); } })
      .catch(() => { if (active) setState('missing'); });
    return () => { active = false; };
  }, [slug]);

  return (
    <Page>
      <Seo
        title={post ? `${post.title} | GNM Updates` : 'Update | GNM'}
        description={post?.summary || 'An official GNM readiness update.'}
      />
      <article className="container section update-article">
        <Link className="link-arrow" to="/updates" style={{ transform: 'scaleX(-1)', display: 'inline-flex' }} aria-label="Back to updates"><span style={{ transform: 'scaleX(-1)' }}>← Updates</span></Link>
        {state === 'loading' && <p className="muted" style={{ marginTop: 20 }}>Loading…</p>}
        {state === 'missing' && (
          <>
            <h1 style={{ marginTop: 20 }}>Update not found</h1>
            <p className="lead">This update isn't available. It may have been unpublished.</p>
            <Link className="btn small" to="/updates" style={{ marginTop: 16 }}>All updates</Link>
          </>
        )}
        {state === 'found' && post && (
          <>
            <span className="eyebrow" style={{ marginTop: 20 }}>GNM update</span>
            <h1 style={{ marginTop: 12 }}>{post.title}</h1>
            <div className="meta">
              <time>{new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time>
            </div>
            {post.summary && <p className="lead" style={{ marginTop: 16 }}>{post.summary}</p>}
            <div className="update-body">{post.body}</div>
          </>
        )}
      </article>
    </Page>
  );
}

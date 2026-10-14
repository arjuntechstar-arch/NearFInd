import { notFound } from 'next/navigation';

export default function DevLoginPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="content" style={{ maxWidth: 760, margin: '0 auto', paddingTop: 48 }}>
      <p className="eyebrow">Local development</p>
      <h1>Choose a NearFind test role</h1>
      <p className="smallText">
        These identities exist only in development/test. Production continues to require the configured OIDC provider.
      </p>
      <div className="cardActions" style={{ marginTop: 24, flexWrap: 'wrap' }}>
        <a className="primaryButton" href="/auth/login?role=USER">Sign in as User</a>
        <a className="secondaryButton" href="/auth/login?role=PROVIDER">Sign in as Provider</a>
        <a className="secondaryButton" href="/auth/login?role=ADMIN">Sign in as Admin</a>
      </div>
      <p className="smallText" style={{ marginTop: 24 }}>
        USER exercises Saved, community, booking, roadside and rewards. PROVIDER exercises provider-owned operations. ADMIN exercises moderation, provider approval and platform controls.
      </p>
    </main>
  );
}

export const metadata = { title: 'Sign in · Automation Dashboard' };

// Owner and admin type their own password (the server works out which login it is).
// Viewer needs no password: real figures, with names, numbers, emails and messages hidden (lib/roles.js).
export default async function Login({ searchParams }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <div className="card login-card">
        <form method="post" action="/api/login">
          <h1>Automation Dashboard</h1>
          <p className="muted">Mail, WhatsApp and SMS activity for all brands.</p>
          <label htmlFor="password">Owner or admin password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          {sp?.error ? <p className="err" role="alert">Wrong password.</p> : null}
          <button type="submit">Open dashboard</button>
        </form>
        <p className="muted login-or">or</p>
        <form method="post" action="/api/login">
          <input type="hidden" name="mode" value="viewer" />
          <button type="submit" className="login-viewer">Continue as viewer (no password)</button>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Viewers see the real figures; names, phone numbers, emails and messages are hidden.</p>
        </form>
      </div>
    </main>
  );
}

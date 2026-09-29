export const metadata = { title: 'Sign in · Automation Dashboard' };

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  return (
    <main className="login">
      <form method="post" action="/api/login" className="card login-card">
        <h1>Automation Dashboard</h1>
        <p className="muted">Mail and WhatsApp activity for all brands.</p>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {sp?.error ? <p className="err" role="alert">Wrong password.</p> : null}
        <button type="submit">Open dashboard</button>
      </form>
    </main>
  );
}

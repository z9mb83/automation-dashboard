export const metadata = { title: 'Sign in · Automation Dashboard' };

// Pick who you are: Owner (owner password), Admin (admin password) or Viewer (no password).
// Each password works only on its own card. Plain HTML forms, no script needed.
const ROLES = [
  { as: 'owner', title: 'Owner', text: 'Results: replies, numbers sent, templates in use and costs. Read-only.' },
  { as: 'admin', title: 'Admin', text: 'Runs the outreach: uploads, sending, every chat, reports and what is switched on. No costs.' },
  { as: 'viewer', title: 'Viewer', text: 'Analytics only, with names, phone numbers, emails and messages hidden. No password.' },
];

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  const err = String(sp?.error || '');
  return (
    <main className="login">
      <div className="login-pick">
        <h1>Automation Dashboard</h1>
        <p className="muted">Mail, WhatsApp and SMS activity for all brands. Choose how you want to open it.</p>
        <div className="login-roles">
          {ROLES.map((r) => (
            <form key={r.as} method="post" action="/api/login" className={'card login-role ' + r.as}>
              <input type="hidden" name="as" value={r.as} />
              <h2>{r.title}</h2>
              <p className="muted">{r.text}</p>
              {r.as !== 'viewer' ? <>
                <label htmlFor={'pw-' + r.as}>{r.title} password</label>
                <input id={'pw-' + r.as} name="password" type="password" autoComplete="current-password" required autoFocus={r.as === 'owner'} />
                {err === r.as ? <p className="err" role="alert">Wrong {r.title.toLowerCase()} password.</p> : null}
              </> : <p className="muted login-nopw">No password needed.</p>}
              <button type="submit">{r.as === 'viewer' ? 'Open as viewer' : `Open as ${r.title.toLowerCase()}`}</button>
            </form>
          ))}
        </div>
        {err === '1' ? <p className="err" role="alert">Could not sign in. Try again.</p> : null}
      </div>
    </main>
  );
}

import { ROLE_LABEL, can } from '../../../lib/roles';

export const dynamic = 'force-dynamic';

// GET /api/me -> which login this is and what it may do (the inbox page uses it to show the right buttons).
export async function GET(req) {
  const role = req.headers.get('x-dash-role') || '';
  return Response.json({ role, label: ROLE_LABEL[role] || '', send: can(role, 'send'), money: can(role, 'money'), reply: can(role, 'reply') },
    { headers: { 'Cache-Control': 'no-store' } });
}

// GET /api/logo?id=<Google Drive file id> -> the brand logo image (Drive thumbnail), cached for a day.
// Only Drive file ids are accepted, so this cannot be used to fetch other sites. Login: middleware.js.
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[\w-]{20,80}$/.test(id)) return new Response('bad id', { status: 400 });
  try {
    const res = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w400`, { redirect: 'follow', next: { revalidate: 86400 } });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return new Response('not an image', { status: 404 });
    return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=86400' } });
  } catch {
    return new Response('not reachable', { status: 502 });
  }
}

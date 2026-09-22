const REPO = 'wuhaozhuo6666-ctrl/qingnian-laowu';
const RAW = 'https://raw.githubusercontent.com/' + REPO + '/main/';

function json(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function validUploadPath(path) {
  return typeof path === 'string'
    && !path.includes('..')
    && /^products\/uploads\/[A-Za-z0-9._\/-]+\.(?:webp|jpg|jpeg|png)$/i.test(path);
}

function imageType(path) {
  const ext = path.split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'image/webp';
}

async function raw(path) {
  return fetch(RAW + path + '?v=' + Date.now(), {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' }
  });
}

export default async function handler(request) {
  try {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const url = new URL(request.url);

    if (url.pathname === '/api/live-catalog') {
      const upstream = await raw('products/catalog.json');
      if (!upstream.ok) return json({ error: 'Catalog unavailable' }, 502);

      const text = await upstream.text();
      let data;
      try { data = JSON.parse(text); } catch { return json({ error: 'Catalog invalid' }, 502); }
      if (!data || !Array.isArray(data.products)) return json({ error: 'Catalog invalid' }, 502);

      return new Response(text, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    if (url.pathname.startsWith('/media/')) {
      let path;
      try { path = decodeURIComponent(url.pathname.slice('/media/'.length)); }
      catch { return json({ error: 'Bad path' }, 400); }

      if (!validUploadPath(path)) return json({ error: 'Image not found' }, 404);
      const upstream = await raw(path);
      if (!upstream.ok) return json({ error: 'Image not found' }, upstream.status === 404 ? 404 : 502);

      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': imageType(path),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }

    return json({ error: 'Not found' }, 404);
  } catch {
    return json({ error: 'Temporary unavailable' }, 503);
  }
}

export const config = {
  method: 'GET',
  path: ['/api/live-catalog', '/media/*']
};

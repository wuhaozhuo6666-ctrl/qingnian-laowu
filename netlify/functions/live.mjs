const REPO = 'wuhaozhuo6666-ctrl/qingnian-laowu';
const CONTENTS = 'https://api.github.com/repos/' + REPO + '/contents/';

function json(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
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

function apiPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function githubHeaders() {
  const headers = {
    'Accept': 'application/vnd.github.raw+json',
    'User-Agent': 'qingnian-laowu-live-catalog',
    'X-GitHub-Api-Version': '2022-11-28',
    'Cache-Control': 'no-cache'
  };
  const id = process.env.GITHUB_CLIENT_ID;
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (id && secret) {
    headers.Authorization = 'Basic ' + Buffer.from(id + ':' + secret).toString('base64');
  }
  return headers;
}

async function githubContent(path) {
  return fetch(CONTENTS + apiPath(path) + '?ref=main&_=' + Date.now(), {
    method: 'GET',
    cache: 'no-store',
    headers: githubHeaders()
  });
}

export default async function handler(request) {
  try {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const url = new URL(request.url);

    if (url.pathname === '/api/live-catalog') {
      const upstream = await githubContent('products/catalog.json');
      if (!upstream.ok) return json({ error: 'Catalog unavailable', upstream: upstream.status }, 502);

      const text = await upstream.text();
      let data;
      try { data = JSON.parse(text); } catch { return json({ error: 'Catalog invalid' }, 502); }
      if (!data || !Array.isArray(data.products)) return json({ error: 'Catalog invalid' }, 502);

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'CDN-Cache-Control': 'no-store',
          'Netlify-CDN-Cache-Control': 'no-store',
          'Pragma': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'X-Catalog-Source': 'github-contents-api'
        }
      });
    }

    if (url.pathname.startsWith('/media/')) {
      let path;
      try { path = decodeURIComponent(url.pathname.slice('/media/'.length)); }
      catch { return json({ error: 'Bad path' }, 400); }

      if (!validUploadPath(path)) return json({ error: 'Image not found' }, 404);
      const upstream = await githubContent(path);
      if (!upstream.ok) return json({ error: 'Image not found', upstream: upstream.status }, upstream.status === 404 ? 404 : 502);

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

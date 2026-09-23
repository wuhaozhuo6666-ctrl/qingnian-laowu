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

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
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

async function liveCatalog() {
  const upstream = await githubContent('products/catalog.json');
  if (!upstream.ok) return null;
  try {
    const data = JSON.parse(await upstream.text());
    return data && Array.isArray(data.products) ? data : null;
  } catch {
    return null;
  }
}

function cleanIds(raw) {
  return [...new Set(String(raw || '').split(',').map(value => value.trim()).filter(value => /^[A-Za-z0-9._-]{1,80}$/.test(value)))].slice(0, 80);
}

function publicImage(origin, path) {
  const safe = typeof path === 'string' && /^products\/[A-Za-z0-9._\/-]+\.(?:webp|jpg|jpeg|png)$/i.test(path)
    ? path
    : 'products/showroom/logo.webp';
  return new URL(safe.startsWith('products/uploads/') ? '/media/' + safe : '/' + safe, origin).href;
}

function sharePage(url, catalog) {
  const settings = catalog.settings && typeof catalog.settings === 'object' ? catalog.settings : {};
  const visible = catalog.products.filter(product => product && product.visible !== false);
  const requestedProduct = cleanIds(url.searchParams.get('product'))[0] || '';
  const listIds = cleanIds(url.searchParams.get('list'));
  const product = requestedProduct ? visible.find(item => item.id === requestedProduct) : null;
  const selected = listIds.map(id => visible.find(item => item.id === id)).filter(Boolean);
  const defaultTitle = settings.shareTitle || '青年老吴实木工厂店｜原木家具与全屋定制';
  const defaultDescription = settings.shareDescription || '25年实体家具经验，自有工厂与实体展厅，服务京津冀及周边。';
  let title = defaultTitle;
  let description = defaultDescription;
  let image = settings.shareImage || settings.heroImage;
  let target = '/';

  if (product) {
    title = product.name + '｜青年老吴实木工厂店';
    description = '编号 ' + product.id + ' · ' + (product.availability || '状态待确认') + ' · ' + (product.leadTime || '周期请咨询') + ' · 查看完整产品照片与规格。';
    image = product.image || image;
    target = '/?product=' + encodeURIComponent(product.id);
  } else if (selected.length) {
    title = '我的选品清单｜青年老吴实木工厂店';
    const names = selected.slice(0, 3).map(item => item.name).join('、');
    description = '已选 ' + selected.length + ' 款：' + names + (selected.length > 3 ? '等，点开查看完整清单。' : '，点开查看图片与详情。');
    image = selected[0].image || image;
    target = '/?list=' + selected.map(item => encodeURIComponent(item.id)).join(',');
  }

  const imageUrl = publicImage(url.origin, image);
  const canonical = url.href;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:site_name" content="青年老吴实木工厂店"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:image" content="${escapeHtml(imageUrl)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${escapeHtml(canonical)}"><meta http-equiv="refresh" content="1;url=${escapeHtml(target)}"></head><body><p>正在打开青年老吴实木工厂店…</p><p><a href="${escapeHtml(target)}">如未自动打开，请点这里继续</a></p><script>setTimeout(function(){location.replace(${JSON.stringify(target)})},80)</script></body></html>`;
}

export default async function handler(request) {
  try {
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const url = new URL(request.url);

    if (url.pathname === '/share') {
      const catalog = await liveCatalog();
      if (!catalog) return html('<!doctype html><meta charset="utf-8"><title>青年老吴实木工厂店</title><p>分享内容暂时不可用，请稍后重试。</p>', 502);
      return html(sharePage(url, catalog));
    }

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
  path: ['/api/live-catalog', '/media/*', '/share']
};

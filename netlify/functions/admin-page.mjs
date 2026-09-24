const REPO='wuhaozhuo6666-ctrl/qingnian-laowu';
const SOURCE='https://api.github.com/repos/'+REPO+'/contents/netlify/functions/admin.mjs';
function headers(){const h={'Accept':'application/vnd.github.raw+json','User-Agent':'qingnian-laowu-admin-page','X-GitHub-Api-Version':'2022-11-28','Cache-Control':'no-cache'};const id=process.env.GITHUB_CLIENT_ID,secret=process.env.GITHUB_CLIENT_SECRET;if(id&&secret)h.Authorization='Basic '+Buffer.from(id+':'+secret).toString('base64');return h}
export default async function handler(request){
 try{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const upstream=await fetch(SOURCE+'?ref=main&_='+Date.now(),{cache:'no-store',headers:headers()});
  if(!upstream.ok)return new Response('后台页面暂时不可用',{status:502,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  const source=await upstream.text();
  const start=source.indexOf('const ADMIN = String.raw`');
  const end=source.indexOf('`;\n\nexport default async function handler',start);
  if(start<0||end<0)return new Response('后台模板读取失败',{status:502,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  let html=source.slice(start+'const ADMIN = String.raw`'.length,end);
  html=html.replace('<button data-tab="woods">木材管理</button>','<button data-tab="woods">木材档案</button>');
  html=html.replace('</head>','<link rel="stylesheet" href="/assets/admin-wood-inline.css?v=20260924-2"></head>');
  html=html.replace('</body>','<script src="/assets/admin-wood-inline.js?v=20260924-2"></script></body>');
  return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}});
 }catch{return new Response('后台页面暂时不可用',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
}

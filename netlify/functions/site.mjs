const REPO='wuhaozhuo6666-ctrl/qingnian-laowu';
const INDEX='https://api.github.com/repos/'+REPO+'/contents/index.html';
function headers(){const h={'Accept':'application/vnd.github.raw+json','User-Agent':'qingnian-laowu-site','X-GitHub-Api-Version':'2022-11-28','Cache-Control':'no-cache'};const id=process.env.GITHUB_CLIENT_ID,secret=process.env.GITHUB_CLIENT_SECRET;if(id&&secret)h.Authorization='Basic '+Buffer.from(id+':'+secret).toString('base64');return h}
export default async function handler(request){
 try{
  if(request.method!=='GET')return new Response('Method not allowed',{status:405});
  const upstream=await fetch(INDEX+'?ref=main&_='+Date.now(),{cache:'no-store',headers:headers()});
  if(!upstream.ok)return new Response('页面暂时不可用',{status:502,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  let html=await upstream.text();
  html=html.replace('>木材展示</button>','>木材档案</button>')
    .replace('<h2>木材展示</h2>','<h2>木材档案</h2>')
    .replace('MATERIAL DISPLAY','WOOD ARCHIVE')
    .replace('这里集中查看可讨论的木材。实际颜色、纹理、等级与供料，以实样和当批木料为准。','这里集中整理木材本身的纹理、颜色、性能、适用场景与实拍照片，帮助你在选家具前先把木材看明白。')
    .replace('>查看木材</button>','>查看木材档案</button>');
  if(!html.includes('/assets/wood-archive.js'))html=html.replace('</body>','<script src="/assets/wood-archive.js?v=20260925-vertical"></script></body>');
  return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0, must-revalidate','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('页面暂时不可用',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})}
}
export const config={method:'GET',path:['/','/index.html']};

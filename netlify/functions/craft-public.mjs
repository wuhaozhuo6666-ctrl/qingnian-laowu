const REPO='wuhaozhuo6666-ctrl/qingnian-laowu';
const URL='https://api.github.com/repos/'+REPO+'/contents/products/craft.json';

function headers(){
 const value={'Accept':'application/vnd.github.raw+json','User-Agent':'qingnian-laowu-craft-public','X-GitHub-Api-Version':'2022-11-28','Cache-Control':'no-cache'};
 const id=process.env.GITHUB_CLIENT_ID,secret=process.env.GITHUB_CLIENT_SECRET;
 if(id&&secret)value.Authorization='Basic '+Buffer.from(id+':'+secret).toString('base64');
 return value;
}

export default async function handler(request){
 if(request.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'Content-Type':'application/json'}});
 try{
  const upstream=await fetch(URL+'?ref=main&_='+Date.now(),{cache:'no-store',headers:headers()});
  if(!upstream.ok)throw new Error('upstream');
  const data=JSON.parse(await upstream.text());
  return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{
  return new Response(JSON.stringify({error:'定制工艺资料暂时不可用'}),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 }
}

export const config={method:'GET',path:'/api/craft-page'};

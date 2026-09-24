const REPO='wuhaozhuo6666-ctrl/qingnian-laowu';
const CONTENTS='https://api.github.com/repos/'+REPO+'/contents/';
function headers(){const h={'Accept':'application/vnd.github.raw+json','User-Agent':'qingnian-laowu-wood-public','X-GitHub-Api-Version':'2022-11-28','Cache-Control':'no-cache'};const id=process.env.GITHUB_CLIENT_ID,secret=process.env.GITHUB_CLIENT_SECRET;if(id&&secret)h.Authorization='Basic '+Buffer.from(id+':'+secret).toString('base64');return h}
async function read(path,fallback){try{const r=await fetch(CONTENTS+path+'?ref=main&_='+Date.now(),{cache:'no-store',headers:headers()});if(!r.ok)return fallback;return JSON.parse(await r.text())}catch{return fallback}}
function unique(arr){return [...new Set(arr.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))]}
export default async function handler(request){
 if(request.method!=='GET')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'Content-Type':'application/json'}});
 const [woods,catalog]=await Promise.all([read('products/woods.json',{profiles:[]}),read('products/catalog.json',{products:[],settings:{}})]);
 const known=unique([...(Array.isArray(catalog.settings?.woods)?catalog.settings.woods:[]),...(Array.isArray(catalog.products)?catalog.products.map(p=>p?.wood):[])]).filter(v=>!/待确认|待核实/.test(v));
 const profiles=Array.isArray(woods.profiles)?woods.profiles.filter(p=>p&&p.visible!==false&&p.name).sort((a,b)=>Number(a.sortOrder||0)-Number(b.sortOrder||0)):[];
 return new Response(JSON.stringify({profiles,knownWoods:known}),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store'}});
}
export const config={method:'GET',path:'/api/wood-archive'};

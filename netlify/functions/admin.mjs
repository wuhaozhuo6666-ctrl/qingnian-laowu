import { webcrypto as crypto } from 'node:crypto';
const ORIGIN = 'https://qingnian-laowu.netlify.app';
const REPO = 'wuhaozhuo6666-ctrl/qingnian-laowu';
const OWNER_ID = 327517365;
const FILE = '/repos/' + REPO + '/contents/products/catalog.json';
const LIMITS = {name:80,brand:20,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200,availability:80,leadTime:160,image:260,title:80,phone:80,wechat:80,bio:500};
const PRODUCT_BOOLEAN_FIELDS = new Set(['featured','pinned','visible']);
const PRODUCT_STRING_FIELDS = new Set(['name','brand','category','room','wood','size','desc','options','price','availability','leadTime','image']);
const STORE_TEXT_LIMITS = {storeAddress:240,businessHours:160,parkingInfo:500,amapUrl:700,baiduUrl:700,shareTitle:120,shareDescription:320};
const DEFAULT_SETTINGS = {
 heroImage:'products/showroom/home-hero.webp',shareImage:'products/showroom/home-hero.webp',
 woods:[],categories:[],rooms:[],storeAddress:'河北张家口怀来 · 华美家具城',businessHours:'',parkingInfo:'',amapUrl:'',baiduUrl:'',
 shareTitle:'青年老吴实木工厂店｜原木家具与全屋定制',shareDescription:'25年实体家具经验，自有工厂与实体展厅，服务京津冀及周边。'
};
const MAX_PRODUCT_IMAGES = 20;
const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes));
const un64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
const url64 = bytes => b64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random = () => url64(crypto.getRandomValues(new Uint8Array(32)));
function cookie(req,name){return (req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name,value,age){return name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;}
async function key(env){const bytes=await crypto.subtle.digest('SHA-256',enc.encode('laowu-admin-session-v1:'+env.GITHUB_CLIENT_SECRET));return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const body=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(body));}
async function unseal(value,env){try{const [iv,body]=value.split('.');const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(env),un64(body));const data=JSON.parse(dec.decode(raw));return data.exp>Date.now()?data:null;}catch{return null;}}
function reply(body,status=200,extra={}){return new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',...extra}});}
function redirect(path,cookies=[]){const headers=new Headers({'Location':path,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:303,headers});}
async function github(path,token,options={}){const response=await fetch('https://api.github.com'+path,{...options,headers:{'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','User-Agent':'laowu-product-admin','X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})}});if(!response.ok){const e=new Error('GitHub request failed');e.status=response.status;throw e;}return response.status===204?null:response.json();}
async function readCatalog(token){
 const file=await github(FILE+'?ref=main',token);const data=JSON.parse(dec.decode(un64(file.content.replace(/\s/g,''))));if(!Array.isArray(data.products))throw Error('Invalid catalog');
 return {sha:file.sha,products:data.products.map(normalizeProduct),cases:Array.isArray(data.cases)?data.cases:[],contacts:Array.isArray(data.contacts)?data.contacts:[],settings:normalizeSettings(data.settings)};
}
async function writeCatalog(token,sha,products,settings,cases,contacts,message){
 const bytes=enc.encode(JSON.stringify({products,cases,contacts,settings},null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const result=await github(FILE,token,{method:'PUT',body:JSON.stringify({branch:'main',sha,message,content:btoa(binary)})});
 return {sha:result.content.sha,products,cases,contacts,settings};
}
function cleanText(value,field){if(typeof value!=='string')return '';const v=value.trim();if(v.length>(LIMITS[field]||400)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Invalid field');return v;}
function validImagePath(value){return typeof value==='string'&&/^products\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(value);}
function cleanStoreText(value,field){if(typeof value!=='string')return '';const v=value.trim();if(v.length>(STORE_TEXT_LIMITS[field]||400)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Invalid setting');return v;}
function validHttpsUrl(value){if(!value)return true;try{return new URL(value).protocol==='https:'}catch{return false}}
function normalizeSettings(input){const settings=input&&typeof input==='object'?input:{};const result={...DEFAULT_SETTINGS};for(const keyName of ['woods','categories','rooms'])result[keyName]=Array.isArray(settings[keyName])?settings[keyName].filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()).slice(0,100):[];if(validImagePath(settings.heroImage))result.heroImage=settings.heroImage;if(validImagePath(settings.shareImage))result.shareImage=settings.shareImage;else result.shareImage=result.heroImage;for(const field of Object.keys(STORE_TEXT_LIMITS)){if(typeof settings[field]==='string')result[field]=settings[field].trim().slice(0,STORE_TEXT_LIMITS[field])}return result;}
function normalizeProduct(p,index){return {...p,brand:typeof p.brand==='string'&&p.brand.trim()?p.brand.trim():'原木家具',images:Array.isArray(p.images)?p.images.filter(validImagePath).slice(0,MAX_PRODUCT_IMAGES-1):[],availability:typeof p.availability==='string'&&p.availability.trim()?p.availability.trim():'待确认',leadTime:typeof p.leadTime==='string'&&p.leadTime.trim()?p.leadTime.trim():'请咨询门店',featured:p.featured===true,pinned:p.pinned===true,visible:p.visible!==false,sortOrder:Number.isInteger(p.sortOrder)&&p.sortOrder>=0?p.sortOrder:index+1};}

function applyChanges(products,changes){
 if(!Array.isArray(changes)||changes.length>500)throw Error('Invalid changes');const next=products.map((p,index)=>normalizeProduct({...p,images:Array.isArray(p.images)?[...p.images]:[]},index));const seen=new Set();
 for(const change of changes){
  if(!change||typeof change.id!=='string'||seen.has(change.id))throw Error('Invalid product');seen.add(change.id);const p=next.find(p=>p.id===change.id);if(!p||!change.fields||typeof change.fields!=='object'||Array.isArray(change.fields))throw Error('Invalid product');
  for(const [field,value] of Object.entries(change.fields)){
   if(field==='images'){if(!Array.isArray(value)||value.length>=MAX_PRODUCT_IMAGES||value.some(path=>!validImagePath(path)))throw Error('Invalid images');p.images=[...new Set(value)].filter(path=>path!==p.image);continue}
   if(PRODUCT_BOOLEAN_FIELDS.has(field)){if(typeof value!=='boolean')throw Error('Invalid boolean');p[field]=value;continue}
   if(field==='sortOrder'){if(!Number.isInteger(value)||value<0||value>100000)throw Error('Invalid order');p.sortOrder=value;continue}
   if(!PRODUCT_STRING_FIELDS.has(field)||typeof value!=='string'||value.length>(LIMITS[field]||400)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('Invalid field');
   if(field==='name'&&!value.trim())throw Error('Name required');if(field==='image'&&!validImagePath(value.trim()))throw Error('Invalid image');p[field]=value.trim();
  }
  p.images=[...new Set((p.images||[]).filter(path=>path!==p.image))].slice(0,MAX_PRODUCT_IMAGES-1);
 }
 return next;
}
const worker = {async fetch(request,env){
 try{
  const url=new URL(request.url);
  if(url.origin!==ORIGIN)return reply({error:'地址不匹配。'},400);
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET)return reply({error:'请先配置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET。'},503);
  if(request.method==='POST'&&(request.headers.get('Origin')!==ORIGIN||!request.headers.get('Content-Type')?.startsWith('application/json')))return reply({error:'请求来源不正确。'},403);
  if(url.pathname==='/admin/login'&&request.method==='GET'){
   const state=random(),verifier=random();const challenge=url64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(verifier))));const auth=new URL('https://github.com/login/oauth/authorize');auth.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:ORIGIN+'/admin/callback',scope:'public_repo',state,code_challenge:challenge,code_challenge_method:'S256',login:'wuhaozhuo6666-ctrl',allow_signup:'false'}).toString();return redirect(auth.href,[setCookie('__Host-laowu-flow',await seal({state,verifier,exp:Date.now()+600000},env),600)]);
  }
  if(url.pathname==='/admin/callback'&&request.method==='GET'){
   const flow=await unseal(cookie(request,'__Host-laowu-flow'),env);if(!flow||!url.searchParams.get('state')||flow.state!==url.searchParams.get('state')||!url.searchParams.get('code'))return reply({error:'登录验证失效，请重新打开 /admin/login 登录。'},400);
   const r=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:ORIGIN+'/admin/callback',code_verifier:flow.verifier})});const token=await r.json();if(!r.ok||!token.access_token)return reply({error:'GitHub 登录未完成，请重新登录。'},401);
   const user=await github('/user',token.access_token);if(user.id!==OWNER_ID)return reply({error:'此账号没有本店管理权限，请使用店主 GitHub 账号登录。'},403);
   const age=Math.max(1,Math.min(3600,Number(token.expires_in)||3600));const session={token:token.access_token,uid:user.id,csrf:random(),exp:Date.now()+age*1000};return redirect('/admin/',[setCookie('__Host-laowu-session',await seal(session,env),age),setCookie('__Host-laowu-flow','',0)]);
  }
  if((url.pathname==='/admin/'||url.pathname==='/admin')&&request.method==='GET'){const nonce=random();return reply(ADMIN.replaceAll('NONCE_VALUE',nonce),200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});}
  if(!url.pathname.startsWith('/admin/api/'))return reply({error:'页面不存在。'},404);
  const session=await unseal(cookie(request,'__Host-laowu-session'),env);if(!session||session.uid!==OWNER_ID)return reply({error:'请登录。'},401);
  if(request.method==='POST'&&request.headers.get('X-CSRF-Token')!==session.csrf)return reply({error:'验证过期，请重新登录。'},403);
  if(url.pathname==='/admin/api/logout'&&request.method==='POST')return reply({ok:true},200,{'Set-Cookie':setCookie('__Host-laowu-session','',0)});
  // Recheck identity for each data request; GitHub enforces repository write permission.
  const user=await github('/user',session.token);if(user.id!==OWNER_ID)return reply({error:'没有管理权限。'},403);
  if(url.pathname==='/admin/api/catalog'&&request.method==='GET')return reply({...await readCatalog(session.token),csrf:session.csrf});
  if(url.pathname==='/admin/api/catalog'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>100000)return reply({error:'提交内容过大。'},413);
   const raw=await request.text();if(enc.encode(raw).length>100000)return reply({error:'提交内容过大。'},413);
   let data;try{data=JSON.parse(raw);}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已在其他页面更新。请先复制保留你的修改，再重新加载，避免覆盖。'},409);
   let products;try{products=applyChanges(current.products,data.changes);}catch{return reply({error:'字段无效、超长或产品名称为空。'},400);}
   if(!data.changes.length)return reply({error:'没有需要发布的修改。'},400);
   const result=await writeCatalog(session.token,current.sha,products,current.settings,current.cases,current.contacts,'Update product details from store admin');return reply({...result,message:'资料已保存，顾客网站正在自动更新，请稍后查看。'});
  }

  if(url.pathname==='/admin/api/image'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>2800000)return reply({error:'照片过大，请换一张或压缩后再试。'},413);
   const raw=await request.text();if(raw.length>2800000)return reply({error:'照片过大，请换一张或压缩后再试。'},413);
   let data;try{data=JSON.parse(raw);}catch{return reply({error:'照片数据格式错误。'},400);}
   const exts={'image/webp':'webp','image/jpeg':'jpg','image/png':'png'};
   if(!exts[data.mime]||typeof data.base64!=='string'||data.base64.length<100||data.base64.length>2600000||!/^[A-Za-z0-9+/=]+$/.test(data.base64))return reply({error:'仅支持 JPG、PNG、WEBP 图片。'},400);
   const approx=Math.floor(data.base64.length*3/4);if(approx>1900000)return reply({error:'处理后的照片仍然太大，请换一张再试。'},413);
   const imagePath='products/uploads/'+Date.now()+'-'+random().slice(0,10)+'.'+exts[data.mime];
   await github('/repos/'+REPO+'/contents/'+imagePath,session.token,{method:'PUT',body:JSON.stringify({branch:'main',message:'Upload product image from store admin',content:data.base64})});
   return reply({path:imagePath,message:'照片已上传。'});
  }
  if(url.pathname==='/admin/api/product/add'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>50000)return reply({error:'产品资料过大。'},413);
   let data;try{data=await request.json();}catch{return reply({error:'产品数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再添加。'},409);
   const p=data.product||{};const name=cleanText(p.name,'name'),brand=cleanText(p.brand||'原木家具','brand'),category=cleanText(p.category,'category'),room=cleanText(p.room||'其他','room'),wood=cleanText(p.wood,'wood'),size=cleanText(p.size,'size'),desc=cleanText(p.desc,'desc'),options=cleanText(p.options,'options'),price=cleanText(p.price||'','price'),availability=cleanText(p.availability||'待确认','availability'),leadTime=cleanText(p.leadTime||'请咨询门店','leadTime'),image=cleanText(p.image,'image');const images=Array.isArray(p.images)?p.images:[];
   if(!name||!category||!wood||!validImagePath(image)||images.length>=MAX_PRODUCT_IMAGES||images.some(path=>!validImagePath(path)))return reply({error:'请填写产品名称、产品类型、木材，并上传有效照片。'},400);
   const id='LW-'+Date.now().toString(36).toUpperCase();
   const product={id,name,brand:['原木家具','皇玛康之家','文创产品'].includes(brand)?brand:'原木家具',category,room,wood,size,image,images:[...new Set(images)].filter(path=>path!==image).slice(0,MAX_PRODUCT_IMAGES-1),real:p.real!==false,options,desc,availability,leadTime,featured:p.featured===true,pinned:p.pinned===true,visible:p.visible!==false,sortOrder:0};if(price)product.price=price;
   const result=await writeCatalog(session.token,current.sha,[product,...current.products],current.settings,current.cases,current.contacts,'Add product from store admin');
   return reply({...result,message:'新产品已加入，顾客网站正在自动更新。'});
  }
  if(url.pathname==='/admin/api/product/delete'&&request.method==='POST'){
   let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);
   if(typeof data.id!=='string'||!current.products.some(p=>p.id===data.id))return reply({error:'找不到这个产品。'},404);
   const result=await writeCatalog(session.token,current.sha,current.products.filter(p=>p.id!==data.id),current.settings,current.cases,current.contacts,'Delete product from store admin');
   return reply({...result,message:'产品已删除，顾客网站正在自动更新。'});
  }

  if(url.pathname==='/admin/api/case/add'&&request.method==='POST'){let data;try{data=await request.json();}catch{return reply({error:'案例数据格式错误。'},400);}const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再添加案例。'},409);const c=data.case||{},title=cleanText(c.title||'','name'),summary=cleanText(c.summary||'','desc'),tag=cleanText(c.tag||'全屋定制','category'),cover=cleanText(c.cover||'','image');const images=Array.isArray(c.images)?c.images.filter(validImagePath).slice(0,30):[];if(!title||!validImagePath(cover))return reply({error:'请填写案例名称并上传封面图。'},400);const item={id:'CASE-'+Date.now().toString(36).toUpperCase(),title,summary,tag,cover,images};const result=await writeCatalog(session.token,current.sha,current.products,current.settings,[item,...current.cases],current.contacts,'Add whole-home case from store admin');return reply({...result,message:'全屋案例已添加，顾客网站会实时读取。'});}
  if(url.pathname==='/admin/api/case/delete'&&request.method==='POST'){let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);if(typeof data.id!=='string'||!current.cases.some(c=>c.id===data.id))return reply({error:'找不到这个案例。'},404);const result=await writeCatalog(session.token,current.sha,current.products,current.settings,current.cases.filter(c=>c.id!==data.id),current.contacts,'Delete whole-home case from store admin');return reply({...result,message:'案例已删除。'});}

  if(url.pathname==='/admin/api/contact/add'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>30000)return reply({error:'联系人资料过大。'},413);
   let data;try{data=await request.json();}catch{return reply({error:'联系人数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再添加联系人。'},409);
   const c=data.contact||{};let name,title,phone,wechat,bio,image;try{name=cleanText(c.name||'','name');title=cleanText(c.title||'','title');phone=cleanText(c.phone||'','phone');wechat=cleanText(c.wechat||'','wechat');bio=cleanText(c.bio||'','bio');image=cleanText(c.image||'','image');}catch{return reply({error:'联系人资料包含无效或过长内容。'},400);}
   if(!['sales','designer'].includes(c.type)||!name||(!phone&&!wechat)||!validImagePath(image))return reply({error:'请选择销售或设计师，填写姓名和至少一种联系方式，并上传个人照片。'},400);
   if(current.contacts.length>=100)return reply({error:'联系人数量已达上限。'},400);
   const contact={id:'CONTACT-'+Date.now().toString(36).toUpperCase(),type:c.type,name,title,phone,wechat,bio,image};
   const result=await writeCatalog(session.token,current.sha,current.products,current.settings,current.cases,[contact,...current.contacts],'Add store contact from admin');
   return reply({...result,message:(c.type==='sales'?'销售':'设计师')+'已添加，顾客网站会实时读取。'});
  }
  if(url.pathname==='/admin/api/contact/delete'&&request.method==='POST'){
   let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);
   if(typeof data.id!=='string'||!current.contacts.some(c=>c.id===data.id))return reply({error:'找不到这个联系人。'},404);
   const result=await writeCatalog(session.token,current.sha,current.products,current.settings,current.cases,current.contacts.filter(c=>c.id!==data.id),'Delete store contact from admin');
   return reply({...result,message:'联系人已删除。'});
  }

  if(url.pathname==='/admin/api/settings'&&request.method==='POST'){
   let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再保存。'},409);
   const input=data.settings||{}, out={};
   for(const keyName of ['woods','categories','rooms']){
    if(!Array.isArray(input[keyName]))return reply({error:'设置格式不正确。'},400);
    const seen=new Set(), list=[];
    for(const item of input[keyName]){
     if(typeof item!=='string')return reply({error:'设置内容不正确。'},400);
     const v=item.trim();if(!v||v.length>80)return reply({error:'名称不能为空或过长。'},400);
     if(!seen.has(v)){seen.add(v);list.push(v)}
    }
    if(list.length>100)return reply({error:'分类数量过多。'},400);
    out[keyName]=list;
   }
   const heroImage=typeof input.heroImage==='string'?input.heroImage.trim():'';
   if(!validImagePath(heroImage))return reply({error:'首页大图地址无效，请重新上传。'},400);
   out.heroImage=heroImage;
   const shareImage=typeof input.shareImage==='string'?input.shareImage.trim():heroImage;
   if(!validImagePath(shareImage))return reply({error:'微信分享缩略图地址无效，请重新上传。'},400);
   out.shareImage=shareImage;
   try{for(const field of Object.keys(STORE_TEXT_LIMITS))out[field]=cleanStoreText(input[field]||'',field)}catch{return reply({error:'门店或分享资料过长，请精简后再保存。'},400)}
   if(!validHttpsUrl(out.amapUrl)||!validHttpsUrl(out.baiduUrl))return reply({error:'导航链接必须是 https 开头的完整链接。'},400);
   if(!out.storeAddress)out.storeAddress=DEFAULT_SETTINGS.storeAddress;
   if(!out.shareTitle)out.shareTitle=DEFAULT_SETTINGS.shareTitle;
   if(!out.shareDescription)out.shareDescription=DEFAULT_SETTINGS.shareDescription;
   const result=await writeCatalog(session.token,current.sha,current.products,out,current.cases,current.contacts,'Update catalog settings from store admin');
   return reply({...result,message:'网站设置已保存，顾客网站正在自动更新。'});
  }
  return reply({error:'不支持的操作。'},405);
 }catch(error){return reply({error:error.status===401?'登录已过期，请重新登录；未发布的修改仍保留在页面中。':error.status===409||error.status===422?'发生版本冲突，未覆盖现有资料。请保留修改后重新加载。':'服务暂时不可用，请稍后重试。'},error.status===401?401:error.status===409||error.status===422?409:502);}
}};
const ADMIN = String.raw`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青年老吴 · 店主管理</title><style nonce="NONCE_VALUE">
*{box-sizing:border-box}body{margin:0;background:#f5f2ea;color:#24372e;font:15px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1180px;margin:auto;padding:20px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1px solid #d7ddd0}h1{margin:0;font-size:25px}h2{margin:0 0 14px;font-size:20px}p{color:#647066}a{color:#2f513f}button{font:inherit;cursor:pointer;border:1px solid #bcc5b8;background:#fff;border-radius:9px;padding:10px 15px;color:#24372e}.primary{background:#2f513f;color:#fff;border-color:#2f513f}.danger{color:#8e3027}.tabs{display:flex;gap:8px;overflow:auto;padding:18px 0 8px}.tabs button{white-space:nowrap}.tabs button.active{background:#2f513f;color:#fff;border-color:#2f513f}.status{min-height:44px;padding:10px 0;color:#46584e}.panel{background:#fffef9;border:1px solid #d9dfd3;border-radius:14px;padding:18px;margin:12px 0}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.wide{grid-column:1/-1}label span{display:block;margin-bottom:5px}input,textarea,select{width:100%;font:inherit;border:1px solid #aeb9aa;border-radius:8px;padding:10px;background:#fff;color:#24372e}textarea{min-height:100px}.search{margin:14px 0}.products{display:grid;gap:14px}.product{display:grid;grid-template-columns:230px 1fr;gap:18px;background:#fffef9;border:1px solid #d9dfd3;border-radius:14px;padding:16px}.product>div>img{width:100%;height:190px;object-fit:cover;border-radius:9px;background:#ecebe4}.fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}.photoActions{display:grid;gap:8px;margin-top:9px}.photoActions input{font-size:13px;padding:7px}.photoLabel{display:block;margin-top:10px;font-size:12px;color:#647066}.photoGallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.photoThumb{position:relative;min-width:0}.photoThumb img{display:block;width:100%;height:66px;object-fit:cover;border:2px solid transparent;border-radius:7px;background:#ecebe4}.photoThumb.cover img{border-color:#2f513f}.photoThumb span{position:absolute;left:3px;top:3px;padding:1px 4px;border-radius:4px;background:#2f513fe8;color:#fff;font-size:9px}.photoThumb .thumbTools{display:flex;gap:3px;margin-top:3px}.photoThumb button{min-width:0;flex:1;padding:3px 2px;border-radius:5px;font-size:10px}.chips{display:flex;flex-wrap:wrap;gap:9px}.chip{display:flex;align-items:center;gap:8px;border:1px solid #cbd3c6;background:#fff;border-radius:999px;padding:7px 8px 7px 13px}.chip button{padding:2px 8px;border:0;background:transparent;color:#8e3027}.manageRow{display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px}.hint{font-size:13px;color:#68746b}.loginbox{padding:28px 0}.preview{background:#fff;border:1px solid #b9c5b4;border-radius:12px;padding:16px;margin:14px 0}[hidden]{display:none!important}@media(max-width:720px){main{padding:13px}.product{grid-template-columns:1fr}.product>div>img{height:220px}.grid,.fields{grid-template-columns:1fr}.wide{grid-column:auto}header{align-items:flex-start;flex-direction:column}.tabs{position:sticky;top:0;background:#f5f2ea;z-index:5}.photoGallery{grid-template-columns:repeat(4,minmax(0,1fr))}}
.heroAdminPreview{width:min(100%,920px);aspect-ratio:16/7;margin:14px 0;overflow:hidden;border:1px solid #d9dfd3;border-radius:12px;background:#ecebe4}.heroAdminPreview img{display:block;width:100%;height:100%;object-fit:cover}.heroPath{overflow-wrap:anywhere;color:#647066;font-size:12px}
.operations{position:sticky;top:58px;z-index:4;display:grid;grid-template-columns:auto auto minmax(160px,1fr) auto auto;gap:8px;align-items:center;background:#f5f2eaf2;border:1px solid #d9dfd3;border-radius:12px;padding:10px;margin:12px 0;backdrop-filter:blur(8px)}.operations select,.operations input{min-width:0}.productMeta{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.miniBadge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 8px;background:#e9eee7;color:#385444;font-size:11px}.miniBadge.warn{background:#fff0d8;color:#8a5726}.miniBadge.hiddenProduct{background:#ececec;color:#666}.productSelect{display:flex;align-items:center;gap:7px;margin-bottom:8px;font-weight:600}.productSelect input,.toggleRow input{width:auto}.orderTools{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.orderTools button{padding:6px 9px;font-size:12px}.dragHandle{cursor:grab;touch-action:none}.product.dragging{opacity:.45}.product.dragTarget{outline:3px solid #9f7b50;outline-offset:2px}.toggleFields{grid-column:1/-1;display:flex;gap:18px;flex-wrap:wrap;border:1px solid #d9dfd3;border-radius:9px;padding:10px 12px}.toggleRow{display:flex;align-items:center;gap:7px}.completenessSummary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:10px 0}.summaryCard{background:#fffef9;border:1px solid #d9dfd3;border-radius:10px;padding:12px}.summaryCard strong{display:block;font-size:24px}.storePreview{display:grid;grid-template-columns:180px 1fr;gap:16px;align-items:start}.shareAdminPreview{width:180px;aspect-ratio:1.91/1;object-fit:cover;border-radius:9px;background:#ecebe4}.fieldHint{font-size:12px;color:#758078}.bulkValueWrap{min-width:0}@media(max-width:720px){.operations{position:static;grid-template-columns:1fr 1fr}.operations .bulkValueWrap{grid-column:1/-1}.completenessSummary{grid-template-columns:1fr 1fr}.storePreview{grid-template-columns:1fr}.shareAdminPreview{width:100%;max-width:320px}}
</style></head><body><main><header><div><h1>青年老吴 · 店主管理</h1><div class="hint">首页大图、产品、照片、案例、联系人和分类都可以单独管理</div></div><a href="https://qingnian-laowu.netlify.app/" target="_blank" rel="noopener">查看顾客网站 ↗</a></header><div id="status" class="status"></div>
<section id="loginBox" class="loginbox" hidden><p>请使用店主 GitHub 账号登录。</p><a href="/admin/login" target="_blank" rel="noopener"><button class="primary">使用 GitHub 登录</button></a><button id="resume">登录后继续</button></section>
<section id="editor" hidden>
<nav class="tabs"><button data-tab="products" class="active">产品管理</button><button data-tab="homepage">首页大图</button><button data-tab="store">门店与分享</button><button data-tab="cases">全屋案例</button><button data-tab="contacts">联系我们</button><button data-tab="woods">木材管理</button><button data-tab="categories">产品类型</button><button data-tab="rooms">空间分类</button></nav>

<section id="tab-products">
<div class="toolbar"><button id="toggleAdd" class="primary">＋ 添加新产品</button><button id="preview">预览并发布修改</button><button id="reload">重新加载</button><button id="logout">退出登录</button></div>
<section id="addPanel" class="panel" hidden><h2>添加新产品</h2><div class="grid">
<label><span>产品归属 *</span><select id="newBrand"><option>原木家具</option><option>皇玛康之家</option><option>文创产品</option></select></label>
<label><span>产品名称 *</span><input id="newName" maxlength="80"></label>
<label><span>产品类型 *</span><input id="newCategory" maxlength="80" list="categoryList"></label>
<label><span>空间</span><input id="newRoom" maxlength="80" list="roomList"></label>
<label><span>木材 *</span><input id="newWood" maxlength="100" list="woodList"></label>
<label><span>尺寸</span><input id="newSize" maxlength="160"></label>
<label><span>价格 / 报价说明</span><input id="newPrice" maxlength="200"></label>
<label><span>现货 / 定制状态</span><select id="newAvailability"><option>待确认</option><option>现货</option><option>可定制</option><option>现货 · 支持定制</option><option>暂时缺货</option></select></label>
<label><span>预计周期</span><input id="newLeadTime" maxlength="160" placeholder="例如：现货约3天发出 / 定制约45天"></label>
<label class="wide"><span>产品说明</span><textarea id="newDesc" maxlength="1600"></textarea></label>
<label class="wide"><span>可改项目</span><input id="newOptions" maxlength="400" placeholder="例如：尺寸、木材、颜色、软包"></label>
<div class="toggleFields"><label class="toggleRow"><input id="newFeatured" type="checkbox">设为推荐产品</label><label class="toggleRow"><input id="newPinned" type="checkbox">置顶展示</label><label class="toggleRow"><input id="newVisible" type="checkbox" checked>立即上架</label></div>
<label class="wide"><span>产品照片 *（第一张作为封面）</span><input id="newImage" type="file" accept="image/*" multiple></label>
</div><p class="hint">一次最多选择 20 张，第一张作为封面，其余作为细节图。支持 JPG / PNG / WEBP；HEIC 请先转成 JPG。</p><div class="toolbar"><button id="createProduct" class="primary">添加产品</button><button id="cancelAdd">取消</button></div></section>
<datalist id="categoryList"></datalist><datalist id="roomList"></datalist><datalist id="woodList"></datalist>
<input id="search" class="search" type="search" placeholder="搜索名称、编号、产品类型或木材"><div id="completenessSummary" class="completenessSummary"></div><p id="count"></p>
<div class="operations"><label class="toggleRow"><input id="selectVisible" type="checkbox">选择当前结果</label><select id="bulkField" aria-label="批量修改字段"><option value="category">批量改产品类型</option><option value="room">批量改空间</option><option value="wood">批量改木材</option></select><div class="bulkValueWrap"><input id="bulkValue" list="bulkValueList" maxlength="100" placeholder="输入或选择新的值"><datalist id="bulkValueList"></datalist></div><button id="applyBulk">应用到已选</button><button id="clearSelected">清空选择</button></div>
<section id="previewPanel" class="preview" hidden><h2>确认发布修改</h2><div id="changes"></div><div class="toolbar"><button id="publish" class="primary">确认发布</button><button id="cancelPreview">继续编辑</button></div></section>
<div id="products" class="products"></div>
</section>

<section id="tab-homepage" hidden><div class="panel"><h2>首页大图</h2><p>这里更换顾客打开网站后最先看到的大图。建议上传清晰横图，主体尽量放在画面中间，手机和电脑会自动裁切适配。</p><div class="heroAdminPreview"><img id="heroPreview" alt="当前首页大图"></div><p class="heroPath">当前图片：<span id="heroPath"></span></p><label><span>选择新的首页大图</span><input id="heroImageInput" type="file" accept="image/*"></label><p class="hint">支持 JPG / PNG / WEBP；上传后会压缩为适合网页的格式，并立即保存为首页大图。</p><div class="toolbar"><button id="saveHeroImage" class="primary">上传并更换首页大图</button></div></div></section>

<section id="tab-store" hidden><div class="panel"><h2>门店信息与微信分享</h2><p>这里填写准确门店信息和地图链接；未填写的营业时间、停车说明及导航按钮不会在顾客端虚构显示。</p><div class="grid"><label class="wide"><span>店铺准确地址 *</span><input id="storeAddress" maxlength="240" placeholder="请填写省、市、区县、道路、商场及楼层/门牌"></label><label><span>营业时间</span><input id="businessHours" maxlength="160" placeholder="例如：每天 9:00—18:00"></label><label><span>停车说明</span><input id="parkingInfo" maxlength="500" placeholder="例如：家具城院内可停车"></label><label><span>高德到店导航链接</span><input id="amapUrl" maxlength="700" inputmode="url" placeholder="粘贴高德地图分享链接（https://…）"></label><label><span>百度到店导航链接</span><input id="baiduUrl" maxlength="700" inputmode="url" placeholder="粘贴百度地图分享链接（https://…）"></label><label class="wide"><span>微信分享标题</span><input id="shareTitle" maxlength="120"></label><label class="wide"><span>微信分享简介</span><textarea id="shareDescription" maxlength="320"></textarea></label></div><div class="toolbar"><button id="saveStoreSettings" class="primary">保存门店与分享资料</button></div></div><div class="panel"><h2>微信分享缩略图</h2><div class="storePreview"><img id="shareImagePreview" class="shareAdminPreview" alt="当前微信分享缩略图"><div><p class="heroPath">当前图片：<span id="shareImagePath"></span></p><label><span>选择新的分享缩略图</span><input id="shareImageInput" type="file" accept="image/*"></label><p class="hint">建议横向 1.91:1，主体居中；产品和选品清单分享会优先使用产品封面，通用分享使用这张图。</p><div class="toolbar"><button id="saveShareImage" class="primary">上传并更换分享图</button></div></div></div></div></section>

<section id="tab-cases" hidden><div class="panel"><h2>全屋定制案例</h2><p>一个案例对应一张封面和一整组交付照片；顾客只会先看到封面。</p><div class="grid"><label><span>案例名称 *</span><input id="caseTitle" maxlength="80" placeholder="例如：北京朝阳 · 黑胡桃全屋"></label><label><span>案例标签</span><input id="caseTag" maxlength="80" placeholder="例如：全屋原木定制"></label><label class="wide"><span>案例简介</span><textarea id="caseSummary" maxlength="1600"></textarea></label><label><span>封面图 *</span><input id="caseCover" type="file" accept="image/*"></label><label><span>案例组图</span><input id="caseImages" type="file" accept="image/*" multiple></label></div><div class="toolbar"><button id="addCase" class="primary">添加案例</button></div></div><div id="caseList" class="products"></div></section>
<section id="tab-contacts" hidden><div class="panel"><h2>联系我们 · 人员管理</h2><p>销售和设计师会在顾客网站分成两个板块展示。姓名、个人照片及至少一种联系方式为必填。</p><div class="grid"><label><span>人员类型 *</span><select id="contactType"><option value="sales">店内销售</option><option value="designer">设计师</option></select></label><label><span>姓名 *</span><input id="contactName" maxlength="80" placeholder="例如：王经理"></label><label><span>职位 / 擅长方向</span><input id="contactTitle" maxlength="80" placeholder="例如：资深销售顾问"></label><label><span>电话</span><input id="contactPhone" maxlength="80" inputmode="tel"></label><label><span>微信</span><input id="contactWechat" maxlength="80"></label><label><span>个人照片 *</span><input id="contactImage" type="file" accept="image/*"></label><label class="wide"><span>个人简介</span><textarea id="contactBio" maxlength="500" placeholder="例如：负责到店选品、报价与交付沟通"></textarea></label></div><div class="toolbar"><button id="addContact" class="primary">添加联系人</button></div></div><div id="contactList" class="products"></div></section>
<section id="tab-woods" hidden><div class="panel"><h2>木材管理</h2><p>先在这里建立木材库。以后添加家具时直接从木材库里选。</p><div class="manageRow"><input id="woodInput" placeholder="例如：北美白橡"><button id="addWood" class="primary">添加木材</button></div><div id="woodChips" class="chips"></div></div></section>
<section id="tab-categories" hidden><div class="panel"><h2>产品类型管理</h2><p>例如：餐桌、餐椅、沙发、茶几、电视柜、床。</p><div class="manageRow"><input id="categoryInput" placeholder="例如：沙发"><button id="addCategory" class="primary">添加类型</button></div><div id="categoryChips" class="chips"></div></div></section>
<section id="tab-rooms" hidden><div class="panel"><h2>空间分类管理</h2><div class="manageRow"><input id="roomInput" placeholder="例如：书房"><button id="addRoom" class="primary">添加空间</button></div><div id="roomChips" class="chips"></div></div></section>
</section></main><script nonce="NONCE_VALUE">
'use strict';
const $=id=>document.getElementById(id);
const labels={name:'产品名称',brand:'产品归属',category:'产品类型',room:'空间',wood:'木材',size:'尺寸',desc:'产品说明',options:'可改项目',price:'价格 / 报价说明',availability:'现货 / 定制状态',leadTime:'预计周期',featured:'推荐产品',pinned:'置顶展示',visible:'上架状态',sortOrder:'展示顺序',image:'封面照片',images:'细节照片'};
const editFields=['brand','name','category','room','wood','size','price','availability','leadTime','desc','options'];
const trackedFields=[...editFields,'featured','pinned','visible','sortOrder','image','images'];
const limits={name:80,brand:20,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200,availability:80,leadTime:160};
const availabilityOptions=['待确认','现货','可定制','现货 · 支持定制','暂时缺货'];
const defaultSettings={heroImage:'products/showroom/home-hero.webp',shareImage:'products/showroom/home-hero.webp',woods:[],categories:[],rooms:[],storeAddress:'河北张家口怀来 · 华美家具城',businessHours:'',parkingInfo:'',amapUrl:'',baiduUrl:'',shareTitle:'青年老吴实木工厂店｜原木家具与全屋定制',shareDescription:'25年实体家具经验，自有工厂与实体展厅，服务京津冀及周边。'};
const maxProductImages=20;
let initial=[],draft=[],cases=[],contacts=[],settings={...defaultSettings},sha='',csrf='',busy=false,draggedId='',lastRenderedIds=[];
const selectedIds=new Set();

function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}
function status(text){$('status').textContent=text}
function setBusy(value){busy=value;document.querySelectorAll('button,input,textarea,select').forEach(node=>node.disabled=value)}
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},cache:'no-store'});let data={};try{data=await response.json()}catch{}if(response.status===401){$('loginBox').hidden=false;throw Error(data.error||'请登录')}if(!response.ok)throw Error(data.error||'操作失败');return data}
function imageSrc(path){return path&&path.startsWith('products/uploads/')?'/media/'+path:'https://qingnian-laowu.netlify.app/'+path}
function galleryOf(product){return [...new Set([product.image,...(Array.isArray(product.images)?product.images:[])].filter(Boolean))].slice(0,maxProductImages)}
function normalizeOrder(){draft.forEach((product,index)=>product.sortOrder=index+1)}
function productValueEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function changes(){return draft.flatMap(product=>{const original=initial.find(item=>item.id===product.id);if(!original)return[];const fields={};for(const key of trackedFields){const value=key==='images'?galleryOf(product).slice(1):product[key];const before=key==='images'?galleryOf(original).slice(1):original[key];if(!productValueEqual(value,before))fields[key]=value}return Object.keys(fields).length?[{id:product.id,fields}]:[]})}
function missingFields(product){const missing=[];if(galleryOf(product).length<2)missing.push('细节照片');if(!product.size)missing.push('尺寸');if(!product.price)missing.push('价格');if(!product.availability||product.availability==='待确认')missing.push('状态');if(!product.leadTime||product.leadTime==='请咨询门店')missing.push('周期');if(!product.options)missing.push('可改项目');if(!product.desc)missing.push('说明');return missing}
function renderSummary(){const incomplete=draft.filter(product=>missingFields(product).length);const hidden=draft.filter(product=>product.visible===false).length;const recommended=draft.filter(product=>product.featured===true).length;const pinned=draft.filter(product=>product.pinned===true).length;$('completenessSummary').replaceChildren(summaryCard('资料待补',incomplete.length+' 款'),summaryCard('置顶展示',pinned+' 款'),summaryCard('推荐产品',recommended+' 款'),summaryCard('已隐藏',hidden+' 款'))}
function summaryCard(label,value){const card=el('div');card.className='summaryCard';card.append(el('span',label),el('strong',value));return card}
function markDraft(message){$('previewPanel').hidden=true;renderSummary();status(message||'有 '+changes().length+' 个产品修改尚未发布。')}

function fillLists(){for(const [id,key] of [['woodList','woods'],['categoryList','categories'],['roomList','rooms']])$(id).replaceChildren(...settings[key].map(value=>{const option=el('option');option.value=value;return option}));updateBulkValues()}
function renderChips(id,key){const box=$(id);box.replaceChildren(...settings[key].map(value=>{const chip=el('span');chip.className='chip';chip.append(el('span',value));const button=el('button','×');button.title='删除 '+value;button.onclick=async()=>{if(!confirm('删除“'+value+'”？已有产品里的这个名称不会自动改。'))return;settings[key]=settings[key].filter(item=>item!==value);await saveSettings()};chip.append(button);return chip}))}
function renderSettings(){fillLists();renderChips('woodChips','woods');renderChips('categoryChips','categories');renderChips('roomChips','rooms');const hero=settings.heroImage||defaultSettings.heroImage,share=settings.shareImage||hero;$('heroPreview').src=imageSrc(hero);$('heroPath').textContent=hero;$('shareImagePreview').src=imageSrc(share);$('shareImagePath').textContent=share;for(const field of ['storeAddress','businessHours','parkingInfo','amapUrl','baiduUrl','shareTitle','shareDescription'])$(field).value=settings[field]||''}
async function persistSettings(successMessage){const data=await api('/admin/api/settings',{method:'POST',body:JSON.stringify({sha,settings})});sha=data.sha;settings={...defaultSettings,...data.settings};renderSettings();status(successMessage||data.message)}
async function saveSettings(){try{setBusy(true);await persistSettings()}catch(error){status(error.message)}finally{setBusy(false)}}
async function addSetting(key,input){const value=$(input).value.trim();if(!value)return;if(settings[key].includes(value)){status('这个名称已经存在。');return}settings[key]=[...settings[key],value];$(input).value='';await saveSettings()}

async function decodeImage(file){if(!file||!file.type.startsWith('image/'))throw Error('请选择图片文件。');if(typeof createImageBitmap!=='function')throw Error('当前浏览器不支持照片处理，请换 Chrome / Edge / Safari。');try{return await createImageBitmap(file)}catch{throw Error('这张照片无法读取。若是 HEIC，请先转成 JPG 再上传。')}}
async function fileToBase64(blob){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('照片读取失败'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob)})}
async function compressImage(file){const image=await decodeImage(file);let width=image.width,height=image.height,max=1600;if(Math.max(width,height)>max){const ratio=max/Math.max(width,height);width=Math.round(width*ratio);height=Math.round(height*ratio)}const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0,width,height);if(image.close)image.close();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));if(!blob)throw Error('照片处理失败');if(blob.size>1850000)throw Error('照片太大，请换一张或先压缩。');return{mime:'image/webp',base64:await fileToBase64(blob)}}
async function uploadImage(file){status('正在处理并上传照片…');const payload=await compressImage(file);const data=await api('/admin/api/image',{method:'POST',body:JSON.stringify(payload)});return data.path}
async function uploadMany(files){const paths=[];for(let index=0;index<files.length;index++){status('正在处理并上传第 '+(index+1)+' / '+files.length+' 张照片…');paths.push(await uploadImage(files[index]))}return paths}

function updateBulkValues(){const field=$('bulkField').value,key=field==='category'?'categories':field==='room'?'rooms':'woods';$('bulkValueList').replaceChildren(...settings[key].map(value=>{const option=el('option');option.value=value;return option}))}
function moveProduct(sourceId,targetId){if(!sourceId||sourceId===targetId)return;const from=draft.findIndex(product=>product.id===sourceId),to=draft.findIndex(product=>product.id===targetId);if(from<0||to<0)return;const [item]=draft.splice(from,1);draft.splice(to,0,item);normalizeOrder();render();markDraft('产品顺序已调整，请预览并发布。')}
function moveBy(product,delta){const index=draft.findIndex(item=>item.id===product.id),next=Math.max(0,Math.min(draft.length-1,index+delta));if(index===next)return;const [item]=draft.splice(index,1);draft.splice(next,0,item);normalizeOrder();render();markDraft('产品顺序已调整，请预览并发布。')}
function makeField(product,key){const wrap=el('label');if(['desc','options','price'].includes(key))wrap.className='wide';wrap.append(el('span',labels[key]));let input;if(key==='brand'||key==='availability'){input=el('select');const values=key==='brand'?['原木家具','皇玛康之家','文创产品']:[...availabilityOptions];if(product[key]&&!values.includes(product[key]))values.unshift(product[key]);for(const value of values){const option=el('option',value);option.value=value;input.append(option)}}else input=el(key==='desc'?'textarea':'input');input.maxLength=limits[key]||200;if(key==='wood')input.setAttribute('list','woodList');if(key==='category')input.setAttribute('list','categoryList');if(key==='room')input.setAttribute('list','roomList');input.value=product[key]||(key==='brand'?'原木家具':'');const update=()=>{product[key]=input.value;markDraft()};input.oninput=update;input.onchange=update;wrap.append(input);return wrap}
function makeProductCard(product){const gallery=galleryOf(product);product.images=gallery.slice(1);const card=el('article');card.className='product';card.dataset.id=product.id;
 const left=el('div');const selectLabel=el('label');selectLabel.className='productSelect';const select=el('input');select.type='checkbox';select.checked=selectedIds.has(product.id);select.onchange=()=>{select.checked?selectedIds.add(product.id):selectedIds.delete(product.id)};selectLabel.append(select,document.createTextNode('选择此产品'));left.append(selectLabel);
 const meta=el('div');meta.className='productMeta';const missing=missingFields(product);if(product.pinned)meta.append(badge('已置顶'));meta.append(badge(product.featured?'店主推荐':'普通展示'),badge(product.visible===false?'已隐藏':'已上架',product.visible===false?'hiddenProduct':''),badge(missing.length?'待补：'+missing.join('、'):'资料完整',missing.length?'warn':''));left.append(meta);
 const image=el('img');image.className='productCover';if(product.image)image.src=imageSrc(product.image);image.alt=product.name+' 封面';left.append(image,el('div',product.id+' · '+gallery.length+' 张照片'));
 const orderTools=el('div');orderTools.className='orderTools';const handle=el('button','↕ 拖动排序');handle.className='dragHandle';handle.draggable=true;handle.ondragstart=event=>{draggedId=product.id;card.classList.add('dragging');event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',product.id)};handle.ondragend=()=>{draggedId='';document.querySelectorAll('.product').forEach(node=>node.classList.remove('dragging','dragTarget'))};const up=el('button','↑ 上移');up.onclick=()=>moveBy(product,-1);const down=el('button','↓ 下移');down.onclick=()=>moveBy(product,1);orderTools.append(handle,up,down);left.append(orderTools);
 card.ondragover=event=>{if(!draggedId)return;event.preventDefault();card.classList.add('dragTarget')};card.ondragleave=()=>card.classList.remove('dragTarget');card.ondrop=event=>{event.preventDefault();card.classList.remove('dragTarget');moveProduct(draggedId,product.id)};
 const thumbs=el('div');thumbs.className='photoGallery';gallery.forEach((path,index)=>{const item=el('div');item.className='photoThumb'+(index===0?' cover':'');const thumb=el('img');thumb.src=imageSrc(path);thumb.alt=product.name+' 第 '+(index+1)+' 张';item.append(thumb);if(index===0)item.append(el('span','封面'));const tools=el('div');tools.className='thumbTools';if(index>0){const cover=el('button','设封面');cover.onclick=()=>{const reordered=[path,...gallery.filter(value=>value!==path)];product.image=reordered[0];product.images=reordered.slice(1);render();markDraft('已调整封面，请预览并发布。')};tools.append(cover)}if(gallery.length>1){const remove=el('button','删除');remove.className='danger';remove.onclick=()=>{if(!confirm('从这个产品中移除这张照片？'))return;const next=gallery.filter(value=>value!==path);product.image=next[0];product.images=next.slice(1);render();markDraft('照片已移除，请预览并发布。')};tools.append(remove)}item.append(tools);thumbs.append(item)});left.append(thumbs);
 const photoActions=el('div');photoActions.className='photoActions';const replaceLabel=el('span','替换封面');replaceLabel.className='photoLabel';const replace=el('input');replace.type='file';replace.accept='image/*';replace.onchange=async()=>{const file=replace.files&&replace.files[0];if(!file)return;try{setBusy(true);product.image=await uploadImage(file);product.images=galleryOf(product).slice(1);render();markDraft('新封面已上传，请预览并发布。')}catch(error){status(error.message)}finally{setBusy(false)}};const addLabel=el('span','追加细节照片（总计最多 20 张）');addLabel.className='photoLabel';const add=el('input');add.type='file';add.accept='image/*';add.multiple=true;add.onchange=async()=>{const files=[...(add.files||[])],available=maxProductImages-galleryOf(product).length;if(!files.length)return;if(available<1){status('这个产品已经有 20 张照片。');return}try{setBusy(true);const paths=await uploadMany(files.slice(0,available));product.images=[...new Set([...galleryOf(product).slice(1),...paths])];render();markDraft(files.length>available?'已上传可容纳的 '+available+' 张照片。':'细节照片已上传，请预览并发布。')}catch(error){status(error.message)}finally{setBusy(false)}};const del=el('button','删除产品');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除“'+product.name+'”？'))return;try{setBusy(true);const data=await api('/admin/api/product/delete',{method:'POST',body:JSON.stringify({sha,id:product.id})});setProductData(data.products);settings={...defaultSettings,...(data.settings||settings)};sha=data.sha;render();renderSettings();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};photoActions.append(replaceLabel,replace,addLabel,add,del);left.append(photoActions);
 const fields=el('div');fields.className='fields';for(const key of editFields)fields.append(makeField(product,key));const toggles=el('div');toggles.className='toggleFields';for(const [key,label] of [['pinned','置顶展示'],['featured','设为推荐产品'],['visible','顾客端上架显示']]){const row=el('label');row.className='toggleRow';const input=el('input');input.type='checkbox';input.checked=product[key]===true;input.onchange=()=>{product[key]=input.checked;render();markDraft()};row.append(input,document.createTextNode(label));toggles.append(row)}fields.append(toggles);card.append(left,fields);return card}
function badge(text,extra){const node=el('span',text);node.className='miniBadge'+(extra?' '+extra:'');return node}
function render(){fillLists();const query=$('search').value.trim().toLowerCase();const list=draft.filter(product=>[product.id,product.brand,product.name,product.category,product.room,product.wood,product.availability].join(' ').toLowerCase().includes(query));lastRenderedIds=list.map(product=>product.id);$('products').replaceChildren(...list.map(makeProductCard));$('count').textContent=list.length+' 个产品 · 已选择 '+[...selectedIds].filter(id=>draft.some(product=>product.id===id)).length+' 个';$('selectVisible').checked=!!list.length&&list.every(product=>selectedIds.has(product.id));renderSummary()}
function setProductData(products){initial=(products||[]).slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));draft=structuredClone(initial);selectedIds.clear()}
async function load(){try{status('正在读取资料…');const data=await api('/admin/api/catalog');csrf=data.csrf;setProductData(data.products);cases=data.cases||[];contacts=data.contacts||[];settings={...defaultSettings,...(data.settings||{})};sha=data.sha;render();renderCasesAdmin();renderContactsAdmin();renderSettings();$('editor').hidden=false;$('loginBox').hidden=true;status('资料已加载。')}catch(error){status(error.message)}}

document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(item=>item.classList.toggle('active',item===button));for(const name of ['products','homepage','store','cases','contacts','woods','categories','rooms'])$('tab-'+name).hidden=button.dataset.tab!==name});
$('addWood').onclick=()=>addSetting('woods','woodInput');$('addCategory').onclick=()=>addSetting('categories','categoryInput');$('addRoom').onclick=()=>addSetting('rooms','roomInput');
function renderCasesAdmin(){const box=$('caseList');box.replaceChildren(...cases.map(item=>{const card=el('article');card.className='product';const left=el('div');const image=el('img');if(item.cover)image.src=imageSrc(item.cover);left.append(image,el('div',item.id));const right=el('div');right.append(el('h2',item.title),el('p',item.summary||''),el('p','组图 '+((item.images||[]).length)+' 张'));const del=el('button','删除案例');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除这个全屋案例？'))return;try{setBusy(true);const data=await api('/admin/api/case/delete',{method:'POST',body:JSON.stringify({sha,id:item.id})});cases=data.cases||[];sha=data.sha;renderCasesAdmin();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};right.append(del);card.append(left,right);return card}))}
function renderContactsAdmin(){const box=$('contactList');box.replaceChildren(...contacts.map(contact=>{const card=el('article');card.className='product';const left=el('div');const image=el('img');if(contact.image)image.src=imageSrc(contact.image);image.alt=contact.name+'个人照片';left.append(image,el('div',contact.id));const right=el('div');right.append(el('h2',(contact.type==='designer'?'设计师 · ':'销售 · ')+contact.name),el('p',contact.title||'未填写职位'),el('p','电话：'+(contact.phone||'未填写')+'　微信：'+(contact.wechat||'未填写')));if(contact.bio)right.append(el('p',contact.bio));const del=el('button','删除联系人');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除“'+contact.name+'”？'))return;try{setBusy(true);const data=await api('/admin/api/contact/delete',{method:'POST',body:JSON.stringify({sha,id:contact.id})});contacts=data.contacts||[];sha=data.sha;renderContactsAdmin();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};right.append(del);card.append(left,right);return card}))}

$('saveHeroImage').onclick=async()=>{const file=$('heroImageInput').files&&$('heroImageInput').files[0];if(!file){status('请先选择一张新的首页大图。');return}try{setBusy(true);settings.heroImage=await uploadImage(file);$('heroImageInput').value='';await persistSettings('首页大图已更换，顾客刷新网站即可看到。')}catch(error){status(error.message)}finally{setBusy(false)}};
$('saveShareImage').onclick=async()=>{const file=$('shareImageInput').files&&$('shareImageInput').files[0];if(!file){status('请先选择一张新的微信分享缩略图。');return}try{setBusy(true);settings.shareImage=await uploadImage(file);$('shareImageInput').value='';await persistSettings('微信分享缩略图已更换。')}catch(error){status(error.message)}finally{setBusy(false)}};
$('saveStoreSettings').onclick=async()=>{for(const field of ['storeAddress','businessHours','parkingInfo','amapUrl','baiduUrl','shareTitle','shareDescription'])settings[field]=$(field).value.trim();if(!settings.storeAddress){status('请填写店铺准确地址。');return}try{setBusy(true);await persistSettings('门店信息和微信分享资料已保存。')}catch(error){status(error.message)}finally{setBusy(false)}};

$('addCase').onclick=async()=>{const cover=$('caseCover').files&&$('caseCover').files[0],gallery=[...($('caseImages').files||[])],title=$('caseTitle').value.trim();if(!title||!cover){status('请填写案例名称并选择封面图。');return}try{setBusy(true);const coverPath=await uploadImage(cover);const images=await uploadMany(gallery.slice(0,30));const data=await api('/admin/api/case/add',{method:'POST',body:JSON.stringify({sha,case:{title,tag:$('caseTag').value.trim()||'全屋定制',summary:$('caseSummary').value.trim(),cover:coverPath,images}})});cases=data.cases||[];sha=data.sha;$('caseTitle').value=$('caseTag').value=$('caseSummary').value='';$('caseCover').value=$('caseImages').value='';renderCasesAdmin();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};
$('addContact').onclick=async()=>{const image=$('contactImage').files&&$('contactImage').files[0],name=$('contactName').value.trim(),phone=$('contactPhone').value.trim(),wechat=$('contactWechat').value.trim();if(!name||!image||(!phone&&!wechat)){status('请填写姓名和至少一种联系方式，并选择个人照片。');return}try{setBusy(true);const imagePath=await uploadImage(image);const contact={type:$('contactType').value,name,title:$('contactTitle').value.trim(),phone,wechat,bio:$('contactBio').value.trim(),image:imagePath};const data=await api('/admin/api/contact/add',{method:'POST',body:JSON.stringify({sha,contact})});contacts=data.contacts||[];sha=data.sha;for(const id of ['contactName','contactTitle','contactPhone','contactWechat','contactBio'])$(id).value='';$('contactImage').value='';renderContactsAdmin();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};

$('toggleAdd').onclick=()=>{$('addPanel').hidden=!$('addPanel').hidden};$('cancelAdd').onclick=()=>$('addPanel').hidden=true;$('search').oninput=render;
$('selectVisible').onchange=()=>{for(const id of lastRenderedIds)$('selectVisible').checked?selectedIds.add(id):selectedIds.delete(id);render()};
$('bulkField').onchange=updateBulkValues;
$('applyBulk').onclick=()=>{const field=$('bulkField').value,value=$('bulkValue').value.trim(),chosen=draft.filter(product=>selectedIds.has(product.id));if(!chosen.length){status('请先勾选要批量修改的产品。');return}if(!value){status('请输入批量修改后的内容。');return}for(const product of chosen)product[field]=value;$('bulkValue').value='';render();markDraft('已批量修改 '+chosen.length+' 个产品，请预览并发布。')};
$('clearSelected').onclick=()=>{selectedIds.clear();render()};
$('createProduct').onclick=async()=>{const files=[...($('newImage').files||[])];const product={brand:$('newBrand').value,name:$('newName').value.trim(),category:$('newCategory').value.trim(),room:$('newRoom').value.trim()||'其他',wood:$('newWood').value.trim(),size:$('newSize').value.trim(),price:$('newPrice').value.trim(),availability:$('newAvailability').value,leadTime:$('newLeadTime').value.trim()||'请咨询门店',desc:$('newDesc').value.trim(),options:$('newOptions').value.trim(),featured:$('newFeatured').checked,pinned:$('newPinned').checked,visible:$('newVisible').checked,real:true};if(!product.name||!product.category||!product.wood||!files.length){status('请填写产品名称、产品类型、木材，并选择至少一张照片。');return}if(files.length>maxProductImages){status('每个产品最多上传 20 张照片，请减少后再试。');return}try{setBusy(true);const paths=await uploadMany(files);product.image=paths[0];product.images=paths.slice(1);const data=await api('/admin/api/product/add',{method:'POST',body:JSON.stringify({sha,product})});setProductData(data.products);settings={...defaultSettings,...(data.settings||settings)};sha=data.sha;for(const id of ['newName','newCategory','newRoom','newWood','newSize','newPrice','newLeadTime','newDesc','newOptions'])$(id).value='';$('newAvailability').value='待确认';$('newFeatured').checked=false;$('newPinned').checked=false;$('newVisible').checked=true;$('newImage').value='';$('addPanel').hidden=true;render();renderSettings();status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};
$('preview').onclick=()=>{const edits=changes();if(!edits.length){status('还没有修改。');return}$('changes').replaceChildren(...edits.map(change=>{const item=el('div');item.append(el('strong',change.id));for(const [key,value] of Object.entries(change.fields)){const shown=Array.isArray(value)?value.length+' 张':typeof value==='boolean'?(value?'是':'否'):String(value);item.append(el('p',(labels[key]||key)+'：'+shown))}return item}));$('previewPanel').hidden=false};
$('cancelPreview').onclick=()=>$('previewPanel').hidden=true;
$('publish').onclick=async()=>{const edits=changes();if(!edits.length){status('还没有修改。');return}try{setBusy(true);const data=await api('/admin/api/catalog',{method:'POST',body:JSON.stringify({sha,changes:edits})});setProductData(data.products);settings={...defaultSettings,...(data.settings||settings)};sha=data.sha;render();renderSettings();$('previewPanel').hidden=true;status(data.message)}catch(error){status(error.message)}finally{setBusy(false)}};
$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(error){status(error.message)}};$('resume').onclick=load;load();
</script></body></html>`;

export default async function handler(request) {
 return worker.fetch(request, {GITHUB_CLIENT_ID:process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET:process.env.GITHUB_CLIENT_SECRET});
}
export const config = {path: ['/admin', '/admin/*']};

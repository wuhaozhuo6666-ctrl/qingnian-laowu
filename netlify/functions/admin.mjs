import { webcrypto as crypto } from 'node:crypto';
const ORIGIN = 'https://qingnian-laowu.netlify.app';
const REPO = 'wuhaozhuo6666-ctrl/qingnian-laowu';
const OWNER_ID = 327517365;
const FILE = '/repos/' + REPO + '/contents/products/catalog.json';
const LIMITS = {name:80,brand:20,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200,image:260};
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
async function readCatalog(token){const file=await github(FILE+'?ref=main',token);const data=JSON.parse(dec.decode(un64(file.content.replace(/\s/g,''))));if(!Array.isArray(data.products))throw Error('Invalid catalog');const settings=data.settings&&typeof data.settings==='object'?data.settings:{};return {sha:file.sha,products:data.products.map(p=>({brand:p.brand||'原木家具',...p})),cases:Array.isArray(data.cases)?data.cases:[],settings:{woods:Array.isArray(settings.woods)?settings.woods:[],categories:Array.isArray(settings.categories)?settings.categories:[],rooms:Array.isArray(settings.rooms)?settings.rooms:[]}};}
async function writeCatalog(token,sha,products,settings,cases,message){
 const bytes=enc.encode(JSON.stringify({products,cases,settings},null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const result=await github(FILE,token,{method:'PUT',body:JSON.stringify({branch:'main',sha,message,content:btoa(binary)})});
 return {sha:result.content.sha,products,cases,settings};
}
function cleanText(value,field){if(typeof value!=='string')return '';const v=value.trim();if(v.length>(LIMITS[field]||400)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Invalid field');return v;}
function validImagePath(value){return typeof value==='string'&&/^products\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(value);}

function applyChanges(products,changes){if(!Array.isArray(changes)||changes.length>500)throw Error('Invalid changes');const next=products.map(p=>({...p,images:Array.isArray(p.images)?[...p.images]:[]}));const seen=new Set();for(const change of changes){if(!change||typeof change.id!=='string'||seen.has(change.id))throw Error('Invalid product');seen.add(change.id);const p=next.find(p=>p.id===change.id);if(!p||!change.fields||typeof change.fields!=='object'||Array.isArray(change.fields))throw Error('Invalid product');for(const [field,value] of Object.entries(change.fields)){if(field==='images'){if(!Array.isArray(value)||value.length>=MAX_PRODUCT_IMAGES||value.some(path=>!validImagePath(path)))throw Error('Invalid images');p.images=[...new Set(value)].filter(path=>path!==p.image);continue}if(!Object.hasOwn(LIMITS,field)||typeof value!=='string'||value.length>LIMITS[field]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('Invalid field');if(field==='name'&&!value.trim())throw Error('Name required');if(field==='image'&&!validImagePath(value.trim()))throw Error('Invalid image');p[field]=value.trim();}p.images=[...new Set((p.images||[]).filter(path=>path!==p.image))].slice(0,MAX_PRODUCT_IMAGES-1);}return next;}
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
   const result=await writeCatalog(session.token,current.sha,products,current.settings,current.cases,'Update product details from store admin');return reply({...result,message:'资料已保存，顾客网站正在自动更新，请稍后查看。'});
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
   const p=data.product||{};const name=cleanText(p.name,'name'),brand=cleanText(p.brand||'原木家具','brand'),category=cleanText(p.category,'category'),room=cleanText(p.room||'其他','room'),wood=cleanText(p.wood,'wood'),size=cleanText(p.size,'size'),desc=cleanText(p.desc,'desc'),options=cleanText(p.options,'options'),price=cleanText(p.price||'','price'),image=cleanText(p.image,'image');const images=Array.isArray(p.images)?p.images:[];
   if(!name||!category||!wood||!validImagePath(image)||images.length>=MAX_PRODUCT_IMAGES||images.some(path=>!validImagePath(path)))return reply({error:'请填写产品名称、产品类型、木材，并上传有效照片。'},400);
   const id='LW-'+Date.now().toString(36).toUpperCase();
   const product={id,name,brand:['原木家具','皇玛康之家','文创产品'].includes(brand)?brand:'原木家具',category,room,wood,size,image,images:[...new Set(images)].filter(path=>path!==image).slice(0,MAX_PRODUCT_IMAGES-1),real:p.real!==false,options,desc};if(price)product.price=price;
   const result=await writeCatalog(session.token,current.sha,[product,...current.products],current.settings,current.cases,'Add product from store admin');
   return reply({...result,message:'新产品已加入，顾客网站正在自动更新。'});
  }
  if(url.pathname==='/admin/api/product/delete'&&request.method==='POST'){
   let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);
   if(typeof data.id!=='string'||!current.products.some(p=>p.id===data.id))return reply({error:'找不到这个产品。'},404);
   const result=await writeCatalog(session.token,current.sha,current.products.filter(p=>p.id!==data.id),current.settings,current.cases,'Delete product from store admin');
   return reply({...result,message:'产品已删除，顾客网站正在自动更新。'});
  }

  if(url.pathname==='/admin/api/case/add'&&request.method==='POST'){let data;try{data=await request.json();}catch{return reply({error:'案例数据格式错误。'},400);}const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再添加案例。'},409);const c=data.case||{},title=cleanText(c.title||'','name'),summary=cleanText(c.summary||'','desc'),tag=cleanText(c.tag||'全屋定制','category'),cover=cleanText(c.cover||'','image');const images=Array.isArray(c.images)?c.images.filter(validImagePath).slice(0,30):[];if(!title||!validImagePath(cover))return reply({error:'请填写案例名称并上传封面图。'},400);const item={id:'CASE-'+Date.now().toString(36).toUpperCase(),title,summary,tag,cover,images};const result=await writeCatalog(session.token,current.sha,current.products,current.settings,[item,...current.cases],'Add whole-home case from store admin');return reply({...result,message:'全屋案例已添加，顾客网站会实时读取。'});}
  if(url.pathname==='/admin/api/case/delete'&&request.method==='POST'){let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);if(typeof data.id!=='string'||!current.cases.some(c=>c.id===data.id))return reply({error:'找不到这个案例。'},404);const result=await writeCatalog(session.token,current.sha,current.products,current.settings,current.cases.filter(c=>c.id!==data.id),'Delete whole-home case from store admin');return reply({...result,message:'案例已删除。'});}

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
   const result=await writeCatalog(session.token,current.sha,current.products,out,current.cases,'Update catalog settings from store admin');
   return reply({...result,message:'分类设置已保存，顾客网站正在自动更新。'});
  }
  return reply({error:'不支持的操作。'},405);
 }catch(error){return reply({error:error.status===401?'登录已过期，请重新登录；未发布的修改仍保留在页面中。':error.status===409||error.status===422?'发生版本冲突，未覆盖现有资料。请保留修改后重新加载。':'服务暂时不可用，请稍后重试。'},error.status===401?401:error.status===409||error.status===422?409:502);}
}};
const ADMIN = String.raw`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青年老吴 · 店主管理</title><style nonce="NONCE_VALUE">
*{box-sizing:border-box}body{margin:0;background:#f5f2ea;color:#24372e;font:15px/1.55 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1180px;margin:auto;padding:20px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1px solid #d7ddd0}h1{margin:0;font-size:25px}h2{margin:0 0 14px;font-size:20px}p{color:#647066}a{color:#2f513f}button{font:inherit;cursor:pointer;border:1px solid #bcc5b8;background:#fff;border-radius:9px;padding:10px 15px;color:#24372e}.primary{background:#2f513f;color:#fff;border-color:#2f513f}.danger{color:#8e3027}.tabs{display:flex;gap:8px;overflow:auto;padding:18px 0 8px}.tabs button{white-space:nowrap}.tabs button.active{background:#2f513f;color:#fff;border-color:#2f513f}.status{min-height:44px;padding:10px 0;color:#46584e}.panel{background:#fffef9;border:1px solid #d9dfd3;border-radius:14px;padding:18px;margin:12px 0}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.wide{grid-column:1/-1}label span{display:block;margin-bottom:5px}input,textarea,select{width:100%;font:inherit;border:1px solid #aeb9aa;border-radius:8px;padding:10px;background:#fff;color:#24372e}textarea{min-height:100px}.search{margin:14px 0}.products{display:grid;gap:14px}.product{display:grid;grid-template-columns:230px 1fr;gap:18px;background:#fffef9;border:1px solid #d9dfd3;border-radius:14px;padding:16px}.product>div>img{width:100%;height:190px;object-fit:cover;border-radius:9px;background:#ecebe4}.fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}.photoActions{display:grid;gap:8px;margin-top:9px}.photoActions input{font-size:13px;padding:7px}.photoLabel{display:block;margin-top:10px;font-size:12px;color:#647066}.photoGallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.photoThumb{position:relative;min-width:0}.photoThumb img{display:block;width:100%;height:66px;object-fit:cover;border:2px solid transparent;border-radius:7px;background:#ecebe4}.photoThumb.cover img{border-color:#2f513f}.photoThumb span{position:absolute;left:3px;top:3px;padding:1px 4px;border-radius:4px;background:#2f513fe8;color:#fff;font-size:9px}.photoThumb .thumbTools{display:flex;gap:3px;margin-top:3px}.photoThumb button{min-width:0;flex:1;padding:3px 2px;border-radius:5px;font-size:10px}.chips{display:flex;flex-wrap:wrap;gap:9px}.chip{display:flex;align-items:center;gap:8px;border:1px solid #cbd3c6;background:#fff;border-radius:999px;padding:7px 8px 7px 13px}.chip button{padding:2px 8px;border:0;background:transparent;color:#8e3027}.manageRow{display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px}.hint{font-size:13px;color:#68746b}.loginbox{padding:28px 0}.preview{background:#fff;border:1px solid #b9c5b4;border-radius:12px;padding:16px;margin:14px 0}[hidden]{display:none!important}@media(max-width:720px){main{padding:13px}.product{grid-template-columns:1fr}.product>div>img{height:220px}.grid,.fields{grid-template-columns:1fr}.wide{grid-column:auto}header{align-items:flex-start;flex-direction:column}.tabs{position:sticky;top:0;background:#f5f2ea;z-index:5}.photoGallery{grid-template-columns:repeat(4,minmax(0,1fr))}}
</style></head><body><main><header><div><h1>青年老吴 · 店主管理</h1><div class="hint">产品、照片、木材、产品类型都可以单独管理</div></div><a href="https://qingnian-laowu.netlify.app/" target="_blank" rel="noopener">查看顾客网站 ↗</a></header><div id="status" class="status"></div>
<section id="loginBox" class="loginbox" hidden><p>请使用店主 GitHub 账号登录。</p><a href="/admin/login" target="_blank" rel="noopener"><button class="primary">使用 GitHub 登录</button></a><button id="resume">登录后继续</button></section>
<section id="editor" hidden>
<nav class="tabs"><button data-tab="products" class="active">产品管理</button><button data-tab="cases">全屋案例</button><button data-tab="woods">木材管理</button><button data-tab="categories">产品类型</button><button data-tab="rooms">空间分类</button></nav>

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
<label class="wide"><span>产品说明</span><textarea id="newDesc" maxlength="1600"></textarea></label>
<label class="wide"><span>可定制项目</span><input id="newOptions" maxlength="400"></label>
<label class="wide"><span>产品照片 *（第一张作为封面）</span><input id="newImage" type="file" accept="image/*" multiple></label>
</div><p class="hint">一次最多选择 20 张，第一张作为封面，其余作为细节图。支持 JPG / PNG / WEBP；HEIC 请先转成 JPG。</p><div class="toolbar"><button id="createProduct" class="primary">添加产品</button><button id="cancelAdd">取消</button></div></section>
<datalist id="categoryList"></datalist><datalist id="roomList"></datalist><datalist id="woodList"></datalist>
<input id="search" class="search" type="search" placeholder="搜索名称、编号、产品类型或木材"><p id="count"></p>
<section id="previewPanel" class="preview" hidden><h2>确认发布修改</h2><div id="changes"></div><div class="toolbar"><button id="publish" class="primary">确认发布</button><button id="cancelPreview">继续编辑</button></div></section>
<div id="products" class="products"></div>
</section>

<section id="tab-cases" hidden><div class="panel"><h2>全屋定制案例</h2><p>一个案例对应一张封面和一整组交付照片；顾客只会先看到封面。</p><div class="grid"><label><span>案例名称 *</span><input id="caseTitle" maxlength="80" placeholder="例如：北京朝阳 · 黑胡桃全屋"></label><label><span>案例标签</span><input id="caseTag" maxlength="80" placeholder="例如：全屋原木定制"></label><label class="wide"><span>案例简介</span><textarea id="caseSummary" maxlength="1600"></textarea></label><label><span>封面图 *</span><input id="caseCover" type="file" accept="image/*"></label><label><span>案例组图</span><input id="caseImages" type="file" accept="image/*" multiple></label></div><div class="toolbar"><button id="addCase" class="primary">添加案例</button></div></div><div id="caseList" class="products"></div></section>
<section id="tab-woods" hidden><div class="panel"><h2>木材管理</h2><p>先在这里建立木材库。以后添加家具时直接从木材库里选。</p><div class="manageRow"><input id="woodInput" placeholder="例如：北美白橡"><button id="addWood" class="primary">添加木材</button></div><div id="woodChips" class="chips"></div></div></section>
<section id="tab-categories" hidden><div class="panel"><h2>产品类型管理</h2><p>例如：餐桌、餐椅、沙发、茶几、电视柜、床。</p><div class="manageRow"><input id="categoryInput" placeholder="例如：沙发"><button id="addCategory" class="primary">添加类型</button></div><div id="categoryChips" class="chips"></div></div></section>
<section id="tab-rooms" hidden><div class="panel"><h2>空间分类管理</h2><div class="manageRow"><input id="roomInput" placeholder="例如：书房"><button id="addRoom" class="primary">添加空间</button></div><div id="roomChips" class="chips"></div></div></section>
</section></main><script nonce="NONCE_VALUE">
'use strict';const $=id=>document.getElementById(id);const labels={name:'产品名称',brand:'产品归属',category:'产品类型',room:'空间',wood:'木材',size:'尺寸',desc:'产品说明',options:'可定制项目',price:'价格 / 报价说明',image:'封面照片',images:'细节照片'};const editFields=['brand','name','category','room','wood','size','desc','options','price'];const limits={name:80,brand:20,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200};const maxProductImages=20;let initial=[],draft=[],cases=[],settings={woods:[],categories:[],rooms:[]},sha='',csrf='',busy=false;
function el(t,x){const e=document.createElement(t);if(x!==undefined)e.textContent=x;return e}function status(x){$('status').textContent=x}function setBusy(v){busy=v;document.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=v)}
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},cache:'no-store'});let d={};try{d=await r.json()}catch{}if(r.status===401){$('loginBox').hidden=false;throw Error(d.error||'请登录')}if(!r.ok)throw Error(d.error||'操作失败');return d}
function imageSrc(path){return path&&path.startsWith('products/uploads/')?'/media/'+path:'https://qingnian-laowu.netlify.app/'+path}
function galleryOf(p){return [...new Set([p.image,...(Array.isArray(p.images)?p.images:[])].filter(Boolean))].slice(0,maxProductImages)}
function markDraft(message){$('previewPanel').hidden=true;status(message||'有 '+changes().length+' 个产品修改尚未发布。')}
function changes(){return draft.flatMap(p=>{const o=initial.find(x=>x.id===p.id);if(!o)return[];const f={};for(const k of Object.keys(labels)){if(k==='images'){const value=galleryOf(p).slice(1),before=galleryOf(o).slice(1);if(JSON.stringify(value)!==JSON.stringify(before))f.images=value}else if((p[k]||'')!==(o[k]||''))f[k]=p[k]||''}return Object.keys(f).length?[{id:p.id,fields:f}]:[]})}
function fillLists(){for(const [id,key] of [['woodList','woods'],['categoryList','categories'],['roomList','rooms']]){$(id).replaceChildren(...settings[key].map(v=>{const o=el('option');o.value=v;return o}))}}
function renderChips(id,key){const box=$(id);box.replaceChildren(...settings[key].map(v=>{const c=el('span');c.className='chip';c.append(el('span',v));const b=el('button','×');b.title='删除 '+v;b.onclick=async()=>{if(!confirm('删除“'+v+'”？已有产品里的这个名称不会自动改。'))return;settings[key]=settings[key].filter(x=>x!==v);await saveSettings()};c.append(b);return c}))}
function renderSettings(){fillLists();renderChips('woodChips','woods');renderChips('categoryChips','categories');renderChips('roomChips','rooms')}
async function saveSettings(){try{setBusy(true);const d=await api('/admin/api/settings',{method:'POST',body:JSON.stringify({sha,settings})});sha=d.sha;settings=d.settings;renderSettings();status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}}
async function addSetting(key,input){const v=$(input).value.trim();if(!v)return;if(settings[key].includes(v)){status('这个名称已经存在。');return}settings[key]=[...settings[key],v];$(input).value='';await saveSettings()}
async function decodeImage(file){if(!file||!file.type.startsWith('image/'))throw Error('请选择图片文件。');if(typeof createImageBitmap!=='function')throw Error('当前浏览器不支持照片处理，请换 Chrome / Edge / Safari。');try{return await createImageBitmap(file)}catch{throw Error('这张照片无法读取。若是 HEIC，请先转成 JPG 再上传。')}}
async function fileToBase64(blob){return await new Promise((res,rej)=>{const r=new FileReader();r.onerror=()=>rej(Error('照片读取失败'));r.onload=()=>res(String(r.result).split(',')[1]);r.readAsDataURL(blob)})}
async function compressImage(file){const img=await decodeImage(file);let w=img.width,h=img.height,max=1600;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);if(img.close)img.close();const blob=await new Promise(r=>c.toBlob(r,'image/webp',.84));if(!blob)throw Error('照片处理失败');if(blob.size>1850000)throw Error('照片太大，请换一张或先压缩。');return{mime:'image/webp',base64:await fileToBase64(blob)}}
async function uploadImage(file){status('正在处理并上传照片…');const p=await compressImage(file);const d=await api('/admin/api/image',{method:'POST',body:JSON.stringify(p)});return d.path}
function render(){
 fillLists();const q=$('search').value.trim().toLowerCase();const list=draft.filter(p=>[p.id,p.brand,p.name,p.category,p.room,p.wood].join(' ').toLowerCase().includes(q));$('products').replaceChildren();$('count').textContent=list.length+' 个产品';
 for(const p of list){
  const gallery=galleryOf(p);p.images=gallery.slice(1);
  const card=el('article');card.className='product';const left=el('div');
  const img=el('img');img.className='productCover';if(p.image)img.src=imageSrc(p.image);img.alt=p.name+' 封面';left.append(img,el('div',p.id+' · '+gallery.length+' 张照片'));
  const thumbs=el('div');thumbs.className='photoGallery';
  gallery.forEach((path,index)=>{const item=el('div');item.className='photoThumb'+(index===0?' cover':'');const thumb=el('img');thumb.src=imageSrc(path);thumb.alt=p.name+' 第 '+(index+1)+' 张';item.append(thumb);if(index===0)item.append(el('span','封面'));const tools=el('div');tools.className='thumbTools';if(index>0){const cover=el('button','设封面');cover.onclick=()=>{const reordered=[path,...gallery.filter(x=>x!==path)];p.image=reordered[0];p.images=reordered.slice(1);render();markDraft('已调整封面。请预览并发布修改。')};tools.append(cover)}if(gallery.length>1){const remove=el('button','删除');remove.className='danger';remove.onclick=()=>{if(!confirm('从这个产品中移除这张照片？'))return;const next=gallery.filter(x=>x!==path);p.image=next[0];p.images=next.slice(1);render();markDraft('照片已从产品组图移除。请预览并发布修改。')};tools.append(remove)}item.append(tools);thumbs.append(item)});
  left.append(thumbs);
  const pa=el('div');pa.className='photoActions';
  const replaceText=el('span','替换封面');replaceText.className='photoLabel';const replace=el('input');replace.type='file';replace.accept='image/*';replace.onchange=async()=>{const file=replace.files&&replace.files[0];if(!file)return;try{setBusy(true);p.image=await uploadImage(file);p.images=galleryOf(p).slice(1);render();markDraft('新封面已上传。请预览并发布修改。')}catch(e){status(e.message)}finally{setBusy(false)}};
  const addText=el('span','追加细节照片（总计最多 20 张）');addText.className='photoLabel';const add=el('input');add.type='file';add.accept='image/*';add.multiple=true;add.onchange=async()=>{const files=[...(add.files||[])],available=maxProductImages-galleryOf(p).length;if(!files.length)return;if(available<1){status('这个产品已经有 20 张照片。');return}try{setBusy(true);const paths=await uploadMany(files.slice(0,available));p.images=[...new Set([...galleryOf(p).slice(1),...paths])];render();markDraft(files.length>available?'已上传可容纳的 '+available+' 张照片；每个产品最多 20 张。':'细节照片已上传。请预览并发布修改。')}catch(e){status(e.message)}finally{setBusy(false)}};
  const del=el('button','删除产品');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除“'+p.name+'”？'))return;try{setBusy(true);const d=await api('/admin/api/product/delete',{method:'POST',body:JSON.stringify({sha,id:p.id})});initial=d.products;draft=structuredClone(initial);settings=d.settings||settings;sha=d.sha;render();renderSettings();status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}};
  pa.append(replaceText,replace,addText,add,del);left.append(pa);
  const fields=el('div');fields.className='fields';for(const k of editFields){const wrap=el('label');if(['desc','options','price'].includes(k))wrap.className='wide';wrap.append(el('span',labels[k]));const input=el(k==='desc'?'textarea':k==='brand'?'select':'input');input.maxLength=limits[k];if(k==='brand'){for(const v of ['原木家具','皇玛康之家','文创产品']){const o=el('option',v);o.value=v;input.append(o)}}if(k==='wood')input.setAttribute('list','woodList');if(k==='category')input.setAttribute('list','categoryList');if(k==='room')input.setAttribute('list','roomList');input.value=p[k]||(k==='brand'?'原木家具':'');input.oninput=()=>{p[k]=input.value;markDraft()};wrap.append(input);fields.append(wrap)}card.append(left,fields);$('products').append(card)
 }
}
async function load(){try{status('正在读取资料…');const d=await api('/admin/api/catalog');csrf=d.csrf;initial=d.products;draft=structuredClone(initial);cases=d.cases||[];settings=d.settings||{woods:[],categories:[],rooms:[]};sha=d.sha;render();renderCasesAdmin();renderSettings();$('editor').hidden=false;$('loginBox').hidden=true;status('资料已加载。')}catch(e){status(e.message)}}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));for(const name of ['products','cases','woods','categories','rooms'])$('tab-'+name).hidden=b.dataset.tab!==name});
$('addWood').onclick=()=>addSetting('woods','woodInput');$('addCategory').onclick=()=>addSetting('categories','categoryInput');$('addRoom').onclick=()=>addSetting('rooms','roomInput');
function renderCasesAdmin(){const box=$('caseList');box.replaceChildren(...cases.map(c=>{const card=el('article');card.className='product';const left=el('div');const img=el('img');if(c.cover)img.src=c.cover.startsWith('products/uploads/')?'/media/'+c.cover:'https://qingnian-laowu.netlify.app/'+c.cover;left.append(img,el('div',c.id));const right=el('div');right.append(el('h2',c.title),el('p',c.summary||''),el('p','组图 '+((c.images||[]).length)+' 张'));const del=el('button','删除案例');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除这个全屋案例？'))return;try{setBusy(true);const d=await api('/admin/api/case/delete',{method:'POST',body:JSON.stringify({sha,id:c.id})});cases=d.cases||[];sha=d.sha;renderCasesAdmin();status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}};right.append(del);card.append(left,right);return card}))}
async function uploadMany(files){const paths=[];for(let i=0;i<files.length;i++){status('正在处理并上传第 '+(i+1)+' / '+files.length+' 张照片…');paths.push(await uploadImage(files[i]))}return paths}
$('addCase').onclick=async()=>{const cover=$('caseCover').files&&$('caseCover').files[0],gallery=[...($('caseImages').files||[])],title=$('caseTitle').value.trim();if(!title||!cover){status('请填写案例名称并选择封面图。');return}try{setBusy(true);const coverPath=await uploadImage(cover);const images=await uploadMany(gallery.slice(0,30));const d=await api('/admin/api/case/add',{method:'POST',body:JSON.stringify({sha,case:{title,tag:$('caseTag').value.trim()||'全屋定制',summary:$('caseSummary').value.trim(),cover:coverPath,images}})});cases=d.cases||[];sha=d.sha;$('caseTitle').value=$('caseTag').value=$('caseSummary').value='';$('caseCover').value=$('caseImages').value='';renderCasesAdmin();status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}};
$('toggleAdd').onclick=()=>{$('addPanel').hidden=!$('addPanel').hidden};$('cancelAdd').onclick=()=>$('addPanel').hidden=true;$('search').oninput=render;
$('createProduct').onclick=async()=>{const files=[...($('newImage').files||[])];const p={brand:$('newBrand').value,name:$('newName').value.trim(),category:$('newCategory').value.trim(),room:$('newRoom').value.trim()||'其他',wood:$('newWood').value.trim(),size:$('newSize').value.trim(),price:$('newPrice').value.trim(),desc:$('newDesc').value.trim(),options:$('newOptions').value.trim(),real:true};if(!p.name||!p.category||!p.wood||!files.length){status('请填写产品名称、产品类型、木材，并选择至少一张照片。');return}if(files.length>maxProductImages){status('每个产品最多上传 20 张照片，请减少后再试。');return}try{setBusy(true);const paths=await uploadMany(files);p.image=paths[0];p.images=paths.slice(1);const d=await api('/admin/api/product/add',{method:'POST',body:JSON.stringify({sha,product:p})});initial=d.products;draft=structuredClone(initial);settings=d.settings||settings;sha=d.sha;['newName','newCategory','newRoom','newWood','newSize','newPrice','newDesc','newOptions'].forEach(id=>$(id).value='');$('newImage').value='';$('addPanel').hidden=true;render();renderSettings();status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}};
$('preview').onclick=()=>{const edits=changes();if(!edits.length){status('还没有修改。');return}$('changes').replaceChildren(...edits.map(ch=>{const d=el('div');d.append(el('strong',ch.id));for(const [k,v]of Object.entries(ch.fields))d.append(el('p',labels[k]+'：'+(Array.isArray(v)?v.length+' 张':v)));return d}));$('previewPanel').hidden=false};
$('cancelPreview').onclick=()=>$('previewPanel').hidden=true;$('publish').onclick=async()=>{try{setBusy(true);const d=await api('/admin/api/catalog',{method:'POST',body:JSON.stringify({sha,changes:changes()})});initial=d.products;draft=structuredClone(initial);settings=d.settings||settings;sha=d.sha;render();renderSettings();$('previewPanel').hidden=true;status(d.message)}catch(e){status(e.message)}finally{setBusy(false)}};
$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(e){status(e.message)}};$('resume').onclick=load;load();
</script></body></html>`;

export default async function handler(request) {
 return worker.fetch(request, {GITHUB_CLIENT_ID:process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET:process.env.GITHUB_CLIENT_SECRET});
}
export const config = {path: ['/admin', '/admin/*']};

import { webcrypto as crypto } from 'node:crypto';
const ORIGIN = 'https://qingnian-laowu.netlify.app';
const REPO = 'wuhaozhuo6666-ctrl/qingnian-laowu';
const OWNER_ID = 327517365;
const FILE = '/repos/' + REPO + '/contents/products/catalog.json';
const LIMITS = {name:80,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200,image:260};
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
async function readCatalog(token){const file=await github(FILE+'?ref=main',token);const data=JSON.parse(dec.decode(un64(file.content.replace(/\s/g,''))));if(!Array.isArray(data.products))throw Error('Invalid catalog');const settings=data.settings&&typeof data.settings==='object'?data.settings:{};return {sha:file.sha,products:data.products,settings:{woods:Array.isArray(settings.woods)?settings.woods:[],categories:Array.isArray(settings.categories)?settings.categories:[],rooms:Array.isArray(settings.rooms)?settings.rooms:[]}};}
async function writeCatalog(token,sha,products,settings,message){
 const bytes=enc.encode(JSON.stringify({products,settings},null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const result=await github(FILE,token,{method:'PUT',body:JSON.stringify({branch:'main',sha,message,content:btoa(binary)})});
 return {sha:result.content.sha,products,settings};
}
function cleanText(value,field){if(typeof value!=='string')return '';const v=value.trim();if(v.length>(LIMITS[field]||400)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Invalid field');return v;}
function validImagePath(value){return typeof value==='string'&&/^products\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(value);}

function applyChanges(products,changes){if(!Array.isArray(changes)||changes.length>500)throw Error('Invalid changes');const next=products.map(p=>({...p}));const seen=new Set();for(const change of changes){if(!change||typeof change.id!=='string'||seen.has(change.id))throw Error('Invalid product');seen.add(change.id);const p=next.find(p=>p.id===change.id);if(!p||!change.fields||typeof change.fields!=='object'||Array.isArray(change.fields))throw Error('Invalid product');for(const [field,value] of Object.entries(change.fields)){if(!Object.hasOwn(LIMITS,field)||typeof value!=='string'||value.length>LIMITS[field]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw Error('Invalid field');if(field==='name'&&!value.trim())throw Error('Name required');p[field]=value.trim();}}return next;}
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
   const result=await writeCatalog(session.token,current.sha,products,current.settings,'Update product details from store admin');return reply({...result,message:'资料已保存，顾客网站正在自动更新，请稍后查看。'});
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
   const p=data.product||{};const name=cleanText(p.name,'name'),category=cleanText(p.category,'category'),room=cleanText(p.room||'其他','room'),wood=cleanText(p.wood,'wood'),size=cleanText(p.size,'size'),desc=cleanText(p.desc,'desc'),options=cleanText(p.options,'options'),price=cleanText(p.price||'','price'),image=cleanText(p.image,'image');
   if(!name||!category||!wood||!validImagePath(image))return reply({error:'请填写产品名称、产品类型、木材，并上传照片。'},400);
   const id='LW-'+Date.now().toString(36).toUpperCase();
   const product={id,name,category,room,wood,size,image,real:p.real!==false,options,desc};if(price)product.price=price;
   const result=await writeCatalog(session.token,current.sha,[product,...current.products],current.settings,'Add product from store admin');
   return reply({...result,message:'新产品已加入，顾客网站正在自动更新。'});
  }
  if(url.pathname==='/admin/api/product/delete'&&request.method==='POST'){
   let data;try{data=await request.json();}catch{return reply({error:'数据格式错误。'},400);}
   const current=await readCatalog(session.token);if(data.sha!==current.sha)return reply({error:'资料已更新，请重新加载后再删除。'},409);
   if(typeof data.id!=='string'||!current.products.some(p=>p.id===data.id))return reply({error:'找不到这个产品。'},404);
   const result=await writeCatalog(session.token,current.sha,current.products.filter(p=>p.id!==data.id),current.settings,'Delete product from store admin');
   return reply({...result,message:'产品已删除，顾客网站正在自动更新。'});
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
   const result=await writeCatalog(session.token,current.sha,current.products,out,'Update catalog settings from store admin');
   return reply({...result,message:'分类设置已保存，顾客网站正在自动更新。'});
  }
  return reply({error:'不支持的操作。'},405);
 }catch(error){return reply({error:error.status===401?'登录已过期，请重新登录；未发布的修改仍保留在页面中。':error.status===409||error.status===422?'发生版本冲突，未覆盖现有资料。请保留修改后重新加载。':'服务暂时不可用，请稍后重试。'},error.status===401?401:error.status===409||error.status===422?409:502);}
}};
const ADMIN = String.raw`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>青年老吴 · 产品管理</title><style nonce="NONCE_VALUE">
*{box-sizing:border-box}body{margin:0;background:#f4f2eb;color:#26382f;font:16px/1.6 system-ui,"PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1180px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid #ccd3c8;padding-bottom:16px}h1{font-size:25px;margin:0}h2{font-size:21px;margin-top:0}p{color:#5c695d}a{color:#304e3c}button,.button{border:1px solid #b5bfae;border-radius:8px;padding:10px 16px;background:#fff;color:#26382f;font:inherit;cursor:pointer}.primary{background:#304e3c;color:#fff;border-color:#304e3c}.danger{color:#8a2e25;border-color:#d8aaa5}.toolbar{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.status{padding:12px 0;white-space:pre-wrap}.panel{border:1px solid #d7ddd0;border-radius:12px;background:#fffef9;padding:20px;margin:18px 0}.newgrid,.fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}.wide{grid-column:1/-1}label{display:block;font-size:14px}label span{display:block;margin-bottom:5px}input,textarea,select{font:inherit;padding:10px;border:1px solid #aab5a7;border-radius:6px;width:100%;background:#fff;color:#26382f}textarea{min-height:100px;resize:vertical}.products{display:grid;gap:20px}.product{padding:20px;border:1px solid #d7ddd0;border-radius:12px;background:#fffef9;display:grid;grid-template-columns:210px 1fr;gap:24px}.product img{width:100%;height:230px;object-fit:cover;background:#eceae2;border-radius:8px}.photoTools{display:grid;gap:8px;margin-top:10px}.photoTools input{padding:8px;font-size:13px}.product small{display:block;color:#657160;margin-top:8px}.preview{border:1px solid #b8c4b3;background:#fff;padding:20px;margin-top:20px;border-radius:10px}.change{padding:12px 0;border-bottom:1px solid #ddd}.change p{white-space:pre-wrap;overflow-wrap:anywhere}.hint{font-size:14px}.loginbox{padding:36px 0}[hidden]{display:none!important}:focus-visible{outline:3px solid #9a6846;outline-offset:3px}@media(max-width:700px){main{padding:14px}.product{grid-template-columns:1fr}.product img{height:210px}.fields,.newgrid{grid-template-columns:1fr}.wide{grid-column:auto}header{align-items:start;flex-direction:column}.toolbar{position:sticky;top:0;background:#f4f2eb;padding:8px 0;z-index:3}}
</style></head><body><main><header><div><h1>青年老吴 · 产品管理</h1><div class="hint">新增产品 / 上传照片 / 修改资料 / 删除产品</div></div><a href="https://qingnian-laowu.netlify.app/" target="_blank" rel="noopener">查看顾客网站 ↗</a></header><div id="status" class="status" role="status"></div>
<section id="loginBox" class="loginbox" hidden><p>请使用店主 GitHub 账号登录。</p><a class="button primary" href="/admin/login" target="_blank" rel="noopener">使用 GitHub 登录</a><button id="resume">登录后继续</button></section>
<section id="editor" hidden>
<div class="toolbar"><button id="toggleAdd" class="primary">＋ 新增产品</button><button id="preview">预览文字修改</button><button id="reload">重新加载</button><button id="logout">退出登录</button></div>
<section id="addPanel" class="panel" hidden><h2>新增产品</h2><p class="hint">产品类型、木材都可以直接输入新的名称，例如“沙发”“茶几”“北美白橡”。以后它们会自动出现在顾客网站筛选里。</p><div class="newgrid">
<label><span>产品名称 *</span><input id="newName" maxlength="80" placeholder="例如：弧背休闲椅"></label>
<label><span>产品类型 *</span><input id="newCategory" maxlength="80" list="categoryList" placeholder="例如：餐椅 / 沙发 / 茶几"></label>
<label><span>空间</span><input id="newRoom" maxlength="80" list="roomList" placeholder="例如：客厅 / 餐厅 / 卧室"></label>
<label><span>木材 *</span><input id="newWood" maxlength="100" list="woodList" placeholder="例如：北美黑胡桃"></label>
<label><span>尺寸</span><input id="newSize" maxlength="160" placeholder="例如：1800 × 850 × 750 mm"></label>
<label><span>价格 / 报价说明</span><input id="newPrice" maxlength="200" placeholder="可留空"></label>
<label class="wide"><span>产品说明</span><textarea id="newDesc" maxlength="1600"></textarea></label>
<label class="wide"><span>可定制项目</span><input id="newOptions" maxlength="400" placeholder="例如：尺寸、木材、涂装、腿型"></label>
<label class="wide"><span>家具照片 *（手机照片也可以，后台会自动压缩）</span><input id="newImage" type="file" accept="image/jpeg,image/png,image/webp"></label>
</div><div class="toolbar"><button id="createProduct" class="primary">上传照片并添加产品</button><button id="cancelAdd">取消</button></div></section>
<datalist id="categoryList"></datalist><datalist id="roomList"></datalist><datalist id="woodList"></datalist>
<input id="search" type="search" placeholder="搜索产品名称、编号、类型或木材" aria-label="搜索产品"><p id="count"></p>
<section id="previewPanel" class="preview" hidden><h2>确认要发布的修改</h2><div id="changes"></div><button id="publish" class="primary">确认发布</button><button id="cancelPreview">继续编辑</button></section>
<div id="products" class="products"></div></section></main><script nonce="NONCE_VALUE">
'use strict';
const $=id=>document.getElementById(id);
const labels={name:'产品名称',category:'产品类型',room:'空间',wood:'木材',size:'尺寸',desc:'产品说明',options:'可定制项目',price:'价格 / 报价说明',image:'产品照片'};
const editFields=['name','category','room','wood','size','desc','options','price'];
const limits={name:80,category:80,room:80,wood:100,size:160,desc:1600,options:400,price:200};
let initial=[],draft=[],sha='',csrf='',busy=false;
function el(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e}
function status(text){$('status').textContent=text}
function changes(){return draft.flatMap(p=>{const old=initial.find(x=>x.id===p.id);if(!old)return[];const fields={};for(const k of Object.keys(labels))if((p[k]||'')!==(old[k]||''))fields[k]=p[k]||'';return Object.keys(fields).length?[{id:p.id,fields}]:[]})}
async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},cache:'no-store'});let data={};try{data=await r.json()}catch{}if(r.status===401){$('loginBox').hidden=false;throw Error(data.error||'请登录')}if(!r.ok)throw Error(data.error||'操作失败');return data}
function setBusy(value){busy=value;document.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=value)}
function fillLists(){const values=(field)=>[...new Set(draft.map(p=>(p[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));for(const [id,field] of [['categoryList','category'],['roomList','room'],['woodList','wood']]){$(id).replaceChildren(...values(field).map(v=>{const o=el('option');o.value=v;return o}))}}
function readFileData(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onerror=()=>reject(Error('读取照片失败'));fr.onload=()=>resolve(fr.result);fr.readAsDataURL(file)})}
async function compressImage(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('请选择 JPG、PNG 或 WEBP 照片。');const src=await readFileData(file);const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('照片无法读取'));i.src=src});let w=img.naturalWidth,h=img.naturalHeight,max=1500;if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0,w,h);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/webp',.82));if(!blob)throw Error('照片处理失败');if(blob.size>1850000)throw Error('照片处理后仍太大，请换一张尺寸小一些的照片。');const data=await readFileData(blob);return{mime:blob.type||'image/webp',base64:String(data).split(',')[1]}}
async function uploadImage(file){status('正在压缩并上传照片…');const payload=await compressImage(file);const data=await api('/admin/api/image',{method:'POST',body:JSON.stringify(payload)});return data.path}
function render(){fillLists();const q=$('search').value.trim().toLowerCase();const list=draft.filter(p=>([p.id,p.name,p.category,p.room,p.wood].join(' ')).toLowerCase().includes(q));$('products').replaceChildren();$('count').textContent=list.length+' 个产品';for(const p of list){const card=el('article');card.className='product';const photo=el('div');const img=el('img');if(/^products\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(p.image||''))img.src='https://qingnian-laowu.netlify.app/'+p.image;img.alt=p.name;const small=el('small',p.id+' · '+(p.real?'展厅实拍':'示意图片'));const photoTools=el('div');photoTools.className='photoTools';const upload=el('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.setAttribute('aria-label','更换 '+p.name+' 的照片');upload.onchange=async()=>{const file=upload.files&&upload.files[0];if(!file)return;try{setBusy(true);const path=await uploadImage(file);p.image=path;img.src='https://qingnian-laowu.netlify.app/'+path+'?v='+Date.now();$('previewPanel').hidden=true;status('新照片已上传。还需要点击“预览文字修改 → 确认发布”，顾客网站才会改用这张照片。')}catch(e){status(e.message)}finally{setBusy(false)}};const del=el('button','删除这个产品');del.className='danger';del.onclick=async()=>{if(!confirm('确定删除“'+p.name+'”吗？删除后顾客网站也会移除它。'))return;try{setBusy(true);const data=await api('/admin/api/product/delete',{method:'POST',body:JSON.stringify({sha,id:p.id})});initial=data.products;draft=structuredClone(initial);sha=data.sha;render();status(data.message)}catch(e){status(e.message)}finally{setBusy(false)}};photoTools.append(upload,del);photo.append(img,small,photoTools);const fields=el('div');fields.className='fields';for(const k of editFields){const label=labels[k],wrap=el('label');if(['desc','options','price'].includes(k))wrap.className='wide';wrap.append(el('span',label));const input=el(k==='desc'?'textarea':'input');input.maxLength=limits[k];if(['category','room','wood'].includes(k))input.setAttribute('list',k==='category'?'categoryList':k==='room'?'roomList':'woodList');input.value=p[k]||'';input.oninput=()=>{p[k]=input.value;$('previewPanel').hidden=true;status('有 '+changes().length+' 个产品修改尚未发布。')};wrap.append(input);fields.append(wrap)}card.append(photo,fields);$('products').append(card)}}
async function load(){try{status('正在读取产品资料…');const data=await api('/admin/api/catalog');csrf=data.csrf;initial=data.products;draft=structuredClone(initial);sha=data.sha;render();$('editor').hidden=false;$('loginBox').hidden=true;status('资料已加载。可以新增产品、上传照片或修改资料。')}catch(e){status(e.message)}}
$('search').oninput=render;
$('toggleAdd').onclick=()=>{$('addPanel').hidden=!$('addPanel').hidden;if(!$('addPanel').hidden)$('newName').focus()};
$('cancelAdd').onclick=()=>$('addPanel').hidden=true;
$('createProduct').onclick=async()=>{if(busy)return;const file=$('newImage').files&&$('newImage').files[0];const product={name:$('newName').value,category:$('newCategory').value,room:$('newRoom').value||'其他',wood:$('newWood').value,size:$('newSize').value,price:$('newPrice').value,desc:$('newDesc').value,options:$('newOptions').value,real:true};if(!product.name.trim()||!product.category.trim()||!product.wood.trim()||!file){status('请至少填写产品名称、产品类型、木材，并选择一张照片。');return}try{setBusy(true);product.image=await uploadImage(file);status('照片上传完成，正在添加产品…');const data=await api('/admin/api/product/add',{method:'POST',body:JSON.stringify({sha,product})});initial=data.products;draft=structuredClone(initial);sha=data.sha;['newName','newCategory','newRoom','newWood','newSize','newPrice','newDesc','newOptions'].forEach(id=>$(id).value='');$('newImage').value='';$('addPanel').hidden=true;render();status(data.message)}catch(e){status(e.message)}finally{setBusy(false)}};
$('reload').onclick=()=>{if(changes().length&&!confirm('重新加载会丢弃未发布的文字或照片修改。确定继续？'))return;load()};
$('preview').onclick=()=>{const edits=changes();if(!edits.length){status('还没有需要发布的修改。');return}if(draft.some(p=>!p.name.trim()||!p.category.trim()||!p.wood.trim())){status('产品名称、产品类型和木材不能为空。');return}$('changes').replaceChildren();for(const change of edits){const item=el('div');item.className='change';item.append(el('strong',change.id));const old=initial.find(p=>p.id===change.id);for(const [k,v]of Object.entries(change.fields)){item.append(el('p',labels[k]+'\n原：'+(old[k]||'未填写')+'\n新：'+(v||'未填写')))}$('changes').append(item)}$('previewPanel').hidden=false;$('previewPanel').scrollIntoView({behavior:'smooth'})};
$('cancelPreview').onclick=()=>$('previewPanel').hidden=true;
$('publish').onclick=async()=>{if(busy)return;try{setBusy(true);const edits=changes();const data=await api('/admin/api/catalog',{method:'POST',body:JSON.stringify({sha,changes:edits})});initial=data.products;draft=structuredClone(initial);sha=data.sha;render();$('previewPanel').hidden=true;status(data.message)}catch(e){status(e.message)}finally{setBusy(false)}};
$('logout').onclick=async()=>{if(changes().length&&!confirm('退出会丢弃未发布修改，确定退出？'))return;try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(e){status(e.message)}};
window.addEventListener('beforeunload',e=>{if(changes().length){e.preventDefault();e.returnValue=''}});
load();
</script></body></html>`;

export default async function handler(request) {
 return worker.fetch(request, {GITHUB_CLIENT_ID:process.env.GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET:process.env.GITHUB_CLIENT_SECRET});
}
export const config = {path: ['/admin', '/admin/*']};

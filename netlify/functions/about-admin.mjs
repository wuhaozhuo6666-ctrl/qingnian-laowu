import { webcrypto as crypto } from 'node:crypto';
const REPO='wuhaozhuo6666-ctrl/qingnian-laowu';
const OWNER_ID=327517365;
const ABOUT='/repos/'+REPO+'/contents/products/about.json';
const enc=new TextEncoder(),dec=new TextDecoder();
const un64=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
function cookie(request,name){return(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1)||''}
async function key(env){const bytes=await crypto.subtle.digest('SHA-256',enc.encode('laowu-admin-session-v1:'+env.GITHUB_CLIENT_SECRET));return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['decrypt'])}
async function unseal(value,env){try{const[iv,body]=value.split('.'),raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(env),un64(body)),data=JSON.parse(dec.decode(raw));return data.exp>Date.now()?data:null}catch{return null}}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
async function github(path,token,options={}){const response=await fetch('https://api.github.com'+path,{...options,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'laowu-about-admin','X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})}});if(!response.ok){const error=new Error('GitHub request failed');error.status=response.status;throw error}return response.status===204?null:response.json()}
async function readAbout(token){try{const file=await github(ABOUT+'?ref=main',token);return{sha:file.sha,data:JSON.parse(dec.decode(un64(file.content.replace(/\s/g,''))))}}catch(error){if(error.status===404)return{sha:null,data:{}};throw error}}
function text(value,max){return String(value??'').trim().slice(0,max)}
function image(value){return typeof value==='string'&&/^products\/(?:uploads|showroom|hero)\/[A-Za-z0-9._\/-]+\.(?:webp|jpg|jpeg|png)$/i.test(value)}
function lines(value,maxItems=40,maxLength=1000){return Array.isArray(value)?value.filter(item=>typeof item==='string').map(item=>text(item,maxLength)).filter(Boolean).slice(0,maxItems):[]}
function gallery(value){return Array.isArray(value)?value.map(item=>typeof item==='string'?{image:item,caption:''}:item).filter(item=>item&&image(item.image)).map(item=>({image:item.image,caption:text(item.caption,180)})).slice(0,40):[]}
function normalize(input={}){return{
 visible:input.visible!==false,
 homeEyebrow:text(input.homeEyebrow,80),homeTitle:text(input.homeTitle,180),homeText:text(input.homeText,700),homeButton:text(input.homeButton,40),
 heroTitle:text(input.heroTitle,180),heroSubtitle:text(input.heroSubtitle,700),heroImage:image(input.heroImage)?input.heroImage:'',
 storyTitle:text(input.storyTitle,180),storyParagraphs:lines(input.storyParagraphs,16,1600),timeline:lines(input.timeline,20,900),values:lines(input.values,16,900),proofs:lines(input.proofs,8,700),
 gallery:gallery(input.gallery),ctaTitle:text(input.ctaTitle,180),ctaText:text(input.ctaText,700),storeButton:text(input.storeButton,40),consultButton:text(input.consultButton,40)
}}
async function writeAbout(token,sha,data){const bytes=enc.encode(JSON.stringify(normalize(data),null,2)+'\n');let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);const body={branch:'main',message:'Update brand story from store admin',content:btoa(binary)};if(sha)body.sha=sha;const result=await github(ABOUT,token,{method:'PUT',body:JSON.stringify(body)});return result.content.sha}

export default async function handler(request){
 const url=new URL(request.url);
 try{
  const session=await unseal(cookie(request,'__Host-laowu-session'),process.env);
  if(!session||session.uid!==OWNER_ID)return reply({error:'请登录后台。'},401);
  const user=await github('/user',session.token);if(user.id!==OWNER_ID)return reply({error:'没有管理权限。'},403);
  if(url.pathname==='/about-admin/api/data'&&request.method==='GET'){const current=await readAbout(session.token);return reply({sha:current.sha,page:normalize(current.data),csrf:session.csrf})}
  if(request.method==='POST'&&request.headers.get('X-CSRF-Token')!==session.csrf)return reply({error:'验证过期，请重新登录。'},403);
  if(url.pathname==='/about-admin/api/save'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>220000)return reply({error:'页面资料过大，请精简后再保存。'},413);
   const body=await request.json(),current=await readAbout(session.token);if((body.sha||null)!==(current.sha||null))return reply({error:'品牌故事资料已在其他页面更新，请重新加载。'},409);
   const page=normalize(body.page),sha=await writeAbout(session.token,current.sha,page);return reply({sha,page,message:'品牌故事页面已保存，顾客端会自动更新。'});
  }
  if(url.pathname==='/about-admin/api/image'&&request.method==='POST'){
   if(Number(request.headers.get('Content-Length')||0)>3000000)return reply({error:'照片数据过大，请压缩后重试。'},413);
   const body=await request.json(),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[body.mime];
   if(!ext||typeof body.base64!=='string'||body.base64.length<100||body.base64.length>2700000||!/^[A-Za-z0-9+/=]+$/.test(body.base64))return reply({error:'照片格式不支持或文件过大。'},400);
   const path='products/uploads/about-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
   await github('/repos/'+REPO+'/contents/'+path,session.token,{method:'PUT',body:JSON.stringify({branch:'main',message:'Upload brand story image',content:body.base64})});return reply({path});
  }
  return reply({error:'页面不存在。'},404);
 }catch(error){return reply({error:error.status===401?'登录已过期，请重新登录。':error.status===409||error.status===422?'发生版本冲突，请重新加载。':'服务暂时不可用，请稍后重试。'},error.status===401?401:error.status===409||error.status===422?409:error.status===413?413:502)}
}

export const config={path:['/about-admin/api/*']};

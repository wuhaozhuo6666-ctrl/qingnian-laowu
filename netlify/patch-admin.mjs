import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const file=join(here,'functions','admin.mjs');
let source=readFileSync(file,'utf8');

source=source.replace('<button data-tab="woods">木材管理</button>','<button data-tab="woods">木材档案</button>');
source=source.replace('<section id="tab-woods" hidden><div class="panel"><h2>木材管理</h2>','<section id="tab-woods" hidden><div class="panel"><h2>木材名称库</h2>');
if(!source.includes('data-tab="craft"'))source=source.replace('<button data-tab="woods">木材档案</button>','<button data-tab="woods">木材档案</button><button data-tab="craft">定制工艺</button>');
if(!source.includes('data-tab="about"'))source=source.replace('<button data-tab="contacts">联系我们</button>','<button data-tab="about">关于我们管理</button><button data-tab="contacts">联系我们</button>');
if(!source.includes('id="tab-craft"'))source=source.replace('<section id="tab-categories" hidden>','<section id="tab-craft" hidden></section><section id="tab-categories" hidden>');
if(!source.includes('id="tab-about"'))source=source.replace('<section id="tab-contacts" hidden>','<section id="tab-about" hidden></section><section id="tab-contacts" hidden>');
if(!source.includes("'about','contacts'"))source=source.replace("['products','homepage','layout','store','cases','contacts','woods','categories','rooms']","['products','homepage','layout','store','cases','about','contacts','woods','craft','categories','rooms']");
source=source.replace("script-src 'nonce-\"+nonce+\"'; style-src 'nonce-\"+nonce+\"';","script-src 'self' 'nonce-\"+nonce+\"'; style-src 'self' 'nonce-\"+nonce+\"';");

const marker="$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(error){status(error.message)}};$('resume').onclick=load;load();\n</script></body></html>`;";
const replacement="$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(error){status(error.message)}};$('resume').onclick=load;load();\n</script><script nonce=\"NONCE_VALUE\" src=\"/assets/admin-wood-inline.js?v=20260924-4\"></script></body></html>`;";
if(!source.includes('/assets/admin-wood-inline.js'))source=source.replace(marker,replacement);
source=source.replace('<script nonce="NONCE_VALUE" src="/assets/admin-wood-inline.js?v=20260924-4"></script></body>','<script nonce="NONCE_VALUE" src="/assets/admin-wood-inline.js?v=20260924-4"></script><script nonce="NONCE_VALUE" src="/assets/admin-craft-inline.js?v=20260927-1"></script></body>');
source=source.replace('<script nonce="NONCE_VALUE" src="/assets/admin-craft-inline.js?v=20260927-1"></script></body>','<script nonce="NONCE_VALUE" src="/assets/admin-craft-inline.js?v=20260927-1"></script><script nonce="NONCE_VALUE" src="/assets/admin-about-inline.js?v=20260928-1"></script></body>');

if(!source.includes('<button data-tab="craft">定制工艺</button>')||!source.includes('id="tab-craft"')||!source.includes('/assets/admin-craft-inline.js')||!source.includes('<button data-tab="about">关于我们管理</button>')||!source.includes('id="tab-about"')||!source.includes('/assets/admin-about-inline.js')){
  throw new Error('Admin archive/craft/about patch did not apply');
}
writeFileSync(file,source,'utf8');
console.log('Patched original admin with integrated wood archive UI');

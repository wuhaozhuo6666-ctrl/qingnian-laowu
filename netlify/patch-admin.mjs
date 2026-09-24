import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here=dirname(fileURLToPath(import.meta.url));
const file=join(here,'functions','admin.mjs');
let source=readFileSync(file,'utf8');

source=source.replace('<button data-tab="woods">木材管理</button>','<button data-tab="woods">木材档案</button>');
source=source.replace('<section id="tab-woods" hidden><div class="panel"><h2>木材管理</h2>','<section id="tab-woods" hidden><div class="panel"><h2>木材名称库</h2>');
source=source.replace("script-src 'nonce-\"+nonce+\"'; style-src 'nonce-\"+nonce+\"';","script-src 'self' 'nonce-\"+nonce+\"'; style-src 'self' 'nonce-\"+nonce+\"';");

const marker="$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(error){status(error.message)}};$('resume').onclick=load;load();\n</script></body></html>`;";
const replacement="$('reload').onclick=load;$('logout').onclick=async()=>{try{await api('/admin/api/logout',{method:'POST',body:'{}'});location.reload()}catch(error){status(error.message)}};$('resume').onclick=load;load();\n</script><script nonce=\"NONCE_VALUE\" src=\"/assets/admin-wood-inline.js?v=20260924-4\"></script></body></html>`;";
if(!source.includes('/assets/admin-wood-inline.js'))source=source.replace(marker,replacement);

if(!source.includes('<button data-tab="woods">木材档案</button>')||!source.includes('/assets/admin-wood-inline.js')){
  throw new Error('Admin wood archive patch did not apply');
}
writeFileSync(file,source,'utf8');
console.log('Patched original admin with integrated wood archive UI');

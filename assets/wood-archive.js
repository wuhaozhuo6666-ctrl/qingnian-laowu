(function(){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const live=p=>p&&p.startsWith('products/uploads/')?'/media/'+p:(p?'/'+p:'');
const css=document.createElement('style');css.textContent=`
.filter-panel summary{font-size:18px!important;font-weight:650!important;letter-spacing:.05em!important;padding-top:14px!important;padding-bottom:14px!important}
#woodsView .section-heading{max-width:900px;margin-bottom:26px}
#woodsView .section-heading .eyebrow{letter-spacing:.18em;color:#8f684a}
#woodsView .section-heading h2{font-family:"Songti SC",SimSun,serif;font-weight:500;letter-spacing:.02em}
.wood-archive-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.wood-archive-card{position:relative;overflow:hidden;background:linear-gradient(180deg,#fffef9 0%,#fbf8f1 100%);border:1px solid rgba(91,79,63,.16);border-radius:16px;box-shadow:0 9px 28px rgba(43,39,31,.055);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}
.wood-archive-card:hover{transform:translateY(-4px);box-shadow:0 18px 42px rgba(43,39,31,.11);border-color:rgba(126,91,62,.28)}
.wood-archive-card button{display:block;width:100%;padding:0;border:0;background:transparent;text-align:left;color:inherit}
.wood-cover{position:relative;aspect-ratio:4/3;background:linear-gradient(135deg,#e9e4d9,#d9d5cb);overflow:hidden;display:grid;place-items:center;color:#876d58}
.wood-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 58%,rgba(25,31,27,.16));pointer-events:none}
.wood-cover img{width:100%;height:100%;object-fit:cover;transition:transform .45s cubic-bezier(.2,.75,.2,1)}
.wood-archive-card:hover .wood-cover img{transform:scale(1.025)}
.wood-cover span{font:500 32px "Songti SC",serif;letter-spacing:.12em}
.wood-card-copy{position:relative;padding:22px 22px 21px}
.wood-card-copy::before{content:"";position:absolute;left:22px;top:0;width:40px;height:2px;background:#9b7556}
.wood-card-copy small{display:block;color:#94745b;letter-spacing:.15em;font-size:10px;font-weight:650}
.wood-card-copy h3{margin:8px 0 10px;font:500 24px/1.42 "Songti SC",serif;color:#26382f}
.wood-card-copy p{margin:0;color:#687168;font-size:13px;line-height:1.9;min-height:50px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.wood-card-copy b{display:flex;align-items:center;gap:7px;margin-top:16px;font-size:12px;color:#73523c;font-weight:650;letter-spacing:.02em}
.wood-card-copy b::after{content:"→";font-size:15px;transition:transform .2s ease}.wood-archive-card:hover .wood-card-copy b::after{transform:translateX(3px)}
body.wood-detail-open{overflow:hidden}
.wood-dialog{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#f2f0e9!important;color:#26382f!important;overflow:auto!important}
.wood-dialog::backdrop{background:rgba(16,24,20,.86)}
.wood-detail-page{min-height:100dvh;background:radial-gradient(circle at 82% 18%,rgba(182,159,126,.12),transparent 30%),#f2f0e9}
.wood-detail-topbar{position:sticky;top:0;z-index:30;min-height:64px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:max(8px,env(safe-area-inset-top)) 24px 8px;border-bottom:1px solid rgba(97,88,75,.14);background:rgba(255,254,249,.96);backdrop-filter:blur(12px);box-shadow:0 6px 18px rgba(45,43,38,.035)}
.wood-detail-topbar strong{font-size:13px;letter-spacing:.16em;color:#5f655f;font-weight:650}
.wood-dialog-close{justify-self:start;display:inline-flex;align-items:center;gap:8px;border:0;background:transparent;padding:8px 4px;color:#26382f;font-size:15px}
.wood-dialog-close span:first-child{font-size:30px;line-height:1}
.wood-hero{background:#dddcd5;border-bottom:1px solid rgba(95,88,76,.14)}
.wood-main-media{position:relative;width:100%;height:min(72vh,780px);min-height:520px;overflow:hidden;background:linear-gradient(135deg,#e7e5de,#d6d7d0);display:flex;align-items:center;justify-content:center}
.wood-main-media img{display:block;width:100%;height:100%;object-fit:contain;cursor:zoom-in}
.wood-photo-placeholder{display:grid;place-items:center;width:100%;height:100%;color:#807b71;text-align:center;padding:30px}
.wood-photo-placeholder strong{display:block;font:500 42px "Songti SC",serif;margin-bottom:8px}.wood-photo-placeholder span{font-size:14px}
.wood-media-tools{position:absolute;left:24px;right:24px;bottom:22px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;pointer-events:none}
.wood-media-tools button,.wood-media-tools span{pointer-events:auto;border:1px solid rgba(73,70,63,.08);background:rgba(255,254,249,.94);border-radius:999px;padding:11px 17px;box-shadow:0 6px 22px rgba(30,30,25,.12);backdrop-filter:blur(8px)}
.wood-media-tools span{text-align:center;justify-self:center;min-width:96px;font-size:13px}.wood-media-tools button{min-width:50px;font-size:25px;line-height:1}
.wood-thumbs-wrap{background:#ebe8e0;border-top:1px solid #d8d6cd}
.wood-thumbs{max-width:1180px;margin:auto;display:flex;gap:11px;overflow-x:auto;padding:14px 28px 16px;scrollbar-width:thin}
.wood-thumb{flex:0 0 116px;width:116px;height:82px;border:2px solid transparent;padding:0;border-radius:9px;overflow:hidden;background:#e4e1d8;box-shadow:0 4px 12px rgba(34,37,32,.04)}
.wood-thumb.active{border-color:#304e3c;box-shadow:0 0 0 2px rgba(48,78,60,.08)}.wood-thumb img{width:100%;height:100%;object-fit:cover}
.wood-detail-content{max-width:1120px;margin:0 auto;padding:62px 42px 96px}
.wood-detail-heading{position:relative;max-width:900px;margin-bottom:42px;padding:0 0 32px;border-bottom:1px solid rgba(101,92,78,.17)}
.wood-detail-heading::after{content:"";position:absolute;left:0;bottom:-1px;width:74px;height:2px;background:#9a6e4e}
.wood-detail-heading .eyebrow{font-size:11px;color:#8a694f;letter-spacing:.19em;font-weight:650}
.wood-detail-heading h1{font:500 clamp(38px,4vw,60px)/1.2 "Songti SC",serif;margin:10px 0 20px;color:#232b26;letter-spacing:.025em}
.wood-detail-intro{margin:0;color:#555f58;font-size:17px;line-height:2.05;white-space:pre-line;overflow-wrap:anywhere}
.wood-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px 0 42px}
.wood-metric{background:rgba(255,254,249,.86);border:1px solid rgba(101,92,78,.15);border-radius:14px;padding:24px 25px;box-shadow:0 8px 24px rgba(42,40,34,.035)}
.wood-metric span{display:block;color:#8a8379;font-size:12px;letter-spacing:.09em;margin-bottom:10px}.wood-metric strong{display:block;font-size:17px;line-height:1.85;font-weight:550;white-space:pre-line;overflow-wrap:anywhere;color:#2d3a33}
.wood-pair{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}
.wood-section{position:relative;margin:0 0 18px;padding:27px 28px 28px;background:rgba(255,254,249,.68);border:1px solid rgba(101,92,78,.13);border-radius:14px}
.wood-section::before{content:"";position:absolute;left:0;top:25px;bottom:25px;width:3px;border-radius:0 4px 4px 0;background:#a37a58}
.wood-section h3{margin:0 0 13px;font-size:12px;letter-spacing:.12em;color:#806650;font-weight:700}
.wood-section p{margin:0;color:#303b35;font-size:16px;line-height:2;white-space:pre-line;overflow-wrap:anywhere}
.wood-pair .wood-section{height:100%;margin-bottom:0}
.wood-empty-note{margin-top:24px;padding:18px 20px;border:1px dashed #cfc9bb;background:#f5f1e8;color:#6c706b;border-radius:10px;font-size:13px;line-height:1.75}
.wood-viewer{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:#0d0f0e!important}
.wood-viewer::backdrop{background:#0d0f0e}.wood-viewer-shell{height:100dv
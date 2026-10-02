(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const live = path => path && path.startsWith('products/uploads/')
    ? '/media/' + path
    : (path ? '/' + String(path).replace(/^\//, '') : '');
  const list = value => Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim())
    : [];
  const split = value => {
    const parts = String(value || '').split(/[｜|]/);
    return { title: (parts.shift() || '').trim(), body: parts.join('｜').trim() };
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 700px)');
  const LOADING_PAGE = {
    visible: true,
    heroTitle: '定制工艺',
    heroSubtitle: '正在载入全屋定制流程与工艺资料…',
    strengths: [], workflow: [], processGroups: [], craftDetails: [],
    scope: [], acceptance: [], notices: [], faqs: [], gallery: [],
    ctaTitle: '选择设计师咨询', ctaText: ''
  };

  let data = { ...LOADING_PAGE };
  let viewerIndex = 0;
  let craftPushed = false;
  let navOpeningTimer = 0;
  let revealObserver = null;

  const style = document.createElement('style');
  style.textContent = `
body.craft-open{overflow:hidden}
.craft-dialog{position:fixed!important;inset:0!important;width:100%!important;height:100vh!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#f4f1e9!important;color:#24342b!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain;opacity:0;transform:translateY(14px) scale(.998);transition:opacity .28s ease,transform .42s cubic-bezier(.18,.76,.22,1)}
.craft-dialog[open],.craft-dialog.craft-visible{display:block!important;z-index:2147483000!important}
.craft-dialog.craft-visible{opacity:1;transform:none}
.craft-dialog::backdrop{background:rgba(13,21,17,.86);backdrop-filter:blur(2px)}
.craft-page{width:100%;max-width:100%;min-height:100vh;min-height:100dvh;overflow-x:clip;background:linear-gradient(180deg,#f8f6ef 0,#f4f1e9 62%,#efede5 100%)}
.craft-topbar{position:sticky;top:0;z-index:40;min-height:62px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;padding:max(8px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) 8px max(24px,env(safe-area-inset-left));border-bottom:1px solid rgba(112,105,94,.18);background:rgba(255,254,249,.94);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.craft-topbar strong{font-size:14px;letter-spacing:.12em}.craft-back{justify-self:start;border:0;background:transparent;padding:7px 2px;color:inherit;font:15px/1.2 system-ui}.craft-back b{font-size:29px;vertical-align:-2px;margin-right:7px}
.craft-hero{position:relative;isolation:isolate;min-height:clamp(430px,58vh,560px);display:flex;align-items:end;overflow:hidden;background:#263d30;color:#fff}.craft-hero-visual{position:absolute;z-index:-3;inset:0;background:var(--craft-image,linear-gradient(135deg,#263d30,#8b765c)) center/cover no-repeat}.craft-hero:before{content:"";position:absolute;z-index:-2;inset:0;background:linear-gradient(110deg,rgba(18,34,26,.91),rgba(41,55,46,.58));pointer-events:none}
.craft-hero:after{content:"";position:absolute;z-index:-1;inset:auto 0 0;height:42%;background:linear-gradient(0deg,rgba(12,23,17,.32),transparent);pointer-events:none}
.craft-hero-copy{position:relative;z-index:1;width:min(1160px,100%);margin:0 auto;padding:82px 48px 66px}
.craft-hero-kicker,.craft-hero-copy h1,.craft-hero-copy p{opacity:0;transform:translateY(22px);will-change:transform,opacity}
.craft-hero-kicker{display:block;font-size:12px;letter-spacing:.2em;color:#e2d2bb}
.craft-hero-copy h1{max-width:850px;margin:12px 0 18px;font:500 clamp(38px,5vw,66px)/1.18 "Songti SC",serif}
.craft-hero-copy p{max-width:760px;margin:0;font-size:16px;line-height:1.85;color:#f2efe7}
.craft-dialog.craft-visible .craft-hero-kicker{animation:craftHeroReveal .68s .08s cubic-bezier(.2,.72,.2,1) forwards}
.craft-dialog.craft-visible .craft-hero-copy h1{animation:craftHeroReveal .82s .18s cubic-bezier(.18,.76,.22,1) forwards}
.craft-dialog.craft-visible .craft-hero-copy p{animation:craftHeroReveal .76s .34s cubic-bezier(.2,.72,.2,1) forwards}
@keyframes craftHeroReveal{to{opacity:1;transform:translateY(0)}}
@keyframes craftNavLaunch{0%{transform:scale(1)}44%{transform:scale(.92);background:rgba(47,76,59,.10)}78%{transform:scale(1.04)}100%{transform:scale(1)}}
.main-directory button.craft-nav-launching{animation:craftNavLaunch .3s cubic-bezier(.2,.78,.22,1)!important;color:#263b30!important;border-color:#7a6252!important}
.craft-container{width:min(1120px,calc(100% - 48px));margin:auto;padding:60px 0 88px}
.craft-section{padding:50px 0;border-bottom:1px solid rgba(112,105,94,.22);transition:opacity .62s ease,transform .7s cubic-bezier(.2,.72,.2,1)}
.craft-section:first-child{padding-top:0}.craft-section.craft-reveal{opacity:0;transform:translateY(22px)}.craft-section.craft-reveal.is-revealed{opacity:1;transform:none}
.craft-heading{max-width:760px;margin-bottom:25px}.craft-heading span{color:#8c6a50;font-size:11px;letter-spacing:.17em}.craft-heading h2{margin:7px 0 9px;font:500 clamp(28px,3.2vw,42px)/1.3 "Songti SC",serif}.craft-heading p{margin:0;color:#677068;line-height:1.75}
.craft-strengths{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.craft-strength{padding:22px 19px;background:rgba(255,254,249,.78);border:1px solid rgba(112,105,94,.22);border-radius:12px}.craft-strength strong{display:block;color:#79583f;font-size:19px}.craft-strength h3{margin:7px 0;font-size:15px}.craft-strength p{margin:0;color:#70766f;font-size:13px;line-height:1.68}
.craft-manifesto{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:18px;padding:19px 22px;border-left:3px solid #8c6a50;background:rgba(232,225,211,.55)}.craft-manifesto strong{font:500 23px/1.35 "Songti SC",serif;color:#433b32;white-space:nowrap}.craft-manifesto p{margin:0;max-width:720px;color:#606861;font-size:14px;line-height:1.75}
.craft-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.craft-step{position:relative;min-height:188px;padding:24px 20px;background:#273b30;color:#fff;border-radius:12px}.craft-step-number{display:block;margin-bottom:19px;color:#d2b998;font:500 13px system-ui;letter-spacing:.12em}.craft-step h3{margin:0 0 9px;font-size:17px}.craft-step p{margin:0;color:#d8dfda;font-size:13px;line-height:1.72}
.craft-process{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.craft-process article{padding:22px 19px;background:rgba(255,254,249,.78);border:1px solid rgba(112,105,94,.22);border-radius:12px}.craft-process small{color:#94745b;letter-spacing:.1em}.craft-process h3{margin:8px 0 11px;font:500 21px "Songti SC",serif}.craft-process p{margin:0;color:#4f5952;font-size:13px;line-height:1.78}
.craft-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.craft-detail{padding:18px 20px;border-left:3px solid #8c6a50;background:rgba(255,254,249,.78)}.craft-detail h3{margin:0 0 6px;font-size:16px}.craft-detail p{margin:0;color:#677068;font-size:14px;line-height:1.72}
.craft-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:23px}.craft-gallery button{padding:0;border:0;background:#ddd8cd;aspect-ratio:4/3;overflow:hidden}.craft-gallery img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .35s}.craft-gallery button:hover img{transform:scale(1.025)}
.craft-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.craft-info-panel{min-width:0;border:0}.craft-info-panel>summary{display:block;list-style:none;cursor:pointer;margin-bottom:12px}.craft-info-panel>summary::-webkit-details-marker{display:none}.craft-info-panel>summary>span{display:block;color:#8c6a50;font-size:11px;letter-spacing:.17em}.craft-info-panel>summary>strong{display:block;margin-top:7px;font:500 clamp(28px,3.2vw,42px)/1.3 "Songti SC",serif}.craft-info-panel>summary:after{content:"收起";float:right;margin-top:-38px;color:#8c6a50;font-size:12px}.craft-info-panel:not([open])>summary:after{content:"展开查看"}.craft-list{display:grid}.craft-list div{padding:13px 0;border-bottom:1px solid rgba(112,105,94,.22);font-size:14px;line-height:1.72}
.craft-faq{display:grid;gap:8px}.craft-faq details{background:rgba(255,254,249,.78);border:1px solid rgba(112,105,94,.22);border-radius:10px;padding:0 16px}.craft-faq summary{cursor:pointer;padding:14px 0;font-weight:600;font-size:14px}.craft-faq p{margin:0;padding:0 0 15px;color:#626b64;font-size:14px;line-height:1.78}
.craft-cta{padding:38px 40px;border-radius:16px;background:#263b30;color:#fff;display:flex;justify-content:space-between;gap:28px;align-items:center}.craft-cta h2{margin:0 0 8px;font:500 clamp(27px,3vw,39px) "Songti SC",serif}.craft-cta p{max-width:720px;margin:0;color:#d9e0db;font-size:14px;line-height:1.75}.craft-cta button{flex:0 0 auto;border:1px solid #d8c1a2;background:#d8c1a2;color:#23342b;border-radius:8px;padding:13px 20px;font-weight:650}
.craft-viewer{position:fixed!important;inset:0!important;width:100%!important;height:100vh!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:#0d100e!important}.craft-viewer[open],.craft-viewer.craft-visible{display:block!important;z-index:2147483600!important}.craft-viewer-shell{height:100vh;height:100dvh;display:grid;grid-template-rows:auto 1fr auto}.craft-viewer-top{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;padding:max(8px,env(safe-area-inset-top)) 14px 7px;color:#fff}.craft-viewer-top button{justify-self:start;border:0;background:transparent;color:#fff;font-size:29px}.craft-viewer-stage{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;touch-action:pan-y pinch-zoom}.craft-viewer-stage img{width:100%;height:100%;object-fit:contain}.craft-viewer-stage button{position:absolute;top:50%;width:48px;height:48px;margin-top:-24px;border:0;border-radius:50%;background:#ffffff24;color:#fff;font-size:30px}.craft-viewer-stage .prev{left:12px}.craft-viewer-stage .next{right:12px}.craft-viewer-foot{padding:10px 14px calc(14px + env(safe-area-inset-bottom));text-align:center;color:#d7dbd8}
.case-dialog{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;overflow:auto!important;background:#f4f2eb!important}.case-dialog #closeCase{position:sticky!important;top:0!important;left:0!important;z-index:30!important;width:100%!important;height:62px!important;border:0!important;border-bottom:1px solid #ddd9cf!important;border-radius:0!important;background:rgba(255,254,249,.96)!important;text-align:left!important;padding:0 24px!important;color:#26382f!important;font-size:16px!important;backdrop-filter:blur(12px)}.case-dialog-body{max-width:1160px!important;margin:auto!important;padding:46px 32px 90px!important}
@media(max-width:900px){.craft-strengths,.craft-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.craft-process{grid-template-columns:repeat(2,minmax(0,1fr))}.craft-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.craft-hero{min-height:450px}.craft-hero-copy{padding:65px 28px 49px}.craft-container{width:min(100% - 34px,1120px);padding-top:42px}.craft-section{padding:40px 0}.craft-columns{gap:20px}.craft-cta{padding:31px;align-items:flex-start;flex-direction:column}}
@media(max-width:700px){
  .main-directory{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0 8px!important;overflow:visible!important;padding:5px 0!important}.main-directory button{min-width:0!important;min-height:48px!important;white-space:normal!important;padding:11px 2px 10px!important;font-size:13px!important;letter-spacing:0!important;line-height:1.3!important}.filter-panel summary{font-size:18px!important;font-weight:650!important}
  .craft-topbar{min-height:52px;padding:max(5px,env(safe-area-inset-top)) 13px 5px}.craft-topbar strong{font-size:13px}.craft-back{font-size:14px}.craft-back b{font-size:26px;margin-right:4px}
  .craft-hero{height:auto;min-height:0;display:grid;grid-template-rows:auto auto;align-items:stretch;overflow:visible}.craft-hero-visual{position:relative;z-index:0;inset:auto;width:100%;height:260px;height:clamp(220px,34svh,315px);background-size:contain;background-position:center;background-color:#17251d}.craft-hero:before,.craft-hero:after{display:none}.craft-hero-copy{z-index:1;width:100%;padding:21px 18px 24px;background:linear-gradient(135deg,#263b30,#3f5147)}.craft-hero-kicker{font-size:9px;letter-spacing:.17em}.craft-hero-copy h1{margin:7px 0 9px;font-size:clamp(26px,7.8vw,31px);line-height:1.24}.craft-hero-copy p{font-size:12.5px;line-height:1.65}
  .craft-container{width:calc(100% - 30px);padding:23px 0 54px}.craft-section{padding:25px 0}.craft-heading{margin-bottom:15px}.craft-heading h2{margin-top:5px;font-size:23px;line-height:1.35}.craft-heading p{font-size:12.5px;line-height:1.62}
  .craft-strengths{display:grid;grid-template-columns:none;grid-template-rows:1fr;grid-auto-flow:column;grid-auto-columns:minmax(230px,78vw);gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:1px 1px 9px;overscroll-behavior-inline:contain;scrollbar-width:thin}.craft-strength{scroll-snap-align:start;padding:18px 17px}.craft-strength strong{font-size:18px}.craft-strength p{font-size:12.5px}
  .craft-manifesto{display:block;margin-top:12px;padding:17px 16px}.craft-manifesto strong{display:block;font-size:20px;white-space:normal}.craft-manifesto p{margin-top:6px;font-size:12.5px;line-height:1.65}
  .craft-steps{display:grid;grid-template-columns:1fr;gap:0;background:rgba(255,254,249,.64);border:1px solid rgba(112,105,94,.20);border-radius:12px;overflow:hidden}.craft-step{min-height:0;display:grid;grid-template-columns:37px 1fr;gap:12px;padding:15px;background:transparent;color:#283a30;border-radius:0;border-bottom:1px solid rgba(112,105,94,.18)}.craft-step:last-child{border-bottom:0}.craft-step-number{margin:2px 0 0;color:#8c6a50;font-size:11px}.craft-step h3{margin:0 0 3px;font-size:15px}.craft-step p{color:#667068;font-size:12.5px;line-height:1.62}
  .craft-process{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.craft-process article{padding:15px 13px}.craft-process small{font-size:9px}.craft-process h3{margin:5px 0 7px;font-size:17px}.craft-process p{font-size:11.5px;line-height:1.6}
  .craft-detail-grid,.craft-columns{grid-template-columns:1fr}.craft-detail{padding:14px 15px}.craft-detail h3{font-size:15px}.craft-detail p{font-size:12.5px;line-height:1.62}.craft-gallery{grid-template-columns:1fr 1fr;margin-top:16px}
  .craft-columns{gap:9px}.craft-info-panel{border:1px solid rgba(112,105,94,.22);border-radius:11px;background:rgba(255,254,249,.68);overflow:hidden}.craft-info-panel>summary{margin:0;padding:16px;padding-right:68px}.craft-info-panel>summary:after{content:"展开";margin-top:-27px;margin-right:-52px}.craft-info-panel[open]>summary:after{content:"收起"}.craft-info-panel>summary>span{font-size:9px}.craft-info-panel>summary>strong{margin-top:3px;font:600 18px/1.3 system-ui}.craft-info-panel>.craft-list,.craft-info-panel>.craft-faq{padding:0 16px 14px}.craft-list div{padding:11px 0;font-size:12.5px}.craft-faq details{padding:0 13px}.craft-faq summary,.craft-faq p{font-size:12.5px}
  .craft-cta{padding:24px 20px;gap:17px}.craft-cta h2{font-size:25px}.craft-cta p{font-size:12.5px}.craft-cta button{width:100%}
  .case-dialog #closeCase{height:58px!important;padding:0 15px!important}.case-dialog-body{padding:30px 17px 70px!important}
}
@media(prefers-reduced-motion:reduce){.craft-dialog,.craft-section,.craft-gallery img{transition:none!important}.craft-hero-kicker,.craft-hero-copy h1,.craft-hero-copy p{animation:none!important;opacity:1!important;transform:none!important}.main-directory button.craft-nav-launching{animation:none!important}}
  `;
  document.head.append(style);

  function ensureUI() {
    if ($('craftDialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
<dialog id="craftDialog" class="craft-dialog" aria-labelledby="craftHeroTitle" aria-describedby="craftHeroSubtitle">
  <article class="craft-page">
    <div class="craft-topbar"><button id="craftBack" class="craft-back" aria-label="返回上一页"><b>‹</b>返回</button><strong>定制工艺</strong><span></span></div>
    <section id="craftHero" class="craft-hero"><div class="craft-hero-visual" aria-hidden="true"></div><div class="craft-hero-copy"><span class="craft-hero-kicker">WHOLE-HOME CRAFT</span><h1 id="craftHeroTitle"></h1><p id="craftHeroSubtitle"></p></div></section>
    <main class="craft-container">
      <section class="craft-section"><div class="craft-heading"><span>WHY US</span><h2>把经验、工厂和交付能力放在明面上</h2></div><div id="craftStrengths" class="craft-strengths"></div><div class="craft-manifesto"><strong>真材实料，木必对板</strong><p>从木材选择、分选配纹到生产安装，每一道工序都清楚可见。</p></div></section>
      <section class="craft-section"><div class="craft-heading"><span>CUSTOM JOURNEY</span><h2>一套清楚的全屋定制流程</h2><p>每一步都确认清楚，再进入下一步，减少设计与落地之间的信息偏差。</p></div><div id="craftWorkflow" class="craft-steps"></div></section>
      <section class="craft-section"><div class="craft-heading"><span>FACTORY PROCESS</span><h2>从原材料到出厂</h2></div><div id="craftProcess" class="craft-process"></div></section>
      <section class="craft-section"><div class="craft-heading"><span>CRAFT DETAILS</span><h2>真正影响长期使用的工艺细节</h2></div><div id="craftDetails" class="craft-detail-grid"></div><div id="craftGallery" class="craft-gallery"></div></section>
      <section class="craft-section"><div class="craft-columns"><details class="craft-info-panel" open><summary><span>CUSTOM RANGE</span><strong>可定制范围</strong></summary><div id="craftScope" class="craft-list"></div></details><details class="craft-info-panel" open><summary><span>ACCEPTANCE</span><strong>交付验收重点</strong></summary><div id="craftAcceptance" class="craft-list"></div></details></div></section>
      <section class="craft-section"><div class="craft-columns"><details class="craft-info-panel" open><summary><span>BEFORE ORDER</span><strong>定制前需要知道</strong></summary><div id="craftNotices" class="craft-list"></div></details><details class="craft-info-panel" open><summary><span>FAQ</span><strong>常见问题</strong></summary><div id="craftFaq" class="craft-faq"></div></details></div></section>
      <section class="craft-section"><div class="craft-cta"><div><h2 id="craftCtaTitle"></h2><p id="craftCtaText"></p></div><button id="craftConsult">选择设计师咨询</button></div></section>
    </main>
  </article>
</dialog>
<dialog id="craftViewer" class="craft-viewer"><div class="craft-viewer-shell"><div class="craft-viewer-top"><button id="craftViewerClose" aria-label="关闭大图">×</button><strong>工艺实拍</strong><span></span></div><div id="craftViewerStage" class="craft-viewer-stage"><button id="craftViewerPrev" class="prev" aria-label="上一张">‹</button><img id="craftViewerImage" alt=""><button id="craftViewerNext" class="next" aria-label="下一张">›</button></div><div id="craftViewerCounter" class="craft-viewer-foot"></div></div></dialog>`);

    $('craftBack').onclick = closeCraft;
    $('craftDialog').addEventListener('cancel', event => { event.preventDefault(); closeCraft(); });
    $('craftConsult').onclick = () => {
      closeCraftDirect();
      setTimeout(() => { const button = $('caseConsult'); if (button) button.click(); }, 0);
    };
    $('craftViewerClose').onclick = () => hideLayer($('craftViewer'));
    $('craftViewerPrev').onclick = () => stepViewer(-1);
    $('craftViewerNext').onclick = () => stepViewer(1);
    $('craftViewer').addEventListener('cancel', event => { event.preventDefault(); hideLayer($('craftViewer')); });

    let x = 0;
    let y = 0;
    $('craftViewerStage').addEventListener('touchstart', event => {
      if (event.touches.length === 1) { x = event.touches[0].clientX; y = event.touches[0].clientY; }
    }, { passive: true });
    $('craftViewerStage').addEventListener('touchend', event => {
      if (!event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - x;
      const dy = event.changedTouches[0].clientY - y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) stepViewer(dx > 0 ? -1 : 1);
    }, { passive: true });

    const closeCase = $('closeCase');
    if (closeCase) { closeCase.textContent = '‹  返回上一页'; closeCase.setAttribute('aria-label', '返回上一页'); }
  }

  function cards(values, target, kind) {
    $(target).replaceChildren(...list(values).map((value, index) => {
      const parsed = split(value);
      const node = document.createElement(kind === 'strength' || kind === 'process' ? 'article' : 'div');
      if (kind === 'strength') {
        const segments = String(value).split(/[｜|]/);
        node.className = 'craft-strength';
        node.innerHTML = '<strong>' + esc((segments[0] || '').trim()) + '</strong><h3>' + esc((segments[1] || '').trim()) + '</h3><p>' + esc(segments.slice(2).join('｜').trim()) + '</p>';
      } else if (kind === 'step') {
        node.className = 'craft-step';
        node.innerHTML = '<span class="craft-step-number">' + String(index + 1).padStart(2, '0') + '</span><div><h3>' + esc(parsed.title) + '</h3><p>' + esc(parsed.body) + '</p></div>';
      } else if (kind === 'detail') {
        node.className = 'craft-detail';
        node.innerHTML = '<h3>' + esc(parsed.title) + '</h3><p>' + esc(parsed.body) + '</p>';
      } else if (kind === 'process') {
        node.innerHTML = '<small>PROCESS ' + String(index + 1).padStart(2, '0') + '</small><h3>' + esc(parsed.title) + '</h3><p>' + esc(parsed.body) + '</p>';
      }
      return node;
    }));
  }

  function simpleList(values, target) {
    $(target).replaceChildren(...list(values).map(value => {
      const node = document.createElement('div');
      node.textContent = value;
      return node;
    }));
  }

  function render() {
    if (!data) return;
    ensureUI();
    $('craftHeroTitle').textContent = data.heroTitle || '定制工艺';
    $('craftHeroSubtitle').textContent = data.heroSubtitle || '';
    $('craftHero').style.setProperty('--craft-image', data.heroImage ? 'url(' + JSON.stringify(live(data.heroImage)) + ')' : 'linear-gradient(135deg,#263d30,#8b765c)');
    cards(data.strengths, 'craftStrengths', 'strength');
    cards(data.workflow, 'craftWorkflow', 'step');
    cards(data.processGroups, 'craftProcess', 'process');
    cards(data.craftDetails, 'craftDetails', 'detail');
    simpleList(data.scope, 'craftScope');
    simpleList(data.acceptance, 'craftAcceptance');
    simpleList(data.notices, 'craftNotices');
    $('craftFaq').replaceChildren(...list(data.faqs).map(value => {
      const parsed = split(value);
      const details = document.createElement('details');
      details.innerHTML = '<summary>' + esc(parsed.title) + '</summary><p>' + esc(parsed.body) + '</p>';
      return details;
    }));
    const gallery = list(data.gallery);
    $('craftGallery').replaceChildren(...gallery.map((src, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', '放大第 ' + (index + 1) + ' 张工艺照片');
      button.innerHTML = '<img src="' + esc(live(src)) + '" alt="定制工艺实拍 ' + (index + 1) + '" loading="lazy">';
      button.onclick = () => openViewer(index);
      return button;
    }));
    $('craftGallery').hidden = !gallery.length;
    $('craftCtaTitle').textContent = data.ctaTitle || '直接和设计师沟通';
    $('craftCtaText').textContent = data.ctaText || '';
  }

  function syncCompactPanels() {
    document.querySelectorAll('.craft-info-panel').forEach(panel => {
      if (compactLayout.matches) panel.removeAttribute('open');
      else panel.setAttribute('open', '');
    });
  }

  function prepareReveals() {
    if (revealObserver) revealObserver.disconnect();
    const sections = [...document.querySelectorAll('.craft-section')];
    sections.forEach(section => section.classList.remove('craft-reveal', 'is-revealed'));
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      sections.forEach(section => section.classList.add('is-revealed'));
      return;
    }
    sections.forEach(section => section.classList.add('craft-reveal'));
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    }, { root: $('craftDialog'), rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    sections.forEach(section => revealObserver.observe(section));
  }

  function showLayer(layer, animate = false) {
    if (!layer) return;
    if (animate) layer.classList.remove('craft-visible');
    try { if (typeof layer.showModal === 'function' && !layer.open) layer.showModal(); } catch (error) {}
    if (!layer.open) layer.setAttribute('open', '');
    if (animate && !reduceMotion.matches) requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('craft-visible')));
    else layer.classList.add('craft-visible');
  }

  function hideLayer(layer) {
    if (!layer) return;
    try { if (layer.open && typeof layer.close === 'function') layer.close(); } catch (error) {}
    layer.removeAttribute('open');
    layer.classList.remove('craft-visible');
  }

  function openCraft(fromRoute = false) {
    if (data.visible === false) return;
    ensureUI();
    render();
    syncCompactPanels();
    const dialog = $('craftDialog');
    const isNewOpen = !dialog.open;
    showLayer(dialog, isNewOpen);
    dialog.scrollTop = 0;
    document.body.classList.add('craft-open');
    requestAnimationFrame(prepareReveals);
    if (window.SiteMotion) { window.SiteMotion.scan(dialog); requestAnimationFrame(() => window.SiteMotion.refresh()); }
    if (!fromRoute) {
      const url = new URL(location.href);
      url.searchParams.set('craft', '1');
      history.pushState({ craft: true }, '', url.pathname + url.search + url.hash);
      craftPushed = true;
    }
  }

  function closeCraftDirect() {
    hideLayer($('craftDialog'));
    hideLayer($('craftViewer'));
    document.body.classList.remove('craft-open');
    if (revealObserver) revealObserver.disconnect();
    craftPushed = false;
  }

  function closeCraft() {
    if (craftPushed) { history.back(); return; }
    closeCraftDirect();
  }

  function gallery() { return data ? list(data.gallery) : []; }
  function openViewer(index) {
    const images = gallery();
    if (!images.length) return;
    viewerIndex = index;
    updateViewer();
    showLayer($('craftViewer'));
  }
  function stepViewer(delta) {
    const images = gallery();
    if (images.length < 2) return;
    viewerIndex = (viewerIndex + delta + images.length) % images.length;
    updateViewer();
  }
  function updateViewer() {
    const images = gallery();
    if (!images.length) return;
    $('craftViewerImage').src = live(images[viewerIndex]);
    $('craftViewerCounter').textContent = (viewerIndex + 1) + ' / ' + images.length + ' · 左右滑动查看 · 可双指缩放';
    $('craftViewerPrev').hidden = $('craftViewerNext').hidden = images.length < 2;
  }

  function bindNav() {
    const button = document.querySelector('[data-view="craft"]');
    if (button) button.hidden = data.visible === false;
  }

  function interceptCraftClick(event) {
    const target = event.target && event.target.closest ? event.target.closest('[data-view="craft"]') : null;
    if (!target || target.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(navOpeningTimer);
    target.classList.remove('craft-nav-launching');
    void target.offsetWidth;
    target.classList.add('craft-nav-launching');
    navOpeningTimer = setTimeout(() => {
      target.classList.remove('craft-nav-launching');
      openCraft();
    }, reduceMotion.matches ? 0 : 190);
  }

  function syncRoute() {
    const active = new URL(location.href).searchParams.get('craft') === '1';
    if (active && data && data.visible !== false) {
      craftPushed = true;
      openCraft(true);
    } else if ($('craftDialog') && $('craftDialog').open) closeCraftDirect();
  }

  async function boot() {
    ensureUI();
    bindNav();
    render();
    syncRoute();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/api/craft-page?ts=' + Date.now(), { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('craft page unavailable');
      data = await response.json();
    } catch (error) {
      data = { ...LOADING_PAGE, heroSubtitle: '工艺资料暂时未能同步，请稍后刷新页面。' };
    } finally {
      clearTimeout(timeout);
    }
    bindNav();
    render();
    syncRoute();
  }

  document.addEventListener('click', interceptCraftClick, true);
  window.addEventListener('popstate', syncRoute);
  if (typeof compactLayout.addEventListener === 'function') compactLayout.addEventListener('change', syncCompactPanels);
  else compactLayout.addListener(syncCompactPanels);
  boot();
})();

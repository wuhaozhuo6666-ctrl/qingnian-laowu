(function(){
  'use strict';
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const style=document.createElement('style');
  style.textContent=`
.site-loader{position:fixed;inset:0;z-index:2147482500;display:grid;place-items:center;background:rgba(246,243,235,.94);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;transition:opacity .24s ease,visibility .24s ease}.site-loader.is-visible{opacity:1;visibility:visible}.site-loader-card{display:grid;justify-items:center;gap:16px;color:#48564d;text-align:center}.site-tree-rings{position:relative;width:76px;height:76px}.site-tree-rings span{position:absolute;inset:7px;border:2px solid transparent;border-top-color:#6f4f3d;border-right-color:#6f4f3d;border-radius:46% 54% 49% 51%;animation:siteRing 2.2s linear infinite}.site-tree-rings span:nth-child(2){inset:17px;border-top-color:#375344;border-right-color:#375344;border-radius:54% 46% 51% 49%;animation-duration:1.75s;animation-direction:reverse}.site-tree-rings span:nth-child(3){inset:28px;border-color:#8c6a50;border-bottom-color:transparent;border-radius:48% 52% 45% 55%;animation-duration:1.35s}.site-tree-rings b{position:absolute;inset:0;display:grid;place-items:center;font:600 9px/1 system-ui;letter-spacing:.05em;color:#735640}.site-loader-text{font-size:13px;letter-spacing:.08em}.site-loader-retry{display:none;border:1px solid #31503f;border-radius:8px;background:#31503f;color:#fff;padding:10px 18px;font:600 13px system-ui}.site-loader.has-error .site-tree-rings{animation:sitePulse 1.5s ease-in-out infinite}.site-loader.has-error .site-tree-rings span{animation-play-state:paused}.site-loader.has-error .site-loader-retry{display:block}@keyframes siteRing{to{transform:rotate(360deg)}}@keyframes sitePulse{50%{transform:scale(.95);opacity:.62}}
.site-reveal{opacity:0;transform:translateY(18px);transition:opacity .58s ease,transform .68s cubic-bezier(.2,.75,.2,1)}.site-reveal.is-revealed{opacity:1;transform:none}.site-view-enter{animation:siteViewEnter .38s cubic-bezier(.2,.75,.2,1)}@keyframes siteViewEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.site-scroll-layer{--site-scroll-y:0px;translate:0 var(--site-scroll-y);transition:translate .08s linear;will-change:translate}
img.site-image-loading{opacity:.16;background:linear-gradient(100deg,#e7e1d5 20%,#f5f1e9 40%,#e7e1d5 60%);background-size:220% 100%;animation:siteShimmer 1.35s ease-in-out infinite}img.site-image-ready{opacity:1;transition:opacity .36s ease}@keyframes siteShimmer{to{background-position:-220% 0}}
.card,.woodcard,.contact-card,.case-cover-card,.heritage-item{transition:transform .28s cubic-bezier(.2,.75,.2,1),box-shadow .28s ease,border-color .28s ease}.card:hover,.woodcard:hover,.contact-card:hover,.case-cover-card:hover,.heritage-item:hover{transform:translateY(-3px)}button,a{-webkit-tap-highlight-color:transparent}button:active,.plain:active,.primary:active{transform:scale(.975)}
.toast:not([hidden]){animation:siteToast .36s cubic-bezier(.2,.8,.2,1)}@keyframes siteToast{from{opacity:0;transform:translate(-50%,12px) scale(.97)}to{opacity:1;transform:translate(-50%,0) scale(1)}}
details[open]>*:not(summary){animation:siteDetails .3s ease}@keyframes siteDetails{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}dialog:not(.craft-dialog):not(.about-dialog):not(.craft-viewer):not(.about-viewer)[open]{animation:siteDialog .3s cubic-bezier(.2,.75,.2,1)}@keyframes siteDialog{from{opacity:0;transform:translateY(9px) scale(.992)}to{opacity:1;transform:none}}
@media(max-width:700px){.site-scroll-layer{transition-duration:.045s}}@media(prefers-reduced-motion:reduce){.site-tree-rings span,.site-loader.has-error .site-tree-rings,img.site-image-loading,details[open]>*:not(summary),dialog[open]{animation:none!important}.site-reveal,.site-view-enter,img.site-image-ready,.card,.woodcard,.contact-card,.case-cover-card,.heritage-item,.site-scroll-layer{animation:none!important;transition:none!important;opacity:1!important;transform:none!important;translate:0 0!important}}
`;
  document.head.append(style);

  let loader=null,showTimer=0,errorTimer=0,depth=0,retryAction=null;
  function ensureLoader(){
    if(loader)return loader;
    loader=document.createElement('div');loader.className='site-loader';loader.setAttribute('role','status');loader.setAttribute('aria-live','polite');
    loader.innerHTML='<div class="site-loader-card"><div class="site-tree-rings" aria-hidden="true"><span></span><span></span><span></span><b>青年老吴</b></div><div class="site-loader-text">正在加载内容…</div><button class="site-loader-retry" type="button">点击重新加载</button></div>';
    loader.querySelector('button').onclick=()=>{if(retryAction){const action=retryAction;end(true);action()}else location.reload()};
    document.body.append(loader);return loader;
  }
  function begin(options={}){
    depth++;
    const delay=Number.isFinite(options.delay)?options.delay:220;
    const timeout=Number.isFinite(options.timeout)?options.timeout:8000;
    retryAction=typeof options.retry==='function'?options.retry:null;
    clearTimeout(showTimer);clearTimeout(errorTimer);
    showTimer=setTimeout(()=>{const node=ensureLoader();node.classList.remove('has-error');node.querySelector('.site-loader-text').textContent=options.text||'正在加载内容…';node.classList.add('is-visible')},delay);
    errorTimer=setTimeout(()=>{const node=ensureLoader();node.classList.add('is-visible','has-error');node.querySelector('.site-loader-text').textContent='内容暂时没有加载出来'},timeout);
  }
  function end(force=false){
    depth=force?0:Math.max(0,depth-1);if(depth)return;
    clearTimeout(showTimer);clearTimeout(errorTimer);retryAction=null;
    if(loader){loader.classList.remove('is-visible','has-error');setTimeout(()=>{if(loader&&!loader.classList.contains('is-visible'))loader.querySelector('.site-loader-text').textContent='正在加载内容…'},260)}
  }

  let observer=null;
  const scrollNodes=new Set();
  let scrollTick=false;
  function reveal(root=document){
    const selector='.brand-prelude,.section-heading,.home-module,.card,.woodcard,.contact-card,.case-cover-card,.heritage-item,.site-motion-section';
    const nodes=[];
    if(root.nodeType===1&&root.matches(selector))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll(selector));
    if(reduce.matches){nodes.forEach(node=>node.classList.add('is-revealed'));return}
    if(!observer)observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-revealed');observer.unobserve(entry.target)}}),{rootMargin:'0px 0px -6% 0px',threshold:.04});
    nodes.forEach((node,index)=>{if(node.dataset.motionBound)return;node.dataset.motionBound='1';node.classList.add('site-reveal');node.style.transitionDelay=Math.min(index%5,4)*45+'ms';observer.observe(node)});
  }
  function imageState(img){
    if(!(img instanceof HTMLImageElement)||img.dataset.imageMotion)return;
    img.dataset.imageMotion='1';
    const ready=()=>{img.classList.remove('site-image-loading');img.classList.add('site-image-ready')};
    if(img.complete&&img.naturalWidth)ready();else{img.classList.add('site-image-loading');img.addEventListener('load',ready,{once:true});img.addEventListener('error',ready,{once:true})}
  }
  function bindScroll(root=document){
    if(reduce.matches)return;
    const selector='.brand-prelude .eyebrow,.brand-prelude h2,.brand-prelude p,.section-heading .eyebrow,.section-heading h2,.section-heading p,.case-heading .eyebrow,.case-heading h2,.case-heading p,.home-module-copy>*,.heritage-item,.about-hero-copy>span,.about-hero-copy>h1,.about-hero-copy>p,.about-heading>span,.about-heading>h2,.about-heading>p,.about-story-mark,.about-timeline article,.about-value,.about-gallery figure,.wood-archive-card,.wood-detail-heading>*,.wood-metric,.wood-section,.craft-heading>*,.craft-strength,.craft-step,.craft-process article';
    const nodes=[];
    if(root.nodeType===1&&root.matches(selector))nodes.push(root);
    if(root.querySelectorAll)nodes.push(...root.querySelectorAll(selector));
    nodes.forEach(node=>{
      if(node.dataset.scrollMotion)return;
      node.dataset.scrollMotion='1';
      let depth=6;
      if(node.matches('h1,h2,.about-story-mark'))depth=13;
      else if(node.matches('.eyebrow,.hero-kicker,.about-hero-copy>span,.about-heading>span,.wood-detail-heading>.eyebrow'))depth=5;
      else if(node.matches('p'))depth=8;
      else if(node.matches('.heritage-item,.about-timeline article,.about-value,.about-gallery figure,.wood-archive-card,.wood-metric,.wood-section,.craft-strength,.craft-step,.craft-process article'))depth=4;
      node.dataset.scrollDepth=String(depth);
      node.classList.add('site-scroll-layer');
      scrollNodes.add(node);
    });
    queueScroll();
  }
  function updateScroll(){
    scrollTick=false;
    if(reduce.matches)return;
    const height=Math.max(1,window.innerHeight),mobile=window.innerWidth<=700?.62:1;
    scrollNodes.forEach(node=>{
      if(!node.isConnected){scrollNodes.delete(node);return}
      const rect=node.getBoundingClientRect();
      if((rect.width===0&&rect.height===0)||rect.bottom<-220||rect.top>height+220)return;
      const progress=Math.max(-1,Math.min(1,(height/2-(rect.top+rect.height/2))/(height*.72)));
      const shift=progress*Number(node.dataset.scrollDepth||6)*mobile;
      node.style.setProperty('--site-scroll-y',shift.toFixed(2)+'px');
    });
  }
  function queueScroll(){if(scrollTick||reduce.matches)return;scrollTick=true;requestAnimationFrame(updateScroll)}
  function scan(root=document){reveal(root);bindScroll(root);if(root instanceof HTMLImageElement)imageState(root);if(root.querySelectorAll)root.querySelectorAll('img').forEach(imageState)}
  function enter(node){if(!node||reduce.matches)return;node.classList.remove('site-view-enter');void node.offsetWidth;node.classList.add('site-view-enter')}
  window.SiteMotion={begin,end,reveal,scan,enter,refresh:queueScroll,reduced:()=>reduce.matches};
  const changes=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)scan(node)})));
  function boot(){ensureLoader();scan();changes.observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('scroll',queueScroll,{passive:true});document.addEventListener('scroll',queueScroll,true);window.addEventListener('resize',queueScroll,{passive:true});queueScroll()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

'use strict';

(async function () {
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const DEFAULT_SETTINGS = {
    heroImage: '', shareImage: '', woods: [], categories: [], rooms: [],
    storeAddress: '河北张家口怀来 · 华美家具城', businessHours: '', parkingInfo: '',
    amapUrl: '', baiduUrl: '',
    shareTitle: '青年老吴实木工厂店｜原木家具与全屋定制',
    shareDescription: '25年实体家具经验，自有工厂与实体展厅，服务京津冀及周边。'
  };
  const DEFAULT_WOODS = ['非洲红胡桃', '北美黑胡桃', '北美樱桃木', '白蜡木', '红橡木'];
  let settings = { ...DEFAULT_SETTINGS };
  let products = [];
  let cases = [];
  let contacts = [];
  let catalogLoaded = false;

  function validImage(path) {
    return typeof path === 'string' && /^products\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png)$/i.test(path);
  }
  function liveImage(path) {
    return typeof path === 'string' && path.startsWith('products/uploads/') ? '/media/' + path : path;
  }
  function unique(values) {
    return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
  }
  function normalizeProduct(product, index) {
    return {
      ...product,
      id: String(product.id || '').trim(),
      name: String(product.name || '').trim(),
      brand: String(product.brand || '原木家具').trim() || '原木家具',
      room: String(product.room || '其他').trim() || '其他',
      category: String(product.category || '其他').trim() || '其他',
      wood: String(product.wood || '木材待确认').trim(),
      image: String(product.image || '').trim(),
      images: unique(Array.isArray(product.images) ? product.images : []).slice(0, 19),
      availability: String(product.availability || '待确认').trim(),
      leadTime: String(product.leadTime || '请咨询门店').trim(),
      options: String(product.options || '').trim(),
      featured: product.featured === true,
      pinned: product.pinned === true,
      visible: product.visible !== false,
      sortOrder: Number.isFinite(Number(product.sortOrder)) ? Number(product.sortOrder) : index + 1,
      real: product.real !== false
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch('/api/live-catalog?ts=' + Date.now(), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('live catalog unavailable');
    const data = await response.json();
    if (data.settings && typeof data.settings === 'object') {
      settings = {
        ...DEFAULT_SETTINGS,
        ...data.settings,
        heroImage: validImage(data.settings.heroImage) ? data.settings.heroImage : '',
        shareImage: validImage(data.settings.shareImage) ? data.settings.shareImage : '',
        woods: Array.isArray(data.settings.woods) ? data.settings.woods.map(String) : [],
        categories: Array.isArray(data.settings.categories) ? data.settings.categories : [],
        rooms: Array.isArray(data.settings.rooms) ? data.settings.rooms : []
      };
    }
    if (Array.isArray(data.products)) {
      products = data.products
        .filter(item => item && typeof item === 'object')
        .map(normalizeProduct)
        .filter(item => item.id && item.name && item.image);
      catalogLoaded = true;
    }
    if (Array.isArray(data.cases)) cases = data.cases.filter(item => item && item.id && item.cover);
    if (Array.isArray(data.contacts)) {
      contacts = data.contacts
        .filter(item => item && ['sales', 'designer'].includes(item.type) && item.name)
        .map(item => ({
          id: String(item.id || '').trim(), type: item.type, name: String(item.name || '').trim(),
          title: String(item.title || '').trim(), phone: String(item.phone || '').trim(),
          wechat: String(item.wechat || '').trim(), bio: String(item.bio || '').trim(),
          image: String(item.image || '').trim()
        }));
    }
  } catch (error) {
    products = [];
    cases = [];
    contacts = [];
  } finally {
    clearTimeout(timeout);
  }

  if (!catalogLoaded) {
    const notice = document.querySelector('.notice span');
    if (notice) notice.textContent = '产品资料暂时未能同步，请稍后刷新页面。为避免显示过期资料，本页不会回退到旧产品列表。';
  }

  const customerProducts = () => products
    .filter(product => product.visible !== false)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'));
  const productById = id => customerProducts().find(product => product.id === id);
  const productImages = product => unique([product && product.image, ...(product && Array.isArray(product.images) ? product.images : [])]);
  const allWoods = unique([...settings.woods, ...DEFAULT_WOODS, ...customerProducts().map(product => product.wood).filter(wood => !/待确认|待核实/.test(wood))]);

  let favorites = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem('laowu-favorites') || '[]');
    if (Array.isArray(stored)) favorites = new Set(stored.filter(id => productById(id)));
  } catch (error) {}

  let state = {
    view: 'products', room: '全部空间', category: '全部', wood: 'all', query: '',
    huangmaCategory: '全部', sharedIds: null
  };
  let current = null;
  let currentCase = null;
  let imageIndex = 0;
  let detailPushed = false;
  let toastTimer = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchTracking = false;
  let lastSwipe = 0;
  let pendingShare = null;
  let preShareUrl = '';
  let consultContext = null;

  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
  }
  function animateChoice(button) {
    if (!button) return;
    button.classList.remove('choice-activated');
    void button.offsetWidth;
    button.classList.add('choice-activated');
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('.main-directory button,#rooms button,#categories button,#huangmaCategories button');
    if (button) animateChoice(button);
  });
  document.addEventListener('animationend', event => {
    if (event.target.classList && event.target.classList.contains('choice-activated')) event.target.classList.remove('choice-activated');
  });

  function updateSaved() {
    $('savedCount').textContent = favorites.size;
  }
  function persistFavorites() {
    try {
      localStorage.setItem('laowu-favorites', JSON.stringify([...favorites]));
    } catch (error) {
      notify('清单仅在本次浏览有效，建议复制保存');
    }
  }
  function toggleFavorite(id) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    persistFavorites();
    updateSaved();
    renderProducts();
    renderCollection();
    if (current) updateDetailSave();
  }
  function availabilityClass(value) {
    if (/现货/.test(value)) return 'stock';
    if (/定制/.test(value)) return 'custom';
    return '';
  }
  function filteredProducts() {
    return customerProducts().filter(product =>
      product.brand === '原木家具' &&
      (state.room === '全部空间' || product.room === state.room) &&
      (state.category === '全部' || product.category === state.category) &&
      (state.wood === 'all' || (state.wood === 'unconfirmed' ? /待确认|待核实/.test(product.wood) : product.wood.includes(state.wood))) &&
      [product.id, product.name, product.wood, product.category, product.room].join(' ').toLowerCase().includes(state.query.toLowerCase())
    );
  }
  function makeCard(product) {
    const photoCount = productImages(product).length;
    const article = document.createElement('article');
    article.className = 'card';
    article.innerHTML = '<div class="picture">' +
      '<button class="open-picture" aria-label="查看' + escapeHTML(product.name) + '"><img src="' + escapeHTML(liveImage(product.image)) + '" alt="' + escapeHTML(product.name) + '，' + (product.real ? '展厅实拍' : '款式示意') + '" loading="lazy"></button>' +
      '<span class="badge">' + (product.real ? '展厅实拍' : '定制示意') + '</span>' +
      (product.featured ? '<span class="featured-badge">店主推荐</span>' : '') +
      (photoCount > 1 ? '<span class="photo-count">▧ ' + photoCount + ' 张</span>' : '') +
      '<button class="save ' + (favorites.has(product.id) ? 'selected' : '') + '" aria-label="' + (favorites.has(product.id) ? '取消收藏' : '收藏') + escapeHTML(product.name) + '" aria-pressed="' + favorites.has(product.id) + '">' + (favorites.has(product.id) ? '♥' : '♡') + '</button></div>' +
      '<h3><button>' + escapeHTML(product.name) + '</button></h3>' +
      '<p>' + escapeHTML(product.id) + ' · ' + escapeHTML(product.room) + ' / ' + escapeHTML(product.category) + '</p>' +
      '<div class="card-status-line"><span class="availability-tag ' + availabilityClass(product.availability) + '">' + escapeHTML(product.availability) + '</span><span class="availability-tag">' + escapeHTML(product.leadTime) + '</span></div>' +
      '<div class="bottom"><span class="woodtag">' + escapeHTML(product.real ? product.wood : '款式示意 · 木材可讨论') + '</span><span>查看详情 ↗</span></div>';
    article.querySelector('.open-picture').onclick = () => openDetail(product);
    article.querySelector('h3 button').onclick = () => openDetail(product);
    article.querySelector('.save').onclick = () => toggleFavorite(product.id);
    return article;
  }
  function renderProducts() {
    const list = filteredProducts();
    $('productGrid').replaceChildren(...list.map(makeCard));
    $('productEmpty').hidden = Boolean(list.length);
    $('resultCount').textContent = list.length + ' 个展示项 · 实拍与示意已分别标注';
    document.querySelectorAll('[data-room]').forEach(button => {
      button.classList.toggle('active', button.dataset.room === state.room);
      button.setAttribute('aria-pressed', button.dataset.room === state.room);
    });
    document.querySelectorAll('[data-category]').forEach(button => {
      button.classList.toggle('active', button.dataset.category === state.category);
      button.setAttribute('aria-pressed', button.dataset.category === state.category);
    });
  }
  function collectionProducts() {
    const ids = state.sharedIds || [...favorites];
    return customerProducts().filter(product => ids.includes(product.id));
  }
  function renderCollection() {
    const list = collectionProducts();
    $('collectionGrid').replaceChildren(...list.map(makeCard));
    $('collectionEmpty').hidden = Boolean(list.length);
    $('copyCollection').disabled = !list.length;
    $('shareCollection').disabled = !list.length;
    $('posterCollection').disabled = !list.length;
  }
  function renderHuangma() {
    const removed = new Set(['大板桌', '橱柜']);
    const all = customerProducts().filter(product => product.brand === '皇玛康之家' && !removed.has(product.category));
    const categories = unique([...settings.categories, '沙发', '茶几', '电视柜', '床', '餐桌', '餐椅', '餐边柜'])
      .filter(value => value !== '其他' && !removed.has(value));
    $('huangmaCategories').replaceChildren(...['全部', ...categories].map(category => {
      const button = document.createElement('button');
      button.className = 'pill' + (state.huangmaCategory === category ? ' active' : '');
      button.textContent = category;
      button.onclick = () => { state.huangmaCategory = category; renderHuangma(); };
      return button;
    }));
    const list = all.filter(product => state.huangmaCategory === '全部' || product.category === state.huangmaCategory);
    $('huangmaGrid').replaceChildren(...list.map(makeCard));
    $('huangmaEmpty').hidden = Boolean(list.length);
    $('huangmaCount').textContent = list.length + ' 个产品';
  }
  function renderCreative() {
    const list = customerProducts().filter(product => product.brand === '文创产品');
    $('creativeGrid').replaceChildren(...list.map(makeCard));
    $('creativeEmpty').hidden = Boolean(list.length);
  }

  function renderCases() {
    $('caseGrid').replaceChildren(...cases.map(item => {
      const card = document.createElement('article');
      card.className = 'case-cover-card';
      card.innerHTML = '<button class="case-cover-button"><div class="case-cover-picture"><img src="' + escapeHTML(liveImage(item.cover)) + '" alt="' + escapeHTML(item.title) + '" loading="lazy"><span>' + escapeHTML(item.tag || '全屋定制') + '</span></div><div class="case-cover-copy"><h3>' + escapeHTML(item.title) + '</h3><p>' + escapeHTML(item.summary || '点击查看整组案例图') + '</p><b>查看完整案例 →</b></div></button>';
      card.querySelector('button').onclick = () => openCase(item);
      return card;
    }));
    $('caseEmpty').hidden = Boolean(cases.length);
  }
  function openCase(item) {
    currentCase = item;
    $('caseTitle').textContent = item.title || '全屋定制案例';
    $('caseTag').textContent = item.tag || 'WHOLE HOME';
    $('caseSummary').textContent = item.summary || '';
    const images = unique([item.cover, ...(Array.isArray(item.images) ? item.images : [])]);
    $('caseGallery').replaceChildren(...images.map((src, index) => {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = liveImage(src);
      image.loading = 'lazy';
      image.alt = (item.title || '案例') + ' ' + (index + 1);
      figure.append(image);
      return figure;
    }));
    openDialog($('caseDialog'));
  }

  function makeContactCard(contact) {
    const card = document.createElement('article');
    card.className = 'contact-card';
    const photo = document.createElement('div');
    photo.className = 'contact-photo';
    const image = document.createElement('img');
    image.src = liveImage(contact.image);
    image.alt = contact.name + '个人照片';
    image.loading = 'lazy';
    photo.append(image);
    const copy = document.createElement('div');
    copy.className = 'contact-copy';
    const role = document.createElement('span');
    role.className = 'contact-role';
    role.textContent = contact.type === 'designer' ? '空间设计' : '产品销售';
    const name = document.createElement('h4');
    name.textContent = contact.name;
    const title = document.createElement('p');
    title.className = 'contact-title';
    title.textContent = contact.title || '青年老吴实木工厂店';
    const lines = document.createElement('div');
    lines.className = 'contact-lines';
    if (contact.phone) lines.append(contactLine('电话', contact.phone, 'tel:' + contact.phone.replace(/[^0-9+]/g, '')));
    if (contact.wechat) lines.append(contactLine('微信', contact.wechat));
    copy.append(role, name, title, lines);
    if (contact.bio) {
      const bio = document.createElement('p');
      bio.className = 'contact-bio';
      bio.textContent = contact.bio;
      copy.append(bio);
    }
    const actions = document.createElement('div');
    actions.className = 'contact-actions';
    if (contact.wechat) {
      const button = document.createElement('button');
      button.className = 'contact-wechat';
      button.textContent = '复制微信号';
      button.onclick = () => copyText(contact.wechat, $('copyFallback'), '微信号已复制，打开微信搜索添加');
      actions.append(button);
    }
    if (contact.phone) {
      const link = document.createElement('a');
      link.className = 'contact-phone';
      link.href = 'tel:' + contact.phone.replace(/[^0-9+]/g, '');
      link.textContent = '拨打电话';
      actions.append(link);
    }
    copy.append(actions);
    card.append(photo, copy);
    return card;
  }
  function contactLine(labelText, value, href) {
    const row = document.createElement('div');
    row.className = 'contact-line';
    const label = document.createElement('span');
    label.textContent = labelText;
    const detail = href ? document.createElement('a') : document.createElement('b');
    if (href) detail.href = href;
    detail.textContent = value;
    row.append(label, detail);
    return row;
  }
  function renderStoreInfo() {
    const address = String(settings.storeAddress || DEFAULT_SETTINGS.storeAddress).trim();
    $('storeAddressText').textContent = address;
    $('footerAddress').textContent = address.replace('河北张家口怀来', '河北怀来');
    $('businessHoursText').textContent = settings.businessHours || '';
    $('businessHoursRow').hidden = !settings.businessHours;
    $('parkingText').textContent = settings.parkingInfo || '';
    $('parkingRow').hidden = !settings.parkingInfo;
    const links = [['amapLink', settings.amapUrl], ['baiduLink', settings.baiduUrl]];
    links.forEach(([id, value]) => {
      $(id).hidden = !value;
      if (value) $(id).href = value;
    });
    $('mapActions').hidden = !settings.amapUrl && !settings.baiduUrl;
  }
  function renderContacts() {
    const sales = contacts.filter(contact => contact.type === 'sales');
    const designers = contacts.filter(contact => contact.type === 'designer');
    $('salesGrid').replaceChildren(...sales.map(makeContactCard));
    $('designerGrid').replaceChildren(...designers.map(makeContactCard));
    $('salesEmpty').hidden = Boolean(sales.length);
    $('designerEmpty').hidden = Boolean(designers.length);
    renderStoreInfo();
  }

  function setView(view) {
    state.view = view;
    const viewMap = {
      products: 'catalogView', huangma: 'huangmaView', spaces: 'spacesView', woods: 'woodsView',
      creative: 'creativeView', contacts: 'contactsView', collection: 'collectionView'
    };
    Object.entries(viewMap).forEach(([name, id]) => { $(id).hidden = name !== view; });
    document.querySelectorAll('[data-view]').forEach(button => {
      button.classList.toggle('active', button.dataset.view === view);
      button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
    });
    if (view === 'huangma') renderHuangma();
    if (view === 'creative') renderCreative();
    if (view === 'contacts') renderContacts();
    if (view === 'collection') renderCollection();
  }
  function resetFilters() {
    state.room = '全部空间';
    state.category = '全部';
    state.wood = 'all';
    state.query = '';
    $('searchInput').value = '';
    $('woodSelect').value = 'all';
    renderProducts();
  }

  function openDialog(dialog) {
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }
  function closeDialogElement(dialog) {
    if (!dialog.open) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  function displayPrice(value) {
    const text = String(value || '').trim();
    if (!text) return '到店咨询';
    return /^\d/.test(text) ? '¥' + text.replace(/元$/, '') : text;
  }
  function renderFactRows(id, rows) {
    $(id).replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'detail-fact-row';
      const key = document.createElement('span');
      key.textContent = label;
      const detail = document.createElement('strong');
      detail.textContent = value || '待确认';
      row.append(key, detail);
      return row;
    }));
  }
  function updateDetailSave() {
    if (!current) return;
    $('detailSave').textContent = favorites.has(current.id) ? '已加入 · 点击移出' : '加入选品清单';
  }
  function updateImage() {
    if (!current) return;
    const images = productImages(current);
    if (!images.length) return;
    imageIndex = (imageIndex + images.length) % images.length;
    const src = images[imageIndex];
    const multi = images.length > 1;
    $('detailImage').src = liveImage(src);
    $('detailImage').alt = current.name + ' 第 ' + (imageIndex + 1) + ' 张' + (current.real ? '展厅实拍' : '款式示意');
    $('imageCaption').textContent = (current.real ? '展厅实拍' : '款式示意') + ' · 第 ' + (imageIndex + 1) + ' / ' + images.length + ' 张';
    $('imageCounter').textContent = (imageIndex + 1) + ' / ' + images.length;
    $('prevImage').hidden = $('nextImage').hidden = !multi;
    $('galleryDots').hidden = $('imageCounter').hidden = $('galleryThumbs').hidden = !multi;
    const dots = images.map((_, index) => {
      const button = document.createElement('button');
      button.className = 'gallery-dot' + (index === imageIndex ? ' active' : '');
      button.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 张照片');
      button.setAttribute('aria-current', index === imageIndex ? 'true' : 'false');
      button.onclick = () => { imageIndex = index; updateImage(); };
      return button;
    });
    $('galleryDots').replaceChildren(...dots);
    const thumbs = images.map((path, index) => {
      const button = document.createElement('button');
      button.className = 'gallery-thumb' + (index === imageIndex ? ' active' : '');
      button.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 张照片');
      button.setAttribute('aria-pressed', index === imageIndex ? 'true' : 'false');
      const image = document.createElement('img');
      image.src = liveImage(path);
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
      button.onclick = () => { imageIndex = index; updateImage(); };
      return button;
    });
    $('galleryThumbs').replaceChildren(...thumbs);
    if ($('imageViewer').open) updateViewer();
  }
  function updateViewer() {
    if (!current) return;
    const images = productImages(current);
    if (!images.length) return;
    $('viewerImage').src = liveImage(images[imageIndex]);
    $('viewerImage').alt = current.name + ' 第 ' + (imageIndex + 1) + ' 张放大照片';
    $('viewerTitle').textContent = current.name;
    $('viewerCounter').textContent = (imageIndex + 1) + ' / ' + images.length;
    $('viewerPrev').hidden = $('viewerNext').hidden = images.length < 2;
  }
  function stepImage(delta) {
    if (!current) return;
    const count = productImages(current).length;
    if (count < 2) return;
    imageIndex = (imageIndex + delta + count) % count;
    updateImage();
  }
  function openImageViewer() {
    if (!current) return;
    updateViewer();
    openDialog($('imageViewer'));
  }
  function closeImageViewer() {
    closeDialogElement($('imageViewer'));
  }
  function openDetail(product, options = {}) {
    current = product;
    imageIndex = 0;
    if (!options.fromRoute) {
      const hash = '#product=' + encodeURIComponent(product.id);
      if (location.hash !== hash) {
        history.pushState({ laowuProduct: product.id }, '', hash);
        detailPushed = true;
      }
    } else {
      detailPushed = false;
    }
    const images = productImages(product);
    const price = displayPrice(product.price);
    $('detailPrice').textContent = price;
    $('detailTitle').textContent = product.name;
    $('detailCode').textContent = product.id + ' · ' + product.room;
    $('detailDescription').textContent = product.desc || '这款产品的更多工艺说明正在整理，可先查看全部照片并咨询门店。';
    renderFactRows('detailBasicFacts', [
      ['分类', product.category], ['编号', product.id], ['销售价', price],
      ['现货 / 定制', product.availability], ['预计周期', product.leadTime],
      ['产品照片', images.length + ' 张，可逐张放大']
    ]);
    renderFactRows('detailProductFacts', [
      ['木材', product.real ? product.wood : '款式示意，木材可沟通'],
      ['尺寸规格', product.size || '待门店补充'], ['使用空间', product.room],
      ['可改项目', product.options || '待门店补充'],
      ['图片来源', product.real ? '店方提供 · 展厅实拍' : '款式示意 · 非材质实拍']
    ]);
    $('shareFallback').hidden = true;
    $('detailDialog').querySelector('.demo').textContent = product.real
      ? '展厅实拍。实物木色可能受拍摄光线和屏幕影响，材质、尺寸、价格及库存请到店确认。'
      : '演示款式与 AI 示意图片，非材质实拍。具体方案与报价需确认。';
    updateImage();
    updateDetailSave();
    openDialog($('detailDialog'));
    document.body.classList.add('detail-open');
    $('detailScroll').scrollTop = 0;
    updateMetaForProduct(product);
  }
  function closeDetail(syncHistory = true) {
    if (syncHistory && detailPushed && /^#product=/.test(location.hash)) {
      detailPushed = false;
      history.back();
      return;
    }
    if (syncHistory && /^#product=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    if (syncHistory) {
      const url = new URL(location.href);
      if (url.searchParams.has('product')) {
        url.searchParams.delete('product');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }
    detailPushed = false;
    closeImageViewer();
    closeDialogElement($('detailDialog'));
    document.body.classList.remove('detail-open');
    current = null;
    updateDefaultMeta();
  }

  async function copyText(text, fallback, successMessage = '已复制，可粘贴到微信') {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      $('globalCopyFallback').hidden = true;
      notify(successMessage);
    } catch (error) {
      const target = $('globalCopyFallback') || fallback;
      target.value = text;
      target.hidden = false;
      target.focus();
      target.select();
      notify('请长按或选中文字复制');
    }
  }
  function directListUrl(list) {
    const url = new URL('/', location.origin);
    url.searchParams.set('list', list.map(product => product.id).join(','));
    return url.href;
  }
  function collectionPayload(list = collectionProducts()) {
    const ids = list.map(product => product.id);
    const url = new URL('/share', location.origin);
    url.searchParams.set('list', ids.join(','));
    const names = list.slice(0, 3).map(product => product.name).join('、');
    const extra = list.length > 3 ? '等 ' + list.length + ' 款' : '';
    return {
      title: settings.shareTitle || DEFAULT_SETTINGS.shareTitle,
      text: '我在青年老吴实木工厂店选了 ' + names + extra + '，点开可查看完整图片和产品详情。',
      url: url.href,
      ids
    };
  }
  function productPayload(product) {
    const url = new URL('/share', location.origin);
    url.searchParams.set('product', product.id);
    return {
      title: product.name + '｜青年老吴实木工厂店',
      text: product.name + '｜编号 ' + product.id + '｜' + product.availability + '｜' + product.leadTime,
      url: url.href,
      ids: [product.id]
    };
  }
  async function sharePayload(payload, kind) {
    const inWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (inWechat) {
      preShareUrl = location.href;
      history.replaceState({ laowuShare: true }, '', payload.url);
      openWechatShareGuide(payload, true, kind);
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        notify('已打开系统分享菜单，可选择微信');
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
    openWechatShareGuide(payload, false, kind);
  }
  function openWechatShareGuide(payload, inWechat, kind) {
    pendingShare = payload;
    $('wechatFallback').hidden = true;
    $('wechatShareTitle').textContent = inWechat ? '在微信中分享' + (kind === 'product' ? '这款产品' : '选品清单') : '把' + (kind === 'product' ? '产品' : '选品清单') + '发到微信';
    $('wechatShareIntro').textContent = inWechat ? '分享卡片已准备好标题、简介和缩略图。' : '当前浏览器没有提供系统分享菜单，可以复制链接后发送到微信。';
    $('wechatShareSteps').innerHTML = inWechat
      ? '点击右上角 <strong>···</strong>，再选 <strong>发送给朋友</strong> 或 <strong>分享到朋友圈</strong>。'
      : '点击 <strong>复制分享链接</strong>，打开微信并粘贴发送；对方点开后会看到完整内容。';
    $('copyWechatLink').textContent = '复制分享链接';
    $('posterFromWechat').textContent = kind === 'product' ? '生成产品海报' : '生成选品海报';
    openDialog($('wechatShareDialog'));
  }

  function openConsult(type, context) {
    consultContext = { type, ...context };
    const people = contacts.filter(contact => contact.type === type);
    $('consultTitle').textContent = type === 'designer' ? '选择设计师沟通' : '选择销售咨询';
    $('consultIntro').textContent = type === 'designer'
      ? '选择一位设计师，复制需求内容与联系方式后继续沟通。'
      : '选择一位店内销售，复制带产品编号的咨询内容后继续沟通。';
    $('consultContextText').textContent = context.summary;
    $('consultStaffGrid').replaceChildren(...people.map(contact => {
      const card = document.createElement('article');
      card.className = 'consult-staff-card';
      const image = document.createElement('img');
      image.src = liveImage(contact.image);
      image.alt = contact.name + '个人照片';
      const copy = document.createElement('div');
      const name = document.createElement('h3');
      name.textContent = contact.name;
      const title = document.createElement('p');
      title.textContent = contact.title || (type === 'designer' ? '空间设计师' : '店内销售');
      copy.append(name, title);
      const button = document.createElement('button');
      button.className = 'primary';
      button.textContent = contact.wechat ? '复制微信号与咨询内容' : (contact.phone ? '复制咨询内容并拨号' : '复制咨询内容');
      button.onclick = async () => {
        const contactText = contact.wechat ? '\n微信：' + contact.wechat : (contact.phone ? '\n电话：' + contact.phone : '');
        await copyText(context.message + '\n对接人：' + contact.name + contactText, $('copyFallback'), '咨询内容已复制，打开微信搜索 ' + (contact.wechat || contact.name));
        if (!contact.wechat && contact.phone) location.href = 'tel:' + contact.phone.replace(/[^0-9+]/g, '');
      };
      card.append(image, copy, button);
      return card;
    }));
    $('consultEmpty').hidden = Boolean(people.length);
    openDialog($('consultDialog'));
  }

  function loadCanvasImage(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      const timer = setTimeout(() => resolve(null), 6000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = new URL(liveImage(src), location.origin).href;
    });
  }
  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }
  function drawCover(ctx, image, x, y, width, height) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, 18);
    ctx.clip();
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(x, y, width, height);
    if (image) {
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    }
    ctx.restore();
  }
  function drawQr(ctx, text, x, y, size) {
    if (!window.LaowuQR || typeof window.LaowuQR.matrix !== 'function') throw new Error('二维码组件未加载');
    const matrix = window.LaowuQR.matrix(text, 'M');
    const quiet = 4;
    const total = matrix.length + quiet * 2;
    const cell = Math.floor(size / total);
    const actual = cell * total;
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, actual, actual);
    ctx.fillStyle = '#173b30';
    matrix.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
      if (dark) ctx.fillRect(x + (columnIndex + quiet) * cell, y + (rowIndex + quiet) * cell, cell, cell);
    }));
    return actual;
  }
  async function generatePoster(list) {
    if (!list.length) { notify('先选择喜欢的家具'); return; }
    closeWechatShareGuide();
    $('posterPreview').hidden = true;
    $('downloadPoster').hidden = true;
    $('posterStatus').hidden = false;
    $('posterStatus').textContent = '正在生成带二维码的选品海报…';
    openDialog($('posterDialog'));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const shown = list.slice(0, 6);
      const rows = Math.ceil(shown.length / 2);
      const width = 1080;
      const cardHeight = 300;
      const height = 245 + rows * cardHeight + 285;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f5f1e8';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#173b30';
      ctx.fillRect(0, 0, width, 202);
      ctx.fillStyle = '#d8c3a0';
      ctx.font = '500 24px sans-serif';
      ctx.fillText('QINGNIAN LAOWU · WOODWORK', 64, 66);
      ctx.fillStyle = '#fff';
      ctx.font = '600 54px "PingFang SC", sans-serif';
      ctx.fillText(list.length === 1 ? '我喜欢的这款家具' : '我的原木家具选品清单', 64, 136);
      ctx.fillStyle = '#d7e0dc';
      ctx.font = '26px sans-serif';
      ctx.fillText('25年实体家具经验 · 自有工厂 · 实体展厅', 64, 177);
      const images = await Promise.all(shown.map(product => loadCanvasImage(product.image)));
      shown.forEach((product, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 54 + column * 500;
        const y = 232 + row * cardHeight;
        drawCover(ctx, images[index], x, y, 462, 205);
        ctx.fillStyle = '#262921';
        ctx.font = '600 29px "PingFang SC", sans-serif';
        const name = product.name.length > 14 ? product.name.slice(0, 13) + '…' : product.name;
        ctx.fillText(name, x, y + 246);
        ctx.fillStyle = '#776e61';
        ctx.font = '22px sans-serif';
        ctx.fillText('编号 ' + product.id + ' · ' + product.availability, x, y + 279);
      });
      const footerY = 244 + rows * cardHeight;
      ctx.strokeStyle = '#d6cec0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(54, footerY);
      ctx.lineTo(1026, footerY);
      ctx.stroke();
      const qrUrl = list.length === 1
        ? new URL('/?product=' + encodeURIComponent(list[0].id), location.origin).href
        : directListUrl(list);
      const qrSize = drawQr(ctx, qrUrl, 64, footerY + 35, 205);
      ctx.fillStyle = '#173b30';
      ctx.font = '600 37px "PingFang SC", sans-serif';
      ctx.fillText('扫码查看完整图片与产品详情', 310, footerY + 89);
      ctx.fillStyle = '#5f655e';
      ctx.font = '25px sans-serif';
      ctx.fillText('青年老吴实木工厂店', 310, footerY + 137);
      ctx.fillText(String(settings.storeAddress || DEFAULT_SETTINGS.storeAddress), 310, footerY + 177);
      if (list.length > shown.length) ctx.fillText('海报展示前 6 款，扫码查看全部 ' + list.length + ' 款', 310, footerY + 217);
      ctx.fillStyle = '#9a8c78';
      ctx.font = '18px sans-serif';
      ctx.fillText('木材、尺寸、价格与周期以门店最终确认信息为准', 64, height - 28);
      const dataUrl = canvas.toDataURL('image/png', 0.96);
      $('posterPreview').src = dataUrl;
      $('posterPreview').hidden = false;
      $('downloadPoster').href = dataUrl;
      $('downloadPoster').download = '青年老吴-' + (list.length === 1 ? list[0].id : '选品清单') + '.png';
      $('downloadPoster').hidden = false;
      $('posterStatus').hidden = true;
    } catch (error) {
      $('posterStatus').textContent = '海报生成失败，请刷新页面后重试。';
    }
  }

  function setMeta(property, content) {
    const element = document.querySelector('meta[property="' + property + '"],meta[name="' + property + '"]');
    if (element) element.setAttribute('content', content);
  }
  function absoluteImage(path) {
    return new URL(liveImage(path || 'products/showroom/logo.webp'), location.origin).href;
  }
  function updateDefaultMeta() {
    document.title = settings.shareTitle || DEFAULT_SETTINGS.shareTitle;
    setMeta('description', settings.shareDescription || DEFAULT_SETTINGS.shareDescription);
    setMeta('og:title', settings.shareTitle || DEFAULT_SETTINGS.shareTitle);
    setMeta('og:description', settings.shareDescription || DEFAULT_SETTINGS.shareDescription);
    setMeta('og:image', absoluteImage(settings.shareImage || settings.heroImage));
  }
  function updateMetaForProduct(product) {
    const title = product.name + '｜青年老吴实木工厂店';
    const description = '编号 ' + product.id + ' · ' + product.availability + ' · ' + product.leadTime + ' · 点击查看全部产品照片与规格。';
    document.title = title;
    setMeta('description', description);
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', absoluteImage(product.image));
  }

  const rooms = unique(['全部空间', ...settings.rooms, '餐厅', '卧室', '客厅', '厨房', '茶室', ...customerProducts().filter(product => product.brand === '原木家具').map(product => product.room)]);
  rooms.forEach(room => {
    const button = document.createElement('button');
    button.dataset.room = room;
    button.textContent = room;
    button.onclick = () => { state.room = room; state.category = '全部'; renderProducts(); };
    $('rooms').append(button);
  });
  const categories = unique(['全部', ...settings.categories, ...customerProducts().filter(product => product.brand === '原木家具').map(product => product.category)]).filter(category => category !== '其他');
  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'pill';
    button.dataset.category = category;
    button.textContent = category;
    button.onclick = () => { state.category = category; renderProducts(); };
    $('categories').append(button);
  });
  $('woodSelect').innerHTML = '<option value="all">全部木材</option><option value="unconfirmed">实拍 · 木材待确认</option>' + allWoods.map(wood => '<option>' + escapeHTML(wood) + '</option>').join('');
  allWoods.forEach((wood, index) => {
    const card = document.createElement('article');
    card.className = 'woodcard';
    card.innerHTML = '<span class="number">' + String(index + 1).padStart(2, '0') + '</span><h3>' + escapeHTML(wood) + '</h3><p>木色、纹理与手感需要看实样。这里先从材种进入，查看目前对应家具。</p><button class="plain">查看相关家具 ↗</button>';
    card.querySelector('button').onclick = () => { resetFilters(); state.wood = wood; $('woodSelect').value = wood; setView('products'); renderProducts(); };
    $('woodGrid').append(card);
  });

  const hero = document.querySelector('.hero-cinematic');
  const heroCopy = document.querySelector('.hero-cinematic-copy');
  if (hero && settings.heroImage) hero.style.setProperty('background-image', 'url(' + JSON.stringify(liveImage(settings.heroImage)) + ')', 'important');
  let scrollTick = false;
  function syncScrollMotion() {
    scrollTick = false;
    if (!hero || !heroCopy) return;
    const rect = hero.getBoundingClientRect();
    const height = Math.max(1, hero.offsetHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / (height * 0.88)));
    heroCopy.style.transform = 'translate3d(0,' + (28 - 76 * progress) + 'px,0)';
    heroCopy.style.opacity = String(Math.max(0, 1 - progress * 1.08));
  }
  window.addEventListener('scroll', () => {
    if (!scrollTick) { scrollTick = true; requestAnimationFrame(syncScrollMotion); }
  }, { passive: true });
  window.addEventListener('resize', syncScrollMotion);

  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view); });
  $('searchInput').oninput = event => { state.query = event.target.value.trim(); renderProducts(); };
  $('woodSelect').onchange = event => { state.wood = event.target.value; renderProducts(); };
  $('resetFilters').onclick = $('emptyReset').onclick = resetFilters;
  $('collectionBtn').onclick = () => { state.sharedIds = null; setView('collection'); };
  $('backCatalog').onclick = $('startPicking').onclick = () => { state.sharedIds = null; setView('products'); };
  $('closeDialog').onclick = () => closeDetail();
  $('detailDialog').addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  $('detailSave').onclick = () => { if (current) toggleFavorite(current.id); };
  $('zoomImage').onclick = openImageViewer;
  $('detailImageButton').onclick = () => { if (Date.now() - lastSwipe > 400) openImageViewer(); };
  $('prevImage').onclick = () => stepImage(-1);
  $('nextImage').onclick = () => stepImage(1);
  $('closeViewer').onclick = closeImageViewer;
  $('viewerPrev').onclick = () => stepImage(-1);
  $('viewerNext').onclick = () => stepImage(1);
  $('imageViewer').addEventListener('cancel', event => { event.preventDefault(); closeImageViewer(); });
  ['detailMainMedia', 'imageViewer'].forEach(id => {
    $(id).addEventListener('touchstart', event => {
      touchTracking = event.touches.length === 1;
      if (touchTracking) { touchStartX = event.touches[0].clientX; touchStartY = event.touches[0].clientY; }
    }, { passive: true });
    $(id).addEventListener('touchend', event => {
      if (!touchTracking || !event.changedTouches.length) { touchTracking = false; return; }
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      touchTracking = false;
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        lastSwipe = Date.now();
        stepImage(deltaX > 0 ? -1 : 1);
      }
    }, { passive: true });
  });
  document.addEventListener('keydown', event => {
    if (!current || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    stepImage(event.key === 'ArrowLeft' ? -1 : 1);
  });
  $('shareProduct').onclick = () => { if (current) sharePayload(productPayload(current), 'product'); };
  $('copyCollection').onclick = () => {
    const list = collectionProducts();
    const lines = list.map(product => product.id + ' ' + product.name + '｜' + product.availability + '｜' + product.size);
    copyText('青年老吴实木工厂店 · 我的选品清单\n' + lines.join('\n') + '\n' + directListUrl(list) + '\n实际尺寸、木材、价格与周期请与门店确认。', $('copyFallback'));
  };
  $('shareCollection').onclick = () => { const list = collectionProducts(); if (list.length) sharePayload(collectionPayload(list), 'collection'); };
  $('posterCollection').onclick = () => generatePoster(collectionProducts());
  $('consultProduct').onclick = () => {
    if (!current) return;
    openConsult('sales', {
      summary: current.name + '\n编号：' + current.id + ' · ' + current.availability + ' · ' + current.leadTime,
      message: '我想咨询这款家具：\n' + current.id + ' ' + current.name + '\n所需尺寸：\n喜欢的木材：\n使用空间：\n请提供库存 / 周期与报价。'
    });
  };
  $('caseConsult').onclick = () => openConsult('designer', {
    summary: currentCase ? currentCase.title : '原木全屋定制',
    message: '我想了解原木全屋定制\n所在城市：\n房屋面积 / 户型：\n需定制的空间：\n喜欢的木材 / 风格：\n计划时间：'
  });
  $('consultOpenContacts').onclick = () => { closeDialogElement($('consultDialog')); setView('contacts'); };
  $('closeConsult').onclick = () => closeDialogElement($('consultDialog'));
  $('consultDialog').onclick = event => { if (event.target === $('consultDialog')) closeDialogElement($('consultDialog')); };
  $('closeCase').onclick = () => closeDialogElement($('caseDialog'));
  $('caseDialog').onclick = event => { if (event.target === $('caseDialog')) closeDialogElement($('caseDialog')); };
  $('copyWechatLink').onclick = () => { if (pendingShare) copyText(pendingShare.text + '\n' + pendingShare.url, $('wechatFallback')); };
  $('posterFromWechat').onclick = () => { if (pendingShare) generatePoster(pendingShare.ids.map(productById).filter(Boolean)); };
  function closeWechatShareGuide() {
    closeDialogElement($('wechatShareDialog'));
    if (preShareUrl) {
      history.replaceState(null, '', preShareUrl);
      preShareUrl = '';
    }
  }
  $('closeWechatShare').onclick = $('doneWechatShare').onclick = closeWechatShareGuide;
  $('wechatShareDialog').addEventListener('cancel', event => { event.preventDefault(); closeWechatShareGuide(); });
  $('wechatShareDialog').onclick = event => { if (event.target === $('wechatShareDialog')) closeWechatShareGuide(); };
  $('closePoster').onclick = () => closeDialogElement($('posterDialog'));
  $('posterDialog').addEventListener('cancel', event => { event.preventDefault(); closeDialogElement($('posterDialog')); });

  function syncProductRoute() {
    try {
      const queryId = new URL(location.href).searchParams.get('product');
      const hashMatch = location.hash.match(/^#product=(.+)$/);
      const id = queryId || (hashMatch ? decodeURIComponent(hashMatch[1]) : '');
      if (id) {
        const product = productById(id);
        if (product && (!current || current.id !== product.id || !$('detailDialog').open)) openDetail(product, { fromRoute: true });
        return;
      }
      if ($('detailDialog').open) closeDetail(false);
    } catch (error) {}
  }
  function openSharedList() {
    const url = new URL(location.href);
    const legacy = location.hash.match(/^#list=(.+)$/);
    const raw = url.searchParams.get('list') || (legacy ? legacy[1] : '');
    if (!raw) return;
    const ids = unique(raw.split(',')).filter(id => productById(id));
    state.sharedIds = ids;
    setView('collection');
    renderCollection();
    notify('正在查看分享清单，点击 ♡ 可保存到自己的清单');
  }

  renderCases();
  renderHuangma();
  renderCreative();
  renderContacts();
  updateSaved();
  renderProducts();
  renderCollection();
  updateDefaultMeta();
  syncScrollMotion();
  openSharedList();
  syncProductRoute();
  window.addEventListener('hashchange', () => { openSharedList(); syncProductRoute(); });
  window.addEventListener('popstate', () => { openSharedList(); syncProductRoute(); });
})();

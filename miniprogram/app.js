App({
  globalData: {baseUrl: 'https://qingnian-laowu.netlify.app', catalog: null},
  loadCatalog() {
    if (this.globalData.catalog) return Promise.resolve(this.globalData.catalog);
    return new Promise((resolve, reject) => wx.request({
      url: this.globalData.baseUrl + '/api/live-catalog',
      success: ({statusCode, data}) => { if (statusCode === 200 && data && Array.isArray(data.products)) { this.globalData.catalog = data; resolve(data); } else reject(new Error('catalog')); },
      fail: reject
    }));
  },
  imageUrl(path) { const value=String(path||'').replace(/^\//,'');return this.globalData.baseUrl+(value.startsWith('products/uploads/')?'/media/':'/')+value; },
  favorites() { try { return wx.getStorageSync('favorites') || []; } catch (e) { return []; } },
  toggleFavorite(id) { const set = new Set(this.favorites()); set.has(id) ? set.delete(id) : set.add(id); const list = [...set]; wx.setStorageSync('favorites', list); return list; }
});

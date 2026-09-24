const app = getApp();
Page({
  data:{loading:true,brand:'原木家具',brands:['原木家具','皇玛康之家','展厅惠品','文创产品'],products:[],hero:''},
  onLoad(){this.load()}, onPullDownRefresh(){app.globalData.catalog=null;this.load().finally(()=>wx.stopPullDownRefresh())},
  load(){this.setData({loading:true});return app.loadCatalog().then(data=>{this.catalog=data;this.setData({hero:app.imageUrl(data.settings.heroImage),loading:false});this.filter()}).catch(()=>{this.setData({loading:false});wx.showToast({title:'资料加载失败',icon:'none'})})},
  filter(){const products=(this.catalog.products||[]).filter(p=>p.visible!==false&&p.brand===this.data.brand).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||(a.sortOrder||0)-(b.sortOrder||0)).map(p=>({...p,imageUrl:app.imageUrl(p.image)}));this.setData({products})},
  chooseBrand(e){this.setData({brand:e.currentTarget.dataset.brand});this.filter()},
  openProduct(e){wx.navigateTo({url:'/pages/product/product?id='+encodeURIComponent(e.currentTarget.dataset.id)})},
  onShareAppMessage(){const s=(this.catalog&&this.catalog.settings)||{};return{title:s.shareTitle||'青年老吴实木家具｜在线选品',path:'/pages/home/home',imageUrl:app.imageUrl(s.shareImage||s.heroImage)}}
});

// Customer order links preserve the signed Telegram launch when opening the receipt.
{const tg=window.Telegram?.WebApp,start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';if(/^(order|manage)_[a-f0-9]{32}$/.test(start)){const target=new URL((start.startsWith('manage_')?'orders.html?order='+start.slice(7):'my-order.html?order='+start.slice(6)),location.href),fragment=new URLSearchParams();fragment.set('tgWebAppData',tg?.initData||'');fragment.set('tgWebAppVersion',tg?.version||'8.0');fragment.set('tgWebAppPlatform',tg?.platform||'unknown');target.hash=fragment.toString();location.replace(target.href);}}
const $ = s => document.querySelector(s);
const products = window.ACEFORM_CATALOG;
const sizes = ['S','M','L'];
const tg = window.Telegram?.WebApp;
if (tg?.initData) {try {tg.ready();tg.expand();tg.setHeaderColor('#f7f7f0');tg.setBackgroundColor('#f7f7f0');}catch {}}
let state = {product:0,color:0,size:'M',quantity:1,mode:'query',filter:'all',bundle:'white',shortsSize:'M',shortsSizeCustomized:false,sizeChosen:false,shortsColor:'white'};
const commerce=window.ACEFORM_COMMERCE;
{const start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'',m=start.match(/^ask_(top|skirt)_([0-5])_(S|M|L)$/);if(m){const i=products.findIndex(p=>p.id===m[1]);if(i>=0&&products[i].colors[Number(m[2])]){state.product=i;state.color=Number(m[2]);state.size=m[3];state.shortsSize=m[3];}}}
let checkoutSettings={includedShorts:'unknown'};
let inventory = [], receivedAt = 0, feedState = 'loading', pendingStock = null, requestSelection = null;
const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
function current() {return products[state.product];}
function trackAction(event){window.ACEFORM_ANALYTICS?.track(event,{product:current().id,color:state.color,size:state.size,bundle:current().id==='dress'?state.bundle:''});}
function variant() {
 if(feedState !== 'ready' || Date.now()-receivedAt>90000)return null;
 const p=current(), matches=inventory.filter(v=>v.product===(p.stockName||p.name)&&v.color===p.colors[state.color][0]&&v.size===state.size);
 return matches.length===1?matches[0]:null;
}
function photo(p,ci,card=false) {
 const c=p.colors[ci];
 if(p.id==='shorts')return `<div class="shorts-pair" style="background-position:${ci===0?'left':'right'} center" role="img" aria-label="${p.name}, ${c[0]}"></div>`;
 if(!c[2])return `<div class="shorts-sketch"><svg viewBox="0 0 200 200" role="img" aria-label="Эскиз чёрных шорт"><path fill="#252827" stroke="#777" d="M53 46h94l12 117h-49l-10-62-10 62H41z"/><path fill="none" stroke="#777" d="M53 58h94M100 59v42"/></svg><small>Эскиз · фото скоро</small></div>`;
 const css=/-catalog(?:-v\d+)?\./.test(c[2])?'catalog-photo':p.id==='dress'&&ci===0?'black-photo':p.id==='top'?'top-photo':p.id==='skirt'?'skirt-photo':p.id==='shorts'?'shorts-photo':'';
 return `<img class="garment-photo ${css}" src="${c[2]}" alt="${p.name}, ${c[0]}" ${card?'loading="lazy"':''}>`;
}
function buttons(el,values,selected,fn,swatches=false) {
 el.replaceChildren();values.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className=(swatches?'swatch':'option')+(i===selected?' selected':'');const label=Array.isArray(v)?v[0]:v;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',i===selected);if(swatches)b.style.setProperty('--color',v[1]);else b.textContent=label;b.onclick=()=>fn(i);el.append(b)});
}
function preorderOnly(p=current()) {return commerce.preorderOnly(p);}
function stockFresh() {return feedState==='ready'&&Date.now()-receivedAt<=90000;}
// Keep the last confirmed catalog selection while refreshing. Checkout still requires fresh stock.
function stockRows(p) {return commerce.stockRows(p,inventory,receivedAt>0);}
function inStock() {return commerce.inStock(current(),variant(),stockFresh());}
function bundleLimit() {return commerce.bundleLimit(state.bundle,state.shortsSize,inventory,checkoutSettings.includedShorts,variant()?.quantity||0);}
function orderLimit() {return state.mode==='stock'?(current().id==='dress'?bundleLimit():commerce.orderLimit(current(),variant())):99;}
function visibleProducts() {return products.filter(p=>commerce.matchesFilter(p,state.filter,inventory,receivedAt>0));}
function bundleNeedsConfirmation() {return current().id==='dress'&&(state.shortsSize!==state.size||bundleLimit()<1);}
function unitPrice() {return preorderOnly()?null:commerce.unitPrice(current(),state.bundle,variant());}
function totalPrice(){const subtotal=unitPrice()*state.quantity;return subtotal-(window.ACEFORM_CERTIFICATE?.discount(subtotal)||0);}
window.ACEFORM_CERTIFICATE_RENDER=()=>render();
function selectProduct(i) {
 state.product=i;state.color=0;state.quantity=1;state.mode='query';
 if(state.filter==='stock'){
  const v=stockRows(current())[0];
  if(v){state.color=current().colors.findIndex(c=>c[0]===v.color);state.size=v.size;state.shortsSize=v.size;state.shortsSizeCustomized=false;}
 }
}
function availability() {
 if(preorderOnly())return {label:'Предзаказ',kind:'preorder'};
 if(current().id==='shorts')return {label:'В наличии',kind:'available'};
 const v=variant();
 if(!v || v.quantity===null)return {label:'Наличие уточняется',kind:'unknown'};
 if(v.quantity>0&&bundleNeedsConfirmation())return {label:'Платье в наличии · комплектация уточняется',kind:'unknown'};
 if(v.quantity>0)return {label:'В наличии',kind:'available'};
 return {label:v.preorder===true?'Предзаказ':v.preorder===false?'Нет в наличии':'Предзаказ уточняется',kind:v.preorder===true?'preorder':'unknown'};
}
function render() {
 const visible=visibleProducts();
 if(visible.length&&!visible.includes(current()))selectProduct(products.indexOf(visible[0]));
 if(state.filter==='stock'&&visible.length&&!stockRows(current()).some(v=>v.color===current().colors[state.color][0]&&v.size===state.size))selectProduct(state.product);
 const p=current(),v=variant(),a=availability(),hasSelection=visible.length>0;const isDress=p.id==='dress',inquiry=preorderOnly(p);$('#inquiryIntro').hidden=!inquiry;$('#inquiryTitle').textContent=p.name;$('#quantityAdvanced').hidden=inquiry;if(inquiry)state.quantity=1;$('#productDetails').classList.toggle('dress-flow',isDress);$('#productDetails').classList.toggle('inquiry-flow',inquiry);$('#dressIntro').hidden=!isDress;$('#dressAnswers').hidden=!isDress;$('#dressCheckoutHint').hidden=!isDress;$('#fitGallery').querySelector('h2').textContent=isDress?'Другие ракурсы и детали':'На фигуре';$('#generalNote').hidden=isDress||inquiry;$('#generalDeliveryNote').hidden=isDress||inquiry;$('#sizeHint').textContent=isDress?(state.sizeChosen?'Размер платья: '+state.size+'. Шорты: '+state.shortsSize+'.':'Выбери свой размер. Шорты будут того же размера.'):inquiry?'Если сомневаешься в размере, поможем подобрать при ответе.':'Размер можно уточнить при согласовании предзаказа.';window.ACEFORM_ANALYTICS?.view({product:p.id,color:state.color,size:state.size,bundle:p.id==='dress'?state.bundle:''});
 if(isDress){$('#dressAnswers').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else if(inquiry){$('#purchaseOptions').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else{$('#purchaseOptions').before($('#fitGallery'));$('#purchaseOptions').before($('#productStory'));}$('#quantityAdvanced').querySelector('summary').textContent=isDress?'Количество комплектов':'Количество';$('#productDetails').hidden=!hasSelection;$('#review').disabled=!hasSelection||(isDress&&state.sizeChosen&&feedState==='loading');
 $('#filterHint').textContent=state.filter==='stock'?(feedState==='loading'?'Обновляем наличие. Выбранный комплект сохранён.':feedState==='error'?'Не удалось подтвердить наличие. Обновите остатки перед оплатой.':hasSelection?'Показаны изделия в наличии. Выберите цвет и размер.':'Сейчас нет изделий с подтверждённым наличием. Посмотрите предзаказ или все изделия.'):'';
 buttons($('#catalogFilters'),['Все','В наличии','Предзаказ'],['all','stock','preorder'].indexOf(state.filter),i=>{state.filter=['all','stock','preorder'][i];state.quantity=1;render()});

 if(preorderOnly())state.mode='preorder';
 if(p.id==='shorts'||(p.id==='dress'&&inStock()&&!bundleNeedsConfirmation()&&state.mode==='query'))state.mode='stock';
 if(state.mode==='stock'&&(!inStock()||bundleNeedsConfirmation()))state.mode='query';
 if(state.mode==='preorder'&&!preorderOnly()&&v?.preorder!==true)state.mode='query';
 if(isDress)state.mode=inStock()&&!bundleNeedsConfirmation()?'stock':v?.quantity===0&&v.preorder===true?'preorder':'query';
 if(state.mode==='stock')state.quantity=Math.min(state.quantity,orderLimit());
 $('#products').replaceChildren();products.forEach((p,i)=>{if(!visible.includes(p))return;const b=document.createElement('button');b.type='button';b.className='product'+(i===state.product?' selected':'');b.setAttribute('aria-pressed',i===state.product);b.innerHTML=`<div class="thumb">${photo(p,state.filter==='stock'?p.colors.findIndex(c=>c[0]===stockRows(p)[0].color):0,true)}<span class="check">✓</span></div><b>${p.name}</b><em>${p.subtitle}</em><span class="card-price">${p.id==='dress'?money(8000)+' · платье + шорты':preorderOnly(p)?'Стоимость и срок — по запросу':'В наличии'}</span>`;b.onclick=()=>{selectProduct(i);render();$('#productDetails').scrollIntoView({behavior:'smooth',block:'start'})};const wrap=document.createElement('div');wrap.className='product-card';const help=document.createElement('button');help.type='button';help.className='size-link card-size';help.textContent='Подобрать размер ↗';help.setAttribute('aria-label','Подобрать размер: '+p.name);help.onclick=()=>{selectProduct(i);render();openSizeGuide()};wrap.append(b,help);$('#products').append(wrap)});
 const copy=window.ACEFORM_DESCRIPTIONS[p.id];
 $('#productStoryTitle').textContent=copy.title;$('#productStoryText').textContent=copy.text;$('#productStoryNote').textContent=inquiry?'Стоимость и срок изготовления сообщим до оформления заказа.':copy.note;
 $('#modelHistoryText').textContent=copy.history;
 $('#productBenefits').replaceChildren();for(const benefit of copy.benefits){const item=document.createElement('li');item.textContent=benefit;$('#productBenefits').append(item)}
 const modelImages=isDress?[...window.ACEFORM_MODELS[p.id][state.color].slice(1),p.colors[state.color][2]]:window.ACEFORM_MODELS[p.id][state.color];$('#fitGallery').hidden=modelImages.length===0;
 const gallery=$('#modelPhotos'),galleryKey=p.id+':'+state.color,previousIndex=gallery.dataset.selection===galleryKey?Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12)):0;gallery.dataset.selection=galleryKey;
 $('#modelPhotos').replaceChildren();
 for(const src of modelImages){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');const view=src===p.colors[state.color][2]?'Изделие':window.ACEFORM_MODEL_VIEWS?.[src]||'На фигуре';img.src=src;img.alt=p.name+', '+p.colors[state.color][0]+' — '+view;img.loading='lazy';img.decoding='async';caption.textContent=view;figure.append(img,caption);$('#modelPhotos').append(figure)}
 gallery.scrollLeft=((gallery.clientWidth||1)+12)*Math.min(previousIndex,modelImages.length-1);$('#galleryControls').hidden=modelImages.length<2;
 const updateGallery=()=>{const i=Math.max(0,Math.min(modelImages.length-1,Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12))));$('#galleryCount').textContent=(i+1)+' / '+modelImages.length;$('#galleryPrev').disabled=i<=0;$('#galleryNext').disabled=i>=modelImages.length-1;};
 gallery.onscroll=updateGallery;$('#galleryPrev').onclick=()=>gallery.scrollBy({left:-(gallery.clientWidth+12),behavior:'smooth'});$('#galleryNext').onclick=()=>gallery.scrollBy({left:gallery.clientWidth+12,behavior:'smooth'});updateGallery();
 $('#dressBundle').hidden=p.id!=='dress';
 buttons($('#bundleOptions'),['Белые','Чёрные'],state.shortsColor==='white'?0:1,i=>{state.shortsColor=i===0?'white':'black';if(state.bundle!=='both')state.bundle=state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()});
 $('#addSecondShorts').checked=state.bundle==='both';$('#addSecondShorts').onchange=e=>{state.bundle=e.target.checked?'both':state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()};
 buttons($('#shortsSizes'),sizes,sizes.indexOf(state.shortsSize),i=>{state.shortsSize=sizes[i];trackAction('size_select');state.shortsSizeCustomized=true;state.quantity=1;state.mode='query';render()});
 $('#bundlePriceNote').textContent=state.bundle==='both'?'EVERT + белые и чёрные MARBLE — 9 500 ₽ за комплект.':'EVERT + одна пара MARBLE — 8 000 ₽ за комплект.';
 $('#studioTitle').textContent=p.name;$('#preview').innerHTML=isDress?`<img class="fit-main" src="${window.ACEFORM_MODELS.dress[state.color][0]}" alt="${p.name}, ${p.colors[state.color][0]} — на фигуре, вид спереди" fetchpriority="high">`:photo(p,state.color);$('#dressOffer').textContent=state.quantity>1?state.quantity+' комплекта · '+money(totalPrice()):'Платье + '+(state.bundle==='both'?'2 пары шорт':'шорты')+' · '+money(totalPrice());$('#colorName').textContent=p.colors[state.color][0];
 buttons($('#colors'),p.colors,state.color,i=>{state.color=i;trackAction('color_select');state.quantity=1;state.mode='query';render()},true);
 buttons($('#sizes'),sizes,isDress&&!state.sizeChosen?-1:sizes.indexOf(state.size),i=>{state.size=sizes[i];state.sizeChosen=true;trackAction('size_select');if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;state.mode='query';render()});
 $('#stockBadge').textContent=inquiry?'Изготовление на заказ':isDress&&!state.sizeChosen?'Выбери размер — проверим наличие':a.label;$('#stockBadge').dataset.kind=a.kind;
 const opts=preorderOnly()?[['preorder','Предзаказ',false]]:p.id==='shorts'?[['stock','В наличии',false]]:[['stock','В наличии',!inStock()||bundleNeedsConfirmation()],['preorder','Предзаказ',v?.preorder!==true],['query','Уточнить',false]];
 $('#orderTypes').replaceChildren();opts.forEach(([mode,label,disabled])=>{const b=document.createElement('button');b.className='option'+(mode===state.mode?' selected':'');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-pressed',mode===state.mode);b.onclick=()=>{state.mode=mode;render()};$('#orderTypes').append(b)});
 const directCheckout=isDress?inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder':canPay();$('#orderTypes').hidden=isDress||inquiry||directCheckout;const orderTitle=$('#orderTypes').previousElementSibling;if(orderTitle)orderTitle.hidden=isDress||inquiry||directCheckout;$('#availabilityHint').hidden=inquiry||directCheckout||(isDress&&(!state.sizeChosen||feedState==='loading'));
 $('#availabilityHint').textContent=bundleNeedsConfirmation()?(v?.quantity>0?'Платье в наличии. Выбранные шорты и комплектацию подтвердим при согласовании.':'Наличие выбранной комплектации и размера шорт подтвердим при согласовании.'):state.mode==='stock'?'В наличии. Резерв подтвердит менеджер.':state.mode==='preorder'?'Предзаказ разрешён. Срок изготовления согласуем с вами.':'Отправьте запрос — подтвердим наличие и возможность изготовления.';
 $('#stockStatus').textContent=feedState==='ready'?`Обновлено ${new Date(receivedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:feedState==='loading'?'Проверяем остатки…':feedState==='unconfigured'?'Подключение остатков настраивается':'Не удалось обновить наличие';
 $('#stockRefresh').disabled=feedState==='loading'||feedState==='unconfigured';
 $('#qty').value=state.quantity;$('#minus').disabled=state.quantity<=1;$('#plus').disabled=state.quantity>=orderLimit();
 $('#price').textContent=inquiry?'Без оплаты · сначала ответим на твой запрос':!hasSelection?'Выберите изделие':unitPrice()!==null?money(totalPrice())+(p.id==='dress'?' за '+(state.quantity===1?'комплект':state.quantity+' компл.'):''):'Стоимость уточняется';
 if(state.filter==='stock') {
  Array.from($('#colors').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[i][0]);});
  Array.from($('#sizes').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[state.color][0]&&v.size===sizes[i]);});
 }

 $('#review').firstChild.textContent=inquiry?'Узнать стоимость и срок ':isDress&&!state.sizeChosen?'Выбрать размер ':isDress&&feedState==='loading'?'Проверяем наличие… ':canPay()?'Купить за '+money(totalPrice())+' ':preorderOnly()||state.mode==='preorder'||a.kind==='preorder'?'Оформить предзаказ ':inStock()?'Собрать комплект ':'Оставить заявку ';
}
window.ACEFORM_receiveStock = payload => {if(pendingStock)pendingStock(payload);};
async function refreshStock() {
 if(feedState==='loading'&&pendingStock)return;
 const url=window.ACEFORM_STOCK_URL;
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'')){feedState='unconfigured';render();return;}
 feedState='loading';render();
 let script,timer;
 try {
  const data=await new Promise((resolve,reject)=>{pendingStock=resolve;timer=setTimeout(()=>reject(Error('timeout')),15000);script=document.createElement('script');script.src=url+'?v='+Date.now();script.onerror=()=>reject(Error('network'));document.head.append(script)});
  if(data?.ok!==true||!Array.isArray(data.items)||data.items.length>1000)throw Error('Invalid feed');
  const seen=new Set();for(const v of data.items){if(!products.some(p=>(p.stockName||p.name)===v.product)||!sizes.includes(v.size)||typeof v.color!=='string'||!(v.quantity===null||Number.isSafeInteger(v.quantity)&&v.quantity>=0)||!(v.price===null||Number.isFinite(v.price)&&v.price>=0)||![true,false,null].includes(v.preorder))throw Error('Invalid variant');const key=[v.product,v.color,v.size].join('|');if(seen.has(key))throw Error('Duplicate variant');seen.add(key);}
  checkoutSettings={includedShorts:['white','black','either'].includes(data.checkout?.includedShorts)?data.checkout.includedShorts:'unknown'};
  inventory=data.items;receivedAt=Date.now();feedState='ready';
 } catch {feedState='error';}
 finally {clearTimeout(timer);script?.remove();pendingStock=null;render();}
}
function details() {const p=current(),price=unitPrice(),subtotal=price===null?null:price*state.quantity,discount=subtotal===null?0:(window.ACEFORM_CERTIFICATE?.discount(subtotal)||0);return [['Изделие',p.name],['Цвет',p.colors[state.color][0]],['Размер',state.size],...(p.id==='dress'?[['Комплектация',state.bundle==='both'?'EVERT + белые и чёрные MARBLE (2 пары)':'EVERT + '+(state.bundle==='white'?'белые':'чёрные')+' MARBLE (1 пара)'],['Размер шорт',state.shortsSize]]:[]),['Формат',state.mode==='stock'?'Из наличия':state.mode==='preorder'?'Предзаказ':'Уточнить наличие'],['Количество',state.quantity+' шт.'],['Стоимость',subtotal!==null?money(subtotal):'Уточняется'],...(discount?[['Сертификат ACEFORM','−'+money(discount)],['Итого',money(subtotal-discount)]]:[])];}
$('#minus').onclick=()=>{state.quantity=Math.max(1,state.quantity-1);render()};$('#plus').onclick=()=>{const max=orderLimit();state.quantity=Math.min(max,state.quantity+1);render()};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#sizesHelp').onclick=openSizeGuide;$('#dressSizeHelp').onclick=openSizeGuide;$('#stockRefresh').onclick=refreshStock;
function canPay() {return current().id==='dress'&&state.sizeChosen&&inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder'&&Number.isSafeInteger(state.quantity)&&state.quantity>0&&state.quantity<=bundleLimit();}
async function submitDirectPayment() {
 if(!canPay())return;trackAction('checkout_attempt');
 const key=[state.color,state.size,state.shortsSize,state.bundle,state.quantity].join('|'),amount=totalPrice();
 let nonce;try{const saved=JSON.parse(sessionStorage.getItem('aceform.checkoutDraft')||'null');nonce=saved?.key===key?saved.nonce:null;}catch{}
 nonce=nonce||window.crypto.randomUUID();try{sessionStorage.setItem('aceform.checkoutDraft',JSON.stringify({key,nonce}));}catch{}
 $('#review').disabled=true;$('#checkoutError').hidden=true;
 try {
  const order=await (window.ACEFORM_CERTIFICATE||window.ACEFORM_PAYMENT_BRIDGE).create({nonce,color:state.color,size:state.size,shortsSize:state.shortsSize,bundle:state.bundle,quantity:state.quantity,analyticsTest:window.ACEFORM_ANALYTICS?.test?'1':'0'});
  if(order.amount!==amount||key!==[state.color,state.size,state.shortsSize,state.bundle,state.quantity].join('|'))throw Error('selection_changed');
  try{sessionStorage.setItem('aceform.pendingPayment',JSON.stringify(order));localStorage.setItem('aceform.latestOrder',JSON.stringify(order));}catch{}
  if(order.state!=='pending'){$('#review').disabled=false;window.ACEFORM_PAYMENT_BRIDGE.show(order);return;}
  const fields=window.ACEFORM_PAYMENT.fields(order.orderId,order.amount);
  fields.successURL=window.location.origin+window.location.pathname+'#payment='+order.orderId+'.'+order.token;
  for(const [name,value] of Object.entries(fields))$('#walletCheckout').elements.namedItem(name).value=value;
  trackAction('checkout_redirect');window.ACEFORM_ANALYTICS?.sendOnExit();$('#walletCheckout').submit();
 } catch(error){$('#checkoutError').hidden=false;$('#checkoutError').textContent=window.ACEFORM_CERTIFICATE?.error(error.message)||(error.message==='not_available'?'Выбранный комплект уже недоступен. Обновите наличие.':['extra_shorts_unconfirmed','bundle_needs_confirmation'].includes(error.message)?'Наличие выбранных шорт нужно подтвердить. Оставьте заявку на комплект.':'Не удалось подготовить оплату. Деньги не списаны. Попробуйте ещё раз.');$('#review').disabled=false;}
}
$('#review').onclick=()=>{render();if(current().id==='dress'&&!state.sizeChosen){$('#sizeChoice').scrollIntoView({behavior:'smooth',block:'start'});$('#sizeHint').textContent='Выбери S, M или L — или нажми «Подобрать размер».';return;}if(canPay())return submitDirectPayment();trackAction('request_open');requestSelection={product:current().id,color:state.color,size:state.size,shortsSize:state.shortsSize,bundle:state.bundle,quantity:state.quantity,mode:preorderOnly()?'query':state.mode};window.ACEFORM_PREORDER?.open(requestSelection);$('#summary').replaceChildren();for(const [k,v] of details().filter(([k])=>!preorderOnly()||!['Формат','Количество','Стоимость'].includes(k))){const row=document.createElement('div');row.className='order-line';for(const value of [k,v]){const s=document.createElement('span');s.textContent=value;row.append(s)}$('#summary').append(row)}$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden');$('#orderDialog').showModal()};
$('#orderForm').onsubmit=e=>{e.preventDefault();if(requestSelection)window.ACEFORM_PREORDER.submit(requestSelection);};
function openSizeGuide() {
 const p=current(), fields=window.ACEFORM_SIZING.fields(p.id);
 $('#sizeTitle').textContent='Размер: '+p.name;
 $('#sizeResult').textContent='Введите мерки в сантиметрах.';
 $('#applySize').hidden=true;
 for(const key of ['bust','waist','hips']) {
  const input=$('#measure-'+key);input.closest('label').hidden=!fields.includes(key);input.required=fields.includes(key);
 }
 $('#sizeDialog').showModal();
}
let recommendedSize=null;
$('#sizeForm').onsubmit=e=>{
 e.preventDefault();recommendedSize=null;$('#applySize').hidden=true;
 const measurements=Object.fromEntries(['bust','waist','hips'].map(k=>[k,Number($('#measure-'+k).value)]));
 const r=window.ACEFORM_SIZING.recommend(current().id,measurements);
 const messages={missing:'Введите все необходимые мерки.',outside:'Часть мерок вне диапазонов таблицы S–L. Уточните размер при согласовании предзаказа.',mixed:'Мерки соответствуют разным размерам. Уточните посадку при согласовании предзаказа.'};
 $('#sizeResult').textContent=r.kind==='match'?'По вашей таблице подходит размер '+r.size+'.':messages[r.kind];
 if(r.kind==='match'){recommendedSize=r.size;$('#applySize').hidden=false;$('#applySize').textContent='Выбрать '+r.size;}
};
$('#applySize').onclick=()=>{if(recommendedSize){state.size=recommendedSize;state.sizeChosen=true;trackAction('size_select');if(state.filter==='stock'&&!stockRows(current()).some(v=>v.color===current().colors[state.color][0]&&v.size===state.size))state.filter='all';if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;render();$('#sizeDialog').close();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStock()});setInterval(()=>{if(!document.hidden)refreshStock()},60000);render();refreshStock();

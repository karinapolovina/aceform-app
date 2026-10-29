const $ = s => document.querySelector(s);
const products = window.ACEFORM_CATALOG;
const sizes = ['S','M','L'];
const tg = window.Telegram?.WebApp;
if (tg?.initData) {try {tg.ready();tg.expand();tg.setHeaderColor('#f7f7f0');tg.setBackgroundColor('#f7f7f0');}catch {}}
let state = {product:0,color:0,size:'M',quantity:1,mode:'query',filter:'all',bundle:'white',shortsSize:'M',shortsSizeCustomized:false};
const commerce=window.ACEFORM_COMMERCE;
let inventory = [], receivedAt = 0, feedState = 'loading', pendingStock = null, orderText = '';
const money = n => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n);
function current() {return products[state.product];}
function variant() {
 if(feedState !== 'ready' || Date.now()-receivedAt>90000)return null;
 const p=current(), matches=inventory.filter(v=>v.product===p.name&&v.color===p.colors[state.color][0]&&v.size===state.size);
 return matches.length===1?matches[0]:null;
}
function photo(p,ci,card=false) {
 const c=p.colors[ci];
 if(p.id==='shorts')return `<div class="shorts-pair" style="background-position:${ci===0?'left':'right'} center" role="img" aria-label="Шорты, ${c[0]}"></div>`;
 if(!c[2])return `<div class="shorts-sketch"><svg viewBox="0 0 200 200" role="img" aria-label="Эскиз чёрных шорт"><path fill="#252827" stroke="#777" d="M53 46h94l12 117h-49l-10-62-10 62H41z"/><path fill="none" stroke="#777" d="M53 58h94M100 59v42"/></svg><small>Эскиз · фото скоро</small></div>`;
 const css=c[2].includes('-catalog.')?'catalog-photo':p.id==='dress'&&ci===0?'black-photo':p.id==='top'?'top-photo':p.id==='skirt'?'skirt-photo':p.id==='shorts'?'shorts-photo':'';
 return `<img class="garment-photo ${css}" src="${c[2]}" alt="${p.name}, ${c[0]}" ${card?'loading="lazy"':''}>`;
}
function buttons(el,values,selected,fn,swatches=false) {
 el.replaceChildren();values.forEach((v,i)=>{const b=document.createElement('button');b.type='button';b.className=(swatches?'swatch':'option')+(i===selected?' selected':'');const label=Array.isArray(v)?v[0]:v;b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',i===selected);if(swatches)b.style.setProperty('--color',v[1]);else b.textContent=label;b.onclick=()=>fn(i);el.append(b)});
}
function preorderOnly(p=current()) {return commerce.preorderOnly(p);}
function stockFresh() {return feedState==='ready'&&Date.now()-receivedAt<=90000;}
function stockRows(p) {return commerce.stockRows(p,inventory,stockFresh());}
function inStock() {return commerce.inStock(current(),variant(),stockFresh());}
function orderLimit() {return state.mode==='stock'?commerce.orderLimit(current(),variant()):99;}
function visibleProducts() {return products.filter(p=>commerce.matchesFilter(p,state.filter,inventory,stockFresh()));}
function bundleNeedsConfirmation() {return current().id==='dress'&&state.shortsSize!==state.size;}
function unitPrice() {return commerce.unitPrice(current(),state.bundle,variant());}
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
 const p=current(),v=variant(),a=availability(),hasSelection=visible.length>0;
 $('#productDetails').hidden=!hasSelection;$('#review').disabled=!hasSelection;
 $('#filterHint').textContent=state.filter==='stock'?(hasSelection?'Показаны изделия в наличии. Выберите цвет и размер.':'Сейчас нет изделий с подтверждённым наличием. Посмотрите предзаказ или все изделия.'):'';
 buttons($('#catalogFilters'),['Все','В наличии','Предзаказ'],['all','stock','preorder'].indexOf(state.filter),i=>{state.filter=['all','stock','preorder'][i];state.quantity=1;render()});

 if(preorderOnly())state.mode='preorder';
 if(p.id==='shorts')state.mode='stock';
 if(state.mode==='stock'&&(!inStock()||bundleNeedsConfirmation()))state.mode='query';
 if(state.mode==='preorder'&&!preorderOnly()&&v?.preorder!==true)state.mode='query';
 if(state.mode==='stock')state.quantity=Math.min(state.quantity,orderLimit());
 $('#products').replaceChildren();products.forEach((p,i)=>{if(!visible.includes(p))return;const b=document.createElement('button');b.type='button';b.className='product'+(i===state.product?' selected':'');b.setAttribute('aria-pressed',i===state.product);b.innerHTML=`<div class="thumb">${photo(p,state.filter==='stock'?p.colors.findIndex(c=>c[0]===stockRows(p)[0].color):0,true)}<span class="check">✓</span></div><b>${p.name}</b><em>${p.subtitle}</em><span class="card-price">${p.id==='dress'?'от '+money(8000):preorderOnly(p)?'Предзаказ':'В наличии'}</span>`;b.onclick=()=>{selectProduct(i);render()};const wrap=document.createElement('div');wrap.className='product-card';const help=document.createElement('button');help.type='button';help.className='size-link card-size';help.textContent='Подобрать размер ↗';help.setAttribute('aria-label','Подобрать размер: '+p.name);help.onclick=()=>{selectProduct(i);render();openSizeGuide()};wrap.append(b,help);$('#products').append(wrap)});
 const copy=window.ACEFORM_DESCRIPTIONS[p.id];
 $('#productStoryTitle').textContent=copy.title;$('#productStoryText').textContent=copy.text;$('#productStoryNote').textContent=copy.note;
 $('#productBenefits').replaceChildren();for(const benefit of copy.benefits){const item=document.createElement('li');item.textContent=benefit;$('#productBenefits').append(item)}
 const modelImages=window.ACEFORM_MODELS[p.id][state.color];$('#fitGallery').hidden=modelImages.length===0;
 $('#modelPhotos').replaceChildren();
 for(const src of modelImages){const img=document.createElement('img');img.src=src;img.alt=p.name+', '+p.colors[state.color][0]+' — на фигуре';img.loading='lazy';$('#modelPhotos').append(img)}
 $('#dressBundle').hidden=p.id!=='dress';
 buttons($('#bundleOptions'),['Белые · 1 пара','Чёрные · 1 пара','Белые + чёрные · 2 пары'],['white','black','both'].indexOf(state.bundle),i=>{state.bundle=['white','black','both'][i];state.quantity=1;state.mode='query';render()});
 buttons($('#shortsSizes'),sizes,sizes.indexOf(state.shortsSize),i=>{state.shortsSize=sizes[i];state.shortsSizeCustomized=true;state.quantity=1;state.mode='query';render()});
 $('#bundlePriceNote').textContent=state.bundle==='both'?'Платье + белые и чёрные шорты — 9 500 ₽ за комплект.':'Платье + одна пара шорт — 8 000 ₽ за комплект.';
 $('#studioTitle').textContent=p.name;$('#preview').innerHTML=photo(p,state.color);$('#colorName').textContent=p.colors[state.color][0];
 buttons($('#colors'),p.colors,state.color,i=>{state.color=i;state.quantity=1;state.mode='query';render()},true);
 buttons($('#sizes'),sizes,sizes.indexOf(state.size),i=>{state.size=sizes[i];if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;state.mode='query';render()});
 $('#stockBadge').textContent=a.label;$('#stockBadge').dataset.kind=a.kind;
 const opts=preorderOnly()?[['preorder','Предзаказ',false]]:p.id==='shorts'?[['stock','В наличии',false]]:[['stock','В наличии',!inStock()||bundleNeedsConfirmation()],['preorder','Предзаказ',v?.preorder!==true],['query','Уточнить',false]];
 $('#orderTypes').replaceChildren();opts.forEach(([mode,label,disabled])=>{const b=document.createElement('button');b.className='option'+(mode===state.mode?' selected':'');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-pressed',mode===state.mode);b.onclick=()=>{state.mode=mode;render()};$('#orderTypes').append(b)});
 $('#availabilityHint').textContent=bundleNeedsConfirmation()?(v?.quantity>0?'Платье в наличии. Комплект с разными размерами платья и шорт подтвердим при согласовании.':'Наличие выбранной комплектации и размера шорт подтвердим при согласовании.'):state.mode==='stock'?'В наличии. Резерв подтвердит менеджер.':state.mode==='preorder'?'Предзаказ разрешён. Срок изготовления согласуем с вами.':'Отправьте запрос — подтвердим наличие и возможность изготовления.';
 $('#stockStatus').textContent=feedState==='ready'?`Обновлено ${new Date(receivedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:feedState==='loading'?'Проверяем остатки…':feedState==='unconfigured'?'Подключение остатков настраивается':'Не удалось обновить наличие';
 $('#stockRefresh').disabled=feedState==='loading'||feedState==='unconfigured';
 $('#qty').value=state.quantity;$('#minus').disabled=state.quantity<=1;$('#plus').disabled=state.quantity>=orderLimit();
 $('#price').textContent=!hasSelection?'Выберите изделие':unitPrice()!==null?money(unitPrice()*state.quantity)+(p.id==='dress'?' за '+(state.quantity===1?'комплект':state.quantity+' компл.'):''):'Стоимость уточняется';
 if(state.filter==='stock') {
  Array.from($('#colors').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[i][0]);});
  Array.from($('#sizes').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[state.color][0]&&v.size===sizes[i]);});
 }

 $('#review').firstChild.textContent=canPay()?'Оплатить '+money(unitPrice()*state.quantity)+' ':preorderOnly()||state.mode==='preorder'||a.kind==='preorder'?'Оформить предзаказ ':inStock()?'Собрать комплект ':'Оставить заявку ';
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
  const seen=new Set();for(const v of data.items){if(!products.some(p=>p.name===v.product)||!sizes.includes(v.size)||typeof v.color!=='string'||!(v.quantity===null||Number.isSafeInteger(v.quantity)&&v.quantity>=0)||!(v.price===null||Number.isFinite(v.price)&&v.price>=0)||![true,false,null].includes(v.preorder))throw Error('Invalid variant');const key=[v.product,v.color,v.size].join('|');if(seen.has(key))throw Error('Duplicate variant');seen.add(key);}
  inventory=data.items;receivedAt=Date.now();feedState='ready';
 } catch {inventory=[];receivedAt=0;feedState='error';}
 finally {clearTimeout(timer);script?.remove();pendingStock=null;render();}
}
function details() {const p=current(),price=unitPrice();return [['Изделие',p.name],['Цвет',p.colors[state.color][0]],['Размер',state.size],...(p.id==='dress'?[['Комплектация',state.bundle==='both'?'Платье + белые и чёрные шорты (2 пары)':'Платье + '+(state.bundle==='white'?'белые':'чёрные')+' шорты (1 пара)'],['Размер шорт',state.shortsSize]]:[]),['Формат',state.mode==='stock'?'Из наличия':state.mode==='preorder'?'Предзаказ':'Уточнить наличие'],['Количество',state.quantity+' шт.'],['Стоимость',price!==null?money(price*state.quantity):'Уточняется']];}
$('#minus').onclick=()=>{state.quantity=Math.max(1,state.quantity-1);render()};$('#plus').onclick=()=>{const max=orderLimit();state.quantity=Math.min(max,state.quantity+1);render()};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#sizesHelp').onclick=openSizeGuide;$('#stockRefresh').onclick=refreshStock;
function canPay() {return current().id==='dress'&&inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder'&&Number.isSafeInteger(state.quantity)&&state.quantity>0&&state.quantity<=variant().quantity;}
function prepareDirectPayment() {
 if(!canPay())throw Error('Payment unavailable');
 const unique=(window.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)).replaceAll('-','').slice(0,16);
 const id=['ACEFORM',['BLACK','WHITE','RED'][state.color],state.size,state.bundle.toUpperCase(),state.shortsSize,'Q'+state.quantity,unique].join('-');
 return {fields:window.ACEFORM_PAYMENT.fields(id,unitPrice()*state.quantity),items:details(),createdAt:Date.now()};
}
function submitDirectPayment() {
 const payment=prepareDirectPayment();
 // Keep the selection on this device when the buyer goes to YooMoney. This is not a paid status.
 try {sessionStorage.setItem('aceform.pendingPayment',JSON.stringify(payment));}catch{}
 for(const [name,value] of Object.entries(payment.fields))$('#walletCheckout').elements.namedItem(name).value=value;
 $('#walletCheckout').submit();
}
$('#review').onclick=()=>{render();if(canPay()){submitDirectPayment();return;}$('#summary').replaceChildren();for(const [k,v] of details()){const row=document.createElement('div');row.className='order-line';for(const value of [k,v]){const s=document.createElement('span');s.textContent=value;row.append(s)}$('#summary').append(row)}$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden');$('#orderDialog').showModal()};
$('#orderForm').onsubmit=e=>{e.preventDefault();render();const f=new FormData(e.target);if(!f.get('customer').trim()||!f.get('contact').trim())return;orderText='ЗАЯВКА ACEFORM\n\n'+details().map(([k,v])=>k+': '+v).join('\n')+'\n\nИмя: '+f.get('customer').trim()+'\nКонтакт: '+f.get('contact').trim()+(f.get('comment').trim()?'\nПожелания: '+f.get('comment').trim():'')+'\n\nНе является резервом. Наличие, цена и срок требуют подтверждения.';$('#orderText').textContent=orderText;$('#orderForm').classList.add('hidden');$('#result').classList.remove('hidden');$('#status').textContent=''};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(orderText);$('#status').textContent='Скопировано. Отправьте заявку менеджеру ACEFORM.'}catch{$('#status').textContent='Не удалось скопировать. Скачайте заявку или выделите текст вручную.'}};
$('#download').onclick=()=>{const url=URL.createObjectURL(new Blob([orderText],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='ACEFORM-order.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('#edit').onclick=()=>{$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden')};
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
$('#applySize').onclick=()=>{if(recommendedSize){state.size=recommendedSize;if(state.filter==='stock'&&!stockRows(current()).some(v=>v.color===current().colors[state.color][0]&&v.size===state.size))state.filter='all';if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;render();$('#sizeDialog').close();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStock()});setInterval(()=>{if(!document.hidden)refreshStock()},60000);render();refreshStock();

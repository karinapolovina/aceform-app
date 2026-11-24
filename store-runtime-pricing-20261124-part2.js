/* Source: tree/transport.js */
/* Cross-origin RPC: private request bodies never enter URLs or JSONP. */
(()=>{
 const ORIGIN='https://karinapolovina.github.io';
 let peer=null,peerOrigin=null,ready=null;
 const pending=new Map();
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 let nonce=random(),disconnect=()=>{};
 function connect(){
  if(ready)return ready;
  nonce=random();
  ready=new Promise((resolve,reject)=>{
   if(location.origin!==ORIGIN){reject(Error('Этот сервис подключается только с официальной страницы ACEFORM.'));return;}
   const endpoint=window.ACEFORM_TREE_API;if(!endpoint||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){reject(Error('Хранилище ещё подключается.'));return;}
   const frame=document.createElement('iframe');// Keep the bridge rendered: WebKit can suspend a display:none iframe.
   frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:.01;pointer-events:none;';frame.title='Защищённое соединение с хранилищем ACEFORM';
   const url=new URL(endpoint);url.searchParams.set('nonce',nonce);frame.src=url.href;
   const timer=setTimeout(()=>{disconnect();reject(Object.assign(Error('Не удалось подключиться к хранилищу Google. Попробуй ещё раз.'),{bridgeUnavailable:true}));},25000);
   function receive(event){
    const msg=event.data;
    if(!msg||msg.nonce!==nonce||!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;
    if(msg.kind==='aceform-tree-ready'&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timer);resolve();return;}
    if(event.source!==peer||event.origin!==peerOrigin||msg.kind!=='aceform-tree-response')return;
    const item=pending.get(msg.id);if(item){pending.delete(msg.id);clearTimeout(item.timer);msg.result?.ok?item.resolve(msg.result.data):item.reject(Object.assign(Error(msg.result?.error||'Сервис недоступен.'),{bridgeUnavailable:msg.result?.code==='google_rpc_unavailable'||(msg.result?.status===503&&msg.result?.error==='Сервис временно недоступен')}));}
   }
   disconnect=()=>{clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();peer=null;peerOrigin=null;ready=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Соединение прервалось. Проверь результат перед повторной отправкой.'));}pending.clear();};
   window.addEventListener('message',receive);
   document.body.append(frame);
  });
  return ready.catch(error=>{ready=null;throw error;});
 }
 // Only reads and operations whose server handlers deduplicate the same value may retry.
 const retrySafe=(path,method,data)=>method==='GET'||method==='POST'&&(path==='/api/shop/customer-session'||path==='/api/shop/orders'&&/^[a-f0-9]{32}$/.test(data.nonce||'')||/^\/api\/shop\/my\/[a-f0-9]{32}\/(delivery|confirm)$/.test(path));
 async function send(request){
  await connect();return new Promise((resolve,reject)=>{
   const id=random(),timer=setTimeout(()=>{pending.delete(id);disconnect();reject(Object.assign(Error('Ответ задерживается. Проверь результат перед повторной отправкой.'),{bridgeUnavailable:true}));},30000);
   pending.set(id,{resolve,reject,timer});peer.postMessage({kind:'aceform-tree-request',nonce,id,request},peerOrigin);
  });
 }
 window.ACEFORM_TREE_TRANSPORT={warm:connect,async request(path,method='GET',data,token){
  // Preserve both business payload and request nonce across retries, including a lost response.
  const payload=JSON.parse(JSON.stringify(data||{})),request={path,method,data:payload,token:token||'',nonce:random()},attempts=retrySafe(path,method,payload)?3:1;
  for(let attempt=0;attempt<attempts;attempt++){
   try{return await send(request);}catch(error){
    if(!error.bridgeUnavailable||attempt+1===attempts)throw error;
    if(!pending.size)disconnect();
    await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
   }
  }
 }};
})();
;
/* Source: request-cart.js */
(()=>{
 'use strict';
 const catalog=[...window.ACEFORM_CATALOG,...(window.ACEFORM_APEROL_CATALOG||[])],$=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key='aceform.basket.v1';let items=[],busy=false;const imageCache=new Map(),previewCache=new Map();const fast=src=>window.ACEFORM_MEDIA?.src(src)||src;
 function clean(s){const p=catalog.find(p=>p.id===s?.product);if(!p||p.id==='shorts'||!p.colors[Number(s.color)]||!['S','M','L'].includes(s.size)||!Number.isInteger(Number(s.quantity))||Number(s.quantity)<1||Number(s.quantity)>99)throw Error('Проверь выбранные вещи.');if(p.id.startsWith('aperol-')&&!['S','M','L'].includes(s[p.id==='aperol-suit'?'skirtSize':'shortsSize']))throw Error('Выбери размеры обеих частей комплекта.');return {product:p.id,color:Number(s.color),size:s.size,quantity:Number(s.quantity),mode:p.id.startsWith('aperol-')?'preorder':s.mode==='stock'?'stock':'query',...(p.id==='aperol-suit'?{skirtSize:s.skirtSize}:p.id==='aperol-dress'?{shortsSize:s.shortsSize}:{}),...(p.id==='dress'?{bundle:['white','black','both'].includes(s.bundle)?s.bundle:'white',shortsSize:['S','M','L'].includes(s.shortsSize)?s.shortsSize:s.size}:{})};}
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved)&&saved.length<=4)items=saved.filter(s=>s.product!=='shorts').map(clean);}catch{}
 const same=(a,b)=>['product','color','size','bundle','shortsSize','skirtSize','extraShorts'].every(k=>a[k]===b[k]);
 function merge(current,more){const next=current.map(clean);for(const raw of more){const s=clean(raw),old=next.find(x=>same(x,s));if(old){if(old.quantity+s.quantity>99)throw Error('Можно добавить до 99 единиц одной вещи.');old.quantity+=s.quantity;}else{if(next.length===4)throw Error('В корзине можно собрать до четырёх разных вещей.');next.push(s);}}return next;}
 function save(){try{localStorage.setItem(key,JSON.stringify(items));}catch{}renderBadge();}
 const model=s=>catalog.find(p=>p.id===s.product),name=s=>s.product.startsWith('aperol-')?model(s).name:model(s).name.split(' · ')[0];
 const sizeText=s=>s.product==='aperol-suit'?'GRAF '+s.size+' / BUENO '+s.skirtSize:s.product==='aperol-dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:s.size;
 const image=s=>fast(s.product==='shorts'?'assets/shorts-pair.png':model(s).colors[s.color][2]);
 const outfit=(t,s)=>fast(`assets/outfit-graf-${t}-bueno-${s}.webp`);
 function node(tag,html){const el=document.createElement(tag);el.innerHTML=html;return el;}
 const toast=node('p','');toast.id='basketStatus';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');$('.sticky').prepend(toast);
 const badge=node('button','Корзина');badge.id='basketOpen';badge.className='basket-open';badge.type='button';document.querySelector('header').append(badge);
 const dock=node('button','');dock.id='basketDock';dock.className='secondary';dock.type='button';$('.sticky').append(dock);
 const cart=node('dialog','<button class="basket-close" aria-label="Закрыть корзину">×</button><small>ТВОЙ ВЫБОР</small><h2>Корзина</h2><div id="basketItems"></div><p id="basketError" role="alert" hidden></p><div id="basketActions"></div><button type="button" class="secondary" id="basketContinue">Продолжить выбор</button>');cart.id='basketDialog';document.body.append(cart);
 const look=node('dialog','<button class="basket-close" aria-label="Закрыть образ">×</button><small>GRAF + BUENO</small><h2>Твой образ</h2><img id="outfitPhoto" alt="Топ GRAF и юбка BUENO вместе на фигуре"><div id="outfitChoices"></div><p id="outfitError" role="alert" hidden></p><button type="button" class="primary" id="outfitAdd">Добавить комплект в корзину</button>');look.id='outfitDialog';document.body.append(look);
 const lookButton=node('button','Посмотреть топ с юбкой');lookButton.type='button';lookButton.className='secondary';lookButton.id='outfitOpen';$('#colors').parentElement.insertBefore(lookButton,$('#colors')); // moved below the colour controls after initialisation
 $('#colors').after(lookButton);
 const summary=node('section','');summary.className='basket-summary';$('#summary').before(summary);
 function renderBadge(){const n=items.reduce((n,s)=>n+s.quantity,0);badge.textContent=n?'Корзина · '+n:'Корзина';dock.hidden=!n;dock.textContent='Корзина · '+n+' '+(n===1?'изделие':n<5?'изделия':'изделий');}
 function say(message){toast.textContent=message;}
 function add(more){items=merge(items,more);save();say('Добавлено в корзину. Можно продолжить выбор.');window.ACEFORM_ANALYTICS?.track('basket_add',{count:items.length});document.dispatchEvent(new CustomEvent('aceform:basket-added',{detail:more.map(clean)}));}
 function openCart(){window.ACEFORM_TREE_TRANSPORT?.warm?.().catch(()=>{});renderCart();if(!cart.open)cart.showModal();}
 function renderCart(){
  $('#basketError').hidden=true;const box=$('#basketItems');box.innerHTML=items.length?items.map((s,i)=>`<article class="basket-row"><div class="basket-thumb ${s.product==='shorts'?'basket-shorts':''}" ${s.product==='shorts'?`style="--shorts-position:${s.color===0?'left':'right'}"`:''}><img src="${image(s)}" alt="${esc(name(s))}"></div><div><h3>${esc(name(s))}</h3><p>${esc(model(s).colors[s.color][0])} · ${esc(sizeText(s))}</p>${s.product==='aperol-dress'?`<p>${esc(window.ACEFORM_COMMERCE.aperolShorts(s))}</p>`:''}${s.product==='dress'?`<p>Шорты ${s.bundle==='both'?'белые + чёрные':s.bundle==='black'?'чёрные':'белые'} · ${s.shortsSize}</p>`:''}<div class="basket-sizes">${(s.product==='aperol-suit'?[['size','Топ GRAF'],['skirtSize','Юбка BUENO']]:s.product==='aperol-dress'||s.product==='dress'?[['size',s.product==='dress'?'Платье':'Платье EVERT'],['shortsSize','Шорты MARBLE']]:[['size','Размер']]).map(([field,label])=>`<label>${label}<select data-size="${i}" data-field="${field}" aria-label="${esc(name(s))}: ${label}">${['S','M','L'].map(v=>`<option ${s[field]===v?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</div><label>Количество <input data-qty="${i}" type="number" min="1" max="99" value="${s.quantity}"></label><button class="size-link" data-remove="${i}" type="button">Убрать</button></div></article>`).join(''):'<p>Добавь вещи из коллекции или собери образ из топа и юбки.</p>';
  box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{items.splice(Number(b.dataset.remove),1);save();renderCart();});
  box.querySelectorAll('[data-qty]').forEach(input=>input.onchange=()=>{const n=Number(input.value);if(!Number.isInteger(n)||n<1||n>99){input.value=items[input.dataset.qty].quantity;return;}items[input.dataset.qty].quantity=n;save();renderCart();});
  box.querySelectorAll('[data-size]').forEach(input=>input.onchange=()=>{const i=Number(input.dataset.size);items[i]=clean({...items[i],[input.dataset.field]:input.value});save();renderCart();});
  const actions=$('#basketActions');actions.replaceChildren();if(!items.length)return;
  const snapshot=items.map(clean),picture=node('details','<summary>Посмотреть весь набор</summary><p class="hint">Готовим изображение…</p>');picture.className='basket-picture';preview(snapshot).then(p=>{if(!picture.isConnected)return;picture.querySelector('p').remove();const img=document.createElement('img');img.className='basket-look';img.alt='Весь выбранный набор';img.src='data:image/jpeg;base64,'+p.jpeg;picture.append(img);}).catch(()=>{picture.querySelector('p').textContent='Не удалось загрузить изображение. Проверь соединение.';});
  if(items.some(s=>s.product==='dress')&&window.ACEFORM_SHOP?.stockLoading())actions.append(node('p','Проверяем наличие платья. Можно продолжить выбор; оплата появится после подтверждения наличия.'));const pay=items.filter(s=>window.ACEFORM_SHOP?.canPay(s));if(pay.length===1&&items.length===1){const b=node('button','Оплатить платье из наличия');b.type='button';b.className='primary';b.onclick=async()=>{cart.close();await window.ACEFORM_SHOP.pay(pay[0]);};actions.append(b);if(items.length>1)actions.append(node('p','Платье можно оплатить отдельно. Остальные вещи останутся в корзине.'));}
  const pricing=window.ACEFORM_COMMERCE.basketPrice(items),rub=n=>n.toLocaleString('ru-RU')+' ₽';
  if(pricing){const prices=node('section',pricing.lines.map(l=>`<p>${esc(name(l.selection))} · ${l.selection.quantity} шт. — <strong>${rub(l.total)}</strong>${l.capsulePairs?'<br><small>Капсула «Апероль» · выгода 2 290 ₽ за каждую капсулу.</small>':''}${l.paired?'<br><small>Топ к юбке — 3 100 ₽, скидка 800 ₽ за каждый комплект.</small>':''}</p>`).join('')+`<p><strong>Итого за изделия: ${rub(pricing.total)}</strong></p><p class="hint">${pricing.discount?'Выгода за комплект: '+rub(pricing.discount)+'. ':''}Доставка оплачивается отдельно. Стоимость подтверждается в Telegram перед оплатой.</p>`);actions.append(prices);}
  const ask=node('button',pricing?'Оформить заказ · '+rub(pricing.total):items.every(s=>s.product==='dress')?'Согласовать весь заказ':'Оформить заказ');ask.type='button';ask.className='secondary';ask.onclick=()=>{cart.close();window.ACEFORM_SHOP.request(items[0]);};actions.append(ask);actions.append(node('p','<span class="hint">Срок и доставку согласуем в Telegram. Если в заказе есть отдельные шорты, их стоимость подтвердим до оплаты.</span>'));actions.append(picture);
 }
 let choice={top:0,skirt:0,topSize:'M',skirtSize:'M'};
 function openLook(){const selected=window.ACEFORM_SHOP?.selection(),t=items.find(s=>s.product==='top'),s=items.find(s=>s.product==='skirt');choice={top:t?.color||0,skirt:s?.color||0,topSize:t?.size||selected?.size||'M',skirtSize:s?.size||selected?.size||'M'};if(selected?.product==='top'){choice.top=selected.color;choice.topSize=selected.size;}if(selected?.product==='skirt'){choice.skirt=selected.color;choice.skirtSize=selected.size;}renderLook();look.showModal();}
 function renderLook(){
  $('#outfitPhoto').src=outfit(choice.top,choice.skirt);$('#outfitAdd').textContent='Добавить комплект · 11 000 ₽';$('#outfitError').hidden=true;$('#outfitChoices').innerHTML=['top','skirt'].map(id=>{const p=catalog.find(p=>p.id===id);return `<fieldset><legend>${esc(p.name.split(' · ')[0])}</legend><label>Цвет<select data-look="${id}">${p.colors.map((c,i)=>`<option value="${i}" ${i===choice[id]?'selected':''}>${esc(c[0])}</option>`).join('')}</select></label><label>Размер<select data-look="${id}Size">${['S','M','L'].map(s=>`<option ${s===choice[id+'Size']?'selected':''}>${s}</option>`).join('')}</select></label></fieldset>`}).join('');$('#outfitChoices').querySelectorAll('[data-look]').forEach(el=>el.onchange=()=>{choice[el.dataset.look]=el.dataset.look.endsWith('Size')?el.value:Number(el.value);renderLook();});
 }
 $('#outfitAdd').onclick=()=>{try{add([{product:'top',color:choice.top,size:choice.topSize,quantity:1},{product:'skirt',color:choice.skirt,size:choice.skirtSize,quantity:1}]);look.close();}catch(e){$('#outfitError').hidden=false;$('#outfitError').textContent=e.message;}};
 badge.onclick=dock.onclick=openCart;lookButton.onclick=openLook;$('#basketContinue').onclick=()=>cart.close();[cart,look].forEach(d=>d.querySelector('.basket-close').onclick=()=>d.close());
 function loadImage(src){if(imageCache.has(src))return imageCache.get(src);const promise=new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Не удалось загрузить изображение набора. Повтори отправку.'));i.src=src;});imageCache.set(src,promise);promise.catch(()=>{if(imageCache.get(src)===promise)imageCache.delete(src);});while(imageCache.size>8)imageCache.delete(imageCache.keys().next().value);return promise;}
 async function preview(selections){const snapshot=selections.map(clean),key=JSON.stringify(snapshot);if(previewCache.has(key))return previewCache.get(key);const result=composePreview(snapshot);previewCache.set(key,result);result.catch(()=>previewCache.delete(key));while(previewCache.size>4)previewCache.delete(previewCache.keys().next().value);return result;}
 function contain(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height),iw=img.width*scale,ih=img.height*scale;ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);}
 async function composePreview(snapshot){
  const c=document.createElement('canvas');c.width=960;c.height=1200;const ctx=c.getContext('2d');ctx.fillStyle='#faf9f6';ctx.fillRect(0,0,960,1200);ctx.fillStyle='#203d32';ctx.font='32px Georgia';ctx.fillText('ACEFORM · Твой набор',36,55);
  const t=snapshot.find(s=>s.product==='top'),s=snapshot.find(s=>s.product==='skirt'),pair=t&&s,extra=snapshot.filter(i=>!pair||i!==t&&i!==s);
  const included=snapshot.filter(i=>i.product==='dress').flatMap(i=>(i.bundle==='both'?[0,1]:[i.bundle==='black'?1:0]).map(color=>({product:'shorts',color,size:i.shortsSize,quantity:i.quantity,mode:'stock'})));await Promise.all([...new Set([...(pair?[outfit(t.color,s.color)]:[]),...(pair?extra:snapshot).map(image),...included.map(image)])].map(loadImage));
  if(pair){contain(ctx,await loadImage(outfit(t.color,s.color)),20,80,extra.length?540:920,850);}
  const slots=[...(pair?extra:snapshot),...included],cols=pair?1:slots.length===1?1:2,area=pair?{x:590,y:90,w:330,h:820}:{x:25,y:90,w:910,h:800};
  for(let i=0;i<slots.length;i++){const item=slots[i],rows=Math.ceil(slots.length/cols),w=area.w/cols,h=area.h/rows,x=area.x+(i%cols)*w,y=area.y+Math.floor(i/cols)*h,img=await loadImage(image(item));if(item.product==='shorts'){ctx.drawImage(img,item.color===0?0:img.width/2,0,img.width/2,img.height,x,y,w,h-38);}else contain(ctx,img,x+8,y+8,w-16,h-44);ctx.fillStyle='#203d32';ctx.font='20px Arial';ctx.fillText(name(item),x+10,y+h-15,w-20);}
  ctx.fillStyle='#203d32';ctx.font='21px Arial';let y=950;for(const item of snapshot){ctx.fillText(`${name(item)} · ${sizeText(item)} · ${item.quantity} шт.`,36,y,890);ctx.font='17px Arial';ctx.fillText(model(item).colors[item.color][0]+(item.product==='aperol-dress'?' · '+window.ACEFORM_COMMERCE.aperolShorts(item):'')+(item.product==='dress'?' · шорты '+item.shortsSize+' / '+(item.bundle==='both'?'2 пары':'1 пара'):''),36,y+25,890);ctx.font='21px Arial';y+=58;}
  let jpeg;for(const quality of [.76,.62,.48,.35]){jpeg=c.toDataURL('image/jpeg',quality).split(',')[1];if(jpeg.length<=170000)break;}if(jpeg.length>170000)throw Error('Не удалось подготовить изображение. Повтори отправку.');return {version:1,manifest:snapshot,jpeg};
 }
 window.ACEFORM_REQUEST_CART={open(selection){if(!items.length)add([selection]);$('#summary').hidden=true;summary.innerHTML=items.map(s=>`<p><strong>${esc(name(s))}</strong><br>${esc(model(s).colors[s.color][0])} · ${esc(s.product==='dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:sizeText(s))} · ${s.quantity} шт.${s.product==='aperol-dress'?'<br>'+esc(window.ACEFORM_COMMERCE.aperolShorts(s)):''}</p>`).join('');},add,merge,clean,value(){return items.map(clean);},clear(){items=[];save();summary.replaceChildren();},preview,openCart,stockChanged(){if(cart.open)renderCart();},registerPayment(id,selection){try{const map=JSON.parse(localStorage.getItem('aceform.basketPayments')||'{}');map[id]=clean(selection);localStorage.setItem('aceform.basketPayments',JSON.stringify(map));}catch{}},settlePayment(id){try{const map=JSON.parse(localStorage.getItem('aceform.basketPayments')||'{}'),s=map[id];if(!s)return;const i=items.findIndex(x=>same(x,s));if(i>=0){items[i].quantity-=s.quantity;if(items[i].quantity<=0)items.splice(i,1);}delete map[id];localStorage.setItem('aceform.basketPayments',JSON.stringify(map));save();}catch{}},selectionChanged(s){lookButton.hidden=!['top','skirt'].includes(s.product);lookButton.textContent=s.product==='skirt'?'Добавь топ к юбке за 3 100 ₽':'Собрать комплект с юбкой · 11 000 ₽';},update(){renderBadge();}};
 renderBadge();
})();
;
/* Source: preorder.js */
(()=>{
 'use strict';
 const form=document.querySelector('#orderForm'),button=form.querySelector('button[type="submit"]'),error=document.querySelector('#preorderError');
 let inquiry=false,fixed=false;
 const node=id=>document.querySelector('#'+id);
 const defaultConsent=node('requestConsent').textContent;
 const extras=document.createElement('details');extras.id='requestExtras';const extraSummary=document.createElement('summary');extraSummary.textContent='Добавить имя, пожелания или данные об игре · необязательно';extras.append(extraSummary);node('contactLabel').after(extras);
 const uuid=()=>crypto.randomUUID().replace(/-/g,'');let busy=false,session=uuid();
 try{session=sessionStorage.getItem('aceform.shopSession')||session;sessionStorage.setItem('aceform.shopSession',session);}catch{}
 let memoryDraft=null;
 async function intent(data){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
  const fingerprint=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  let saved=memoryDraft;try{saved=JSON.parse(sessionStorage.getItem('aceform.preorderIntent')||'null')||saved;}catch{}
  if(!saved||saved.fingerprint!==fingerprint)saved={fingerprint,nonce:uuid()};memoryDraft=saved;
  try{sessionStorage.setItem('aceform.preorderIntent',JSON.stringify(saved));}catch{}
  return saved.nonce;
 }
 window.ACEFORM_PREORDER={open(selection){window.ACEFORM_REQUEST_CART?.open(selection);inquiry=window.ACEFORM_REQUEST_CART?.value().some(s=>(['top','skirt'].includes(s.product)||s.product.startsWith('aperol-')))||false;fixed=false;error.hidden=true;error.textContent='';button.disabled=busy;button.textContent=inquiry?'Отправить запрос ↗':'Отправить заявку ↗';node('requestEyebrow').textContent=inquiry?'ТВОЙ ЗАПРОС':'ТВОЙ ВЫБОР';node('requestTitle').textContent=inquiry?'Подтвердить заказ и срок':'Почти на корте.';node('requestSuccessTitle').textContent=inquiry?'Запрос получен':'Заявка получена';const name=form.querySelector('[name=customer]');name.required=!inquiry;form.querySelector('[name=comment]').maxLength=inquiry?850:1000;if(inquiry){extras.append(node('customerLabel'),node('commentLabel'),node('sportLabel'),node('racketLabel'));}else{node('requestFields').prepend(node('customerLabel'));node('contactLabel').after(node('commentLabel'),node('sportLabel'),node('racketLabel'));}extras.hidden=!inquiry;const telegram=!!window.Telegram?.WebApp?.initData;node('requestFields').hidden=inquiry&&!telegram;button.hidden=inquiry&&!telegram;node('preorderTelegram').hidden=!inquiry||telegram;node('preorderTelegram').textContent=inquiry?'Открыть выбранное изделие в Telegram ↗':'Открыть магазин в Telegram ↗';node('preorderTelegram').href=selection.product.startsWith('aperol-')?'https://t.me/aceform_bot/shop?startapp=aperol_'+selection.product.slice(7)+'_'+selection.color+'_'+selection.size+'_'+(selection.skirtSize||selection.shortsSize)+(selection.extraShorts?'_both':''):inquiry?'https://t.me/aceform_bot/shop?startapp=ask_'+selection.product+'_'+selection.color+'_'+selection.size:'https://t.me/aceform_bot/shop';node('requestConsent').textContent=inquiry?'Передаю ACEFORM выбранные вещи, их общее изображение, контакт, а также имя, пожелания и данные об игре, если указаны, для ответа о стоимости и сроке изготовления.':defaultConsent;node('requestNote').textContent=inquiry?(telegram?'Подтвердим актуальную стоимость и срок изготовления по указанному контакту до оплаты.':'Отправка запроса доступна в Telegram. Открой магазин — выбранные изделие, цвет и размер сохранятся.'):'Отправим заявку в ACEFORM. Стоимость, наличие и срок согласуем с вами.';if(fixed){button.textContent='Оформить заказ ↗';node('requestEyebrow').textContent='ТВОЙ ЗАКАЗ';node('requestTitle').textContent='Оформить заказ';node('requestSuccessTitle').textContent='Заказ получен';node('requestConsent').textContent='Передаю ACEFORM выбранные изделия, контакт, пожелания и данные об игре, если указаны, для оформления заказа.';node('requestNote').textContent=telegram?'Цена изделий зафиксирована. В Telegram выбери доставку, проверь заказ и внеси предоплату 50%. Срок изготовления согласуем отдельно.':'Для оформления открой магазин в Telegram. Выбранные изделия сохранятся.';}},async submit(selection){
  if(busy)return;error.hidden=true;error.textContent='';
  if(!form.reportValidity())return;
  const tg=window.Telegram?.WebApp;if(!tg?.initData){error.hidden=false;error.textContent=inquiry?'Чтобы отправить запрос стоимости и срока, открой магазин в Telegram через @aceform_bot.':'Для итога заказа и предоплаты открой магазин в Telegram через @aceform_bot.';document.querySelector('#preorderTelegram').hidden=false;return;}
  const fields=new FormData(form);
  const sport=String(fields.get('sport')||'').trim();
  const racket=String(fields.get('racket')||'').trim();
  const comment=String(fields.get('comment')||'').trim();
  const orderNotes=[
   inquiry&&!fixed?'Заказ по прайсу ACEFORM от 24.11.2026. Стоимость перед оплатой подтвердить: '+(window.ACEFORM_COMMERCE.basketPrice(window.ACEFORM_REQUEST_CART?.value()||[])?.total??'')+' ₽ без доставки.':'',
   sport?'Вид спорта: '+sport:'',
   racket?'Ракетка: '+racket:'',
   comment
  ].filter(Boolean).join('\n');
  if(orderNotes.length>1000){
   error.hidden=false;
   error.textContent='Сократи пожелания или ответы об игре на '+(orderNotes.length-1000)+' симв.';
   return;
  }
  const data={session,name:String(fields.get('customer')||'').trim()||(inquiry?(tg.initDataUnsafe?.user?.first_name||'Клиент ACEFORM'):''),contact:String(fields.get('contact')||'').trim(),comment:orderNotes,selection:{...selection},consent:fields.get('consent')==='yes',website:String(fields.get('website')||''),certificate:window.ACEFORM_CERTIFICATE?.requested?'club1000':''};
  const cart=window.ACEFORM_REQUEST_CART?.value();if(cart?.length){data.schemaVersion=3;if(fixed)data.fixedCatalogVersion=1;data.selections=cart;data.selection=cart[0];}
  busy=true;button.disabled=true;button.textContent=inquiry?'Отправляем запрос…':'Отправляем заявку…';
  try{
   data.nonce=await intent(data);data.preview=await window.ACEFORM_REQUEST_CART.preview(data.selections);data.initData=tg.initData;
   if(tg.initDataUnsafe?.user?.allows_write_to_pm!==true&&tg.requestWriteAccess){const allowed=await new Promise(resolve=>tg.requestWriteAccess(resolve));if(!allowed)throw Error('Разреши боту прислать итог заказа, чтобы продолжить.');}
   const result=await window.ACEFORM_TREE_TRANSPORT.request('/api/shop/orders','POST',data);
   if(result?.received!==true||!/^[a-f0-9]{32}$/.test(result.id||''))throw Error('Не удалось подтвердить получение заявки. Повтори отправку.');
   window.ACEFORM_REQUEST_CART?.clear();form.classList.add('hidden');document.querySelector('#result').classList.remove('hidden');
   document.querySelector('#preorderReference').textContent='№ '+result.id.slice(0,8).toUpperCase();
   document.querySelector('#preorderSuccessText').textContent=inquiry?(result.duplicate?'Этот запрос уже получен. Повторно отправлять его не нужно.':'Запрос получен. В @aceform_bot придёт сообщение со всеми выбранными изделиями и вопросом о доставке. Стоимость и срок подтвердим после уточнения деталей.'):result.duplicate?'Эта заявка уже получена. Повторно отправлять её не нужно.':'Заявка получена. Итог заказа придёт в @'+(result.botUsername==='aceform_tree_bot'?'aceform_tree_bot':'aceform_bot')+'. Там можно проверить состав, подтвердить заказ и оплатить 50% предоплаты, когда указана цена.';
   if(fixed){node('preorderSuccessText').textContent='Заказ получен. В @aceform_bot выбери доставку, проверь фиксированную стоимость и подтверди заказ. Предоплата — 50%. Срок изготовления согласуем отдельно.';}const orderLink=document.querySelector('#preorderOrderLink');orderLink.href='https://t.me/aceform_bot/shop?startapp=order_'+result.id;orderLink.hidden=false;orderLink.textContent=fixed?'Проверить заказ и внести предоплату ↗':inquiry?'Проверить выбор и указать доставку ↗':'Посмотреть итог заказа ↗';if(window.ACEFORM_CUSTOMER_ORDERS&&window.Telegram?.WebApp?.initData){window.ACEFORM_CUSTOMER_ORDERS.open(result.id);return;}
   if(data.certificate&&!inquiry)document.querySelector('#preorderSuccessText').textContent+=' Применение сертификата показано в итоговом заказе.';
  }catch(e){error.hidden=false;error.textContent=(e.message||'').replace('Проверь «Моё желание» перед повторной отправкой.','Повтори отправку — дубль заявки не создастся.')||'Не удалось отправить заявку. Проверь соединение и попробуй ещё раз. Данные формы сохранены.';}
  finally{busy=false;button.disabled=false;button.textContent=fixed?'Оформить заказ ↗':inquiry?'Отправить запрос ↗':'Отправить заявку ↗';}
 }};
 document.querySelector('#preorderClose').onclick=()=>document.querySelector('#orderDialog').close();
})();
;
/* Source: app.js */
// Customer order links preserve the signed Telegram launch when opening the receipt.
{const tg=window.Telegram?.WebApp,start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';if(!['my-orders','shop','cart'].includes(new URLSearchParams(location.search).get('screen'))&&/^(order|manage)_[a-f0-9]{32}$/.test(start)){const target=new URL((start.startsWith('manage_')?'orders.html?order='+start.slice(7):'my-order.html?order='+start.slice(6)),location.href),fragment=new URLSearchParams();fragment.set('tgWebAppData',tg?.initData||'');fragment.set('tgWebAppVersion',tg?.version||'8.0');fragment.set('tgWebAppPlatform',tg?.platform||'unknown');target.hash=fragment.toString();location.replace(target.href);}}
const $ = s => document.querySelector(s);
const products = window.ACEFORM_CATALOG.filter(p=>p.id!=='shorts');
const sizes = ['S','M','L'];
const tg = window.Telegram?.WebApp;
if (tg?.initData) {try {tg.ready();tg.expand();tg.setHeaderColor('#f7f7f0');tg.setBackgroundColor('#f7f7f0');}catch {}}
let state = {product:0,color:0,size:'M',quantity:1,mode:'query',filter:'all',bundle:'white',shortsSize:'M',shortsSizeCustomized:false,sizeChosen:false,shortsColor:'white'};
const commerce=window.ACEFORM_COMMERCE;
{const start=tg?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'',m=start.match(/^ask_(top|skirt)_([0-5])_(S|M|L)$/);if(m){const i=products.findIndex(p=>p.id===m[1]);if(i>=0&&products[i].colors[Number(m[2])]){state.product=i;state.color=Number(m[2]);state.size=m[3];state.shortsSize=m[3];}}}
let checkoutSettings={includedShorts:'unknown'};
let inventory = [], receivedAt = 0, feedState = 'loading', pendingStock = null, requestSelection = null;
const fastMedia=src=>window.ACEFORM_MEDIA?.src(src)||src;
let renderedCatalog='',renderedPreview='';
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
 return `<img class="garment-photo ${css}" src="${fastMedia(c[2])}" alt="${p.name}, ${c[0]}" ${card?'loading="lazy"':''}>`;
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
function unitPrice() {return commerce.unitPrice(current(),state.bundle,variant());}
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
 const p=current(),v=variant(),a=availability(),hasSelection=visible.length>0;const isDress=p.id==='dress',inquiry=preorderOnly(p);$('#inquiryIntro').hidden=!inquiry;$('#inquiryTitle').textContent=p.name;$('#quantityAdvanced').hidden=false;$('#productDetails').classList.toggle('dress-flow',isDress);$('#productDetails').classList.toggle('inquiry-flow',inquiry);$('#dressIntro').hidden=!isDress;$('#dressAnswers').hidden=!isDress;$('#dressCheckoutHint').hidden=!isDress;$('#fitGallery').querySelector('h2').textContent=isDress?'Другие ракурсы и детали':'На фигуре';$('#generalNote').hidden=isDress||inquiry;$('#generalDeliveryNote').hidden=isDress||inquiry;$('#sizeHint').textContent=isDress?(state.sizeChosen?'Размер платья: '+state.size+'. Шорты: '+state.shortsSize+'.':'Выбери свой размер. Шорты будут того же размера.'):inquiry?'Если сомневаешься в размере, поможем подобрать при ответе.':'Размер можно уточнить при согласовании предзаказа.';window.ACEFORM_ANALYTICS?.view({product:p.id,color:state.color,size:state.size,bundle:p.id==='dress'?state.bundle:''});
 if(isDress){$('#dressAnswers').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else if(inquiry){$('#purchaseOptions').after($('#fitGallery'));$('#fitGallery').after($('#productStory'));}else{$('#purchaseOptions').before($('#fitGallery'));$('#purchaseOptions').before($('#productStory'));}$('#quantityAdvanced').querySelector('summary').textContent=isDress?'Количество комплектов':'Количество';$('#productDetails').hidden=!hasSelection;$('#review').disabled=!hasSelection;
 $('#filterHint').textContent=state.filter==='stock'?(feedState==='loading'?'Обновляем наличие. Выбранный комплект сохранён.':feedState==='error'?'Не удалось подтвердить наличие. Обновите остатки перед оплатой.':hasSelection?'Показаны изделия в наличии. Выберите цвет и размер.':'Сейчас нет изделий с подтверждённым наличием. Посмотрите предзаказ или все изделия.'):'';
 buttons($('#catalogFilters'),['Все','В наличии','Предзаказ'],['all','stock','preorder'].indexOf(state.filter),i=>{state.filter=['all','stock','preorder'][i];state.quantity=1;render()});

 if(preorderOnly())state.mode='preorder';
 if(p.id==='shorts'||(p.id==='dress'&&inStock()&&!bundleNeedsConfirmation()&&state.mode==='query'))state.mode='stock';
 if(state.mode==='stock'&&(!inStock()||bundleNeedsConfirmation()))state.mode='query';
 if(state.mode==='preorder'&&!preorderOnly()&&v?.preorder!==true)state.mode='query';
 if(isDress)state.mode=inStock()&&!bundleNeedsConfirmation()?'stock':v?.quantity===0&&v.preorder===true?'preorder':'query';
 if(state.mode==='stock')state.quantity=Math.min(state.quantity,orderLimit());
 const catalogKey=JSON.stringify([state.filter,state.product,visible.map(p=>[p.id,state.filter==='stock'?stockRows(p)[0]?.color:''])]);if(renderedCatalog!==catalogKey){renderedCatalog=catalogKey;
 $('#products').replaceChildren();products.forEach((p,i)=>{if(!visible.includes(p))return;const b=document.createElement('button');b.type='button';b.className='product'+(i===state.product?' selected':'');b.setAttribute('aria-pressed',i===state.product);b.innerHTML=`<div class="thumb">${photo(p,state.filter==='stock'?p.colors.findIndex(c=>c[0]===stockRows(p)[0].color):0,true)}<span class="check">✓</span></div><b>${p.name}</b><em>${p.subtitle}</em><span class="card-price">${p.id==='dress'?money(8000)+' · платье + шорты':preorderOnly(p)?money(commerce.unitPrice(p)):'В наличии'}</span>`;b.onclick=()=>{if(window.ACEFORM_STOREFRONT){window.ACEFORM_STOREFRONT.open(p.id);return;}selectProduct(i);render();$('#productDetails').scrollIntoView({behavior:'smooth',block:'start'})};const wrap=document.createElement('div');wrap.className='product-card';const help=document.createElement('button');help.type='button';help.className='size-link card-size';help.textContent='Подобрать размер ↗';help.setAttribute('aria-label','Подобрать размер: '+p.name);help.onclick=()=>{selectProduct(i);render();openSizeGuide()};wrap.append(b,help);$('#products').append(wrap)});}
 const copy=window.ACEFORM_DESCRIPTIONS[p.id];
 $('#productStoryTitle').textContent=copy.title;$('#productStoryText').textContent=copy.text;$('#productStoryNote').textContent=inquiry?'Цена указана за изделие. Срок изготовления и доставку согласуем отдельно.':copy.note;
 $('#modelHistoryText').textContent=copy.history;
 $('#productBenefits').replaceChildren();for(const benefit of copy.benefits){const item=document.createElement('li');item.textContent=benefit;$('#productBenefits').append(item)}
 const modelImages=isDress?[...window.ACEFORM_MODELS[p.id][state.color].slice(1),p.colors[state.color][2]]:window.ACEFORM_MODELS[p.id][state.color];$('#fitGallery').hidden=modelImages.length===0;
 const gallery=$('#modelPhotos'),galleryKey=p.id+':'+state.color,previousIndex=gallery.dataset.selection===galleryKey?Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12)):0;if(gallery.dataset.selection!==galleryKey){gallery.dataset.selection=galleryKey;
 $('#modelPhotos').replaceChildren();
 for(const src of modelImages){const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');const view=src===p.colors[state.color][2]?'Изделие':window.ACEFORM_MODEL_VIEWS?.[src]||'На фигуре';img.src=fastMedia(src);img.alt=p.name+', '+p.colors[state.color][0]+' — '+view;img.loading='lazy';img.decoding='async';caption.textContent=view;figure.append(img,caption);$('#modelPhotos').append(figure)}
 gallery.scrollLeft=((gallery.clientWidth||1)+12)*Math.min(previousIndex,modelImages.length-1);}
 $('#galleryControls').hidden=modelImages.length<2;
 const updateGallery=()=>{const i=Math.max(0,Math.min(modelImages.length-1,Math.round((gallery.scrollLeft||0)/((gallery.clientWidth||1)+12))));$('#galleryCount').textContent=(i+1)+' / '+modelImages.length;$('#galleryPrev').disabled=i<=0;$('#galleryNext').disabled=i>=modelImages.length-1;};
 gallery.onscroll=updateGallery;$('#galleryPrev').onclick=()=>gallery.scrollBy({left:-(gallery.clientWidth+12),behavior:'smooth'});$('#galleryNext').onclick=()=>gallery.scrollBy({left:gallery.clientWidth+12,behavior:'smooth'});updateGallery();
 $('#dressBundle').hidden=p.id!=='dress';
 buttons($('#bundleOptions'),['Белые','Чёрные'],state.shortsColor==='white'?0:1,i=>{state.shortsColor=i===0?'white':'black';if(state.bundle!=='both')state.bundle=state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()});
 $('#addSecondShorts').checked=state.bundle==='both';$('#addSecondShorts').onchange=e=>{state.bundle=e.target.checked?'both':state.shortsColor;trackAction('bundle_select');state.quantity=1;state.mode='query';render()};
 buttons($('#shortsSizes'),sizes,sizes.indexOf(state.shortsSize),i=>{state.shortsSize=sizes[i];trackAction('size_select');state.shortsSizeCustomized=true;state.quantity=1;state.mode='query';render()});
 $('#bundlePriceNote').textContent=state.bundle==='both'?'EVERT + белые и чёрные MARBLE — 9 500 ₽ за комплект.':'EVERT + одна пара MARBLE — 8 000 ₽ за комплект.';
 $('#studioTitle').textContent=p.name;const previewKey=p.id+':'+state.color;if(renderedPreview!==previewKey&&document.body.dataset.shopScreen==='product'){renderedPreview=previewKey;const src=isDress?window.ACEFORM_MODELS.dress[state.color][0]:['top','skirt'].includes(p.id)?window.ACEFORM_MODELS[p.id][state.color][0]:null;if(src){window.ACEFORM_MEDIA.show($('#preview'),src,{class:'fit-main',alt:p.name+', '+p.colors[state.color][0]+' — на фигуре'}).then(shown=>{if(shown)window.ACEFORM_MEDIA.prepareProduct(p.id);});}else{$('#preview').innerHTML=photo(p,state.color);};};$('#dressOffer').textContent=state.quantity>1?state.quantity+' комплекта · '+money(totalPrice()):'Платье + '+(state.bundle==='both'?'2 пары шорт':'шорты')+' · '+money(totalPrice());$('#colorName').textContent=p.colors[state.color][0];
 buttons($('#colors'),p.colors,state.color,i=>{window.ACEFORM_STOREFRONT?.regularColor();renderedPreview='';state.color=i;trackAction('color_select');state.quantity=1;state.mode='query';render()},true);
 window.ACEFORM_STOREFRONT?.colors(p.id);
 buttons($('#sizes'),sizes,isDress&&!state.sizeChosen?-1:sizes.indexOf(state.size),i=>{state.size=sizes[i];state.sizeChosen=true;trackAction('size_select');if(!state.shortsSizeCustomized)state.shortsSize=state.size;state.quantity=1;state.mode='query';render()});
 $('#stockBadge').textContent=inquiry?'Изготовление на заказ':isDress&&!state.sizeChosen?'Выбери размер — проверим наличие':a.label;$('#stockBadge').dataset.kind=a.kind;
 const opts=preorderOnly()?[['preorder','Предзаказ',false]]:p.id==='shorts'?[['stock','В наличии',false]]:[['stock','В наличии',!inStock()||bundleNeedsConfirmation()],['preorder','Предзаказ',v?.preorder!==true],['query','Уточнить',false]];
 $('#orderTypes').replaceChildren();opts.forEach(([mode,label,disabled])=>{const b=document.createElement('button');b.className='option'+(mode===state.mode?' selected':'');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-pressed',mode===state.mode);b.onclick=()=>{state.mode=mode;render()};$('#orderTypes').append(b)});
 const directCheckout=isDress?inStock()&&!bundleNeedsConfirmation()&&state.mode!=='preorder':canPay();$('#orderTypes').hidden=isDress||inquiry||directCheckout;const orderTitle=$('#orderTypes').previousElementSibling;if(orderTitle)orderTitle.hidden=isDress||inquiry||directCheckout;$('#availabilityHint').hidden=inquiry||directCheckout||(isDress&&(!state.sizeChosen||feedState==='loading'));
 $('#availabilityHint').textContent=bundleNeedsConfirmation()?(v?.quantity>0?'Платье в наличии. Выбранные шорты и комплектацию подтвердим при согласовании.':'Наличие выбранной комплектации и размера шорт подтвердим при согласовании.'):state.mode==='stock'?'В наличии. Резерв подтвердит менеджер.':state.mode==='preorder'?'Предзаказ разрешён. Срок изготовления согласуем с вами.':'Отправьте запрос — подтвердим наличие и возможность изготовления.';
 $('#stockStatus').textContent=feedState==='ready'?`Обновлено ${new Date(receivedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:feedState==='loading'?'Проверяем остатки…':feedState==='unconfigured'?'Подключение остатков настраивается':'Не удалось обновить наличие';
 $('#stockRefresh').disabled=feedState==='loading'||feedState==='unconfigured';
 $('#qty').value=state.quantity;$('#minus').disabled=state.quantity<=1;$('#plus').disabled=state.quantity>=orderLimit();
 $('#price').textContent=!hasSelection?'Выберите изделие':unitPrice()!==null?money(totalPrice())+(p.id==='dress'?' за '+(state.quantity===1?'комплект':state.quantity+' компл.'):''):'Стоимость уточняется';
 if(state.filter==='stock') {
  Array.from($('#colors').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[i][0]);});
  Array.from($('#sizes').children).forEach((b,i)=>{b.disabled=!stockRows(p).some(v=>v.color===p.colors[state.color][0]&&v.size===sizes[i]);});
 }

 window.ACEFORM_REQUEST_CART?.selectionChanged(selectedForBasket());
 $('#review').firstChild.textContent=true?(isDress&&!state.sizeChosen?'Выбрать размер ':'Добавить в корзину '):inquiry?'Узнать стоимость и срок ':isDress&&!state.sizeChosen?'Выбрать размер ':isDress&&feedState==='loading'?'Проверяем наличие… ':canPay()?'Купить за '+money(totalPrice())+' ':preorderOnly()||state.mode==='preorder'||a.kind==='preorder'?'Оформить предзаказ ':inStock()?'Собрать комплект ':'Оставить заявку ';
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
 finally {clearTimeout(timer);script?.remove();pendingStock=null;render();window.ACEFORM_REQUEST_CART?.stockChanged();}
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
  window.ACEFORM_REQUEST_CART?.registerPayment(order.orderId,selectedForBasket());
  if(order.state!=='pending'){$('#review').disabled=false;window.ACEFORM_PAYMENT_BRIDGE.show(order);return;}
  const fields=window.ACEFORM_PAYMENT.fields(order.orderId,order.amount);
  fields.successURL=window.location.origin+window.location.pathname+'#payment='+order.orderId+'.'+order.token;
  for(const [name,value] of Object.entries(fields))$('#walletCheckout').elements.namedItem(name).value=value;
  trackAction('checkout_redirect');window.ACEFORM_ANALYTICS?.sendOnExit();$('#walletCheckout').submit();
 } catch(error){$('#checkoutError').hidden=false;$('#checkoutError').textContent=window.ACEFORM_CERTIFICATE?.error(error.message)||(error.message==='not_available'?'Выбранный комплект уже недоступен. Обновите наличие.':['extra_shorts_unconfirmed','bundle_needs_confirmation'].includes(error.message)?'Наличие выбранных шорт нужно подтвердить. Оставьте заявку на комплект.':'Не удалось подготовить оплату. Деньги не списаны. Попробуйте ещё раз.');$('#review').disabled=false;}
}
function selectedForBasket(){return {product:current().id,color:state.color,size:state.size,shortsSize:state.shortsSize,bundle:state.bundle,quantity:state.quantity,mode:state.mode};}
function basketCanPay(s){if(s.product!=='dress'||!stockFresh()||s.shortsSize!==s.size)return false;const p=products.find(p=>p.id==='dress'),v=inventory.find(v=>v.product===(p.stockName||p.name)&&v.color===p.colors[s.color]?.[0]&&v.size===s.size);return !!v&&Number.isInteger(v.quantity)&&commerce.bundleLimit(s.bundle,s.shortsSize,inventory,checkoutSettings.includedShorts,v.quantity)>=s.quantity;}
window.ACEFORM_SHOP={openProduct(id){renderedPreview='';const i=products.findIndex(p=>p.id===id);if(i<0)return;state.filter='all';selectProduct(i);render();},selection:selectedForBasket,canPay:basketCanPay,stockLoading:()=>feedState==='loading',async pay(s){if(!basketCanPay(s)){window.ACEFORM_REQUEST_CART.openCart();return;}state={...state,...s,product:products.findIndex(p=>p.id===s.product),sizeChosen:true,shortsSizeCustomized:true,mode:'stock'};render();await submitDirectPayment();},request(selection){requestSelection=selection;window.ACEFORM_PREORDER.open(selection);$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden');$('#orderDialog').showModal();}};
$('#review').onclick=()=>{render();if(current().id==='dress'&&!state.sizeChosen){$('#sizeChoice').scrollIntoView({behavior:'smooth',block:'start'});return;}try{window.ACEFORM_REQUEST_CART.add([selectedForBasket()]);}catch(e){$('#checkoutError').hidden=false;$('#checkoutError').textContent=e.message;window.ACEFORM_REQUEST_CART.openCart();}};
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
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStock()});setInterval(()=>{if(!document.hidden)refreshStock()},60000);render();const startStock=()=>setTimeout(refreshStock,250);if(document.readyState==='complete')startStock();else addEventListener('load',startStock,{once:true});
;
/* Source: aperol.js */
/* The limited collection uses complete outfits as indivisible basket items. */
(()=>{
 'use strict';
 const catalog=window.ACEFORM_APEROL_CATALOG;
 const sizes=['S','M','L'];
 for(const [index,figure] of [...document.querySelectorAll('#april .april-gallery figure')].entries()){
  const product=(index===1||index===3)?'aperol-suit':'aperol-dress',color=(index===2||index===3)?1:0,p=catalog.find(p=>p.id===product);
  const form=document.createElement('form');form.className='aperol-order';form.dataset.product=product;form.dataset.color=color;
  const field=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>`;
  form.innerHTML=`<p class="aperol-price">${p.price.toLocaleString('ru-RU')} ₽ <span>${product==='aperol-suit'?'топ + юбка':'платье + шорты'}</span></p><p class="hint">${product==='aperol-suit'?'Топ GRAF + юбка BUENO. Отдельные цены: GRAF — 4 500 ₽, BUENO — 8 900 ₽. Для заказа отдельно напиши в @aceform_bot.':'Платье EVERT + одна пара контрастных шорт MARBLE.'}</p><div class="aperol-sizes">${field('size',product==='aperol-suit'?'Размер топа GRAF':'Размер платья EVERT')}${field(product==='aperol-suit'?'skirtSize':'shortsSize',product==='aperol-suit'?'Размер юбки BUENO':'Размер шорт MARBLE')}</div><details><summary>Таблица размеров</summary><table class="size-table"><thead><tr><th>Размер</th><th>Грудь</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody>${window.ACEFORM_SIZING.rows.map(r=>`<tr><th>${r.size}</th><td>${r.bust.join('–')}</td><td>${r.waist.join('–')}</td><td>${r.hips.join('–')}</td></tr>`).join('')}</tbody></table><p class="hint">Обхваты тела в сантиметрах. Если сомневаешься, поможем подобрать размер при согласовании заказа.</p></details><button class="primary" type="submit"><span>Добавить комплект в корзину</span><span class="aperol-arrow" aria-hidden="true">→</span></button><p class="hint">Изготовление на заказ. Срок согласуем отдельно. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p>`;
  if(product==='aperol-dress'){
   const note=document.createElement('p');note.className='aperol-shorts-note';note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color});form.querySelector('.aperol-sizes').before(note);

  }
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const extra=product==='aperol-suit'?'skirtSize':'shortsSize',selection={product,color,size:form.elements.size.value,[extra]:form.elements[extra].value,quantity:1,mode:'preorder'};
   const error=form.querySelector('.aperol-error');error.hidden=true;
   try{window.ACEFORM_REQUEST_CART.add([selection]);}catch(e){error.textContent=e.message;error.hidden=false;}
  };
  figure.append(form);
 }
 const capsule=document.createElement('section');capsule.className='aperol-capsule';capsule.id='aperolCapsule';
 const sizeField=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option>${s}</option>`).join('')}</select></label>`;
 capsule.innerHTML=`<p class="eyebrow">КАПСУЛА «АПЕРОЛЬ»</p><h3>Два образа. Твой выбор каждый день.</h3><div class="capsule-photos"><img src="assets/fast-aperol-studio-dress-navy-v1.jpg" alt="Платье EVERT" loading="lazy"><img src="assets/fast-aperol-studio-suit-navy-orange-v2.jpg" alt="Топ GRAF и юбка BUENO" loading="lazy"></div><p>Платье EVERT с шортами MARBLE + топ GRAF + юбка BUENO.</p><p class="aperol-price"><del>22 900 ₽</del> 20 610 ₽</p><p>Выгода 2 290 ₽ · 10% за капсулу</p><form><div class="aperol-sizes"><label><span>Цвет платья</span><select name="dressColor"><option value="0">Тёмно-синий</option><option value="1">Оранжевый</option></select></label><label><span>Цвет топа и юбки</span><select name="suitColor"><option value="0">Синий топ / оранжевая юбка</option><option value="1">Оранжевый топ / синяя юбка</option></select></label>${sizeField('dressSize','Платье EVERT')}${sizeField('shortsSize','Шорты MARBLE')}${sizeField('topSize','Топ GRAF')}${sizeField('skirtSize','Юбка BUENO')}</div><p class="hint">Размер каждой вещи выбирается отдельно. Одна пара шорт MARBLE входит в комплект платья.</p><button class="primary" type="submit">Добавить капсулу · 20 610 ₽</button><p class="hint">Изготовление на заказ. Предоплата 50% — 10 305 ₽. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p></form>`;
 document.querySelector('#april .april-gallery').after(capsule);
 const capsuleForm=capsule.querySelector('form');
 const updateCapsulePhotos=()=>{capsule.querySelectorAll('img')[0].src=Number(capsuleForm.elements.dressColor.value)?'assets/fast-aperol-studio-dress-orange-v1.jpg':'assets/fast-aperol-studio-dress-navy-v1.jpg';capsule.querySelectorAll('img')[1].src=Number(capsuleForm.elements.suitColor.value)?'assets/fast-aperol-studio-suit-orange-navy-v2.jpg':'assets/fast-aperol-studio-suit-navy-orange-v2.jpg';};
 capsuleForm.elements.dressColor.onchange=updateCapsulePhotos;capsuleForm.elements.suitColor.onchange=updateCapsulePhotos;
 capsuleForm.onsubmit=e=>{e.preventDefault();if(!capsuleForm.reportValidity())return;const f=capsuleForm.elements,error=capsuleForm.querySelector('.aperol-error');error.hidden=true;try{window.ACEFORM_REQUEST_CART.add([{product:'aperol-dress',color:Number(f.dressColor.value),size:f.dressSize.value,shortsSize:f.shortsSize.value,quantity:1,mode:'preorder'},{product:'aperol-suit',color:Number(f.suitColor.value),size:f.topSize.value,skirtSize:f.skirtSize.value,quantity:1,mode:'preorder'}]);}catch(e){error.textContent=e.message;error.hidden=false;}};
 const section=document.getElementById('april'),dock=document.querySelector('.sticky');
 let queued=false;
 const updateDock=()=>{queued=false;if(!section||!dock)return;const rect=section.getBoundingClientRect(),middle=innerHeight/2;dock.classList.toggle('aperol-context',rect.top<middle&&rect.bottom>middle);};
 const scheduleDock=()=>{if(!queued){queued=true;requestAnimationFrame(updateDock);}};
 addEventListener('scroll',scheduleDock,{passive:true});addEventListener('resize',scheduleDock);updateDock();
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const match=start.match(/^aperol_(dress|suit)_([01])_(S|M|L)_(S|M|L)(?:_(both))?$/);
 if(match){const form=[...document.querySelectorAll('.aperol-order')].find(f=>f.dataset.product==='aperol-'+match[1]&&f.dataset.color===match[2]);if(form){form.elements.size.value=match[3];form.elements[match[1]==='suit'?'skirtSize':'shortsSize'].value=match[4];if(match[5]&&form.elements.extraShorts){form.elements.extraShorts.checked=true;form.elements.extraShorts.onchange();}form.scrollIntoView({block:'center'});}}
})();
;
/* Source: certificate.js */
(()=>{
 'use strict';
 const id='club1000',tg=window.Telegram?.WebApp,params=new URLSearchParams(location.search);
 let requested=params.get('certificate')===id||tg?.initDataUnsafe?.start_param==='cert_club1000'||params.get('tgWebAppStartParam')==='cert_club1000'||new URLSearchParams(location.hash.slice(1)).get('tgWebAppStartParam')==='cert_club1000';
 try{if(requested)localStorage.setItem('aceform.certificate',id);else requested=localStorage.getItem('aceform.certificate')===id;}catch{}
 let token=null,eligible=false,pending=null,frame=null,ready=null,bridgeNonce='',targetOrigin='';
 const waiting=new Map(),hex=()=>crypto.randomUUID().replace(/-/g,'');
 function bridge(){
  if(ready)return ready;
  ready=new Promise((resolve,reject)=>{
   bridgeNonce=hex();frame=document.createElement('iframe');frame.hidden=true;frame.title='Подтверждение сертификата ACEFORM';
   const url=new URL(window.ACEFORM_STOCK_URL);url.searchParams.set('certificateBridge',bridgeNonce);frame.src=url.href;
   const timer=setTimeout(()=>{ready=null;frame?.remove();reject(Error('unavailable'));},25000);
   const onReady=e=>{if(e.data?.kind==='aceform-certificate-ready'&&e.data.nonce===bridgeNonce&&e.source&&/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(e.origin)){
    // Apps Script uses nested frames. Bind both the exact source and origin.
    source=e.source;targetOrigin=e.origin;clearTimeout(timer);window.removeEventListener('message',onReady);resolve();
   }};window.addEventListener('message',onReady);document.body.append(frame);
  });return ready;
 }
 let source=null;
 window.addEventListener('message',e=>{
  const m=e.data;if(e.source!==source||e.origin!==targetOrigin||m?.kind!=='aceform-certificate-response'||m.nonce!==bridgeNonce)return;
  const entry=waiting.get(m.id);if(!entry)return;waiting.delete(m.id);clearTimeout(entry.timer);
  m.result?.ok===true?entry.resolve(m.result):entry.reject(Error(m.result?.error||'unavailable'));
 });
 async function rpc(body){await bridge();return new Promise((resolve,reject)=>{const request=hex(),timer=setTimeout(()=>{waiting.delete(request);reject(Error('unavailable'));},30000);waiting.set(request,{resolve,reject,timer});source.postMessage({kind:'aceform-certificate-request',nonce:bridgeNonce,id:request,body},targetOrigin);});}
 const box=document.createElement('section');box.className='certificate-offer';box.hidden=!requested;box.setAttribute('aria-live','polite');
 box.innerHTML='<small>ПОДАРОК ДЛЯ ТВОЕЙ ИГРЫ</small><h2>1 000 ₽ на первый заказ</h2><p id="certificateMessage"></p><a id="certificateTelegram" href="https://t.me/aceform_bot/shop?startapp=cert_club1000">Подтвердить через Telegram ↗</a><button id="certificateRetry" type="button" hidden>Проверить ещё раз</button><button id="certificatePending" type="button" hidden>Продолжить созданный заказ</button><button id="certificateSkip" type="button">Продолжить без сертификата</button><p class="hint">При заказе от 8 000 ₽. Один раз для подтверждённого Telegram-аккаунта. Не суммируется с другими скидками. Доставка отдельно.</p>';
 document.querySelector('main header').after(box);
 const message=box.querySelector('#certificateMessage'),link=box.querySelector('#certificateTelegram'),retry=box.querySelector('#certificateRetry'),resume=box.querySelector('#certificatePending');
 function update(){if(typeof window.ACEFORM_CERTIFICATE_RENDER==='function')window.ACEFORM_CERTIFICATE_RENDER();}
 async function activate(){
  if(!requested&&!tg?.initData)return;
  if(!tg?.initData){message.textContent='Подтвердите аккаунт в Telegram, чтобы применить подарок. Код вводить не нужно.';return;}
  link.hidden=true;retry.hidden=true;message.textContent='Проверяем сертификат…';
  try{
   const result=await rpc({action:'activate',initData:tg.initData});token=result.token;eligible=result.eligible===true;pending=result.pending;
   message.textContent=eligible?(pending?'Сертификат привязан к созданному заказу. Продолжите его оформление.':'Сертификат активирован. Скидка 1 000 ₽ применится к заказу от 8 000 ₽.'):'Сертификат уже использован для этого Telegram-аккаунта.';
   resume.hidden=!pending;update();
  }catch{token=null;eligible=false;message.textContent='Не удалось подтвердить сертификат. Откройте предложение через Telegram заново или повторите проверку.';link.hidden=false;retry.hidden=false;update();}
 }
 retry.onclick=activate;
 box.querySelector('#certificateSkip').onclick=()=>{requested=false;eligible=false;box.hidden=true;try{localStorage.removeItem('aceform.certificate');}catch{}const url=new URL(location.href);url.searchParams.delete('certificate');history.replaceState(null,'',url);update();};
 resume.onclick=async()=>{if(!pending)return;resume.disabled=true;try{const selection={nonce:crypto.randomUUID(),color:['Чёрный','Белый','Красный'].indexOf(pending.color),size:pending.size,shortsSize:pending.shortsSize,bundle:pending.bundle,quantity:pending.quantity};pending=await window.ACEFORM_CERTIFICATE.create(selection);window.ACEFORM_PAYMENT_BRIDGE?.show(pending);}catch{message.textContent='Не удалось возобновить заказ. Наличие могло измениться — свяжитесь с ACEFORM.';}finally{resume.disabled=false;}};
 window.ACEFORM_CERTIFICATE={get requested(){return requested;},get active(){return requested&&!!token&&eligible;},discount(subtotal){return this.active&&Number.isSafeInteger(subtotal)&&subtotal>=8000?1000:0;},async create(selection){
  if(!requested){if(!token)return window.ACEFORM_PAYMENT_BRIDGE.create(selection);return rpc({action:'createRegular',token,selection});}
  if(!token||!eligible)throw Error('certificate_login_required');
  const order=await rpc({action:'create',certificate:id,token,selection});
  if(!window.ACEFORM_PAYMENT_BRIDGE.validOrder(order)||!/^[a-f0-9]{64}$/i.test(order.token||'')||order.discount!==1000||order.certificate!==id)throw Error('invalid_order');return order;
 },error(code){
  const messages={certificate_login_required:'Для сертификата подтвердите вход через Telegram.',certificate_used:'Сертификат уже использован. Обновите страницу.',certificate_pending:'Сертификат уже привязан к другому заказу. Нажмите «Продолжить созданный заказ» выше.',certificate_unavailable:'Нужна помощь с сертификатом. Свяжитесь с ACEFORM.'};return messages[code];
 }};
 if(requested||tg?.initData){const start=()=>setTimeout(activate,250);if(document.readyState==='complete')start();else addEventListener('load',start,{once:true});}
})();
;
/* Source: delivery.js */
(()=>{
 const $=s=>document.querySelector(s),form=$('#deliveryForm');
 let order=null,auth=null,busy=false,submissionId=null;
 const methods={cdek:'СДЭК — пункт выдачи',avito:'Авито',courier:'Курьер',pickup:'Самовывоз'};
 function reset(){$('#fulfillmentNote').hidden=true;order=null;auth=null;$('#deliverySection').hidden=true;$('#paidOrderSummary').hidden=true;}
 function render(data,credentials){
  if(data.state!=='paid'){reset();return;}
  const unsettled=['review','processing'].includes(data.fulfillment);$('#fulfillmentNote').hidden=!unsettled;$('#fulfillmentNote').textContent=data.fulfillment==='review'?'Оплата получена. Перед отправкой проверим наличие и свяжемся с тобой. Данные доставки можно оставить сейчас.':unsettled?'Оплата получена. Завершаем оформление комплекта.':'';
  if(order?.orderId!==data.orderId){form.reset();form.hidden=true;submissionId=null;methodChanged();}
  order=data;auth={orderId:data.orderId,token:credentials.token};
  $('#deliverySection').hidden=false;$('#paidOrderSummary').hidden=false;
  const shorts={white:'белые шорты MARBLE',black:'чёрные шорты MARBLE',both:'белые и чёрные шорты MARBLE'}[data.bundle]||'шорты';
  $('#paidOrderSummary').textContent=`Твой комплект: платье EVERT, ${data.color}, ${data.size}; ${shorts}, ${data.shortsSize}. Количество: ${data.quantity}.`;
  const saved=!!data.delivery;$('#deliveryStart').hidden=saved||!form.hidden;$('#deliveryReceived').hidden=!saved;
  if(saved){
   form.hidden=true;$('#deliveryError').hidden=true;
   const d=data.delivery,shipped=d.state==='shipped',collected=d.state==='collected';
   $('#deliveryReceivedTitle').textContent=collected?'Комплект у тебя':shipped?'Твой комплект отправлен':'Данные для доставки получены';
   $('#deliveryReceivedText').textContent=collected?'Спасибо, что выбираешь ACEFORM. Красивой игры!':shipped?`Способ получения: ${methods[d.method]||'согласован с тобой'}.`:`Способ получения: ${methods[d.method]||'согласуем'}. Проверим детали и свяжемся по указанным контактам. Доставку СДЭК оплачиваешь отдельно при получении; самовывоз — по согласованию.`;
   $('#deliveryTracking').hidden=!d.tracking;$('#deliveryTracking').textContent=d.tracking?'Трек-номер: '+d.tracking:'';
  }
 }
 function methodChanged(){
  const m=$('#deliveryMethod').value,needsAddress=m==='cdek'||m==='courier';
  $('#deliveryAddressLabel').hidden=!needsAddress;$('#deliveryAddress').required=needsAddress;
  $('#deliveryAddressTitle').textContent=m==='courier'?'Адрес доставки: улица, дом, квартира':'Адрес или код пункта СДЭК';
  $('#deliveryMethodHint').textContent={cdek:'Укажи адрес удобного пункта СДЭК. Доставку оплачиваешь СДЭК при получении. Стоимость уточняется.',avito:'Согласуем оформление через Авито отдельно. Здесь заказ на Авито не создаётся; повторно оплачивать комплект не нужно.',courier:'Проверим возможность доставки по твоему адресу и согласуем стоимость.',pickup:'Место и время самовывоза согласуем по указанным контактам.'}[m];
 }
 $('#deliveryMethod').onchange=methodChanged;
 $('#deliveryOpen').onclick=()=>{if(order?.state!=='paid')return;$('#deliveryStart').hidden=true;form.hidden=false;methodChanged();};
 $('#deliveryRefresh').onclick=async()=>{if(!auth)return;$('#deliveryRefresh').disabled=true;try{render(await window.ACEFORM_PAYMENT_BRIDGE.request('paymentStatus',auth),auth);}catch{$('#deliveryReceivedText').textContent='Не удалось обновить статус. Данные доставки уже получены — попробуй позже.';}finally{$('#deliveryRefresh').disabled=false;}};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||order?.state!=='paid'||!form.reportValidity())return;
  const fields=Object.fromEntries(new FormData(form));
  const phone=String(fields.phone||'').replace(/\D/g,''),telegram=String(fields.telegram||'').trim();
  if(phone.length<7||phone.length>15||(telegram&&!/^@[a-zA-Z0-9_]{5,32}$/.test(telegram))){$('#deliveryError').hidden=false;$('#deliveryError').textContent='Проверь номер телефона и Telegram в формате @username.';return;}
  busy=true;$('#deliverySubmit').disabled=true;$('#deliveryError').hidden=false;$('#deliveryError').textContent='Сохраняем данные доставки…';
  submissionId=submissionId||window.crypto.randomUUID();
  const currentAuth={...auth},body=new URLSearchParams({...fields,telegram,address:['cdek','courier'].includes(fields.method)?fields.address:'',...currentAuth,action:'saveDelivery',submissionId});
  try{
   // Opaque POST response is not a receipt. Confirm saving through authenticated order status.
   await fetch(window.ACEFORM_STOCK_URL,{method:'POST',mode:'no-cors',credentials:'omit',body});
   let confirmed=false;
   for(let i=0;i<6;i++){
    const data=await window.ACEFORM_PAYMENT_BRIDGE.request('paymentStatus',currentAuth);
    if(data.orderId!==currentAuth.orderId||data.state!=='paid')throw Error('invalid_status');
    if(data.delivery){if(auth?.orderId===currentAuth.orderId)render(data,currentAuth);confirmed=true;break;}
    if(i<5)await new Promise(resolve=>setTimeout(resolve,2000));
   }
   if(!confirmed)throw Error('not_confirmed');
  }catch{if(auth?.orderId===currentAuth.orderId){$('#deliveryError').hidden=false;$('#deliveryError').textContent='Сохранение пока не подтверждено. Данные оставлены в форме — попробуй ещё раз или свяжись с ACEFORM.';}}
  finally{busy=false;$('#deliverySubmit').disabled=false;}
 };
 window.ACEFORM_DELIVERY={render,reset};methodChanged();
})();
;
/* Source: payment-bridge.js */
(()=>{
 const pending=new Map();
 window.ACEFORM_receivePayment=data=>{const item=pending.get(data?.request);if(item){pending.delete(data.request);item.finish(data);}};
 function request(action,params={}) {
  return new Promise((resolve,reject)=>{
   const id='r'+Date.now().toString(36)+Math.random().toString(36).slice(2);
   const script=document.createElement('script');let timer;
   const cleanup=()=>{clearTimeout(timer);script.remove();pending.delete(id);};
   pending.set(id,{finish:data=>{cleanup();data.ok===true?resolve(data):reject(Error(data.error||'unavailable'));}});
   const url=new URL(window.ACEFORM_STOCK_URL);url.searchParams.set('action',action);url.searchParams.set('request',id);url.searchParams.set('v',Date.now());
   Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));script.src=url.href;
   script.onerror=()=>{cleanup();reject(Error('network'));};timer=setTimeout(()=>{cleanup();reject(Error('timeout'));},20000);document.head.append(script);
  });
 }
 let active=null,pollTimer=null,attempts=0;
 const $=s=>document.querySelector(s);
 function validOrder(data){return /^ACEFORM-[a-f0-9]{32}$/i.test(data.orderId||'')&&Number.isSafeInteger(data.amount)&&data.amount>0&&['pending','paid','underpaid'].includes(data.state);}
 function renderStatus(data){
  if(!validOrder(data)||data.orderId!==active?.orderId)throw Error('invalid_status');
  const paid=data.state==='paid',processing=paid&&data.fulfillment==='processing';
  $('#paymentResume').hidden=!(data.state==='pending'&&data.reservationActive);$('#paymentRelease').hidden=$('#paymentResume').hidden;
  $('#paymentReturnTitle').textContent=paid?'Оплата получена':data.state==='underpaid'?'Нужна проверка суммы':attempts>=40?'Оплата пока не подтверждена':'Проверяем оплату';
  $('#paymentReturnText').textContent=paid?'Твой выход на корт стал ближе. Оплата подтверждена ЮMoney.':data.state==='underpaid'?'Перевод найден, но получена не вся сумма заказа. Свяжитесь с ACEFORM для сверки.':attempts>=40?'Подтверждение ещё не пришло. Если деньги списались, не оплачивайте повторно — проверьте статус позже.':'Ждём подтверждение от ЮMoney. Обычно оно приходит вскоре после перевода.';
  $('#paymentReturnAmount').textContent=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(data.amount);
  $('#paymentReturnOrder').textContent=data.orderId;
  if(paid&&data.fulfillment==='review')$('#paymentReturnText').textContent='Оплата подтверждена. Наличие комплекта требует проверки — свяжемся с вами перед отправкой.';
  else if(processing)$('#paymentReturnText').textContent='Оплата подтверждена. Завершаем оформление комплекта…';
  else if(data.state==='pending'&&data.reservationActive)$('#paymentReturnText').textContent='Комплект зарезервирован до '+new Date(data.reserveExpiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'. Если деньги списались, дождитесь подтверждения и не оплачивайте повторно.';
  else if(data.state==='pending'&&data.reserveExpiresAt)$('#paymentReturnText').textContent=(data.reservationReleased?'Резерв отменён.':'Время резерва истекло.')+' Если ещё не оплатили, выберите комплект заново. Если деньги списались — свяжитесь с ACEFORM и не платите повторно.';
  $('#paymentReturnRetry').hidden=paid&&!processing;$('#paymentReturnState').dataset.kind=paid?'available':'unknown';$('#paymentReturnState').textContent=paid?'Подтверждено ЮMoney':data.state==='underpaid'?'Неполная сумма':'Ожидаем подтверждение';
  window.ACEFORM_DELIVERY?.render(data,active);
  if(paid){window.ACEFORM_REQUEST_CART?.settlePayment(data.orderId);clearTimeout(pollTimer);try{sessionStorage.setItem('aceform.pendingPayment',JSON.stringify({...data,token:active.token}));localStorage.setItem('aceform.latestOrder',JSON.stringify({...data,token:active.token}));sessionStorage.removeItem('aceform.checkoutDraft');}catch{}$('#lastPayment').hidden=false;$('#lastPayment').textContent='Мой заказ';$('#lastPayment').onclick=()=>show(active);}
  return paid&&!processing;
 }
 async function poll(){
  clearTimeout(pollTimer);if(!active)return;attempts++;
  const target={...active},stillActive=()=>active?.orderId===target.orderId&&active?.token===target.token;
  try{const data=await request('paymentStatus',target);if(!stillActive())return;const paid=renderStatus(data);if(!paid&&attempts<40&&$('#paymentReturnDialog').open)pollTimer=setTimeout(poll,3000);}
  catch{if(!stillActive())return;$('#paymentResume').hidden=true;$('#paymentRelease').hidden=true;window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Статус не подтверждён';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnAmount').textContent='';$('#paymentReturnTitle').textContent='Не удалось проверить оплату';$('#paymentReturnText').textContent='Статус временно недоступен. Если деньги списались, не оплачивайте повторно. Нажмите «Проверить ещё раз».';$('#paymentReturnRetry').hidden=false; }
 }
 function show(order){$('#paymentResume').hidden=true;$('#paymentRelease').hidden=true;window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Ожидаем подтверждение';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnRetry').hidden=false;active={orderId:order.orderId,token:order.token};attempts=0;$('#paymentReturnTitle').textContent='Проверяем оплату';$('#paymentReturnText').textContent='Запрашиваем подтверждение ЮMoney…';$('#paymentReturnOrder').textContent=order.orderId;$('#paymentReturnAmount').textContent='';$('#paymentReturnDialog').showModal();poll();}
 window.ACEFORM_PAYMENT_BRIDGE={request,validOrder,async create(selection){const data=await request('createPayment',selection);if(!validOrder(data)||!/^[a-f0-9]{64}$/i.test(data.token||''))throw Error('invalid_order');return data;},show};
 async function reservationAction(action){
  if(!active)return;const target={...active};$('#paymentResume').disabled=true;$('#paymentRelease').disabled=true;
  try{const data=await request(action,target);if(active?.orderId!==target.orderId||active?.token!==target.token)return;renderStatus(data);
   if(action==='resumePayment'&&data.state==='pending'&&data.reservationActive){
    const fields=window.ACEFORM_PAYMENT.fields(data.orderId,data.amount);fields.successURL=window.location.origin+window.location.pathname+'#payment='+data.orderId+'.'+target.token;
    for(const [name,value] of Object.entries(fields))$('#walletCheckout').elements.namedItem(name).value=value;$('#walletCheckout').submit();
   }
  }catch{if(active?.orderId===target.orderId)poll();}
  finally{$('#paymentResume').disabled=false;$('#paymentRelease').disabled=false;}
 }
 $('#paymentResume').onclick=()=>reservationAction('resumePayment');$('#paymentRelease').onclick=()=>reservationAction('releaseReservation');
 $('#paymentReturnRetry').onclick=()=>{attempts=0;poll();};
 $('#paymentReturnDialog').addEventListener('close',()=>clearTimeout(pollTimer));
 const match=window.location.hash.match(/^#payment=(ACEFORM-[a-f0-9]{32})\.([a-f0-9]{64})$/i);
 if(match)show({orderId:match[1],token:match[2]});
 else {try{const stored=JSON.parse(sessionStorage.getItem('aceform.pendingPayment')||localStorage.getItem('aceform.latestOrder')||'null');if(stored&&/^ACEFORM-[a-f0-9]{32}$/i.test(stored.orderId||'')&&/^[a-f0-9]{64}$/i.test(stored.token||'')){$('#lastPayment').hidden=false;$('#lastPayment').textContent=stored.state==='paid'?'Мой заказ':'Проверить последнюю оплату';$('#lastPayment').onclick=()=>show(stored);}}catch{}}
})();
;
/* Source: shop-shell.js */
/* Shop screens reuse the existing catalog, size selection and checkout. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),main=$('main'),section=$('#april'),gallery=section.querySelector('.april-gallery');
 const figures=[...gallery.children],rub=n=>n.toLocaleString('ru-RU')+' ₽';
 const outfits=[{title:'EVERT + MARBLE',color:'Тёмно-синий',price:10000},{title:'GRAF + BUENO',color:'Тёмно-синий / оранжевый',price:12900},{title:'EVERT + MARBLE',color:'Оранжевый',price:10000},{title:'GRAF + BUENO',color:'Оранжевый / тёмно-синий',price:12900}];
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 const home=$('#shopHome')||make('section','shop-home','<p class="shop-kicker">ТВОЯ ФОРМА ИГРЫ</p><h1>На корте.<br>В своём стиле.</h1>');home.id='shopHome';
 const hero=section.querySelector('.aperol-cover').cloneNode(true);hero.querySelector('h2').removeAttribute('id');hero.querySelector('a').href='#april';hero.querySelector('a').textContent='Смотреть коллекцию →';if(!home.querySelector('.aperol-cover'))home.append(hero);$('header').after(home);
 const collectionIntro=make('div','shop-collection-heading','<p class="shop-kicker">ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ</p><h1>Апероль</h1><p>Твой оттенок побережья.</p>');const capsule=section.querySelector('#aperolCapsule');section.replaceChildren(collectionIntro);if(capsule)section.append(capsule);
 const cards=make('div','shop-outfits','');section.append(cards);
 const detail=make('section','shop-outfit-detail','');detail.id='outfitDetail';section.after(detail);
 figures.forEach((figure,i)=>{const o=outfits[i],img=figure.querySelector('img'),card=make('a','shop-outfit-card',`<img src="${img.getAttribute('src')}" alt="${o.title} · ${o.color}" width="800" height="1000" loading="lazy" fetchpriority="low" decoding="async"><div><h2>${o.title}</h2><p>${o.color}</p><strong>${rub(o.price)}</strong><span aria-hidden="true">↗</span></div>`);card.href='#outfit/'+i;cards.append(card);figure.classList.add('shop-full-outfit');figure.querySelector('figcaption').textContent=o.title;figure.querySelector('.aperol-order .primary>span').textContent='Добавить · '+rub(o.price);const buy=make('div','shop-buy-bar','');const buyButton=figure.querySelector('.aperol-order .primary');buyButton.before(buy);buy.append(buyButton);figure.querySelector('.aperol-order details summary').textContent='Помочь с размером';const info=make('div','shop-info',`<details><summary>О комплекте</summary><p>${window.ACEFORM_DESCRIPTIONS[(i===1||i===3)?'aperolSuit':'aperolDress'].text}</p></details><details><summary>Доставка и срок</summary><p>Срок подтвердим до оплаты. СДЭК, курьер или самовывоз. Доставка оплачивается отдельно.</p></details>`);figure.append(info);const palette=make('div','shop-outfit-palette',(i===1||i===3)?'<p>Цвет комплекта · Апероль</p><div class="swatches"><a class="swatch" style="--color:linear-gradient(135deg,#15325c 60%,#e76123 60%)" href="#outfit/1" aria-label="Синий GRAF + оранжевая BUENO"></a><a class="swatch" style="--color:linear-gradient(135deg,#e76123 60%,#15325c 60%)" href="#outfit/3" aria-label="Оранжевый GRAF + синяя BUENO"></a></div><a href="#product/top">Другие цвета GRAF</a><a href="#product/skirt">Другие цвета BUENO</a>':`<p>Цвет комплекта</p><div class="swatches"><a class="swatch ${i===0?'selected':''}" style="--color:linear-gradient(135deg,%2315325c 60%,%23e76123 60%)" href="#outfit/0" aria-label="Тёмно-синий / оранжевый · Апероль" ${i===0?'aria-current="true"':''}></a><a class="swatch ${i===2?'selected':''}" style="--color:linear-gradient(135deg,%23e76123 60%,%2315325c 60%)" href="#outfit/2" aria-label="Оранжевый / тёмно-синий · Апероль" ${i===2?'aria-current="true"':''}></a></div><a href="#product/dress">Основные цвета EVERT</a>`);palette.innerHTML=palette.innerHTML.replaceAll('%23','#');figure.querySelector('.aperol-order .aperol-sizes').before(palette);});
 const baseInfo=make('div','shop-info shop-base-info','<details><summary>Об изделии</summary><p id="shopProductDescription"></p></details><details><summary>Доставка и срок</summary><p>СДЭК, курьер или самовывоз. Срок и стоимость согласуем при оформлении.</p></details>');$('#productDetails').after(baseInfo);
 const added=make('aside','shop-added','<div role="status"><strong>Добавлено в корзину</strong><p></p></div><div class="shop-added-actions"><button type="button" class="secondary">Продолжить выбор</button><button type="button" class="primary">В корзину →</button></div>');added.hidden=true;document.body.append(added);
 added.querySelector('.secondary').onclick=()=>{added.hidden=true;};added.querySelector('.primary').onclick=()=>{added.hidden=true;window.ACEFORM_REQUEST_CART.openCart();};
 document.addEventListener('aceform:basket-added',e=>{const all=[...window.ACEFORM_CATALOG,...window.ACEFORM_APEROL_CATALOG];added.querySelector('p').textContent=e.detail.map(s=>{const p=all.find(p=>p.id===s.product);return p.name.split(' · ')[0]+' · '+(s.product==='aperol-suit'?'GRAF '+s.size+' / BUENO '+s.skirtSize:s.product==='aperol-dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:s.size);}).join(' + ');added.hidden=false;tidyBasket();});
 const back=make('button' ,'shop-back','← Назад');back.type='button';home.before(back);
 const nav=$('.shop-nav')||make('nav','shop-nav','<a href="#shop">Магазин</a><button type="button" id="shopCart">Корзина <span></span></button><a href="#my-orders">Мои заказы</a>');nav.setAttribute('aria-label','Навигация магазина');document.body.append(nav);
 const orders=make('section','shop-orders','');orders.id='shopOrders';detail.after(orders);
 let previous='shop',active='shop';
 function route(){
  const hash=location.hash.slice(1),match=hash.match(/^outfit\/([0-3])$/),base=hash.match(/^product\/(dress|top|skirt)$/);
  active=match?'outfit':base?'product':hash==='april'||hash==='aperolLooks'?'collection':hash==='my-orders'?'orders':'shop';
  resetLimited();document.body.dataset.shopScreen=active;added.hidden=true;
  if(active==='collection')cards.querySelectorAll('img').forEach((img,i)=>{if(i<2){img.fetchPriority='high';img.loading='eager';}});
  if(match){const figure=figures[Number(match[1])],img=figure.querySelector('img');img.fetchPriority='high';img.loading='eager';detail.replaceChildren(figure);previous='april';}
  if(base){window.ACEFORM_SHOP.openProduct(base[1]);window.ACEFORM_MEDIA.prepareProduct(base[1]);syncPrice();$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[base[1]]?.text||'';previous='shop';}
  back.hidden=active==='shop';back.textContent=active==='outfit'?'← Коллекция «Апероль»':'← В магазин';
  nav.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',(a.hash==='#my-orders'?active==='orders':['shop','collection','outfit','product'].includes(active))?'page':'false'));
  window.scrollTo({top:0,behavior:'instant'});
 }
 back.onclick=()=>{location.hash=active==='outfit'?'april':'shop';};
 $('#shopCart').onclick=()=>window.ACEFORM_REQUEST_CART.openCart();
 let limited=null;
 const inlineLimited=make('div','shop-inline-limited','');inlineLimited.hidden=true;$('#purchaseOptions').append(inlineLimited);
 function restoreForms(){for(const figure of figures){const form=inlineLimited.querySelector('form');if(form&&figure.querySelector('figcaption').textContent===(form.dataset.product==='aperol-suit'?'GRAF + BUENO':'EVERT + MARBLE')&&figure===figures[limited?.index])figure.insertBefore(form,figure.querySelector('.shop-info'));}inlineLimited.replaceChildren();}
 function resetLimited(){restoreForms();limited=null;inlineLimited.hidden=true;$('#productDetails').classList.remove('limited-selection');const id=window.ACEFORM_SHOP.selection().product;$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[id]?.text||'';}
 function applyLimited(){
  if(!limited||active!=='product')return;
  const c=limited,preview=c.index===3,model=window.ACEFORM_APEROL_CATALOG.find(p=>p.id===(c.product==='dress'?'aperol-dress':'aperol-suit'));
  const src=['assets/fast-aperol-studio-dress-navy-v1.jpg','assets/fast-aperol-studio-suit-navy-orange-v2.jpg','assets/fast-aperol-studio-dress-orange-v1.jpg','assets/fast-aperol-studio-suit-orange-navy-v2.jpg'][c.index];
  $('#productDetails').classList.add('limited-selection');inlineLimited.hidden=false;$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[c.product==='dress'?'aperolDress':'aperolSuit'].text;
  window.ACEFORM_MEDIA.show($('#preview'),src,{class:'fit-main',alt:model.name+' · '+c.label}).then(shown=>{if(shown)window.ACEFORM_MEDIA.prepareProduct(c.product);});
  $('#colorName').textContent=c.label+' · Апероль';inlinePrice.textContent=rub(model.price)+(c.product==='dress'?' · платье + шорты':' · топ + юбка');
  $('#colors').querySelectorAll('button').forEach(b=>{const selected=b.dataset.aperolIndex===String(c.index);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(!inlineLimited.querySelector('form')){const note=make('p','shop-inline-note',c.product==='dress'?'Платье + шорты':'Топ + юбка · только комплектом');inlineLimited.append(note,figures[c.index].querySelector('form'));}
  syncPrice();
 }
 function chooseLimited(c,id){restoreForms();limited={...c,product:id};applyLimited();}
 function collectionColors(id){
  const colors=id==='dress'?[{label:'Тёмно-синий / оранжевый',color:'#15325c',accent:'#e76123',index:0},{label:'Оранжевый / тёмно-синий',color:'#e76123',accent:'#15325c',index:2}]:id==='top'?[{label:'Тёмно-синий',color:'#15325c',index:1},{label:'Оранжевый',color:'#e76123',index:3}]:id==='skirt'?[{label:'Оранжевый',color:'#e76123',index:1},{label:'Тёмно-синий',color:'#15325c',index:3}]:[];
  for(const c of colors){const button=make('button','swatch shop-limited-swatch','<span class="shop-limited-mark" aria-hidden="true">🍹</span>');button.type='button';button.style.setProperty('--color',c.accent?`linear-gradient(135deg,${c.color} 60%,${c.accent} 60%)`:c.color);const label=c.label+(id==='dress'?' · Апероль · комплект 10 000 ₽':' · костюм GRAF + BUENO 12 900 ₽');button.setAttribute('aria-label',label);button.title=label;button.dataset.aperolIndex=String(c.index);button.onclick=()=>chooseLimited(c,id);$('#colors').append(button);}
  if(limited)queueMicrotask(applyLimited);

 }
 window.ACEFORM_STOREFRONT={open(id){location.hash='product/'+id;},colors:collectionColors,regularColor:resetLimited};

 const inlinePrice=make('p','shop-product-price','');
 const syncPrice=()=>{inlinePrice.textContent=limited?rub(limited.product==='dress'?10000:12900)+(limited.product==='dress'?' · платье + шорты':' · топ + юбка'):$('#price').textContent;$('#purchaseOptions').prepend(inlinePrice);};
 document.addEventListener('aceform:aperol-price',syncPrice);
 new MutationObserver(syncPrice).observe($('#price'),{childList:true,characterData:true,subtree:true});
 const measureNav=()=>document.documentElement.style.setProperty('--shop-nav-height',nav.getBoundingClientRect().height+'px');
 new ResizeObserver(measureNav).observe(nav);measureNav();
 const basket=$('#basketDialog');
 function tidyBasket(){const gift=$('.certificate-offer');if(gift&&gift.parentElement!==basket){$('#basketActions').after(gift);}const n=window.ACEFORM_REQUEST_CART.value().reduce((s,x)=>s+x.quantity,0);$('#shopCart span').textContent=n?'· '+n:'';}
 basket.addEventListener('close',tidyBasket);$('#shopCart').addEventListener('click',tidyBasket);$('#basketOpen').addEventListener('click',tidyBasket);
 new MutationObserver(tidyBasket).observe($('#basketItems'),{childList:true});tidyBasket();
 addEventListener('hashchange',route);
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const launch=start.match(/^aperol_(dress|suit)_([01])_/),ask=start.match(/^ask_(top|skirt)_/);
 if(new URLSearchParams(location.search).get('screen')==='cart')setTimeout(()=>$('#shopCart').click(),0);
 if(start==='my_orders'||new URLSearchParams(location.search).get('screen')==='my-orders')location.hash='my-orders';
 else if(launch)location.hash='outfit/'+(launch[1]==='suit'?(launch[2]==='1'?3:1):launch[2]==='1'?2:0);else if(ask)location.hash='product/'+ask[1];
 route();
})();
;
/* Source: order-accounting.js */
/* Shared read-only customer display; only the owner endpoint can record a payment. */
(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
 const methods={cdek:'СДЭК',courier:'Курьер',pickup:'Самовывоз',avito:'Авито'};
 function funds(o){return o.funds||{goodsTotal:o.quote?.totalCents??null,goodsPaid:o.paidAt?(o.quote?.depositCents||0):0,goodsBalance:o.quote?Math.max(0,o.quote.totalCents-(o.paidAt?o.quote.depositCents:0)):null,goodsCredit:0,shippingTotal:o.delivery?.costCents===undefined?(o.quote?.shippingCents??null):o.delivery.costCents,shippingPaid:0,shippingBalance:o.delivery?.costCents===undefined?(o.quote?.shippingCents??null):o.delivery.costCents,shippingPaymentMode:o.delivery?.paymentMode||'unknown',history:[],version:0};}
 function status(o){const f=funds(o);return f.goodsTotal===null?'Стоимость согласуем':f.goodsCredit?'Переплата за изделия':f.goodsPaid===0?'Не оплачено':f.goodsBalance===0?'Изделия оплачены полностью':'Частично оплачено';}
 function payment(o){const f=funds(o);if(f.goodsTotal===null)return '<p>Стоимость изделий ещё согласуется. Оплата пока не требуется.</p>';const row=(a,b)=>`<div><dt>${a}</dt><dd>${money(b)}</dd></div>`;return `<section class="order-payment" aria-label="Оплата"><h2>Оплата изделий</h2><p class="muted">Один заказ · два платежа</p><p>${status(o)}</p><dl>${row('Стоимость изделий',f.goodsTotal)}${row('Внесено',f.goodsPaid)}${row('Осталось за изделия',f.goodsBalance)}${f.goodsCredit?row('Переплата',f.goodsCredit):''}</dl>${f.goodsPaid===0&&o.quote?`<p class="muted">Предоплата к внесению: ${money(o.quote.depositCents)}</p>`:''}<div class="payment-stages"><span>1 · Предоплата ${money(o.quote.depositCents)}<small>${f.goodsPaid>=o.quote.depositCents?'Получена':'Ожидает оплаты'}</small></span><span>2 · Остаток ${money(o.quote.totalCents-o.quote.depositCents)}<small>${f.goodsBalance===0?'Оплачен':f.goodsPaid>o.quote.depositCents?'Частично оплачен':'Ожидает оплаты'}</small></span></div>${o.balancePayment?.canPay?`<button id="payBalance" class="primary" type="button">Оплатить остаток · ${money(f.goodsBalance)}</button><p class="muted">Оплата через ЮMoney. Доставка отдельно.</p>`:''}${o.balancePayment?.pending?'<p class="muted">Оплата второго платежа ожидает подтверждения. Если деньги уже списались, не плати повторно.</p>':''}${f.history?.length?`<details class="payment-history"><summary>История оплат и возвратов</summary>${f.history.map(e=>`<p>${esc(new Date(e.at).toLocaleDateString('ru-RU'))} · ${e.kind==='refund'?'Возврат':'Получено'} ${money(e.amountCents)} · ${e.target==='shipping'?'доставка':'изделия'}</p>`).join('')}</details>`:''}</section>`;}
 function delivery(o){const f=funds(o),d=o.delivery||o.intake?.value||{},tracking=o.progress?.tracking;return `<section class="order-receiving"><h2>Доставка и получение</h2><p>${esc([methods[d.method]||'Способ получения пока не выбран',d.city].filter(Boolean).join(' · '))}</p>${d.carrier&&d.carrier!==methods[d.method]?`<p>${esc(d.carrier)}</p>`:''}${d.recipient?`<p>${esc(d.recipient)}${d.phone?' · '+esc(d.phone):''}</p>`:''}${d.address?`<p>${esc(d.address)}</p>`:''}${d.method==='pickup'?'<p class="muted">Самовывоз по согласованию.</p>':''}<p>${f.shippingTotal===null?'Стоимость доставки уточняется':f.shippingTotal===0?'Доставка бесплатно':'Стоимость доставки: '+money(f.shippingTotal)}</p>${f.shippingTotal===0?'':f.shippingPaymentMode==='store'?`<p>Оплата доставки — ACEFORM.${f.shippingPaid?' Получено: '+money(f.shippingPaid)+'.':''}${f.shippingBalance!==null?' Осталось: '+money(f.shippingBalance)+'.':''}${f.shippingCredit?' Переплата: '+money(f.shippingCredit)+'.':''}</p>`:f.shippingPaymentMode==='carrier'?'<p class="muted">Доставка оплачивается перевозчику отдельно. В остаток за изделия не входит.</p>':'<p class="muted">Условия оплаты доставки уточняются.</p>'}${tracking?`<p><strong>Трек-номер:</strong> ${esc(tracking)}</p>`:''}${d.note||o.progress?.deliveryNote?`<p class="muted">${esc(d.note||o.progress.deliveryNote)}</p>`:''}</section>`;}
 window.ACEFORM_ACCOUNTING={funds,status,payment,delivery,money};
})();
;
/* Source: customer-orders.js */
/* Account-scoped order history. No customer records or auth tokens in storage. */
(()=>{
 'use strict';
 const root=document.querySelector('#shopOrders');if(!root)return;
 const tg=window.Telegram?.WebApp,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rub=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
 let token=null,busy=false,offset=0,orders=[];
 root.innerHTML='<p class="shop-kicker">ACEFORM · ТВОИ ПОКУПКИ</p><h1>Мои заказы</h1><div class="order-list-toolbar"><p id="customerOrdersStatus" role="status"></p><button class="size-link" id="customerOrdersRefresh" type="button">Обновить ↻</button></div><p id="customerOrdersError" role="alert" hidden></p><div id="customerOrdersList"></div><button class="secondary" id="customerOrdersMore" hidden>Показать ещё</button>';
 const $=s=>root.querySelector(s),request=(path,method='GET',data)=>window.ACEFORM_TREE_TRANSPORT.request(path,method,data,token);
 function open(id){if(!/^[a-f0-9]{32}$/.test(id))return;const url=new URL('my-order.html?order='+id,location.href);const fragment=new URLSearchParams();fragment.set('tgWebAppData',tg?.initData||'');fragment.set('tgWebAppVersion',tg?.version||'8.0');fragment.set('tgWebAppPlatform',tg?.platform||'unknown');url.hash=fragment.toString();location.assign(url.href);}
 window.ACEFORM_CUSTOMER_ORDERS={open};
 const titles={closed:'Отменён',delivered:'Выполнен',production:'В работе',accepted:'Заказ принят',offer_ready:'Ожидает подтверждения',awaiting_payment:'Ожидает предоплаты',received:'Заказ получен',preparing_offer:'Уточняем стоимость',clarifying:'Уточняем детали',ready:'Готов к отправке',pickup:'Готов к самовывозу',shipped:'Отправлен'};
 const next={closed:'Посмотреть заказ',delivered:'Посмотреть заказ',production:'Открыть заказ',accepted:'Открыть заказ',offer_ready:'Проверить заказ',awaiting_payment:'Внести предоплату',received:'Выбрать получение',preparing_offer:'Открыть заказ',clarifying:'Посмотреть детали',ready:'Проверить получение',pickup:'Посмотреть получение',shipped:'Посмотреть отправление'};
 function card(o){const code=o.progress?.code||'received',q=o.quote,pics=o.previews||[],funds=window.ACEFORM_ACCOUNTING.funds(o),paid=funds.goodsPaid;return `<article class="customer-order-card"><div class="customer-order-meta"><span>№ ${esc(o.id.slice(0,8).toUpperCase())}</span><time>${o.created?new Date(o.created).toLocaleDateString('ru-RU'):''}</time></div><span class="customer-order-status" data-status="${esc(code)}">${esc(titles[code]||o.progress?.title||'Заказ получен')}</span>${pics.length?`<div class="customer-order-pictures">${pics.slice(0,3).map(p=>`<img src="${esc(window.ACEFORM_MEDIA?.src(p.photo)||p.photo)}" alt="${esc(p.name)}" loading="lazy">`).join('')}</div>`:''}<p class="customer-order-names">${esc([...new Set(pics.map(p=>p.name))].join(' + ')||'Твой заказ ACEFORM')}</p><p class="customer-order-total">${q?rub(q.totalCents):'Стоимость согласуем'}</p>${q?`<p class="customer-order-payment">${esc(window.ACEFORM_ACCOUNTING.status(o))}${paid?' · '+rub(paid):''}<br>Осталось за изделия · ${rub(funds.goodsBalance)}</p>`:''}<p class="customer-order-next">${esc(code==='production'?'Готовим твой заказ.':o.progress?.note||'Открой заказ, чтобы посмотреть подробности.')}</p>${o.progress?.tracking?`<p class="customer-order-tracking">Трек: ${esc(o.progress.tracking)}</p>`:''}<button type="button" class="primary" data-customer-order="${esc(o.id)}">${esc(code==='awaiting_payment'&&paid>0?'Открыть заказ':next[code]||'Открыть заказ')} <span aria-hidden="true">→</span></button></article>`;}
 function render(){const ended=o=>['closed','delivered'].includes(o.progress?.code);const active=orders.filter(o=>!ended(o)),past=orders.filter(ended);$('#customerOrdersList').innerHTML=active.map(card).join('')+(past.length?'<h2 class="customer-order-history">История</h2>'+past.map(card).join(''):'');$('#customerOrdersList').querySelectorAll('[data-customer-order]').forEach(b=>b.onclick=()=>open(b.dataset.customerOrder));}
 async function load(more=false){if(busy)return;busy=true;$('#customerOrdersRefresh').disabled=true;$('#customerOrdersMore').disabled=true;$('#customerOrdersError').hidden=true;
  if(!tg?.initData){$('#customerOrdersStatus').textContent='Открой магазин в Telegram — здесь появятся твои заказы.';$('#customerOrdersList').innerHTML='<a class="primary" href="https://t.me/aceform_bot/shop?startapp=my_orders">Открыть магазин в Telegram ↗</a>';busy=false;$('#customerOrdersRefresh').disabled=false;return;}
  if(!more)$('#customerOrdersStatus').textContent='Загружаем заказы…';
  try{if(!token)token=(await request('/api/shop/customer-session','POST',{initData:tg.initData})).token;const page=await request('/api/shop/my','GET',{offset:more?offset:0});orders=more?[...new Map([...orders,...page.orders].map(o=>[o.id,o])).values()]:page.orders;offset=page.nextOffset;$('#customerOrdersMore').hidden=!page.hasMore;render();$('#customerOrdersStatus').textContent=orders.length?'Статусы обновлены':'Здесь пока нет заказов.';if(!orders.length)$('#customerOrdersList').innerHTML='<p class="customer-orders-empty">Выбери свой первый образ — после оформления его статус появится здесь.</p><a class="primary" href="#shop">В магазин →</a>';
  }catch(e){if(/вход|войти|Telegram/i.test(e.message))token=null;$('#customerOrdersError').hidden=false;$('#customerOrdersError').textContent=e.message||'Не удалось загрузить заказы. Попробуй ещё раз.';$('#customerOrdersStatus').textContent=orders.length?'Показаны ранее загруженные данные':'';}
  finally{busy=false;$('#customerOrdersRefresh').disabled=false;$('#customerOrdersMore').disabled=false;}}
 $('#customerOrdersRefresh').onclick=()=>load();$('#customerOrdersMore').onclick=()=>load(true);
 const visible=()=>document.body.dataset.shopScreen==='orders';addEventListener('hashchange',()=>{if(visible())load();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visible())load();});setInterval(()=>{if(!document.hidden&&visible())load();},30000);if(visible())load();
})();
;

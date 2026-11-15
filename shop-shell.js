/* Shop screens reuse the existing catalog, size selection and checkout. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),main=$('main'),section=$('#april'),gallery=section.querySelector('.april-gallery');
 const figures=[...gallery.children],rub=n=>n.toLocaleString('ru-RU')+' ₽';
 const outfits=[{title:'EVERT + MARBLE',color:'Тёмно-синий',price:9000},{title:'GRAF + BUENO',color:'Тёмно-синий / оранжевый',price:11900},{title:'EVERT + MARBLE',color:'Оранжевый',price:9000},{title:'GRAF + BUENO',color:'Оранжевый / тёмно-синий',price:11900}];
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 const home=make('section','shop-home','<p class="shop-kicker">ТВОЯ ФОРМА ИГРЫ</p><h1>На корте.<br>В своём стиле.</h1>');home.id='shopHome';
 const hero=section.querySelector('.aperol-cover').cloneNode(true);hero.querySelector('h2').removeAttribute('id');hero.querySelector('a').href='#april';hero.querySelector('a').textContent='Смотреть коллекцию →';home.append(hero);$('header').after(home);
 const collectionIntro=make('div','shop-collection-heading','<p class="shop-kicker">ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ</p><h1>Апероль</h1><p>Твой оттенок побережья.</p>');section.replaceChildren(collectionIntro);
 const cards=make('div','shop-outfits','');section.append(cards);
 const detail=make('section','shop-outfit-detail','');detail.id='outfitDetail';section.after(detail);
 figures.forEach((figure,i)=>{const o=outfits[i],img=figure.querySelector('img'),card=make('a','shop-outfit-card',`<img src="${img.getAttribute('src')}" alt="${o.title} · ${o.color}" width="800" height="1000" loading="lazy"><div><h2>${o.title}</h2><p>${o.color}</p><strong>${rub(o.price)}</strong><span aria-hidden="true">↗</span></div>`);card.href='#outfit/'+i;cards.append(card);figure.classList.add('shop-full-outfit');figure.querySelector('figcaption').textContent=o.title;figure.querySelector('.aperol-order .primary>span').textContent='Добавить · '+rub(o.price);const buy=make('div','shop-buy-bar','');const buyButton=figure.querySelector('.aperol-order .primary');buyButton.before(buy);buy.append(buyButton);figure.querySelector('.aperol-order details summary').textContent='Помочь с размером';const info=make('div','shop-info',`<details><summary>О комплекте</summary><p>${window.ACEFORM_DESCRIPTIONS[(i===1||i===3)?'aperolSuit':'aperolDress'].text}</p></details><details><summary>Доставка и срок</summary><p>Срок подтвердим до оплаты. СДЭК, курьер или самовывоз. Доставка оплачивается отдельно.</p></details>`);figure.append(info);const palette=make('div','shop-outfit-palette',(i===1||i===3)?'<p>Цвет комплекта · Апероль</p><div class="swatches"><a class="swatch" style="--color:linear-gradient(135deg,#15325c 60%,#e76123 60%)" href="#outfit/1" aria-label="Синий GRAF + оранжевая BUENO"></a><a class="swatch" style="--color:linear-gradient(135deg,#e76123 60%,#15325c 60%)" href="#outfit/3" aria-label="Оранжевый GRAF + синяя BUENO"></a></div><a href="#product/top">Другие цвета GRAF</a><a href="#product/skirt">Другие цвета BUENO</a>':`<p>Цвет комплекта</p><div class="swatches"><a class="swatch ${i===0?'selected':''}" style="--color:linear-gradient(135deg,%2315325c 60%,%23e76123 60%)" href="#outfit/0" aria-label="Тёмно-синий / оранжевый · Апероль" ${i===0?'aria-current="true"':''}></a><a class="swatch ${i===2?'selected':''}" style="--color:linear-gradient(135deg,%23e76123 60%,%2315325c 60%)" href="#outfit/2" aria-label="Оранжевый / тёмно-синий · Апероль" ${i===2?'aria-current="true"':''}></a></div><a href="#product/dress">Основные цвета EVERT</a>`);palette.innerHTML=palette.innerHTML.replaceAll('%23','#');figure.querySelector('.aperol-order .aperol-sizes').before(palette);});
 const baseInfo=make('div','shop-info shop-base-info','<details><summary>Об изделии</summary><p id="shopProductDescription"></p></details><details><summary>Доставка и срок</summary><p>СДЭК, курьер или самовывоз. Срок и стоимость согласуем при оформлении.</p></details>');$('#productDetails').after(baseInfo);
 const added=make('aside','shop-added','<div role="status"><strong>Добавлено в корзину</strong><p></p></div><div class="shop-added-actions"><button type="button" class="secondary">Продолжить выбор</button><button type="button" class="primary">В корзину →</button></div>');added.hidden=true;document.body.append(added);
 added.querySelector('.secondary').onclick=()=>{added.hidden=true;};added.querySelector('.primary').onclick=()=>{added.hidden=true;window.ACEFORM_REQUEST_CART.openCart();};
 document.addEventListener('aceform:basket-added',e=>{const all=[...window.ACEFORM_CATALOG,...window.ACEFORM_APEROL_CATALOG];added.querySelector('p').textContent=e.detail.map(s=>{const p=all.find(p=>p.id===s.product);return p.name.split(' · ')[0]+' · '+(s.product==='aperol-suit'?'GRAF '+s.size+' / BUENO '+s.skirtSize:s.product==='aperol-dress'?'EVERT '+s.size+' / MARBLE '+s.shortsSize:s.size);}).join(' + ');added.hidden=false;tidyBasket();});
 const back=make('button' ,'shop-back','← Назад');back.type='button';home.before(back);
 const nav=make('nav','shop-nav','<a href="#shop">Магазин</a><button type="button" id="shopCart">Корзина <span></span></button><a href="#my-orders">Мои заказы</a>');nav.setAttribute('aria-label','Навигация магазина');document.body.append(nav);
 const orders=make('section','shop-orders','');orders.id='shopOrders';detail.after(orders);
 let previous='shop',active='shop';
 function route(){
  const hash=location.hash.slice(1),match=hash.match(/^outfit\/([0-3])$/),base=hash.match(/^product\/(dress|top|skirt|shorts)$/);
  active=match?'outfit':base?'product':hash==='april'||hash==='aperolLooks'?'collection':hash==='my-orders'?'orders':'shop';
  resetLimited();document.body.dataset.shopScreen=active;added.hidden=true;
  if(match){detail.replaceChildren(figures[Number(match[1])]);previous='april';}
  if(base){window.ACEFORM_SHOP.openProduct(base[1]);syncPrice();$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[base[1]]?.text||'';previous='shop';}
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
  const src=['assets/aperol-studio-dress-navy-v1.jpg','assets/aperol-studio-suit-navy-orange-v2.jpg','assets/aperol-studio-dress-orange-v1.jpg','assets/aperol-studio-suit-orange-navy-v2.jpg'][c.index];
  $('#productDetails').classList.add('limited-selection');inlineLimited.hidden=false;$('#shopProductDescription').textContent=window.ACEFORM_DESCRIPTIONS[c.product==='dress'?'aperolDress':'aperolSuit'].text;
  const img=document.createElement('img');img.className='fit-main';img.src=src;img.alt=model.name+' · '+c.label;$('#preview').replaceChildren(img);
  $('#colorName').textContent=c.label+' · Апероль';inlinePrice.textContent=rub(model.price)+(c.product==='dress'?' · платье + шорты':' · топ + юбка');
  $('#colors').querySelectorAll('button').forEach(b=>{const selected=b.dataset.aperolIndex===String(c.index);b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
  if(!inlineLimited.querySelector('form')){const note=make('p','shop-inline-note',c.product==='dress'?'Платье + шорты':'Топ + юбка · только комплектом');inlineLimited.append(note,figures[c.index].querySelector('form'));}
 }
 function chooseLimited(c,id){restoreForms();limited={...c,product:id};applyLimited();}
 function collectionColors(id){
  const colors=id==='dress'?[{label:'Тёмно-синий / оранжевый',color:'#15325c',accent:'#e76123',index:0},{label:'Оранжевый / тёмно-синий',color:'#e76123',accent:'#15325c',index:2}]:id==='top'?[{label:'Тёмно-синий',color:'#15325c',index:1},{label:'Оранжевый',color:'#e76123',index:3}]:id==='skirt'?[{label:'Оранжевый',color:'#e76123',index:1},{label:'Тёмно-синий',color:'#15325c',index:3}]:[];
  for(const c of colors){const button=make('button','swatch shop-limited-swatch','<span class="shop-limited-mark" aria-hidden="true">🍹</span>');button.type='button';button.style.setProperty('--color',c.accent?`linear-gradient(135deg,${c.color} 60%,${c.accent} 60%)`:c.color);const label=c.label+(id==='dress'?' · Апероль · комплект 9 000 ₽':' · костюм GRAF + BUENO 11 900 ₽');button.setAttribute('aria-label',label);button.title=label;button.dataset.aperolIndex=String(c.index);button.onclick=()=>chooseLimited(c,id);$('#colors').append(button);}
  if(limited)queueMicrotask(applyLimited);

 }
 window.ACEFORM_STOREFRONT={open(id){location.hash='product/'+id;},colors:collectionColors,regularColor:resetLimited};

 const inlinePrice=make('p','shop-product-price','');
 const syncPrice=()=>{inlinePrice.textContent=limited?rub(limited.product==='dress'?9000:11900)+(limited.product==='dress'?' · платье + шорты':' · топ + юбка'):$('#price').textContent;$('#purchaseOptions').prepend(inlinePrice);};
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
 if(start==='my_orders'||new URLSearchParams(location.search).get('screen')==='my-orders')location.hash='my-orders';
 else if(launch)location.hash='outfit/'+(launch[1]==='suit'?(launch[2]==='1'?3:1):launch[2]==='1'?2:0);else if(ask)location.hash='product/'+ask[1];
 route();
})();

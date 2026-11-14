/* Shop screens reuse the existing catalog, size selection and checkout. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),main=$('main'),section=$('#april'),gallery=section.querySelector('.april-gallery');
 const figures=[...gallery.children],rub=n=>n.toLocaleString('ru-RU')+' ₽';
 const outfits=[{title:'EVERT + MARBLE',color:'Тёмно-синий',price:9000},{title:'GRAF + BUENO',color:'Тёмно-синий / оранжевый',price:11900},{title:'EVERT + MARBLE',color:'Оранжевый',price:9000}];
 const make=(tag,cls,html)=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e;};
 const home=make('section','shop-home','<p class="shop-kicker">ТВОЯ ФОРМА ИГРЫ</p><h1>На корте.<br>В своём стиле.</h1>');home.id='shopHome';
 const hero=section.querySelector('.aperol-cover').cloneNode(true);hero.querySelector('h2').removeAttribute('id');hero.querySelector('a').href='#april';hero.querySelector('a').textContent='Смотреть коллекцию →';home.append(hero);$('header').after(home);
 const collectionIntro=make('div','shop-collection-heading','<p class="shop-kicker">ЛИМИТИРОВАННАЯ КОЛЛЕКЦИЯ</p><h1>Апероль</h1><p>Три образа в оттенках побережья.</p>');section.replaceChildren(collectionIntro);
 const cards=make('div','shop-outfits','');section.append(cards);
 const detail=make('section','shop-outfit-detail','');detail.id='outfitDetail';section.after(detail);
 figures.forEach((figure,i)=>{const o=outfits[i],img=figure.querySelector('img'),card=make('a','shop-outfit-card',`<img src="${img.getAttribute('src')}" alt="${o.title} · ${o.color}" width="800" height="1000" loading="lazy"><div><h2>${o.title}</h2><p>${o.color}</p><strong>${rub(o.price)}</strong><span aria-hidden="true">↗</span></div>`);card.href='#outfit/'+i;cards.append(card);figure.classList.add('shop-full-outfit');figure.querySelector('figcaption').textContent=o.title;figure.querySelector('.aperol-order .primary>span').textContent='Добавить · '+rub(o.price);});
 const back=make('button','shop-back','← Назад');back.type='button';home.before(back);
 const nav=make('nav','shop-nav','<a href="#shop">Магазин</a><button type="button" id="shopCart">Корзина <span></span></button><a href="#my-orders">Мои заказы</a>');nav.setAttribute('aria-label','Навигация магазина');document.body.append(nav);
 const orders=make('section','shop-orders','<p class="shop-kicker">ACEFORM · ТВОИ ПОКУПКИ</p><h1>Мои заказы</h1><p>Подтверждения и статусы заказов приходят в Telegram. Открой сообщение от ACEFORM и нажми «Мой заказ».</p><a class="primary" href="https://t.me/aceform_bot">Открыть ACEFORM в Telegram ↗</a>');orders.id='shopOrders';detail.after(orders);
 if(!$('#lastPayment').hidden){const last=make('button','secondary','Последний заказ на этом устройстве');last.type='button';last.onclick=()=>$('#lastPayment').click();orders.append(last);}
 let previous='shop',active='shop';
 function route(){
  const hash=location.hash.slice(1),match=hash.match(/^outfit\/([0-2])$/),base=hash.match(/^product\/(dress|top|skirt|shorts)$/);
  active=match?'outfit':base?'product':hash==='april'||hash==='aperolLooks'?'collection':hash==='my-orders'?'orders':'shop';
  document.body.dataset.shopScreen=active;
  if(match){detail.replaceChildren(figures[Number(match[1])]);previous='april';}
  if(base){window.ACEFORM_SHOP.openProduct(base[1]);previous='shop';}
  back.hidden=active==='shop';back.textContent=active==='outfit'?'← Коллекция «Апероль»':'← В магазин';
  nav.querySelectorAll('a').forEach(a=>a.setAttribute('aria-current',(a.hash==='#my-orders'?active==='orders':['shop','collection','outfit','product'].includes(active))?'page':'false'));
  window.scrollTo({top:0,behavior:'instant'});
 }
 back.onclick=()=>{location.hash=active==='outfit'?'april':'shop';};
 $('#shopCart').onclick=()=>window.ACEFORM_REQUEST_CART.openCart();
 window.ACEFORM_STOREFRONT={open(id){location.hash='product/'+id;}};
 const basket=$('#basketDialog');
 function tidyBasket(){const gift=$('.certificate-offer');if(gift&&gift.parentElement!==basket){$('#basketActions').after(gift);}const n=window.ACEFORM_REQUEST_CART.value().reduce((s,x)=>s+x.quantity,0);$('#shopCart span').textContent=n?'· '+n:'';}
 basket.addEventListener('close',tidyBasket);$('#shopCart').addEventListener('click',tidyBasket);$('#basketOpen').addEventListener('click',tidyBasket);
 new MutationObserver(tidyBasket).observe($('#basketItems'),{childList:true});tidyBasket();
 addEventListener('hashchange',route);
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const launch=start.match(/^aperol_(dress|suit)_([01])_/),ask=start.match(/^ask_(top|skirt)_/);
 if(launch)location.hash='outfit/'+(launch[1]==='suit'?1:launch[2]==='1'?2:0);else if(ask)location.hash='product/'+ask[1];
 route();
})();

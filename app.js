const $ = s => document.querySelector(s);
const products = window.ACEFORM_CATALOG;
const sizes = ['S','M','L'];
const tg = window.Telegram?.WebApp;
if (tg?.initData) {try {tg.ready();tg.expand();tg.setHeaderColor('#f7f7f0');tg.setBackgroundColor('#f7f7f0');}catch {}}
let state = {product:0,color:0,size:'M',quantity:1,mode:'query'};
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
function preorderOnly(p=current()) {return p.id==='top'||p.id==='skirt';}
function availability() {
 if(preorderOnly())return {label:'Предзаказ',kind:'preorder'};
 const v=variant();
 if(!v || v.quantity===null)return {label:'Наличие уточняется',kind:'unknown'};
 if(v.quantity>0)return {label:`В наличии · ${v.quantity} шт.`,kind:'available'};
 return {label:v.preorder===true?'Предзаказ':v.preorder===false?'Нет в наличии':'Предзаказ уточняется',kind:v.preorder===true?'preorder':'unknown'};
}
function render() {
 const p=current(),v=variant(),a=availability();
 if(preorderOnly())state.mode='preorder';
 if(state.mode==='stock'&&!(v?.quantity>0))state.mode='query';
 if(state.mode==='preorder'&&!preorderOnly()&&v?.preorder!==true)state.mode='query';
 if(state.mode==='stock')state.quantity=Math.min(state.quantity,v.quantity);
 $('#products').replaceChildren();products.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className='product'+(i===state.product?' selected':'');b.setAttribute('aria-pressed',i===state.product);b.innerHTML=`<div class="thumb">${photo(p,0,true)}<span class="check">✓</span></div><b>${p.name}</b><em>${p.subtitle}</em>`;b.onclick=()=>{state.product=i;state.color=0;state.quantity=1;state.mode='query';render()};const wrap=document.createElement('div');wrap.className='product-card';const help=document.createElement('button');help.type='button';help.className='size-link card-size';help.textContent='Подобрать размер ↗';help.setAttribute('aria-label','Подобрать размер: '+p.name);help.onclick=()=>{state.product=i;state.color=0;state.quantity=1;state.mode='query';render();openSizeGuide()};wrap.append(b,help);$('#products').append(wrap)});
 $('#studioTitle').textContent=p.name;$('#preview').innerHTML=photo(p,state.color);$('#colorName').textContent=p.colors[state.color][0];
 $('#photoCaption').textContent=p.id==='shorts'?'Визуализация по фото ACEFORM · одинаковый крой':(p.colors[state.color][2]?.includes('-catalog.')?'Каталожная визуализация по фото ACEFORM':'Фото ACEFORM · выбранный цвет');
 buttons($('#colors'),p.colors,state.color,i=>{state.color=i;state.quantity=1;state.mode='query';render()},true);
 buttons($('#sizes'),sizes,sizes.indexOf(state.size),i=>{state.size=sizes[i];state.quantity=1;state.mode='query';render()});
 $('#stockBadge').textContent=a.label;$('#stockBadge').dataset.kind=a.kind;
 const opts=preorderOnly()?[['preorder','Предзаказ',false]]:[['stock','В наличии',!(v?.quantity>0)],['preorder','Предзаказ',v?.preorder!==true],['query','Уточнить',false]];
 $('#orderTypes').replaceChildren();opts.forEach(([mode,label,disabled])=>{const b=document.createElement('button');b.className='option'+(mode===state.mode?' selected':'');b.textContent=label;b.disabled=disabled;b.setAttribute('aria-pressed',mode===state.mode);b.onclick=()=>{state.mode=mode;render()};$('#orderTypes').append(b)});
 $('#availabilityHint').textContent=state.mode==='stock'?'Количество доступно по последней проверке. Резерв подтвердит менеджер.':state.mode==='preorder'?'Предзаказ разрешён. Срок изготовления согласуем с вами.':'Отправьте запрос — подтвердим наличие и возможность изготовления.';
 $('#stockStatus').textContent=feedState==='ready'?`Обновлено ${new Date(receivedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}`:feedState==='loading'?'Проверяем остатки…':feedState==='unconfigured'?'Подключение остатков настраивается':'Не удалось обновить наличие';
 $('#stockRefresh').disabled=feedState==='loading'||feedState==='unconfigured';
 $('#qty').value=state.quantity;$('#minus').disabled=state.quantity<=1;$('#plus').disabled=state.quantity>=(state.mode==='stock'?v.quantity:99);
 $('#price').textContent=v?.price!==null&&v?.price!==undefined?money(v.price*state.quantity):'Стоимость уточняется';
 $('#review').firstChild.textContent=state.mode==='stock'?'Подготовить заказ ':state.mode==='preorder'?'Подготовить предзаказ ':'Уточнить наличие ';
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
function details() {const p=current(),v=variant();return [['Изделие',p.name],['Цвет',p.colors[state.color][0]],['Размер',state.size],['Формат',state.mode==='stock'?'Из наличия':state.mode==='preorder'?'Предзаказ':'Уточнить наличие'],['Количество',state.quantity+' шт.'],['Стоимость',v?.price!=null?money(v.price*state.quantity):'Уточняется']];}
$('#minus').onclick=()=>{state.quantity=Math.max(1,state.quantity-1);render()};$('#plus').onclick=()=>{const max=state.mode==='stock'?(variant()?.quantity||1):99;state.quantity=Math.min(max,state.quantity+1);render()};
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#sizesHelp').onclick=openSizeGuide;$('#stockRefresh').onclick=refreshStock;
$('#review').onclick=()=>{render();$('#summary').replaceChildren();for(const [k,v] of details()){const row=document.createElement('div');row.className='order-line';for(const value of [k,v]){const s=document.createElement('span');s.textContent=value;row.append(s)}$('#summary').append(row)}$('#orderForm').classList.remove('hidden');$('#result').classList.add('hidden');$('#orderDialog').showModal()};
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
$('#applySize').onclick=()=>{if(recommendedSize){state.size=recommendedSize;state.quantity=1;render();$('#sizeDialog').close();}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshStock()});setInterval(()=>{if(!document.hidden)refreshStock()},60000);render();refreshStock();

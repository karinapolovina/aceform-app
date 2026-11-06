(()=>{
 'use strict';
 const tg=window.Telegram?.WebApp;tg?.ready();tg?.expand();
 const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>(n/100).toLocaleString('ru-RU',{style:'currency',currency:'RUB'});
 const params=new URLSearchParams(location.search),id=params.get('order'),path='/api/shop/my/'+id;
 const methods={cdek:'СДЭК',courier:'Курьер',pickup:'Самовывоз',avito:'Авито'};
 let token=null,busy=false,current=null,saved=false;
 const request=(p,m='GET',data)=>window.ACEFORM_TREE_TRANSPORT.request(p,m,data,token);
 function intake(o){
  const previous=o.intake?.value||{},step=params.get('step');
  const selected=step==='change'?'change':step==='size'?'size':step==='delivery'?'confirm':previous.intent||'confirm';
  return `<section class="intake"><h2>Как получить твою форму?</h2><p>Проверь выбор, укажи город и удобный способ получения. Стоимость доставки подтвердим отдельно.</p>
   <form id="intakeForm"><label for="intent">Следующий шаг</label><select id="intent" name="intent">${[['confirm','Всё верно · выбрать доставку'],['change','Хочу изменить выбор'],['size','Нужна помощь с размером']].map(([v,t])=>`<option value="${v}" ${selected===v?'selected':''}>${t}</option>`).join('')}</select>
   <label for="city">Город получения</label><input id="city" name="city" autocomplete="address-level2" maxlength="80" value="${esc(previous.city||'')}" placeholder="Например, Санкт-Петербург">
   <label for="method">Способ получения</label><select id="method" name="method"><option value="">Выбрать</option>${Object.entries(methods).map(([v,t])=>`<option value="${v}" ${previous.method===v?'selected':''}>${t}</option>`).join('')}</select>
   <label for="comment">Пожелания или вопрос</label><textarea id="comment" name="comment" maxlength="600" rows="3" placeholder="Что изменить, какие мерки проверить или что уточнить">${esc(previous.comment||'')}</textarea>
   <p class="muted">Для СДЭК позже уточним пункт выдачи, для курьера — адрес. Самовывоз и отправку через Авито согласуем в переписке.</p>
   <button id="saveIntake" type="submit">${o.intake?'Сохранить изменения':'Отправить детали'}</button><p id="intakeSaved" role="status">${saved?'Детали сохранены и переданы ACEFORM. Ответим здесь в Telegram.':o.intake?'Твои детали сохранены. ACEFORM свяжется с тобой в Telegram.':''}</p></form></section>`;
 }
 function render(o){
  current=o;const q=o.quote,previews=o.previews||[],needsHelp=o.intake&&o.intake.value.intent!=='confirm';
  $('#status').textContent='Заявка № '+o.id.slice(0,8).toUpperCase();
  $('#order').innerHTML=`<h2>Твой выбор</h2>${previews.length?`<div class="previews">${previews.map(i=>`<figure><img src="${esc(i.photo)}" alt="${esc(i.name+' · '+i.color)}"><figcaption><strong>${esc(i.name)}</strong><br>${esc(i.color)}<br>Размер ${esc(i.size)} · ${esc(i.quantity)} шт.</figcaption></figure>`).join('')}</div>`:`<p class="details">${esc(o.comment)}</p>`}
   ${previews.length?intake(o):''}
   ${q?`<article class="lead"><h2>Итог заказа</h2>${q.discountCents?`<p>Сертификат ACEFORM: −${money(q.discountCents)}</p>`:''}<p>Стоимость заказа: <strong>${money(q.totalCents)}</strong></p><p>Предоплата 50%: <strong>${money(q.depositCents)}</strong></p><p>Остаток: ${money(q.totalCents-q.depositCents)}</p><p class="muted">${esc(q.terms)}</p></article>${needsHelp?'<p>Сначала согласуем изменения или размер в Telegram. После этого можно будет подтвердить итог.</p>':o.paidAt?'<h2>Предоплата получена</h2><p>Заказ подтверждён. Дальнейшие детали согласуем с тобой.</p>':o.confirmedAt?`<p>Итог подтверждён.</p><button id="pay" type="button">Оплатить предоплату ${money(q.depositCents)} ↗</button>`:`<label><input id="accept" type="checkbox"> Подтверждаю состав заказа, итоговую стоимость ${money(q.totalCents)} и предоплату 50%.</label><p><button id="confirm" type="button">Подтвердить итог заказа</button></p>`}`:'<h2>Дальше — согласование</h2><p>Подтвердим стоимость, срок изготовления и условия доставки в Telegram. Предоплата — после согласования заказа.</p>'}`;
  if($('#intakeForm')){
   const sync=()=>{const confirm=$('#intent').value==='confirm';$('#city').required=confirm;$('#method').required=confirm;$('#comment').required=!confirm;};$('#intent').onchange=sync;sync();
   $('#intakeForm').onsubmit=async event=>{event.preventDefault();const button=$('#saveIntake');if(button.disabled||!$('#intakeForm').reportValidity())return;button.disabled=true;$('#error').hidden=true;try{const value={intent:$('#intent').value,city:$('#city').value.trim(),method:$('#method').value,comment:$('#comment').value.trim(),revision:current.intake?.revision||0};const updated=await request(path+'/intake','POST',value);saved=true;render(updated);}catch(e){show(e.message);button.disabled=false;}};
  }
  if($('#confirm'))$('#confirm').onclick=async()=>{if(!$('#accept').checked){show('Подтверди, что проверил состав и стоимость заказа.');return;}await action($('#confirm'),()=>request(path+'/confirm','POST',{revision:q.revision,accept:true}));};
  if($('#pay'))$('#pay').onclick=async()=>action($('#pay'),async()=>{const p=await request(path+'/payment','POST');if(p.alreadyPaid)return;if(p.orderId!=='ACEFORM-'+id||Math.round(p.amount*100)!==q.depositCents)throw Error('Не удалось проверить сумму. Обнови заказ.');const url=new URL('preorder-checkout.html',location.href);url.hash=p.orderId+'.'+p.token;if(tg?.openLink)tg.openLink(url.href);else location.assign(url.href);});
 }
 async function load(){if(busy)return;busy=true;$('#refresh').disabled=true;$('#error').hidden=true;try{if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Проверь ссылку на заказ.');if(!token){if(!tg?.initData)throw Error('Открой эту заявку кнопкой из сообщения @aceform_bot. Доступ есть только у покупателя.');token=(await request('/api/shop/customer-session','POST',{initData:tg.initData})).token;}render(await request(path));}catch(e){show(e.message);$('#status').textContent='Не удалось загрузить заявку';}finally{busy=false;$('#refresh').disabled=false;}}
 function show(text){$('#error').hidden=false;$('#error').textContent=text;if(!tg?.initData&&/^[a-f0-9]{32}$/.test(id||'')){const a=document.createElement('a');a.href='https://t.me/aceform_bot/shop?startapp=order_'+id;a.textContent=' Открыть заявку в Telegram ↗';$('#error').append(a);}}
 async function action(button,fn){button.disabled=true;$('#error').hidden=true;try{await fn();await load();}catch(e){show(e.message);}finally{button.disabled=false;}}
 $('#refresh').onclick=load;load();
})();

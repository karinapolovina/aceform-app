(()=>{
 const $=s=>document.querySelector(s),form=$('#deliveryForm');
 let order=null,auth=null,busy=false,submissionId=null;
 const methods={cdek:'СДЭК — пункт выдачи',avito:'Авито',courier:'Курьер',pickup:'Самовывоз'};
 function reset(){order=null;auth=null;$('#deliverySection').hidden=true;$('#paidOrderSummary').hidden=true;}
 function render(data,credentials){
  if(data.state!=='paid'){reset();return;}
  if(order?.orderId!==data.orderId){form.reset();form.hidden=true;submissionId=null;methodChanged();}
  order=data;auth={orderId:data.orderId,token:credentials.token};
  $('#deliverySection').hidden=false;$('#paidOrderSummary').hidden=false;
  const shorts={white:'белые шорты',black:'чёрные шорты',both:'белые и чёрные шорты'}[data.bundle]||'шорты';
  $('#paidOrderSummary').textContent=`Твой комплект: платье, ${data.color}, ${data.size}; ${shorts}, ${data.shortsSize}. Количество: ${data.quantity}.`;
  const saved=!!data.delivery;$('#deliveryStart').hidden=saved||!form.hidden;$('#deliveryReceived').hidden=!saved;
  if(saved){
   form.hidden=true;$('#deliveryError').hidden=true;
   const d=data.delivery,shipped=d.state==='shipped',collected=d.state==='collected';
   $('#deliveryReceivedTitle').textContent=collected?'Комплект у тебя':shipped?'Твой комплект отправлен':'Данные для доставки получены';
   $('#deliveryReceivedText').textContent=collected?'Спасибо, что выбираешь ACEFORM. Красивой игры!':shipped?`Способ получения: ${methods[d.method]||'согласован с тобой'}.`:`Способ получения: ${methods[d.method]||'согласуем'}. Проверим детали и свяжемся по указанным контактам. Стоимость доставки согласуем отдельно.`;
   $('#deliveryTracking').hidden=!d.tracking;$('#deliveryTracking').textContent=d.tracking?'Трек-номер: '+d.tracking:'';
  }
 }
 function methodChanged(){
  const m=$('#deliveryMethod').value,needsAddress=m==='cdek'||m==='courier';
  $('#deliveryAddressLabel').hidden=!needsAddress;$('#deliveryAddress').required=needsAddress;
  $('#deliveryAddressTitle').textContent=m==='courier'?'Адрес доставки: улица, дом, квартира':'Адрес или код пункта СДЭК';
  $('#deliveryMethodHint').textContent={cdek:'Укажи удобный пункт СДЭК. Проверим его перед отправкой.',avito:'Согласуем оформление через Авито отдельно. Здесь заказ на Авито не создаётся; повторно оплачивать комплект не нужно.',courier:'Проверим возможность доставки по твоему адресу и согласуем стоимость.',pickup:'Место и время самовывоза согласуем по указанным контактам.'}[m];
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

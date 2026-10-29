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
  const paid=data.state==='paid';
  $('#paymentReturnTitle').textContent=paid?'Оплата получена':data.state==='underpaid'?'Нужна проверка суммы':attempts>=40?'Оплата пока не подтверждена':'Проверяем оплату';
  $('#paymentReturnText').textContent=paid?'Твой выход на корт стал ближе. Оплата подтверждена ЮMoney.':data.state==='underpaid'?'Перевод найден, но получена не вся сумма заказа. Свяжитесь с ACEFORM для сверки.':attempts>=40?'Подтверждение ещё не пришло. Если деньги списались, не оплачивайте повторно — проверьте статус позже.':'Ждём подтверждение от ЮMoney. Обычно оно приходит вскоре после перевода.';
  $('#paymentReturnAmount').textContent=new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(data.amount);
  $('#paymentReturnOrder').textContent=data.orderId;
  $('#paymentReturnRetry').hidden=paid;$('#paymentReturnState').dataset.kind=paid?'available':'unknown';$('#paymentReturnState').textContent=paid?'Подтверждено ЮMoney':data.state==='underpaid'?'Неполная сумма':'Ожидаем подтверждение';
  window.ACEFORM_DELIVERY?.render(data,active);
  if(paid){clearTimeout(pollTimer);try{sessionStorage.setItem('aceform.pendingPayment',JSON.stringify({...data,token:active.token}));localStorage.setItem('aceform.latestOrder',JSON.stringify({...data,token:active.token}));sessionStorage.removeItem('aceform.checkoutDraft');}catch{}$('#lastPayment').hidden=false;$('#lastPayment').textContent='Мой заказ';$('#lastPayment').onclick=()=>show(active);}
  return paid;
 }
 async function poll(){
  clearTimeout(pollTimer);if(!active)return;attempts++;
  const target={...active},stillActive=()=>active?.orderId===target.orderId&&active?.token===target.token;
  try{const data=await request('paymentStatus',target);if(!stillActive())return;const paid=renderStatus(data);if(!paid&&attempts<40&&$('#paymentReturnDialog').open)pollTimer=setTimeout(poll,3000);}
  catch{if(!stillActive())return;window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Статус не подтверждён';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnAmount').textContent='';$('#paymentReturnTitle').textContent='Не удалось проверить оплату';$('#paymentReturnText').textContent='Статус временно недоступен. Если деньги списались, не оплачивайте повторно. Нажмите «Проверить ещё раз».';$('#paymentReturnRetry').hidden=false; }
 }
 function show(order){window.ACEFORM_DELIVERY?.reset();$('#paymentReturnState').textContent='Ожидаем подтверждение';$('#paymentReturnState').dataset.kind='unknown';$('#paymentReturnRetry').hidden=false;active={orderId:order.orderId,token:order.token};attempts=0;$('#paymentReturnTitle').textContent='Проверяем оплату';$('#paymentReturnText').textContent='Запрашиваем подтверждение ЮMoney…';$('#paymentReturnOrder').textContent=order.orderId;$('#paymentReturnAmount').textContent='';$('#paymentReturnDialog').showModal();poll();}
 window.ACEFORM_PAYMENT_BRIDGE={request,validOrder,async create(selection){const data=await request('createPayment',selection);if(!validOrder(data)||!/^[a-f0-9]{64}$/i.test(data.token||''))throw Error('invalid_order');return data;},show};
 $('#paymentReturnRetry').onclick=()=>{attempts=0;poll();};
 $('#paymentReturnDialog').addEventListener('close',()=>clearTimeout(pollTimer));
 const match=window.location.hash.match(/^#payment=(ACEFORM-[a-f0-9]{32})\.([a-f0-9]{64})$/i);
 if(match)show({orderId:match[1],token:match[2]});
 else {try{const stored=JSON.parse(sessionStorage.getItem('aceform.pendingPayment')||localStorage.getItem('aceform.latestOrder')||'null');if(stored&&/^ACEFORM-[a-f0-9]{32}$/i.test(stored.orderId||'')&&/^[a-f0-9]{64}$/i.test(stored.token||'')){$('#lastPayment').hidden=false;$('#lastPayment').textContent=stored.state==='paid'?'Мой заказ':'Проверить последнюю оплату';$('#lastPayment').onclick=()=>show(stored);}}catch{}}
})();

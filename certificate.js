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
 if(requested||tg?.initData)activate();
})();

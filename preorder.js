(()=>{
 'use strict';
 const form=document.querySelector('#orderForm'),button=form.querySelector('button[type="submit"]'),error=document.querySelector('#preorderError');
 let inquiry=false;
 const node=id=>document.querySelector('#'+id);
 const defaultConsent=node('requestConsent').textContent;
 const extras=document.createElement('details');extras.id='requestExtras';const extraSummary=document.createElement('summary');extraSummary.textContent='Добавить имя или пожелания · необязательно';extras.append(extraSummary);node('contactLabel').after(extras);
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
 window.ACEFORM_PREORDER={open(selection){window.ACEFORM_REQUEST_CART?.open(selection);inquiry=['top','skirt'].includes(selection?.product);error.hidden=true;error.textContent='';button.disabled=busy;button.textContent=inquiry?'Отправить запрос ↗':'Отправить заявку ↗';node('requestEyebrow').textContent=inquiry?'ТВОЙ ЗАПРОС':'ТВОЙ ВЫБОР';node('requestTitle').textContent=inquiry?'Узнать стоимость и срок':'Почти на корте.';node('requestSuccessTitle').textContent=inquiry?'Запрос получен':'Заявка получена';const name=form.querySelector('[name=customer]');name.required=!inquiry;form.querySelector('[name=comment]').maxLength=inquiry?850:1000;if(inquiry){extras.append(node('customerLabel'),node('commentLabel'));}else{node('requestFields').prepend(node('customerLabel'));node('contactLabel').after(node('commentLabel'));}extras.hidden=!inquiry;const telegram=!!window.Telegram?.WebApp?.initData;node('requestFields').hidden=inquiry&&!telegram;button.hidden=inquiry&&!telegram;node('preorderTelegram').hidden=!inquiry||telegram;node('preorderTelegram').textContent=inquiry?'Открыть выбранное изделие в Telegram ↗':'Открыть магазин в Telegram ↗';node('preorderTelegram').href=inquiry?'https://t.me/aceform_bot/shop?startapp=ask_'+selection.product+'_'+selection.color+'_'+selection.size:'https://t.me/aceform_bot/shop';node('requestConsent').textContent=inquiry?'Передаю ACEFORM контакт, а также имя и пожелания, если указаны, для ответа о стоимости и сроке изготовления.':defaultConsent;node('requestNote').textContent=inquiry?(telegram?'Сообщим стоимость и срок изготовления по указанному контакту. Это запрос информации, без оплаты и обязательства оформить заказ.':'Отправка запроса доступна в Telegram. Открой магазин — выбранные изделие, цвет и размер сохранятся.'):'Отправим заявку в ACEFORM. Стоимость, наличие и срок согласуем с вами.';},async submit(selection){
  if(busy)return;error.hidden=true;error.textContent='';
  if(!form.reportValidity())return;
  const tg=window.Telegram?.WebApp;if(!tg?.initData){error.hidden=false;error.textContent=inquiry?'Чтобы отправить запрос стоимости и срока, открой магазин в Telegram через @aceform_bot.':'Для итога заказа и предоплаты открой магазин в Telegram через @aceform_bot.';document.querySelector('#preorderTelegram').hidden=false;return;}
  const fields=new FormData(form),data={session,name:String(fields.get('customer')||'').trim()||(inquiry?(tg.initDataUnsafe?.user?.first_name||'Клиент ACEFORM'):''),contact:String(fields.get('contact')||'').trim(),comment:(inquiry?'Запрос стоимости и срока изготовления. Без оформления заказа.\n':'')+String(fields.get('comment')||'').trim(),selection:{...selection},consent:fields.get('consent')==='yes',website:String(fields.get('website')||''),certificate:window.ACEFORM_CERTIFICATE?.requested?'club1000':''};
  const cart=window.ACEFORM_REQUEST_CART?.value();if(cart?.length){data.schemaVersion=2;data.selections=cart;data.selection=cart[0];}
  busy=true;button.disabled=true;button.textContent=inquiry?'Отправляем запрос…':'Отправляем заявку…';
  try{
   data.nonce=await intent(data);data.initData=tg.initData;
   if(tg.initDataUnsafe?.user?.allows_write_to_pm!==true&&tg.requestWriteAccess){const allowed=await new Promise(resolve=>tg.requestWriteAccess(resolve));if(!allowed)throw Error('Разреши боту прислать итог заказа, чтобы продолжить.');}
   const result=await window.ACEFORM_TREE_TRANSPORT.request('/api/shop/orders','POST',data);
   if(result?.received!==true||!/^[a-f0-9]{32}$/.test(result.id||''))throw Error('Не удалось подтвердить получение заявки. Повтори отправку.');
   window.ACEFORM_REQUEST_CART?.clear();form.classList.add('hidden');document.querySelector('#result').classList.remove('hidden');
   document.querySelector('#preorderReference').textContent='№ '+result.id.slice(0,8).toUpperCase();
   document.querySelector('#preorderSuccessText').textContent=inquiry?(result.duplicate?'Этот запрос уже получен. Повторно отправлять его не нужно.':'Запрос получен. В @aceform_bot придёт сообщение со всеми выбранными изделиями и вопросом о доставке. Стоимость и срок подтвердим после уточнения деталей.'):result.duplicate?'Эта заявка уже получена. Повторно отправлять её не нужно.':'Заявка получена. Итог заказа придёт в @'+(result.botUsername==='aceform_tree_bot'?'aceform_tree_bot':'aceform_bot')+'. Там можно проверить состав, подтвердить заказ и оплатить 50% предоплаты, когда указана цена.';
   const orderLink=document.querySelector('#preorderOrderLink');orderLink.href='https://t.me/aceform_bot/shop?startapp=order_'+result.id;orderLink.hidden=false;orderLink.textContent=inquiry?'Проверить выбор и указать доставку ↗':'Посмотреть итог заказа ↗';
   if(data.certificate&&!inquiry)document.querySelector('#preorderSuccessText').textContent+=' Применение сертификата показано в итоговом заказе.';
  }catch(e){error.hidden=false;error.textContent=(e.message||'').replace('Проверь «Моё желание» перед повторной отправкой.','Повтори отправку — дубль заявки не создастся.')||'Не удалось отправить заявку. Проверь соединение и попробуй ещё раз. Данные формы сохранены.';}
  finally{busy=false;button.disabled=false;button.textContent=inquiry?'Отправить запрос ↗':'Отправить заявку ↗';}
 }};
 document.querySelector('#preorderClose').onclick=()=>document.querySelector('#orderDialog').close();
})();

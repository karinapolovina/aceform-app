(()=>{
 'use strict';
 const form=document.querySelector('#orderForm'),button=form.querySelector('button[type="submit"]'),error=document.querySelector('#preorderError');
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
 window.ACEFORM_PREORDER={open(){error.hidden=true;error.textContent='';button.disabled=busy;},async submit(selection){
  if(busy)return;error.hidden=true;error.textContent='';
  if(!form.reportValidity())return;
  const tg=window.Telegram?.WebApp;if(!tg?.initData){error.hidden=false;error.textContent='Для итога заказа и предоплаты открой магазин в Telegram через @aceform_bot.';document.querySelector('#preorderTelegram').hidden=false;return;}
  const fields=new FormData(form),data={session,name:String(fields.get('customer')||'').trim(),contact:String(fields.get('contact')||'').trim(),comment:String(fields.get('comment')||'').trim(),selection:{...selection},consent:fields.get('consent')==='yes',website:String(fields.get('website')||''),certificate:window.ACEFORM_CERTIFICATE?.requested?'club1000':''};
  busy=true;button.disabled=true;button.textContent='Отправляем заявку…';
  try{
   data.nonce=await intent(data);data.initData=tg.initData;
   if(tg.initDataUnsafe?.user?.allows_write_to_pm!==true&&tg.requestWriteAccess){const allowed=await new Promise(resolve=>tg.requestWriteAccess(resolve));if(!allowed)throw Error('Разреши боту прислать итог заказа, чтобы продолжить.');}
   const result=await window.ACEFORM_TREE_TRANSPORT.request('/api/shop/orders','POST',data);
   if(result?.received!==true||!/^[a-f0-9]{32}$/.test(result.id||''))throw Error('Не удалось подтвердить получение заявки. Повтори отправку.');
   form.classList.add('hidden');document.querySelector('#result').classList.remove('hidden');
   document.querySelector('#preorderReference').textContent='№ '+result.id.slice(0,8).toUpperCase();
   document.querySelector('#preorderSuccessText').textContent=result.duplicate?'Эта заявка уже получена. Повторно отправлять её не нужно.':'Заявка получена. Итог заказа придёт в @'+(result.botUsername==='aceform_tree_bot'?'aceform_tree_bot':'aceform_bot')+'. Там можно проверить состав, подтвердить заказ и оплатить 50% предоплаты, когда указана цена.';
   const orderLink=document.querySelector('#preorderOrderLink');orderLink.href='https://t.me/aceform_bot/shop?startapp=order_'+result.id;orderLink.hidden=false;
   if(data.certificate)document.querySelector('#preorderSuccessText').textContent+=' Сертификат проверим при согласовании заказа.';
  }catch(e){error.hidden=false;error.textContent=(e.message||'').replace('Проверь «Моё желание» перед повторной отправкой.','Повтори отправку — дубль заявки не создастся.')||'Не удалось отправить заявку. Проверь соединение и попробуй ещё раз. Данные формы сохранены.';}
  finally{busy=false;button.disabled=false;button.textContent='Отправить заявку ↗';}
 }};
 document.querySelector('#preorderClose').onclick=()=>document.querySelector('#orderDialog').close();
})();

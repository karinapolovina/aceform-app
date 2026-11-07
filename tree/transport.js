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
   const frame=document.createElement('iframe');frame.hidden=true;frame.title='Защищённое соединение с хранилищем ACEFORM';
   const url=new URL(endpoint);url.searchParams.set('nonce',nonce);frame.src=url.href;
   const timer=setTimeout(()=>{disconnect();reject(Error('Не удалось подключиться к хранилищу Google. Попробуй ещё раз.'));},25000);
   function receive(event){
    const msg=event.data;
    if(!msg||msg.nonce!==nonce||!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;
    if(msg.kind==='aceform-tree-ready'&&!peer){peer=event.source;peerOrigin=event.origin;clearTimeout(timer);resolve();return;}
    if(event.source!==peer||event.origin!==peerOrigin||msg.kind!=='aceform-tree-response')return;
    const item=pending.get(msg.id);if(item){pending.delete(msg.id);clearTimeout(item.timer);msg.result?.ok?item.resolve(msg.result.data):item.reject(Error(msg.result?.error||'Сервис недоступен.'));}
   }
   disconnect=()=>{clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();peer=null;peerOrigin=null;ready=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Соединение прервалось. Проверь результат перед повторной отправкой.'));}pending.clear();};
   window.addEventListener('message',receive);
   document.body.append(frame);
  });
  return ready.catch(error=>{ready=null;throw error;});
 }
 window.ACEFORM_TREE_TRANSPORT={warm:connect,async request(path,method='GET',data,token){await connect();return new Promise((resolve,reject)=>{const id=random(),timer=setTimeout(()=>{pending.delete(id);disconnect();reject(Error('Ответ задерживается. Проверь «Моё желание» перед повторной отправкой.'));},30000);pending.set(id,{resolve,reject,timer});peer.postMessage({kind:'aceform-tree-request',nonce,id,request:{path,method,data:data||{},token:token||'',nonce:id}},peerOrigin);});}};
})();

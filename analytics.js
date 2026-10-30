(()=>{
 const STORE='aceform.analytics.queue',EXCLUDE='aceform.analytics.exclude';let queue=[],busy=false,enabled=true,opened=new Set(),selection=null,visible=false;
 try{const p=new URLSearchParams(location.search);if(p.get('analytics_test')==='1')localStorage.setItem(EXCLUDE,'1');if(p.get('analytics_test')==='0')localStorage.removeItem(EXCLUDE);}catch{}
 let test=0,visitor,session;
 try{
  test=localStorage.getItem(EXCLUDE)==='1'?1:0;const suffix=test?'.test':'';
  let v=JSON.parse(localStorage.getItem('aceform.analytics.browser'+suffix)||'null');if(!v||Date.now()-v.at>30*86400000)v={id:crypto.randomUUID(),at:Date.now()};localStorage.setItem('aceform.analytics.browser'+suffix,JSON.stringify(v));visitor=v.id;
  let s=JSON.parse(sessionStorage.getItem('aceform.analytics.visit'+suffix)||'null');if(!s||Date.now()-s.at>30*60000)s={id:crypto.randomUUID()};s.at=Date.now();sessionStorage.setItem('aceform.analytics.visit'+suffix,JSON.stringify(s));session=s.id;
  queue=JSON.parse(localStorage.getItem(STORE)||'[]');if(!Array.isArray(queue))queue=[];queue=queue.filter(x=>x&&Date.now()-x.at<7*86400000&&x.event&&x.id).slice(-120);
 }catch{enabled=false;}
 function save(){try{localStorage.setItem(STORE,JSON.stringify(queue.slice(-120)));}catch{}}
 function track(event,detail={}){
  if(!enabled)return;const e={id:crypto.randomUUID(),visitor,session,event,product:detail.product||'',color:Number.isInteger(detail.color)?detail.color:-1,size:['S','M','L'].includes(detail.size)?detail.size:'',bundle:['white','black','both'].includes(detail.bundle)?detail.bundle:'',test};
  queue.push({...e,at:Date.now()});queue=queue.slice(-120);save();if(queue.length>=4)flush();
 }
 function batch(){if(!queue.length)return [];const first=queue[0];return queue.filter(e=>e.visitor===first.visitor&&e.session===first.session).slice(0,6).map(({at,...e})=>e);}
 async function flush(){
  if(busy||!enabled||!queue.length||!window.ACEFORM_PAYMENT_BRIDGE)return;busy=true;
  try{const data=await window.ACEFORM_PAYMENT_BRIDGE.request('recordAnalytics',{events:JSON.stringify(batch())});if(Array.isArray(data.accepted)){const ids=new Set(data.accepted);queue=queue.filter(e=>!ids.has(e.id));save();}}
  catch{}finally{busy=false;}
 }
 function sendOnExit(){if(!enabled||!queue.length||!navigator.sendBeacon)return;try{navigator.sendBeacon(window.ACEFORM_STOCK_URL,new URLSearchParams({action:'recordAnalytics',events:JSON.stringify(batch())}));}catch{}}
 function maybeView(){if(visible&&selection&&!opened.has(selection.product)){opened.add(selection.product);track('product_open',selection);}}
 function view(s){selection=s;maybeView();}
 function start(){
  if(test){const note=document.createElement('p');note.className='hint';note.textContent='Тестовый режим: ваши действия исключены из статистики клиентов.';document.querySelector('header')?.after(note);}
  const target=document.querySelector('#preview');if(target&&'IntersectionObserver' in window){new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);maybeView();},{threshold:0.25}).observe(target);}
  track('app_open');flush();
 }
 window.ACEFORM_ANALYTICS={track,view,flush,sendOnExit,get test(){return test===1;}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)sendOnExit();else flush();});window.addEventListener('pagehide',sendOnExit);setInterval(flush,8000);setTimeout(start,0);
})();

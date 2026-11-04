'use strict';
// Certificate launch keeps the original signed Telegram fragment across navigation.
const certificateLaunch=window.Telegram?.WebApp;
if(certificateLaunch?.initDataUnsafe?.start_param==='cert_club1000'){
 const target=new URL('../?certificate=club1000',location.href);
 const fragment=new URLSearchParams();fragment.set('tgWebAppData',certificateLaunch.initData);fragment.set('tgWebAppVersion',certificateLaunch.version||'8.0');fragment.set('tgWebAppPlatform',certificateLaunch.platform||'unknown');target.hash=fragment.toString();location.replace(target.href);
}

const app=document.querySelector('#app');
const PRODUCTS=window.ACEFORM_CATALOG.flatMap(model=>model.colors.map((variant,index)=>({id:model.id==='dress'?['black','white','red'][index]:model.id+'-'+index,model:model.id,title:model.name.split(' · ')[0],color:variant[0],image:'../'+(model.id==='shorts'?['assets/shorts-white-side-catalog-v15.webp','assets/shorts-black-side-red-catalog-v15.webp'][index]:variant[2]),note:model.id==='dress'?'Комплект от 8 000 ₽':model.id==='shorts'?'Стоимость уточним при заказе':'По предзаказу'})));
let selectedModel='dress';
const SAMPLES=[{"id":"example-1","product":"white","name":"","anonymous":false,"dream":"Сыграть свой первый турнир. Даже если коленки будут дрожать сильнее, чем ракетка.","size":"M","example":true},{"id":"example-2","product":"black","name":"","anonymous":false,"dream":"Вернуться на корт после долгой паузы. Без гонки за прежней собой — просто снова полюбить игру.","size":"M","example":true},{"id":"example-3","product":"red","name":"","anonymous":false,"dream":"Найти напарницу, с которой после матча можно ещё час обсуждать всё на свете.","size":"M","example":true},{"id":"example-4","product":"white","name":"","anonymous":false,"dream":"Уехать в теннисный кемп у моря. Утром — корт, вечером — никуда не торопиться.","size":"M","example":true,"items":[{"product":"white","size":"M"},{"product":"top-1","size":"M"},{"product":"skirt-0","size":"M"},{"product":"shorts-1","size":"M"}]},{"id":"example-5","product":"red","name":"","anonymous":false,"dream":"Разрешить себе быть заметной. Выйти на корт в красном и перестать прятаться на задней линии.","size":"M","example":true},{"id":"example-6","product":"black","name":"","anonymous":false,"dream":"Сделать один вечер в неделю своим. Отключить телефон, взять ракетку и оставить все дела за пределами корта.","size":"M","example":true}];
let EXAMPLES=[...SAMPLES];
let savedWish=null;
let pendingSavedView=null;
let apiSession=null;
let apiConfig={dev:true};
let serverReady=false;
const STATUS={legacy:'Личная карточка из ссылки',pending:'На проверке',approved:'Опубликовано на ёлке',rejected:'Нужно изменить историю'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let draft={items:[],product:'white',size:'M',name:'',anonymous:true,dream:'',channel:false,publicConsent:false};
let currentStep=1;
let draftKey=null,hasLocalDraft=false;
function persistDraft(){
 if(!draftKey)return;
 try{localStorage.setItem(draftKey,JSON.stringify({updated:Date.now(),revision:savedWish?.revision||0,draft}));hasLocalDraft=true;}catch{}
}
function clearLocalDraft(){if(draftKey)try{localStorage.removeItem(draftKey);}catch{}hasLocalDraft=false;}
function restoreDraft(){
 const user=window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
 if(!user)return;
 draftKey='aceform.tree.draft.v1.'+user;
 try{
  const cached=JSON.parse(localStorage.getItem(draftKey));
  if(!cached)return;
  const w=cached.draft;
  if(Date.now()-cached.updated>7*86400000||cached.revision!==(savedWish?.revision||0)){clearLocalDraft();return;}
  if(!w||!Array.isArray(w.items)||w.items.length>15||new Set(w.items.map(i=>i.product)).size!==w.items.length||w.items.some(i=>!PRODUCTS.some(p=>p.id===i.product)||!['S','M','L','Не знаю'].includes(i.size))||typeof w.dream!=='string'||w.dream.length>280||typeof w.name!=='string'||w.name.length>30)return;
  draft={items:w.items,product:w.items[0]?.product||'white',size:w.items[0]?.size||'Не знаю',name:w.name,dream:w.dream,anonymous:w.anonymous!==false,channel:w.channel===true,publicConsent:w.publicConsent===true};hasLocalDraft=true;
 }catch{}
}

function legacyCard(value){
 if(!value||value.length>4096)throw new Error('Некорректная ссылка.');
 const bytes=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)),w=JSON.parse(new TextDecoder().decode(bytes));
 if(!w||!PRODUCTS.some(p=>p.id===w.product)||typeof w.dream!=='string'||w.dream.length<10||w.dream.length>280||typeof w.name!=='string'||w.name.length>30||typeof w.anonymous!=='boolean')throw new Error('Некорректная карточка.');
 return {id:'legacy',product:w.product,dream:w.dream,name:w.anonymous?'':w.name,anonymous:w.anonymous,status:'legacy',example:false};
}
function readWish(){return savedWish;}
function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3800);}
function go(hash){if(location.hash===hash)route();else location.hash=hash;}
function wishItems(w){return Array.isArray(w.items)?w.items.map(i=>({...i})):w.product?[{product:w.product,size:w.size||'Не знаю'}]:[];}
function chosenProducts(w){return wishItems(w).map(i=>PRODUCTS.find(p=>p.id===i.product)).filter(Boolean);}
function product(w){return chosenProducts(w)[0]||PRODUCTS[0];}
function itemCount(n){return n+' '+(n===1?'вещь':n>1&&n<5?'вещи':'вещей');}
function selectionTitle(w){return chosenProducts(w).map(p=>p.title+' / '+p.color).join(' · ');}
function prepareDraft(w){return {...w,items:wishItems(w)};}
function label(w){if(w.example)return '';return w.anonymous?'Анонимная участница':w.name||'Мой сезон';}
function tree(){return `<div class="tree-scene"><svg viewBox="0 0 480 490" aria-label="Ёлка желаний в форме теннисного корта" role="img"><defs><linearGradient id="pine" x2=".8" y2="1"><stop stop-color="#395846"/><stop offset="1" stop-color="#203c30"/></linearGradient></defs><path d="M240 38 395 420H85Z" fill="url(#pine)"/><g fill="none" stroke="#d7d2ad" stroke-width="1.2" opacity=".7"><path d="M240 65 367 401H113Z M148 310h184 M181 224h118 M209 153h62 M240 65v336 M177 401l63-336 63 336 M194 270h92v96h-92z"/><path d="M127 365q115-130 226 0M157 290q83-100 167 0M187 215q53-72 107 0" stroke-dasharray="2 7" stroke="#e4c58a" stroke-width="3"/></g><path d="M225 422h30v26h-30" fill="#8d7052"/><circle cx="240" cy="37" r="13" fill="#b99c65"/><path d="m236 57-22-10v22l22-9m8-3 22-10v22l-22-9" fill="#792a36"/><ellipse cx="240" cy="452" rx="125" ry="9" fill="#d8d6c6" opacity=".6"/></svg>${EXAMPLES.slice(0,3).map((w,i)=>`<button class="ornament" style="top:${[34,56,72][i%3]}%;left:${[44,30,62][i%3]}%" data-wish="${w.id}" aria-label="Открыть желание ${i+1}">${['A','♡','M'][i%3]}</button>`).join('')}<div class="tree-label">МЕЧТЫ О СЕЗОНЕ · НАЖМИ НА УКРАШЕНИЕ</div></div>`;}
function helpView(){app.innerHTML=`<button class="plain back" id="helpBack">← К ёлке</button><div class="eyebrow">Как всё устроено</div><h1>От желания<br><span class="italic">до подарка.</span></h1><section class="steps"><article><span>01</span><div><b>Собери свой вишлист</b><p>Выбери одну или несколько вещей, укажи размеры и добавь мечту. Черновик хранится на этом устройстве до 7 дней.</p></div></article><article><span>02</span><div><b>Дождись проверки</b><p>После одобрения бот пришлёт уведомление. Можно также проверить статус в «Моём желании». Публикация в канале — только с отдельного согласия.</p></div></article><article><span>03</span><div><b>Поделись красивым намёком</b><p>Отправь личную ссылку близкому или сохрани открытку для сторис. В сторис добавь стикер со ссылкой: одна картинка не открывает вишлист.</p></div></article></section><h2>Если хочешь подарить</h2><p>Открой её ссылку, нажми «Хочу подарить» и выбери одну вещь или весь набор. Оставь контакт: ACEFORM согласует цену, наличие, размер и срок. До согласования оплачивать ничего не нужно; заявка не резервирует товар.</p><h2>Что видно другим</h2><p>Размеры скрыты. Имя можно скрыть. Истории не должны содержать телефон, адрес или другие личные данные. Поделившись ссылкой в своём профиле, ты сама связываешь желание с собой.</p><a class="btn" href="#mine">Моё желание ↗</a><p class="small">Не приходят уведомления? Отправь /start боту @aceform_tree_bot и проверь, что он не заблокирован.</p>`;document.querySelector('#helpBack').onclick=()=>go('#');}
function home(){app.innerHTML=`<section class="hero"><div><div class="eyebrow">Теннисная ёлка желаний / ACEFORM</div><h1>Твоя форма<br><span class="italic">под ёлкой.</span></h1><p class="intro">Новый сезон начинается с желания. Выбери свою форму — и подари близким красивую подсказку.</p><button class="btn" id="start">Создать мой вишлист <span>↗</span></button><p class="small">Бесплатно. С личной мечтой и твоим выбором ACEFORM.</p></div>${tree()}</section><section class="steps"><article><span>01</span><div><b>Выбери свою форму</b><p>Несколько вещей, любимые цвета, свои размеры.</p></div></article><article><span>02</span><div><b>Добавь мечту</b><p>Первый турнир? Или час на корте для себя?</p></div></article><article><span>03</span><div><b>Подари подсказку</b><p>Красивая карточка для сторис и близких.</p></div></article></section><section><div class="section-head"><h2>У каждой — свой следующий сет.</h2><span class="small">Мечты о следующем сезоне</span></div><div class="stories">${EXAMPLES.map((w,i)=>`<button class="story" data-wish="${w.id}"><div class="tag">ЖЕЛАНИЕ / ${String(i+1).padStart(3,"0")}</div><p class="quote">«${esc(w.dream)}»</p><span class="small">${label(w)?esc(label(w))+' · ':''}${esc(selectionTitle(w))} ↗</span></button>`).join('')}</div></section>`;document.querySelector('#start').onclick=()=>{window.ACEFORM_TREE_COMMERCE?.track('create_start');draft=hasLocalDraft?draft:readWish()?prepareDraft(readWish()):{items:[],product:'white',size:'M',name:'',anonymous:true,dream:'',channel:false,publicConsent:false};go('#create/1');};app.querySelectorAll('[data-wish]').forEach(b=>b.onclick=()=>go('#wish/'+b.dataset.wish));}
function shell(step,title,sub){currentStep=step;app.innerHTML=`<button class="plain back" id="back">← ${step===1?'К ёлке':'Назад'}</button><section class="wizard"><div class="wizard-head"><div class="progress">${[1,2,3].map(n=>`<span class="${n<=step?'on':''}"></span>`).join('')}</div><div class="eyebrow">${step} / 3 · ${['Твой выбор','Твоя история','Твоя карточка'][step-1]}</div><h1>${title}</h1><p class="small">${sub}</p></div><div id="stepBody"></div></section>`;document.querySelector('#back').onclick=()=>{capture();go(step===1?'#':'#create/'+(step-1));};}
function capture(){if(currentStep===2&&document.querySelector('#dream')){draft.dream=document.querySelector('#dream').value.trim();draft.name=document.querySelector('#name').value.trim();draft.anonymous=document.querySelector('#anonymous').checked;draft.channel=document.querySelector('#channel').checked;draft.publicConsent=document.querySelector('#consent').checked;persistDraft();}}
function step1(){
 draft.items=wishItems(draft);shell(1,'Собери свою<br><span class="italic">форму мечты.</span>','Можно выбрать несколько вещей и цветов. У каждой вещи — свой размер.');
 const selected=draft.items.map(i=>i.product);
 document.querySelector('#stepBody').innerHTML=`<div class="model-tabs" aria-label="Модель">${window.ACEFORM_CATALOG.map(m=>`<button class="size ${selectedModel===m.id?'active':''}" data-model="${m.id}" aria-pressed="${selectedModel===m.id}">${esc(m.name.split(' · ')[0])}</button>`).join('')}</div><div class="choices">${PRODUCTS.filter(p=>p.model===selectedModel).map(p=>`<button class="product ${selected.includes(p.id)?'selected':''}" data-product="${p.id}" aria-pressed="${selected.includes(p.id)}"><img src="${p.image}" alt="${esc(p.title)}, ${esc(p.color)}">${selected.includes(p.id)?'<span class="tick">✓</span>':''}<span class="caption"><strong>${esc(p.title)} · ${esc(p.color)}</strong><small>${p.note}</small><span class="choose-action">${selected.includes(p.id)?'Убрать из желания −':'Добавить в желание +'}</span></span></button>`).join('')}</div><div class="selection-panel"><div class="selection-head"><h3>На моей вешалке</h3><span class="small">${itemCount(draft.items.length)}</span></div>${draft.items.length?`<div class="mini-rack">${window.ACEFORM_WISH_RACK.render(chosenProducts(draft))}</div><div class="selected-items">${draft.items.map(i=>{const p=PRODUCTS.find(p=>p.id===i.product);return `<article class="selected-item"><img src="${p.image}" alt=""><div><b>${esc(p.title)}</b><span class="small">${esc(p.color)}</span><label class="item-size">Размер<select data-item-size="${p.id}" aria-label="Размер ${esc(p.title)} · ${esc(p.color)}">${['S','M','L','Не знаю'].map(size=>`<option ${i.size===size?'selected':''}>${size}</option>`).join('')}</select></label></div><button class="plain" data-remove="${p.id}" aria-label="Убрать ${esc(p.title)} · ${esc(p.color)}">Убрать</button></article>`;}).join('')}</div>`:'<p class="small empty-selection">Добавь первую вещь сверху. Здесь соберётся твой вишлист.</p>'}<p class="small">Размеры видны только тебе. На открытке и публичной странице их не будет.</p><div class="notice">EVERT с одной парой шорт MARBLE — от 8 000 ₽. BUENO и GRAF — по предзаказу. Цену, комплектацию, наличие и срок подтвердим при заказе. Можно подарить одну вещь из вишлиста или весь набор. Желание не резервирует товар.</div><button class="btn" id="next" ${draft.items.length?'':'disabled'}>Дальше — моя мечта ↗</button></div>`;
 app.querySelectorAll('[data-model]').forEach(b=>b.onclick=()=>{selectedModel=b.dataset.model;step1();});
 const toggle=id=>{const index=draft.items.findIndex(i=>i.product===id);if(index>=0)draft.items.splice(index,1);else draft.items.push({product:id,size:'Не знаю'});draft.product=draft.items[0]?.product||'white';draft.size=draft.items[0]?.size||'Не знаю';persistDraft();step1();};
 app.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>toggle(b.dataset.product));app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>toggle(b.dataset.remove));app.querySelectorAll('[data-item-size]').forEach(el=>el.onchange=()=>{draft.items.find(i=>i.product===el.dataset.itemSize).size=el.value;draft.size=draft.items[0]?.size||'Не знаю';persistDraft();});document.querySelector('#next').onclick=()=>go('#create/2');
}
function step2(){shell(2,'Это будет<br><span class="italic">твой сезон.</span>','Добавь личную мечту. Она появится рядом с твоей вешалкой.');document.querySelector('#stepBody').innerHTML=`<form class="fields" id="storyForm"><div class="field"><label for="dream">Что ты хочешь сделать в новом сезоне?</label><textarea id="dream" maxlength="280" required minlength="10" placeholder="Сыграть свой первый турнир. И перестать извиняться за каждый промах.">${esc(draft.dream)}</textarea><div class="counter" id="counter">${draft.dream.length}/280</div></div><div class="field"><label for="name">Имя или псевдоним</label><input id="name" maxlength="30" placeholder="Например, Аня" value="${esc(draft.name)}"></div><label class="check"><input type="checkbox" id="anonymous" ${draft.anonymous?'checked':''}><span>Скрыть имя на общей ёлке и карточке</span></label><label class="check"><input type="checkbox" id="consent" ${draft.publicConsent?'checked':''} required><span>Разрешаю показать историю и выбранный подарок на общей ёлке после проверки.</span></label><label class="check"><input type="checkbox" id="channel" ${draft.channel?'checked':''}><span>Также разрешаю публикацию истории в канале ACEFORM. Необязательно.</span></label><div class="notice">Не указывай телефон, адрес и другие личные данные в истории. Если сама поделишься карточкой в своём профиле, зрители смогут связать её с тобой.<br><br>История сохранится на сервере и появится на ёлке только после проверки. ${apiConfig.channelEnabled?"При отдельном согласии одобренная история может появиться в канале @aceform_studio. При правке или удалении мы убираем текст нашего поста; пересланные и сохранённые копии могут остаться у читателей.":"В канал пока ничего не отправляется."} Анонимность действует для читателей: система сохраняет связь с аккаунтом для управления желанием.</div><div class="error" id="error" role="alert"></div><button class="btn" type="submit">Посмотреть мою карточку ↗</button></form>`;document.querySelector('#dream').oninput=e=>document.querySelector('#counter').textContent=e.target.value.length+'/280';document.querySelector('#storyForm').oninput=()=>capture();document.querySelector('#storyForm').onchange=()=>capture();document.querySelector('#storyForm').onsubmit=e=>{e.preventDefault();capture();if(draft.dream.length<10){document.querySelector('#error').textContent='Добавь чуть больше: от 10 символов.';return;}if(!draft.anonymous&&!draft.name){document.querySelector('#error').textContent='Укажи имя или включи анонимную подпись.';return;}go('#create/3');};}
function card(w){const ps=chosenProducts(w);return `<div class="share-card rack-card"><div class="card-brand">ACEFORM</div><div class="season">МОЙ ТЕННИСНЫЙ СЕЗОН / 2027</div>${window.ACEFORM_WISH_RACK.render(ps)}<p class="dream">${esc(w.dream)}</p>${label(w)?`<span class="signature">${esc(label(w))}</span>`:''}<div class="card-foot"><span>МОЙ ВИШЛИСТ</span><span>${itemCount(ps.length)} ↗</span></div></div>`;}
function giftDetails(w){return chosenProducts(w).map(p=>`<div class="details"><b>${esc(p.title)} · ${esc(p.color)}</b>${p.model==='dress'?'Комплект с одной парой шорт MARBLE · от 8 000 ₽':p.note}</div>`).join('');}
function step3(){if(!draft.publicConsent||draft.dream.length<10||!wishItems(draft).length){go('#create/2');return;}shell(3,'Хочется<br><span class="italic">поделиться.</span>','На обложке — твоя мечта и форма. Детали заказа остаются на странице подарка.');document.querySelector('#stepBody').innerHTML=`<div class="preview-layout">${card(draft)}<div><div class="eyebrow">Предварительный просмотр</div><h3>Твой красивый намёк.</h3><p class="small">Такую карточку можно сохранить для сторис. После одобрения у желания появится личная ссылка для близких.</p><div class="notice">${apiConfig.dev?"Сейчас включён локальный тест: настоящих публикаций в Telegram нет. ":""}После отправки история попадёт на проверку. Бот сообщит результат; статус можно проверить в «Моём желании». После одобрения появится личная ссылка.</div><div class="stack"><button class="btn" id="save">Отправить желание на проверку</button><button class="btn secondary" id="download">Скачать карточку PNG ↓</button><button class="plain" id="edit">Изменить историю</button></div><p id="saveError" class="error" role="alert"></p></div></div>`;document.querySelector('#edit').onclick=()=>go('#create/2');document.querySelector('#download').onclick=()=>downloadCard(draft);document.querySelector('#save').onclick=async()=>{const button=document.querySelector('#save');button.disabled=true;try{await ensureLogin();const result=await api('/api/me/wish','POST',{...draft,revision:readWish()?.revision||0});savedWish=result.wish;clearLocalDraft();draft=prepareDraft(savedWish);pendingSavedView=savedWish;window.ACEFORM_TREE_COMMERCE?.track('wish_submit',savedWish);go('#mine');}catch(error){document.querySelector('#saveError').textContent=error.message;}finally{button.disabled=false;}};}
function wishView(w,mine=false){const p=product(w);app.innerHTML=`<button class="plain back" id="back">← К ёлке</button><div class="preview-layout">${card(w)}<div><div class="status">${w.example?'ЖЕЛАНИЕ НА СЕЗОН':esc(STATUS[w.status]||'Желание')}</div><h2>${mine?'Твоё желание.<br><span class="italic">Твой следующий сет.</span>':'Она уже выбрала.<br><span class="italic">Подари её сезон.</span>'}</h2>${giftDetails(w)}<div class="details">Можно выбрать один подарок или весь набор. Размеры, наличие и комплектацию уточняем при оформлении.</div>${mine?`<div class="notice">${w.status==="approved"?"Желание одобрено. Можно поделиться личной ссылкой.":w.status==="rejected"?"История пока не опубликована. "+esc(w.note||"Измени её и отправь снова."):"Желание на проверке. До одобрения оно скрыто от других посетителей. Бот сообщит результат — проверь, что @aceform_tree_bot не заблокирован. Статус также появится здесь."}${apiConfig.dev?" Тест идёт на этом компьютере: ссылка не доступна из интернета.":""}</div><div class="stack"><button class="btn" id="download">Скачать карточку PNG ↓</button>${w.status==="approved"?'<button class="btn secondary" id="copyLink">Скопировать ссылку ↗</button><button class="btn secondary" id="shareLink">Отправить в Telegram ↗</button>':''}<button class="btn secondary" id="donor">Посмотреть глазами дарителя</button><button class="plain" id="edit">Изменить желание</button><button class="plain" id="delete">Удалить желание</button></div>`:`<div class="stack">${w.status==='legacy'?'':'<button class="btn" id="giftOrder">Хочу подарить ↗</button>'}<a class="btn secondary" href="https://karinapolovina.github.io/aceform-app/" target="_blank" rel="noopener">Открыть магазин ACEFORM ↗</a><p class="small">Выбери одну вещь или весь комплект — передадим твой выбор ACEFORM и согласуем детали.</p></div><div class="envelope"><h3>Красный конверт</h3><p>Когда хочется подарить выбор. Сертификат на форму ACEFORM.</p><button class="btn secondary" id="certificate" style="color:#fff;border-color:#ffffff66">Как это будет работать ↗</button></div><div id="certDetails" hidden class="notice">Это макет будущего сертификата. Покупка пока недоступна: сначала подключим оплату, уникальные коды и правила использования. Деньги здесь не принимаются.</div>`}</div></div>`;document.querySelector('#back').onclick=()=>go('#');if(mine){document.querySelector('#download').onclick=()=>downloadCard(w);document.querySelector('#donor').onclick=()=>go('#wish/'+w.id);document.querySelector('#edit').onclick=()=>{draft=prepareDraft(w);selectedModel=product(w).model;go('#create/1');};document.querySelector('#delete').onclick=async()=>{if(confirm('Удалить желание с сервера и ёлки? Скачанные картинки останутся у тебя.')){try{await api('/api/me/wish','DELETE',{});savedWish=null;clearLocalDraft();await refreshPublic();go('#');toast('Желание удалено с сервера');}catch(error){toast(error.message);}}};if(w.status==='approved'){document.querySelector('#copyLink').onclick=()=>copyLink(w);document.querySelector('#shareLink').onclick=()=>shareLink(w);};}else{if(document.querySelector('#giftOrder'))document.querySelector('#giftOrder').onclick=()=>window.ACEFORM_TREE_COMMERCE.openGift(w,chosenProducts(w));document.querySelector('#certificate').onclick=()=>{const el=document.querySelector('#certDetails');el.hidden=!el.hidden;};}}
function wrapCardText(c,text,maxWidth){
 const lines=[];
 for(const paragraph of String(text).split('\n')){
  let line='';
  for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
   const candidate=line?line+' '+word:word;
   if(c.measureText(candidate).width<=maxWidth){line=candidate;continue;}
   if(line){lines.push(line);line='';}
   if(c.measureText(word).width<=maxWidth){line=word;continue;}
   const parts=typeof Intl!=='undefined'&&Intl.Segmenter?Array.from(new Intl.Segmenter('ru',{granularity:'grapheme'}).segment(word),part=>part.segment):Array.from(word);
   for(const part of parts){if(line&&c.measureText(line+part).width>maxWidth){lines.push(line);line='';}line+=part;}
  }
  lines.push(line);
 }
 return lines;
}
async function downloadCard(w){const button=document.querySelector('#download');if(button)button.disabled=true;try{
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1600;const c=canvas.getContext('2d');c.fillStyle='#eae6da';c.fillRect(0,0,1080,1600);c.fillStyle='#293c32';c.textAlign='center';c.font='30px sans-serif';c.fillText('A C E F O R M',540,85);c.font='21px sans-serif';c.fillText('МОЙ ТЕННИСНЫЙ СЕЗОН / 2027',540,143);
 const ps=chosenProducts(w),rack=await window.ACEFORM_WISH_RACK.raster(ps);c.globalCompositeOperation='multiply';c.drawImage(rack,30,190,1020,661);c.globalCompositeOperation='source-over';
 c.textAlign='left';c.fillStyle='#792a36';let lines=[],font=49;const wrap=()=>{lines=wrapCardText(c,w.dream,880);};
 do{c.font='italic '+font+'px Georgia';wrap();if(lines.length*(font*1.15)<=420)break;font-=2;}while(font>=25);
 lines.forEach((line,i)=>c.fillText(line,100,940+i*font*1.15));c.fillStyle='#74766c';c.font='23px sans-serif';c.fillText(label(w),100,Math.min(1490,970+lines.length*font*1.15));c.strokeStyle='#cec6b4';c.beginPath();c.moveTo(100,1520);c.lineTo(980,1520);c.stroke();c.font='21px sans-serif';c.fillText('МОЙ ВИШЛИСТ · '+itemCount(ps.length).toUpperCase(),100,1560);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('export');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ACEFORM-мой-желанный-комплект-2027.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);window.ACEFORM_TREE_COMMERCE?.track('card_download',w);toast('Открытка сохранена.');
 }catch{toast('Не удалось скачать открытку. Попробуй ещё раз в браузере.');}finally{if(button)button.disabled=false;}}

let routeVersion=0;
async function api(path,method='GET',data){
 if(!window.ACEFORM_TREE_TRANSPORT)throw new Error('Соединение с хранилищем ещё подключается.');
 return window.ACEFORM_TREE_TRANSPORT.request(path,method,data,apiSession?.token);
}
async function ensureLogin(){
 if(apiSession)return;
 if(apiConfig.authReady===false)throw new Error('Мы готовим открытие ёлки. Создание желаний скоро появится в @aceform_tree_bot.');
 const tg=window.Telegram?.WebApp;
 if(!apiConfig.dev&&!tg?.initData)throw new Error('Чтобы создать желание, открой миниапп через Telegram.');
 const session=await api('/api/session','POST',{initData:tg?.initData||''});
 const result=await window.ACEFORM_TREE_TRANSPORT.request('/api/me/wish','GET',undefined,session.token);
 apiSession=session;
 savedWish=result.wish;
 restoreDraft();
 updateHeader();
}
async function refreshPublic(){const result=await api('/api/wishes');EXAMPLES=[...result.wishes,...SAMPLES];}
function updateHeader(){if(!document.querySelector('#help')){const help=document.createElement('button');help.id='help';help.className='plain';help.textContent='Как это работает';help.onclick=()=>go('#help');document.querySelector('header').append(help);}if(apiSession?.admin&&!document.querySelector('#results')){const b=document.createElement('button');b.id='results';b.className='plain';b.textContent='Заявки и результаты';b.onclick=()=>go('#results');document.querySelector('header').append(b);}let button=document.querySelector('#moderate');if(apiSession?.admin&&!button){button=document.createElement('button');button.id='moderate';button.className='plain';button.textContent='Проверить истории';button.onclick=()=>go('#moderation');document.querySelector('header').append(button);}}
function wishLink(w){
 if(!apiConfig.dev)return location.origin+location.pathname+'?src=wish_share#wish/'+w.id;
 return location.origin+'/#wish/'+w.id;
}
async function copyLink(w){try{window.ACEFORM_TREE_COMMERCE?.track('share_link',w);await navigator.clipboard.writeText(wishLink(w));toast(apiConfig.dev?'Локальная ссылка скопирована. Работает только на этом компьютере.':'Ссылка скопирована');}catch{toast('Копирование недоступно. Открой страницу дарителя и скопируй адрес.');}}
function shareLink(w){window.ACEFORM_TREE_COMMERCE?.track('share_link',w);if(apiConfig.dev){toast('Отправка появится после публикации миниаппа: локальная ссылка не откроется у близких.');return;}const url='https://t.me/share/url?url='+encodeURIComponent(wishLink(w))+'&text='+encodeURIComponent('Моя форма под ёлкой. Оставляю красивую подсказку 🎄');const tg=window.Telegram?.WebApp;if(tg?.openTelegramLink)tg.openTelegramLink(url);else window.open(url,'_blank','noopener');}
async function moderation(){
 if(!apiSession?.admin){app.innerHTML='<div class="empty"><h2>Доступ только для модератора.</h2></div>';return;}
 const {wishes}=await api('/api/moderation');
 app.innerHTML=`<button class="plain back" id="back">← К ёлке</button><div class="eyebrow">Проверка историй</div><h1>Перед тем,<br><span class="italic">как зажечь огни.</span></h1><div class="notice">${apiConfig.dev?'Локальный тест: в Telegram ничего не отправляется. ':' '}Одобрение открывает историю на ёлке. ${apiConfig.channelEnabled?"Истории с отдельным разрешением отправляются в @aceform_studio. Состояние отправки — ниже.":"Разрешение на канал учитывается отдельно; отправка в канал пока отключена."}</div><div class="moderation-list">${wishes.length?wishes.map(w=>`<article class="review" data-review="${w.id}"><div class="sample">Версия ${w.revision} · ${w.channel?'Канал разрешён':'Только ёлка'}</div><h3>${esc(label(w))}</h3><p class="review-dream">${esc(w.dream)}</p><p class="small">${esc(selectionTitle(w))}</p><label class="small" for="note-${w.id}">Комментарий автору при отклонении</label><textarea id="note-${w.id}" maxlength="300" placeholder="Что нужно изменить?"></textarea><div class="actions"><button class="btn" data-approve="${w.id}">Одобрить</button><button class="btn secondary" data-reject="${w.id}">Вернуть на доработку</button></div><div class="error" role="alert"></div></article>`).join(''):'<p>Все истории проверены. Новые появятся здесь.</p>'}</div><section id="channelQueue"></section>`;
 document.querySelector('#back').onclick=()=>go('#');
 await channelQueue();
 for(const button of app.querySelectorAll('[data-approve],[data-reject]'))button.onclick=async()=>{
  const id=button.dataset.approve||button.dataset.reject,w=wishes.find(x=>x.id===id),box=document.querySelector('[data-review="'+id+'"]');
  const note=box.querySelector('textarea').value.trim();if(button.dataset.reject&&!note){box.querySelector('.error').textContent='Подскажи автору, что нужно изменить.';return;}
  box.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await api('/api/moderation/'+id,'POST',{revision:w.revision,decision:button.dataset.approve?'approved':'rejected',note});savedWish=(await api('/api/me/wish')).wish;await refreshPublic();await moderation();toast(button.dataset.approve?'История появилась на ёлке':'История возвращена на доработку');}
  catch(error){box.querySelector('.error').textContent=error.message;box.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
}
async function channelQueue(){
 const el=document.querySelector('#channelQueue');if(!el)return;
 const states={queued:'В очереди',waiting_for_bot:'В очереди',sending:'Проверить результат',unknown:'Нужна проверка канала',sent:'Опубликовано',failed:'Ошибка отправки',redact_pending:'Убираем текст поста',redact_failed:'Не удалось убрать текст поста'};
 try{const result=await api('/api/channel');el.innerHTML=`<h2>Публикации в канале</h2><p class="small">@aceform_studio · ${result.enabled?'Подключён':'Подключается'}. Если ответ Telegram потерялся, проверь канал вручную перед повтором.</p><button class="btn secondary" id="syncChannel">Обновить и повторить ошибки</button>${result.jobs.map(j=>`<article class="review"><p><b>${esc(states[j.status]||j.status)}</b> · версия ${j.revision}</p><p class="small">${esc(j.error||'')}</p>${j.status==='sent'?`<a href="https://t.me/aceform_studio/${j.messageId}" target="_blank" rel="noopener">Открыть пост ↗</a>`:''}${['unknown','sending'].includes(j.status)?`<label class="small">Номер найденного поста<input type="number" min="1" id="post-${j.id}-${j.revision}" placeholder="Последнее число в ссылке на пост"></label><button class="btn secondary" data-found="${j.id}" data-rev="${j.revision}">Пост найден — сохранить номер</button><button class="plain" data-absent="${j.id}" data-rev="${j.revision}">Проверила канал: поста нет — отправить</button>`:''}</article>`).join('')}`;
 el.querySelector('#syncChannel').onclick=async()=>{try{await api('/api/channel/sync','POST',{});await channelQueue();}catch(e){toast(e.message);}};
 for(const b of el.querySelectorAll('[data-found],[data-absent]'))b.onclick=async()=>{const id=b.dataset.found||b.dataset.absent,revision=Number(b.dataset.rev),absent=!!b.dataset.absent;if(absent&&!confirm('Ты проверила канал и уверена, что этого поста нет? Повторная отправка может создать дубль, если пост уже появился.'))return;b.disabled=true;try{await api('/api/channel/resolve','POST',{id,revision,absent,messageId:Number(document.querySelector('#post-'+id+'-'+revision).value)});await channelQueue();}catch(e){toast(e.message);b.disabled=false;}};
 }catch(e){el.innerHTML='<p class="error">Не удалось загрузить очередь канала. '+esc(e.message)+'</p>';}
}
async function route(){
 capture();
 const version=++routeVersion;
 if(!serverReady)return;
 try{
 const hash=location.hash;
 if(hash.startsWith('#card=')){wishView(legacyCard(hash.slice(6)));window.scrollTo(0,0);return;}
 if(hash.startsWith('#create/')){await ensureLogin();if(version!==routeVersion)return;const n=Number(hash.split('/')[1]);if(n===2)step2();else if(n===3)step3();else step1();}
 else if(hash==='#moderation'){await moderation();}
 else if(hash==='#help'){helpView();}
 else if(hash==='#results'){await ensureLogin();if(!apiSession?.admin)throw Error('Доступ только для владельца.');await window.ACEFORM_TREE_COMMERCE.dashboard(api);}
 else if(hash==='#mine'){await ensureLogin();if(pendingSavedView){savedWish=pendingSavedView;pendingSavedView=null;}else savedWish=(await api('/api/me/wish')).wish;if(version!==routeVersion)return;const w=readWish();if(w)wishView(w,true);else{app.innerHTML='<div class="empty"><h2>Твой сезон ещё впереди.</h2><p>Сначала выбери подарок и добавь мечту.</p><button class="btn" id="emptyStart">Создать вишлист ↗</button></div>';document.querySelector('#emptyStart').onclick=()=>go('#create/1');}}
 else if(hash.startsWith('#wish/')){const id=hash.slice(6);let w=SAMPLES.find(x=>x.id===id);if(!w&&savedWish?.id===id)w=savedWish;if(!w)w=(await api('/api/wishes/'+encodeURIComponent(id))).wish;if(version!==routeVersion)return;window.ACEFORM_TREE_COMMERCE?.track('wish_view',w);wishView(w);}
 else{await refreshPublic();if(version!==routeVersion)return;home();}
 window.scrollTo(0,0);
 }catch(error){if(version===routeVersion)app.innerHTML='<div class="empty"><h2>Давай попробуем ещё раз.</h2><p>'+esc(error.message)+'</p><a class="btn" href="#">К ёлке</a></div>';}
}
async function boot(){
 app.innerHTML='<div class="empty"><p>Зажигаем огни…</p></div>';
 try{
 apiConfig=await api('/api/config');
 document.querySelector('.demo').textContent=apiConfig.dev?'ЛОКАЛЬНЫЙ ТЕСТ · сервер и модерация работают · без Telegram и оплаты':(apiConfig.authReady?'ACEFORM · ТВОЙ СЕЗОН / 2027':'ПРЕДПРОСМОТР · ПРИЁМ ЖЕЛАНИЙ ЕЩЁ НЕ ОТКРЫТ');
 const tg=window.Telegram?.WebApp;if(tg){tg.ready();tg.expand();}
 try{if(window.Telegram?.WebApp?.initData){await ensureLogin();}else{throw new Error('guest');}}catch{if(apiConfig.authReady&&tg?.initData)await ensureLogin();}
 updateHeader();
 const start=new URLSearchParams(location.search).get('tgWebAppStartParam')||tg?.initDataUnsafe?.start_param;
 if(start&&/^wish_[a-f0-9]{32}$/.test(start))location.hash='#wish/'+start.slice(5);
 else{const view=new URLSearchParams(location.search).get('view');if(['mine','results','moderation','help'].includes(view))location.hash='#'+view;}
 if(savedWish&&!hasLocalDraft)draft=prepareDraft(savedWish);
 serverReady=true;route();
 }catch(error){app.innerHTML='<div class="empty"><h2>Сервер пока недоступен.</h2><p>'+esc(error.message)+'</p><button class="btn" id="retryBoot">Попробовать ещё раз ↗</button></div>';document.querySelector('#retryBoot').onclick=()=>boot();}
}
window.addEventListener('pagehide',capture);document.addEventListener('visibilitychange',()=>{if(document.hidden)capture();});
document.querySelector('#mine').onclick=()=>go('#mine');window.addEventListener('hashchange',route);boot();

/* The limited collection uses complete outfits as indivisible basket items. */
(()=>{
 'use strict';
 const catalog=window.ACEFORM_APEROL_CATALOG;
 const sizes=['S','M','L'];
 for(const [index,figure] of [...document.querySelectorAll('#april .april-gallery figure')].entries()){
  const product=(index===1||index===3)?'aperol-suit':'aperol-dress',color=(index===2||index===3)?1:0,p=catalog.find(p=>p.id===product);
  const form=document.createElement('form');form.className='aperol-order';form.dataset.product=product;form.dataset.color=color;
  const field=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>`;
  form.innerHTML=`<p class="aperol-price">${p.price.toLocaleString('ru-RU')} ₽ <span>${product==='aperol-suit'?'топ + юбка':'платье + шорты'}</span></p><p class="hint">${product==='aperol-suit'?'Топ GRAF + юбка BUENO. Отдельные цены: GRAF — 4 500 ₽, BUENO — 8 900 ₽. Для заказа отдельно напиши в @aceform_bot.':'Платье EVERT + одна пара контрастных шорт MARBLE.'}</p><div class="aperol-sizes">${field('size',product==='aperol-suit'?'Размер топа GRAF':'Размер платья EVERT')}${field(product==='aperol-suit'?'skirtSize':'shortsSize',product==='aperol-suit'?'Размер юбки BUENO':'Размер шорт MARBLE')}</div><details><summary>Таблица размеров</summary><table class="size-table"><thead><tr><th>Размер</th><th>Грудь</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody>${window.ACEFORM_SIZING.rows.map(r=>`<tr><th>${r.size}</th><td>${r.bust.join('–')}</td><td>${r.waist.join('–')}</td><td>${r.hips.join('–')}</td></tr>`).join('')}</tbody></table><p class="hint">Обхваты тела в сантиметрах. Если сомневаешься, поможем подобрать размер при согласовании заказа.</p></details><button class="primary" type="submit"><span>Добавить комплект в корзину</span><span class="aperol-arrow" aria-hidden="true">→</span></button><p class="hint">Изготовление на заказ. Срок согласуем отдельно. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p>`;
  if(product==='aperol-dress'){
   const note=document.createElement('p');note.className='aperol-shorts-note';note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color});form.querySelector('.aperol-sizes').before(note);

  }
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const extra=product==='aperol-suit'?'skirtSize':'shortsSize',selection={product,color,size:form.elements.size.value,[extra]:form.elements[extra].value,quantity:1,mode:'preorder'};
   const error=form.querySelector('.aperol-error');error.hidden=true;
   try{window.ACEFORM_REQUEST_CART.add([selection]);}catch(e){error.textContent=e.message;error.hidden=false;}
  };
  figure.append(form);
 }
 const capsule=document.createElement('section');capsule.className='aperol-capsule';capsule.id='aperolCapsule';
 const sizeField=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option>${s}</option>`).join('')}</select></label>`;
 capsule.innerHTML=`<p class="eyebrow">КАПСУЛА «АПЕРОЛЬ»</p><h3>Два образа. Твой выбор каждый день.</h3><div class="capsule-photos"><img src="assets/fast-aperol-studio-dress-navy-v1.jpg" alt="Платье EVERT" loading="lazy"><img src="assets/fast-aperol-studio-suit-navy-orange-v2.jpg" alt="Топ GRAF и юбка BUENO" loading="lazy"></div><p>Платье EVERT с шортами MARBLE + топ GRAF + юбка BUENO.</p><p class="aperol-price"><del>22 900 ₽</del> 20 610 ₽</p><p>Выгода 2 290 ₽ · 10% за капсулу</p><form><div class="aperol-sizes"><label><span>Цвет платья</span><select name="dressColor"><option value="0">Тёмно-синий</option><option value="1">Оранжевый</option></select></label><label><span>Цвет топа и юбки</span><select name="suitColor"><option value="0">Синий топ / оранжевая юбка</option><option value="1">Оранжевый топ / синяя юбка</option></select></label>${sizeField('dressSize','Платье EVERT')}${sizeField('shortsSize','Шорты MARBLE')}${sizeField('topSize','Топ GRAF')}${sizeField('skirtSize','Юбка BUENO')}</div><p class="hint">Размер каждой вещи выбирается отдельно. Одна пара шорт MARBLE входит в комплект платья.</p><button class="primary" type="submit">Добавить капсулу · 20 610 ₽</button><p class="hint">Изготовление на заказ. Предоплата 50% — 10 305 ₽. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p></form>`;
 document.querySelector('#april .april-gallery').after(capsule);
 const capsuleForm=capsule.querySelector('form');
 const updateCapsulePhotos=()=>{capsule.querySelectorAll('img')[0].src=Number(capsuleForm.elements.dressColor.value)?'assets/fast-aperol-studio-dress-orange-v1.jpg':'assets/fast-aperol-studio-dress-navy-v1.jpg';capsule.querySelectorAll('img')[1].src=Number(capsuleForm.elements.suitColor.value)?'assets/fast-aperol-studio-suit-orange-navy-v2.jpg':'assets/fast-aperol-studio-suit-navy-orange-v2.jpg';};
 capsuleForm.elements.dressColor.onchange=updateCapsulePhotos;capsuleForm.elements.suitColor.onchange=updateCapsulePhotos;
 capsuleForm.onsubmit=e=>{e.preventDefault();if(!capsuleForm.reportValidity())return;const f=capsuleForm.elements,error=capsuleForm.querySelector('.aperol-error');error.hidden=true;try{window.ACEFORM_REQUEST_CART.add([{product:'aperol-dress',color:Number(f.dressColor.value),size:f.dressSize.value,shortsSize:f.shortsSize.value,quantity:1,mode:'preorder'},{product:'aperol-suit',color:Number(f.suitColor.value),size:f.topSize.value,skirtSize:f.skirtSize.value,quantity:1,mode:'preorder'}]);}catch(e){error.textContent=e.message;error.hidden=false;}};
 const section=document.getElementById('april'),dock=document.querySelector('.sticky');
 let queued=false;
 const updateDock=()=>{queued=false;if(!section||!dock)return;const rect=section.getBoundingClientRect(),middle=innerHeight/2;dock.classList.toggle('aperol-context',rect.top<middle&&rect.bottom>middle);};
 const scheduleDock=()=>{if(!queued){queued=true;requestAnimationFrame(updateDock);}};
 addEventListener('scroll',scheduleDock,{passive:true});addEventListener('resize',scheduleDock);updateDock();
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const match=start.match(/^aperol_(dress|suit)_([01])_(S|M|L)_(S|M|L)(?:_(both))?$/);
 if(match){const form=[...document.querySelectorAll('.aperol-order')].find(f=>f.dataset.product==='aperol-'+match[1]&&f.dataset.color===match[2]);if(form){form.elements.size.value=match[3];form.elements[match[1]==='suit'?'skirtSize':'shortsSize'].value=match[4];if(match[5]&&form.elements.extraShorts){form.elements.extraShorts.checked=true;form.elements.extraShorts.onchange();}form.scrollIntoView({block:'center'});}}
})();

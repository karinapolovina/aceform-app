/* The limited collection uses complete outfits as indivisible basket items. */
(()=>{
 'use strict';
 const catalog=window.ACEFORM_APEROL_CATALOG;
 const sizes=['S','M','L'];
 for(const [index,figure] of [...document.querySelectorAll('#april .april-gallery figure')].entries()){
  const product=(index===1||index===3)?'aperol-suit':'aperol-dress',color=(index===2||index===3)?1:0,p=catalog.find(p=>p.id===product);
  const form=document.createElement('form');form.className='aperol-order';form.dataset.product=product;form.dataset.color=color;
  const field=(name,label)=>`<label><span>${label}</span><select name="${name}" required><option value="">Размер</option>${sizes.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label>`;
  form.innerHTML=`<p class="aperol-price">${p.price.toLocaleString('ru-RU')} ₽ <span>${product==='aperol-suit'?'топ + юбка':'платье + шорты'}</span></p><p class="hint">${product==='aperol-suit'?'Топ GRAF + юбка BUENO. Продаются только вместе.':'Платье EVERT + одна пара шорт MARBLE.'}</p><div class="aperol-sizes">${field('size',product==='aperol-suit'?'Размер топа GRAF':'Размер платья EVERT')}${field(product==='aperol-suit'?'skirtSize':'shortsSize',product==='aperol-suit'?'Размер юбки BUENO':'Размер шорт MARBLE')}</div><details><summary>Таблица размеров</summary><table class="size-table"><thead><tr><th>Размер</th><th>Грудь</th><th>Талия</th><th>Бёдра</th></tr></thead><tbody>${window.ACEFORM_SIZING.rows.map(r=>`<tr><th>${r.size}</th><td>${r.bust.join('–')}</td><td>${r.waist.join('–')}</td><td>${r.hips.join('–')}</td></tr>`).join('')}</tbody></table><p class="hint">Обхваты тела в сантиметрах. Если сомневаешься, поможем подобрать размер при согласовании заказа.</p></details><button class="primary" type="submit"><span>Добавить комплект в корзину</span><span class="aperol-arrow" aria-hidden="true">→</span></button><p class="hint">Изготовление на заказ. Срок согласуем отдельно. Доставка оплачивается отдельно.</p><p class="aperol-error" role="status" hidden></p>`;
  if(product==='aperol-dress'){
   const note=document.createElement('p');note.className='aperol-shorts-note';note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color});form.querySelector('.aperol-sizes').before(note);
   const extra=document.createElement('label');extra.className='aperol-extra';extra.innerHTML='<input name="extraShorts" type="checkbox"><span>Добавить '+(color===0?'тёмно-синие':'оранжевые')+' MARBLE <b>+1 500 ₽</b></span>';form.querySelector('.aperol-sizes').after(extra);
   const sync=()=>{const extraShorts=form.elements.extraShorts.checked,total=extraShorts?10500:9000;note.textContent=window.ACEFORM_COMMERCE.aperolShorts({color,extraShorts});form.querySelector('.aperol-price').innerHTML=total.toLocaleString('ru-RU')+' ₽ <span>платье + '+(extraShorts?'2 пары шорт':'шорты')+'</span>';form.querySelector('.primary>span').textContent='Добавить · '+total.toLocaleString('ru-RU')+' ₽';form.elements.shortsSize.parentElement.querySelector('span').textContent=extraShorts?'Размер шорт · обе пары':'Размер шорт MARBLE';document.dispatchEvent(new CustomEvent('aceform:aperol-price'));};form.elements.extraShorts.onchange=sync;sync();
  }
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity())return;
   const extra=product==='aperol-suit'?'skirtSize':'shortsSize',selection={product,color,size:form.elements.size.value,[extra]:form.elements[extra].value,quantity:1,mode:'preorder'};
   if(product==='aperol-dress'&&form.elements.extraShorts.checked)selection.extraShorts=true;
   const error=form.querySelector('.aperol-error');error.hidden=true;
   try{window.ACEFORM_REQUEST_CART.add([selection]);}catch(e){error.textContent=e.message;error.hidden=false;}
  };
  figure.append(form);
 }
 const section=document.getElementById('april'),dock=document.querySelector('.sticky');
 let queued=false;
 const updateDock=()=>{queued=false;if(!section||!dock)return;const rect=section.getBoundingClientRect(),middle=innerHeight/2;dock.classList.toggle('aperol-context',rect.top<middle&&rect.bottom>middle);};
 const scheduleDock=()=>{if(!queued){queued=true;requestAnimationFrame(updateDock);}};
 addEventListener('scroll',scheduleDock,{passive:true});addEventListener('resize',scheduleDock);updateDock();
 const start=window.Telegram?.WebApp?.initDataUnsafe?.start_param||new URLSearchParams(location.search).get('tgWebAppStartParam')||'';
 const match=start.match(/^aperol_(dress|suit)_([01])_(S|M|L)_(S|M|L)(?:_(both))?$/);
 if(match){const form=[...document.querySelectorAll('.aperol-order')].find(f=>f.dataset.product==='aperol-'+match[1]&&f.dataset.color===match[2]);if(form){form.elements.size.value=match[3];form.elements[match[1]==='suit'?'skirtSize':'shortsSize'].value=match[4];if(match[5]&&form.elements.extraShorts){form.elements.extraShorts.checked=true;form.elements.extraShorts.onchange();}form.scrollIntoView({block:'center'});}}
})();

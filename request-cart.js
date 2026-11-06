(()=>{
 'use strict';
 const catalog=window.ACEFORM_CATALOG;if(!catalog)return;
 const form=document.querySelector('#orderForm'),summary=document.querySelector('#summary');if(!form||!summary)return;
 const box=document.createElement('section');box.className='request-cart';box.setAttribute('aria-label','Изделия в заявке');summary.before(box);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let items=[];
 const clean=s=>({product:s.product,color:Number(s.color)||0,size:s.size||'M',quantity:Number(s.quantity)||1,mode:'query',...(s.product==='dress'?{bundle:s.bundle||'white',shortsSize:s.shortsSize||s.size||'M'}:{})});
 const options=(pairs,value)=>pairs.map(([id,name])=>`<option value="${esc(id)}" ${String(id)===String(value)?'selected':''}>${esc(name)}</option>`).join('');
 function render(){
  box.innerHTML='<h3>Изделия в заявке</h3>'+items.map((s,i)=>{const p=catalog.find(p=>p.id===s.product);return `<fieldset data-item="${i}"><legend>Изделие ${i+1}</legend><label>Модель<select data-field="product">${options(catalog.map(p=>[p.id,p.name]),s.product)}</select></label><label>Цвет<select data-field="color">${options(p.colors.map((c,i)=>[i,c[0]]),s.color)}</select></label><div class="request-item-grid"><label>Размер<select data-field="size">${options(['S','M','L'].map(s=>[s,s]),s.size)}</select></label><label>Количество<input data-field="quantity" type="number" min="1" max="99" value="${s.quantity}" required></label></div>${s.product==='dress'?`<label>Шорты в комплекте<select data-field="bundle">${options([['white','Одна пара · белые'],['black','Одна пара · чёрные'],['both','Две пары · белые и чёрные']],s.bundle)}</select></label><label>Размер шорт<select data-field="shortsSize">${options(['S','M','L'].map(s=>[s,s]),s.shortsSize)}</select></label>`:''}${items.length>1?`<button type="button" data-remove="${i}" class="size-link">Убрать изделие</button>`:''}</fieldset>`}).join('')+`<button type="button" id="addRequestItem" class="secondary" ${items.length>=4?'disabled':''}>+ Добавить ещё изделие</button><p class="hint">Одна заявка и общая доставка. Цену, наличие и срок каждой вещи подтвердим в предложении до оплаты.</p>`;
  box.querySelectorAll('[data-item]').forEach(row=>{const i=Number(row.dataset.item);row.querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{const k=el.dataset.field;items[i][k]=['color','quantity'].includes(k)?Number(el.value):el.value;if(k==='product'){items[i]=clean({...items[i],color:0});render();}})});
  box.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{items.splice(Number(b.dataset.remove),1);render();});
  box.querySelector('#addRequestItem').onclick=()=>{if(items.length<4){const product=items[0].product==='top'?'skirt':'top';items.push(clean({product,color:0,size:items[0].size,quantity:1}));render();}};
 }
 window.ACEFORM_REQUEST_CART={open(selection){items=[clean(selection)];summary.hidden=true;render();},value(){return items.map(clean);},clear(){items=[];}};
})();

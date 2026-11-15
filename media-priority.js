/* Decode images before swapping; warm only the colors of the open product. */
(()=>{
 'use strict';
 const media=window.ACEFORM_MEDIA,cache=new Map(),tokens=new WeakMap();
 let queue=[],active=0,prepared='';
 function load(value,priority='low'){
  const src=media.src(value);if(!src)return Promise.reject(Error('Missing image'));
  const existing=cache.get(src);if(existing){if(priority==='high')existing.image.fetchPriority='high';return existing.promise;}
  const image=new Image();image.decoding='async';image.fetchPriority=priority;
  const promise=new Promise((resolve,reject)=>{image.onload=async()=>{try{await image.decode();}catch{}const entry=cache.get(src);if(entry)entry.decoded=true;resolve(image);};image.onerror=()=>{cache.delete(src);reject(Error('Image unavailable'));};image.src=src;});
  cache.set(src,{image,promise,decoded:false});return promise;
 }
 function pump(){while(active<2&&queue.length){const src=queue.shift();active++;load(src).catch(()=>{}).finally(()=>{active--;pump();});}}
 function prepareProduct(id){
  if(document.readyState!=='complete'){addEventListener('load',()=>prepareProduct(id),{once:true});return;}
  if(document.body.dataset.shopScreen!=='product'||prepared===id||navigator.connection?.saveData)return;
  prepared=id;queue=[];
  const model=window.ACEFORM_MODELS[id]||[],sources=model.map(views=>views[0]);
  if(id==='dress')sources.push('assets/fast-aperol-studio-dress-navy-v1.jpg','assets/fast-aperol-studio-dress-orange-v1.jpg');
  if(id==='top'||id==='skirt')sources.push('assets/fast-aperol-studio-suit-navy-orange-v2.jpg','assets/fast-aperol-studio-suit-orange-navy-v2.jpg');
  const start=()=>{if(prepared!==id||document.body.dataset.shopScreen!=='product')return;queue=[...new Set(sources.map(media.src))].filter(src=>!cache.has(src));pump();};
  if('requestIdleCallback' in window)requestIdleCallback(start,{timeout:800});else setTimeout(start,100);
 }
 function show(container,value,attributes={}){
  const src=media.src(value),token={};tokens.set(container,token);
  const apply=image=>{if(tokens.get(container)!==token)return false;for(const [key,value] of Object.entries(attributes))image.setAttribute(key,value);if(container.firstElementChild!==image)container.replaceChildren(image);return true;};
  const ready=cache.get(src);if(ready?.decoded&&ready.image.naturalWidth){apply(ready.image);return Promise.resolve(true);}
  return load(src,'high').then(apply).catch(()=>{if(tokens.get(container)!==token)return false;const image=new Image();image.alt=attributes.alt||'';for(const [key,value] of Object.entries(attributes))image.setAttribute(key,value);image.src=src;container.replaceChildren(image);return false;});
 }
 media.load=load;media.show=show;media.prepareProduct=prepareProduct;
})();

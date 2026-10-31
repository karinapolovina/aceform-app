/* The same rack scene is used on the postcard and in its PNG export. */
(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function artwork(p){
  if(p.model==='shorts')return {src:'../assets/shorts-pair.png',crop:p.id==='shorts-0'?'0 88 500 350':'500 88 500 350'};
  return {src:p.image,crop:p.model==='skirt'?'30 265 900 770':p.model==='top'?'95 65 770 1060':'50 55 860 1110'};
 }
 const photos=new Map();let photoWork=Promise.resolve();
 function photo(src){
  if(photos.has(src))return photos.get(src);
  const task=photoWork.then(async()=>{
   const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,w=canvas.width,h=canvas.height;
   if(src.endsWith('shorts-pair.png')){const result=canvas.toDataURL('image/png');canvas.width=canvas.height=0;return result;}
   let points=null;
   if(src.includes('dress-white-catalog'))points=[[400,48],[545,48],[654,105],[658,195],[689,310],[678,350],[648,430],[637,510],[650,590],[826,1053],[728,1112],[470,1133],[237,1107],[134,1053],[315,570],[321,510],[312,455],[278,340],[273,310],[291,205],[303,103],[345,90]];
   if(src.includes('top-white-catalog'))points=[[342,157],[615,157],[778,267],[765,450],[807,580],[735,822],[742,950],[751,987],[700,1012],[228,1009],[208,988],[231,850],[153,590],[191,460],[181,265],[257,233]];
   if(src.includes('rococo-white-catalog'))points=[[302,311],[650,311],[677,385],[850,665],[893,880],[778,965],[500,996],[154,966],[66,880],[110,730],[277,385]];
   if(src.includes('rococo-white-pink'))points=[[290,288],[670,288],[680,395],[280,395]];
   let protect=null;if(points){c.clearRect(0,0,w,h);c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0]*w/960,p[1]*h/1200):c.moveTo(p[0]*w/960,p[1]*h/1200));c.closePath();c.fill();protect=c.getImageData(0,0,w,h).data;}
   const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
   const background=i=>{const k=i*4;if(protect&&protect[k+3]>0)return false;const min=Math.min(d[k],d[k+1],d[k+2]),max=Math.max(d[k],d[k+1],d[k+2]);return d[k+3]<20||(min>=237&&max-min<=24);};
   const add=i=>{if(!seen[i]&&background(i)){seen[i]=1;queue[tail++]=i;}};
   for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
   while(head<tail){const i=queue[head++];d[i*4+3]=0;if(i%w)add(i-1);if(i%w<w-1)add(i+1);if(i>=w)add(i-w);if(i<w*(h-1))add(i+w);}
   c.putImageData(pixels,0,0);const result=canvas.toDataURL('image/png');canvas.width=canvas.height=0;return result;
  });photos.set(src,task);photoWork=task.catch(()=>{});return task;
 }
 function hydrate(){for(const image of document.querySelectorAll('image[data-rack-src]:not([data-rack-ready])')){image.setAttribute('data-rack-ready','1');photo(image.getAttribute('data-rack-src')).then(url=>{if(image.isConnected)image.setAttribute('href',url);}).catch(()=>{image.removeAttribute('data-rack-ready');});}}
 if(typeof MutationObserver!=='undefined')new MutationObserver(hydrate).observe(document.documentElement,{childList:true,subtree:true});
 function render(products,urls){
  const count=products.length,step=900/Math.max(count,1),width=Math.min(350,step*1.16);
  const clothes=products.map((p,i)=>{
   const x=90+step*(i+.5),art=artwork(p),w=width,h=w*({dress:1.38,top:1.05,skirt:.85,shorts:.62}[p.model]||1.2),y=198;
   const hanger=Math.min(w*.48,82),src=urls?urls[i]:art.src;
   return `<g><title>${escape(p.title+' · '+p.color)}</title><path d="M${x} 125v-10c0-15 23-15 23 0 0 10-23 12-23 27v13l-${hanger} 39q-7 5 3 5h${hanger*2-6}q10 0 3-5l-${hanger} -39" fill="none" stroke="#9b8056" stroke-width="4" stroke-linejoin="round"/><svg x="${x-w/2}" y="${y}" width="${w}" height="${h}" viewBox="${art.crop}" preserveAspectRatio="xMidYMin meet" style="mix-blend-mode:multiply"><image data-rack-src="${escape(art.src)}" href="${escape(src)}" width="${p.model==='shorts'?1000:960}" height="${p.model==='shorts'?500:1200}"/></svg></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="wardrobe-rack" viewBox="0 0 1080 780" role="img" aria-label="Напольная вешалка с выбранными вещами ACEFORM"><defs><linearGradient id="rackMetal" x1="0" x2="1"><stop stop-color="#8c744d"/><stop offset=".48" stop-color="#c6b58e"/><stop offset="1" stop-color="#8c744d"/></linearGradient></defs><ellipse cx="540" cy="727" rx="458" ry="25" fill="#25382f" opacity=".06"/><path d="M70 719 114 94q2-20 22-20h808q20 0 22 20l44 625M114 121h852" fill="none" stroke="url(#rackMetal)" stroke-width="10" stroke-linecap="round"/><path d="M46 720h124m740 0h124M92 655h896" fill="none" stroke="#a48d65" stroke-width="8" stroke-linecap="round"/>${clothes}<path d="m922 72-25-12v25l25-10m8-3 25-12v25l-25-10" fill="#792a36"/><text x="540" y="770" text-anchor="middle" fill="#77796e" font-family="Arial,sans-serif" font-size="18" letter-spacing="4">МОЯ ФОРМА ДЛЯ НОВОГО СЕЗОНА</text></svg>`;
 }
 async function raster(products){
  const urls=await Promise.all(products.map(p=>photo(artwork(p).src)));
  const blob=new Blob([render(products,urls)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
  try{img.src=url;await img.decode();return img;}finally{URL.revokeObjectURL(url);}
 }
 window.ACEFORM_WISH_RACK={render,raster};
})();

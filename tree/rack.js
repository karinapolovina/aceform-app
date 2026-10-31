/* The same rack scene is used on the postcard and in its PNG export. */
(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function artwork(p){
  if(p.model==='shorts')return {src:'../assets/shorts-pair.png',crop:p.id==='shorts-0'?'0 88 500 350':'500 88 500 350'};
  return {src:p.image,crop:p.model==='skirt'?'30 265 900 770':p.model==='top'?'95 65 770 1060':'50 35 860 1125'};
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
 // Relative garment lengths share one scale; catalog photos keep their aspect ratios.
 function rackLayout(products){
  const lengths={dress:100,top:50,skirt:45,shorts:30},gap=5;
  const pieces=products.map((p,i)=>{const art=artwork(p),crop=art.crop.split(' ').map(Number),height=lengths[p.model]||70;return{p,art,index:i,unitsH:height,unitsW:height*crop[2]/crop[3]};});
  const total=pieces.reduce((n,p)=>n+p.unitsW,0)+Math.max(0,pieces.length-1)*gap,scale=Math.min(4.6,840/Math.max(total,1));let cursor=(1080-total*scale)/2;
  return pieces.map(piece=>{const w=piece.unitsW*scale,h=piece.unitsH*scale,x=cursor+w/2;cursor+=w+gap*scale;return{...piece,x,w,h,railY:126-(x-115)*.026,angle:[-4.5,3,-3.5,4,-2,3.5][piece.index%6]};});
 }
 function render(products,urls){
  const clothes=rackLayout(products).map(({p,art,index,x,w,h,railY,angle})=>{
   const lower=p.model==='skirt'||p.model==='shorts',half=w*(p.model==='dress'?.27:lower?.34:.4),barY=railY+66,imageY=barY-4,src=urls?urls[index]:art.src;
   const hanger=`<path d="M${x} ${railY+17}v-6c0-8 14-10 14-19 0-12-18-13-19-1" fill="none" stroke="#a28b62" stroke-width="3.2" stroke-linecap="round"/><path d="M${x} ${railY+17} ${x-half} ${barY-3}q-4 4 2 4h${half*2-4}q6 0 2-4Z" fill="#c7b28b" fill-opacity=".62" stroke="#9f8761" stroke-width="2.4" stroke-linejoin="round"/>${lower?`<path d="M${x-half*.65} ${barY}v13m${half*1.3} -13v13" fill="none" stroke="#8c795b" stroke-width="4" stroke-linecap="round"/>`:''}`;
   return `<g transform="rotate(${angle} ${x} ${railY})"><title>${escape(p.title+' · '+p.color)}</title>${hanger}<svg x="${x-w/2}" y="${imageY}" width="${w}" height="${h}" viewBox="${art.crop}" preserveAspectRatio="xMidYMin meet" style="mix-blend-mode:multiply"><image data-rack-src="${escape(art.src)}" href="${escape(src)}" width="${p.model==='shorts'?1000:960}" height="${p.model==='shorts'?500:1200}"/></svg></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" class="wardrobe-rack" viewBox="0 0 1080 780" role="img" aria-label="Напольная вешалка ACEFORM в ракурсе 45 градусов" data-view-angle="45"><defs><linearGradient id="rackMetal" x1="0" x2="1"><stop stop-color="#9e8967"/><stop offset=".28" stop-color="#d6c8a8"/><stop offset=".53" stop-color="#b59b72"/><stop offset=".77" stop-color="#e0d3b6"/><stop offset="1" stop-color="#9e8967"/></linearGradient></defs><g transform="matrix(0.70710678 0.22 0 0.8 158.16234 -37)"><ellipse cx="545" cy="724" rx="445" ry="19" fill="#25382f" opacity=".045"/><ellipse cx="544" cy="723" rx="340" ry="9" fill="#25382f" opacity=".035"/><path d="M112 141 83 701m886-582 32 561M83 701 125 664m876 16 33-34M125 664l909-18" fill="none" stroke="#c2b393" stroke-width="5" stroke-linecap="round"/><path d="M83 701 112 141q1-16 17-17l824-22q16-1 17 16l31 582" fill="none" stroke="url(#rackMetal)" stroke-width="7" stroke-linecap="round"/><path d="M54 708 111 706m861-2 59-3M96 664l892-19" fill="none" stroke="url(#rackMetal)" stroke-width="6" stroke-linecap="round"/>${clothes}<g transform="rotate(-2 931 104)"><path d="M931 105q-38-27-34-9 5 14 34 9m0 0q35-32 34-11-3 14-34 11" fill="none" stroke="#792a36" stroke-width="6" stroke-linecap="round"/><path d="m930 107-9 43 10-8 9 7-6-42" fill="#792a36"/></g></g><text x="540" y="765" text-anchor="middle" fill="#858276" font-family="Arial,sans-serif" font-size="16" letter-spacing="4.5">МОЯ ФОРМА ДЛЯ НОВОГО СЕЗОНА</text></svg>`;
 }

 async function raster(products){
  const urls=await Promise.all(products.map(p=>photo(artwork(p).src)));
  const blob=new Blob([render(products,urls)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();
  try{img.src=url;await img.decode();return img;}finally{URL.revokeObjectURL(url);}
 }
 window.ACEFORM_WISH_RACK={render,raster,layout:rackLayout};
})();

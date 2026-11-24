window.ACEFORM_COMMERCE = {
 aperolShorts(s) {return 'MARBLE: '+(s.color===0?'оранжевые':'тёмно-синие')+' · 1 пара';},
 basketPrice(items) {
  if(!items.length||items.every(s=>s.product==='dress')||items.some(s=>!['dress','top','skirt','aperol-dress','aperol-suit'].includes(s.product)))return null;
  const price=s=>s.product==='dress'?(s.bundle==='both'?9500:8000):s.product==='aperol-dress'?10000:({'top':3900,'skirt':7900,'aperol-dress':10000,'aperol-suit':12900})[s.product];
  let capsules=items.filter(s=>s.product==='aperol-dress').reduce((n,s)=>n+s.quantity,0);
  let pairs=items.filter(s=>s.product==='skirt').reduce((n,s)=>n+s.quantity,0),discount=0;
  const lines=items.map(s=>{const unit=price(s),paired=s.product==='top'?Math.min(pairs,s.quantity):0;pairs-=paired;const capsulePairs=s.product==='aperol-suit'?Math.min(capsules,s.quantity):0;capsules-=capsulePairs;discount+=paired*800+capsulePairs*2290;return {selection:s,unit,total:unit*s.quantity-paired*800-capsulePairs*2290,paired,capsulePairs};});
  const subtotal=items.reduce((n,s)=>n+price(s)*s.quantity,0);
  return {lines,subtotal,discount,total:subtotal-discount};
 },
 bundleLimit(bundle,size,inventory,included,dressQuantity) {
  if(!['white','black','either'].includes(included))return 0;
  if(bundle!=='both')return included==='either'||included===bundle?dressQuantity:0;
  const colors=included==='white'?['Чёрный']:included==='black'?['Белый']:['Белый','Чёрный'];
  const extra=inventory.filter(v=>v.product==='Шорты'&&v.size===size&&colors.includes(v.color)).reduce((n,v)=>n+(Number.isSafeInteger(v.quantity)?v.quantity:0),0);
  return Math.min(dressQuantity,extra);
 },
 preorderOnly(p) {return p.id==='top'||p.id==='skirt';},
 inStock(p,variant,fresh) {return p.id==='shorts'||(!this.preorderOnly(p)&&fresh&&variant?.quantity>0);},
 orderLimit(p,variant) {return p.id==='shorts'?99:variant?.quantity??99;},
 unitPrice(p,bundle,variant) {
  if(p.id==='dress')return bundle==='both'?9500:8000;
  if(p.id==='top')return 3900;
  if(p.id==='skirt')return 7900;
  return variant?.price??null;
 },
 stockRows(p,inventory,fresh) {
  // Owner-confirmed availability is boolean: no stock quantity is invented.
  if(p.id==='shorts')return p.colors.flatMap(c=>['S','M','L'].map(size=>({product:p.name,color:c[0],size,quantity:null,inStock:true})));
  if(!fresh||this.preorderOnly(p))return [];
  return inventory.filter(v=>v.product===(p.stockName||p.name)&&p.colors.some(c=>c[0]===v.color)&&['S','M','L'].includes(v.size)&&v.quantity>0);
 },
 matchesFilter(p,filter,inventory,fresh) {
  if(filter==='stock')return this.stockRows(p,inventory,fresh).length>0;
  if(filter==='preorder')return this.preorderOnly(p)||(fresh&&inventory.some(v=>v.product===(p.stockName||p.name)&&p.colors.some(c=>c[0]===v.color)&&v.preorder===true));
  return true;
 }
};

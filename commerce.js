window.ACEFORM_COMMERCE = {
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
  if(this.preorderOnly(p))return null;
  return variant?.price??null;
 },
 stockRows(p,inventory,fresh) {
  // Owner-confirmed availability is boolean: no stock quantity is invented.
  if(p.id==='shorts')return p.colors.flatMap(c=>['S','M','L'].map(size=>({product:p.name,color:c[0],size,quantity:null,inStock:true})));
  if(!fresh||this.preorderOnly(p))return [];
  return inventory.filter(v=>v.product===p.name&&p.colors.some(c=>c[0]===v.color)&&['S','M','L'].includes(v.size)&&v.quantity>0);
 },
 matchesFilter(p,filter,inventory,fresh) {
  if(filter==='stock')return this.stockRows(p,inventory,fresh).length>0;
  if(filter==='preorder')return this.preorderOnly(p)||(fresh&&inventory.some(v=>v.product===p.name&&p.colors.some(c=>c[0]===v.color)&&v.preorder===true));
  return true;
 }
};

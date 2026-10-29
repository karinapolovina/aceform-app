window.ACEFORM_COMMERCE = {
 preorderOnly(p) {return p.id==='top'||p.id==='skirt';},
 unitPrice(p,bundle,variant) {
  if(p.id==='dress')return bundle==='both'?9500:8000;
  if(this.preorderOnly(p))return null;
  return variant?.price??null;
 },
 stockRows(p,inventory,fresh) {
  if(!fresh||this.preorderOnly(p))return [];
  return inventory.filter(v=>v.product===p.name&&p.colors.some(c=>c[0]===v.color)&&['S','M','L'].includes(v.size)&&v.quantity>0);
 },
 matchesFilter(p,filter,inventory,fresh) {
  if(filter==='stock')return this.stockRows(p,inventory,fresh).length>0;
  if(filter==='preorder')return this.preorderOnly(p)||(fresh&&inventory.some(v=>v.product===p.name&&p.colors.some(c=>c[0]===v.color)&&v.preorder===true));
  return true;
 }
};

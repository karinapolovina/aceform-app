const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('commerce.js','utf8'),context);vm.runInContext(fs.readFileSync('catalog.js','utf8'),context);
const c=context.window.ACEFORM_COMMERCE, catalog=context.window.ACEFORM_CATALOG;
assert.equal(c.unitPrice({id:'top'}),3900);assert.equal(c.unitPrice({id:'skirt'}),7900);
assert.equal(c.unitPrice({id:'dress'},'white'),8000);assert.equal(c.unitPrice({id:'dress'},'both'),9500);
const item=(product,quantity,color=0)=>({product,quantity,color,size:'M'});
for(let top=0;top<4;top++)for(let skirt=0;skirt<6;skirt++)assert.equal(c.basketPrice([item('top',1,top),item('skirt',1,skirt)]).total,12900);
for(const [tops,skirts,total] of [[1,0,3900],[0,1,7900],[2,1,16800],[1,2,20800],[2,2,25800],[3,1,20700]]){
 const items=[];if(tops)items.push(item('top',tops));if(skirts)items.push(item('skirt',skirts));
 const price=c.basketPrice(items);assert.equal(price.total,total);assert.equal(price.lines.reduce((n,l)=>n+l.total,0),total);
 assert.equal(c.basketPrice(items.reverse()).total,total);
}
assert.equal(c.basketPrice([item('top',1),item('dress',1)]).total,11900);
assert.equal(c.basketPrice([{...item('dress',1),bundle:'both'},item('aperol-suit',1)]).total,22400);
assert.equal(c.basketPrice([item('dress',1),item('aperol-suit',1)]).total,20900);
assert.equal(c.basketPrice([item('dress',1)]),null);
assert.equal(c.basketPrice([item('shorts',1),item('aperol-suit',1)]),null);
assert.equal(c.basketPrice([]),null);
assert(!catalog.some(p=>p.colors.some(c=>/оранж/i.test(c[0]))));
console.log('Pricing passed: 24 color pairs, 6 quantity scenarios in both orders, standalone prices, EVERT unchanged, no orange.');

assert.equal(c.basketPrice([item("aperol-dress",1),item("aperol-suit",1)]).total,20610);
assert.throws(()=>c.basketPrice([{...item("aperol-dress",1),extraShorts:true}]));
for(let t=0;t<4;t++)for(let s=0;s<6;s++)assert.equal(c.outfitAvailability(t,s).startsWith("Цвет в наличии"),t===0&&[0,1].includes(s));

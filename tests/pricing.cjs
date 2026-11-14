const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('commerce.js','utf8'),context);vm.runInContext(fs.readFileSync('catalog.js','utf8'),context);
const c=context.window.ACEFORM_COMMERCE, catalog=context.window.ACEFORM_CATALOG;
assert.equal(c.unitPrice({id:'top'}),2900);assert.equal(c.unitPrice({id:'skirt'}),8900);
assert.equal(c.unitPrice({id:'dress'},'white'),8000);assert.equal(c.unitPrice({id:'dress'},'both'),9500);
const item=(product,quantity,color=0)=>({product,quantity,color,size:'M'});
for(let top=0;top<4;top++)for(let skirt=0;skirt<6;skirt++)assert.equal(c.basketPrice([item('top',1,top),item('skirt',1,skirt)]).total,10900);
for(const [tops,skirts,total] of [[1,0,2900],[0,1,8900],[2,1,13800],[1,2,19800],[2,2,21800],[3,1,16700]]){
 const items=[];if(tops)items.push(item('top',tops));if(skirts)items.push(item('skirt',skirts));
 const price=c.basketPrice(items);assert.equal(price.total,total);assert.equal(price.lines.reduce((n,l)=>n+l.total,0),total);
 assert.equal(c.basketPrice(items.reverse()).total,total);
}
assert.equal(c.basketPrice([item('top',1),item('dress',1)]),null);
assert.equal(c.basketPrice([]),null);
assert(!catalog.some(p=>p.colors.some(c=>/оранж/i.test(c[0]))));
console.log('Pricing passed: 24 color pairs, 6 quantity scenarios in both orders, standalone prices, EVERT unchanged, no orange.');

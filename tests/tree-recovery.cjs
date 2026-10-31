const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
(async()=>{
 const timers=new Map(),listeners=new Set(),frames=[];let timerId=0;
 const ctx={window:{ACEFORM_TREE_API:'https://script.google.com/macros/s/test/exec',addEventListener:(n,fn)=>listeners.add(fn),removeEventListener:(n,fn)=>listeners.delete(fn)},location:{origin:'https://karinapolovina.github.io'},crypto:require('crypto').webcrypto,URL,Map,Error,setTimeout:fn=>(timers.set(++timerId,fn),timerId),clearTimeout:id=>timers.delete(id),document:{createElement:()=>({remove(){this.removed=true}}),body:{append:f=>frames.push(f)}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('tree/transport.js','utf8'),ctx);
 const request=()=>ctx.window.ACEFORM_TREE_TRANSPORT.request('/api/config');
 const p=request();[...timers.values()][0]();await assert.rejects(p);assert(frames[0].removed);assert.equal(listeners.size,0);
 const retry=request();assert.equal(frames.length,2);assert.notEqual(frames[0].src,frames[1].src);const nonce=new URL(frames[1].src).searchParams.get('nonce');let outbound;
 const peer={postMessage:msg=>outbound=msg};const receive=[...listeners][0];receive({origin:'https://test.googleusercontent.com',source:peer,data:{nonce,kind:'aceform-tree-ready'}});await Promise.resolve();await Promise.resolve();receive({origin:'https://test.googleusercontent.com',source:peer,data:{nonce,kind:'aceform-tree-response',id:outbound.id,result:{ok:true,data:{reconnected:true}}}});assert.equal((await retry).reconnected,true);
 const stored=new Map(),nodes={};const app={window:{addEventListener(){},Telegram:{WebApp:{initDataUnsafe:{user:{id:123}}}}},document:{addEventListener(){},querySelector:id=>nodes[id]||(nodes[id]={})},location:{hash:'#'},console,localStorage:{setItem:(k,v)=>stored.set(k,v),getItem:k=>stored.get(k)||null,removeItem:k=>stored.delete(k)}};
 vm.createContext(app);for(const file of ['catalog.js','tree/rack.js'])vm.runInContext(fs.readFileSync(file,'utf8'),app);vm.runInContext(fs.readFileSync('tree/app.js','utf8').replace("document.querySelector('#mine').onclick=()=>go('#mine');window.addEventListener('hashchange',route);boot();",''),app);const run=s=>vm.runInContext(s,app);
 run("restoreDraft();draft={items:[{product:'white',size:'S'},{product:'top-1',size:'L'}],dream:'Сыграть свой первый турнир',name:'Аня',anonymous:true,channel:false,publicConsent:true};persistDraft();draft={};restoreDraft();");assert.equal(run('draft.items[1].size'),'L');assert.equal(run('draft.dream'),'Сыграть свой первый турнир');
 run('savedWish={revision:2};restoreDraft()');assert.equal(stored.size,0);assert.equal(run('hasLocalDraft'),false);
 run("savedWish=null;persistDraft();window.Telegram.WebApp.initDataUnsafe.user.id=456;draft={};restoreDraft()");assert.equal(run('draft.dream'),undefined);
 console.log('Passed: reconnect after timeout, stale frame/listener cleanup, successful retry response, persistent multi-item draft, revision conflict protection, account separation.');
})().catch(e=>{console.error(e);process.exitCode=1});

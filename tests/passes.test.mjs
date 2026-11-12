import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createApi } from '../lib/state.mjs';
globalThis.crypto ??= webcrypto;
function fixture(){
 let row=null;
 const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this;},async first(){return row?{...row}:null;},async run(){if(sql.startsWith('INSERT')){if(row)return {meta:{changes:0}};row={body:args[0],version:0};return {meta:{changes:1}};}if(row.version!==args[1])return {meta:{changes:0}};row={body:args[0],version:row.version+1};return {meta:{changes:1}};}}}};
 const api=createApi(DB);
 return {get:async()=>await (await api.GET()).json(),post:a=>api.POST(new Request('https://school.example/api/state',{method:'POST',body:JSON.stringify(a)}))};
}
const pass=studentId=>({type:'out',studentId,reason:'Restroom',teacher:'Teacher',room:'204'});
async function roster(f){assert.equal((await f.post({type:'students',students:[{name:'A'},{name:'B'},{name:'C'}]})).status,200);return (await f.get()).students.map(x=>x.id);}
test('simultaneous checkouts allow only one member of a separation group',async()=>{
 const f=fixture(),[a,b,c]=await roster(f);
 assert.equal((await f.post({type:'rule',name:'Keep separate',members:[a,b,c]})).status,200);
 const results=await Promise.all([f.post(pass(a)),f.post(pass(b))]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 const state=await f.get();assert.equal(state.trips.length,1);
 assert.equal((await f.post(pass(c))).status,409);
 assert.equal((await f.post(pass(state.trips[0].studentId))).status,409);
 assert.equal((await f.post({type:'back',id:state.trips[0].id})).status,200);
 assert.equal((await f.post(pass(c))).status,200);
});
test('unrelated students can be out together; unsafe new rules are rejected',async()=>{
 const f=fixture(),[a,b]=await roster(f);
 assert.equal((await f.post(pass(a))).status,200);assert.equal((await f.post(pass(b))).status,200);
 assert.equal((await f.post({type:'rule',name:'Group',members:[a,b]})).status,409);
 assert.equal((await f.get()).rules.length,0);
});
test('invalid reasons, unknown students, and incomplete passes are rejected',async()=>{
 const f=fixture(),[a]=await roster(f);
 for(const p of [{...pass(a),reason:'Invalid'},{...pass(a),teacher:''},{...pass(a),room:''},pass('unknown')]) assert.equal((await f.post(p)).status,400);
 assert.equal((await f.get()).trips.length,0);
});
test('removing a rule permits checkout while the other member is out',async()=>{
 const f=fixture(),[a,b]=await roster(f);
 await f.post({type:'rule',name:'Group',members:[a,b]});await f.post(pass(a));assert.equal((await f.post(pass(b))).status,409);
 const state=await f.get();await f.post({type:'deleteRule',id:state.rules[0].id});assert.equal((await f.post(pass(b))).status,200);
});

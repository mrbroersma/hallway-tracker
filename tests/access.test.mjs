import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { authorize } from '../lib/access.mjs';
globalThis.crypto ??= webcrypto;
const env={ACCESS_TEAM_DOMAIN:'test-school.cloudflareaccess.com',ACCESS_AUD:'staff-app'};
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'school-key'};
const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(changes={}){
 const input=enc({alg:'RS256',kid:'school-key'})+'.'+enc({iss:'https://'+env.ACCESS_TEAM_DOMAIN,aud:[env.ACCESS_AUD],exp:Math.floor(Date.now()/1000)+300,...changes});
 return input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input))).toString('base64url');
}
const req=t=>new Request('https://school.example/',{headers:t?{'Cf-Access-Jwt-Assertion':t}:{}});
const fetchKeys=async url=>{assert.equal(url,'https://test-school.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
test('production is locked without configured staff sign-in',async()=>assert.equal((await authorize(req(),{})).status,503));
test('missing or malformed tokens cannot access records',async()=>{assert.equal((await authorize(req(),env)).status,403);assert.equal((await authorize(req('fake.token.signature'),env)).status,403);});
test('valid signed staff token is accepted',async()=>assert.equal(await authorize(req(await token()),env,fetchKeys),null));
test('expired, wrong issuer, wrong audience and future tokens are rejected',async()=>{
 for(const changes of [{exp:1},{iss:'https://attacker.example'},{aud:['other-app']},{nbf:Math.floor(Date.now()/1000)+600}])assert.equal((await authorize(req(await token(changes)),env,fetchKeys)).status,403);
});
test('changing signed claims invalidates the signature',async()=>{
 const parts=(await token()).split('.');parts[1]=enc({iss:'https://'+env.ACCESS_TEAM_DOMAIN,aud:[env.ACCESS_AUD],exp:Math.floor(Date.now()/1000)+600});
 assert.equal((await authorize(req(parts.join('.')),env,fetchKeys)).status,403);
});

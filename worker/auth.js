const authKey="dahab/admin-credentials-v1.json";
const encodeBytes=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
function decodeBytes(value) {
  const encoded=value.replaceAll("-","+").replaceAll("_","/");
  return Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
}
function isSiteOwner(request,env) {
  const token=env.ADMIN_SETUP_TOKEN;
  if(typeof token!=="string"||token.length<32)return false;
  const authorization=request.headers.get("authorization")||"";
  if(!authorization.startsWith("Basic "))return false;
  try{return atob(authorization.slice(6))==="admin:"+token;}catch{return false;}
}
async function credentials(env) {
  return (await env.BUCKET.get(authKey))?.json()||null;
}
async function passwordHash(password,salt) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:decodeBytes(salt),iterations:100000,hash:"SHA-256"},key,256));
}
async function signingKey(config) {
  return crypto.subtle.importKey("raw",decodeBytes(config.key),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function hasAdminSession(request,env) {
  const cookie=request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith("dahab_admin="))?.slice(12);
  if(!cookie||cookie.length>1500)return false;
  try{
    const [payload,signature]=cookie.split(".");
    const config=await credentials(env);
    if(!config)return false;
    if(!await crypto.subtle.verify("HMAC",await signingKey(config),decodeBytes(signature),new TextEncoder().encode(payload)))return false;
    const session=JSON.parse(new TextDecoder().decode(decodeBytes(payload)));
    return session.version===config.version&&session.exp>Date.now()&&session.exp<Date.now()+9*60*60*1000;
  }catch{return false;}
}
function sessionCookie(value,maxAge) {
  return "dahab_admin="+value+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge;
}
async function loginAttempt(request,env) {
  const ip=request.headers.get("cf-connecting-ip")||"shared";
  const digest=encodeBytes(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(ip)));
  const key="dahab/login-attempts/"+digest;
  for(let retry=0;retry<3;retry++){
    const object=await env.BUCKET.get(key);
    const previous=object?await object.json():null;
    const fresh=!previous||previous.until<Date.now();
    const state=fresh?{count:1,until:Date.now()+15*60*1000}:{...previous,count:previous.count+1};
    if(state.count>8)return null;
    const saved=await env.BUCKET.put(key,JSON.stringify(state),{onlyIf:new Headers(object?{"If-Match":'"'+object.etag+'"'}:{"If-None-Match":"*"})});
    if(saved)return {key,etag:saved.etag};
  }
  return null;
}
async function handleAdminAuth(request,env,url) {
  if(!url.pathname.startsWith("/api/admin/auth/"))return null;
  if(!env.BUCKET)return json({error:"Connexion indisponible. Réessayez plus tard."},503);
  const action=url.pathname.split("/").at(-1);
  if(action==="status"&&request.method==="GET"){
    const config=await credentials(env);
    return json({configured:Boolean(config),canSetup:isSiteOwner(request,env)});
  }
  if(request.method!=="POST")return json({error:"Méthode non autorisée."},405);
  if(request.headers.get("origin")!==url.origin||!request.headers.get("content-type")?.startsWith("application/json"))return json({error:"Requête refusée."},403);
  if(action==="logout")return json({ok:true},200,{"Set-Cookie":sessionCookie("",0)});
  const raw=await request.text();
  if(raw.length>3000)return json({error:"Requête invalide."},400);
  let data;
  try{data=JSON.parse(raw);}catch{return json({error:"Requête invalide."},400);}
  if(!data||typeof data.id!=="string"||typeof data.password!=="string"||data.id.length>64||data.password.length>128)return json({error:"Identifiant ou mot de passe invalide."},400);
  if(action==="setup"){
    if(!isSiteOwner(request,env))return json({error:"Seul le propriétaire du site peut créer cet accès."},403);
    if((await credentials(env)))return json({error:"L’accès administrateur est déjà configuré."},409);
    if(!/^[A-Za-z0-9._-]{3,64}$/.test(data.id)||data.password.length<10)return json({error:"Identifiant de 3 à 64 caractères (lettres, chiffres, . _ -). Mot de passe de 10 caractères minimum."},400);
    const salt=encodeBytes(crypto.getRandomValues(new Uint8Array(24)));
    const config={id:data.id,salt,hash:encodeBytes(await passwordHash(data.password,salt)),key:encodeBytes(crypto.getRandomValues(new Uint8Array(32))),version:crypto.randomUUID()};
    const saved=await env.BUCKET.put(authKey,JSON.stringify(config),{onlyIf:new Headers({"If-None-Match":"*"})});
    return saved?json({ok:true}):json({error:"L’accès a déjà été créé. Connectez-vous."},409);
  }
  if(action!=="login")return json({error:"Introuvable."},404);
  const attempt=await loginAttempt(request,env);
  if(!attempt)return json({error:"Trop de tentatives. Réessayez dans 15 minutes."},429,{"Retry-After":"900"});
  const config=await credentials(env);
  if(!config)return json({error:"Le propriétaire doit d’abord configurer l’accès administrateur."},403);
  const hash=await passwordHash(data.password,config.salt);
  const expected=decodeBytes(config.hash);
  let difference=hash.length^expected.length;
  for(let i=0;i<hash.length;i++)difference|=hash[i]^expected[i];
  if(difference||data.id!==config.id)return json({error:"Identifiant ou mot de passe incorrect."},401);
  await env.BUCKET.put(attempt.key,JSON.stringify({count:0,until:Date.now()+15*60*1000}),{onlyIf:new Headers({"If-Match":'"'+attempt.etag+'"'})});
  const payload=encodeBytes(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,version:config.version,nonce:crypto.randomUUID()})));
  const signature=encodeBytes(await crypto.subtle.sign("HMAC",await signingKey(config),new TextEncoder().encode(payload)));
  return json({ok:true},200,{"Set-Cookie":sessionCookie(payload+"."+signature,28800)});
}

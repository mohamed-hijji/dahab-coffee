const menuKey = "dahab/menu-v1.json";
function json(value,status=200,headers={}) {
  return Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
}
function validMenu(menu) {
  if (!Array.isArray(menu) || menu.length === 0 || menu.length > 80) return false;
  let count=0;
  const label = value => typeof value === "string" && value.trim().length > 0 && value.length <= 180;
  return menu.every(group => group && label(group.fr) && label(group.ar) && Array.isArray(group.items) && group.items.length <= 400 && group.items.every(item => {
    count++;
    return item && count <= 2000 && (!item.id || /^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) && (item.available === undefined || typeof item.available === "boolean") && (item.image === undefined || item.image === "" || /^\/assets\/menu-[a-z]+\.webp$/.test(item.image)) && label(item.fr) && label(item.ar) && typeof item.price === "string" && /^\d{1,6}(,\d{1,2})?$/.test(item.price) && Number(item.price.replace(",",".")) > 0;
  }));
}
const defaultSettings = {whatsapp:"212695004456"};
const menuPhotos = {
  "Café Arabica":"/assets/menu-arabica.webp", "Latté Macchiato":"/assets/menu-latte.webp",
  "Ice Coffee":"/assets/menu-ice.webp", "Frappé Moka Oreo":"/assets/menu-frappe.webp",
  "Tarte au citron":"/assets/menu-tarte.webp", "Miel eucalyptus · 250 g":"/assets/menu-miel.webp"
};
function normalizeMenu(menu) {
  return menu.map((group,gi)=>({...group,items:group.items.map((item,ii)=>({
    ...item,id:item.id||"legacy-"+gi+"-"+ii,available:item.available!==false,
    image:item.image===undefined?(menuPhotos[item.fr]||""):item.image
  }))}));
}
async function readMenu(env) {
  const object = await env.BUCKET.get(menuKey);
  const stored = object ? await object.json() : seed;
  const data = Array.isArray(stored) ? {menu:stored,settings:defaultSettings} : stored;
  return {menu:normalizeMenu(data.menu),settings:{...defaultSettings,...data.settings},etag:object?object.etag:"initial"};
}
export default {
  async fetch(request,env) {
    const url = new URL(request.url);

    try {
      const authResponse=await handleAdminAuth(request,env,url);
      if(authResponse)return authResponse;
      const admin=(url.pathname.startsWith("/admin")||url.pathname.startsWith("/api/admin/"))&&env.BUCKET ? await hasAdminSession(request,env) : false;
      if (url.pathname === "/api/admin/menu") {
        if (!admin) return json({error:"Accès réservé au propriétaire."},401);
        if (!env.BUCKET) return json({error:"Le stockage est indisponible."},503);
        if (request.method === "GET") {
          const {menu,settings,etag} = await readMenu(env);
          return json({menu,settings,revision:etag});
        }
        if (request.method !== "PUT") return json({error:"Méthode non autorisée."},405);
        if (request.headers.get("origin") !== url.origin || !request.headers.get("content-type")?.startsWith("application/json")) return json({error:"Requête refusée."},403);
        const raw = await request.text();
        if (raw.length > 1000000) return json({error:"Carte trop volumineuse."},413);
        let payload;
        try { payload=JSON.parse(raw); } catch { return json({error:"Format invalide."},400); }
        if (!payload || typeof payload !== "object") return json({error:"Format invalide."},400);
        const menu=payload.menu;
        const expected=payload.revision;
        if (typeof expected !== "string" || !expected || expected.length > 200) return json({error:"Rechargez la carte avant de réessayer."},428);
        if (!validMenu(menu)) return json({error:"Chaque section et article doit avoir un nom français et arabe, et chaque prix doit être positif (ex. 17,50)."},400);
        const settings=payload.settings;
        if (!settings || !/^[1-9]\d{7,14}$/.test(settings.whatsapp)) return json({error:"Saisissez le numéro WhatsApp international, sans + ni espaces."},400);
        const seen=new Set();
        const sanitized=menu.map(group=>({fr:group.fr.trim(),ar:group.ar.trim(),items:group.items.map(item=>{
          const id=item.id||crypto.randomUUID();
          if(seen.has(id)) throw new Error("Duplicate item ID");
          seen.add(id);
          return {id,fr:item.fr.trim(),ar:item.ar.trim(),price:item.price,available:item.available!==false,image:item.image||""};
        })}));
        const object = await env.BUCKET.put(menuKey,JSON.stringify({menu:sanitized,settings:{whatsapp:settings.whatsapp}}),{
          onlyIf:expected==="initial" ? new Headers({"If-None-Match":"*"}) : new Headers({"If-Match":'"'+expected+'"'}),
          httpMetadata:{contentType:"application/json"}
        });
        if (!object) return json({error:"La carte a été modifiée ailleurs. Rechargez-la avant de réessayer."},409);
        return json({saved:true,revision:object.etag,menu:sanitized});
      }
      if (url.pathname === "/api/order-data") {
        if(request.method !== "GET") return json({error:"Method not allowed"},405);
        if(!env.BUCKET) return json({menu:normalizeMenu(seed),settings:defaultSettings});
        const {menu,settings}=await readMenu(env);
        return json({menu,settings});
      }
      if (url.pathname === "/menu.json") {
        if (request.method !== "GET" && request.method !== "HEAD") return new Response(null,{status:405});
        if (!env.BUCKET) return json(seed);
        const {menu}=await readMenu(env);
        return json(menu);
      }
      let route=url.pathname;
      if(route==="/admin/setup" || route==="/admin-setup.html"){
        if(!isSiteOwner(request,env)) return new Response("Owner setup authorization required.",{status:401,headers:{"WWW-Authenticate":'Basic realm="DAHAB owner setup", charset="UTF-8"',"Cache-Control":"no-store"}});
        route="/admin-setup.html";
      }
      if(route==="/admin/login" || route==="/admin/login/") route="/admin-login.html";
      if (route === "/admin" || route === "/admin/") {
        if (!admin) return Response.redirect(url.origin+"/admin/login",302);
        route="/admin.html";
      }
      if (route === "/admin.html") {
        if (!admin) return new Response("Forbidden",{status:403});
      }
      if (request.method !== "GET" && request.method !== "HEAD") return new Response(null,{status:405});
      const asset=assets[route === "/" ? "/index.html" : route];
      if (!asset) return new Response("Not found",{status:404});
      const body=Uint8Array.from(atob(asset.body),char=>char.charCodeAt(0));
      return new Response(request.method==="HEAD"?null:body,{headers:{"Content-Type":asset.type,"Cache-Control":route.endsWith(".html")||route==="/"?"no-store":"public, max-age=0, must-revalidate","X-Content-Type-Options":"nosniff"}});
    } catch (error) {
      console.error("DAHAB request failed",error);
      return json({error:"Une erreur est survenue. Réessayez dans un instant."},503);
    }
  }
};

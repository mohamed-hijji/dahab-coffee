import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const assets = {};
const types = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp"};
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const relative = prefix + entry.name;
    const file = path.join(directory,entry.name);
    if (entry.isDirectory()) await collect(file,relative+"/");
    else assets["/"+relative] = {body:(await readFile(file)).toString("base64"),type:types[path.extname(file)] || "application/octet-stream"};
  }
}
await collect("public");
const seed = JSON.parse(await readFile("public/menu.json","utf8"));
const photoCatalog = JSON.parse(await readFile("public/product-photos.json","utf8"));
const worker = (await readFile("worker/auth.js","utf8"))+"\n"+await readFile("worker/index.js","utf8");
await mkdir("dist/server",{recursive:true});
await writeFile("dist/server/index.js","const assets = "+JSON.stringify(assets)+";\nconst seed = "+JSON.stringify(seed)+";\nconst photoCatalog = "+JSON.stringify(photoCatalog)+";\n"+worker);
console.log("Built Worker and "+Object.keys(assets).length+" bundled assets.");

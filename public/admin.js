(() => {
  const editor=document.querySelector("#editor");
  const save=document.querySelector("#save");
  const addSection=document.querySelector("#add-section");
  const status=document.querySelector("#admin-status");
  const orderNumber=document.querySelector("#order-number");
  const search=document.querySelector("#admin-search");
  const clearSearch=document.querySelector("#clear-search");
  const results=document.querySelector("#search-results");
  const normalize=value=>value.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().trim();
  function applySearch() {
    const terms=normalize(search.value).split(/\s+/).filter(Boolean);
    let visibleItems=0,visibleSections=0;
    for(const section of editor.querySelectorAll(".admin-section")) {
      const category=[...section.querySelector(".section-fields").querySelectorAll("input")].map(input=>input.value).join(" ");
      const categoryMatch=terms.every(term=>normalize(category).includes(term));
      let matches=0;
      for(const row of section.querySelectorAll(".admin-item")) {
        const name=[...row.querySelectorAll('input[data-field="fr"],input[data-field="ar"]')].map(input=>input.value).join(" ");
        const match=categoryMatch||terms.every(term=>normalize(category+" "+name).includes(term));
        row.hidden=!match;
        if(match)matches++;
      }
      section.hidden=terms.length>0&&!categoryMatch&&!matches;
      if(!section.hidden) {visibleSections++;visibleItems+=matches;if(terms.length)section.open=true;}
    }
    clearSearch.disabled=!search.value;
    results.textContent=visibleSections ? visibleItems+" article(s) · "+visibleSections+" section(s)" : "Aucun résultat. Essayez un autre nom en français ou en arabe.";
  }
  function showAll() { search.value="";applySearch(); }
  search.addEventListener("input",applySearch);
  clearSearch.addEventListener("click",()=>{showAll();search.focus();});
  let photoOptions=[];
  let revision="";
  let dirty=false;
  let busy=false;
  function setDirty() { dirty=true; save.disabled=busy; status.textContent="Modifications non enregistrées."; }
  function field(label,value,options={}) {
    const wrapper=document.createElement("label");
    wrapper.textContent=label;
    const input=document.createElement("input");
    input.value=value;
    input.required=true;
    input.maxLength=options.price?9:180;
    if(options.arabic) { input.dir="rtl"; input.lang="ar"; }
    if(options.price) { input.inputMode="decimal"; input.pattern="[0-9]{1,6}(,[0-9]{1,2})?"; input.title="Prix positif en DH, par exemple 17,50"; }
    input.dataset.field=options.key;
    wrapper.append(input);
    return wrapper;
  }
  function itemRow(item={fr:"",ar:"",price:""}) {
    const row=document.createElement("div"); row.className="admin-item"; row.dataset.id=item.id||"";
    row.append(field("Article · Français",item.fr,{key:"fr"}),field("المنتج · العربية",item.ar,{key:"ar",arabic:true}),field("Prix · DH",item.price,{key:"price",price:true}));
    const availability=document.createElement("label");availability.className="availability";
    const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=item.available!==false;checkbox.dataset.field="available";
    availability.append(checkbox,document.createTextNode("Disponible à la commande"));
    const photoLabel=document.createElement("label");photoLabel.textContent="Photo";
    const select=document.createElement("select");select.dataset.field="image";
    const photos=[["","Photo automatique"],...photoOptions.map(photo=>[photo.src,photo.label+(photo.source==="representative"?" · indicatif":" · Dahab")])];
    for(const [value,label] of photos){const option=document.createElement("option");option.value=value;option.textContent=label;select.append(option);}
    select.value=item.image||"";
    const preview=document.createElement("img");preview.className="admin-photo-preview";preview.alt="Aperçu de la photo";preview.loading="lazy";preview.width=80;preview.height=80;
    function updatePhoto(){const image=select.value||photoOptions.find(p=>p.key==="espresso")?.src;preview.src=image||"";preview.hidden=!image;}
    select.addEventListener("change",updatePhoto);updatePhoto();
    photoLabel.append(select,preview);row.append(availability,photoLabel);
    return row;
  }
  function updateSectionHeading(section) {
    const names=[...section.querySelector(".section-fields").querySelectorAll("input")].map(input=>input.value.trim()).filter(Boolean);
    section.querySelector(".section-name").textContent=names.join(" · ")||"Nouvelle section";
    section.querySelector(".section-total").textContent=section.querySelectorAll(".admin-item").length+" articles";
  }
  function section(group={fr:"",ar:"",items:[]}) {
    const section=document.createElement("details"); section.className="admin-section";
    const summary=document.createElement("summary");summary.className="section-heading";
    const name=document.createElement("span");name.className="section-name";
    const count=document.createElement("span");count.className="section-total";
    summary.append(name,count);
    const titles=document.createElement("div"); titles.className="section-fields";
    titles.append(field("Section · Français",group.fr,{key:"fr"}),field("القسم · العربية",group.ar,{key:"ar",arabic:true}));
    const items=document.createElement("div"); items.className="admin-items";
    items.append(...group.items.map(itemRow));
    const button=document.createElement("button"); button.type="button";button.className="add-item";button.textContent="Ajouter un article";
    button.addEventListener("click",()=>{ const row=itemRow();items.append(row);showAll();section.open=true;updateSectionHeading(section);row.querySelector("input").focus();setDirty(); });
    const content=document.createElement("div");content.className="section-content";
    content.append(titles,items,button);section.append(summary,content);updateSectionHeading(section);
    titles.addEventListener("input",()=>updateSectionHeading(section));
    return section;
  }
  async function load() {
    if(busy) return;
    busy=true;save.disabled=true;addSection.disabled=true;status.textContent="Chargement…";
    try {
      const [response,photosResponse]=await Promise.all([fetch("/api/admin/menu",{cache:"no-store"}),fetch("/product-photos.json",{cache:"no-store"})]);
      if(!photosResponse.ok)throw new Error("Impossible de charger les photos.");
      photoOptions=(await photosResponse.json()).photos;
      if(!response.ok) throw new Error(response.status===401?"Connectez-vous à nouveau pour accéder à la carte.":"Accès impossible. Seul le propriétaire peut modifier la carte.");
      const {menu,settings,revision:loadedRevision}=await response.json();
      orderNumber.value=settings.whatsapp;
      revision=loadedRevision;
      editor.replaceChildren(...menu.map(section));
      search.disabled=false;applySearch();
      dirty=false;status.textContent="Carte chargée. Vous pouvez modifier les prix et les noms, ou ajouter des articles et des sections.";
      addSection.disabled=false;
    } catch(error) { status.textContent=error.message; }
    finally { busy=false;save.disabled=!dirty; }
  }
  editor.addEventListener("input",setDirty);
  editor.addEventListener("change",setDirty);
  orderNumber.addEventListener("input",setDirty);
  editor.addEventListener("submit",event=>event.preventDefault());
  addSection.addEventListener("click",()=>{const node=section();editor.append(node);showAll();node.open=true;node.querySelector("input").focus();setDirty();});
  document.querySelector("#reload").addEventListener("click",()=>{if(!dirty||confirm("Recharger et abandonner les modifications non enregistrées ?")) load();});
  addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  save.addEventListener("click",async()=>{
    if(busy) return;
    if(!editor.checkValidity()) {
      showAll();
      const invalid=editor.querySelector(":invalid");
      if(invalid)invalid.closest(".admin-section").open=true;
      editor.reportValidity();return;
    }
    if(!orderNumber.reportValidity()) return;
    const expanded=[...editor.querySelectorAll(".admin-section")].map(section=>section.open);
    const menu=[...editor.querySelectorAll(".admin-section")].map(section=>{
      const fields=section.querySelector(".section-fields");
      const items=[...section.querySelectorAll(".admin-item")].map(row=>({
        id:row.dataset.id||undefined,
        fr:row.querySelector('[data-field="fr"]').value.trim(),
        ar:row.querySelector('[data-field="ar"]').value.trim(),
        price:row.querySelector('[data-field="price"]').value.trim(),
        available:row.querySelector('[data-field="available"]').checked,
        image:row.querySelector('[data-field="image"]').value
      }));
      return {fr:fields.querySelector('[data-field="fr"]').value.trim(),ar:fields.querySelector('[data-field="ar"]').value.trim(),items};
    });
    busy=true;save.disabled=true;addSection.disabled=true;editor.inert=true;orderNumber.disabled=true;status.textContent="Enregistrement…";
    try {
      const response=await fetch("/api/admin/menu",{method:"PUT",headers:{"Content-Type":"application/json","X-Menu-Editor":"1"},body:JSON.stringify({menu,settings:{whatsapp:orderNumber.value.trim()},revision})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"L’enregistrement a échoué.");
      revision=result.revision;
      if(result.menu){
        editor.replaceChildren(...result.menu.map(section));
        [...editor.querySelectorAll(".admin-section")].forEach((section,index)=>section.open=expanded[index]||false);
        applySearch();
      }
      dirty=false;status.textContent="Carte enregistrée. Les visiteurs verront les nouveaux prix et articles.";
    } catch(error) {status.textContent=error.message||"Connexion interrompue. Vos modifications sont conservées dans ce formulaire.";}
    finally {busy=false;save.disabled=!dirty;addSection.disabled=false;editor.inert=false;orderNumber.disabled=false;}
  });
  document.querySelector("#admin-logout").addEventListener("click",async()=>{
    if(dirty&&!confirm("Quitter sans enregistrer les modifications ?"))return;
    try{
      const response=await fetch("/api/admin/auth/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      if(!response.ok)throw new Error();
      dirty=false;window.location.assign("/admin/login");
    }catch{status.textContent="La déconnexion a échoué. Réessayez.";}
  });
  load();
})();

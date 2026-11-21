(() => {
  const search=document.querySelector("#menu-search");
  const list=document.querySelector("#menu-items");
  const status=document.querySelector("#menu-status");
  const orderStatus=document.querySelector("#order-status");
  const dialog=document.querySelector("#basket-dialog");
  const form=document.querySelector("#checkout-form");
  const basketRows=document.querySelector("#basket-items");
  const basketButton=document.querySelector("#basket-toggle");
  const checkoutStatus=document.querySelector("#checkout-status");
  const submit=document.querySelector("#checkout-submit");
  const money=value=>Number(value.replace(",","."));
  const format=cents=>(cents/100).toLocaleString(document.documentElement.lang==="ar"?"ar-MA":"fr-MA",{minimumFractionDigits:0,maximumFractionDigits:2})+text(" DH"," درهم");
  const cents=item=>Math.round(money(item.price)*100);
  const normalize=value=>value.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase();
  const language=()=>document.documentElement.lang==="ar"?"ar":"fr";
  const text=(fr,ar)=>language()==="ar"?ar:fr;
  let groups=[],settings={},failed=false,checking=false;
  const basket=new Map();
  try {
    const saved=JSON.parse(localStorage.getItem("dahab-basket")||"[]");
    if(Array.isArray(saved)) for(const [id,qty] of saved) if(typeof id==="string"&&Number.isInteger(qty)&&qty>0&&qty<=99) basket.set(id,qty);
  } catch {}
  function persist(){try{localStorage.setItem("dahab-basket",JSON.stringify([...basket]));}catch{}}
  function create(tag,className,content){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content)node.textContent=content;
    return node;
  }
  const allItems=()=>new Map(groups.flatMap(group=>group.items.map(item=>[item.id,item])));
  function change(item,delta){
    const quantity=Math.max(0,Math.min(99,(basket.get(item.id)||0)+delta));
    if(quantity)basket.set(item.id,quantity);else basket.delete(item.id);
    persist();renderBasket();
  }
  function control(item){
    const button=create("button","order-button",item.available===false?text("Épuisé","غير متوفر"):text("Ajouter","أضف"));
    button.type="button";button.disabled=item.available===false;
    button.setAttribute("aria-label",text("Ajouter "+item.fr+" au panier","أضف "+item.ar+" إلى السلة"));
    button.addEventListener("click",()=>{change(item,1);orderStatus.textContent=text(item.fr+" ajouté au panier.", "تمت إضافة "+item.ar+" إلى السلة.");});
    return button;
  }
  const photoDialog=create("dialog","photo-dialog");
  const photoClose=create("button","photo-close"),photoTitle=create("h2"),photoImage=create("img","photo-full"),photoNote=create("p","photo-note");
  photoTitle.id="photo-title";photoDialog.setAttribute("aria-labelledby","photo-title");
  photoImage.decoding="async";photoDialog.append(photoClose,photoTitle,photoImage,photoNote);document.body.append(photoDialog);
  let viewedItem=null;
  function updatePhotoText(){
    photoClose.textContent=text("Fermer","إغلاق");
    if(!viewedItem)return;
    photoTitle.textContent=viewedItem[language()];photoImage.alt=viewedItem[language()];
    photoNote.textContent=viewedItem.imageKind==="dahab"?text("Photo issue de la carte Dahab.","صورة من قائمة دَهَب."):text("Visuel indicatif : la présentation, les ingrédients visibles et le format peuvent varier. Consultez le nom de l’article avant de commander.","صورة توضيحية: قد يختلف التقديم والمكونات الظاهرة والحجم. راجع اسم المنتج قبل الطلب.");
  }
  function openPhoto(item){viewedItem=item;photoImage.src=item.image;updatePhotoText();photoDialog.showModal();}
  photoClose.addEventListener("click",()=>photoDialog.close());
  photoDialog.addEventListener("click",event=>{if(event.target===photoDialog)photoDialog.close();});
  document.addEventListener("languagechange",updatePhotoText);
  function renderMenu(){
    if(failed){status.textContent=text("La carte est temporairement indisponible. Rechargez la page.","القائمة غير متاحة مؤقتاً. أعد تحميل الصفحة.");return;}
    if(!groups.length)return;
    const opened=new Set([...list.querySelectorAll("details[open]")].map(node=>node.dataset.category));
    const first=!list.children.length;
    const query=normalize(search.value.trim());
    const fragment=document.createDocumentFragment();let found=0;
    for(const group of groups){
      const items=group.items.filter(item=>normalize(group.fr+" "+group.ar+" "+item.fr+" "+item.ar).includes(query));
      if(!items.length)continue;
      found+=items.length;
      const details=create("details","menu-category");details.dataset.category=group.fr;
      details.open=Boolean(query)||opened.has(group.fr)||(first&&group.fr==="Espresso");
      const summary=create("summary");summary.append(create("span","",group[language()]),create("span","category-count",String(items.length)));
      const rows=create("ul");
      for(const item of items){
        const row=create("li","menu-row");
        const info=create("span","item-info");
        const label=create("span","item-description");label.append(create("span","item-name",item[language()]));
        if(item.image){
          const photo=create("img","menu-thumb");photo.src=item.image;photo.alt=item[language()];photo.loading="lazy";photo.decoding="async";photo.width=96;photo.height=96;
          const view=create("button","product-photo");view.type="button";view.setAttribute("aria-label",text("Voir la photo de "+item.fr,"عرض صورة "+item.ar));view.append(photo);
          view.addEventListener("click",()=>openPhoto(item));info.append(view);
          label.append(create("small","photo-caption",item.imageKind==="dahab"?text("Photo Dahab","صورة دَهَب"):text("Visuel indicatif","صورة توضيحية")));
        }
        info.append(label);
        const price=create("span","item-price",format(cents(item)));price.dir="auto";
        row.append(info,price,control(item));rows.append(row);
      }
      details.append(summary,rows);fragment.append(details);
    }
    list.replaceChildren(fragment);
    status.textContent=found?text(found+" articles",found+" من المنتجات"):text("Aucun article trouvé.","لا توجد نتائج.");
    orderStatus.textContent=text("Ajoutez vos articles, puis envoyez votre panier sur WhatsApp.","أضف المنتجات ثم أرسل سلتك عبر واتساب.");
  }
  function renderBasket(){
    const items=allItems();let total=0,count=0;
    basketRows.replaceChildren();
    for(const [id,qty] of basket){
      const item=items.get(id);if(!item)continue;
      total+=cents(item)*qty;count+=qty;
      const row=create("li","basket-row");
      const controls=create("div","quantity-controls");
      const minus=create("button","","−"),plus=create("button","","+");
      minus.type=plus.type="button";
      minus.setAttribute("aria-label",text("Réduire la quantité de "+item.fr,"تقليل كمية "+item.ar));
      plus.setAttribute("aria-label",text("Augmenter la quantité de "+item.fr,"زيادة كمية "+item.ar));plus.disabled=qty>=99;
      minus.addEventListener("click",()=>change(item,-1));plus.addEventListener("click",()=>change(item,1));
      controls.append(minus,create("span","quantity",String(qty)),plus);
      row.append(create("span","",item[language()]),controls,create("span","",format(cents(item)*qty)));basketRows.append(row);
    }
    if(!count)basketRows.append(create("li","",text("Votre panier est vide.","سلتك فارغة.")));
    basketButton.textContent=text("Panier","السلة")+" · "+count+" · "+format(total);
    document.querySelector("#basket-title").textContent=text("Votre commande","طلبك");
    document.querySelector("#basket-close").textContent=text("Fermer","إغلاق");
    document.querySelector("#basket-total").textContent=text("Total des articles · ","مجموع المنتجات · ")+format(total);
    document.querySelector("#customer-label").textContent=text("Votre nom","اسمك");
    document.querySelector("#fulfillment-label").textContent=text("Comment récupérer la commande ?","كيف تريد استلام الطلب؟");
    document.querySelector("#pickup-label").textContent=text("À emporter","استلام من المقهى");
    document.querySelector("#delivery-label").textContent=text("Livraison","توصيل");
    document.querySelector("#address-label").textContent=text("Adresse de livraison","عنوان التوصيل");
    document.querySelector("#notes-label").textContent=text("Précisions (facultatif)","ملاحظات (اختياري)");
    document.querySelector("#checkout-note").textContent=text("Disponibilité, frais de livraison et délai à confirmer avec le café sur WhatsApp.","يؤكد المقهى التوفر ورسوم التوصيل والمدة عبر واتساب.");
    submit.textContent=text("Continuer sur WhatsApp","المتابعة عبر واتساب");submit.disabled=!count||checking;
  }
  async function refresh(){
    const response=await fetch("/api/order-data",{cache:"no-store"});
    if(!response.ok)throw new Error("Unavailable");
    const data=await response.json();groups=data.menu;settings=data.settings;
  }
  basketButton.addEventListener("click",()=>{checkoutStatus.textContent="";renderBasket();dialog.showModal();});
  document.querySelector("#basket-close").addEventListener("click",()=>dialog.close());
  form.addEventListener("change",()=>{
    const delivery=form.elements.fulfillment.value==="delivery";
    document.querySelector("#delivery-address").hidden=!delivery;form.elements.address.required=delivery;
  });
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(checking||!form.reportValidity())return;
    checking=true;submit.disabled=true;
    const before=allItems();
    try{
      await refresh();
      const current=allItems();let changed=false;
      for(const [id] of basket){
        const item=current.get(id);
        if(!item||item.available===false){basket.delete(id);changed=true;}
        else if(before.get(id)?.price!==item.price)changed=true;
      }
      persist();renderMenu();renderBasket();
      if(changed){checkoutStatus.textContent=text("La carte a changé. Vérifiez votre panier avant de continuer.","تغيرت القائمة. راجع السلة قبل المتابعة.");return;}
      if(!basket.size)return;
      if(!/^[1-9]\d{7,14}$/.test(settings.whatsapp))throw new Error("Number missing");
      let total=0;
      const lines=[text("Bonjour DAHAB Café, voici ma commande :","مرحباً دَهَب، هذا طلبي:")];
      for(const [id,qty] of basket){const item=current.get(id);const amount=cents(item)*qty;total+=amount;lines.push(qty+" × "+item[language()]+" — "+format(amount));}
      lines.push("",text("Total des articles : ","مجموع المنتجات: ")+format(total));
      lines.push(text("Nom : ","الاسم: ")+form.elements.customer.value.trim());
      const delivery=form.elements.fulfillment.value==="delivery";
      lines.push(delivery?text("Livraison","توصيل"):text("À emporter","استلام من المقهى"));
      if(delivery)lines.push(text("Adresse : ","العنوان: ")+form.elements.address.value.trim());
      if(form.elements.notes.value.trim())lines.push(text("Précisions : ","ملاحظات: ")+form.elements.notes.value.trim());
      lines.push(text("Merci de confirmer la disponibilité, le délai et les frais éventuels.","يرجى تأكيد التوفر والمدة وأي رسوم إضافية."));
      window.location.assign("https://wa.me/"+settings.whatsapp+"?text="+encodeURIComponent(lines.join("\n")));
    }catch{checkoutStatus.textContent=text("Impossible de vérifier la carte. Réessayez dans un instant.","تعذر التحقق من القائمة. حاول بعد قليل.");}
    finally{checking=false;renderBasket();}
  });
  search.addEventListener("input",renderMenu);
  document.addEventListener("languagechange",()=>{renderMenu();renderBasket();});
  refresh().then(()=>{
    const items=allItems();
    for(const [id] of basket)if(!items.has(id)||items.get(id).available===false)basket.delete(id);
    persist();search.disabled=false;basketButton.hidden=false;renderMenu();renderBasket();
  }).catch(()=>{failed=true;renderMenu();});
})();

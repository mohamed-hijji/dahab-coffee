(() => {
  const translations = {
    "Administration": "الإدارة", "L’Expérience": "التجربة", "La Carte": "القائمة", "Nos Boutiques": "فروعنا",
    "Trouver un café": "اعثر على مقهى", "CAFÉ · MAROC": "قهوة · المغرب",
    "Du premier filet d’espresso à la dernière gorgée.": "من أول قطرة إسبريسو إلى آخر رشفة.",
    "Suivre le café": "اكتشف تجربة القهوة", "L’EXTRACTION": "تحضير القهوة",
    "Le café": "القهوة", "prend vie.": "تنبض بالحياة.",
    "Un filet d’espresso, une tasse qui se remplit. L’arôme se révèle.": "ينساب الإسبريسو ويمتلئ الكوب، لتفوح رائحة القهوة.",
    "Jusqu’à la dernière goutte": "حتى آخر قطرة", "LA DÉGUSTATION": "لحظة التذوق",
    "La première": "أول", "gorgée.": "رشفة.",
    "Sous la crema dorée, un espresso à savourer.": "تحت الكريما الذهبية، إسبريسو يستحق التذوق.",
    "Découvrir la carte": "اكتشف القائمة", "LA CARTE DAHAB": "قائمة دَهَب",
    "À la carte.": "قائمتنا.", "Rechercher dans la carte": "ابحث في القائمة",
    "Le bouton Commander ouvre WhatsApp avec votre demande préremplie.": "زر الطلب يفتح واتساب مع تفاصيل طلبك جاهزة للإرسال.",
    "NOS BOUTIQUES": "فروعنا", "On se retrouve": "نلتقي",
    "chez Dahab.": "في دَهَب.",
    "Retrouvez Dahab Coffee à Tanger, Tétouan, Casablanca et dans d’autres villes du Maroc.": "اكتشف مقاهي دَهَب في طنجة وتطوان والدار البيضاء ومدن أخرى بالمغرب.",
    "Tous les points de vente": "جميع نقاط البيع", "À propos de Dahab": "عن دَهَب",
    "MAROC": "المغرب", "DAHAB COFFEE": "قهوة دَهَب",
    "Chargement de la carte…": "جارٍ تحميل القائمة…"
  };
  const textNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement.closest("script, style, #menu-items")) continue;
    const original = node.textContent;
    const key = original.trim();
    if (translations[key]) textNodes.push({ node, original, arabic: original.replace(key, translations[key]) });
  }
  const button = document.querySelector("#language-toggle");
  let language = "fr";
  try { language = localStorage.getItem("dahab-language") === "ar" ? "ar" : "fr"; } catch {}
  function apply() {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    for (const { node, original, arabic } of textNodes) node.textContent = language === "ar" ? arabic : original;
    button.textContent = language === "ar" ? "FR / AR" : "AR / FR";
    button.setAttribute("aria-label", language === "ar" ? "Passer en français" : "التبديل إلى العربية");
    document.querySelector("nav").setAttribute("aria-label", language === "ar" ? "القائمة الرئيسية" : "Navigation principale");
    document.querySelector(".story").setAttribute("aria-label", language === "ar" ? "تجربة دَهَب" : "L’expérience Dahab");
    document.querySelector(".site-header .brand").setAttribute("aria-label", language === "ar" ? "دَهَب، الصفحة الرئيسية" : "Dahab Coffee, accueil");
    document.querySelector("#menu-search").placeholder = language === "ar" ? "مثلاً كابتشينو، عسل، شاي" : "Ex. cappuccino, miel, chai";
    document.dispatchEvent(new Event("languagechange"));
    window.dispatchEvent(new Event("resize"));
  }
  button.addEventListener("click", () => {
    language = language === "fr" ? "ar" : "fr";
    try { localStorage.setItem("dahab-language", language); } catch {}
    apply();
  });
  apply();
})();

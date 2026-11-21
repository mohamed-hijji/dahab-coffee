(() => {
  const form=document.querySelector("#admin-login-form");
  const status=document.querySelector("#login-status");
  const setupLink=document.querySelector("#setup-link");
  const button=form.querySelector("button");
  const mode=form.dataset.mode;
  let busy=false;
  fetch("/api/admin/auth/status",{cache:"no-store"}).then(response=>response.json()).then(data=>{
    if(mode==="login"&&!data.configured){
      status.textContent="L’accès administrateur doit être créé par le propriétaire.";
      setupLink.hidden=!data.canSetup;button.disabled=true;
    }
    if(mode==="setup"&&data.configured){
      status.textContent="L’accès administrateur est déjà configuré. Connectez-vous avec votre identifiant.";
      form.hidden=true;
    }
  }).catch(()=>{status.textContent="Impossible de vérifier l’accès. Rechargez la page.";button.disabled=true;});
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    if(mode==="setup"&&form.elements.password.value!==form.elements.confirmation.value){status.textContent="Les mots de passe ne correspondent pas.";return;}
    busy=true;button.disabled=true;status.textContent=mode==="setup"?"Création de l’accès…":"Connexion…";
    try{
      const response=await fetch("/api/admin/auth/"+mode,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:form.elements.id.value.trim(),password:form.elements.password.value})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"La connexion a échoué.");
      form.reset();
      if(mode==="setup")window.location.assign("/admin/login");
      else window.location.assign("/admin");
    }catch(error){status.textContent=error.message;form.elements.password.value="";}
    finally{busy=false;button.disabled=false;}
  });
})();

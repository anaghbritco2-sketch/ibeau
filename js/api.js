/* Talks to the Google script. The password is sent only once, to log in;
   after that every request carries a temporary session code instead. */
const Session={
  get(){try{return JSON.parse(sessionStorage.getItem("ibeau_session")||"null");}catch(e){return null;}},
  set(o){try{sessionStorage.setItem("ibeau_session",JSON.stringify(o));}catch(e){}},
  clear(){try{sessionStorage.removeItem("ibeau_session");}catch(e){}}
};

/* api("students") , api("save",{...}) ... returns the parsed answer {ok:true,...} or {ok:false,error}
   Throws when the server cannot be reached. */
async function api(action,payload){
  if(!BACKUP_URL)throw new Error("not-configured");
  const s=Session.get()||{};
  const r=await fetch(BACKUP_URL,{method:"POST",
    body:JSON.stringify(Object.assign({action:action,session:s.session,batch:s.batch},payload||{}))});
  const j=await r.json();
  if(!j.ok&&j.error==="session"&&typeof Auth!=="undefined")Auth.expired();
  return j;
}

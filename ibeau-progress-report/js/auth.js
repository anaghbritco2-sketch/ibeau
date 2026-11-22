/* =========================================================
   Login  ->  select batch  ->  student list  ->  main form
   The password is checked by the Google script (Users sheet).
   This file only drives the screens.
   ========================================================= */
const Auth={session:"",email:"",batches:[],batch:"",
  persist(){Session.set({session:this.session,email:this.email,batches:this.batches,batch:this.batch});},
  expired(){
    Session.clear(); this.session=""; this.batch="";
    show("login");
    say("lgMsg","Your session has ended. Please log in again.","err");
  }
};

const SCREENS=["login","batchScreen","studentsScreen","app"];
function show(id){
  SCREENS.forEach(s=>{$(s).hidden=(s!==id);});
  window.scrollTo(0,0);
}
function say(id,text,kind){const e=$(id);e.textContent=text||"";e.className="msg"+(kind?" "+kind:"");}
const clone=o=>JSON.parse(JSON.stringify(o));
const netError="Could not reach the server. Check the internet connection and the link in js/config.js.";

/* ---------- 1. login ---------- */
$("lgShow").addEventListener("click",()=>{
  const p=$("lgPass"),on=p.type==="password";
  p.type=on?"text":"password"; $("lgShow").textContent=on?"Hide":"Show";
});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=$("lgEmail").value.trim(), password=$("lgPass").value;
  if(!email||!password){say("lgMsg","Enter your email and password.","err");return;}
  $("lgBtn").disabled=true; say("lgMsg","Checking …");
  try{
    const j=await api("login",{email,password});
    if(!j.ok){say("lgMsg",j.error||"Login failed.","err");return;}
    Auth.session=j.session; Auth.email=j.email; Auth.batches=j.batches; Auth.batch="";
    Auth.persist();
    $("lgPass").value=""; say("lgMsg","");
    showBatchScreen();
  }catch(err){
    say("lgMsg",err.message==="not-configured"?"Login is not set up yet - add the Google script link to js/config.js.":netError,"err");
  }finally{$("lgBtn").disabled=false;}
});

/* ---------- 2. batch ---------- */
function showBatchScreen(){
  $("bsUser").textContent="Logged in as "+Auth.email;
  const sel=$("bsSelect"); sel.innerHTML="";
  Auth.batches.forEach(b=>{const o=document.createElement("option");o.value=b;o.textContent=b;sel.appendChild(o);});
  let last=""; try{last=localStorage.getItem("ibeau_lastbatch")||"";}catch(e){}
  if(Auth.batches.indexOf(last)>=0)sel.value=last;
  say("bsMsg","");
  show("batchScreen");
}

$("bsGo").addEventListener("click",()=>{
  const b=$("bsSelect").value;
  if(!b){say("bsMsg","Select a batch.","err");return;}
  if(Auth.batch&&Auth.batch!==b)applyState(clone(INIT));   // a different batch starts with a clean form
  Auth.batch=b; Auth.persist();
  try{localStorage.setItem("ibeau_lastbatch",b);}catch(e){}
  showStudents();
});

/* ---------- 3. students of the batch ---------- */
let students=[];

async function showStudents(){
  show("studentsScreen");
  $("stTitle").textContent="Batch: "+Auth.batch;
  $("stSub").textContent="Logged in as "+Auth.email;
  $("stBody").innerHTML=""; $("stSearch").value="";

  // the student still on screen is saved before the list opens
  const sn=takeSnap();
  if(sn){say("stMsg","Saving "+sn.name+" …");try{await sendBackup(sn);}catch(e){}}

  say("stMsg","Loading students …");
  try{
    const j=await api("students");
    if(!j.ok){if(j.error!=="session")say("stMsg",j.error||"Could not load the students.","err");return;}
    students=j.students||[];
    say("stMsg",students.length?students.length+" student"+(students.length===1?"":"s")+" in this batch":"");
    drawStudents();
  }catch(err){say("stMsg",netError,"err");}
}

function drawStudents(){
  const q=$("stSearch").value.trim().toLowerCase();
  const body=$("stBody"); body.innerHTML="";
  const list=students.filter(s=>!q||s.name.toLowerCase().includes(q)||s.reg.toLowerCase().includes(q));
  if(!list.length){
    const tr=document.createElement("tr"),td=document.createElement("td");
    td.colSpan=6; td.className="empty";
    td.textContent=students.length?"No student matches your search.":"No students in this batch yet. Use \"+ New student\" to add one.";
    tr.appendChild(td); body.appendChild(tr); return;
  }
  list.forEach(s=>{
    const tr=document.createElement("tr");
    const cell=(t,cls)=>{const td=document.createElement("td");td.textContent=t||"";if(cls)td.className=cls;tr.appendChild(td);return td;};
    cell(s.reg); cell(s.name); cell(s.sph,"hide-sm"); cell(s.pph,"hide-sm");
    const st=cell(""); const b=document.createElement("span");
    b.className="badge "+(s.saved?"saved":"new"); b.textContent=s.saved?("Saved"+(s.result?" · "+s.result:"")):"New";
    st.appendChild(b);
    const op=cell("","open"); const btn=document.createElement("button");
    btn.type="button"; btn.textContent="Open"; op.appendChild(btn);
    tr.addEventListener("click",()=>openStudent(s));
    body.appendChild(tr);
  });
}
$("stSearch").addEventListener("input",drawStudents);

/* ---------- 4. main form ---------- */
function enterApp(){
  show("app");
  $("tbBatch").textContent="Batch: "+Auth.batch;
  $("tbUser").textContent=Auth.email;
}

async function openStudent(s){
  say("stMsg","Opening "+(s.name||s.reg)+" …");
  if(s.saved&&s.reg){
    try{
      const j=await api("lookup",{reg:s.reg});
      if(j.ok&&j.found){
        enterApp(); applyState(j.data.state||j.data);
        setBk("Loaded saved marks for "+($("name").value.trim()||s.reg)+".","#1a7f37");
        return;
      }
      if(!j.ok){if(j.error!=="session")say("stMsg",j.error||"Could not open the student.","err");return;}
    }catch(err){say("stMsg",netError,"err");return;}
  }
  // not saved yet: start a clean form with the details we already know
  enterApp(); applyState(clone(INIT));
  $("name").value=s.name||""; $("reg").value=s.reg||"";
  if(s.place)$("place").value=s.place;
  $("sph").value=s.sph||""; $("pph").value=s.pph||"";
  render();
  setBk("New student - enter the marks.");
}

$("stNew").addEventListener("click",()=>{
  enterApp(); applyState(clone(INIT)); setBk("Ready for a new student.");
});

/* ---------- navigation buttons ---------- */
async function logout(){
  try{ if(Session.get()){const sn=takeSnap(); if(sn&&$("app").hidden===false)await sendBackup(sn); await api("logout");} }catch(e){}
  Session.clear(); location.reload();
}
["bsLogout","stLogout","tbLogout"].forEach(id=>$(id).addEventListener("click",logout));
$("stBack").addEventListener("click",showBatchScreen);
$("tbChange").addEventListener("click",async()=>{
  const sn=takeSnap(); if(sn){try{await sendBackup(sn);}catch(e){}}   // saved in the batch it belongs to
  showBatchScreen();
});
$("tbList").addEventListener("click",showStudents);

/* ---------- start ---------- */
(function start(){
  if(!REQUIRE_LOGIN){show("app");return;}
  const s=Session.get();
  if(s&&s.session&&BACKUP_URL){
    Auth.session=s.session; Auth.email=s.email; Auth.batches=s.batches||[]; Auth.batch=s.batch||"";
    if(Auth.batch)showStudents(); else showBatchScreen();
    return;
  }
  show("login");
  if(!BACKUP_URL){
    say("lgMsg","Login is not set up yet - add the Google script link to js/config.js (see README.md).","err");
    $("lgBtn").disabled=true;
  }
})();

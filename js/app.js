/* Grade scale – edit here (minimum % : grade) */
const GRADES=[[90,"A+"],[80,"A"],[70,"B+"],[60,"B"],[50,"C"],[40,"D"],[0,"F"]];
const gradeOf=p=>(GRADES.find(g=>p>=g[0])||[0,"F"])[1];
const $=id=>document.getElementById(id);
const num=id=>parseFloat($(id).value)||0;
const has=id=>$(id).value.trim()!=="";
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate=v=>{if(!v)return"";const[y,m,d]=v.split("-");return`${d}/${m}/${y}`};
const nf=n=>Number(n).toLocaleString("en-US");

/* marks stored per module */
const data={
  1:{g:"",t:"100",a:"",s:"",f:"2026-08-05",e:"2026-08-30"},
  2:{g:"",t:"100",a:"",s:"",f:"2026-09-01",e:"2026-09-30"},
  3:{g:"",t:"100",a:"",s:"",f:"2026-10-01",e:""},
  4:{g:"",t:"3500",a:"",s:"",f:"",e:""}
};
const MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const dm=v=>{const[y,m,d]=v.split("-");return`${d} ${MON[+m-1]}`};
const dur=n=>{
  const{f,e}=data[n];
  if(!f&&!e)return"";
  if(f&&!e)return`${dm(f)} –  ${f.slice(0,4)}`;
  if(!f&&e)return`${dm(e)}  ${e.slice(0,4)}`;
  return f.slice(0,4)===e.slice(0,4)
    ?`${dm(f)} – ${dm(e)}  ${e.slice(0,4)}`
    :`${dm(f)} ${f.slice(0,4)} – ${dm(e)} ${e.slice(0,4)}`;
};
let cur=4;

$("date").value=new Date().toISOString().slice(0,10);

const attOf=n=>{
  const d=data[n];
  if(d.a===""&&d.s==="")return"";
  const A=parseFloat(d.a)||0,S=parseFloat(d.s)||0;
  return `${A} / ${S} (${S?Math.round(A/S*100):0}%)`;
};

function loadInputs(){
  $("total").value=data[cur].t; $("gained").value=data[cur].g;
  $("sa").value=data[cur].a;    $("st").value=data[cur].s;
  $("df").value=data[cur].f;    $("de").value=data[cur].e;
  /* Module 4: marks come from the three boxes below, so Gained is read-only */
  $("brkbox").style.display=cur===4?"block":"none";
  $("gained").readOnly=cur===4;
  $("glabel").textContent=cur===4?"Marks earned (auto total)":"Marks earned";
}
loadInputs();

/* total sessions = number of class days between start and end date (inclusive) */
function countSessions(f,e){
  if(!f||!e||e<f)return null;
  const days=[0,1,2,3,4,5,6].filter(i=>$("cd"+i).checked);
  const a=Date.UTC(...f.split("-").map((x,i)=>i===1?x-1:+x));
  const b=Date.UTC(...e.split("-").map((x,i)=>i===1?x-1:+x));
  let c=0;
  for(let t=a;t<=b;t+=86400000){ if(days.includes(new Date(t).getUTCDay()))c++; }
  return c;
}
function recalcSessions(onlyCur){
  for(const n of [1,2,3,4]){
    if(onlyCur&&n!==cur)continue;
    if(!onlyCur&&data[n].man)continue;
    const f=n===cur?$("df").value:data[n].f, e=n===cur?$("de").value:data[n].e;
    const c=countSessions(f,e);
    if(c===null)continue;
    data[n].s=String(c); data[n].man=false;
    if(n===cur)$("st").value=c;
  }
}
recalcSessions(false);
loadInputs();

function render(){
  /* Module 4: gained = Management + Assessment + Classroom */
  if(cur===4){
    const any=has("m1")||has("m2")||has("m3");
    $("gained").value=any?num("m1")+num("m2")+num("m3"):"";
    $("warn").style.display=(num("m1")>700||num("m2")>300||num("m3")>2500||num("rtc")>50)?"block":"none";
  }
  /* save what was typed for the selected module */
  data[cur].t=$("total").value;  data[cur].g=$("gained").value;
  data[cur].a=$("sa").value;     data[cur].s=$("st").value;
  data[cur].f=$("df").value;     data[cur].e=$("de").value;

  /* At a Glance + parent note use ONLY Module 4 (final) marks */
  const total=parseFloat(data[4].t)||1, gained=parseFloat(data[4].g)||0;
  const done=data[4].g!=="";
  const p=gained/total*100, g=done?gradeOf(p):"—", P=done?Math.round(p)+"%":"—";

  /* overall attendance = total of all modules (sessions come from each module's dates) */
  let oa=0,ot=0;
  for(const n of [1,2,3,4]){oa+=parseFloat(data[n].a)||0;ot+=parseFloat(data[n].s)||0;}
  const ap=ot?oa/ot*100:0;
  const male=$("gender").value==="m";
  const his=male?"His":"Her", him=male?"him":"her";
  /* note uses only the first name, e.g. "ALAN BIJESH" -> "Alan" */
  const first=$("name").value.trim().split(/\s+/)[0];
  const name=first?first.charAt(0).toUpperCase()+first.slice(1).toLowerCase():"The student";
  const place=esc($("place").value);
  document.title="Progress Report - "+($("name").value.trim()||"Student");

  /* marks cell for each module row */
  const mk=n=>{
    const d=data[n], T=parseFloat(d.t)||1;
    if(d.g==="")return n===4?`000 / ${nf(T)}`:"";
    const G=parseFloat(d.g)||0;
    return `${nf(G)} / ${nf(T)} • ${gradeOf(G/T*100)}`;
  };
  const mrow=n=>`<tr><td>Module ${n}</td><td>${dur(n)}</td><td class="c">${mk(n)}</td><td class="c">${attOf(n)}</td></tr>`;
  const row4=`<tr><td>Module 4 – Final</td><td>${dur(4)}</td><td class="c">${mk(4)}</td><td class="c">${attOf(4)||"00 / 00 (100%)"}</td></tr>`;

  /* final-module breakdown (module 4) */
  const T4=parseFloat(data[4].t)||1, G4=parseFloat(data[4].g)||0;
  const P4=Math.round(G4/T4*100), g4=gradeOf(G4/T4*100);
  const anyB=has("m1")||has("m2")||has("m3");
  const tot4=anyB?num("m1")+num("m2")+num("m3"):G4;
  const bv=(id,max,suffix)=>`${has(id)?nf(num(id)):"___"} / ${nf(max)}${suffix}`;
  const showB=cur===4||data[4].g!==""||has("rtc");
  const breakdown=showB?`
  <div class="h">RTC ASSESSMENT SCORE (50)</div>
  <table class="brk">
    <tr><th style="width:50%">ASSESSMENT AREA</th><th>SCORE</th></tr>
    <tr class="t"><td>RTC Assessment Score</td><td>${has("rtc")?nf(num("rtc")):"___"} / 50</td></tr>
  </table>

  <div class="h">FINAL MODULE – MARK BREAKDOWN</div>
  <table class="brk">
    <tr><th style="width:50%">ASSESSMENT AREA</th><th>MARKS</th></tr>
    <tr><td>Management</td><td>${bv("m1",700," (as recorded)")}</td></tr>
    <tr><td>Assessment</td><td>${bv("m2",300," (as recorded)")}</td></tr>
    <tr><td>Classroom points</td><td>${bv("m3",2500,"")}</td></tr>
    <tr class="t"><td>TOTAL</td><td>${nf(tot4)} / ${nf(T4)} • ${P4}% • Grade ${g4}</td></tr>
  </table>`:"";

  $("report").innerHTML=`
  <div class="head">
    <div class="co">IBEAU TECHNOLOGIES L.L.P</div>
    <div class="pl">${place}</div>
    <div class="ti">STUDENT PROGRESS REPORT</div>
    <div class="su">Academic performance • Module progress • Attendance</div>
  </div>

  <table class="info">
    <tr><td class="l">STUDENT NAME</td><td class="l">REGISTRATION NUMBER</td></tr>
    <tr><td class="v">${esc($("name").value)||'<span class="ph">Anagh P</span>'}</td><td class="v">${esc($("reg").value)||'<span class="ph">KDY/25/11/98</span>'}</td></tr>
    <tr><td class="l">PLACE</td><td class="l">REPORT PERIOD</td></tr>
    <tr><td class="v">${place}</td><td class="v">${fmtDate($("date").value)}</td></tr>
  </table>

  <div class="h">AT A GLANCE</div>
  <table class="glance">
    <tr><td class="big">${P}</td><td class="big">${g}</td><td class="big">${ap.toFixed(1)}%</td><td class="big">${done?nf(gained):"—"}</td></tr>
    <tr><td class="lb">FINAL SCORE</td><td class="lb">FINAL GRADE</td><td class="lb">ATTENDANCE</td><td class="lb">MARKS EARNED</td></tr>
    <tr><td class="sb">out of 100%</td><td class="sb">Overall result</td><td class="sb">${oa} of ${ot} sessions</td><td class="sb">out of ${nf(total)}</td></tr>
  </table>

  <div class="h">MODULE-WISE PERFORMANCE</div>
  <table class="mod">
    <tr><th style="width:17%">MODULE</th><th style="width:27%">DURATION</th><th style="width:26%">GRADE / MARKS</th><th>ATTENDANCE</th></tr>
    ${mrow(1)}${mrow(2)}${mrow(3)}${row4}
  </table>
  ${breakdown}

  <div class="note"><b>NOTE TO PARENT / GUARDIAN</b>
    ${esc(name)} has achieved an overall Grade ${g} with ${P} in the final module. ${his} attendance is ${ap.toFixed(1)}% (${oa} of ${ot} sessions). We encourage ${him} to maintain consistency and focus on regular attendance and continued improvement in practical and classroom performance.
  </div>
  <div class="thanks">We appreciate your support and cooperation in your child’s learning journey.</div>

  <div class="foot"><span>IBEAU TECHNOLOGIES L.L.P &nbsp;•&nbsp; ${place}</span><span>STUDENT PROGRESS REPORT</span></div>`;
}

/* switching module: load that module's saved marks into the boxes */
$("cur").addEventListener("change",()=>{
  cur=parseInt($("cur").value,10);
  loadInputs();
  render();
});
/* these run before render so the sessions box is updated first */
["df","de"].forEach(id=>$(id).addEventListener("input",()=>recalcSessions(true)));
$("st").addEventListener("input",()=>{data[cur].man=true;});
for(let i=0;i<7;i++)$("cd"+i).addEventListener("input",()=>recalcSessions(false));
document.querySelectorAll("input,select:not(#cur)").forEach(e=>e.addEventListener("input",render));

/* =================== GOOGLE DRIVE BACKUP =================== */

const setBk=(msg,color)=>{const b=$("bk");b.textContent=msg;b.style.color=color||"#5d6b7c";};

function getState(){
  const f={};
  document.querySelectorAll(".panel input:not([type=file]),.panel select").forEach(e=>{
    f[e.id]=e.type==="checkbox"?e.checked:e.value;
  });
  return {fields:f,data:JSON.parse(JSON.stringify(data)),cur};
}

function syncGender(){
  document.querySelectorAll("#genderSeg button").forEach(b=>b.classList.toggle("on",b.dataset.g===$("gender").value));
}
function setGender(v){ $("gender").value=v; syncGender(); render(); }

function applyState(st){
  for(const id in st.fields){
    const e=$(id); if(!e)continue;
    if(e.type==="checkbox")e.checked=!!st.fields[id]; else e.value=st.fields[id];
  }
  for(const n of [1,2,3,4])data[n]=st.data[n];
  cur=st.cur; $("cur").value=cur;
  syncGender(); loadInputs(); render();
}

/* exact picture of the report as a PDF (base64) */
async function makePdf(){
  if(typeof html2pdf==="undefined")return null;
  const host=document.createElement("div");
  host.style.cssText="position:fixed;left:-10000px;top:0;width:794px";
  const clone=$("report").cloneNode(true);
  clone.style.cssText+=";width:794px;max-width:794px;height:1123px;min-height:0;margin:0;box-shadow:none";
  clone.querySelectorAll(".ph").forEach(x=>x.style.visibility="hidden");
  host.appendChild(clone); document.body.appendChild(host);
  try{
    const uri=await html2pdf().set({margin:0,image:{type:"jpeg",quality:.95},
      html2canvas:{scale:2,useCORS:true},jsPDF:{unit:"mm",format:"a4"}})
      .from(clone).outputPdf("datauristring");
    return uri.split(",")[1];
  }finally{host.remove();}
}

async function sendBackup(snap){
  if(!BACKUP_URL){setBk("Backup is not set up yet – paste the Google script link into BACKUP_URL.","#b3261e");return;}
  setBk("Backing up "+snap.name+" …");
  try{
    const pdf=await snap.pdf;
    const j=await api("save",{name:snap.name,reg:snap.reg,pdf,state:snap.state,summary:snap.summary});
    j.ok?setBk("Saved to Google Drive: "+snap.name,"#1a7f37")
        :setBk("Backup failed: "+(j.error||"unknown error"),"#b3261e");
  }catch(err){
    setBk("Backup sent for "+snap.name+" but could not be confirmed – please check the Drive folder.","#b3261e");
  }
}

function takeSnap(){
  const nm=$("name").value.trim();
  if(!nm)return null;
  return {name:nm,reg:$("reg").value.trim(),state:getState(),summary:summary(),pdf:makePdf().catch(()=>null)};
}

/* automatic: when the student name is changed, the previous student is saved */
let snap=null;
$("name").addEventListener("focus",()=>{snap=takeSnap();});
$("name").addEventListener("change",()=>{
  if(snap&&snap.name!==$("name").value.trim()){const s=snap;snap=null;sendBackup(s);}
});

/* =================== SHARE RESULT =================== */
const setSh=(m,c)=>{const e=$("sh");e.textContent=m;e.style.color=c||"#5d6b7c";};

/* Module 4 (final) result + total attendance of all modules */
function summary(){
  const T=parseFloat(data[4].t)||1, G=parseFloat(data[4].g)||0, done=data[4].g!=="";
  let oa=0,ot=0;
  for(const n of [1,2,3,4]){oa+=parseFloat(data[n].a)||0;ot+=parseFloat(data[n].s)||0;}
  return {done,T,G,P:Math.round(G/T*100),g:gradeOf(G/T*100),oa,ot,ap:ot?oa/ot*100:0};
}

/* 10-digit Indian numbers get +91; numbers typed with a country code are kept */
function cleanPhone(v){
  const d=String(v).replace(/\D/g,"");
  if(d.length===10)return "91"+d;
  if(d.length===11&&d[0]==="0")return "91"+d.slice(1);
  return d.length>=11&&d.length<=15?d:"";
}

function shareText(who,link){
  const s=summary(), nm=$("name").value.trim(), reg=$("reg").value.trim();
  const f=nm.split(/\s+/)[0], first=f.charAt(0).toUpperCase()+f.slice(1).toLowerCase();
  return [
    who==="parent"?"Dear Parent/Guardian,":`Dear ${first},`,
    `Progress report of ${nm}${reg?` (${reg})`:""} – IBEAU TECHNOLOGIES L.L.P, ${$("place").value}`,
    `Final module result: ${s.P}% • Grade ${s.g}`,
    `Marks earned: ${nf(s.G)} / ${nf(s.T)}`,
    `Attendance: ${s.ap.toFixed(1)}% (${s.oa} of ${s.ot} sessions)`,
    `Report date: ${fmtDate($("date").value)}`,
    ...(link?[`Full report (PDF): ${link}`]:[]),
    "Thank you for your support."
  ].join("\n");
}

/* WhatsApp: opens wa.me/<number> with the result and a link to the PDF report */
async function shareResult(who){
  if(!$("name").value.trim()){setSh("Enter the student name first.","#b3261e");return;}
  if(!summary().done){setSh("Enter the Module 4 (final) marks first.","#b3261e");return;}
  const ph=cleanPhone($(who==="parent"?"pph":"sph").value);
  if(!ph){setSh(`Enter a valid ${who==="parent"?"parent / guardian":"student"} phone number.`,"#b3261e");return;}

  const win=window.open("about:blank","_blank");   // opened now, filled in below, so the browser does not block it
  setSh("Preparing the report link …");

  /* 1. put the PDF in the cloud and get a link to it */
  let link="",note="";
  if(BACKUP_URL&&Session.get()){
    try{
      const pdf=await makePdf();
      if(!pdf)note="the PDF could not be made (it needs internet)";
      else{
        const j=await api("share",{name:$("name").value.trim(),reg:$("reg").value.trim(),pdf});
        if(j.ok)link=j.url;
        else if(j.error==="session"){if(win)win.close();return;}
        else note=j.error||"the PDF link could not be created";
      }
    }catch(err){note="the cloud could not be reached";}
  }else note="the cloud is not connected";

  /* 2. open WhatsApp (wa.me) for that number */
  const url=`https://wa.me/${ph}?text=${encodeURIComponent(shareText(who,link))}`;
  const msg=link?`WhatsApp is ready for the ${who} - check the message and press send.`
                :`WhatsApp is ready, but without the PDF link (${note}). The result text is included.`;
  if(win&&!win.closed){win.location.href=url;setSh(msg,link?"#1a7f37":"#b3261e");}
  else{
    // the browser blocked the new window: give a link to tap instead
    const e=$("sh"); e.style.color="#1a7f37"; e.textContent=""; 
    const a=document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener";
    a.textContent="Tap here to open WhatsApp for the "+who; a.style.fontWeight="700";
    e.appendChild(a);
  }
}

/* =================== FIND SAVED MARKS BY REGISTER NUMBER =================== */
async function lookupReg(reg){
  if(!BACKUP_URL){lk("Cloud is not set up yet – paste the Google script link into BACKUP_URL.","#b3261e");return false;}
  lk("Looking for "+reg+" …");
  try{
    const j=await api("lookup",{reg});
    if(!j.ok){lk("Lookup failed: "+(j.error||"unknown error"),"#b3261e");return false;}
    if(!j.found){lk("No saved marks for "+reg+" – it will be saved as a new student.");return false;}
    applyState(j.data.state||j.data);
    const by=j.data.savedBy?" by "+j.data.savedBy:"";
    lk(`Loaded saved marks for ${$("name").value.trim()||reg} (last saved ${new Date(j.savedAt).toLocaleDateString("en-GB")}${by}).`,"#1a7f37");
    return true;
  }catch(err){
    lk("Could not reach the cloud – check internet and the BACKUP_URL.","#b3261e");
    return false;
  }
}


let lookMsg={t:"",c:"#5d6b7c"};
const lk=(t,c)=>{lookMsg={t,c:c||"#5d6b7c"};setBk(t,c);};

/* "Find saved marks" opens a small search window for the register number */
let snapM=null;
function findSaved(){
  snapM=takeSnap();                       // the student on screen, saved first if another one is opened
  $("searchReg").value=""; $("searchMsg").textContent="";
  $("finder").style.display="flex";
  setTimeout(()=>$("searchReg").focus(),50);
}
function closeFinder(){$("finder").style.display="none";}
async function runSearch(){
  const reg=$("searchReg").value.trim(), m=$("searchMsg");
  if(!reg){m.style.color="#b3261e";m.textContent="Enter the registration number to search.";return;}
  if(snapM&&snapM.reg!==reg&&BACKUP_URL)sendBackup(snapM);
  snapM=null;
  m.style.color="#5d6b7c"; m.textContent="Searching …";
  const ok=await lookupReg(reg);
  m.style.color=lookMsg.c; m.textContent=lookMsg.t;
  if(ok)setTimeout(closeFinder,900);
}
$("searchGo").addEventListener("click",runSearch);
$("searchCancel").addEventListener("click",closeFinder);
$("searchReg").addEventListener("keydown",e=>{if(e.key==="Enter")runSearch();});
$("finder").addEventListener("click",e=>{if(e.target.id==="finder")closeFinder();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("finder").style.display==="flex")closeFinder();});

/* clear the form for the next student (the current one is saved first) */
const INIT=JSON.parse(JSON.stringify(getState()));
function newStudent(){
  const sn=takeSnap();
  if(sn&&BACKUP_URL)sendBackup(sn);
  applyState(JSON.parse(JSON.stringify(INIT)));
  setBk("Ready for a new student.");
}

render();

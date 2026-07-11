import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig={
 apiKey:"AIzaSyAKlkNp8YuJ4yL9B2AkDGymjS82re253OQ",
 authDomain:"xe-tester-analytics.firebaseapp.com",
 projectId:"xe-tester-analytics",
 storageBucket:"xe-tester-analytics.firebasestorage.app",
 messagingSenderId:"223479280184",
 appId:"1:223479280184:web:bc4b66eb2bebca17682ccd"
};

const app=initializeApp(firebaseConfig,"xe-telemetry");
const auth=getAuth(app),db=getFirestore(app);
let uid="",country="Desconocido",ready=false;

async function resolveCountry(){
 try{
  const r=await fetch("https://ipwho.is/");
  const j=await r.json();
  if(j?.success&&j?.country) country=String(j.country).slice(0,80);
 }catch(_){}
}
async function emit(event,model="XE TESTER"){
 if(!ready||!uid)return;
 try{
  await addDoc(collection(db,"events"),{uid,event,model,country,createdAt:serverTimestamp()});
 }catch(e){console.warn("XE Analytics:",e.code||e.message)}
}
function text(id){return (document.getElementById(id)?.textContent||"").trim().toUpperCase()}

// Cada evento se registra una vez por CICLO real. Cuando la interfaz sale del
// estado final, el seguro se rearma para permitir contar el siguiente ciclo.
const cycle={
 x17Test:false,x17Cal:false,x17Error:false,
 xbTest:false,xbCal:false,xbError:false,
 standardTest:false
};
function edge(key,active,event,model){
 if(active&&!cycle[key]){
  cycle[key]=true; // bloquear antes del await para evitar duplicados del MutationObserver
  emit(event,model);
 }else if(!active){
  cycle[key]=false;
 }
}
function scan(){
 edge("x17Test",text("x17Phase")==="TEST COMPLETO","test_completed","Xbox One 1708");
 edge("x17Cal",text("x17CalPct").includes("CALIBRACIÓN COMPLETA"),"calibration_completed","Xbox One 1708");
 edge("x17Error",text("x17State")==="ERROR"&&text("x17CalText").includes("ERROR"),"calibration_error","Xbox One 1708");

 edge("xbTest",text("xbPhase")==="TEST COMPLETO","test_completed","Xbox Series 1914");
 edge("xbCal",text("xbCalPct").includes("CALIBRACIÓN COMPLETA"),"calibration_completed","Xbox Series 1914");
 edge("xbError",text("xbState")==="ERROR"&&text("xbCalText").includes("ERROR"),"calibration_error","Xbox Series 1914");

 const result=document.getElementById("result");
 edge("standardTest",!!result&&!result.classList.contains("hidden"),"test_completed","Control estándar / PlayStation");
}
function watch(){
 const observer=new MutationObserver(scan);
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
 scan();
}
(async()=>{
 try{
  const cred=await signInAnonymously(auth);uid=cred.user.uid;
  await resolveCountry();ready=true;

  // Una visita por carga real de la página. Firestore conserva el histórico.
  await emit("page_visit","XE TESTER CONTROLLER LAB");

  watch();
  console.info("XE Analytics online");
 }catch(e){console.warn("XE Analytics offline:",e.code||e.message)}
})();

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
const sent=new Set();

async function resolveCountry(){
 try{
  const r=await fetch("https://ipwho.is/");
  const j=await r.json();
  if(j?.success&&j?.country) country=String(j.country).slice(0,80);
 }catch(_){}
}
async function emit(event,model="XE TESTER"){
 if(!ready||!uid)return;
 const key=event+"|"+model;
 if(sent.has(key)&&event!=="calibration_error")return;
 try{
  await addDoc(collection(db,"events"),{uid,event,model,country,createdAt:serverTimestamp()});
  sent.add(key);
 }catch(e){console.warn("XE Analytics:",e.code||e.message)}
}
function text(id){return (document.getElementById(id)?.textContent||"").trim().toUpperCase()}
function watch(){
 const observer=new MutationObserver(()=>{
  if(text("x17Phase")==="TEST COMPLETO")emit("test_completed","Xbox One 1708");
  if(text("x17CalPct").includes("CALIBRACIÓN COMPLETA"))emit("calibration_completed","Xbox One 1708");
  if(text("x17State")==="ERROR"&&text("x17CalText").includes("ERROR"))emit("calibration_error","Xbox One 1708");

  if(text("xbPhase")==="TEST COMPLETO")emit("test_completed","Xbox Series 1914");
  if(text("xbCalPct").includes("CALIBRACIÓN COMPLETA"))emit("calibration_completed","Xbox Series 1914");
  if(text("xbState")==="ERROR"&&text("xbCalText").includes("ERROR"))emit("calibration_error","Xbox Series 1914");

  const result=document.getElementById("result");
  if(result&&!result.classList.contains("hidden"))emit("test_completed","Control estándar / PlayStation");
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
}
(async()=>{
 try{
  const cred=await signInAnonymously(auth);uid=cred.user.uid;
  await resolveCountry();ready=true;
  if(!sessionStorage.getItem("xe_page_visit")){
   await emit("page_visit","XE TESTER CONTROLLER LAB");
   sessionStorage.setItem("xe_page_visit","1");
  }
  watch();
  console.info("XE Analytics online");
 }catch(e){console.warn("XE Analytics offline:",e.code||e.message)}
})();
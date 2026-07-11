/* Xbox One 1708: DriftGuard integration only. XE never sends calibration USB commands. */
class XE1708Lab {
  constructor(){ this.s=this.fresh(); this.awaitingReconnect=false; this.testing=false; this.lastPad=null; this.bind(); this.configureAssistant(); this.watchPads(); }
  $(id){ return document.getElementById(id); }
  fresh(){ return {lx:0,ly:0,rx:0,ry:0,lt:0,rt:0,lmax:0,rmax:0,ld:[],rd:[],lAngle:null,rAngle:null,lTravel:0,rTravel:0,turnStage:"ls"}; }
  bind(){
    this.$("x17Connect").onclick=()=>this.beginReconnectWatch();
    this.$("x17Test").onclick=()=>this.startTest();
    this.$("x17Calibrate").onclick=()=>this.openDriftGuard();
    this.$("x17CalGo").onclick=()=>this.finishDriftGuard();
    this.$("x17Pdf").onclick=()=>this.pdf();
  }
  configureAssistant(){
    document.title="XE Controller Lab Pro v2";
    this.$("x17Connect").textContent="1 · ESPERAR RECONEXIÓN";
    this.$("x17Test").textContent="4 · TEST DE CIRCULARIDAD";
    this.$("x17Calibrate").textContent="2 · ABRIR DRIFTGUARD";
    this.$("x17CalGo").textContent="3 · HE TERMINADO LA CALIBRACIÓN";
    this.$("x17RestoreDownload").classList.add("hidden");
    this.$("x17CalBox").classList.remove("hidden");
    this.$("x17CalText").textContent="La calibración pertenece a DriftGuard. XE Controller Lab Pro únicamente integra el flujo y verifica la circularidad final.";
    this.$("x17CalPct").textContent="PASO 1 · ABRE DRIFTGUARD";
    this.$("x17State").textContent="ASISTENTE";
    this.$("x17Phase").textContent="DRIFTGUARD";
    this.$("x17Instruction").textContent="Abre DriftGuard y completa allí la calibración del Xbox One 1708.";
    this.log("Asistente DriftGuard 1708 listo. No se enviarán comandos de calibración desde XE.");
  }
  log(message){ const e=this.$("x17Log"); e.textContent += "\n"+new Date().toLocaleTimeString("es-MX")+" · "+message; e.scrollTop=e.scrollHeight; }
  openDriftGuard(){ window.open("https://driftguard.app/#dashboard","_blank","noopener"); this.$("x17CalPct").textContent="DRIFTGUARD ABIERTO · COMPLETA LA CALIBRACIÓN ALLÍ"; this.$("x17CalGo").focus(); this.log("DriftGuard abierto en una nueva pestaña."); }
  finishDriftGuard(){
    this.awaitingReconnect=true; this.testing=false;
    this.$("x17State").textContent="RESTAURANDO DRIVER"; this.$("x17Phase").textContent="DRIVER XBOX";
    this.$("x17CalText").textContent="Se descargó el restaurador de Xbox. Ejecútalo como administrador; XE esperará la reconexión y comenzará el test de circularidad.";
    this.$("x17CalPct").textContent="RESTAURAR DRIVER · ESPERANDO CONTROL";
    this.$("x17Instruction").textContent="Ejecuta RESTAURAR-XBOX-1708.bat como administrador y reconecta el control cuando termine.";
    this.downloadRestore(); this.log("Calibración DriftGuard confirmada. Restaurador 1708 descargado; esperando reconexión con driver Xbox.");
  }
  downloadRestore(){ const a=document.createElement("a"); a.href="XE-Driver-Restore-1708.zip"; a.download="XE-Driver-Restore-1708.zip"; document.body.appendChild(a); a.click(); a.remove(); }
  beginReconnectWatch(){ this.awaitingReconnect=true; this.$("x17State").textContent="ESPERANDO"; this.$("x17Phase").textContent="RECONEXIÓN"; this.$("x17Instruction").textContent="Esperando Xbox One 1708 con el driver Xbox restaurado…"; this.log("Monitor de reconexión iniciado."); }
  watchPads(){ const tick=()=>{ const p=[...navigator.getGamepads?.()||[]].find(x=>x && /xbox/i.test(x.id)); if(p){ this.lastPad=p; if(this.awaitingReconnect){ this.awaitingReconnect=false; this.$("x17State").textContent="RECONECTADO"; this.$("x17Phase").textContent="LISTO PARA TEST"; this.$("x17Instruction").textContent="Control detectado con driver Xbox. Iniciando test de circularidad."; this.$("x17Test").disabled=false; this.log("1708 reconectado por Gamepad API. Test de circularidad iniciado."); this.startTest(); } this.read(p); } requestAnimationFrame(tick); }; tick(); }
  read(p){ const a=p.axes||[], s=this.s; s.lx=a[0]||0; s.ly=a[1]||0; s.rx=a[2]||0; s.ry=a[3]||0; s.lt=(p.buttons[6]?.value||0); s.rt=(p.buttons[7]?.value||0); const lr=Math.hypot(s.lx,s.ly),rr=Math.hypot(s.rx,s.ry); s.lmax=Math.max(s.lmax,lr); s.rmax=Math.max(s.rmax,rr); if(lr<.22)s.ld.push(lr); if(rr<.22)s.rd.push(rr); if(s.ld.length>500)s.ld.shift(); if(s.rd.length>500)s.rd.shift(); if(this.testing){ this.track("l",s.lx,s.ly,lr); this.track("r",s.rx,s.ry,rr); } this.render(); }
  track(side,x,y,r){ const s=this.s; if((s.turnStage==="ls"&&side!=="l")||(s.turnStage==="rs"&&side!=="r"))return; const ak=side==="l"?"lAngle":"rAngle", tk=side==="l"?"lTravel":"rTravel"; if(r>.55){ const angle=Math.atan2(y,x), prev=s[ak]; if(prev!==null){ let d=angle-prev; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; if(Math.abs(d)>.01&&Math.abs(d)<.65)s[tk]+=Math.abs(d); } s[ak]=angle; } else if(r<.25)s[ak]=null; if(side==="l"&&s.lTravel>=Math.PI*2){ s.turnStage="rs"; s.rAngle=null; this.log("Circularidad LS completada; continúa con RS."); } }
  draw(id,x,y){ const c=this.$(id),g=c.getContext("2d"),w=c.width,h=c.height; g.clearRect(0,0,w,h); g.strokeStyle="#00e5ff"; g.lineWidth=2; g.beginPath();g.arc(w/2,h/2,w*.40,0,Math.PI*2);g.stroke();g.strokeStyle="#52616a";g.beginPath();g.moveTo(w/2,20);g.lineTo(w/2,h-20);g.moveTo(20,h/2);g.lineTo(w-20,h/2);g.stroke();g.fillStyle="#d9e2e8";g.beginPath();g.arc(w/2+x*w*.40,h/2-y*h*.40,7,0,Math.PI*2);g.fill(); }
  render(){ const s=this.s, lp=Math.round(Math.min(100,s.lTravel/(Math.PI*2)*100)),rp=Math.round(Math.min(100,s.rTravel/(Math.PI*2)*100)); this.draw("x17LS",s.lx,s.ly);this.draw("x17RS",s.rx,s.ry); this.$("x17LSVal").textContent=`${s.lx.toFixed(3)} / ${s.ly.toFixed(3)}`;this.$("x17RSVal").textContent=`${s.rx.toFixed(3)} / ${s.ry.toFixed(3)}`;this.$("x17LRange").textContent=Math.min(100,s.lmax*100).toFixed(0)+"%";this.$("x17RRange").textContent=Math.min(100,s.rmax*100).toFixed(0)+"%";this.$("x17LSMetric").textContent=`Drift ${(this.avg(s.ld)*100).toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}%`;this.$("x17RSMetric").textContent=`Drift ${(this.avg(s.rd)*100).toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}%`;this.$("x17LTPct").textContent=Math.round(s.lt*100)+"%";this.$("x17RTPct").textContent=Math.round(s.rt*100)+"%";this.$("x17LTBar").style.width=Math.min(100,s.lt*100)+"%";this.$("x17RTBar").style.width=Math.min(100,s.rt*100)+"%"; if(this.testing){ this.$("x17Progress").textContent=s.turnStage==="ls"?`GIRA LS POR EL BORDE · ${lp}%`:`LS 100% · AHORA GIRA RS · ${rp}%`; if(lp>=100&&rp>=100)this.finishTest(); } }
  startTest(){ if(!this.lastPad){ this.beginReconnectWatch(); return; } this.s=this.fresh();this.testing=true;this.$("x17State").textContent="TEST";this.$("x17Phase").textContent="CIRCULARIDAD";this.$("x17Instruction").textContent="Gira LS por todo el borde; al 100% continuará con RS.";this.$("x17Progress").textContent="GIRA LS POR EL BORDE · 0%";this.log("Test de circularidad 1708 iniciado."); }
  avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0} score(){const s=this.s,d=(this.avg(s.ld)+this.avg(s.rd))*50,r=(Math.min(1,s.lmax)+Math.min(1,s.rmax))/2;return Math.max(0,Math.min(100,Math.round(100-d*1.8-(1-r)*35)))}
  finishTest(){ if(!this.testing)return; this.testing=false;const score=this.score();this.$("x17Score").textContent=score+"/100";this.$("x17State").textContent="COMPLETO";this.$("x17Phase").textContent="TEST COMPLETO";this.$("x17Instruction").textContent=`Circularidad completada · XE Score ${score}/100.`;this.$("x17Pdf").disabled=false;this.log("Test de circularidad completado."); }
  pdf(){ window.print(); }
}
window.addEventListener("DOMContentLoaded",()=>{
  document.querySelector(".xe-video-tutorial")?.remove();
  window.xe1708=new XE1708Lab();
});

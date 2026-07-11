/* Xbox One 1708: DriftGuard integration only. XE never sends calibration USB commands. */
class XE1708Lab {
  constructor(){
    this.reset(); this.testing=false; this.lastPad=null; this.reconnectTimer=null; this.reconnectDeadline=0;
    this.bind(); this.configureAssistant(); this.createModal(); this.observeGamepads();
  }
  $(id){ return document.getElementById(id); }
  reset(){ this.s={lx:0,ly:0,rx:0,ry:0,lt:0,rt:0,lmax:0,rmax:0,ld:[],rd:[],lAngle:null,rAngle:null,lTravel:0,rTravel:0,turnStage:"ls"}; }
  bind(){
    this.$("x17Connect").onclick=()=>this.waitForReconnection();
    this.$("x17Test").onclick=()=>this.startTest();
    this.$("x17Calibrate").onclick=()=>this.showAssistant();
    this.$("x17CalGo").onclick=()=>this.showAssistant();
    this.$("x17Pdf").onclick=()=>this.pdf();
    this.$("open1708Recal")?.addEventListener("click",()=>this.showAssistant());
    window.addEventListener("gamepadconnected",event=>this.onGamepad(event.gamepad));
  }
  configureAssistant(){
    document.title="XE Controller Lab Pro v2";
    this.$("x17Connect").textContent="ESPERAR RECONEXIÓN";
    this.$("x17Test").textContent="TEST DE CIRCULARIDAD";
    this.$("x17Calibrate").textContent="ABRIR ASISTENTE DRIFTGUARD";
    this.$("x17CalGo").textContent="ABRIR ASISTENTE DRIFTGUARD";
    this.$("x17CalBox").classList.add("hidden");
    this.$("x17RestoreDownload").classList.add("hidden");
    this.$("x17State").textContent="ASISTENTE";
    this.$("x17Phase").textContent="DRIFTGUARD";
    this.$("x17Instruction").textContent="Abre el asistente DriftGuard para calibrar el Xbox One 1708.";
    this.log("Asistente DriftGuard 1708 listo. XE no enviará comandos de calibración.");
  }
  createModal(){
    const modal=document.createElement("section"); modal.id="x17DriftGuardModal"; modal.className="x17Modal hidden"; modal.setAttribute("role","dialog"); modal.setAttribute("aria-modal","true");
    modal.innerHTML=`<div class="x17ModalGlass"><button class="x17ModalClose" type="button" aria-label="Cerrar">×</button><div class="x17ModalMark">XO</div><p class="x17ModalKicker">XE CONTROLLER LAB PRO · 1708</p><h2>Calibración Xbox One 1708</h2><p class="x17ModalCopy">La calibración del Xbox One 1708 es realizada mediante DriftGuard.</p><p class="x17ModalCopy">El algoritmo de calibración, guardado y todos los derechos pertenecen a los desarrolladores de DriftGuard.</p><p class="x17ModalCopy x17ModalCopyMuted">XE Controller Lab Pro únicamente integra el flujo y realiza las pruebas posteriores.</p><div class="x17ModalSteps" id="x17ModalSteps"><span class="active">1 · DriftGuard</span><i></i><span>2 · Driver Xbox</span><i></i><span>3 · Circularidad</span></div><div class="x17ModalActions"><button id="x17OpenDriftGuard" type="button">Abrir DriftGuard</button><button id="x17FinishedDriftGuard" type="button">✓ He terminado la calibración</button></div><div class="x17ModalStatus" id="x17ModalStatus" aria-live="polite">Completa la calibración en DriftGuard y vuelve a esta ventana.</div><button class="x17ModalRetry hidden" id="x17ReconnectRetry" type="button">Reintentar</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".x17ModalClose").onclick=()=>this.closeAssistant();
    this.$("x17OpenDriftGuard").onclick=()=>this.openDriftGuard();
    this.$("x17FinishedDriftGuard").onclick=()=>this.finishDriftGuard();
    this.$("x17ReconnectRetry").onclick=()=>this.waitForReconnection();
  }
  showAssistant(){ this.$("x17DriftGuardModal").classList.remove("hidden"); this.$("x17OpenDriftGuard").focus(); }
  closeAssistant(){ if(!this.reconnectTimer)this.$("x17DriftGuardModal").classList.add("hidden"); }
  modalStatus(message,failed=false){ this.$("x17ModalStatus").textContent=message; this.$("x17ModalStatus").classList.toggle("error",failed); }
  setModalStep(step){ this.$("x17ModalSteps").querySelectorAll("span").forEach((el,index)=>el.classList.toggle("active",index<=step)); }
  log(message){ const e=this.$("x17Log"); e.textContent += "\n"+new Date().toLocaleTimeString("es-MX")+" · "+message; e.scrollTop=e.scrollHeight; }
  openDriftGuard(){ window.open("https://driftguard.app/#dashboard","driftguard1708","popup=yes,width=1180,height=840,left=120,top=80"); this.modalStatus("DriftGuard se abrió en una ventana nueva. Completa la calibración allí."); this.log("DriftGuard abierto para el 1708."); }
  finishDriftGuard(){
    this.downloadRestore(); this.setModalStep(1);
    this.$("x17State").textContent="RESTAURANDO DRIVER"; this.$("x17Phase").textContent="DRIVER XBOX";
    this.$("x17Instruction").textContent="Restaura el driver Xbox y reconecta el control. La detección tiene un límite de 20 segundos.";
    this.modalStatus("Ejecuta RESTAURAR-XBOX-1708.bat como administrador. Al reconectar, XE iniciará automáticamente el test de circularidad.");
    this.log("DriftGuard confirmado. Restaurador 1708 descargado y detección limitada iniciada."); this.waitForReconnection();
  }
  downloadRestore(){ const a=document.createElement("a"); a.href="XE-Driver-Restore-1708.zip"; a.download="XE-Driver-Restore-1708.zip"; document.body.appendChild(a); a.click(); a.remove(); }
  is1708(p){ const id=String(p?.id||"").toLowerCase(); return /045e[\s\S]*02ea|02ea[\s\S]*045e/.test(id); }
  current1708(){ return Array.from(navigator.getGamepads?.()||[]).find(p=>p&&this.is1708(p))||null; }
  waitForReconnection(){
    this.stopReconnectWait(); this.$("x17ReconnectRetry").classList.add("hidden"); this.reconnectDeadline=Date.now()+20000;
    this.$("x17State").textContent="DETECTANDO"; this.$("x17Phase").textContent="RECONEXIÓN · 20 S";
    this.modalStatus("Esperando que Windows detecte nuevamente el Xbox One 1708…");
    const check=()=>{ const pad=this.current1708(); if(pad){ this.onGamepad(pad); return; } if(Date.now()>=this.reconnectDeadline){ this.stopReconnectWait(); this.$("x17State").textContent="NO DETECTADO"; this.$("x17Phase").textContent="REINTENTAR"; this.$("x17Instruction").textContent="No fue posible detectar nuevamente el control."; this.modalStatus("No fue posible detectar nuevamente el control",true); this.$("x17ReconnectRetry").classList.remove("hidden"); this.log("Tiempo de reconexión agotado sin detectar 045E:02EA."); } };
    check(); if(this.reconnectDeadline&&!this.reconnectTimer)this.reconnectTimer=window.setInterval(check,250);
  }
  stopReconnectWait(){ if(this.reconnectTimer){ window.clearInterval(this.reconnectTimer); this.reconnectTimer=null; } this.reconnectDeadline=0; }
  observeGamepads(){ const pad=this.current1708(); if(pad)this.onGamepad(pad); }
  onGamepad(pad){
    if(!this.is1708(pad))return; this.lastPad=pad;
    if(!this.reconnectTimer)return;
    this.stopReconnectWait(); this.setModalStep(2); this.$("x17State").textContent="RECONECTADO"; this.$("x17Phase").textContent="CIRCULARIDAD";
    this.$("x17Instruction").textContent="Control detectado. Iniciando automáticamente el test de circularidad.";
    this.modalStatus("Control detectado. Iniciando automáticamente el test de circularidad."); this.log("1708 detectado por Gamepad API: "+pad.id); this.startTest();
  }
  loop(){ if(!this.testing)return; const pad=this.current1708(); if(pad){this.lastPad=pad;this.read(pad);} requestAnimationFrame(()=>this.loop()); }
  read(p){ const a=p.axes||[],s=this.s; s.lx=a[0]||0;s.ly=a[1]||0;s.rx=a[2]||0;s.ry=a[3]||0;s.lt=p.buttons[6]?.value||0;s.rt=p.buttons[7]?.value||0; const lr=Math.hypot(s.lx,s.ly),rr=Math.hypot(s.rx,s.ry);s.lmax=Math.max(s.lmax,lr);s.rmax=Math.max(s.rmax,rr);if(lr<.22)s.ld.push(lr);if(rr<.22)s.rd.push(rr);if(s.ld.length>500)s.ld.shift();if(s.rd.length>500)s.rd.shift();this.track("l",s.lx,s.ly,lr);this.track("r",s.rx,s.ry,rr);this.render(); }
  track(side,x,y,r){ const s=this.s;if((s.turnStage==="ls"&&side!=="l")||(s.turnStage==="rs"&&side!=="r"))return;const ak=side==="l"?"lAngle":"rAngle",tk=side==="l"?"lTravel":"rTravel";if(r>.55){const angle=Math.atan2(y,x),previous=s[ak];if(previous!==null){let delta=angle-previous;while(delta>Math.PI)delta-=2*Math.PI;while(delta<-Math.PI)delta+=2*Math.PI;if(Math.abs(delta)>.01&&Math.abs(delta)<.65)s[tk]+=Math.abs(delta)}s[ak]=angle}else if(r<.25)s[ak]=null;if(side==="l"&&s.lTravel>=Math.PI*2){s.turnStage="rs";s.rAngle=null;this.log("Circularidad LS completada; continúa con RS.")}}
  draw(id,x,y){const c=this.$(id),g=c.getContext("2d"),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.strokeStyle="#00e5ff";g.lineWidth=2;g.beginPath();g.arc(w/2,h/2,w*.4,0,Math.PI*2);g.stroke();g.strokeStyle="#52616a";g.beginPath();g.moveTo(w/2,20);g.lineTo(w/2,h-20);g.moveTo(20,h/2);g.lineTo(w-20,h/2);g.stroke();g.fillStyle="#d9e2e8";g.beginPath();g.arc(w/2+x*w*.4,h/2-y*h*.4,7,0,Math.PI*2);g.fill()}
  render(){const s=this.s,lp=Math.round(Math.min(100,s.lTravel/(Math.PI*2)*100)),rp=Math.round(Math.min(100,s.rTravel/(Math.PI*2)*100));this.draw("x17LS",s.lx,s.ly);this.draw("x17RS",s.rx,s.ry);this.$("x17LSVal").textContent=`${s.lx.toFixed(3)} / ${s.ly.toFixed(3)}`;this.$("x17RSVal").textContent=`${s.rx.toFixed(3)} / ${s.ry.toFixed(3)}`;this.$("x17LRange").textContent=Math.min(100,s.lmax*100).toFixed(0)+"%";this.$("x17RRange").textContent=Math.min(100,s.rmax*100).toFixed(0)+"%";this.$("x17LSMetric").textContent=`Drift ${(this.avg(s.ld)*100).toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}%`;this.$("x17RSMetric").textContent=`Drift ${(this.avg(s.rd)*100).toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}%`;this.$("x17LTPct").textContent=Math.round(s.lt*100)+"%";this.$("x17RTPct").textContent=Math.round(s.rt*100)+"%";this.$("x17LTBar").style.width=Math.min(100,s.lt*100)+"%";this.$("x17RTBar").style.width=Math.min(100,s.rt*100)+"%";this.$("x17Progress").textContent=s.turnStage==="ls"?`GIRA LS POR EL BORDE · ${lp}%`:`LS 100% · AHORA GIRA RS · ${rp}%`;if(lp>=100&&rp>=100)this.finishTest()}
  startTest(){if(!this.lastPad){this.waitForReconnection();return}this.reset();this.testing=true;this.$("x17State").textContent="TEST";this.$("x17Phase").textContent="CIRCULARIDAD";this.$("x17Instruction").textContent="Gira LS por todo el borde; al 100% continuará con RS.";this.$("x17Progress").textContent="GIRA LS POR EL BORDE · 0%";this.log("Test de circularidad 1708 iniciado automáticamente.");this.loop()}
  avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
  score(){const s=this.s,d=(this.avg(s.ld)+this.avg(s.rd))*50,r=(Math.min(1,s.lmax)+Math.min(1,s.rmax))/2;return Math.max(0,Math.min(100,Math.round(100-d*1.8-(1-r)*35)))}
  finishTest(){if(!this.testing)return;this.testing=false;const score=this.score();this.$("x17Score").textContent=score+"/100";this.$("x17State").textContent="COMPLETO";this.$("x17Phase").textContent="TEST COMPLETO";this.$("x17Instruction").textContent=`Circularidad completada · XE Score ${score}/100.`;this.$("x17Pdf").disabled=false;this.modalStatus("Test completo. Generando el reporte PDF.");this.log("Test de circularidad completado. Generando PDF.");this.pdf();window.setTimeout(()=>this.$("x17DriftGuardModal").classList.add("hidden"),800)}
  pdf(){if(!window.jspdf){window.print();return}const {jsPDF}=window.jspdf,d=new jsPDF({unit:"mm",format:"a4"}),s=this.s,score=this.score(),now=new Date().toLocaleString("es-MX");d.setFillColor(3,8,9);d.rect(0,0,210,297,"F");d.setDrawColor(0,229,255);d.setLineWidth(.6);d.roundedRect(10,10,190,277,3,3,"S");d.setTextColor(217,226,232);d.setFont("helvetica","bold");d.setFontSize(20);d.text("XE CONTROLLER LAB PRO",16,24);d.setTextColor(0,229,255);d.setFontSize(10);d.text("XBOX ONE 1708 · REPORTE DE CIRCULARIDAD",16,31);d.setTextColor(217,226,232);d.setFont("helvetica","normal");d.setFontSize(9);d.text("Calibración realizada mediante DriftGuard · XE integra el flujo y la prueba posterior.",16,42);d.text("USB: 045E:02EA · Driver Xbox / Gamepad API",16,49);d.text("Fecha: "+now,16,56);d.setTextColor(0,229,255);d.setFont("helvetica","bold");d.setFontSize(36);d.text(String(score),165,76);d.setFontSize(9);d.text("XE SCORE / 100",157,83);d.setTextColor(217,226,232);d.setFontSize(12);d.text("RESULTADOS",16,78);d.setFont("helvetica","normal");d.setFontSize(10);d.text(`LS · Drift ${(this.avg(s.ld)*100).toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}% · Circularidad completada`,16,92);d.text(`RS · Drift ${(this.avg(s.rd)*100).toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}% · Circularidad completada`,16,102);d.text(`LT ${Math.round(s.lt*100)}% · RT ${Math.round(s.rt*100)}%`,16,112);d.setDrawColor(82,97,106);d.line(16,260,194,260);d.setTextColor(126,145,154);d.setFontSize(8);d.text("Reporte generado por XE Controller Lab Pro · Calibración propiedad de DriftGuard.",16,270);d.save("XE-REPORTE-CIRCULARIDAD-XBOX-ONE-1708.pdf")}
}
window.addEventListener("DOMContentLoaded",()=>{document.querySelector(".xe-video-tutorial")?.remove();window.xe1708=new XE1708Lab()});

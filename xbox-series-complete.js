class XEXboxSeriesComplete{
 constructor(){this.d=null;this.iface=0;this.epIn=2;this.epOut=2;this.reading=false;this.test=false;this.phase="idle";this.seq=1;this.gipReady=false;this.gipWaiter=null;this.calibrated=false;this.calibratedAt=null;this.reset();this.bind()}
 $(x){return document.getElementById(x)}
 reset(){this.s={lx:0,ly:0,rx:0,ry:0,lt:0,rt:0,lmax:0,rmax:0,ldrift:[],rdrift:[],la:null,ra:null,lacc:0,racc:0,ltTurns:0,rtTurns:0,ltHits:0,rtHits:0,ltLock:false,rtLock:false,buttons:new Set(),samples:0,turnStage:"ls",lpath:0,rpath:0,lpx:null,lpy:null,rpx:null,rpy:null}}
 bind(){this.$("xbConnect").onclick=()=>this.connect();this.$("xbAuto").onclick=()=>this.startTest();this.$("xbCalibrate").onclick=()=>this.showCal();this.$("xbCalGo").onclick=()=>this.calibrate();this.$("xbPdf").onclick=()=>this.pdf()}
 log(s){let e=this.$("xbLog");e.textContent=(new Date().toLocaleTimeString()+" · "+s+"\n"+e.textContent).slice(0,14000)}
 async connect(){try{
  if(!navigator.usb)throw Error("WebUSB no disponible. Usa Chrome o Edge por HTTPS.");
  this.d=await navigator.usb.requestDevice({filters:[{vendorId:0x045e,productId:0x0b12}]});await this.d.open();if(!this.d.configuration)await this.d.selectConfiguration(1);
  let found=null;for(const i of this.d.configuration.interfaces){for(const a of i.alternates){let ei=a.endpoints.find(e=>e.direction==="in"&&e.type==="interrupt");let eo=a.endpoints.find(e=>e.direction==="out"&&e.type==="interrupt");if(ei&&eo){found={i,a,ei,eo};break}}if(found)break}
  if(!found)throw Error("No se encontraron endpoints IN/OUT interrupt.");
  this.iface=found.i.interfaceNumber;this.epIn=found.ei.endpointNumber;this.epOut=found.eo.endpointNumber;await this.d.claimInterface(this.iface);if(found.a.alternateSetting)await this.d.selectAlternateInterface(this.iface,found.a.alternateSetting);
  this.$("xbVidPid").textContent="045E : 0B12";this.$("xbUsb").textContent=`IF ${this.iface} · IN ${this.epIn} / OUT ${this.epOut}`;this.$("xbState").textContent="INICIALIZANDO";this.$("xbPhase").textContent="PROTOCOLO XBOX / GIP";this.$("xbAuto").disabled=true;this.$("xbCalibrate").disabled=true;this.$("xbInstruction").textContent="Activando flujo de datos del control Xbox...";this.log("Xbox 1914 abierto por WebUSB. Iniciando GIP.");
  this.gipReady=false;this.reading=true;this.readLoop();
  await this.initGIP();
  this.$("xbState").textContent="CONECTADO";this.$("xbPhase").textContent="LECTURA XBOX ACTIVA";this.$("xbAuto").disabled=false;this.$("xbCalibrate").disabled=false;this.$("xbInstruction").textContent="Control Xbox activo. Verifica sticks y botones o inicia el test de 6 vueltas.";this.log("GIP activo: recibido primer reporte real 20 00.");
 }catch(e){this.$("xbState").textContent="ERROR";this.log("ERROR: "+e.message)}
 }
 async readLoop(){while(this.reading&&this.d?.opened){try{let r=await this.d.transferIn(this.epIn,64);if(r.status==="ok"&&r.data)this.decode(new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength))}catch(e){this.log("LECTURA: "+e.message);break}}}
 i16(b,o){let v=b[o]|(b[o+1]<<8);return v&0x8000?v-65536:v}
 decode(b){if(b.length<18||b[0]!==0x20)return;if(!this.gipReady){this.gipReady=true;if(this.gipWaiter){this.gipWaiter(true);this.gipWaiter=null}}let s=this.s;s.lt=(b[6]|b[7]<<8)/1023;s.rt=(b[8]|b[9]<<8)/1023;s.lx=this.i16(b,10)/32767;s.ly=-this.i16(b,12)/32767;s.rx=this.i16(b,14)/32767;s.ry=-this.i16(b,16)/32767;s.samples++;
  this.track("l",s.lx,s.ly);this.track("r",s.rx,s.ry);this.buttons(b);this.render();
 }
 track(k,x,y){let s=this.s,r=Math.hypot(x,y),a=Math.atan2(y,x),pre=k==="l"?"l":"r";s[pre+"max"]=Math.max(s[pre+"max"],r);if(r<.18)s[pre+"drift"].push(r);if(s[pre+"drift"].length>500)s[pre+"drift"].shift();
  if(this.test){
   const active=(s.turnStage==="ls"&&pre==="l")||(s.turnStage==="rs"&&pre==="r");
   const pathk=pre+"path", pxk=pre+"px", pyk=pre+"py";
   if(active&&r>.32){
     if(s[pxk]!==null){
       const step=Math.hypot(x-s[pxk],y-s[pyk]);
       if(step<.45)s[pathk]+=step;
     }
     s[pxk]=x;s[pyk]=y;
     const completed=Math.min(6,Math.floor(s[pathk]/5.0));
     s[pre+"Turns"]=completed;
     if(pre==="l"&&s.lpath>=30){s.turnStage="rs";s.lpx=null;s.lpy=null;this.log("Barra LS completa · cambio automático a RS.")}
   }else if(active&&r<.18){s[pxk]=null;s[pyk]=null}
  }
  if(this.test){if(s.lt>.94&&!s.ltLock){s.ltHits++;s.ltLock=true}if(s.lt<.15)s.ltLock=false;if(s.rt>.94&&!s.rtLock){s.rtHits++;s.rtLock=true}if(s.rt<.15)s.rtLock=false;if(s.lpath>=30&&s.rpath>=30)this.finishTest()}
 }
 buttons(b){let m=(b[4]|b[5]<<8)>>>0,n=["UP","DOWN","LEFT","RIGHT","MENU","VIEW","LS","RS","LB","RB","GUIDE","A","B","X","Y"];n.forEach((v,i)=>{if(m&(1<<i))this.s.buttons.add(v)})}
 draw(id,x,y){let c=this.$(id),g=c.getContext("2d"),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.strokeStyle="#5c481d";g.lineWidth=2;g.beginPath();g.arc(w/2,h/2,w*.39,0,Math.PI*2);g.stroke();g.strokeStyle="#302916";g.beginPath();g.moveTo(w/2,18);g.lineTo(w/2,h-18);g.moveTo(18,h/2);g.lineTo(w-18,h/2);g.stroke();g.fillStyle="#d8b54c";g.beginPath();g.arc(w/2+x*w*.36,h/2+y*h*.36,7,0,Math.PI*2);g.fill()}
 avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
 render(){let s=this.s;this.draw("xbLS",s.lx,s.ly);this.draw("xbRS",s.rx,s.ry);this.$("xbLSVal").textContent=`${s.lx.toFixed(3)} / ${s.ly.toFixed(3)}`;this.$("xbRSVal").textContent=`${s.rx.toFixed(3)} / ${s.ry.toFixed(3)}`;const lp=Math.min(100,Math.round(s.lpath/30*100)),rp=Math.min(100,Math.round(s.rpath/30*100));
this.$("xbLTurns").innerHTML=`<div class="turnPct">${lp}%</div><div class="turnBar"><i style="width:${lp}%"></i></div>`;
this.$("xbRTurns").innerHTML=`<div class="turnPct">${rp}%</div><div class="turnBar"><i style="width:${rp}%"></i></div>`;
if(this.test)this.$("xbInstruction").textContent=s.turnStage==="ls"?`GIRA LS POR TODO EL BORDE · ${lp}%`:`LS COMPLETADO · AHORA GIRA RS POR TODO EL BORDE · ${rp}%`;this.$("xbLTPct").textContent=Math.round(s.lt*100)+"%";this.$("xbRTPct").textContent=Math.round(s.rt*100)+"%";this.$("xbLTBar").style.width=(s.lt*100)+"%";this.$("xbRTBar").style.width=(s.rt*100)+"%";this.$("xbTriggerHits").textContent=`LT ${Math.min(s.ltHits,3)}/3 · RT ${Math.min(s.rtHits,3)}/3`;this.$("xbLSMetric").textContent=`Drift ${(this.avg(s.ldrift)*100).toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}%`;this.$("xbRSMetric").textContent=`Drift ${(this.avg(s.rdrift)*100).toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}%`;this.$("xbButtons").textContent="BOTONES REGISTRADOS: "+([...s.buttons].join(" · ")||"ninguno")}
 startTest(){this.reset();this.test=true;this.phase="test";this.$("xbPhase").textContent="TEST 6 VUELTAS";this.$("xbState").textContent="EN PRUEBA";this.$("xbInstruction").textContent="GIRA LS POR TODO EL BORDE HASTA LLENAR LA BARRA. AL 100% CAMBIARÁ AUTOMÁTICAMENTE A RS.";this.$("xbAuto").disabled=true;this.$("xbPdf").disabled=true;this.log("Test Xbox iniciado.")}
 finishTest(){if(!this.test)return;this.test=false;this.phase="done";let sc=this.score();this.$("xbScore").textContent=sc+"/100";this.$("xbPhase").textContent="TEST COMPLETO";this.$("xbState").textContent="COMPLETO";this.$("xbInstruction").textContent=`Test terminado · XE Score ${sc}/100. Puedes calibrar o descargar el reporte.`;this.$("xbPdf").disabled=false;this.$("xbAuto").disabled=false;this.log("Test completo. XE Score "+sc+"/100.")}
 score(){let s=this.s,dr=(this.avg(s.ldrift)+this.avg(s.rdrift))*50,rg=(Math.min(1,s.lmax)+Math.min(1,s.rmax))/2;return Math.max(0,Math.min(100,Math.round(100-dr*2-(1-rg)*35)))}
 showCal(){this.$("xbCalBox").classList.remove("hidden");this.$("xbCalBox").scrollIntoView({behavior:"smooth",block:"center"})}
 pkt(cmd,payload){let p=new Uint8Array(4+payload.length);p[0]=cmd;p[1]=0x20;p[2]=this.seq++&255;p[3]=payload.length;p.set(payload,4);return p}
 async send(a){let r=await this.d.transferOut(this.epOut,a);if(r.status!=="ok")throw Error("USB OUT "+r.status)}
 waitGIP(ms){if(this.gipReady)return Promise.resolve(true);return new Promise(resolve=>{let done=false;let finish=v=>{if(done)return;done=true;resolve(v)};this.gipWaiter=finish;setTimeout(()=>{if(this.gipWaiter===finish)this.gipWaiter=null;finish(false)},ms)})}
 async initGIP(){
  this.seq=1;
  this.log("GIP TX: 05 20 01 01 00 · activación de reportes.");
  await this.send(this.pkt(0x05,new Uint8Array([0x00])));
  if(await this.waitGIP(1800))return;
  this.log("Sin 20 00 tras activación. Enviando anuncio GIP capturado.");
  await this.send(this.pkt(0x0a,new Uint8Array([0x00,0x01,0xff])));
  await this.sleep(25);
  if(await this.waitGIP(1200))return;
  throw Error("El control abrió por WinUSB pero no inició reportes GIP 20 00. Desconecta el mando 5 segundos, reconecta y pulsa CONECTAR XBOX.");
 }
 sleep(ms){return new Promise(r=>setTimeout(r,ms))}
 async calibrate(){if(!this.$("xbConfirm").checked){this.log("Confirma el modelo y la calibración.");return}if(!this.d?.opened||this.d.vendorId!==0x045e||this.d.productId!==0x0b12){this.log("BLOQUEADO: dispositivo distinto de 045E:0B12.");return}
  this.$("xbCalGo").disabled=true;this.$("xbCalibrate").disabled=true;this.$("xbState").textContent="CALIBRANDO";this.$("xbPhase").textContent="CALIBRACIÓN STICKS";this.$("xbCalText").textContent="GIRA AMBOS JOYSTICKS POR TODO EL BORDE DE FORMA CONTINUA HASTA QUE TERMINE LA CUENTA.";this.log("Inicio de calibración Xbox 1914. Secuencia OUT validada contra captura USB.");
  try{
   await this.send(this.pkt(0x1e,new Uint8Array([0x0f,0x03])));await this.sleep(14);await this.send(this.pkt(0x1e,new Uint8Array([0x10,0x03])));await this.sleep(1);
   const delays=[14,30,66,28,570,37,25,543,280,541,32,158,540,28,539,29,536,539,33,31,28,543,538,550,276];
   for(let i=0;i<26;i++){await this.send(this.pkt(0x1e,new Uint8Array([0x0f,0x03])));let pct=Math.round((i+1)/26*100);this.$("xbCalText").textContent=`GIRA AMBOS JOYSTICKS POR TODO EL BORDE · ${pct}%`;this.$("xbCalProgressBar").style.width=pct+"%";this.$("xbCalPct").textContent=pct+"% COMPLETADO";await this.sleep(delays[i]||250)}
   this.calibrated=true;this.calibratedAt=new Date();this.$("xbCalText").textContent="CALIBRACIÓN FINALIZADA · SUELTA AMBOS STICKS AL CENTRO Y EJECUTA UN NUEVO TEST DE 6 VUELTAS.";this.$("xbCalProgressBar").style.width="100%";this.$("xbCalPct").textContent="CALIBRACIÓN COMPLETA";this.$("xbState").textContent="CALIBRADO";this.$("xbPhase").textContent="VERIFICAR DESPUÉS";this.$("xbPdf").disabled=false;this.$("xbCalBox").classList.add("hidden");this.$("xbAuto").disabled=false;this.log("Secuencia de calibración finalizada. Verificación requerida.");
  }catch(e){this.$("xbState").textContent="ERROR";this.$("xbCalText").textContent="Error: "+e.message;this.log("CALIBRACIÓN: "+e.message)}
  this.$("xbCalGo").disabled=false;this.$("xbCalibrate").disabled=false;
 }
 pdf(){if(!window.jspdf){window.print();return}let {jsPDF}=window.jspdf,d=new jsPDF({unit:"mm",format:"a4"}),s=this.s,sc=this.score(),ld=this.avg(s.ldrift)*100,rd=this.avg(s.rdrift)*100;d.setFillColor(8,8,8);d.rect(0,0,210,297,"F");d.setTextColor(218,181,76);d.setFont("helvetica","bold");d.setFontSize(22);d.text("XE CONTROLLER LAB PRO",14,20);d.setFontSize(10);d.text("XBOX SERIES 1914 · DIAGNOSTIC REPORT",14,28);d.setDrawColor(183,139,36);d.line(14,33,196,33);d.setTextColor(230,230,230);d.setFontSize(11);d.text("CONTROL",14,45);d.setFont("helvetica","normal");d.setFontSize(9);d.text("Modelo: Xbox Series 1914",14,52);d.text("USB: 045E:0B12 · WinUSB/WebUSB",14,58);d.text(`Calibración XE: ${this.calibrated?"REALIZADA":"NO REALIZADA"}`,14,64);d.setFont("helvetica","bold");d.setFontSize(30);d.setTextColor(218,181,76);d.text(String(sc),170,52);d.setFontSize(8);d.text("XE SCORE / 100",163,59);d.setTextColor(230,230,230);d.setFontSize(11);d.text("JOYSTICKS",14,73);d.setFont("helvetica","normal");d.setFontSize(9);d.text(`LS · Drift ${ld.toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}% · Vueltas ${s.ltTurns}/6`,14,84);d.text(`RS · Drift ${rd.toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}% · Vueltas ${s.rtTurns}/6`,14,91);d.setFont("helvetica","bold");d.setFontSize(11);d.text("GATILLOS",14,104);d.setFont("helvetica","normal");d.setFontSize(9);d.text(`LT · ${s.ltHits} recorridos completos     RT · ${s.rtHits} recorridos completos`,14,112);d.setFont("helvetica","bold");d.setFontSize(11);d.text("BOTONES REGISTRADOS",14,128);d.setFont("helvetica","normal");d.setFontSize(8);let bt=[...s.buttons].join(" · ")||"Sin registro";d.text(d.splitTextToSize(bt,180),14,136);d.setFont("helvetica","bold");d.setFontSize(11);d.text("CONCLUSIÓN TÉCNICA",14,158);d.setFont("helvetica","normal");d.setFontSize(9);let cl=sc>=90?"CONTROL APROBADO. Respuesta general dentro de parámetros altos.":sc>=75?"CONTROL FUNCIONAL. Se recomienda revisar los valores señalados antes de entrega.":"CONTROL REQUIERE REVISIÓN TÉCNICA antes de entrega.";d.text(d.splitTextToSize(cl,180),14,166);d.setDrawColor(70,70,70);d.line(14,262,196,262);d.setTextColor(130,130,130);d.setFontSize(7);d.text("XE Servicio Electrónico · Reporte generado por XE Controller Lab Pro",14,271);d.text(new Date().toLocaleString("es-MX"),14,277);d.save("XE-XBOX-SERIES-REPORT.pdf")}
}
window.addEventListener("DOMContentLoaded",()=>window.XEXboxSeries=new XEXboxSeriesComplete());
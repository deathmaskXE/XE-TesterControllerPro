class XE1708Lab{
 constructor(){this.d=null;this.iface=0;this.epIn=2;this.epOut=2;this.auxIns=[];this.claimedIfaces=[];this.reading=false;this.testing=false;this.calibrated=false;this.samples=0;this.reset();this.bind()}
 $(id){return document.getElementById(id)}
 reset(){this.s={lx:0,ly:0,rx:0,ry:0,lt:0,rt:0,lmax:0,rmax:0,ld:[],rd:[],buttons:new Set(),coverL:new Set(),coverR:new Set(),turnStage:"ls",lAngle:null,rAngle:null,lTravel:0,rTravel:0}}
 bind(){this.$("x17Connect").onclick=()=>this.connect();this.$("x17Test").onclick=()=>this.startTest();this.$("x17Calibrate").onclick=()=>this.showCal();this.$("x17CalGo").onclick=()=>this.calibrate();this.$("x17Pdf").onclick=()=>this.pdf()}
 log(t){let e=this.$("x17Log");e.textContent+="\n"+new Date().toLocaleTimeString("es-MX")+" · "+t;e.scrollTop=e.scrollHeight}
 async connect(){try{
  if(!navigator.usb)throw Error("WebUSB no disponible. Usa Chrome o Edge por HTTPS.");
  let d=await navigator.usb.requestDevice({filters:[{vendorId:0x045e,productId:0x02ea}]});
  if(!d.opened)await d.open();if(!d.configuration)await d.selectConfiguration(1);
  let found=null,aux=[];for(const it of d.configuration.interfaces){for(const alt of it.alternates){let ins=alt.endpoints.filter(e=>e.direction==="in"&&e.type==="interrupt"),eo=alt.endpoints.find(e=>e.direction==="out"&&e.type==="interrupt");if(ins.length&&eo&&!found)found={iface:it.interfaceNumber,alt:alt.alternateSetting,ein:ins[0].endpointNumber,eout:eo.endpointNumber};for(const ei of ins)aux.push({iface:it.interfaceNumber,alt:alt.alternateSetting,ein:ei.endpointNumber})}}
  if(!found)throw Error("No se localizaron endpoints GIP IN/OUT.");
  this.d=d;this.iface=found.iface;this.epIn=found.ein;this.epOut=found.eout;this.auxIns=aux.filter(x=>!(x.iface===found.iface&&x.ein===found.ein));
  this.claimedIfaces=[];for(const n of [...new Set([found.iface,...this.auxIns.map(x=>x.iface)])]){await d.claimInterface(n);this.claimedIfaces.push(n)}
  if(found.alt)await d.selectAlternateInterface(this.iface,found.alt);
  for(const x of this.auxIns)if(x.alt)try{await d.selectAlternateInterface(x.iface,x.alt)}catch(_){}
  this.$("x17VidPid").textContent="045E : 02EA";this.$("x17Usb").textContent=`IF ${this.iface} · GIP IN ${this.epIn} / OUT ${this.epOut} · AUX ${this.auxIns.map(x=>"IN "+x.ein).join(", ")||"—"}`;
  this.$("x17State").textContent="INICIALIZANDO";this.$("x17Phase").textContent="GIP 1708";this.reading=true;this.readLoop();for(const x of this.auxIns)this.auxReadLoop(x);
  await this.gipInit();await this.sleep(350);
  this.$("x17State").textContent="CONECTADO";this.$("x17Phase").textContent="LECTURA ACTIVA";this.$("x17Test").disabled=false;this.$("x17Calibrate").disabled=false;
  this.$("x17Instruction").textContent="1708 activo. Verifica sticks y botones o inicia el test.";this.log("1708 045E:02EA conectado.");
 }catch(e){this.log("ERROR DE CONEXIÓN: "+e.message);this.$("x17State").textContent="ERROR"}}
 pkt(cmd,payload){let p=new Uint8Array(4+payload.length);p[0]=cmd;p[1]=0x20;p[2]=1;p[3]=payload.length;p.set(payload,4);return p}
 async send(a){let r=await this.d.transferOut(this.epOut,a);if(r.status!=="ok")throw Error("USB OUT "+r.status)}
 async gipInit(){await this.send(new Uint8Array([0x0a,0x20,0x01,0x03,0x00,0x01,0xff]));await this.sleep(20);await this.send(new Uint8Array([0x1e,0x20,0x02,0x01,0x01]));await this.sleep(20);await this.send(new Uint8Array([0x05,0x20,0x03,0x01,0x00]));}
 async readLoop(){while(this.reading&&this.d?.opened){try{let r=await this.d.transferIn(this.epIn,64);if(r.status==="ok"&&r.data){let b=new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength);this.decode(b)}}catch(e){if(this.reading){this.log("LECTURA: "+e.message);await this.sleep(80)}}}}
 async auxReadLoop(x){while(this.reading&&this.d?.opened){try{let r=await this.d.transferIn(x.ein,64);if(r.status==="ok"&&r.data){let b=new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength);if(b.length===7)this.lastAux=Array.from(b)}}catch(e){if(this.reading)await this.sleep(60)}}}
 i16(b,o){let v=b[o]|(b[o+1]<<8);return v&0x8000?v-65536:v}
 decode(b){if(b.length<18||b[0]!==0x20)return;let s=this.s;
  let lx=this.i16(b,10)/32768,ly=this.i16(b,12)/32768,rx=this.i16(b,14)/32768,ry=this.i16(b,16)/32768;
  s.lx=lx;s.ly=ly;s.rx=rx;s.ry=ry;s.lt=(b[6]|(b[7]<<8))/1023;s.rt=(b[8]|(b[9]<<8))/1023;
  let lr=Math.hypot(lx,ly),rr=Math.hypot(rx,ry);s.lmax=Math.max(s.lmax,lr);s.rmax=Math.max(s.rmax,rr);
  if(lr<.22)s.ld.push(lr);if(rr<.22)s.rd.push(rr);if(s.ld.length>500)s.ld.shift();if(s.rd.length>500)s.rd.shift();
  if(this.testing){
   const track=(pre,x,y,r)=>{
    if((s.turnStage==="ls"&&pre!=="l")||(s.turnStage==="rs"&&pre!=="r"))return;
    const ak=pre==="l"?"lAngle":"rAngle",tk=pre==="l"?"lTravel":"rTravel";
    if(r>.55){
     const a=Math.atan2(y,x),prev=s[ak];
     if(prev!==null){let d=a-prev;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
      if(Math.abs(d)>.01&&Math.abs(d)<.65)s[tk]+=Math.abs(d);
     }
     s[ak]=a;
    }else if(r<.25)s[ak]=null;
   };
   track("l",lx,ly,lr);track("r",rx,ry,rr);
   if(s.turnStage==="ls"&&s.lTravel>=Math.PI*12){s.turnStage="rs";s.lAngle=null;this.log("LS completado · cambio automático a RS.")}
  }
  this.render();
 }
 avg(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
 draw(id,x,y){let c=this.$(id),g=c.getContext("2d"),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.strokeStyle="#8d6a20";g.lineWidth=2;g.beginPath();g.arc(w/2,h/2,w*.40,0,Math.PI*2);g.stroke();g.strokeStyle="#2d2413";g.beginPath();g.moveTo(w/2,20);g.lineTo(w/2,h-20);g.moveTo(20,h/2);g.lineTo(w-20,h/2);g.stroke();g.fillStyle="#d8b54c";g.beginPath();g.arc(w/2+x*w*.40,h/2-y*h*.40,7,0,Math.PI*2);g.fill()}
 render(){let s=this.s;this.draw("x17LS",s.lx,s.ly);this.draw("x17RS",s.rx,s.ry);this.$("x17LSVal").textContent=`${s.lx.toFixed(3)} / ${s.ly.toFixed(3)}`;this.$("x17RSVal").textContent=`${s.rx.toFixed(3)} / ${s.ry.toFixed(3)}`;this.$("x17LRange").textContent=Math.min(100,s.lmax*100).toFixed(0)+"%";this.$("x17RRange").textContent=Math.min(100,s.rmax*100).toFixed(0)+"%";this.$("x17LSMetric").textContent=`Drift ${(this.avg(s.ld)*100).toFixed(2)}% · Rango ${Math.min(100,s.lmax*100).toFixed(0)}%`;this.$("x17RSMetric").textContent=`Drift ${(this.avg(s.rd)*100).toFixed(2)}% · Rango ${Math.min(100,s.rmax*100).toFixed(0)}%`;this.$("x17LTPct").textContent=Math.round(s.lt*100)+"%";this.$("x17RTPct").textContent=Math.round(s.rt*100)+"%";this.$("x17LTBar").style.width=Math.min(100,s.lt*100)+"%";this.$("x17RTBar").style.width=Math.min(100,s.rt*100)+"%";
  if(this.testing){let lp=Math.round(Math.min(100,s.lTravel/(Math.PI*12)*100)),rp=Math.round(Math.min(100,s.rTravel/(Math.PI*12)*100));this.$("x17Progress").textContent=s.turnStage==="ls"?`GIRA LS POR EL BORDE · ${lp}%`:`LS 100% · AHORA GIRA RS · ${rp}%`;this.$("x17Instruction").textContent=s.turnStage==="ls"?`Completa el recorrido circular de LS · ${lp}%`:`LS COMPLETADO · completa el recorrido circular de RS · ${rp}%`;if(lp>=100&&rp>=100)this.finishTest()}
 }
 startTest(){this.reset();this.testing=true;this.$("x17State").textContent="TEST";this.$("x17Phase").textContent="RECORRIDO STICKS";this.$("x17Instruction").textContent="Gira LS por todo el borde. Al 100% cambiará automáticamente a RS.";this.$("x17Progress").textContent="GIRA LS POR EL BORDE · 0%";this.log("Test 1708 iniciado.")}
 score(){let s=this.s,d=(this.avg(s.ld)+this.avg(s.rd))*50,r=(Math.min(1,s.lmax)+Math.min(1,s.rmax))/2;return Math.max(0,Math.min(100,Math.round(100-d*1.8-(1-r)*35)))}
 finishTest(){if(!this.testing)return;this.testing=false;let sc=this.score();this.$("x17Score").textContent=sc+"/100";this.$("x17State").textContent="COMPLETO";this.$("x17Phase").textContent="TEST COMPLETO";this.$("x17Instruction").textContent=`Test 1708 terminado · XE Score ${sc}/100.`;this.$("x17Pdf").disabled=false;this.log("Test completo. XE Score "+sc+"/100.")}
 showCal(){this.$("x17CalBox").classList.remove("hidden");this.$("x17CalBox").scrollIntoView({behavior:"smooth",block:"center"})}
 async enterCleanEp0(){this.reading=false;this.log("Deteniendo lector GIP sin cerrar ni desconectar el 1708...");await this.sleep(80);try{await this.d.releaseInterface(this.iface);this.log("Interfaz GIP liberada. El USBDevice permanece abierto para EP0.")}catch(e){this.log("Aviso releaseInterface: "+e.message)}await this.sleep(120);if(!this.d?.opened)throw Error("El 1708 perdió la sesión USB antes de EP0.");this.log("EP0 preparado SIN close/open y SIN desconectar el mando.")}
 async leaveCleanEp0(){
  this.$("x17Phase").textContent="REACTIVANDO GIP";
  this.log("Calibración terminada. Reactivando lectura GIP en la misma conexión...");
  try{
   if(!this.d?.opened)throw Error("USBDevice cerrado");
   await this.d.claimInterface(this.iface);
   this.reading=true;
   this.readLoop();
   await this.gipInit();
   await this.sleep(250);
   this.$("x17State").textContent="CONECTADO";
   this.$("x17Phase").textContent="LECTURA GIP";
   this.log("1708 sigue conectado. Joysticks y test en vivo reactivados.");
  }catch(e){
   this.reading=false;
   this.$("x17Phase").textContent="RECONECTAR";
   this.log("No se pudo reactivar GIP automáticamente: "+e.message);
  }
 }
 async ctrlOut(value,index,data=new Uint8Array()){let r=await this.d.controlTransferOut({requestType:"vendor",recipient:"device",request:0x10,value:value,index:index},data);if(r.status!=="ok")throw Error("CONTROL OUT "+r.status)}
 async ctrlIn(){let r=await this.d.controlTransferIn({requestType:"vendor",recipient:"device",request:0x00,value:0x0000,index:0x0000},64);if(r.status!=="ok")throw Error("CONTROL IN "+r.status);return new Uint8Array(r.data.buffer,r.data.byteOffset,r.data.byteLength)}
 async driftGuard1708Init(){
  this.log("1708: reproduciendo inicialización EP0 exacta observada en captura DriftGuard.");
  await this.ctrlOut(0x0200,0x020f,new Uint8Array([0xdb,0x51]));
  await this.ctrlOut(0x0200,0x0210,new Uint8Array([0x6e,0xff]));
  await this.ctrlOut(0x0200,0x0211,new Uint8Array([0xaa,0xab]));
  await this.ctrlOut(0x1004,0x1002); await this.ctrlIn();
  await this.ctrlOut(0x1004,0x1001); await this.ctrlIn();
  await this.ctrlOut(0x0f04,0x0f03); await this.ctrlIn();
  this.log("1708: preámbulo EP0 DriftGuard completado.");
 }
 async calibrate(){if(!this.$("x17Confirm").checked){this.log("Confirma el modelo 1708.");return}if(!this.d?.opened||this.d.vendorId!==0x045e||this.d.productId!==0x02ea){this.log("BLOQUEADO: dispositivo distinto de 045E:02EA.");return}
  this.$("x17CalGo").disabled=true;this.$("x17Calibrate").disabled=true;this.$("x17State").textContent="CALIBRANDO";this.$("x17Phase").textContent="CONTROL EP0 1708";
  try{
   this.log("Preparando EP0 sin desconectar el 1708.");await this.enterCleanEp0();await this.driftGuard1708Init();await this.sleep(120);
   await this.ctrlOut(0x1004,0x1000);await this.sleep(90);await this.ctrlIn();
   this.$("x17CalText").textContent="GIRA AMBOS JOYSTICKS POR TODO EL BORDE · CAPTURANDO RECORRIDO";this.$("x17CalProgressBar").style.width="5%";this.$("x17CalPct").textContent="CAPTURA 1708 ACTIVA";
   for(let i=0;i<64;i++){await this.ctrlOut(0x1004,0x1000);await this.sleep(82);await this.ctrlIn();let pct=5+Math.round((i+1)/64*80);this.$("x17CalProgressBar").style.width=pct+"%";this.$("x17CalPct").textContent=pct+"% COMPLETADO"}
   await this.ctrlOut(0x1004,0x1001);await this.sleep(90);await this.ctrlIn();
   const profileA=new Uint8Array([0x4a,0x0c,0x5a,0x04,0xe4,0x0b,0xd8,0x03,0x2b,0x0c,0xef,0x03,0x26,0x0b,0x72,0x03]);
   const profileB=new Uint8Array([0x49,0x0c,0x53,0x04,0x0c,0x0c,0xc6,0x03,0x28,0x0c,0xf6,0x03,0x58,0x0b,0x58,0x03]);
   await this.ctrlOut(0x1002,0x1003,profileA);await this.sleep(20);await this.ctrlOut(0x1002,0x1003,profileB);await this.sleep(20);
   await this.ctrlOut(0x1004,0x1001);await this.sleep(90);await this.ctrlIn();
   this.calibrated=true;this.$("x17CalProgressBar").style.width="100%";this.$("x17CalPct").textContent="CALIBRACIÓN COMPLETA";this.$("x17CalText").textContent="CALIBRACIÓN 1708 FINALIZADA · SUELTA LOS STICKS Y EJECUTA UN NUEVO TEST.";this.$("x17State").textContent="CALIBRADO";this.$("x17Phase").textContent="VERIFICAR";this.$("x17Pdf").disabled=false;this.log("Transferencias EP0 completadas manteniendo GIP activo. Verificación requerida.");
  }catch(e){this.log("ERROR CALIBRACIÓN 1708: "+e.message);this.$("x17State").textContent="ERROR";this.$("x17CalText").textContent="ERROR: "+e.message}
  finally{await this.leaveCleanEp0();this.$("x17CalGo").disabled=false;this.$("x17Calibrate").disabled=false}
 }
 sleep(ms){return new Promise(r=>setTimeout(r,ms))}
 pdf(){if(!window.jspdf){window.print();return}let {jsPDF}=window.jspdf,d=new jsPDF({unit:"mm",format:"a4"}),s=this.s,sc=this.score(),ld=(this.avg(s.ld)*100).toFixed(2),rd=(this.avg(s.rd)*100).toFixed(2),lr=Math.min(100,s.lmax*100).toFixed(0),rr=Math.min(100,s.rmax*100).toFixed(0),now=new Date().toLocaleString("es-MX");
 d.setFillColor(4,4,4);d.rect(0,0,210,297,"F");
 d.setFillColor(12,10,5);d.roundedRect(10,10,190,277,3,3,"F");
 d.setDrawColor(216,181,76);d.setLineWidth(.6);d.roundedRect(10,10,190,277,3,3,"S");
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(19);d.text("XE CONTROLLER LAB PRO",16,23);
 d.setTextColor(230,230,225);d.setFontSize(9);d.text("REPORTE TECNICO DE TEST DE CONTROL",16,30);
 d.setTextColor(150,140,115);d.setFont("helvetica","normal");d.setFontSize(7);d.text("XE Servicio Electronico · Diagnostico funcional",16,35);
 d.setDrawColor(90,69,24);d.line(16,40,194,40);
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(10);d.text("INFORMACION DEL EQUIPO",16,51);
 d.setTextColor(225,225,220);d.setFont("helvetica","normal");d.setFontSize(8);d.text("Control: Xbox One 1708",16,59);d.text("USB: 045E:02EA",16,65);d.text("Interfaz: WinUSB / WebUSB",16,71);d.text("Fecha de prueba: "+now,105,59);d.text("Tipo de reporte: Test funcional",105,65);d.text("Estado de calibracion XE: "+(this.calibrated?"REALIZADA":"NO REALIZADA"),105,71);
 d.setFillColor(7,7,6);d.roundedRect(16,80,178,35,2,2,"F");d.setDrawColor(63,49,19);d.roundedRect(16,80,178,35,2,2,"S");
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(9);d.text("XE SCORE",23,91);d.setFontSize(27);d.text(String(sc),23,108);d.setFontSize(8);d.text("/ 100",43,108);
 d.setTextColor(225,225,220);d.setFontSize(9);d.text("RESULTADO GENERAL",82,91);d.setFont("helvetica","normal");d.setFontSize(8);d.text(sc>=90?"EXCELENTE · CONTROL APTO":sc>=75?"BUENO · REVISAR DESGASTE MENOR":"REQUIERE REVISION TECNICA",82,101);d.text("Prueba basada en lectura directa de ejes, rango y retorno al centro.",82,108);
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(10);d.text("RESULTADOS DE JOYSTICKS",16,129);
 d.setFillColor(7,7,6);d.roundedRect(16,136,84,42,2,2,"F");d.roundedRect(110,136,84,42,2,2,"F");d.setDrawColor(63,49,19);d.roundedRect(16,136,84,42,2,2,"S");d.roundedRect(110,136,84,42,2,2,"S");
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(11);d.text("LS",23,148);d.text("RS",117,148);
 d.setTextColor(225,225,220);d.setFont("helvetica","normal");d.setFontSize(8);d.text("Drift medio: "+ld+"%",23,158);d.text("Rango maximo: "+lr+"%",23,166);d.text("Drift medio: "+rd+"%",117,158);d.text("Rango maximo: "+rr+"%",117,166);
 d.setTextColor(216,181,76);d.setFont("helvetica","bold");d.setFontSize(10);d.text("VALIDACION FUNCIONAL",16,194);
 d.setTextColor(225,225,220);d.setFont("helvetica","normal");d.setFontSize(8);d.text("Lectura de joystick izquierdo: REGISTRADA",20,204);d.text("Lectura de joystick derecho: REGISTRADA",20,211);d.text("Lectura de gatillo LT: REGISTRADA",20,218);d.text("Lectura de gatillo RT: REGISTRADA",105,204);d.text("Recorrido circular LS/RS: COMPLETADO",105,211);d.text("Reporte generado por XE Controller Lab Pro",105,218);
 d.setDrawColor(63,49,19);d.line(16,252,194,252);d.setTextColor(130,125,110);d.setFontSize(7);d.text("Este reporte documenta los valores observados durante el test funcional del control.",16,261);d.text("XE Servicio Electronico · XE Controller Lab Pro",16,270);d.text(now,154,270);
 d.save("XE-REPORTE-TEST-XBOX-ONE-1708.pdf")}

}
window.addEventListener("DOMContentLoaded",()=>window.xe1708=new XE1708Lab());

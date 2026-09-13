/*
XE Controller Lab Pro - DualSense WebHID module.
Calibration command sequences are based on DualShock Calibration GUI by the_al.
Original project: https://github.com/dualshock-tools/dualshock-tools.github.io
MIT License - Copyright (c) 2024 the_al.
See THIRD_PARTY_LICENSES.txt.
*/
class XEDualSenseHID{
 constructor(){this.device=null;this.view=null;this.circ={l:new Set(),r:new Set()};this.wizard=null;this.bind()}
 bind(){
  const $=id=>document.getElementById(id);
  $("ds5Connect").onclick=()=>this.connect();
  $("ds5QuickCenter").onclick=()=>this.quickCenter();
  $("ds5FourCenter").onclick=()=>this.fourCenter();
  $("ds5Range").onclick=()=>this.range();
  $("ds5Save").onclick=()=>this.save();
  $("ds5Reboot").onclick=()=>this.reboot();
  $("ds5WizardNext").onclick=()=>this.nextWizard();
 }
 gamepadDetected(){document.getElementById("ds5Panel")?.classList.remove("hidden")}
 log(s,bad=false){let e=document.getElementById("ds5Log");e.textContent=s;e.classList.toggle("bad",bad);document.getElementById("ds5Msg").textContent=s}
 async connect(){
  if(!("hid" in navigator)){this.log("WebHID no está disponible. Usa Chrome o Edge en PC mediante HTTPS.",true);return}
  try{
   let devices=await navigator.hid.requestDevice({filters:[{vendorId:0x054c,productId:0x0ce6},{vendorId:0x054c,productId:0x0df2}]});
   if(!devices.length)return;
   this.device=devices[0];if(!this.device.opened)await this.device.open();
   this.device.addEventListener("inputreport",e=>this.input(e));
   document.getElementById("ds5Tools").classList.remove("hidden");
   document.getElementById("ds5State").textContent="WEBHID ACTIVO";
   document.getElementById("ds5Model").textContent=this.device.productId===0x0df2?"DualSense Edge":"DualSense";
   document.getElementById("ds5VidPid").textContent=`054C / ${this.device.productId.toString(16).toUpperCase().padStart(4,"0")}`;
   await this.info();
   this.log("DualSense conectado por WebHID. Lectura HID directa activa.");
  }catch(e){this.log("No se pudo abrir WebHID: "+e.message,true)}
 }
 featureLength(reportId){
  try{
   for(const c of this.device.collections||[]){
    for(const r of c.featureReports||[]){
     if(r.reportId===reportId){
      let bits=0;
      for(const item of r.items||[])bits+=(item.reportSize||0)*(item.reportCount||0);
      if(bits>0)return Math.ceil(bits/8);
     }
    }
   }
  }catch(e){}
  return 63;
 }
 async send(id,data){
  if(!this.device?.opened)throw new Error("DualSense WebHID no conectado");
  const len=this.featureLength(id);
  const payload=new Uint8Array(len);
  payload.set(new Uint8Array(data).slice(0,len));
  await this.device.sendFeatureReport(id,payload);
 }
 async recv(id){return await this.device.receiveFeatureReport(id)}
 async assert83(deviceId=1,targetId=1){
  let v=await this.recv(0x83);
  let bytes=Array.from(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
  if(bytes[0]===0x83)bytes=bytes.slice(1);
  let ok=false;
  for(let i=0;i<=bytes.length-4;i++){
   if(bytes[i]===deviceId&&bytes[i+1]===targetId&&bytes[i+2]===1&&bytes[i+3]===0xff){ok=true;break}
  }
  if(!ok)throw new Error("Estado HID inicial inválido: "+bytes.slice(0,8).map(x=>x.toString(16).padStart(2,"0")).join(" "));
 }
 async info(){
  try{
   let v=await this.recv(0x20);
   if(v.byteLength>=60){
    let hw=v.getUint32(24,true),a=(hw>>8)&255,board={3:"BDM-010",4:"BDM-020",5:"BDM-030",6:"BDM-040",7:"BDM-050",8:"BDM-050",17:"BDM-060M",19:"BDM-060X"}[a]||"DESCONOCIDA";
    document.getElementById("ds5Board").textContent=board;
   }
  }catch(e){document.getElementById("ds5Board").textContent="NO DISPONIBLE"}
 }
 input(e){
  let d=e.data;if(!d||d.byteLength<10)return;
  let lx=d.getUint8(0),ly=d.getUint8(1),rx=d.getUint8(2),ry=d.getUint8(3);
  document.getElementById("ds5LS").textContent=`${lx} / ${ly}`;
  document.getElementById("ds5RS").textContent=`${rx} / ${ry}`;
  this.circle("l",lx,ly);this.circle("r",rx,ry);
  // Battery field used by DualSense USB input reports. Display only when plausible.
  if(d.byteLength>52){let raw=d.getUint8(52),level=raw&0x0f;if(level<=10)document.getElementById("ds5Battery").textContent=Math.min(100,level*10)+"%"}
 }
 circle(k,x,y){
  let nx=(x-127.5)/127.5,ny=(y-127.5)/127.5,dist=Math.hypot(nx,ny);
  if(dist>.70){let a=(Math.atan2(ny,nx)+Math.PI*2)%(Math.PI*2);this.circ[k].add(Math.floor(a/(Math.PI*2)*36))}
  document.getElementById(k==="l"?"ds5CircL":"ds5CircR").textContent=Math.round(this.circ[k].size/36*100)+"%";
 }
 async quickCenter(){
  try{
   this.log("No toques los joysticks. Calibrando centro...");
   await this.send(0x82,[1,1,1]);await this.assert83(1,1);
   await new Promise(r=>setTimeout(r,800));
   await this.send(0x82,[3,1,1]);
   await this.send(0x82,[2,1,1]);
   this.log("Centro calibrado temporalmente. Usa GUARDAR PERMANENTE para escribir los cambios.");
  }catch(e){this.log("Error de calibración de centro: "+e.message,true)}
 }
 async fourCenter(){
  try{
   await this.send(0x82,[1,1,1]);await this.assert83(1,1);
   this.wizard={type:"center",step:0,steps:[
    "PASO 1/4 · Deja ambos joysticks completamente libres y presiona CONTINUAR.",
    "PASO 2/4 · Mueve ambos joysticks y suéltalos al centro. Presiona CONTINUAR.",
    "PASO 3/4 · Vuelve a mover ambos joysticks y déjalos regresar solos al centro.",
    "PASO 4/4 · No toques los joysticks. Presiona CONTINUAR para finalizar."
   ]};this.showWizard("CALIBRACIÓN DE CENTRO · 4 PASOS",this.wizard.steps[0]);
  }catch(e){this.log("No se pudo iniciar la calibración: "+e.message,true)}
 }
 async range(){
  try{
   await this.send(0x82,[1,1,2]);await this.assert83(1,2);
   this.wizard={type:"range",step:0,steps:["Mueve ambos joysticks lentamente en círculos completos. Haz al menos 2 vueltas en un sentido y 2 en el contrario. Después presiona FINALIZAR RANGO."]};
   this.showWizard("CALIBRACIÓN DE RANGO",this.wizard.steps[0],"FINALIZAR RANGO");
  }catch(e){this.log("No se pudo iniciar rango: "+e.message,true)}
 }
 showWizard(title,text,button="CONTINUAR"){document.getElementById("ds5Wizard").classList.remove("hidden");document.getElementById("ds5WizardTitle").textContent=title;document.getElementById("ds5WizardText").textContent=text;document.getElementById("ds5WizardNext").textContent=button}
 async nextWizard(){
  if(!this.wizard)return;
  try{
   if(this.wizard.type==="range"){
    await this.send(0x82,[2,1,2]);
    this.endWizard("Rango calibrado temporalmente. Revisa los sticks y guarda si el resultado es correcto.");return;
   }
   await this.send(0x82,[3,1,1]);
   this.wizard.step++;
   if(this.wizard.step>=this.wizard.steps.length){
    await this.send(0x82,[2,1,1]);
    this.endWizard("Centro calibrado temporalmente con 4 muestras. Revisa y guarda si es correcto.");return;
   }
   document.getElementById("ds5WizardText").textContent=this.wizard.steps[this.wizard.step];
   if(this.wizard.step===this.wizard.steps.length-1)document.getElementById("ds5WizardNext").textContent="FINALIZAR CENTRO";
  }catch(e){this.endWizard("Error durante la calibración: "+e.message,true)}
 }
 endWizard(msg,bad=false){this.wizard=null;document.getElementById("ds5Wizard").classList.add("hidden");this.log(msg,bad)}
 async save(){
  try{
   this.log("Guardando calibración en memoria permanente...");
   await this.send(0x80,[3,2,101,50,64,12]);await this.recv(0x81);
   await this.send(0x80,[3,1]);await this.recv(0x81);
   this.log("Cambios guardados permanentemente en el DualSense.");
  }catch(e){this.log("Error al guardar permanentemente: "+e.message,true)}
 }
 async reboot(){try{await this.send(0x80,[1,1]);this.log("Comando de reinicio enviado al DualSense.")}catch(e){this.log("Error al reiniciar: "+e.message,true)}}
}
window.XEDS5=new XEDualSenseHID();

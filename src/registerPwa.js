export function registerPwa(){
 if(!('serviceWorker' in navigator))return;
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/service-worker.js',{scope:'/'}).catch(()=>{
   // Modo web continua funcionando mesmo sem instalação PWA.
  });
 });
}

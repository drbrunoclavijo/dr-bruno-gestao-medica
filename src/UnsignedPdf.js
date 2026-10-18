// Gerador mínimo de PDF para documentos FICTÍCIOS, sem dependências externas.
// Usa fonte Helvetica WinAnsi e mantém marca d'água textual de NÃO ASSINADO.
// NÃO fornece assinatura PAdES, autenticação ICP-Brasil ou validade para dispensação.
const encoder=new TextEncoder();
const cp1252Extra=new Map([[0x20ac,0x80],[0x201a,0x82],[0x192,0x83],[0x201e,0x84],
 [0x2026,0x85],[0x2020,0x86],[0x2021,0x87],[0x2c6,0x88],[0x2030,0x89],
 [0x160,0x8a],[0x2039,0x8b],[0x152,0x8c],[0x17d,0x8e],[0x2018,0x91],
 [0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],
 [0x2014,0x97],[0x2dc,0x98],[0x2122,0x99],[0x161,0x9a],[0x203a,0x9b],
 [0x153,0x9c],[0x17e,0x9e],[0x178,0x9f]]);
const asWinAnsi=s=>Array.from(String(s||'')).map(c=>{
 const n=c.codePointAt(0);
 if(n>=32&&n<=126)return c==='\\'?'\\\\':c==='('? '\\(' : c===')'?'\\)':c;
 const b=n>=160&&n<=255?n:cp1252Extra.get(n);
 return b===undefined?'?':'\\'+b.toString(8).padStart(3,'0');
}).join('');
const normalize=s=>String(s??'').replace(/[\r\t]+/g,' ').replace(/[\u0000-\u001f]/g,' ').trim();
function wrap(line,max=88){
 const words=normalize(line).split(/\s+/);
 const rows=[];let current='';
 for(let word of words){
  while(word.length>max){if(current){rows.push(current);current='';}rows.push(word.slice(0,max));word=word.slice(max);}
  if((current+' '+word).trim().length>max&&current){rows.push(current);current='';}
  current=(current+' '+word).trim();
 }
 if(current)rows.push(current);
 return rows.length?rows:[''];
}
function streamLines(data){
 const rows=[
  {text:'MAJESTIC SANTÉ INSTITUTE',size:15,leading:27,bold:true},
  {text:'DOCUMENTO DE TESTE | RASCUNHO NAO ASSINADO',size:11,leading:24,bold:true},
  {text:data.title,size:14,leading:25,bold:true},
  {text:'Paciente fictício: '+data.patientName,size:11,leading:17},
  {text:'Profissional: '+data.professionalName,size:11,leading:17},
  {text:'Data do registro: '+data.date,size:11,leading:24}
 ];
 for(const section of data.sections){
  rows.push({text:section.title,size:12,leading:20,bold:true});
  for(const part of String(section.content||'').split('\n')){
   for(const line of wrap(part))rows.push({text:line,size:10,leading:15});
  }
  rows.push({text:'',size:10,leading:6});
 }
 rows.push({text:'SEM ASSINATURA DIGITAL. DOCUMENTO FICTÍCIO SEM VALIDADE CLÍNICA.',size:9,leading:20,bold:true});
 return rows.flatMap(row=>(row.text.length>88?wrap(row.text,row.size>=14?54:88).map((text,i)=>({...row,text,leading:i===0?row.leading:16})): [row]));
}
export function generateUnsignedPdf(data){
 const lines=streamLines(data);
 const pages=[];let y=785;let commands=[];
 function page(){
  if(commands.length)pages.push(commands.join('\n'));
  commands=['0 0 0 rg','0.6 w','52 745 m 543 745 l S'];y=718;
 }
 page();
 for(const row of lines){
  const leading=row.leading??16;
  if(y-leading<64)page();
  if(row.text){
   const safe=asWinAnsi(row.text);
   commands.push('BT /'+(row.bold?'F2':'F1')+' '+(row.size||10)+' Tf 1 0 0 1 52 '+y+' Tm ('+safe+') Tj ET');
  }
  y-=leading;
 }
 if(commands.length)pages.push(commands.join('\n'));
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const pageIds=[];
 for(const [index,content] of pages.entries()){
  const pageId=objects.length;pageIds.push(pageId);
  const contentId=pageId+1;
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+contentId+' 0 R >>');
  const body=content+'\nBT /F2 9 Tf 1 0 0 1 52 32 Tm (TESTE - NAO ASSINADO - Pagina '+(index+1)+' de '+pages.length+') Tj ET';
  objects.push('<< /Length '+encoder.encode(body).length+' >>\nstream\n'+body+'\nendstream');
 }
 objects[2]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>';
 let pdf='%PDF-1.4\n';const offsets=[0];
 for(let i=1;i<objects.length;i++){
  offsets[i]=encoder.encode(pdf).length;
  pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const xref=encoder.encode(pdf).length;
 pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
 for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 return new Blob([encoder.encode(pdf)],{type:'application/pdf'});
}

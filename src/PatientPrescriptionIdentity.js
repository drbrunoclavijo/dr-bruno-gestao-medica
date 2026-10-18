// Dados de identificação para prévias médicas de TESTE; não verifica elegibilidade legal.
export const patientCpf=value=>{
 const d=String(value||'').replace(/\D/g,'');
 return d.length===11?d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):'Não informado';
};
export const patientAddress=patient=>{
 if(!patient)return 'Não informado';
 const parts=[
  [patient.logradouro,patient.numero].filter(Boolean).join(', '),
  patient.complemento,
  patient.bairro,
  [patient.cidade,patient.uf].filter(Boolean).join(' - '),
  patient.cep?'CEP '+patient.cep:null
 ].filter(Boolean);
 return parts.length?parts.join(' · '):'Não informado';
};
export const patientIdentification=patient=>({
 cpf:patientCpf(patient?.cpf),
 address:patientAddress(patient)
});

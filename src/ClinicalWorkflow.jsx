import React from 'react';

// Guia visual do atendimento: aciona formulários já existentes na MESMA ficha.
// Não altera status de agenda e não registra documentos automaticamente.
const steps=[
 {key:'consulta',number:'01',name:'Consulta e evolução',detail:'Revisar anamnese, exame, evolução e salvar quando estiver pronto.',anchor:'paciente-consulta-form'},
 {key:'domiciliar',number:'02',name:'Receita domiciliar',detail:'Preparar medicamentos para uso em casa, se indicados.',anchor:'paciente-receitas'},
 {key:'aplicacoes',number:'03',name:'Prescrição de aplicações',detail:'Prescrever itens de teste e conferir vínculos com o estoque.',anchor:'paciente-prescricoes'},
 {key:'finalizacao',number:'04',name:'Revisão e documentos',detail:'Revisar registros salvos, termos, PDFs e planejar o retorno.',anchor:'paciente-documentos'}
];
export default function ClinicalWorkflow({patientName,appointment,activeStep,onChoose}){
 return <section className="premium-panel clinical-workflow" aria-label="Fluxo de atendimento médico de teste">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">✧</span><div>
   <h3>Atendimento integrado</h3><p>{patientName} · uma sequência de trabalho sem sair da ficha</p>
  </div></div>
  {appointment&&<p className="clinical-workflow-appointment">Aberto pela agenda · {appointment.date?.split('-').reverse().join('/')} · {appointment.time||'horário não informado'}</p>}
  <div className="clinical-workflow-grid" role="group" aria-label="Etapas do atendimento">
   {steps.map(s=><button type="button" key={s.key}
    aria-pressed={activeStep===s.key} className={'clinical-workflow-step'+(activeStep===s.key?' clinical-workflow-step-current':'')}
    onClick={()=>onChoose(s.key,s.anchor)}>
    <span className="clinical-workflow-number">{s.number}</span>
    <span className="clinical-workflow-content"><strong>{s.name}</strong><small>{s.detail}</small></span>
    <span aria-hidden="true">↗</span>
   </button>)}
  </div>
  {activeStep==='finalizacao'&&<div className="clinical-workflow-review">
   <strong>Conferência antes de encerrar</strong>
   <p>Abra os registros já salvos abaixo, confira as informações, prepare os PDFs não assinados se necessário e consulte os termos na seção Documentos. O atendimento não será marcado como realizado automaticamente.</p>
   <div className="clinical-workflow-review-links">
    <a href="#paciente-prontuario">Histórico de evoluções</a>
    <a href="#paciente-receitas">Receitas domiciliares</a>
    <a href="#paciente-prescricoes">Prescrições de aplicações</a>
    <a href="#paciente-documentos">Documentos e termos</a>
   </div>
  </div>}
  <p className="profile-notice">Fluxo de testes com dados fictícios. Abrir uma etapa só exibe o formulário correspondente. Não há prescrição, salvamento, assinatura, envio ou conclusão automática.</p>
 </section>;
}

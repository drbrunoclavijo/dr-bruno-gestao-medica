import React,{useState} from 'react';

// Minutas orientadoras. Exigem revisão jurídica, de privacidade e do responsável técnico
// antes de serem utilizadas com pessoas reais. Nenhum campo representa consentimento dado.
export const termTemplates=[
 {id:'privacidade',title:'Ciência do aviso de privacidade e dados de saúde',body:
`Declaro ter recebido informações sobre como o estabelecimento identifica os responsáveis pelo tratamento, seus canais de contato, a finalidade de coletar dados cadastrais e de saúde para a assistência, a base legal aplicável, os direitos do titular, o prazo e os critérios de retenção e as condições de compartilhamento seguro.
Estou ciente de que o tratamento necessário à prestação da assistência e às obrigações legais pode ter bases legais distintas do consentimento.
Solicito esclarecimentos adicionais sobre: ________________________________________.`},
 {id:'imagem-assistencia',title:'Autorização para registro fotográfico clínico',body:
`Finalidade: registrar e comparar a evolução clínica no prontuário, exclusivamente para acompanhamento assistencial, quando cabível. As imagens não poderão ser publicadas ou usadas em publicidade com base neste documento.
Região corporal e tipo de registro: ________________________________________.
O profissional explicou a necessidade do registro, a proteção das imagens e as possibilidades de oposição ou solicitação de esclarecimentos conforme a base legal aplicável.
( ) AUTORIZO o registro para esta finalidade, quando depender de consentimento.
( ) NÃO AUTORIZO.
O atendimento não está condicionado à autorização de divulgação/publicidade.`},
 {id:'imagem-divulgacao',title:'Autorização independente para uso externo de imagem',body:
`Finalidade específica proposta: ________________________________________.
Canais pretendidos (identificar): ________________________________________.
Conteúdo e período de uso propostos: ________________________________________.
Estou ciente de que a divulgação pode permitir identificação, cópia ou circulação por terceiros, inclusive fora dos canais inicialmente previstos. A recusa não impede meu atendimento.
( ) AUTORIZO, de forma livre e destacada, a divulgação nos limites descritos.
( ) NÃO AUTORIZO a divulgação.
Posso solicitar a revogação para usos futuros pelos canais de atendimento informados, observadas as limitações de remoção do conteúdo já compartilhado por terceiros.
A autorização não dispensa cumprimento das normas éticas de publicidade médica.`},
 {id:'injetaveis',title:'Consentimento informado — administração de medicamentos injetáveis',body:
`Procedimento e medicamento(s) a serem especificados pelo profissional: __________________________.
Indicação, dose, via, intervalo e duração: ________________________________________.
Alternativas discutidas e consequências de não realizar: __________________________.
Riscos explicados, conforme o medicamento e a via, inclusive reações adversas, alergias, infecção e intercorrências: ________________________________________.
Informações sobre cuidados pré e pós-administração e quando buscar assistência: ________________________________________.
Tive oportunidade de fazer perguntas, fui informado(a) de que resultados não são garantidos e de que o plano pode ser revisto por indicação clínica.
( ) CONCORDO com o procedimento individualizado acima, após esclarecimento.
( ) NÃO CONCORDO.`},
 {id:'offlabel',title:'Ciência e consentimento informado — uso fora da indicação de bula',body:
`Medicamento e uso específico proposto: ________________________________________.
Justificativa clínica individual: ________________________________________.
Situação regulatória, evidências, incertezas, alternativas e riscos explicados: ________________________________________.
Estou ciente de que a indicação discutida não corresponde integralmente às informações aprovadas em bula, quando aplicável. Fui informado(a) de alternativas e da possibilidade de recusar.
( ) CONCORDO com o tratamento proposto após explicações.
( ) NÃO CONCORDO.
Este termo não substitui a avaliação de segurança, a prescrição regular e os registros no prontuário.`},
 {id:'procedimento-estetico',title:'Consentimento informado — procedimento estético',body:
`Procedimento, produto, região e finalidade: ________________________________________.
Resultados esperados e limitações: ________________________________________.
Riscos específicos, contraindicações, alternativas, número de sessões e cuidados posteriores discutidos: ________________________________________.
Foi esclarecido que não há garantia de resultado e que eventual documentação fotográfica e divulgação externa dependem de avaliação e autorizações separadas.
( ) CONCORDO após esclarecimentos.
( ) NÃO CONCORDO.`},
 {id:'mensagens',title:'Preferência de comunicação por WhatsApp',body:
`Número indicado para contato: ________________________________________.
( ) AUTORIZO mensagens administrativas, como agendamentos e confirmações, por WhatsApp.
( ) NÃO AUTORIZO contato por WhatsApp.
Estou ciente de que mensagens podem ser visualizadas por quem tenha acesso ao meu aparelho. Não autorizo, por este termo, o envio de exames, diagnósticos ou receitas. Uma autorização separada será solicitada para cada envio sensível, conforme fluxo aprovado.
Posso alterar minha preferência pelo canal de atendimento da clínica.`},
 {id:'responsavel',title:'Identificação de responsável legal e autorização específica',body:
`Nome do responsável legal: ________________________________________.
CPF do responsável legal: ________________________________________.
Qualidade da representação e documento de suporte conferido: ______________________.
A finalidade, os riscos e as alternativas relacionados ao atendimento ou procedimento específico foram explicados ao responsável e, conforme apropriado, ao paciente.
Procedimento/decisão: ________________________________________.
( ) CONCORDO após esclarecimento.
( ) NÃO CONCORDO.
Este modelo é apenas auxiliar e não substitui as regras de capacidade, representação ou consentimento aplicáveis ao caso.`}
];
const cleanCpf=value=>{const n=String(value||'').replace(/\D/g,'');return n.length===11?n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):String(value||'Não informado')};
export default function PatientTerms({patient,role}){
 const [selected,setSelected]=useState(termTemplates[0].id);
 const template=termTemplates.find(t=>t.id===selected)||termTemplates[0];
 const [edited,setEdited]=useState({});
 const [version,setVersion]=useState('');
 const body=edited[selected]??template.body;
 const [printTarget,setPrintTarget]=useState(false);
 function print(){
  setPrintTarget(true);
  // Browser print apenas após clique explícito do usuário; não produz assinatura.
  window.setTimeout(()=>{window.print();setPrintTarget(false);},75);
 }
 return <section className="premium-panel patient-terms" id="paciente-termos">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">▤</span><div><h3>Termos e autorizações — minutas de teste</h3><p>Preenchimento automático de nome e CPF, revisão, impressão e arquivo posterior.</p></div></div>
  <p className="profile-notice">Minutas para revisão jurídica e clínica. Nenhuma autorização é presumida; apenas a assinatura física ou outro método válido após esclarecimento documenta a manifestação do paciente. Imprimir não significa que houve consentimento. Não usar dados reais neste ambiente de testes.</p>
  {role!=='medico'?<p>Acesso não autorizado.</p>:<>
   <div className="clinical-fields terms-controls">
    <label>Modelo de documento
     <select value={selected} onChange={e=>setSelected(e.target.value)}>{termTemplates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
    </label>
    <label>Versão interna da minuta (opcional)<input maxLength={60} value={version} onChange={e=>setVersion(e.target.value)} placeholder="Ex.: revisão jurídica pendente"/></label>
    <label className="full-span">Revisar e personalizar o termo para o procedimento específico
     <textarea rows={12} value={body} onChange={e=>setEdited(o=>({...o,[selected]:e.target.value}))}/>
    </label>
   </div>
   <div className="terms-actions">
    <button type="button" className="outline-gold" onClick={()=>setEdited(o=>({...o,[selected]:template.body}))}>Restaurar minuta</button>
    <button type="button" className="gold-button" onClick={print}>Imprimir termo para assinatura</button>
   </div>
   <div className={'terms-print-sheet'+(printTarget?' terms-print-target':'')}>
    <header className="terms-paper-header"><strong>Majestic Santé Institute</strong><span>DOCUMENTO DE TESTE · MINUTA PARA REVISÃO</span></header>
    <h3>{template.title}</h3>
    <div className="terms-identification"><p><strong>Paciente:</strong> {patient.nome}</p><p><strong>CPF:</strong> {cleanCpf(patient.cpf)}</p></div>
    {version&&<p><strong>Versão:</strong> {version}</p>}
    <div className="terms-body">{body}</div>
    <p>Foz do Iguaçu, ______ de ____________________ de __________.</p>
    <div className="terms-signatures">
     <div>Assinatura do paciente ou responsável</div>
     <div>Assinatura do profissional que prestou esclarecimentos</div>
    </div>
    <p className="terms-paper-warning">MINUTA DE TESTE · NÃO COMPROVA CONSENTIMENTO · NECESSITA REVISÃO ANTES DE USO REAL</p>
   </div>
   <p className="profile-notice">Depois de imprimir e obter a assinatura, digitalize o documento e utilize a seção **Documentos e imagens do paciente → Outros documentos** logo abaixo para anexá-lo à ficha. Identifique o título e a versão. O upload permanece restrito ao perfil médico conforme as permissões atuais.</p>
  </>}
 </section>;
}

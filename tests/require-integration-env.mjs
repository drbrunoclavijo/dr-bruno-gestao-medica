// Impede que npm run test:integration pareca aprovado sem credenciais de homologacao.
const required=['SUPABASE_TEST_URL','SUPABASE_TEST_ANON_KEY',
 'TEST_MEDICO_EMAIL','TEST_MEDICO_PASSWORD',
 'TEST_ENFERMEIRA_EMAIL','TEST_ENFERMEIRA_PASSWORD',
 'TEST_EQUIPE_EMAIL','TEST_EQUIPE_PASSWORD'];
const missing=required.filter(x=>!process.env[x]);
if(missing.length){
 console.error('Teste autenticado nao executado: configure as variaveis de homologacao: '+missing.join(', '));
 process.exitCode=1;
}else{
 const url=process.env.SUPABASE_TEST_URL;
 if(!/^https:\/\//.test(url)){console.error('Use URL HTTPS de homologacao.');process.exitCode=1;}
 else console.log('Credenciais de 3 perfis presentes. Gerente e inativo sao opcionais; resultados omitidos se nao configurados.');
}

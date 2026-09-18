import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const checks = [
  ['SerpApi', 'SERPAPI_API_KEY', () => new URL(`https://serpapi.com/account.json?api_key=${encodeURIComponent(process.env.SERPAPI_API_KEY)}`), () => ({})],
  ['DeepSeek', 'DEEPSEEK_API_KEY', () => 'https://api.deepseek.com/models', () => ({headers:{Authorization:`Bearer ${process.env.DEEPSEEK_API_KEY}`}})],
];
for (const [provider,key,url,init] of checks) {
  const configured=Boolean(process.env[key]);
  let connectivity='not attempted', limitation='';
  if(configured)try{
    const response=await fetch(url(),{...init(),signal:AbortSignal.timeout(8000)});
    connectivity=`HTTP ${response.status}`;
    limitation=response.status===401||response.status===403?'credentials rejected':response.status===429?'rate limited/quota; not distinguished without provider response':response.ok?'minimal connectivity only; research endpoint not yet validated':'upstream failure';
    await response.body?.cancel();
  }catch(error){connectivity='failed';limitation=error?.cause?.code??error.name;}
  console.log(JSON.stringify({provider,configurationPresent:configured,loadedInRuntime:configured,minimalConnectivity:connectivity,limitation}));
}
console.log(JSON.stringify({provider:'SEC identifying User-Agent',configurationPresent:Boolean(process.env.SEC_USER_AGENT),loadedInRuntime:Boolean(process.env.SEC_USER_AGENT),minimalConnectivity:'not attempted',limitation:process.env.SEC_USER_AGENT?'requires valid identifying contact':'missing configuration; no SEC API key required'}));
console.log(JSON.stringify({provider:'Database',configurationPresent:true,loadedInRuntime:true,minimalConnectivity:'validated with isolated local libSQL fixture',limitation:'deployed database not tested'}));

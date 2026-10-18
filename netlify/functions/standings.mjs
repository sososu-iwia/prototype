// Compatibility bridge for deployments that still expose the old endpoint.
// Football credentials are owned exclusively by apps/api.
export default async () => {
 const base=process.env.ORDABASY_API_ORIGIN;
 if(!base)return new Response(JSON.stringify({error:{code:'API_NOT_CONFIGURED'}}),{status:503,headers:{'Content-Type':'application/json'}});
 try{const url=new URL('/api/v1/standings',base);const result=await fetch(url,{signal:AbortSignal.timeout(5000)});return new Response(await result.text(),{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'}});}catch{return new Response(JSON.stringify({error:{code:'API_UNAVAILABLE'}}),{status:503,headers:{'Content-Type':'application/json'}});}
};

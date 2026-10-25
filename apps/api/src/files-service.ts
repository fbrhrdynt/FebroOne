import {z} from 'zod';
function config(){
 const token=process.env.FEBRO_ONE_FILES_SERVICE_TOKEN;
 const u=new URL(process.env.FEBRO_FILES_API_URL||'http://127.0.0.1:3480');
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!(u.hostname==='127.0.0.1'||u.hostname==='localhost'||u.protocol==='https:'))throw new Error('Invalid Files URL');
 return {token,base:u.origin};
}
export function remoteFilesEnabled(){return !!config().token;}
export async function filesCall(method:string,route:string,body?:Buffer){
 const {base,token}=config();if(!token||token.length<48)throw Object.assign(new Error('File service unavailable'),{statusCode:503});
 const res=await fetch(base+'/api/integrations/v1/files'+route,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/octet-stream'}:{})},body:body as any});
 if(!res.ok)throw Object.assign(new Error('File service unavailable'),{statusCode:503});return res;
}
export async function uploadRemoteFile(recordId:string,name:string,data:Buffer){
 const r=await filesCall('POST','?'+new URLSearchParams({kind:'attachment',entry:recordId,name}),data);
 const result=await r.json() as any;return z.uuid().parse(result.item?.id);
}

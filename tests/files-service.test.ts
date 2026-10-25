import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {uploadRemoteFile,filesCall,remoteFilesEnabled} from '../apps/api/src/files-service';
test('One file adapter uses private service API, fails closed and retains local mode',async()=>{
 const old={...process.env};const token='f'.repeat(64),fid=randomUUID(),rid=randomUUID();let fail=false;const calls:any[]=[];
 const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;calls.push({url:req.url,auth:req.headers.authorization,raw});if(fail){res.writeHead(403);res.end('{}');return;}res.setHeader('content-type','application/json');res.end(JSON.stringify({item:{id:fid}}));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{
 delete process.env.FEBRO_ONE_FILES_SERVICE_TOKEN;assert.equal(remoteFilesEnabled(),false);
 process.env.FEBRO_ONE_FILES_SERVICE_TOKEN=token;process.env.FEBRO_FILES_API_URL='http://127.0.0.1:'+(server.address() as any).port;
 assert.equal(await uploadRemoteFile(rid,'private.pdf',Buffer.from('%PDF-')),fid);
 assert.equal(calls[0].auth,'Bearer '+token);assert.equal(calls[0].url,`/api/integrations/v1/files?kind=attachment&entry=${rid}&name=private.pdf`);
 fail=true;await assert.rejects(filesCall('GET','/'+fid+'/download'),/unavailable/);
 process.env.FEBRO_FILES_API_URL='http://169.254.169.254';assert.throws(remoteFilesEnabled,/Invalid/);
 }finally{process.env=old;await new Promise<void>(r=>server.close(()=>r()));}
});

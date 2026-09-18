import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
nextEnv.loadEnvConfig(process.cwd());
const directory=await mkdtemp(join(tmpdir(),'clara-funding-live-'));
const environment={...process.env,CLARA_LOCAL_DATABASE_PATH:join(directory,'clara.db'),TURSO_DATABASE_URL:'',LIBSQL_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',LIBSQL_AUTH_TOKEN:''};
// The stores use nullish fallback: remove remote database vars, and prevent Next's second load restoring them.
for(const key of ['TURSO_DATABASE_URL','LIBSQL_DATABASE_URL','TURSO_AUTH_TOKEN','LIBSQL_AUTH_TOKEN'])delete environment[key];
environment.__NEXT_PROCESSED_ENV='true';
console.log(JSON.stringify({isolatedDatabase:environment.CLARA_LOCAL_DATABASE_PATH,server:'http://127.0.0.1:3012'}));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3012'],{env:environment,stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));

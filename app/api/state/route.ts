import { env } from 'cloudflare:workers';
import { createApi } from '../../../lib/state.mjs';
export type Student={id:string;name:string;room:string};
export type Trip={id:string;studentId:string;reason:string;teacher:string;room:string;out:number;back:number|null};
export type Rule={id:string;name:string;members:string[]};
export type State={students:Student[];trips:Trip[];rules:Rule[]};
export function GET() { return createApi(env.DB).GET(); }
export function POST(request: Request) { return createApi(env.DB).POST(request); }

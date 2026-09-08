// Minimal runtime globals for local TypeScript checking without installing Deno.
declare const Deno: {env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Response|Promise<Response>):unknown};

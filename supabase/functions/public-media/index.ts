import {mediaHandler} from '../_shared/media.ts';
Deno.serve(mediaHandler(name=>Deno.env.get(name)));

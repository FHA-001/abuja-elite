import {submissionHandler} from '../_shared/submissions.ts';
Deno.serve(submissionHandler(name=>Deno.env.get(name)));

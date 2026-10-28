import { Script } from 'scripting'
// Compatibility entry for existing shortcuts: never claim/replay remote work.
// Stored credentials, journals, outboxes and native records remain untouched.
Script.exit({ok:false,disabled:true,reason:'Calendar Timeline Bridge foi retirada. O widget continua lendo a agenda e os lembretes localmente.'})

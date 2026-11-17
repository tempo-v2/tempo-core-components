import {build} from 'esbuild'; await build({entryPoints:['main.jsx'],bundle:true,format:'esm',outdir:'public',loader:{'.svg':'file'}});

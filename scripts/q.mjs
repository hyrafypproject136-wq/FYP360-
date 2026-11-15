import { sql } from './sbenv.mjs'
console.log(JSON.stringify(await sql(process.argv[2]), null, 0))

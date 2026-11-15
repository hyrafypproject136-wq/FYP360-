import fs from 'node:fs'
import { sql } from './sbenv.mjs'
const f = process.argv[2]
try { await sql(fs.readFileSync(f, 'utf8')); console.log('applied', f) } catch (e) { console.log('FAILED', f, e.message); process.exit(1) }

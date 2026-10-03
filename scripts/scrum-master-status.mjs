#!/usr/bin/env node
// Read-only local CoS interface. No network, credentials, mutations or worker launch.
import os from 'node:os';
import path from 'node:path';
import {readScrumMasterSummary} from '../services/assistant-web/lib/scrum-master-summary.mjs';
if(process.argv.length>2){console.error('Usage: node scripts/scrum-master-status.mjs');process.exitCode=2;}
else console.log(JSON.stringify(readScrumMasterSummary(path.join(os.homedir(),'.local/state/bamware/owner-blockers')),null,2));

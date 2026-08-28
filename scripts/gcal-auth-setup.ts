// Run once whenever credentials.json's OAuth client changes:
//   npx tsx scripts/gcal-auth-setup.ts
import { runAuthSetup } from "../app/agents/tools/gcal/client";

runAuthSetup().catch((err) => {
  console.error(err);
  process.exit(1);
});

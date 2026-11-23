import { execFileSync } from "node:child_process";

// El deployment público se actualiza EN EL LUGAR para conservar la URL.
// Configurá el ID con la variable de entorno CLASP_DEPLOYMENT_ID o en un
// archivo .env local (no se sube al repo).
//
// Primera vez:
//   1) npm run push
//   2) npx clasp deploy -d "primer deploy"   -> imprime el deploymentId
//   3) export CLASP_DEPLOYMENT_ID="AKfycb..."
//
// Siguientes veces:
//   npm run deploy
const DEPLOYMENT_ID = process.env.CLASP_DEPLOYMENT_ID || "";

const descripcion = process.argv.slice(2).join(" ").trim()
  || `deploy ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;

execFileSync("npx", ["clasp", "push", "--force"], { stdio: "inherit" });

const args = ["clasp", "deploy"];
if (DEPLOYMENT_ID) args.push("-i", DEPLOYMENT_ID);
args.push("-d", descripcion);

execFileSync("npx", args, { stdio: "inherit" });

if (DEPLOYMENT_ID) {
  console.log(`\nDeployment actualizado sin cambiar la URL (${descripcion}).`);
} else {
  console.log("\nDeployment NUEVO creado: copiá el deploymentId de arriba a CLASP_DEPLOYMENT_ID para conservar la URL en los próximos deploys.");
}

import { readSourceTarget, readViteArgs, spawnWebPlayer } from "./dev-web-player-lib";

const args = process.argv.slice(2);
const sourceTarget = readSourceTarget(args, ".");
const viteArgs = readViteArgs(args);
const child = spawnWebPlayer({ sourceTarget, viteArgs });

process.exit(await child.exited);

#!/usr/bin/env node
// Auditoría de aislamiento multi-tenant: toda ruta bajo /api/proyectos/[id]/**
// debe comprobar que el proyecto es del usuario (projectForSession) en CADA
// handler, también en los GET de listado. Un handler que filtra solo por
// `projectId: id` deja leer, editar o borrar proyectos ajenos con solo conocer
// su id. Uso: `npm run audit:guards` (sale con código 1 si hay alguno).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src/app/api/proyectos", import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : name === "route.ts" ? [p] : [];
  });
}

const bad = [];
for (const file of walk(ROOT)) {
  // /api/proyectos/route.ts (listar y crear) filtra por userId, no por [id].
  if (!file.includes("[id]")) continue;
  const chunks = readFileSync(file, "utf8").split(/(?=^export async function )/m).slice(1);
  for (const chunk of chunks) {
    const name = chunk.match(/^export async function (\w+)/)[1];
    if (!chunk.includes("projectForSession")) bad.push(`${file.replace(ROOT, "proyectos")} ${name}`);
  }
}

if (bad.length) {
  console.error("Handlers SIN comprobación de propietario (projectForSession):\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("OK: todos los handlers de /api/proyectos/[id]/** comprueban el propietario del proyecto.");

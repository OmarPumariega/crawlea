# Documentación de SEO Ciro

Base de conocimiento de **SEO Ciro**, el SaaS SEO multi-usuario (en transición desde
el panel interno de Agencia Ciro) que centraliza todo el trabajo SEO sobre proyectos
(clientes/dominios), conectado a APIs reales.

> Si algo no está aquí, está en el código fuente (referenciado con `archivo:linea`)
> o no existe todavía.

## Empezar aquí

- **Primera vez viendo el repo (humano o IA)** → [`../README.md`](../README.md) y
  [`../AGENTS.md`](../AGENTS.md) en la raíz — resumen rápido antes de entrar aquí
  ([`../CLAUDE.md`](../CLAUDE.md) si trabajas con Claude Code)
- **Voy a tocar código** → [`00-protocolo-trabajo.md`](./00-protocolo-trabajo.md)
  PRIMERO (invariantes, recetas, checklist) y [`06-roadmap-saas.md`](./06-roadmap-saas.md)
  (en qué fase estamos y qué toca ahora)
- **Quiero entender qué es esto** → [`spec-original.md`](./spec-original.md) (spec
  funcional completa de los 9 módulos) y [`01-vision-general.md`](./01-vision-general.md)
- **Necesito el modelo de datos** → [`04-modelo-de-datos.md`](./04-modelo-de-datos.md)
- **Dudas de login/roles/aislamiento** → [`05-autenticacion.md`](./05-autenticacion.md)

## Índice

| Doc | Qué cubre |
|---|---|
| [00 — Protocolo de trabajo](./00-protocolo-trabajo.md) | Cómo trabajar aquí: invariantes no negociables, recetas, checklist, gotchas, coordinación entre agentes/personas |
| [spec-original.md](./spec-original.md) | Especificación funcional completa (9 módulos, APIs, costes, orden de construcción) |
| [01 — Visión general](./01-vision-general.md) | Qué está construido hoy vs. qué queda pendiente del spec |
| [02 — Arquitectura](./02-arquitectura.md) | Stack, estructura de carpetas, decisiones de infraestructura |
| [03 — Entorno de desarrollo](./03-entorno-desarrollo.md) | Setup local, variables de entorno, comandos |
| [04 — Modelo de datos](./04-modelo-de-datos.md) | Esquema Prisma actual y su evolución prevista por módulo |
| [05 — Autenticación](./05-autenticacion.md) | Google OAuth + credentials, roles, aislamiento multi-tenant, suspensión |
| [06 — Roadmap SaaS](./06-roadmap-saas.md) | Decisiones de producto aprobadas y estado de las 5 fases de la transición a SaaS |
| [seo-rules.md](./seo-rules.md) | Reglas de título/meta descripción que sigue el Módulo 3 (intención de búsqueda, límites de caracteres, marca, qué evitar) |

## Convenciones

- **Idioma:** español (igual que la UI y el equipo)
- **Referencias al código:** formato `ruta/del/archivo.ts:LINEA`
- **Secrets:** nunca se incluyen valores reales, solo placeholders
- **El roadmap manda:** el estado de las fases vive en `06-roadmap-saas.md` y se
  actualiza en el mismo commit que el cambio
- Este proyecto es hermano de **Cirochat** (`../../Cirochat/cirochat-app`) y reutiliza
  sus patrones de infraestructura (auth, cifrado, Docker/Traefik) allí donde encajan

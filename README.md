# Leads / Ventas — MisTatas / AMAIA

SPA interna para gestión de Leads y Ventas con Firebase (Auth + Firestore), auditoría basada en eventos y UI operativa en español.

- Frontend: React 18 + TypeScript (strict) + Vite
- Estilos: Tailwind CSS
- Firebase: Auth + Firestore (Analytics opcional)
- Hosting: GitHub Pages (app 100% cliente)

## Requisitos

- Node.js 20 (recomendado)

## Instalación y ejecución

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

## Configuración (Firebase)

La app espera variables `VITE_*` (ver `.env.example`).

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)

Nota: al ser una SPA en GitHub Pages, la configuración web de Firebase no es secreta. La seguridad real se aplica con Firebase Auth + Firestore Security Rules.

## Arquitectura (resumen)

### Auditoría por eventos

- Colección `events`: cada cambio relevante genera un evento (entity/field/values).
- Helper reutilizable para updates + auditoría: `src/services/_internal/updateWithEvents.ts`.
  - Detecta cambios reales campo a campo
  - Hace un solo `updateDoc` con `cleanUndefined`
  - Emite un evento por campo modificado (requiere `saleId` explícito)

### Errores de dominio tipados

- Contrato base: `src/models/domainResult.ts`
  - `DomainResult<T, E>`
  - `SaleDomainError`
- Mapping UX (mensajes humanos): `src/utils/domainErrorMessages.ts`
- Ejemplo integrado: `closeSale` retorna `DomainResult` y la UI consume `saleErrorMessages`.

## Alias de imports

Se usa alias `@/` apuntando a `src/` (TypeScript + Vite):

- TypeScript: `tsconfig.json` (`paths`)
- Vite: `vite.config.ts` (`resolve.alias`)

## Estructura del repo

- `src/app/`: pantallas (dashboard, leads, sales, login, clients)
- `src/components/`: layout + cards + ui primitives
- `src/hooks/`: hooks de listeners y auth
- `src/models/`: contratos de dominio
- `src/services/`: integración Firebase/Firestore
- `src/utils/`: helpers (labels, alertas runtime, sanitización)

## Documentación extendida

Para onboarding técnico-funcional completo: `resumen_app.md`.

---

Roberto Rojas Z. - Mistatas

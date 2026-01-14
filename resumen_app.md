# Resumen integral de la app (Leads / Ventas)

Este documento es el “onboarding” técnico-funcional de la app. Su objetivo es que cualquier IA o Programador/a Senior Full Stack pueda entender la arquitectura, reglas de negocio, estructura del repo y los puntos críticos para colaborar sin romper contratos de datos ni lógica.

> Nota: es una SPA 100% cliente (Vite + React) desplegable en GitHub Pages. No existe backend propio. La seguridad real la entregan Firebase Auth + Firestore Security Rules.

---

## 1) Objetivo del producto

App interna para gestión de Leads y Ventas con:

- Autenticación (Firebase Auth).
- Persistencia (Firestore).
- Auditoría obligatoria por cambios mediante **Events**.
- Alertas **runtime** (no persistidas) calculadas desde estado + eventos.
- Política “no deletes”: se archiva en vez de borrar.
- UI en español, orientada a operación.

---

## 2) Stack y dependencias

### Frontend
- React 18 + TypeScript strict.
- Vite (build y dev server).
- Tailwind CSS v3 (estilos utilitarios).
- UI primitives tipo “shadcn-like” (componentes mínimos propios: `Button`, `Card`, etc.).
- Iconos: `lucide-react`.
- Toasts: `sonner`.

### Firebase
- Firebase Web SDK:
  - Auth
  - Firestore
  - Analytics opcional (no bloqueante)

### Hosting/CI
- GitHub Pages.
- GitHub Actions workflow para build + deploy.

---

## 3) Cómo ejecutar y configurar

### Requisitos
- Node.js 20 (recomendado, coincide con CI).

### Comandos
- Desarrollo: `npm run dev`
- Build producción: `npm run build`
- Preview: `npm run preview`

### Variables de entorno
Archivo de ejemplo: `.env.example`

Variables esperadas (Vite):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (opcional)

Firebase config en cliente:
- `src/services/firebase.ts` usa `.env` si existe; si no, cae en un `defaultFirebaseConfig`.
- Importante: **la config web de Firebase no es secreta** en una SPA (GitHub Pages). La seguridad debe estar en reglas de Firestore.

### Firestore Rules (recordatorio)
- Si las reglas están como `allow read, write: if false;`, la app “no escribe” (y se verán errores por consola).
- En dev, típicamente se habilita algo como `request.auth != null` para pruebas.

---

## 4) Estructura del repositorio

Árbol principal:

- `src/`
  - `app/` (pantallas)
    - `dashboard/DashboardPage.tsx`
    - `leads/LeadsPage.tsx`
    - `sales/SalesPage.tsx`
    - `login/LoginPage.tsx`
    - `clients/ClientsPage.tsx` (placeholder)
  - `components/`
    - `layout/` (`AppShell`, `Sidebar`, `Topbar`)
    - `cards/` (tarjetas del detalle de Venta)
    - `checklist/` (`SaleChecklist`)
    - `timeline/` (`SaleTimeline`)
    - `ui/` (primitives: `button`, `card`, `input`, `label`)
  - `hooks/` (hooks para Auth y listeners Firestore)
  - `models/` (contratos TS del dominio)
  - `services/` (integración Firebase: Auth/Firestore)
  - `utils/` (helpers: sanitización, labels, alertas, región, folio)
- `.github/workflows/deploy.yml` (build+deploy GitHub Pages)
- `vite.config.ts` (`base: './'` para Pages)
- `tailwind.config.js`, `postcss.config.js`
- `tsconfig.json` (strict)

---

## 5) Navegación y “rutas”

**No se usa `react-router`**: la navegación es por estado interno.

- Entry: `src/main.tsx` renderiza `src/App.tsx`.
- `src/App.tsx`:
  - Si hay usuario autenticado: muestra `AppShell`.
  - Si no: muestra `LoginPage`.
- `src/components/layout/AppShell.tsx`:
  - Maneja el “routing” por `section`:
    - `dashboard`
    - `leads`
    - `sales`
    - `clients` (pendiente)

Esto simplifica hosting estático y evita rutas URL.

---

## 6) Modelo de dominio (TypeScript)

Los modelos viven en `src/models/` y se usan como contratos. Regla cultural del proyecto: **no inventar campos**.

### Sale
Archivo: `src/models/Sale.ts`

- `status`: `'lead' | 'in_progress' | 'closed' | 'archived'`
- `clientId`: referencia a `clients/{id}`
- `plan`: union de planes (modelo actual incluye `MIXTO`)
- `modality`: `CON_TELEASISTENCIA | SIN_TELEASISTENCIA`
- `serviceRegion?` (derivada usualmente desde beneficiario)
- `createdAt`, `closedAt?`, `archivedAt?`

**Nota importante (compatibilidad UI vs modelo):**
- La UX define plan “FLEXIBLE”.
- El modelo existente usa `MIXTO`.
- La UI muestra `FLEXIBLE` pero persiste `MIXTO` para no cambiar el modelo (ver `ContractedPlanCard`).

### Client
Archivo: `src/models/Client.ts`

- `fullName` obligatorio
- `rut?` deseable y único
- `phone?`, `email?`, `address?`, `profession?`, `region?`

### Beneficiary
Archivo: `src/models/Beneficiary.ts`

- `saleId` obligatorio
- `fullName`, `serviceAddress`, `region` obligatorios
- `rut?`

### CommercialTerms
Archivo: `src/models/CommercialTerms.ts`

- `basePrice`, `discountPercentage`, `finalPrice`
- confirmaciones:
  - `discountConfirmed`
  - `finalPriceConfirmed`

### SaleStep
Archivo: `src/models/SaleStep.ts`

- `type`: `CONTRACT | PAYMENT | DEVICE_CONFIG | CREDENTIALS | SHIPPING | INSTALLATION | REMOTE_SUPPORT`
- `status`: `PENDING | IN_PROGRESS | DONE | SENT | SIGNED`
- `method?` (solo pago): `FLOW | TRANSFERENCIA | EFECTIVO`
- `metadata?` (trackingCode, signatureType)

### Event
Archivo: `src/models/Event.ts`

- `entity`: `CLIENT | SALE | BENEFICIARY | COMMERCIAL | STEP`
- `field`: string (nombre del campo lógico modificado)
- `previousValue?`, `newValue?`, `comment?`
- `createdAt`

---

## 7) Firestore: colecciones y relaciones

Colecciones usadas (nombres “hardcoded” en servicios):

- `clients`
  - Documentos de Cliente.
- `sales`
  - Documentos de Venta/Lead.
- `events`
  - Auditoría: **cada cambio relevante genera un evento**.
- `beneficiaries`
  - 1 beneficiario “actual” por venta. “Eliminar” se modela como reemplazo (evento `replaced`).
- `commercial_terms`
  - 1 registro por venta.
- `sale_steps`
  - 1 doc por step requerido.

Relaciones:
- `sales.clientId -> clients/{id}`
- `beneficiaries.saleId -> sales/{id}`
- `commercial_terms.saleId -> sales/{id}`
- `sale_steps.saleId -> sales/{id}`
- `events.saleId -> sales/{id}`

---

## 8) Servicios (capa de integración Firebase)

### `authService`
Archivo: `src/services/auth.service.ts`

- `onAuthStateChanged(cb)`
- `signInWithEmailAndPassword(email, password)`
- `signOut()`

### `eventsService`
Archivo: `src/services/events.service.ts`

Responsabilidad: escribir y escuchar eventos.

- `createEvent({ saleId, userId, entity, field, previousValue?, newValue?, comment? })`
  - Escribe en `events`.
  - Usa `serverTimestamp()`.
  - Pasa payload por `cleanUndefined()` para evitar `undefined`.
- `listenSaleEvents(saleId, cb)` ordenado por `createdAt desc`.
- `listenRecentEvents(take, cb)`.

### `salesService`
Archivo: `src/services/sales.service.ts`

Responsabilidad: CRUD (sin deletes) de ventas y entidades dependientes + reglas de negocio + emisión de eventos.

Funciones clave (resumen):

#### Listeners
- `listenSales(cb, status?)` → lista de `sales` (filtra por status cuando se pide).
- `listenSaleSteps(saleId, cb)`.
- `listenClient(clientId, cb)`.
- `listenBeneficiaryBySale(saleId, cb)`.
- `listenCommercialTermsBySale(saleId, cb)`.

#### Lectura batched para UX
- `getClientsByIds(clientIds)`
  - Usa `where(documentId(), 'in', chunk)` con chunks de 10 (límite Firestore).
  - Se usa para mostrar nombres en listas sin exponer IDs.

#### Leads y ventas
- `createLead(input, actorUserId)`
  - Crea/recicla cliente (dedupe por RUT si viene).
  - Crea Sale con `status='lead'` (plan/modality pueden faltar en lead).
  - Crea eventos de creación.
  - Importante: `cleanUndefined()` en todos los writes.

- `convertLeadToInProgress(saleId, actorUserId)`
  - Cambia status a `in_progress` y crea evento.

- `closeSale({ saleId, actorUserId })`
  - Reglas antes de cerrar:
    - `sale.plan` y `sale.modality` definidos (si no: `sale_incomplete`).
    - Beneficiario existe (si no: `beneficiary_required`).
    - Step `CONTRACT` en `SIGNED` (si no: `contract_not_signed`).
  - Actualiza status a `closed` + `closedAt`.
  - Evento `SALE.status`.

- `archiveSale({ saleId, actorUserId })`
  - Cambia status a `archived` + `archivedAt`.
  - Evento `SALE.status`.

#### Plan contratado (nuevo UX)
- `updateSalePlanAndModality({ saleId, actorUserId, plan?, modality? })`
  - Actualiza `sales/{saleId}`.
  - Emite eventos `SALE.plan` y/o `SALE.modality`.

#### Cliente
- `updateClient({ saleId, clientId, actorUserId, patch })`
  - Enforce: unicidad de `rut`.
  - Normaliza `region` a valores controlados.
  - Evento por campo cambiado.

#### Beneficiario
- `upsertBeneficiary({ saleId, actorUserId, mode, beneficiary })`
  - `mode='replace'` registra evento `BENEFICIARY.replaced`.
  - Eventos por campo.
  - Además, define `sales.serviceRegion` desde `beneficiary.region` y genera evento.

#### Términos comerciales
- `upsertCommercialTerms({ saleId, actorUserId, terms })`
  - Guarda/actualiza en `commercial_terms`.
  - Eventos por campo.

#### Pasos (SaleStep)
- `ensureSaleStepsForSale({ saleId, actorUserId, serviceRegion? })`
  - Calcula steps requeridos (por región) y crea faltantes con status inicial.
  - Evento `STEP.status` al inicializar.
- `updateSaleStep({ saleId, actorUserId, type, status?, method? })`
  - Actualiza step + eventos.

---

## 9) Hooks (suscripción a estado)

Archivo principal: `src/hooks/useSales.ts`

- `useSales(status?)` → lista de ventas/leads por status.
- `useSaleEvents(saleId)` → timeline/historial.
- `useSaleSteps(saleId)` → pasos.
- `useClient(clientId)`.
- `useBeneficiary(saleId)`.
- `useCommercialTerms(saleId)`.
- `useClientsByIds(clientIds[])` → mapa `id -> ClientView` para listas.

Auth:
- `src/hooks/useAuth.ts` usa `authService.onAuthStateChanged`.

---

## 10) UI/Pantallas

### Login
Archivo: `src/app/login/LoginPage.tsx`

- Form email + contraseña.
- Toast success/error.

### Dashboard
Archivo: `src/app/dashboard/DashboardPage.tsx`

- Métricas runtime (no persistidas).
- Filtros (estado + plan contiene).
- Lista de ventas (filtradas) con nombre humano + folio.
- “Últimas conversiones” basado en eventos `SALE.status`.

### Leads
Archivo: `src/app/leads/LeadsPage.tsx`

- Crear lead (nombre obligatorio + teléfono/email obligatorio).
- Lista de leads con:
  - Título: `Client.fullName` (no IDs largos).
  - Folio numérico (visual).
- Detalle:
  - Identidad humana.
  - Convertir a venta (`in_progress`).
  - Lista de verificación + historial.

### Ventas (in_progress)
Archivo: `src/app/sales/SalesPage.tsx`

- Lista de ventas en progreso (nombre humano + folio).
- Detalle compuesto por tarjetas:
  - Identificación
  - Acciones (cerrar/archivar)
  - Plan contratado (nuevo)
  - Cliente
  - Beneficiario
  - Términos comerciales
  - Pasos
  - Lista de verificación
  - Historial

### Clientes
Archivo: `src/app/clients/ClientsPage.tsx`

- Placeholder.

---

## 11) Componentes clave (Cards)

Carpeta: `src/components/cards/`

- `ClientInfoCard`: edición de datos de cliente. Cada cambio genera eventos.
- `BeneficiaryCard`: guarda o reemplaza beneficiario.
  - Reemplazo dispara evento `BENEFICIARY.replaced`.
  - `beneficiary.region` define `sale.serviceRegion`.
- `CommercialTermsCard`:
  - Confirmaciones obligatorias.
  - UX: autocalcula `finalPrice = basePrice * (1 - discountPercentage / 100)`.
  - Permite override manual del precio final.
  - Cualquier cambio relevante resetea confirmaciones para forzar revalidación.
- `SaleStepsCard`: operación de pasos con reglas (p.ej. Envío bloqueado si falta contrato/pago).
- `SaleActionsCard`: cerrar/archivar. Cerrar requiere contrato firmado + beneficiario + plan + modalidad.
- `ContractedPlanCard` (nuevo): select de Plan/Modalidad y guardado con eventos.

---

## 12) Auditoría: Events (regla central)

- Los Events son el “log” de auditoría.
- Cada cambio relevante de entidades principales debe generar al menos un `Event`.
- `entity` separa la entidad lógica (SALE, CLIENT, STEP, etc.).
- `field` es un string consistente: p.ej. `plan`, `modality`, `status`, `serviceRegion`.

Historial:
- `SaleTimeline` muestra eventos por venta.
- Se usa `labels` para traducir entity/field comunes.

---

## 13) Alertas runtime (no persistidas)

Archivo: `src/utils/alertRules.ts`

- Se calculan a partir de:
  - timestamps (`createdAt`, último evento)
  - pasos
  - campos críticos faltantes (con labels en español)
- Ejemplos:
  - 24h/48h sin eventos
  - datos críticos incompletos >24h
  - “Pago listo sin método”
  - envío sin contrato/pago
  - envío pendiente >4 días

No se guardan en DB: son derivadas.

---

## 14) Utilidades importantes

- `src/utils/cleanUndefined.ts`
  - Firestore no acepta `undefined`. Este helper elimina claves con `undefined` recursivamente.
  - Preserva objetos no “plain” (Date, FieldValue/sentinels de Firestore).

- `src/utils/labels.ts`
  - Mapeo de enums técnicos a español (sin tocar modelos).

- `src/utils/folio.ts`
  - Genera folio humano **numérico** estable (4 dígitos) a partir del `id` (hash FNV-1a mod 10^4).
  - No se persiste.

- `src/utils/region.ts`
  - Normaliza región a `SANTIAGO | VALPARAISO | REGIONES`.

---

## 15) CI/CD y hosting

- `vite.config.ts` usa `base: './'` para GitHub Pages.
- Workflow: `.github/workflows/deploy.yml`
  - Instala (`npm ci`)
  - Build (`npm run build`)
  - Publica carpeta `dist/`

---

## 16) Convenciones de contribución (importante)

1) **No cambiar modelos a la ligera**
- Si el negocio pide un label distinto (ej. FLEXIBLE), preferir mapping en UI (como se hizo con `MIXTO`).

2) **Cada cambio debe auditarse**
- Si agregas un campo editable, también agrega eventos consistentes (`entity` + `field`).

3) **No deletes**
- Archivar en vez de eliminar.

4) Firestore y `undefined`
- Cualquier `setDoc`/`updateDoc` debe pasar por `cleanUndefined()`.

5) TypeScript strict
- `noUnusedLocals/noUnusedParameters` activos: mantener el código limpio.

---

## 17) Puntos conocidos / limitaciones actuales

- Navegación no usa URL; si se requiere deep-linking habrá que introducir router y considerar GitHub Pages.
- Módulo Clientes es placeholder.
- No hay suite de tests automatizada aún.

---

## 18) Quick start mental (para un senior)

Si quieres empezar a colaborar:

1) Lee contratos en `src/models/*`.
2) Revisa `src/services/sales.service.ts` y `src/services/events.service.ts`.
3) Mira `src/app/sales/SalesPage.tsx` para el flujo principal.
4) Asegura reglas Firestore + `.env` para ambiente local.

Fin.

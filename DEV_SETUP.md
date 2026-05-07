# CloudOrbit — Dev Setup Local

## Requisitos

| Tool | Version mínima | Cómo instalar |
|------|---------------|---------------|
| Node | 18+ (recomendado 20) | `brew install node` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Xcode CLT | cualquiera | `xcode-select --install` |

Verificar:

```bash
node --version    # v20.x.x
rustc --version   # rustc 1.x.x
cargo --version   # cargo 1.x.x
```

---

## Primera vez: instalar dependencias

```bash
cd aws-switch-tauri
npm install
```

---

## Levantar en modo desarrollo

```bash
npm run tauri dev
```

Esto:
1. Arranca Vite en `http://localhost:1420`
2. Compila el binario Rust en modo `debug`
3. Abre la ventana nativa de la app

La primera vez tarda ~2-3 min porque compila todas las dependencias Rust.
Las veces siguientes tarda ~5-10 segundos (artifacts cacheados).

### Error: `Port 1420 is already in use`

Quedó un proceso de una sesión anterior. Matar y reintentar:

```bash
lsof -ti :1420 | xargs kill -9
npm run tauri dev
```

### Error: `Permission process:allow-relaunch not found`

Bug histórico en las capabilities. Ya corregido en `src-tauri/capabilities/default.json`
(renombrado a `process:allow-restart`). Si aparece de nuevo verificar ese archivo.

---

## Build de producción local (para compartir)

Genera el `.dmg` / `.app` firmado localmente (sin certificado Apple Developer = sin notarización):

```bash
npm run tauri build
```

El binario queda en:

```
src-tauri/target/release/bundle/
├── dmg/   CloudOrbit_0.1.0_aarch64.dmg    ← esto se comparte
└── macos/ CloudOrbit.app
```

Para compartirlo con un amigo:

```bash
open src-tauri/target/release/bundle/dmg/
```

El amigo instala arrastrando `CloudOrbit.app` a `/Applications`.
**Primera apertura:** clic derecho → Abrir → Abrir (macOS Gatekeeper bloquea apps sin notarizar la primera vez).

---

## Hot reload

El frontend (React/Vite) hace hot reload automático al guardar cualquier archivo `.tsx`/`.ts`/`.css`.

Los cambios en código Rust (`src-tauri/src/`) recompilan el binario automáticamente y relanzan la app.

---

## Comandos útiles

```bash
npm run test          # unit tests con Vitest
npm run test:watch    # watch mode
npm run build         # solo el frontend (sin Tauri)
npm run tauri build   # build de producción completo
```

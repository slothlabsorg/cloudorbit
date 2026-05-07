# CloudOrbit — Primer Deploy: Checklist Completo

Guía paso a paso para dejar todo el pipeline operativo desde cero.
Orden importa — algunos pasos generan valores que necesitas en pasos siguientes.

---

## 1. Repos de GitHub a crear

| Repo | Visibilidad | Propósito |
|------|-------------|-----------|
| `slothlabs/cloudorbit` | Public | Repo principal (este) |
| `slothlabs/homebrew-tap` | Public | Cask de Homebrew |

```bash
# Crear el tap (si no existe aún)
gh repo create slothlabs/homebrew-tap --public --description "Homebrew tap for SlothLabs apps"

# Crear la estructura mínima para que Homebrew lo reconozca
gh repo clone slothlabs/homebrew-tap /tmp/homebrew-tap
mkdir -p /tmp/homebrew-tap/Casks
touch /tmp/homebrew-tap/Casks/.gitkeep
cd /tmp/homebrew-tap
git add . && git commit -m "chore: init tap" && git push
```

---

## 2. Generar keypair del updater (firma de actualizaciones)

Este par de llaves firma los binarios para que Tauri acepte las actualizaciones.
**Hacerlo una sola vez. La private key nunca va al repo.**

```bash
# Instalar tauri-cli si no lo tienes
cargo install tauri-cli

# Generar keypair — te pedirá una contraseña opcional (recomendada)
cargo tauri signer generate -w ~/.tauri/cloudorbit.key
```

La salida imprime dos valores:

```
Public key:   dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYy...
Private key:  (guardado en ~/.tauri/cloudorbit.key)
```

**Guardar ambos valores ahora:**
- Public key → va en `tauri.conf.json` (paso 3)
- Private key + contraseña → van en GitHub Secrets (paso 4)

---

## 3. Actualizar `tauri.conf.json` con la public key

En `src-tauri/tauri.conf.json`, reemplazar la línea del `pubkey`:

```json
"plugins": {
  "updater": {
    "pubkey": "PEGAR_AQUI_EL_PUBLIC_KEY_DEL_PASO_2",
    "endpoints": [
      "https://slothlabs.org/cloudorbit/{{target}}/{{current_version}}"
    ]
  }
}
```

Hacer commit de este cambio antes de continuar.

---

## 4. GitHub Secrets — Settings → Secrets → Actions

Ir a `github.com/slothlabs/cloudorbit/settings/secrets/actions` y agregar:

### Requeridos para el primer release (sin Apple/Windows signing)

| Secret | Valor |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenido del archivo `~/.tauri/cloudorbit.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Contraseña que pusiste en el paso 2 (dejar vacío si no pusiste) |

```bash
# Ver el contenido de la private key
cat ~/.tauri/cloudorbit.key
```

### Requeridos para Homebrew tap automation

| Secret | Valor |
|--------|-------|
| `HOMEBREW_TAP_TOKEN` | PAT de GitHub con scope `public_repo` en cuenta/org `slothlabs` |

```bash
# Generar el PAT desde GitHub CLI
gh auth token   # si ya tienes el scope, úsalo directamente
# O crear uno nuevo en: github.com/settings/tokens/new
# Scopes necesarios: public_repo (para hacer push al homebrew-tap)
```

### Requeridos para WinGet automation

| Secret | Valor |
|--------|-------|
| `WINGET_TOKEN` | PAT de GitHub con scope `public_repo` (puede ser el mismo que HOMEBREW_TAP_TOKEN) |

### Opcionales — Apple signing (cuando tengas Apple Developer $99/año)

| Secret | Cómo obtenerlo |
|--------|----------------|
| `APPLE_CERTIFICATE` | `.p12` exportado de Keychain, codificado en base64: `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password del `.p12` |
| `APPLE_ID` | tu@email.com (Apple ID del developer account) |
| `APPLE_PASSWORD` | App-specific password: appleid.apple.com → Security |
| `APPLE_TEAM_ID` | ID de 10 chars del Apple Developer team |

> Sin Apple signing la app funciona pero macOS muestra "desarrollador no identificado" → clic derecho → Abrir. Para beta/early adopters es aceptable.

---

## 5. Deploy de la Netlify Function (servidor de actualizaciones)

La función vive en el repo del sitio `slothlabs/slothlabs-site`, no en este repo.

### 5a. Copiar la función al repo del sitio

```bash
# Desde la raíz de cloudorbit
cp distribute/netlify/functions/updater.js ../slothlabs-site/netlify/functions/updater.js
```

### 5b. Configurar `netlify.toml` en el repo del sitio

Agregar esto **antes** del catch-all `/*` existente:

```toml
[functions]
  directory = "netlify/functions"

# Tauri updater — DEBE ir antes del /* catch-all
[[redirects]]
  from   = "/cloudorbit/*"
  to     = "/.netlify/functions/updater"
  status = 200
  force  = true
```

### 5c. Deploy

```bash
cd ../slothlabs-site
git add netlify/functions/updater.js netlify.toml
git commit -m "feat: add CloudOrbit updater function"
git push
# Netlify hace deploy automático
```

### 5d. Verificar que el endpoint está vivo

```bash
# Debe responder 204 (no hay releases aún — correcto)
curl -i https://slothlabs.org/cloudorbit/darwin-aarch64/0.0.0
# Esperado: HTTP/2 204
```

---

## 6. Primer release

Todo listo. Ahora publicar el primer release:

```bash
# 1. Asegurarse de que version es 0.1.0 en:
#    - src-tauri/tauri.conf.json  → "version": "0.1.0"
#    - package.json               → "version": "0.1.0"

# 2. Actualizar CHANGELOG.md — reemplazar "2026-03-xx" con la fecha real

# 3. Commit, tag y push
git add src-tauri/tauri.conf.json package.json CHANGELOG.md
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

GitHub Actions arranca automáticamente y:
1. Compila para 4 targets: macOS ARM, macOS Intel, Linux, Windows
2. Firma todos los binarios con `TAURI_SIGNING_PRIVATE_KEY`
3. Sube assets al GitHub Release (queda como **Draft**)
4. Genera `latest.json` (usado por el updater)

```bash
# Monitorear el progreso
gh run list --repo slothlabs/cloudorbit
gh run watch --repo slothlabs/cloudorbit
```

---

## 7. Publicar el Release Draft

Cuando el workflow termine (~15 min):

```bash
# Ver el draft
gh release view v0.1.0 --repo slothlabs/cloudorbit

# Publicar (dispara update-tap.yml y update-winget.yml automáticamente)
gh release edit v0.1.0 --repo slothlabs/cloudorbit --draft=false
```

Al publicar se disparan automáticamente:
- `update-tap.yml` → actualiza `slothlabs/homebrew-tap` con el cask real
- `update-winget.yml` → abre PR en `microsoft/winget-pkgs`

---

## 8. WinGet — primera vez (setup manual)

El primer submit a WinGet Community Repository requiere aprobación manual de Microsoft.
Los archivos de manifiesto ya están preparados en `distribute/winget/`.

```bash
# Instalar wingetcreate (Windows o WSL)
winget install Microsoft.WingetCreate

# Validar los manifiestos localmente
wingetcreate validate distribute/winget/

# Submit manual (solo la primera vez)
wingetcreate submit \
  --token $WINGET_TOKEN \
  distribute/winget/SlothLabs.CloudOrbit.yaml \
  distribute/winget/SlothLabs.CloudOrbit.installer.yaml \
  distribute/winget/SlothLabs.CloudOrbit.locale.en-US.yaml
```

> A partir del segundo release, `update-winget.yml` lo hace automáticamente.

---

## 9. Verificar que el updater funciona

Tras publicar el release:

```bash
# Debe devolver 200 + JSON con la versión
curl https://slothlabs.org/cloudorbit/darwin-aarch64/0.0.0 | jq .version
# Esperado: "0.1.0"

curl https://slothlabs.org/cloudorbit/windows-x86_64/0.0.0 | jq .version
# Esperado: "0.1.0"
```

---

## 10. Verificar Homebrew

```bash
# Agregar el tap
brew tap slothlabs/tap

# Ver el cask generado
brew info --cask slothlabs/tap/cloudorbit

# Instalar
brew install --cask slothlabs/tap/cloudorbit
```

---

## Resumen de dependencias entre pasos

```
Paso 2 (keypair)
  ├── → Paso 3 (pubkey en tauri.conf.json)
  └── → Paso 4 (TAURI_SIGNING_PRIVATE_KEY en Secrets)

Paso 1 (crear repos)
  └── → Paso 4 (HOMEBREW_TAP_TOKEN para push al tap)

Pasos 2-4 completos
  └── → Paso 6 (primer release — el workflow puede correr)

Paso 5 (Netlify Function)
  └── Independiente, hacer antes del release

Paso 6 (release publicado)
  ├── → Paso 7 (publicar draft)
  │     ├── → update-tap.yml (automático)
  │     └── → update-winget.yml (automático)
  └── → Paso 9 (verificar updater)
```

---

## Assets generados por el release (referencia)

| Archivo | Plataforma |
|---------|------------|
| `CloudOrbit_0.1.0_aarch64.dmg` | macOS Apple Silicon |
| `CloudOrbit_0.1.0_x64.dmg` | macOS Intel |
| `CloudOrbit_0.1.0_x64-setup.exe` | Windows NSIS installer |
| `CloudOrbit_0.1.0_x64_en-US.msi` | Windows MSI |
| `cloud-orbit_0.1.0_amd64.deb` | Linux Debian/Ubuntu |
| `cloud-orbit_0.1.0_amd64.AppImage` | Linux universal |
| `latest.json` | Metadata del updater (generado por tauri-action) |

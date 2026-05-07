CloudOrbit — Repo, CI/CD, firma y distribución

iniciar aqui

 Updater endpoint — Netlify Function en el sitio slothlabs.org:

slothlabs.org/cloudorbit/{{target}}/{{current_version}}

3. tauri.conf.json — config de distribución
   {
   "package": {
   "productName": "CloudOrbit",
   "version": "0.1.0"
   },
   "tauri": {
   "bundle": {
   "identifier": "io.slothlabs.cloudorbit",
   "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
   "macOS": {
   "signingIdentity": null,
   "minimumSystemVersion": "10.15",
   "dmg": { "background": null }
   },
   "windows": {
   "certificateThumbprint": null,
   "digestAlgorithm": "sha256",
   "timestampUrl": "http://timestamp.digicert.com"
   },
   "linux": {
   "deb": { "depends": [] }
   }
   },
   "updater": {
   "active": true,
   "endpoints": ["https://slothlabs.org/cloudorbit/{{target}}/{{current_version}}"],
   "dialog": true,
   "pubkey": "TU_PUBKEY_AQUI"
   }
   }
   }

4. Generar keypair para el updater (firma de actualizaciones)
# Instalar tauri-cli si no lo tienes
cargo install tauri-cli

# Generar keypair
cargo tauri signer generate -w ~/.tauri/cloudorbit.key

# Esto imprime:
# Private key: (guarda en GitHub Secret → TAURI_PRIVATE_KEY)
# Public key:  (pega en tauri.conf.json → updater.pubkey)La private key nunca va al repo. Solo vive en GitHub Secrets.

5. GitHub Secrets necesarios
   Ve a Settings → Secrets → Actions y agrega:
   Secret Valor     TAURI_PRIVATE_KEY Output del paso 4   TAURI_KEY_PASSWORD Password que pusiste en paso 4   APPLE_CERTIFICATE Base64 del .p12 (cuando tengas Apple Dev)   APPLE_CERTIFICATE_PASSWORD Password del .p12   APPLE_ID tu@email.com (Apple ID)   APPLE_PASSWORD App-specific password de Apple   APPLE_TEAM_ID ID de tu Apple Developer team   Por ahora solo necesitas TAURI_PRIVATE_KEY y TAURI_KEY_PASSWORD para que el pipeline funcione sin firma de Apple/Windows.

6. GitHub Actions — release.yml
   name: Release

on:
push:
tags:
- 'v*'

jobs:
release:
permissions:
contents: write
strategy:
fail-fast: false
matrix:
include:
- platform: macos-latest
args: '--target aarch64-apple-darwin'
- platform: macos-latest
args: '--target x86_64-apple-darwin'
- platform: ubuntu-22.04
args: ''
- platform: windows-latest
args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install Linux deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install frontend deps
        run: npm install

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_KEY_PASSWORD }}
          # Descomentar cuando tengas Apple Developer:
          # APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          # APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          # APPLE_ID: ${{ secrets.APPLE_ID }}
          # APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          # APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'CloudOrbit ${{ github.ref_name }}'
          releaseBody: 'Ver CHANGELOG para detalles.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}

7. Servidor de actualizaciones — Netlify Function
   Archivo fuente: distribute/netlify/functions/updater.js
   Copiar a: slothlabs-site/netlify/functions/updater.js
   Endpoint: https://slothlabs.org/cloudorbit/{{target}}/{{current_version}}
   Ver distribute/netlify/README.md para instrucciones de deploy.

8. Homebrew tap
# Crear repo separado para el tap
gh repo create slothlabs/homebrew-tap --public

# Estructura
homebrew-tap/
└── Casks/
└── cloudorbit.rb
# Casks/cloudorbit.rb
cask "cloudorbit" do
version "0.1.0"
sha256 "SHA_DEL_DMG_AQUI"

url "https://github.com/slothlabs/cloudorbit/releases/download/v#{version}/CloudOrbit_#{version}_aarch64.dmg"
name "CloudOrbit"
desc "AWS, GCP y kubeconfig session manager"
homepage "https://cloudorbit.io"

app "CloudOrbit.app"
endActualizar el cask automáticamente con una GitHub Action que corra después del release:
# En cloudorbit repo — .github/workflows/update-tap.yml
name: Update Homebrew tap
on:
release:
types: [published]

jobs:
update-tap:
runs-on: ubuntu-latest
steps:
- name: Update cask
uses: dawidd6/action-homebrew-bump-cask@v1
with:
token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
tap: slothlabs/homebrew-tap
cask: cloudorbitInstalación para el usuario final:
brew install --cask slothlabs/tap/cloudorbit

9. Flujo completo para publicar una versión
# 1. Bump version en tauri.conf.json y package.json
# 2. Commit y tag
git add .
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main --tags

# GitHub Actions compila para los 4 targets automáticamente
# Crea un Release Draft en GitHub
# Firma todos los binarios con TAURI_PRIVATE_KEY
# Publica los assets

# 3. Revisar el draft en GitHub → Publish release
# 4. La Netlify Function ya sirve la nueva versión al updater
# 5. El workflow update-tap.yml actualiza Homebrew automáticamente

10. Sin firma de Apple/Windows por ahora
    Sin Apple Developer ($99/año) ni certificado Windows, la app funciona pero:

Mac: el usuario ve "app de desarrollador no identificado" → clic derecho → Abrir
Windows: SmartScreen muestra advertencia → "Más información" → Ejecutar de todas formas
Para beta/early adopters es aceptable. Cuando tengas volumen, inviertes en los certs.

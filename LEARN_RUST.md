# Aprendiendo Rust a través de este proyecto

> Este doc usa el código de `aws-switch` como guía práctica.
> Cada concepto tiene su ejemplo directo del codebase.

---

## 1. ¿Por qué Rust?

Rust resuelve tres problemas a la vez:

| Problema        | Rust lo resuelve con…            |
|-----------------|----------------------------------|
| Memory safety   | Ownership system (sin GC)        |
| Concurrencia    | Borrow checker en compile time   |
| Performance     | Zero-cost abstractions           |

Para este proyecto: el compilador garantiza que jamás habrá un crash por un
null pointer o un data race, sin que pagues overhead de runtime.

---

## 2. Setup

```bash
# Instalar Rust (gestor de versiones incluido)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Verificar
rustc --version   # rustc 1.x.x
cargo --version   # cargo 1.x.x

# Instalar dependencias de Tauri (macOS)
xcode-select --install
brew install cmake

# Instalar CLI de Tauri
npm install   # instala @tauri-apps/cli del package.json

# Correr en modo dev (hot-reload)
npm run dev

# Compilar release (genera .app)
npm run build
```

---

## 3. Cargo — el build tool

`Cargo.toml` es el equivalente a `package.json`. En el proyecto:

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
#                                    ^^^^^^^^^
#                          features = flags opcionales del crate
```

Comandos útiles:

```bash
cargo check          # compilación rápida sin producir binario
cargo build          # compila en debug mode
cargo build --release # compila optimizado
cargo clippy         # linter (muy útil para aprender)
cargo doc --open     # genera y abre la documentación local
```

---

## 4. El sistema de tipos

### Structs

En `commands/sso.rs` defines los datos que van al frontend:

```rust
// #[derive(...)] genera código automáticamente:
// - Serialize → convierte a JSON para el frontend
// - Clone     → permite copiar el valor
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]  // accountId en JS, account_id en Rust
pub struct Account {
    pub account_id:    String,
    pub account_name:  String,
    pub roles:         Vec<Role>,  // Vec = array dinámico
}
```

### Enums con datos (Rust superpoder)

A diferencia de otros lenguajes, los enums en Rust pueden llevar datos:

```rust
// Ejemplo conceptual del manejo de errores
enum LoginResult {
    Success { access_token: String },
    Pending,
    Failed(String),  // lleva el mensaje de error
}
```

### Option<T> — el null seguro

Rust no tiene `null`. Usa `Option<T>`:

```rust
// En config.rs
pub account_id: Option<String>,  // puede ser Some("123") o None

// Para leer el valor:
match account_id {
    Some(id) => println!("cuenta: {}", id),
    None     => println!("sin cuenta configurada"),
}

// Atajos comunes:
let id = account_id.unwrap_or_default();          // "" si None
let id = account_id.unwrap_or("default".into());  // valor propio
let id = account_id.as_deref().unwrap_or("?");    // &str sin mover
```

### Result<T, E> — el error seguro

```rust
// En credentials.rs
pub async fn assume_role(...) -> Result<Credentials, String> {
//                                ^^^^^^ ok   ^^^^^^ error

    let resp = sso.get_role_credentials()
        .send()
        .await
        .map_err(|e| e.to_string())?;  // <- el ? propaga el error
    //                               ^
    //   Si es Err, sale de la función con Err(mensaje)
    //   Si es Ok, desenvuelve el valor
```

El operador `?` es equivalente a:
```rust
let resp = match sso.send().await {
    Ok(val)  => val,
    Err(e)   => return Err(e.to_string()),
};
```

---

## 5. Ownership y Borrowing

El concepto más único de Rust. Regla fundamental:

> **Cada valor tiene exactamente un dueño. Cuando el dueño sale del scope, el valor se destruye.**

```rust
let s1 = String::from("hola");
let s2 = s1;          // s1 se MUEVE a s2
// println!("{}", s1); // ERROR: s1 ya no existe

// Solución 1: clonar
let s2 = s1.clone();  // s1 y s2 viven

// Solución 2: prestar (borrowing)
let s2 = &s1;         // s2 es una referencia a s1
println!("{}", s1);   // OK, s1 sigue siendo el dueño
println!("{}", s2);   // OK, s2 solo la prestó
```

En el proyecto lo ves en `config.rs`:

```rust
// .to_string() crea un String nuevo (owned)
// .as_str() o & presta una referencia
let session_name = name.strip_prefix("sso-session ")
    .unwrap()
    .to_string();  // creamos un String propio para guardarlo

// vs cuando solo necesitamos leer:
fn cache_path(start_url: &str) -> PathBuf {
//                        ^
//            & = referencia prestada, no nos quedamos con el ownership
```

### Reglas del borrow checker

- Puedes tener **muchas referencias inmutables** (`&T`) O
- **una sola referencia mutable** (`&mut T`)
- Pero nunca ambas al mismo tiempo

Esto elimina data races en compilación.

---

## 6. Async / Await con Tokio

Rust tiene async nativo pero necesita un runtime. Aquí usamos Tokio (el más popular):

```rust
// La función es async porque hace I/O de red
#[tauri::command]                    // <- expone como comando Tauri
pub async fn sso_login_start(        // <- async fn
    start_url: String,
    sso_region: String,
) -> Result<SessionInfo, String> {

    // aws_config::load() es async, necesita .await
    let cfg = aws_config::defaults(...)
        .load()
        .await;                      // <- cede el hilo hasta tener resultado

    // El cliente no bloquea el hilo mientras espera HTTP
    let reg = oidc
        .register_client()
        .send()
        .await                       // <- otra operación async
        .map_err(|e| e.to_string())?;

    Ok(SessionInfo { ... })
}
```

A diferencia de JS, `async/await` en Rust es **zero-cost**: no hay heap allocation por cada `await`. El compilador genera una máquina de estados.

### Ejecutar cosas en paralelo:

```rust
// En vez de await una por una...
let (accounts, roles) = tokio::join!(
    client.list_accounts().send(),
    client.list_account_roles().send(),
);
```

---

## 7. Traits — el polimorfismo de Rust

Los traits son como interfaces. Los más importantes en este proyecto:

```rust
// Serialize/Deserialize de serde: permite convertir a/desde JSON
#[derive(Serialize, Deserialize)]
struct Foo { ... }

// Clone: permite .clone()
#[derive(Clone)]
struct Bar { ... }

// Debug: permite imprimir con {:?}
#[derive(Debug)]
struct Baz { ... }
```

Puedes implementar traits manualmente:

```rust
impl std::fmt::Display for MyError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "error: {}", self.message)
    }
}
```

---

## 8. Iteradores

Rust tiene iteradores funcionales muy expresivos. En `credentials.rs`:

```rust
// Filtrar, transformar y coleccionar
let safe_name = account_name
    .chars()                                          // iterador de chars
    .map(|c| if c.is_alphanumeric() { c } else { '-' })  // transformar
    .collect::<String>();                             // coleccionar

// .filter_map() = filter + map en uno
let profiles: Vec<Profile> = sections
    .iter()
    .filter_map(|(name, props)| {
        let pn = name.strip_prefix("profile ")?;  // None si no tiene prefix
        Some(build_profile(pn, props))
    })
    .collect();
```

Equivalentes JS → Rust:

| JavaScript          | Rust                    |
|---------------------|-------------------------|
| `arr.map(f)`        | `iter.map(f).collect()` |
| `arr.filter(f)`     | `iter.filter(f).collect()` |
| `arr.find(f)`       | `iter.find(f)`          |
| `arr.forEach(f)`    | `iter.for_each(f)` o `for x in iter` |
| `arr.some(f)`       | `iter.any(f)`           |
| `arr.every(f)`      | `iter.all(f)`           |

---

## 9. Manejo de archivos

Rust tiene un sistema de archivos síncrono en `std::fs`:

```rust
use std::fs;
use dirs::home_dir;   // crate para obtener el home dir

// Leer archivo (devuelve Result<String, Error>)
let content = fs::read_to_string("~/.aws/config")
    .unwrap_or_default();  // "" si no existe

// Escribir archivo
fs::write(&path, content)?;  // ? propaga el error

// Crear directorios recursivamente
fs::create_dir_all(path.parent().unwrap())?;
```

---

## 10. Módulos

En Rust, los módulos organizan el código. En `src/commands/mod.rs`:

```rust
// Declarar submódulos (cada uno es un archivo .rs)
mod config;
mod sso;
mod credentials;
mod eks;

// Re-exportar para uso externo
pub use config::parse_config;
pub use sso::{check_sso_login, sso_login_start, ...};
```

Y en `main.rs`:
```rust
mod commands;  // carga src/commands/mod.rs

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::parse_config,    // comando expuesto al frontend
            commands::assume_role,
        ])
        ...
}
```

Visibilidad:
- `pub` = público (visible fuera del módulo)
- Sin `pub` = privado (solo visible dentro)
- `pub(crate)` = visible en todo el crate pero no fuera

---

## 11. Ejercicios con este codebase

**Nivel 1 — Cambios menores:**
1. Agrega el campo `account_email` a la UI (ya está en el struct `Account`, solo falta mostrarlo en `app.js`)
2. Cambia el nombre del cliente OIDC de `"aws-switch"` a tu nombre de equipo en `sso.rs:register_client()`
3. Agrega el campo `profile_name` al tipo `Credentials` que se devuelve

**Nivel 2 — Nuevas features:**
4. Agrega un comando `get_caller_identity` que use el SDK de STS para verificar quién eres después de asumir el rol
5. Cachea las credenciales en memoria usando `tauri::State` para no tener que leer el archivo en cada request de EKS
6. Agrega soporte para listar clusters en múltiples regiones en paralelo con `tokio::join!`

**Nivel 3 — Refactoring:**
7. Extrae la lógica de parseo de INI a un módulo separado `src/ini_parser.rs`
8. Crea un tipo de error propio con `thiserror` en vez de usar `String` como error
9. Agrega tests unitarios para `parse_ini` en `config.rs` usando `#[cfg(test)]`

---

## 12. Recursos

### Documentación oficial
- **The Rust Book** (gratis): https://doc.rust-lang.org/book/
- **Rust by Example**: https://doc.rust-lang.org/rust-by-example/
- **std library docs**: https://doc.rust-lang.org/std/

### Async
- **Tokio tutorial**: https://tokio.rs/tokio/tutorial
- **Async Book**: https://rust-lang.github.io/async-book/

### Ecosistema de este proyecto
- **Tauri v2 docs**: https://tauri.app/start/
- **AWS SDK for Rust**: https://docs.aws.amazon.com/sdk-for-rust/latest/dg/getting-started.html
- **Serde**: https://serde.rs/

### Herramientas
```bash
# Linter muy recomendado, da sugerencias de mejora
cargo clippy

# Formateador (como prettier)
cargo fmt

# Ver qué hace un error específico
rustc --explain E0382

# Buscar crates
https://crates.io
```

### Tips para el día a día

```bash
# Ver el árbol de dependencias
cargo tree

# Verificar versiones desactualizadas
cargo install cargo-outdated && cargo outdated

# Ver el tamaño del binario por sección
cargo install cargo-bloat && cargo bloat --release
```

---

## Diferencias clave vs TypeScript/Node.js

| Node.js / TypeScript      | Rust                                    |
|---------------------------|-----------------------------------------|
| `let x: string \| null`   | `Option<String>`                        |
| `throw new Error(...)`    | `return Err("...")`                     |
| `try/catch`               | `match result { Ok(v) => ..., Err(e) => ... }` |
| `async/await` (Event loop)| `async/await` (Tokio scheduler)         |
| Garbage Collector         | Ownership (sin GC)                      |
| `null`/`undefined`        | No existe — solo `None`                 |
| `any`                     | No existe — tipos siempre explícitos    |
| `arr.push(x)`             | `vec.push(x)` (igual)                   |
| `JSON.stringify(obj)`     | `serde_json::to_string(&obj)?`          |
| `JSON.parse(str)`         | `serde_json::from_str::<T>(&str)?`      |

---

> **Consejo final:** El compilador de Rust es el mejor profesor. Los mensajes de error son
> detallados y generalmente te dicen exactamente qué hacer. No pelees contra el compilador —
> si algo no compila, lee el error con calma. Casi siempre tiene la respuesta.

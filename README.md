# Dashboard Financiero Argentina

React 18, Vite y Chart.js. Estilos CSS propios; las secciones se cargan bajo demanda.

## Desarrollo

Requiere Node.js 22 o superior y npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

El servidor imprime el enlace disponible. Las secciones admiten enlaces como `?tab=dolares` y `?tab=tasas-cripto`, con navegación Atrás/Adelante.

## Verificación

```sh
npm test
npm run build
npm run check:pwa
npm run preview
```

Las pruebas de Node no consumen APIs reales. `check:pwa` comprueba los archivos compilados bajo un subdirectorio, incluidos los módulos de carga diferida y su recuperación offline. La instalación y las actualizaciones del service worker también requieren una comprobación en navegador. En desarrollo se desactiva el worker de esta aplicación para evitar interferencias con Vite.

Para las pruebas Python, sin instalar las dependencias pesadas del generador:

```sh
python -m pip install Flask requests
python -m unittest discover -s tests -p "test_*.py"
```

## Datos y actualización

- Cotizaciones: cada 60 segundos; tasas: cada 5 minutos, mientras la página esté visible.
- Las solicitudes tienen cancelación, validación y timeout de 12 segundos. Las fallas parciales conservan los datos disponibles y se muestran en la barra de estado.
- Si no hay una cotización live, se usa el último registro del snapshot con su fecha. No se calcula una brecha entre un precio histórico y uno live.
- `Actualizar datos` vuelve a consultar las fuentes y el snapshot.
- El IPC de la API está expresado en porcentajes y se convierte siempre a fracción, incluso cuando es menor al 1% o negativo.
- Las bandas mantienen el modelo original del proyecto: valores iniciales de 2026, IPC rezagado dos meses y supuesto del 2% cuando falta ese IPC. Se presentan como estimaciones.

El snapshot heredado puede contener IPC antiguo convertido con la heurística anterior. El generador corregido elimina ese problema en la siguiente actualización; no se adivinan ni reescriben valores históricos durante un refactor.

## Generar el snapshot

```sh
python -m pip install -r requirements.txt
python build_data.py
# Directorio opcional:
python build_data.py --out-dir public/data
```

La implementación vive en `scripts/build_data.py`; el archivo de la raíz es un acceso directo. El directorio predeterminado es `public/data`. Este comando sí consulta servicios externos y actualiza archivos de datos.

## Proxy opcional

Copiar `.env.example` a `.env` y configurar `VITE_PROXY_URL` con la URL completa de `/data`. Reiniciar Vite después de cambiar variables de entorno.

```sh
python proxy_server_render.py
```

El proxy también funciona importado por un servidor WSGI. Cada proceso mantiene un actualizador; `/` indica que el servidor está vivo, `/ready` devuelve 503 mientras los datos estén incompletos o vencidos y `/data` incluye timestamps, errores y estado. Configurar `ALLOWED_ORIGIN` para el origen del frontend y `PORT` para el puerto de escucha. El frontend vuelve a las APIs directas si el proxy falla o devuelve datos vencidos. El servidor integrado de Flask es para desarrollo.

## Organización

- `src/hooks`: carga de recursos y ciclo de actualización.
- `src/utils`: normalización, cálculos puros, HTTP y PWA.
- `src/charts`: gráficos con ciclo de vida y tema reactivos.
- `src/components`: navegación, estado, ayudas accesibles y recuperación de errores.
- `src/tabs`: Resumen, Dólares y Tasas.
- `tests`: regresiones de datos, cálculos, polling, caché y proxy.

## GitHub Pages

El workflow de despliegue instala con `npm ci`, ejecuta pruebas, compila y verifica la PWA antes de publicar. Las pull requests tienen un workflow de validación con pruebas JavaScript y Python. El build genera un manifiesto de todos los JS/CSS y una revisión del worker para mantener coherente la caché entre versiones. Los datos se actualizan mediante el workflow diario existente.

# aceform-app
ACEFORM mini app prototype for Telegram


## Storefront build

Edit `index.template.html` and the component JS/CSS sources, then run `python3 build-store.py`. The build creates `index.html` with a static first screen and inlined styles, plus one versioned `store-runtime-<hash>.js`. Publish the generated files together with changed sources and assets. Keep previously published runtime files while old HTML can still be cached.

`media-priority.js` preloads only colors of the active product, decodes before swapping, and prevents a late response from replacing the last chosen color. Existing price, stock-validation and checkout code remains in the runtime in its original execution order.

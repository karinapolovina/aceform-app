"""Build the storefront's static first screen and one deferred JS request.
Run with Python 3; component sources remain independently editable.
"""
from pathlib import Path
import re,hashlib,gzip,json
ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.template.html').read_text()
# Preserve styles in cascade order, but remove extra blocking round trips.
def inline_css(match):
 path=match.group(1).split('?')[0]
 return '<style data-source="'+path+'">'+(ROOT/path).read_text()+'</style>'
html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',inline_css,html)
# The homepage must be visible even before the JavaScript runtime arrives.
cover=re.search(r'<div class="aperol-cover">.*?</div>',html).group(0)
cover=cover.replace(' id="aprilTitle"','').replace('href="#aperolLooks">Выбрать свой образ ↓','href="#april">Смотреть коллекцию →')
home='<section class="shop-home" id="shopHome"><p class="shop-kicker">ТВОЯ ФОРМА ИГРЫ</p><h1>На корте.<br>В своём стиле.</h1>'+cover+'</section>'
html=html.replace('</header>','</header>'+home,1).replace('<body>','<body data-shop-screen="shop">',1)
# Ordinary catalog cards remain useful links before enhancement by app.js.
products=[('dress','Платье EVERT · Эверт','assets/fast-dress-black-catalog.webp','8 000 ₽ · платье + шорты'),('skirt','Юбка BUENO · Буэно','assets/fast-rococo-white-pink-catalog.webp','8 900 ₽'),('top','Топ GRAF · Граф','assets/fast-top-white-catalog.webp','2 900 ₽'),('shorts','Шорты MARBLE · Марбл','assets/fast-shorts-pair.webp','В наличии')]
cards=''.join('<div class="product-card"><a class="product" href="#product/'+id+'" style="display:block;color:inherit;text-decoration:none"><span class="thumb"><img class="garment-photo catalog-photo" loading="lazy" decoding="async" fetchpriority="low" src="'+image+'" alt="'+name+'"></span><b>'+name+'</b><span class="card-price">'+price+'</span></a></div>' for id,name,image,price in products)
html=html.replace('<div class="products" id="products"></div>','<div class="products" id="products">'+cards+'</div>')
nav='<nav class="shop-nav" aria-label="Навигация магазина"><a href="#shop" aria-current="page">Магазин</a><button type="button" id="shopCart">Корзина <span></span></button><a href="#my-orders">Мои заказы</a></nav>'
html=html.replace('</body>',nav+'</body>')
paths=re.findall(r'<script defer src="([^"]+)"></script>',html)
if 'media-priority.js' not in paths:paths.insert(next(i for i,v in enumerate(paths) if v.startswith('models.js'))+1,'media-priority.js')
runtime=';\n'.join('/* Source: '+p.split('?')[0]+' */\n'+(ROOT/p.split('?')[0]).read_text() for p in paths)+';\n'
version=hashlib.sha256(runtime.encode()).hexdigest()[:12]
name='store-runtime-'+version+'.js';(ROOT/name).write_text(runtime)
html=re.sub(r'<script defer src="[^"]+"></script>','',html)
html=html.replace('</body>','<script defer src="'+name+'"></script></body>')
preloads='<link rel="preload" as="image" href="assets/aperol-cover-720.jpg" fetchpriority="high"><link rel="preload" as="script" href="'+name+'">'
html=html.replace('</title>','</title>'+preloads,1)
(ROOT/'index.html').write_text(html)
print(json.dumps({'runtime':name,'script_requests_before':len(paths)-1,'script_requests_after':1,'html_gzip_bytes':len(gzip.compress(html.encode())),'runtime_gzip_bytes':len(gzip.compress(runtime.encode()))}))

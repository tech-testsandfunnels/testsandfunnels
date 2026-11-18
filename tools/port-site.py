#!/usr/bin/env python3
"""port-site.py: turn a finished static site build into the Astro site in website/.

Usage (from the repo root):
    python3 tools/port-site.py <build-folder>                  # full port: every page + shared parts
    python3 tools/port-site.py <build-folder> --check          # read and verify only, write nothing
    python3 tools/port-site.py <build-folder> --only=a,b       # add or refresh ONLY these pages
    python3 tools/port-site.py <build-folder> --only=a,b --chrome   # ...and refresh header, footer and icons

What it expects: <build-folder>/index.html, <route>/index.html for every page,
404.html, and optionally <route>/index.md, llms.txt, llms-full.txt, robots.txt,
media/ (the "live/" folder the site generator produces).

Slugs are the route with "/" replaced by "__": "services/brand-building" is
"services__brand-building", home is "index", 404 is "404".

FULL PORT (no --only), the first time a site is set up:
  1. Reads every page and checks the shared parts (CSS, header, footer, site
     script, theme script) are identical on all pages. If a page differs it stops
     and names the page: shared parts are stored ONCE in website/src.
  2. Writes website/src/chrome/{pre.html,post.html,app.js} and
     website/src/styles/global.css, with ONE icon sprite that is the union of
     every icon the pages use.
  3. Writes website/src/html/<slug>.html (the page's <main>) and
     <slug>.jsonld.html (its structured data), and website/src/pages/<route>/index.astro
     (a thin wrapper: title, description, keywords, page type, active nav item,
     published/modified dates).
  4. Copies the Markdown copies (public/<route>/index.md), llms.txt,
     llms-full.txt, robots.txt and media/ into website/public/.
  It REPLACES website/src/html, website/src/pages and the shared files, so run it
  on a fresh copy of the template, or commit first.

ADDING PAGES LATER (--only), when the site build gains new pages:
  Writes only the listed pages (steps 3 and the .md copy of step 4); every other
  page, llms.txt and the other public files stay as they are. It refuses if the
  build's stylesheet or site script differ from the ones already in website/src
  (then do a full port), and it refuses if a page uses an icon that is not in the
  sprite yet: add --chrome, which also rewrites the header (navbar), footer and the
  icon sprite from the build. Add the new pages to llms.txt / llms-full.txt by hand.

BOTH MODES:
  - Keywords per page come from website/keywords.json (slug -> keywords). Missing
    slugs are listed and written to website/keywords.todo.json.
  - Google Tag Manager: the snippet is NOT copied; it lives in Layout.astro
    (GTM_ID). The script only checks the build and Layout agree on the container id.
  - It never touches Layout.astro, astro.config.mjs, the CRM, or hand-made files
    in website/public (favicons, .htaccess). Python 3.8+, no packages.
"""
import glob
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.normpath(os.path.join(HERE, '..', 'website'))
GTM_NOSCRIPT = re.compile(r'<noscript><iframe src="https://www\.googletagmanager\.com/ns\.html\?id=([^"]+)"[^>]*></iframe></noscript>')


def die(msg):
    print('STOP: ' + msg)
    sys.exit(1)


def attr(s, pat):
    m = re.search(pat, s)
    return m.group(1) if m else ''


def unesc(s):
    return s.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&lt;', '<').replace('&gt;', '>')


def read(path):
    return open(path, encoding='utf-8').read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)


def classify_scripts(rel, scripts, problems):
    """The page has: a theme script, an optional Tag Manager snippet, the site
    config (window.TF=) and the big site script. Return them by name."""
    got = {}
    for b in scripts:
        if 'googletagmanager.com/gtm.js' in b:
            got['gtm'] = b
        elif b.lstrip().startswith('window.TF='):
            got['tf'] = b
        elif 'classList.add("js")' in b and len(b) < 1000:
            got['theme'] = b
        elif len(b) > 5000:
            got['app'] = b
        else:
            problems.append('%s: a script block I do not recognise (%d characters)' % (rel, len(b)))
    for need in ('theme', 'tf', 'app'):
        if need not in got:
            problems.append('%s: no %s script found' % (rel, need))
    return got


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check_only = '--check' in sys.argv
    chrome = '--chrome' in sys.argv
    only = None
    for a in sys.argv[1:]:
        if a.startswith('--only='):
            only = [x for x in a[len('--only='):].split(',') if x]
    if len(args) != 1 or not os.path.isdir(args[0]):
        die('give the build folder, e.g.  python3 tools/port-site.py path/to/live')
    src = os.path.abspath(args[0])
    if not os.path.isfile(os.path.join(src, 'index.html')):
        die(src + ' has no index.html: is this the build folder?')
    if chrome and only is None:
        die('--chrome only makes sense with --only (a full port already rewrites the shared parts)')

    kw_path = os.path.join(DST, 'keywords.json')
    keywords = json.load(open(kw_path, encoding='utf-8')) if os.path.isfile(kw_path) else {}

    pages = sorted(glob.glob(os.path.join(src, '**', 'index.html'), recursive=True))
    if os.path.isfile(os.path.join(src, '404.html')):
        pages.append(os.path.join(src, '404.html'))
    print('pages found:', len(pages))

    symbols = {}
    ref = {}  # shared parts, taken from the first page
    gtm_ids = set()
    site_url = ''
    out = []  # (slug, route, main, ld, props, used_icons)
    problems = []

    for f in pages:
        s = read(f)
        rel = os.path.relpath(f, src).replace(os.sep, '/')
        if rel == 'index.html':
            route, slug = '/', 'index'
        elif rel == '404.html':
            route, slug = '/404', '404'
        else:
            route = '/' + os.path.dirname(rel) + '/'
            slug = os.path.dirname(rel).replace('/', '__')

        head = s[:s.index('<body')]
        body = s[s.index('<body'):]
        pre = body[:body.index('<main')]
        main_html = body[body.index('<main'):body.index('</main>') + 7]
        post = body[body.index('</main>') + 7:]
        post = post[:post.index('<script')]

        css = re.search(r'<style>(.*?)</style>', head, re.S).group(1)
        scripts = classify_scripts(rel, re.findall(r'<script(?![^>]*ld\+json)[^>]*>(.*?)</script>', s, re.S), problems)
        if 'app' not in scripts or 'tf' not in scripts:
            continue
        if 'gtm' in scripts:
            gtm_ids.add(attr(scripts['gtm'], r"'dataLayer','([^']+)'"))
        else:
            gtm_ids.add('')

        for sid, sbody in re.findall(r'<symbol id="([^"]+)"[^>]*>(.*?)</symbol>', pre, re.S):
            symbols.setdefault(sid, sbody)
        pre_ns = re.sub(r'<svg width="0".*?</svg>', '[[SPRITE]]', pre, count=1, flags=re.S)
        pre_ns = re.sub(r'^<body[^>]*>', '', pre_ns).replace(' aria-current="page"', '')
        pre_ns = GTM_NOSCRIPT.sub('', pre_ns)  # the Tag Manager noscript is rendered by Layout.astro

        mine = {'css': css, 'app': scripts['app'], 'post': post, 'pre': pre_ns}
        if not ref:
            ref = mine
        for k in mine:
            if mine[k] != ref[k]:
                problems.append('%s: shared part "%s" differs from the first page (it must be identical on every page)' % (rel, k))

        title = unesc(attr(head, r'<title>(.*?)</title>'))
        desc = unesc(attr(head, r'<meta name="description" content="([^"]*)"'))
        noindex = 'noindex' in attr(head, r'<meta name="robots" content="([^"]*)"')
        canonical = attr(head, r'<link rel="canonical" href="([^"]+)"')
        if not title or not desc:
            problems.append(rel + ': missing <title> or meta description')
        if len(title) > 70:
            problems.append(rel + ': title is %d characters (aim for 60 or fewer)' % len(title))
        if not 70 <= len(desc) <= 175 and not noindex:
            problems.append(rel + ': description is %d characters (aim for 120 to 160)' % len(desc))
        if not noindex:
            if not canonical.endswith(route):
                problems.append('%s: canonical %s does not end with the route %s' % (rel, canonical, route))
            if route == '/':
                site_url = canonical.rstrip('/')
        props = {
            'title': title, 'description': desc, 'pageType': attr(body, r'<body data-page-type="([^"]+)"'),
            'navCurrent': attr(pre, r'<a class="link" href="([^"]+)"[^>]*aria-current="page"'),
            'keywords': keywords.get(slug, ''), 'noindex': noindex,
            'published': attr(head, r'article:published_time" content="([^"]+)"'),
            'modified': attr(head, r'article:modified_time" content="([^"]+)"'),
        }
        ld = ''.join(re.findall(r'<script type="application/ld\+json">.*?</script>', head, re.S))
        for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', head, re.S):
            try:
                json.loads(m)
            except ValueError:
                problems.append(rel + ': a JSON-LD block is not valid JSON')
        out.append((slug, route, main_html, ld, props, set(re.findall(r'href="#(i-[a-z0-9-]+)"', main_html))))

    slugs = [o[0] for o in out]
    if only is not None:
        unknown = [x for x in only if x not in slugs]
        if unknown:
            die('not in the build: ' + ', '.join(unknown) + '  (slugs are the route with "/" as "__")')
        selected = [o for o in out if o[0] in only]
    else:
        selected = out

    layout = read(os.path.join(DST, 'src/layouts/Layout.astro'))
    m = re.search(r"const SITE = '([^']+)'", layout)
    if site_url and m and m.group(1) != site_url:
        problems.append('Layout.astro has SITE = %s but the pages say %s: change SITE (and OG_ALT, wa, phone, email, CRM URL, GTM_ID) in website/src/layouts/Layout.astro' % (m.group(1), site_url))
    cfg = read(os.path.join(DST, 'astro.config.mjs'))
    m = re.search(r"site: '([^']+)'", cfg)
    if site_url and m and m.group(1) != site_url:
        problems.append('astro.config.mjs has site: %s but the pages say %s: change it' % (m.group(1), site_url))
    if len(gtm_ids) > 1:
        problems.append('pages disagree about Google Tag Manager (some have it, some do not, or different ids): %s' % sorted(gtm_ids))
    gtm_id = next(iter(gtm_ids)) if len(gtm_ids) == 1 else ''
    m = re.search(r"const GTM_ID = '([^']*)'", layout)
    layout_gtm = m.group(1) if m else ''
    if gtm_id != layout_gtm:
        problems.append('the build uses Google Tag Manager id "%s" but Layout.astro has GTM_ID = "%s": set it in website/src/layouts/Layout.astro' % (gtm_id, layout_gtm))

    sprite_have = set(re.findall(r'<symbol id="([^"]+)"', read(os.path.join(DST, 'src/chrome/pre.html')))) if os.path.isfile(os.path.join(DST, 'src/chrome/pre.html')) else set()
    if only is not None:
        css_have = read(os.path.join(DST, 'src/styles/global.css'))
        app_have = read(os.path.join(DST, 'src/chrome/app.js'))
        if ref['css'].strip() not in css_have:
            problems.append('the build\'s stylesheet differs from website/src/styles/global.css: do a full port (without --only)')
        if ref['app'].strip() != app_have.strip():
            problems.append('the build\'s site script differs from website/src/chrome/app.js: do a full port (without --only)')
        if not chrome:
            for o in selected:
                missing_icons = sorted(o[5] - sprite_have)
                if missing_icons:
                    problems.append('%s uses icons that are not in the sprite yet (%s): add --chrome' % (o[0], ', '.join(missing_icons)))

    hard = [p for p in problems if any(k in p for k in ('shared part', 'no ', 'unrecognise', 'differs from website/src', 'add --chrome', 'GTM_ID', 'Tag Manager', 'not valid JSON'))]
    print('shared parts identical on every page:', not any('shared part' in p for p in problems))
    print('icons in the build\'s sprite:', len(symbols), '| in website/src now:', len(sprite_have))
    if only is not None:
        print('pages to write:', ', '.join(o[0] for o in selected))
    for p in problems:
        print('  PROBLEM:', p)
    missing_kw = [o[0] for o in selected if not o[4]['noindex'] and not o[4]['keywords']]
    if missing_kw:
        print('  no keywords for: ' + ', '.join(missing_kw))
    if check_only:
        print('check only: nothing written')
        sys.exit(1 if hard else 0)
    if hard:
        die('fix the problems above (or regenerate the build) before porting')

    # ---- write ----
    if only is None:
        for d in ('src/html', 'src/pages'):
            shutil.rmtree(os.path.join(DST, d), ignore_errors=True)
            os.makedirs(os.path.join(DST, d))
        for p in glob.glob(os.path.join(DST, 'public', '**', 'index.md'), recursive=True):
            os.remove(p)

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    for slug, route, main_html, ld, props, _icons in selected:
        write(os.path.join(DST, 'src/html', slug + '.html'), main_html + '\n')
        write(os.path.join(DST, 'src/html', slug + '.jsonld.html'), ld + '\n')
        top = slug in ('index', '404')
        up = '../' * (1 if top else route.count('/'))
        out_dir = os.path.join(DST, 'src/pages') if top else os.path.join(DST, 'src/pages', *route.strip('/').split('/'))
        lines = ['title=' + js(props['title']), 'description=' + js(props['description']), 'pageType=' + js(props['pageType'])]
        if props['navCurrent']:
            lines.append('navCurrent=' + js(props['navCurrent']))
        if props['keywords']:
            lines.append('keywords=' + js(props['keywords']))
        if props['noindex']:
            lines.append('noindex')
        if props['published']:
            lines.append('published=' + js(props['published']))
        if props['modified']:
            lines.append('modified=' + js(props['modified']))
        lines.append('jsonLd={jsonLd}')
        wrapper = (
            '---\n'
            '/* %s : thin wrapper. Content is src/html/%s.html (raw <main>),\n'
            '   structured data is src/html/%s.jsonld.html. Meta lives in the props below. */\n'
            "import Layout from '%slayouts/Layout.astro';\n"
            "import main from '%shtml/%s.html?raw';\n"
            "import jsonLd from '%shtml/%s.jsonld.html?raw';\n"
            '---\n'
            '<Layout\n%s\n>\n  <Fragment set:html={main} />\n</Layout>\n'
        ) % (route, slug, slug, up, up, slug, up, slug, '\n'.join('  ' + l for l in lines))
        write(os.path.join(out_dir, '404.astro' if slug == '404' else 'index.astro'), wrapper)
        md = os.path.join(src, route.strip('/'), 'index.md') if route != '/404' else ''
        if md and os.path.isfile(md):
            dst_md = os.path.join(DST, 'public', route.strip('/'), 'index.md')
            os.makedirs(os.path.dirname(dst_md), exist_ok=True)
            shutil.copy(md, dst_md)

    if only is None or chrome:
        sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" '
                  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
                  ''.join('<symbol id="%s" viewBox="0 0 24 24">%s</symbol>' % (k, v) for k, v in sorted(symbols.items())) + '</svg>')
        write(os.path.join(DST, 'src/chrome/pre.html'), '<!-- pre.html: icon sprite (union of every icon the pages use), skip link, progress bar, header, nav, mobile nav. Shared by every page; Layout.astro marks the active nav item and renders the Tag Manager noscript. -->\n' + ref['pre'].replace('[[SPRITE]]', sprite) + '\n')
        write(os.path.join(DST, 'src/chrome/post.html'), '<!-- post.html: footer, mobile action bar, floating CTA, video modal. Shared by every page. -->\n' + ref['post'].strip() + '\n')
    if only is None:
        write(os.path.join(DST, 'src/chrome/app.js'), ref['app'].strip() + '\n')
        write(os.path.join(DST, 'src/styles/global.css'), '@import "tailwindcss";\n\n/* === Site design system (light + dark), from the site build. ===\n   Every class the pages use. Brand tokens are the custom properties on :root. */\n' + ref['css'].strip() + '\n')
        for name in ('llms.txt', 'llms-full.txt'):
            if os.path.isfile(os.path.join(src, name)):
                shutil.copy(os.path.join(src, name), os.path.join(DST, 'public', name))
        if os.path.isfile(os.path.join(src, 'robots.txt')):
            r = read(os.path.join(src, 'robots.txt'))
            r = re.sub(r'(?m)^(Sitemap: .*?)/sitemap\.xml[ \t]*$', r'\1/sitemap-index.xml', r)  # Astro writes sitemap-index.xml
            write(os.path.join(DST, 'public/robots.txt'), r)
        if os.path.isdir(os.path.join(src, 'media')):
            shutil.copytree(os.path.join(src, 'media'), os.path.join(DST, 'public', 'media'), dirs_exist_ok=True)

    todo = {o[0]: '' for o in selected if not o[4]['noindex'] and not o[4]['keywords']}
    todo_path = os.path.join(DST, 'keywords.todo.json')
    if todo:
        json.dump(todo, open(todo_path, 'w', encoding='utf-8'), indent=2)
        print('wrote %s: fill it in, move the lines into keywords.json, run again' % todo_path)
    elif os.path.isfile(todo_path):
        os.remove(todo_path)
    print('done: %d page(s) written to %s' % (len(selected), DST))


if __name__ == '__main__':
    main()

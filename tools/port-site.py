#!/usr/bin/env python3
"""port-site.py: turn a finished static site build into the Astro site in website/.

Usage (from the repo root):
    python3 tools/port-site.py <build-folder>            # e.g. C:\\sites\\newclient\\live
    python3 tools/port-site.py <build-folder> --check    # read and verify only, write nothing

What it expects: <build-folder>/index.html, <route>/index.html for every page,
404.html, and optionally <route>/index.md, llms.txt, llms-full.txt, robots.txt,
media/ (the "live/" folder the site generator produces).

What it does (the same steps every time):
  1. Reads every page and checks the shared parts (CSS, header, footer, site
     script, theme script) are identical on all pages. If a page differs it stops
     and names the page: shared parts are stored ONCE in website/src.
  2. Writes website/src/chrome/{pre.html,post.html,app.js} and
     website/src/styles/global.css (the shared parts), with ONE icon sprite that
     is the union of every icon the pages use.
  3. Writes website/src/html/<slug>.html (the page's <main>) and
     <slug>.jsonld.html (its structured data), and website/src/pages/<route>/index.astro
     (a thin wrapper: title, description, keywords, page type, active nav item,
     published/modified dates).
  4. Copies the Markdown copies (public/<route>/index.md), llms.txt,
     llms-full.txt, robots.txt and media/ into website/public/.
  5. Reads keywords per page from website/keywords.json (slug -> keywords). Slugs
     are the route with "/" replaced by "__" ("services/brand-building" ->
     "services__brand-building", home = "index", 404 = "404"). Missing slugs are
     listed at the end and written to website/keywords.todo.json.

It REPLACES website/src/html, website/src/pages and the shared files, so run it on
a fresh copy of the template, or commit first. It never touches Layout.astro,
astro.config.mjs, the CRM, or hand-made files in website/public (favicons,
.htaccess). Python 3.8+, no packages.
"""
import glob
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.normpath(os.path.join(HERE, '..', 'website'))


def die(msg):
    print('STOP: ' + msg)
    sys.exit(1)


def attr(s, pat):
    m = re.search(pat, s)
    return m.group(1) if m else ''


def unesc(s):
    return s.replace('&amp;', '&').replace('&quot;', '"').replace('&#39;', "'").replace('&lt;', '<').replace('&gt;', '>')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check_only = '--check' in sys.argv
    if len(args) != 1 or not os.path.isdir(args[0]):
        die('give the build folder, e.g.  python3 tools/port-site.py path/to/live')
    src = os.path.abspath(args[0])
    if not os.path.isfile(os.path.join(src, 'index.html')):
        die(src + ' has no index.html: is this the build folder?')

    kw_path = os.path.join(DST, 'keywords.json')
    keywords = json.load(open(kw_path, encoding='utf-8')) if os.path.isfile(kw_path) else {}

    pages = sorted(glob.glob(os.path.join(src, '**', 'index.html'), recursive=True))
    if os.path.isfile(os.path.join(src, '404.html')):
        pages.append(os.path.join(src, '404.html'))
    print('pages found:', len(pages))

    symbols = {}
    ref = {}  # shared parts, taken from the first page
    site_url = ''
    out = []  # (slug, route, main, ld, props)
    problems = []

    for f in pages:
        s = open(f, encoding='utf-8').read()
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
        scripts = re.findall(r'<script(?![^>]*ld\+json)[^>]*>(.*?)</script>', s, re.S)
        if len(scripts) != 3:
            problems.append(rel + ': expected 3 scripts (theme, site config, site script), found %d' % len(scripts))
            continue
        app = scripts[2]

        for sid, sbody in re.findall(r'<symbol id="([^"]+)"[^>]*>(.*?)</symbol>', pre, re.S):
            symbols.setdefault(sid, sbody)
        pre_ns = re.sub(r'<svg width="0".*?</svg>', '[[SPRITE]]', pre, count=1, flags=re.S)
        pre_ns = re.sub(r'^<body[^>]*>', '', pre_ns).replace(' aria-current="page"', '')

        mine = {'css': css, 'app': app, 'post': post, 'pre': pre_ns}
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
        out.append((slug, route, main_html, ld, props))

    missing_kw = [o[0] for o in out if not o[4]['noindex'] and not o[4]['keywords']]
    layout = open(os.path.join(DST, 'src/layouts/Layout.astro'), encoding='utf-8').read()
    m = re.search(r"const SITE = '([^']+)'", layout)
    if site_url and m and m.group(1) != site_url:
        problems.append('Layout.astro has SITE = %s but the pages say %s: change SITE (and OG_ALT, wa, phone, email, CRM URL) in website/src/layouts/Layout.astro' % (m.group(1), site_url))
    cfg = open(os.path.join(DST, 'astro.config.mjs'), encoding='utf-8').read()
    m = re.search(r"site: '([^']+)'", cfg)
    if site_url and m and m.group(1) != site_url:
        problems.append('astro.config.mjs has site: %s but the pages say %s: change it' % (m.group(1), site_url))

    print('shared parts identical on every page:', not any('shared part' in p for p in problems))
    print('icons in the shared sprite:', len(symbols))
    for p in problems:
        print('  PROBLEM:', p)
    if missing_kw:
        print('  no keywords for: ' + ', '.join(missing_kw))
    if check_only:
        print('check only: nothing written')
        sys.exit(1 if any('shared part' in p or 'expected 3' in p for p in problems) else 0)
    if any('shared part' in p or 'expected 3' in p for p in problems):
        die('fix the pages above (or regenerate the build) before porting')

    # ---- write ----
    for d in ('src/html', 'src/pages'):
        shutil.rmtree(os.path.join(DST, d), ignore_errors=True)
        os.makedirs(os.path.join(DST, d))
    for p in glob.glob(os.path.join(DST, 'public', '**', 'index.md'), recursive=True):
        os.remove(p)

    def js(v):
        return json.dumps(v, ensure_ascii=False)

    for slug, route, main_html, ld, props in out:
        open(os.path.join(DST, 'src/html', slug + '.html'), 'w', encoding='utf-8').write(main_html + '\n')
        open(os.path.join(DST, 'src/html', slug + '.jsonld.html'), 'w', encoding='utf-8').write(ld + '\n')
        top = slug in ('index', '404')
        up = '../' * (1 if top else route.count('/'))
        out_dir = os.path.join(DST, 'src/pages') if top else os.path.join(DST, 'src/pages', *route.strip('/').split('/'))
        os.makedirs(out_dir, exist_ok=True)
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
        open(os.path.join(out_dir, '404.astro' if slug == '404' else 'index.astro'), 'w', encoding='utf-8').write(wrapper)
        md = os.path.join(src, route.strip('/'), 'index.md') if route != '/404' else ''
        if md and os.path.isfile(md):
            dst_md = os.path.join(DST, 'public', route.strip('/'), 'index.md')
            os.makedirs(os.path.dirname(dst_md), exist_ok=True)
            shutil.copy(md, dst_md)

    sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" '
              'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
              ''.join('<symbol id="%s" viewBox="0 0 24 24">%s</symbol>' % (k, v) for k, v in sorted(symbols.items())) + '</svg>')
    w = lambda p, t: open(os.path.join(DST, p), 'w', encoding='utf-8').write(t)
    w('src/chrome/pre.html', '<!-- pre.html: icon sprite (union of every icon the pages use), skip link, progress bar, header, nav, mobile nav. Shared by every page; Layout.astro marks the active nav item. -->\n' + ref['pre'].replace('[[SPRITE]]', sprite) + '\n')
    w('src/chrome/post.html', '<!-- post.html: footer, mobile action bar, floating CTA, video modal. Shared by every page. -->\n' + ref['post'].strip() + '\n')
    w('src/chrome/app.js', ref['app'].strip() + '\n')
    w('src/styles/global.css', '@import "tailwindcss";\n\n/* === Site design system (light + dark), from the site build. ===\n   Every class the pages use. Brand tokens are the custom properties on :root. */\n' + ref['css'].strip() + '\n')

    for name in ('llms.txt', 'llms-full.txt'):
        if os.path.isfile(os.path.join(src, name)):
            shutil.copy(os.path.join(src, name), os.path.join(DST, 'public', name))
    if os.path.isfile(os.path.join(src, 'robots.txt')):
        r = open(os.path.join(src, 'robots.txt'), encoding='utf-8').read()
        r = re.sub(r'(?m)^(Sitemap: .*?)/sitemap\.xml[ \t]*$', r'\1/sitemap-index.xml', r)  # Astro writes sitemap-index.xml
        w('public/robots.txt', r)
    if os.path.isdir(os.path.join(src, 'media')):
        shutil.copytree(os.path.join(src, 'media'), os.path.join(DST, 'public', 'media'), dirs_exist_ok=True)

    todo = {o[0]: '' for o in out if not o[4]['noindex'] and not o[4]['keywords']}
    todo_path = os.path.join(DST, 'keywords.todo.json')
    if todo:
        json.dump(todo, open(todo_path, 'w', encoding='utf-8'), indent=2)
        print('wrote %s: fill it in, move the lines into keywords.json, run again' % todo_path)
    elif os.path.isfile(todo_path):
        os.remove(todo_path)
    print('done: %d pages written to %s' % (len(out), DST))


if __name__ == '__main__':
    main()

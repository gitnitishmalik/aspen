"""Publish the site to Netlify (https://aspen-homes-concept.netlify.app).

  python -I tools/deploy.py

Run it from the aspen-cinematic folder after `netlify login`. Only the files the page needs go up
(no README, no tools). Run it again whenever the frames or the page change.

  python -I tools/deploy.py --with-ai    # also publish the AI chat function (netlify/functions)

The demo needs nothing else: the assistant answers from its built-in replies. --with-ai also needs the
Anthropic SDK (installed here from package.json on first use), an ANTHROPIC_API_KEY in the Netlify
site's environment variables, and LIVE_AI = true in chat.js.
"""
import os
import shutil
import subprocess
import sys

SITE = 'bb84affc-286c-4533-aa88-22f589c7f997'  # aspen-homes-concept
FILES = ('index.html', 'custom-homes.html', 'gallery.html', 'process.html', 'styles.css', 'main.js', 'motion.js',
         'features.js', 'pages.js', 'chat.js', 'house3d.js', '_headers', 'robots.txt', 'access-form.html')
FOLDERS = ('img', 'frames')

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
netlify = shutil.which('netlify')
if not netlify:
    sys.exit('netlify CLI not found: npm install -g netlify-cli')

with_ai = '--with-ai' in sys.argv
draft = '--draft' in sys.argv   # publish to a test address instead of the live site
functions = os.path.join(here, 'netlify', 'functions')
# the access gate (netlify/edge-functions/access.js) is published on every deploy and needs @netlify/blobs
if not os.path.isdir(os.path.join(here, 'node_modules', '@netlify', 'blobs')) or (
        with_ai and not os.path.isdir(os.path.join(here, 'node_modules', '@anthropic-ai', 'sdk'))):
    npm = shutil.which('npm')
    if not npm:
        sys.exit('npm not found: install Node.js so the chat function can be bundled')
    subprocess.run([npm, 'install', '--no-audit', '--no-fund'], cwd=here, check=True)

# The files are staged inside this folder and published through a Netlify build with no build command:
# that build step is what bundles the access gate (edge functions are skipped by --no-build).
stage = os.path.join(here, '.deploy')
toml = os.path.join(here, 'netlify.toml')
shutil.rmtree(stage, ignore_errors=True)
os.makedirs(stage)
try:
    for f in FILES:
        shutil.copy2(os.path.join(here, f), stage)
    for d in FOLDERS:
        shutil.copytree(os.path.join(here, d), os.path.join(stage, d))
    with open(toml, 'w', encoding='utf-8') as t:
        t.write('\n'.join((
            '# written by tools/deploy.py on every publish',
            '[build]',
            '  publish = ".deploy"',
            '  command = ""',
            '  edge_functions = "netlify/edge-functions"',
            '[functions]',
            '  directory = "%s"' % ('netlify/functions' if with_ai else '.deploy-no-functions'),
            '')))
    cmd = [netlify, 'deploy', '--site', SITE, '--message', 'aspen concept']
    cmd += ['--alias', 'gate-test'] if draft else ['--prod']
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, cwd=here)
finally:
    shutil.rmtree(stage, ignore_errors=True)
    if os.path.exists(toml):
        os.remove(toml)

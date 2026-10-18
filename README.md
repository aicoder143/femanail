# Femanail Prompt Studio

A static, browser-only studio for creating detailed thumbnail briefs for YouTube and Instagram. Built with HTML, CSS, and vanilla JavaScript. No build step, backend, database, account, or API key is needed.

## Install on a phone

Open the [GitHub Pages site](https://aicoder143.github.io/femanail/) in your phone's browser and select **Install app**. On Android, Chrome can show an install prompt or an **Install app** browser-menu item. On iPhone or iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**. The installed app opens in its own window. The main studio, Shortcodes, and Hero Banner pages are cached for offline use; previously saved projects remain browser-local.

## Use locally

Open `dist/index.html` in a browser. Choose a platform and format, enter a topic, refine the creative direction, and select **Generate prompt**. Switch between provider-neutral JSON, ChatGPT, and Gemini tabs. Copy or download the current prompt.

The preview is a composition guide, not an AI generated image. To use a reference photo in ChatGPT or Gemini, attach that same photo alongside the exported prompt. The prompt includes its file name and usage instructions, but never embeds its image bytes.

## Quick shortcodes

Open `dist/shortcodes.html` or select **Shortcodes** in the site navigation. Choose a visual recipe, platform, format, title, and optional creative details. The page builds a compact ChatGPT-ready instruction, for example:

```text
/character cutout 9:16 Instagram reel size Title: Chandamama Ve
```

Copy or download the line and attach any reference photo separately in ChatGPT. The subject, background, mood, and extra direction fields each offer a dropdown of popular visual ideas; selecting one fills an editable text box. These are concise natural-language instructions, not built-in ChatGPT slash commands. The shortcode draft is retained in this browser.

The title field accepts English text. **Thumbnail title language** defaults to English and offers 24 Indian languages, including Telugu. For another language, the shortcode tells ChatGPT to translate or transliterate the English title into the selected script and render only that result on the image. Translation happens in ChatGPT when you use the shortcode; this static site does not translate text itself. Review spelling in the finished thumbnail.

## Hero banner portraits

Open `dist/hero-banner.html` or choose **Hero banner** in the navigation. Set the canvas and text-safe area, then customize outfit style and color, fabric, hair, hands, body posture, viewer-left/center/right tilt, gaze, expression, lighting, background, and accessories. Each preset can be refined in an editable field. **Load reference example** fills in the supplied yellow-sweater portrait direction. Upload a photo to preview it; attach the original photo again when using the exported prompt. JSON, compact shortcode, ChatGPT, and Gemini versions can be copied or downloaded. The shortcode is a concise instruction, not a built-in slash command. A local draft is kept in this browser. Transparent PNG is requested when selected, subject to the image tool supporting alpha output.

## Saved projects

**Save project** stores form values in this browser's `localStorage`; **Open** restores them. Small reference images may also be stored locally. Large images must be attached again after reopening. Browser storage is device and browser specific; clearing site data deletes saved projects. Export prompts separately for a portable record.

## GitHub Pages deployment

Run the included Python publisher with Git installed and a GitHub account signed in through Git, GitHub CLI, or a `GITHUB_TOKEN` environment variable:

```bash
python3 publish_github_pages.py https://github.com/aicoder143/femanail.git
```

The script checks the repository, copies only `dist/` into a dedicated `gh-pages` branch, pushes that branch, configures Pages to serve its root, and waits for the GitHub Pages build. The previous contents of `gh-pages` are replaced; an existing `CNAME` custom-domain file is kept. The default branch is untouched. Run `--dry-run` to validate the repository link and local files without publishing.

If no valid sign-in is available, run `gh auth login` or provide a token through `GITHUB_TOKEN`; never paste a token into the script. A fine-grained token needs repository Contents write, Pages write, and Administration write permissions. The publisher reports the Pages URL when configured.

To use a custom domain, configure it in GitHub Pages settings and follow GitHub's DNS guidance. Do not put API keys in these files; browser visitors can inspect all frontend code. Future direct image generation should use a separate authenticated server or managed proxy.

## Files

- `dist/index.html` — accessible app structure and controls
- `dist/styles.css` — responsive design
- `dist/app.js` — formats, 25 presets, prompt engine, uploads, exports, and saved projects
- `dist/shortcodes.html` and `dist/shortcodes.js` — compact ChatGPT shortcode builder
- `dist/hero-banner.html` and `dist/hero-banner.js` — customizable website hero image prompt builder
- `dist/manifest.webmanifest`, `dist/service-worker.js`, `dist/pwa.js`, and `dist/icons/` — mobile installation and offline assets
- `publish_github_pages.py` — publish the static site to a GitHub repository and enable Pages
- `.openai/hosting.json` — ChatGPT Sites deployment configuration; omit this file when copying `dist/` to GitHub Pages

## Prompt behavior

JSON generation is deterministic for the current inputs: it contains no timestamps, randomness, or provider-specific syntax. Platform and content format suggest an aspect ratio, while the ratio selector allows a manual override. Prompt content asks for one readable focal point, clear safe margins, honest storytelling, and a single final image.

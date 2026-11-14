# Static Site Generator

Static site generator built in TypeScript for fun. Inspired heavily by Hugo.

## Expected layout of a static site.
```txt
<root>/
  layouts/
    main.html
    custom-elements/
      <custom element name>.html
    partials/
      <partial name>.html
  content/
    HTML/Markdown files for the site
  static/
    Directory of static files to be included in the generated website.
```
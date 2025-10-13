# templaterrr

Tiny EJS-like templating library with whitespace normalization.

## Installation

```bash
npm install templaterrr
```

## Examples

### Basic usage

```js
import { compile } from 'templaterrr';

const template = compile('Hello, <%= name %>!');
console.log(template({ name: 'World' }));
// => Hello, World!
```

### Loading templates from files

```js
import { render } from 'templaterrr';

const output = render('views/page.ejs', {
  title: 'Home',
  items: ['one', 'two', 'three']
});
```

### Including partials

```js
import { compile } from 'templaterrr';

const template = compile(`
  <div class="page">
    <%- include('header.ejs', { title: pageTitle }) %>
    <main><%= content %></main>
  </div>
`);

template({ pageTitle: 'Home', content: 'Welcome' });
```

## API

### compile(source, options)

Compiles a template string and returns a render function.

- `source` - template source code
- `options` - optional configuration object
- Returns: `function(context)` that renders the template

### compileFile(path, options)

Compiles a template from a file and returns a render function.

- `path` - path to template file
- `options` - optional configuration object
- Returns: `function(context)` that renders the template

### render(path, context, options)

Compiles and renders a template file in one step.

- `path` - path to template file
- `context` - data to pass to template
- `options` - optional configuration object
- Returns: rendered string

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseDirectory` | string | `''` | Base directory for resolving template paths |
| `extension` | string | `'.ejs'` | File extension to append when resolving templates |
| `readFile` | function | `null` | Custom function for reading files: `(path) => string` |
| `useCache` | boolean | `true` | Cache compiled templates |
| `preserveWhitespace` | boolean | `false` | Disable whitespace collapsing and normalization |
| `templateFilename` | string | `path` | Template name used in error messages |

## Caching

Compiled templates are cached by default. Caching is automatically disabled when `NODE_ENV=development`. You can manually control caching with the `useCache` option.

## EJS compatibility

### Included behaviour

- `<%= value %>` - escaped output
- `<%- value %>` - unescaped output
- `<% code %>` - control flow (if/for/while/etc)
- `include(path, context)` - include other templates
- Context access via variables or `ctx` object, not `locals`
- HTML comment preservation

### Missing features

- Async/await and promises
- Custom delimiters
- Filters
- Client-side compilation
- Advanced EJS features (layouts, blocks, etc)

### Known bugs

When `</script>` or `</style>` appears in a string literal inside a script or style tag, whitespace handling changes after that point. This is a parser limitation.

## Whitespace normalization

By default, templaterrr collapses whitespace:

- Multiple spaces/tabs become a single space
- Multiple newlines become a single newline
- Leading indentation is removed (dedented)
- Whitespace around newlines is removed

Whitespace is always preserved inside `<script>`, `<style>`, and `<pre>` tags.

You can control this with the `preserveWhitespace` option or inline directives:

```js
compile(`
  Normal text
  <% // PRESERVE_WHITESPACE %>
  Preserved     spacing
  <% // PRESERVE_WHITESPACE_OFF %>
  Normal    again
`)
```

## License
Licensed under the [MIT License](LICENSE).
Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/)).

# templaterrr

Tiny EJS-like templating library with whitespace normalization.

I wasn't satisfied with EJS's implementation or with any other HTML templating libraries, so I wrote (and re-wrote) templaterrr to satisfy my requirements. It's tiny, clean, simple, and the templated HTML has appropriate whitespace for my taste. For most server-side applications, you can just import the `render` function and call it as part of your application's routes.

This library ships as a CommonJS bundle with full TypeScript definitions, but it can be used with `import` on modern Node.js or Bun. The test suite uses Bun's built-in testing library.

## Installation

```bash
npm install templaterrr
```

## Examples

### Basic Usage

The simplest way to use templaterrr is with the `render` function, which loads and renders a template file in one step:

```javascript
import { render } from 'templaterrr';

var html = render('views/welcome.ejs', { name: 'Alice' });
console.log(html);
// Output: <h1>Hello, Alice!</h1>
```

Template syntax uses `<%= %>` for escaped output and `<% %>` for code:

```html
<!-- views/welcome.ejs -->
<h1>Hello, <%= name %>!</h1>
<ul>
  <% items.forEach(function(item) { %>
    <li><%= item %></li>
  <% }); %>
</ul>
```

### Compiling strings

For templates defined as strings in your code, use `compileString`:

```javascript
import { compileString } from 'templaterrr';

var template = compileString('<h1><%= title %></h1><p><%= content %></p>');

// Reuse the compiled template multiple times
var html1 = template({ title: 'Hello', content: 'World!' });
var html2 = template({ title: 'Goodbye', content: 'For now!' });

console.log(html1);
// Output: <h1>Hello</h1><p>World!</p>

console.log(html2);
// Output: <h1>Goodbye</h1><p>For now!</p>
```

### Including Partials

Use `<%- include(path, context) %>` to include other templates. Note the `-` to prevent HTML escaping:

```html
<!-- views/page.ejs -->
<!DOCTYPE html>
<html>
  <%- include('views/header.ejs', { title: pageTitle }) %>
  <body>
    <p>Welcome, <%= userName %>!</p>
  </body>
</html>
```

```html
<!-- views/header.ejs -->
<header>
  <h1><%= title %></h1>
</header>
```

```javascript
import { render } from 'templaterrr';

var html = render('views/page.ejs', {
  pageTitle: 'My Site',
  userName: 'Alice'
});
```

### Passing Options

Customize template behavior with options:

```javascript
import { compileFile, render } from 'templaterrr';

// Set base directory and extension for template resolution
var template = compileFile('header', {
  baseDirectory: './views',
  extension: '.html'
});
// Looks for './views/header.html'

// Disable caching during development
var html = render('template.ejs', { data: 'value' }, {
  useCache: false
});

// Preserve all whitespace (disable normalization)
var template = compileString('<p>  spaces  </p>', {
  preserveWhitespace: true
});

// Use a custom escape function
var template = compileString('<%= text %>', {
  escape: function(value) {
    return String(value).toUpperCase();
  }
});
```

## API

### `render(path, context, options?)`

Renders a template file directly to a string in a single operation.

**Parameters:**
- `path: string` - Path to the template file
- `context: any` - Context object to use when rendering
- `options: Options` - Optional compilation options

**Returns:** `string` - The rendered HTML

**Example:**
```javascript
var html = render('welcome.ejs', { name: 'Alice' });
```

---

### `compileString(source, options?)`

Compiles a template source string into a reusable render function.

**Parameters:**
- `source: string` - Template source code
- `options: Options` - Optional compilation options

**Returns:** `(context: any) => string` - The compiled template function.

**Example:**
```javascript
var template = compileString('<h1><%= title %></h1>');
var html = template({ title: 'Hello' });
```

---

### `compileFile(path, options?)`

Compiles a template from a file into a reusable render function. Compiled templates are cached by default.

**Parameters:**
- `path: string` - Path to the template file
- `options: Options` - Optional compilation options

**Returns:** `(context: any) => string` - The compiled template function.

**Example:**
```javascript
var template = compileFile('views/header.ejs');
var html = template({ title: 'Welcome' });
```

---

### `compileToString(name, source, options?)`

Compiles a template source string into generated JavaScript code without executing it. Useful for build pipelines or code inspection.

**Parameters:**
- `name: string` - Function name for the generated code, or `null` for just the body
- `source: string` - Template source code
- `options: Options` - Optional compilation options

**Returns:** `string` - The generated JavaScript code

**Example:**
```javascript
var code = compileToString('myTemplate', '<h1><%= title %></h1>');
console.log(code);
// function myTemplate(__context, __escape, __include) {
//   var __buffer = "";
//   ...
//   return __buffer;
// }
```

---

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| baseDirectory | `string` | `""` | Base directory for resolving template paths when including other templates. Ignored if custom `readFile` is provided. |
| extension | `string` | `".ejs"` | File extension to append when resolving template names. Ignored if custom `readFile` is provided. |
| readFile | `(path) => string` | `null` | Custom function to read file contents. |
| escape | `(string) => string`  | `null` | Custom function to escape values in `<%= %>` tags. Default escapes HTML entities. |
| include | `(path, context) => string` | `null` | Custom function to include other templates. |
| useCache | `boolean` | `true` (production) / `false` (development) | Whether to cache compiled templates. |
| preserveWhitespace | `boolean` | `false` | Whether to preserve all whitespace. When `false`, whitespace is normalized. |
| templatePath | `string` | `"<anonymous template>"` | Path to use in error messages. Ignored/overridden when compiling from a file. |

### Template Syntax

**Escaped output:**
```html
<%= value %>
```
Outputs the value with HTML escaping (`&`, `<`, `>`, `"`, `'` are escaped).

**Unescaped output:**
```html
<%- value %>
```
Outputs the value without escaping.

**Code execution:**
```html
<% var x = 10; %>
<% if (condition) { %>
  <p>True</p>
<% } %>
```
Executes JavaScript code without output.

**Including templates:**
```html
<%- include('path/to/template.ejs', { key: 'value' }) %>
```
Includes another template with its own context data.

## Notes

### EJS Compatibility

templaterrr uses EJS-like syntax but is *not* a drop-in replacement for EJS. It implements a subset of EJS features:

**Supported:**
- Basic template tags: `<% %>`, `<%= %>`, `<%- %>`
- Including templates via `include` function
- JavaScript expressions and control flow
- Context object access

**Missing:**
- Async/await in templates
- Custom delimiters (only `<% %>` syntax)
- Filters
- Advanced EJS features (layouts, blocks, etc.)

If you need these features, use the full EJS library instead.

### Caching Behavior

By default, compiled templates are cached in memory for performance:

- `NODE_ENV !== "development"`: Caching enabled by default
- `NODE_ENV === "development"`: Caching is **disabled** in development

You can override this with the `useCache` option:

```javascript
// Always use cache
var template = compileFile('template.ejs', { useCache: true });

// Never use cache
var template = compileFile('template.ejs', { useCache: false });
```

The cache is never cleared. If you're loading many unique templates, turn it off.

### Whitespace Normalization

By default with `preserveWhitespace: false`, templaterrr normalizes whitespace to produce clean HTML:

1. Multiple spaces/tabs are collapsed to a single space
2. Multiple newlines are collapsed to a single newline
3. Whitespace is dedented based on common indentation
4. Whitespace inside `<pre>`, `<textarea>`, `<script>`, `<style>`, and `<!--comments-->` is preserved, but still dedented

**Example:**

```javascript
var template = compileString(`
  <div>
    <p>Hello    World</p>
    <p>Multiple


    newlines</p>
  </div>
`);

console.log(template({}));
// Output:
//
// <div>
// <p>Hello World</p>
// <p>Multiple
// newlines</p>
// </div>
//
```

To preserve all whitespace exactly as written, use `preserveWhitespace: true`:

```javascript
var template = compileString('hello    world\n\n\nthere', {
  preserveWhitespace: true
});

console.log(template({}));
// Output: hello    world\n\n\nthere
```

### Known Bugs

**`</script>` inside `<script>` tag strings:**

The parser does not understand JavaScript string literals inside `<script>` tags. If you have `"</script>"` in your JavaScript code, it will incorrectly close the script tag:

```html
<script>
  var code = "</script>";  // this breaks!
  var more = "   so   many   spaces    ";
  // will print " so many spaces " oh no!
  console.log(more);
</script>
```

The simple workaround is to split the closing tag or escape it:

```html
<script>
  var code = "<" + "/script>";
  var more = "   so   many   spaces    ";
  // will print "   so   many   spaces    " as expected
  console.log(more);
</script>
```

Note that this also affects `<pre>`, `<style>`, and `<textarea>` tags.

## License

Licensed under the [MIT License](LICENSE).

Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/)).

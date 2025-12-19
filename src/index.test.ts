import { describe, test, expect } from 'bun:test';
import { compileToString, compileString, compileFile, render } from './index';

describe('compileToString', () => {
  test('empty string', () => {
    const code = compileToString(null, '');
        expect(code).toContain('return');
  });

  test('normal text', () => {
    const code = compileToString(null, 'Hello, World!');
    expect(code).toContain('Hello, World!');
    expect(code).toContain('return');
  });

  test('text with templated parts', () => {
    const code = compileToString(null, 'Hello, <%= name %>!');
    expect(code).toContain('Hello, ');
    expect(code).toContain(' name ');
    expect(code).toContain('return');
  });

  test('without name, generates just body', () => {
    const code = compileToString(null, 'test');
    expect(code).not.toContain('function');
  });

  test('with name, generates function wrapper', () => {
    const code = compileToString('myTemplate', 'test');
    expect(code).toContain('function myTemplate(__context, __escape, __include) {');
  });

  test('errors on bad arguments', () => {
    expect(() => compileToString(123 as any, 'test')).toThrow('name must be a string or null');
    expect(() => compileToString(null, 123 as any)).toThrow('source must be a string');
    expect(() => compileToString(null, 'test', 'not-an-object' as any)).toThrow('options must be an object if provided');
  });
});

describe('compileString', () => {
  test('empty string', () => {
    const template = compileString('');
    const result = template({});
    expect(result).toBe('');
  });

  test('normal text', () => {
    const template = compileString('Hello, World!');
    const result = template({});
    expect(result).toBe('Hello, World!');
  });

  test('text with templated parts', () => {
    const template = compileString('Hello, <%= name %>!');
    const result = template({ name: 'Alice' });
    expect(result).toBe('Hello, Alice!');
  });

  test('errors on bad arguments', () => {
    expect(() => compileString(123 as any)).toThrow('source must be a string');
    expect(() => compileString('test', 'not-an-object' as any)).toThrow('options must be an object if provided');
  });

  test('numbers and booleans are rendered', () => {
    const template = compileString('<%= num %> <%= bool %>');
    const result = template({ num: 42, bool: true });
    expect(result).toBe('42 true');
  });

  test('objects and arrays are not rendered directly', () => {
    const template = compileString('<%= obj %> <%= arr %>');
    const result = template({ obj: { key: 'value' }, arr: [1, 2, 3] });
    expect(result).toBe('[object Object] 1,2,3');
  });

  test('false and zero are rendered', () => {
    const template = compileString('<%= bool %> <%= num %>');
    const result = template({ bool: false, num: 0 });
    expect(result).toBe('false 0');
  });

  test('null and undefined are not rendered', () => {
    const template = compileString('a<%= nullVal %>b<%= undefinedVal %>c');
    const result = template({ nullVal: null, undefinedVal: undefined });
    expect(result).toBe('abc');
  });

  test('ternary operators', () => {
    const template = compileString('<%= age >= 18 ? "adult" : "minor" %>');
    expect(template({ age: 20 })).toBe('adult');
    expect(template({ age: 15 })).toBe('minor');
  });

  test('variable declarations', () => {
    const template = compileString('<% var greeting = "Hi"; %><%= greeting %>, <%= name %>!');
    const result = template({ name: 'Bob' });
    expect(result).toBe('Hi, Bob!');
  });

  test('control flow', () => {
    const template = compileString('<% if (show) { %>Visible<% } else { %>Hidden<% } %>');
    expect(template({ show: true })).toBe('Visible');
    expect(template({ show: false })).toBe('Hidden');
  });

  test('loops', () => {
    const template = compileString('<% for (var i = 0; i < items.length; i++) { %><%= items[i] %><% if (i < items.length - 1) { %>, <% } %><% } %>');
    const result = template({ items: ['a', 'b', 'c'] });
    expect(result).toBe('a, b, c');
  });

  test('functional loops', () => {
    const template = compileString('<ul><% items.forEach(item => { %><li><%= item %></li><% }); %></ul>');
    const result = template({ items: ['apple', 'banana', 'cherry'] });
    expect(result).toBe('<ul><li>apple</li><li>banana</li><li>cherry</li></ul>');
  });

  test('nested control structures', () => {
    const template = compileString('<% users.forEach(user => { %><% if (user.active) { %><%= user.name %><% } %><% }); %>');
    const result = template({ users: [{ name: 'Alice', active: true }, { name: 'Bob', active: false }, { name: 'Charlie', active: true }] });
    expect(result).toBe('AliceCharlie');
  });

  test('function definitions and calls', () => {
    const template = compileString('<% function greet(name) { return "Hello, " + name; } %><%= greet(person) %>');
    const result = template({ person: 'World' });
    expect(result).toBe('Hello, World');
  });

  test('access context', () => {
    const template = compileString('<%= name %> is <%= age %> years old');
    const result = template({ name: 'Alice', age: 30 });
    expect(result).toBe('Alice is 30 years old');
  });

  test('access context via `ctx` variable', () => {
    const template = compileString('<%= ctx.name %> is <%= ctx.age %> years old');
    const result = template({ name: 'Alice', age: 30 });
    expect(result).toBe('Alice is 30 years old');
  });

  test('nested context access', () => {
    const template = compileString('<%= user.name %> lives in <%= user.address.city %>');
    const result = template({ user: { name: 'Bob', address: { city: 'New York' } } });
    expect(result).toBe('Bob lives in New York');
  });

  test('complex context access', () => {
    const template = compileString('<% items.forEach(item => { %><%= item.name %>: $<%= item.price.toFixed(2) %>\n<% }); %>');
    const result = template({ items: [{ name: 'Apple', price: 1.5 }, { name: 'Banana', price: 0.75 }] });
    expect(result).toBe('Apple: $1.50\nBanana: $0.75\n');
  });

  test('mutating context from inside template', () => {
    const template = compileString('<% number = number + 10 %>New number: <%= number %>');
    const context = { number: 5 };
    const result = template(context);
    expect(result).toBe('New number: 15');
    expect(context.number).toBe(15); // original context was mutated
  });

  test('passing falsy context replaced with empty object', () => {
    const template = compileString('<%- typeof ctx %> <%- JSON.stringify(ctx) %>');
    expect(template(null)).toBe('object {}');
    expect(template(undefined)).toBe('object {}');
    expect(template(0 as any)).toBe('object {}');
    expect(template(1 as any)).toBe('number 1');
    expect(template(false as any)).toBe('object {}');
    expect(template(true as any)).toBe('boolean true');
    expect(template('' as any)).toBe('object {}');
    expect(template('hello' as any)).toBe('string "hello"');
  });

  test('html escaping', () => {
    const template = compileString('<%= text %>');
    const result = template({ text: '<script>alert("xss")</script>' });
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('unicode inside and outside templated parts', () => {
    const template = compileString('Hello 🌍! <%= emoji %>');
    const result = template({ emoji: '🎉' });
    expect(result).toBe('Hello 🌍! 🎉');
  });

  test('custom escape function', () => {
    const template = compileString('<%= text %>', {
      escape: (str: any) => String(str).toUpperCase()
    });
    const result = template({ text: 'hello world' });
    expect(result).toBe('HELLO WORLD');
  });

  test('custom include function', () => {
    const template = compileString('<%- include("header", { title: "Test" }) %>', {
      include: (path: string, ctx: any) => `<h1>${ctx.title}</h1>`
    });
    const result = template({});
    expect(result).toBe('<h1>Test</h1>');
  });

  test('custom read file function, called by include', () => {
    const files: Record<string, string> = {
      'header.ejs': '<h1><%= title %></h1>'
    };
    const template = compileString('<%- include("header.ejs", { title: "Welcome" }) %>', {
      readFile: (path: string) => files[path] || ''
    });
    const result = template({});
    expect(result).toBe('<h1>Welcome</h1>');
  });

  test('syntax errors throw at compile time', () => {
    expect(() => compileString('<% var x = { %>')).toThrow();
  });

  test('runtime errors throw at render time', () => {
    const template = compileString('<% throw new Error("oops") %>');
    expect(() => template({})).toThrow('oops');
  });

  test('syntax errors include template path from options', () => {
    try {
      compileString('<% var x = { %>', { templatePath: 'my-template.ejs' });
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toContain('my-template.ejs');
    }
  });

  test('runtime errors include template path from options', () => {
    const template = compileString('<% throw new Error("oops") %>', { templatePath: 'my-template.ejs' });
    try {
      template({});
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toContain('my-template.ejs');
    }
  });

  test('crlf is replaced with lf', () => {
    const template = compileString('line1\r\nline2\r\nline3');
    const result = template({});
    expect(result).toBe('line1\nline2\nline3');
  });

  test('whitespace is collapsed', () => {
    const template = compileString('hello    world\n\n\nthere');
    const result = template({});
    expect(result).toBe('hello world\nthere');
  });

  test('whitespace is dedented', () => {
    const template = compileString(`
      <div>
        <p>Hello</p>
      </div>
    `);
    const result = template({});
    expect(result).toBe('\n<div>\n<p>Hello</p>\n</div>\n');
  });

  test('single lines are not dedented', () => {
    const template = compileString('  <p>Hello</p>  ');
    const result = template({});
    expect(result).toBe(' <p>Hello</p> ');
  });

  test('whitespace inside <pre> is preserved but dedented', () => {
    const template = compileString(`
      <pre>
        line1
          line2
      </pre>
    `);
    const result = template({});
    // pre tags preserve whitespace but still apply dedenting to the entire block
    expect(result).toBe('\n<pre>\n        line1\n          line2\n      </pre>\n');
  });

  test('whitespace inside other preserved tags is preserved but dedented', () => {
    const template1 = compileString(`
      <textarea>
        line1
          line2
      </textarea>
    `);
    expect(template1({})).toBe('\n<textarea>\nline1\n  line2\n</textarea>\n');

    const template2 = compileString(`
      <script>
        var x = 1;
          var y = 2;
      </script>
    `);
    expect(template2({})).toBe('\n<script>\nvar x = 1;\n  var y = 2;\n</script>\n');

    const template3 = compileString(`
      <style>
        .class {
          color: red;
        }
      </style>
    `);
    expect(template3({})).toBe('\n<style>\n.class {\n  color: red;\n}\n</style>\n');
  });

  test('nested pre breaks', () => {
    // this test documents that nested <pre> tags are not properly handled
    // and the closing tag will break out of pre mode
    const template = compileString(`
      <pre>
        <pre>
          nested
        </pre>
        still in pre?
      </pre>
    `);
    const result = template({});
    // after first </pre>, whitespace collapsing resumes
    expect(result).toContain('<pre>\n        <pre>\n          nested');
    expect(result).toContain('\nstill in pre?\n</pre>');
  });

  test('nested preserved tags break', () => {
    // similar to nested pre, this documents the limitation
    const template = compileString(`
      <textarea>
        <textarea>
          nested
        </textarea>
        still in textarea?
      </textarea>
    `);
    const result = template({});
    expect(result).toContain('<textarea>\n<textarea>\n  nested\n');
    expect(result).toContain('</textarea>\nstill in textarea?\n</textarea>');
  });

  test('<script> containing "</script>" in a string breaks', () => {
    // this documents that string parsing inside script tags is not handled
    const template = compileString(`
      <script>
        var x = "</script>";
        var y = "  spaces  in  this  string  ";
      </script>
    `);
    const result = template({});
    // the closing script tag in the string will close the script element
    expect(result).toContain('" spaces in this string "');
  });

  test('unterminated <script>/<pre>/<textarea>s don\'t throw', () => {
    const template1 = compileString(`
      <pre></pre>
      <script>
        var x = 1;
    `);
    expect(template1({})).toBe('\n<pre></pre>\n<script>\nvar x = 1;\n');

    const template2 = compileString(`
      <script></script>
      <pre>
        line1
          line2
    `);
    expect(template2({})).toBe('\n<script></script>\n<pre>\n        line1\n          line2\n    ');

    const template3 = compileString(`<textarea>  `);
    expect(template3({})).toBe('<textarea>  ');
  });

  test('multiple mixed <script>s don\'t infinite loop', () => {
    // this code would cause an infinite loop in v2.0.0
    compileString(`
      <link rel="stylesheet" href="https://use.fontawesome.com/releases/v6.7.0/css/all.css">
      <script type="text/javascript" src="./scripts/sourcebans.js"></script>
      <link href="themes/default/css/main.css" rel="stylesheet" type="text/css" />
      <script type="text/javascript" src="./scripts/mootools.js"></script>
      <script type="text/javascript" src="./scripts/contextMenoo.js"></script>
     	<script type="text/javascript">
    `);
    expect(true).toBe(true); // yay! no infinite loop!
  });

  test('whitespace is dedented but not collapsed inside comments', () => {
    const template = compileString(`
      <!-- comment with    spaces
        and newlines
      -->
    `);
    const result = template({});
    expect(result).toBe('\n<!--comment with    spaces\n       and newlines\n     -->\n');
  });

  test('single-line comments and multi-line comments', () => {
    const template1 = compileString('<!-- single line comment --><p>text</p>');
    expect(template1({})).toBe('<!-- single line comment --><p>text</p>');

    const template2 = compileString(`
      <!-- multi
        line
        comment -->
      <p>text</p>
    `);
    expect(template2({})).toBe('\n<!--multi\n       line\n       comment -->\n<p>text</p>\n');
  });

  test('whitespace inside tags is collapsed between attributes', () => {
    const template = compileString('<div    class="foo"     id="bar"    >content</div>');
    const result = template({});
    expect(result).toBe('<div class="foo" id="bar" >content</div>');
  });

  test('whitespace around templated parts is handled correctly, not removed', () => {
    const template = compileString('a <%= x %> b');
    const result = template({ x: 'X' });
    expect(result).toBe('a X b');
  });

  test('preserveWhitespace option preserves all whitespace', () => {
    const template = compileString('hello    world\n\n\nthere', { preserveWhitespace: true });
    const result = template({});
    expect(result).toBe('hello    world\n\n\nthere');
  });

  test('empty template tag <%%> wont get transformed', () => {
    const template = compileString('test <%%> test');
    const result = template({});
    expect(result).toBe('test <%%> test');
  });

  test('empty template tag <% %> should do nothing', () => {
    const template = compileString('test <% %> test');
    const result = template({});
    expect(result).toBe('test  test');
  });

  test('empty template tag <%=%> should generate an error', () => {
    // this generates invalid code at compile time
    expect(() => compileString('test <%=%> test')).toThrow();
  });

  test('quotes and backticks in template text are handled correctly', () => {
    const template = compileString('He said "<%= "Hello" %>" and `Goodbye`');
    const result = template({});
    expect(result).toBe('He said "Hello" and `Goodbye`');
  });

  test('backslashes in template text are handled correctly', () => {
    const template = compileString('Path: C:\\Users\\name\\file.txt \\<%= \'(file)\' %>');
    const result = template({});
    expect(result).toBe('Path: C:\\Users\\name\\file.txt \\(file)');
  });
});

describe('compileFile', () => {
  test('test-template.ejs', () => {
    const template = compileFile('test/test-template.ejs');
    const result = template({ name: 'World' });
    expect(result).toBe('Hello, World!\n');
  });

  test('test-template without extension should work', () => {
    const template = compileFile('test/test-template');
    const result = template({ name: 'World' });
    expect(result).toBe('Hello, World!\n');
  });

  test('cache works', () => {
    const template1 = compileFile('test/test-template.ejs', { useCache: true });
    const template2 = compileFile('test/test-template.ejs', { useCache: true });
    // they should be the same reference since it's cached
    expect(template1 === template2).toBe(true);
  });

  test('useCache can be disabled', () => {
    const template1 = compileFile('test/test-template.ejs', { useCache: false });
    const template2 = compileFile('test/test-template.ejs', { useCache: false });
    // without cache, they should be different function instances
    expect(template1 !== template2).toBe(true);
  });

  test('useCache defaults to false in development, true otherwise', () => {
    const originalEnv = process.env.NODE_ENV;

    const files: Record<string, string> = {
      'myfile1': 'Hello, world!',
      'myfile2': 'Goodbye, world!'
    };
    const readFile = (path: string) => files[path] || '';

    // Test development mode
    process.env.NODE_ENV = 'development';
    const template1 = compileFile('myfile1', { readFile });
    const template2 = compileFile('myfile1', { readFile });
    expect(template1 !== template2).toBe(true);

    // Test production mode
    process.env.NODE_ENV = 'production';
    const template3 = compileFile('myfile2', { readFile });
    const template4 = compileFile('myfile2', { readFile });
    expect(template3 === template4).toBe(true);

    // Restore original
    process.env.NODE_ENV = originalEnv;
  });

  test('test-template-with-include.ejs', () => {
    const template = compileFile('test/test-template-with-include.ejs');
    const result = template({ pageTitle: 'My Page', name: 'Alice' });
    expect(result).toBe('<!DOCTYPE html>\n<html>\n<header>\n<h1>My Page</h1>\n</header>\n\n<body>\n<p>Welcome, Alice!</p>\n</body>\n</html>\n');
  });

  test('test-template-with-include.ejs with custom include function', () => {
    const template = compileFile('test/test-template-with-include.ejs', {
      useCache: false,
      include: (path: string, ctx: any) => `<h1>Custom: ${ctx.title}</h1>`
    });
    const result = template({ pageTitle: 'My Page', name: 'Bob' });
    expect(result).toContain('Custom: My Page');
  });

  test('error thrown when file not found', () => {
    expect(() => compileFile('nonexistent.ejs')).toThrow();
  });

  test('syntax errors throw at compile time', () => {
    expect(() => compileFile('test/compile-error.ejs')).toThrow();
  });

  test('runtime errors throw at render time', () => {
    const template = compileFile('test/runtime-error.ejs');
    expect(() => template({})).toThrow('oops');
  });

  test('syntax errors include template path', () => {
    try {
      compileFile('test/compile-error.ejs');
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toContain('test/compile-error.ejs');
    }
  });

  test('runtime errors include template path', () => {
    const template = compileFile('test/runtime-error.ejs');
    try {
      template({});
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toContain('test/runtime-error.ejs');
    }
  });

  test('explicitly specify extension for test-template.html', () => {
    const template = compileFile('test/test-template.html');
    const result = template({ value: 'yippee' });
    expect(result).toBe('From .html: yippee!\n');
  });

  test('extension option works', () => {
    const template = compileFile('test/test-template', { extension: '.ejs' });
    const result = template({ name: 'Extension Test' });
    expect(result).toBe('Hello, Extension Test!\n');
  });

  test('baseDirectory option works', () => {
    const template = compileFile('test-template.ejs', { baseDirectory: 'test' });
    const result = template({ name: 'BaseDir Test' });
    expect(result).toBe('Hello, BaseDir Test!\n');
  });

  test('extension option has no effect on custom readFile', () => {
    const readFile = (path: string) => {
      if (path === 'myfile.ejs') {
        return 'Custom <%= x %>';
      } else {
        throw new Error('File not found');
      }
    };
    expect(() => compileFile('myfile', { useCache: false, extension: '.ejs', readFile })).toThrow();
    const template = compileFile('myfile.ejs', { useCache: false, extension: '.ejs', readFile });
    const result = template({ x: 'Content' });
    expect(result).toBe('Custom Content');
  });

  test('baseDirectory option has no effect on custom readFile', () => {
    const files: Record<string, string> = {
      'myfile': 'Custom <%= x %>'
    };
    const template = compileFile('myfile', {
      baseDirectory: 'test',
      readFile: (path: string) => files[path] || ''
    });
    const result = template({ x: 'Content' });
    expect(result).toBe('Custom Content');
  });

  test('templatePath option is ignored/overridden when path argument is provided', () => {
    try {
      compileFile('test/compile-error.ejs', { templatePath: 'ignored.ejs' });
      expect(true).toBe(false);
    } catch (err: any) {
      // should use the actual file path, not the templatePath option
      expect(err.message).toContain('test/compile-error.ejs');
      expect(err.message).not.toContain('ignored.ejs');
    }
  });

  test('custom readFile function', () => {
    const files: Record<string, string> = {
      'custom.ejs': 'Custom: <%= value %>'
    };
    const template = compileFile('custom.ejs', {
      readFile: (path: string) => files[path] || ''
    });
    const result = template({ value: 'Works' });
    expect(result).toBe('Custom: Works');
  });

  test('custom readFile function, include works', () => {
    const files: Record<string, string> = {
      'main.ejs': '<%- include("header.ejs", { title: "Test" }) %><p>Body</p>',
      'header.ejs': '<h1><%= title %></h1>'
    };
    const template = compileFile('main.ejs', {
      readFile: (path: string) => files[path] || ''
    });
    const result = template({});
    expect(result).toBe('<h1>Test</h1><p>Body</p>');
  });

  test('errors on bad arguments', () => {
    expect(() => compileFile('')).toThrow('path must be a non-empty string');
    expect(() => compileFile(123 as any)).toThrow('path must be a non-empty string');
    expect(() => compileFile('test.ejs', 'not-an-object' as any)).toThrow('options must be an object if provided');
  });

  test('complex-template.ejs', () => {
    const template = compileFile('test/complex-template.ejs');
    const result = template({
      pageTitle: 'Test Store',
      user: { name: 'Alice', email: 'alice@example.com', admin: true },
      items: [
        { name: 'Widget', price: 29.99, onSale: false },
        { name: 'Gadget', price: 49.99, onSale: true },
        { name: 'Doohickey', price: 39.99, onSale: false }
      ],
      categories: ['electronics', 'accessories', 'tools'],
      companyName: 'Test Corp'
    });

    // test key parts of the output
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Test Store</title>');
    expect(result).toContain('User: Alice');
    expect(result).toContain('alice@example.com');
    expect(result).toContain('Admin');
    expect(result).toContain('Widget');
    expect(result).toContain('$29.99');
    expect(result).toContain('SALE!');
    expect(result).toContain('ELECTRONICS');
    expect(result).toContain('Subtotal: $119.97');
    expect(result).toContain('Discount: 10%');
    expect(result).toContain('Total: $107.97');
    expect(result).toContain('Test Corp');
    // check that preformatted text preserves spaces
    expect(result).toContain('Preformatted text with    spaces');
  });
});

describe('render', () => {
  test('test-template.ejs', () => {
    const result = render('test/test-template.ejs', { name: 'World' });
    expect(result).toBe('Hello, World!\n');
  });

  test('complex-template.ejs', () => {
    const result = render('test/complex-template.ejs', {
      pageTitle: 'Test Store',
      user: { name: 'Bob', email: 'bob@example.com', admin: false },
      items: [
        { name: 'Item A', price: 10, onSale: false }
      ],
      categories: ['test'],
      companyName: 'Render Corp'
    });

    expect(result).toContain('Test Store');
    expect(result).toContain('Bob');
    expect(result).toContain('bob@example.com');
    expect(result).not.toContain('Admin');
    expect(result).toContain('Item A');
    expect(result).toContain('Render Corp');
  });

  test('errors on bad arguments', () => {
    // render function doesn't validate its own arguments, it delegates to compileFile
    expect(() => render('', {})).toThrow();
    expect(() => render('test.ejs', {}, 'not-an-object' as any)).toThrow();
  });
});

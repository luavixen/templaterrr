import { expect, test, describe } from 'bun:test';
import { compile, compileFile, render } from './index';

describe('template basics', () => {

  test('compile and render a simple string', () => {
    const template = compile('Hello, world!');
    expect(template({})).toBe('Hello, world!');
  });

  test('compile and render variable interpolation', () => {
    const template = compile('Hello, <%= name %>!');
    expect(template({ name: 'Alice' })).toBe('Hello, Alice!');
  });

  test('escape html entities', () => {
    const template = compile('Text: <%= text %>');
    expect(template({ text: '<script>alert("xss")</script>' }))
      .toBe('Text: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('render unescaped output', () => {
    const template = compile('HTML: <%- html %>');
    expect(template({ html: '<b>bold</b>' })).toBe('HTML: <b>bold</b>');
  });

});

describe('template behaviour', () => {

  test('ternary operators', () => {
    const template = compile('<%= isAdmin ? "Admin" : "User" %>');
    expect(template({ isAdmin: true })).toBe('Admin');
    expect(template({ isAdmin: false })).toBe('User');
  });

  test('variable declarations', () => {
    const template = compile('<% var greeting = "Hello"; %><%= greeting %>');
    expect(template({})).toBe('Hello');
  });

  test('control flow', () => {
    const template = compile('<% if (show) { %>Visible<% } %>');
    expect(template({ show: true })).toBe('Visible');
    expect(template({ show: false })).toBe('');
  });

  test('normal loops', () => {
    const template = compile('<% for (var i = 0; i < 3; i++) { %><%= i %><% } %>');
    expect(template({})).toBe('012');
  });

  test('functional loops', () => {
    const template = compile('<% items.forEach(function(item) { %><%= item %><% }); %>');
    expect(template({ items: ['a', 'b', 'c'] })).toBe('abc');
  });

  test('nested control structure', () => {
    const template = compile(`
      <% if (show) { %>
        <% for (var i = 0; i < 2; i++) { %>
          <%= i %>
        <% } %>
      <% } %>
    `);
    expect(template({ show: true }).replace(/\s+/g, '')).toBe('01');
    expect(template({ show: false }).replace(/\s+/g, '')).toBe('');
  });

  test('function calls from context', () => {
    const template = compile('<%= greet("world") %>');
    expect(template({ greet: (name: string) => `Hello, ${name}!` }))
      .toBe('Hello, world!');
  });

  test('function definition and calling', () => {
    const template = compile(`
      <% function greet(name) { return "Hi, " + name; } %>
      <%= greet("Bob") %>
    `);
    expect(template({}).trim()).toBe('Hi, Bob');
  });

  test('output handle numbers and booleans', () => {
    const template = compile('Number: <%= num %>, Boolean: <%= bool %>');
    expect(template({ num: 42, bool: true })).toBe('Number: 42, Boolean: true');
  });

  test('output false and 0', () => {
    const template = compile('A<%= falseVal %>B<%= zero %>C');
    expect(template({ falseVal: false, zero: 0 })).toBe('AfalseB0C');
  });

  test('don\'t output null and undefined', () => {
    const template = compile('A<%= nullVal %>B<%= undefinedVal %>C');
    expect(template({ nullVal: null, undefinedVal: undefined })).toBe('ABC');
  });

});

describe('html behaviour', () => {

  test('basic tags', () => {
    const template = compile('<div><p>Hello</p></div>');
    expect(template({})).toBe('<div><p>Hello</p></div>');
  });

  test('self-closing tags', () => {
    const template = compile('<img src="test.jpg" /><img src="test.jpg"/>');
    expect(template({})).toBe('<img src="test.jpg" /><img src="test.jpg"/>');
  });

  test('void elements', () => {
    const template = compile('<br><hr><input type="text">');
    expect(template({})).toBe('<br><hr><input type="text">');
  });

  test('template expression in element body', () => {
    const template = compile('<div><%= content %></div>');
    expect(template({ content: 'Hello' })).toBe('<div>Hello</div>');
  });

  test('basic attributes', () => {
    const template = compile('<div class="container" id=\'main\'></div>');
    expect(template({})).toBe('<div class="container" id=\'main\'></div>');
  });

  test('attributes without values or with different styles of value', () => {
    const template = compile('<input disabled checked="checked" type=text>');
    expect(template({})).toBe('<input disabled checked="checked" type=text>');
  });

  test('dynamic attribute values', () => {
    const template = compile('<div class="<%= className %>"></div>');
    expect(template({ className: 'active' })).toBe('<div class="active"></div>');
  });

  test('dynamic attributes', () => {
    const template = compile('<input <%- attrs %>>');
    expect(template({ attrs: 'type="text" disabled' }))
      .toBe('<input type="text" disabled>');
  });

  test('dynamic tag name', () => {
    const template = compile('<<%= tag %>>content</<%= tag %>>');
    expect(template({ tag: 'span' })).toBe('<span>content</span>');
  });

  test('mixing attributes', () => {
    const template = compile('<div class="<%= cls %>" <%- attrs %> data-value="<%= val %>"></div>');
    expect(template({ cls: 'box', attrs: 'id="test"', val: '123' }))
      .toBe('<div class="box" id="test" data-value="123"></div>');
  });

  test('preserve comments', () => {
    const template = compile('<!-- This is a comment --><div>Content</div>');
    expect(template({})).toBe('<!-- This is a comment --><div>Content</div>');
  });

  test('multi-line comments preserved but dedented', () => {
    const template = compile(`<!--
      Multi-line
      comment
    --><div>Content</div>`);
    expect(template({})).toBe('<!--\nMulti-line\ncomment\n--><div>Content</div>');
  });

});

describe('whitespace behaviour', () => {

  test('whitespace is collapsed', () => {
    const template = compile('<div>Hello     World</div>');
    expect(template({})).toBe('<div>Hello World</div>');
  });

  test('newlines are collapsed', () => {
    const template = compile('<div>Hello\n\n\nWorld</div>');
    expect(template({})).toBe('<div>Hello\nWorld</div>');
  });

  test('whitespace can be preserved', () => {
    const template = compile('<div>Hello     World</div>', { preserveWhitespace: true });
    expect(template({})).toBe('<div>Hello     World</div>');
  });

  test('dedent', () => {
    const template = compile(`
      <div>
        <p>Content</p>
      </div>
    `);
    const result = template({});
    expect(result).toBe('\n<div>\n<p>Content</p>\n</div>\n');
  });

  test('single line template', () => {
    const template = compile('<div><%= text %></div>');
    expect(template({ text: 'test' })).toBe('<div>test</div>');
  });

  test('single line template isn\'t dedented', () => {
    const template = compile('  <div>test</div>  ');
    expect(template({})).toBe(' <div>test</div> ');
  });

  test('whitespace is not inserted around template tags', () => {
    const template = compile("<%= 'hello' %>world");
    expect(template({})).toBe('helloworld');
  });

  test('whitespace is not inserted around template tags with newlines', () => {
    const template = compile("<%= 'hello' %>\nworld");
    expect(template({})).toBe('hello\nworld');
  });

  test('whitespace is collapsed but not removed around template tags', () => {
    const template = compile("oh,\t<%= 'hello' %>    world");
    expect(template({})).toBe('oh, hello world');
  });

  test('whitespace is collapsed but not removed with newlines', () => {
    const template = compile("<%= 'hello' %>\n  world");
    expect(template({})).toBe('hello\nworld');
  });

  test('whitespace is collapsed in comments, but dedented', () => {
    const template = compile('<!--   spaced\n   -->');
    expect(template({})).toBe('<!--spaced\n-->');
  });

  test('whitespace is preserved inside of script/style, but still dedented', () => {
    const template = compile(`
      <script>
        var x  =  42;
      </script>
    `);
    const result = template({});
    expect(result).toBe('\n<script>\nvar x  =  42;\n</script>\n');
  });

  test('whitespace is preserved inside of pre, but still dedented', () => {
    const template = compile(`
      <pre>
        Hello     World
      </pre>
    `);
    const result = template({});
    expect(result).toBe('\n<pre>\nHello     World\n</pre>\n');
  });

  test('preserving whitespace should not change whitespace AT ALL', () => {
    const template = compile('  <div>  test  </div>  ', { preserveWhitespace: true });
    expect(template({})).toBe('  <div>  test  </div>  ');
  });

  test('enable/disable preserving whitespace with directives', () => {
    const template = compile(`
      Normal
      <% // PRESERVE_WHITESPACE %>
      Preserved     spacing
      <% /* PRESERVE_WHITESPACE_OFF */ %>
      Normal    again
    `);
    const result = template({});
    expect(result).toBe('\nNormal\n\n      Preserved     spacing\n      \nNormal again\n');
  });

});

describe('script/style tags', () => {

  test('preserve script tag content', () => {
    const template = compile('<script>var x = 1  +  2;</script>');
    expect(template({})).toBe('<script>var x = 1  +  2;</script>');
  });

  test('preserve style tag content', () => {
    const template = compile('<style>.class { color:   red; }</style>');
    expect(template({})).toBe('<style>.class { color:   red; }</style>');
  });

  test('template tags inside script tags', () => {
    const template = compile('<script>var name = "<%= name %>";</script>');
    expect(template({ name: 'test' })).toBe('<script>var name = "test";</script>');
  });

  test('dynamic content in scripts', () => {
    const template = compile('<script>var items = <%= JSON.stringify(items) %>;</script>');
    expect(template({ items: [1, 2, 3] })).toBe('<script>var items = [1,2,3];</script>');
  });

});

describe('error handling', () => {

  test('syntax errors in templates throw on compile', () => {
    expect(() => compile('<% var x = { %>')).toThrow();
  });

  test('throwing errors in templates at runtime', () => {
    const template = compile('<% throw new Error("Test error"); %>');
    expect(() => template({})).toThrow('Test error');
  });

  test('badly written templates generate errors as expected', () => {
    expect(() => compile('<% undefined.foo() %>')).not.toThrow();
    const template = compile('<% undefined.foo() %>');
    expect(() => template({})).toThrow();
  });

  test('compile errors have the template filename in them', () => {
    try {
      compile('<% var x = { %>', { templateFilename: 'test.ejs' });
      expect(true).toBe(false); // unreachable
    } catch (e: any) {
      expect(e.message).toContain('test.ejs');
    }
  });

  test('runtime errors have the template filename in them', () => {
    const template = compile('<% throw new Error("oops"); %>', { templateFilename: 'runtime.ejs' });
    try {
      template({});
      expect(true).toBe(false); // unreachable
    } catch (e: any) {
      expect(e.message).toContain('runtime.ejs');
    }
  });

});

describe('files and caching', () => {

  test('compile from file', () => {
    const template = compileFile('test/test-template.ejs', { useCache: false });
    expect(template({ name: 'World' })).toBe('Hello, World!\n');
  });

  test('compile from file with custom readFile', () => {
    const template = compileFile('any-path', {
      readFile: (path: string) => 'Custom: <%= name %>!',
      useCache: false,
    });
    expect(template({ name: 'Test' })).toBe('Custom: Test!');
  });

  test('include file', () => {
    const fakeFs: Record<string, string> = {
      'main.ejs': 'Start <%- include("partial.ejs", { text: "included" }) %> End',
      'partial.ejs': 'Partial: <%= text %>',
    };
    const template = compile(fakeFs['main.ejs']!, {
      readFile: (path: string) => {
        if (fakeFs[path]) return fakeFs[path]!;
        throw new Error(`File not found: ${path}`);
      },
    });
    expect(template({})).toBe('Start Partial: included End');
  });

  test('include file with custom readfile', () => {
    const fakeFs: Record<string, string> = {
      'index': 'Before <%- include("header") %> After',
      'header': 'Header Content',
    };
    const template = compile(fakeFs['index']!, {
      readFile: (path: string) => {
        if (fakeFs[path]) return fakeFs[path]!;
        throw new Error(`File not found: ${path}`);
      },
    });
    expect(template({})).toBe('Before Header Content After');
  });

  test('should insert extension', () => {
    const template = compileFile('test/test-template', { useCache: false });
    expect(template({ name: 'World' })).toBe('Hello, World!\n');
  });

  test('extension can be changed via options', () => {
    const template = compileFile('test/test-template', {
      extension: '.html',
      useCache: false,
    });
    expect(template({ value: 'test' })).toBe('From .html: test!\n');
  });

  test('baseDirectory can be changed via options', () => {
    const template = compileFile('test-template.ejs', {
      baseDirectory: './test',
      useCache: false,
    });
    expect(template({ name: 'Directory' })).toBe('Hello, Directory!\n');
  });

  test('extension has no effect on custom readfile', () => {
    expect(() => {
      const fakeFs: Record<string, string> = {
        'test.ejs': 'Custom content',
      };
      compileFile('test', {
        readFile: (path: string) => {
          if (fakeFs[path]) return fakeFs[path]!;
          throw new Error(`File not found: ${path}`);
        },
        extension: '.ejs',
        useCache: false,
      });
    }).toThrow('File not found: test');
  });

  test('baseDirectory has no effect on custom readfile', () => {
    const fakeFs: Record<string, string> = {
      'test': 'Custom content',
    };
    const template = compileFile('test', {
      readFile: (path: string) => {
        if (fakeFs[path]) return fakeFs[path]!;
        throw new Error(`File not found: ${path}`);
      },
      baseDirectory: '/some/path',
      useCache: false,
    });
    expect(template({})).toBe('Custom content');
  });

  test('use cache by default', () => {
    const t1 = compileFile('test/test-template.ejs');
    const t2 = compileFile('test/test-template.ejs');
    expect(t1).toBe(t2); // same function reference
  });

  test('use cache when useCache is true', () => {
    const t1 = compileFile('test/test-template.html', { useCache: true });
    const t2 = compileFile('test/test-template.html', { useCache: true });
    expect(t1).toBe(t2); // same function reference
  });

  test('don\'t use cache when useCache is false', () => {
    const t1 = compileFile('test/test-template.ejs', { useCache: false });
    const t2 = compileFile('test/test-template.ejs', { useCache: false });
    expect(t1).not.toBe(t2); // different function references
  });

  test('cache works with added extensions', () => {
    // note that this is very specific behaviour, see implementation
    const t1 = compileFile('test/runtime-error', { useCache: true });
    const t2 = compileFile('test/runtime-error.ejs', { useCache: true });
    expect(t1).toBe(t2); // same function reference
  });

  test('cache is disabled by default when NODE_ENV is development', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      const t1 = compileFile('test/test-template.ejs');
      const t2 = compileFile('test/test-template.ejs');
      expect(t1).not.toBe(t2); // different function references
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('compile time error messages have the filename in them for compileFile', () => {
    try {
      compileFile('test/compile-error.ejs', { useCache: false });
      expect(true).toBe(false); // unreachable
    } catch (e: any) {
      expect(e.message).toContain('compile-error.ejs');
    }
  });

  test('runtime error messages have the filename in them for compileFile', () => {
    const template = compileFile('test/runtime-error.ejs', { useCache: false });
    try {
      template({});
      expect(true).toBe(false); // unreachable
    } catch (e: any) {
      expect(e.message).toContain('runtime-error.ejs');
    }
  });

});

describe('render function', () => {

  test('render compiles and renders a template', () => {
    const result = render('test/test-template.ejs', { name: 'World' }, { useCache: false });
    expect(result).toBe('Hello, World!\n');
  });

  test('render with custom readFile', () => {
    const result = render('any-path', { name: 'Test' }, {
      readFile: () => 'Render: <%= name %>!',
      useCache: false,
    });
    expect(result).toBe('Render: Test!');
  });

  test('render with extension option', () => {
    const result = render('test/test-template', { value: 'test' }, {
      extension: '.html',
      useCache: false,
    });
    expect(result).toBe('From .html: test!\n');
  });

  test('render with baseDirectory option', () => {
    const result = render('test-template.ejs', { name: 'Directory' }, {
      baseDirectory: './test',
      useCache: false,
    });
    expect(result).toBe('Hello, Directory!\n');
  });

  test('render with preserveWhitespace option', () => {
    const result = render('test/test-template.ejs', { name: 'Test' }, {
      preserveWhitespace: true,
      useCache: false,
    });
    expect(result).toBe('Hello, Test!\n');
  });

});

describe('context access', () => {

  test('access context', () => {
    const template = compile('<%= name %>');
    expect(template({ name: 'Alice' })).toBe('Alice');
  });

  test('access context via `ctx`', () => {
    const template = compile('<%= ctx.name %>');
    expect(template({ name: 'Bob' })).toBe('Bob');
  });

  test('nested context access', () => {
    const template = compile('<%= user.profile.name %>');
    expect(template({ user: { profile: { name: 'Charlie' } } }))
      .toBe('Charlie');
  });

  test('complex context access', () => {
    const template = compile('<%= users[0].name %> and <%= users[1].name %>');
    expect(template({
      users: [{ name: 'Alice' }, { name: 'Bob' }]
    })).toBe('Alice and Bob');
  });

  test('mutating context', () => {
    const template = compile('<% ctx.modified = true; %><%= ctx.original %>');
    const context = { original: 'value' };
    template(context);
    expect((context as any).modified).toBe(true);
  });

});

describe('edge cases', () => {

  test('empty string', () => {
    const template = compile('');
    expect(template({})).toBe('');
  });

  test('empty template tags - <%%> wont get transformed', () => {
    const template = compile('<%%>');
    expect(template({})).toBe('<%%>');
  });

  test('empty template tags - <% %> should do nothing', () => {
    const template = compile('<% %>');
    expect(template({})).toBe('');
  });

  test('empty template tags - <%=%> should generate an error', () => {
    expect(() => compile('<%=%>')).toThrow();
  });

  test('just whitespace', () => {
    const template = compile('   \n  \t  ');
    const result = template({});
    expect(result).toBe('\n');
  });

  test('quotes and backticks', () => {
    const template = compile('"<%= "double" %> <div "<%= \'single\' %> \'``<%= `backtick` %>');
    expect(template({})).toBe('"double <div "single \'``backtick');
  });

  test('backslashes', () => {
    const template = compile('\\<%= "back\\\\slash" %> \\');
    expect(template({})).toBe('\\back\\slash \\');
  });

  test('newlines', () => {
    const template = compile('<%= "line1\\n  line2\\n" %>');
    expect(template({})).toBe('line1\n  line2\n');
  });

  test('unicode and special characters in template markup', () => {
    const template = compile(`
      <div title="🔥 火 مرحبا" data-日本語="test">
        <!-- Comment: 日本語🌸 «quotes» -->
        Party🎉 Hello مرحبا שלום 中文
        <span-元素>∑∫√π∞ e\u0301</span-元素>
        <<%= tag %> class="<%= cls %>">👋🏽👨‍👩‍👧‍👦</<%= tag %>>
      </div>
    `);
    const result = template({ tag: 'p', cls: '火-class' });
    expect(result).toContain('Party🎉');
    expect(result).toContain('data-日本語="test"');
    expect(result).toContain('<p class="火-class">');
  });

  test('unicode and special characters in javascript expressions and control flow', () => {
    const template = compile(`
      <% var 変数 = "🚀"; var arr = ["火", "水\u0301", "👋🏽"]; %>
      <%= 変数 %> <%= "直接🎊" %>
      <% for (var i = 0; i < arr.length; i++) { %><%= arr[i] %> <% } %>
      <%= "quote test: \\"'" %>
      <% if (true) { var emoji = "🔥"; %><%= emoji %><% } %>
      <%= ctx["キー"] || "默认" %>
    `);
    const result = template({ キー: "値🌸" });
    expect(result).toContain('🚀');
    expect(result).toContain('直接🎊');
    expect(result).toContain('火 水\u0301 👋🏽');
    expect(result).toContain('🔥');
    expect(result).toContain('値🌸');
  });

  test('unclosed tags at EOF eg. "<div "', () => {
    const template = compile('<div ');
    expect(template({})).toBe('<div ');
  });

  test('mismatched closing tags', () => {
    const template = compile('<div><span></div></span>');
    expect(template({})).toBe('<div><span></div></span>');
  });

  test('empty "tags"', () => {
    const template = compile('< >');
    expect(template({})).toBe('< >');
  });

  test('attributes with = but no value', () => {
    const template = compile('<input value= >');
    expect(template({})).toBe('<input value= >');
  });

  test('spaces before and after template tags', () => {
    const template = compile('  <%= "content" %>  ');
    expect(template({})).toBe(' content ');
  });

  test('don\'t change html output when closing tags internally', () => {
    const template = compile('<p>Text<div>Block</div>');
    expect(template({})).toBe('<p>Text<div>Block</div>');
  });

  test('complex html', () => {
    const template = compile(`
      <div>
        <ul>
          <li>Item 1
          <li>Item 2
        </ul>
        <table>
          <tr><td>Cell 1<td>Cell 2
          <tr><td>Cell 3<td>Cell 4
        </table>
      </div>
    `);
    const result = template({});
    expect(result).toBe(`
<div>
<ul>
<li>Item 1
<li>Item 2
</ul>
<table>
<tr><td>Cell 1<td>Cell 2
<tr><td>Cell 3<td>Cell 4
</table>
</div>
`)
  });

  test('preserveWhitespace protects html-like markup', () => {
    const template = compile('\n\nSome text\n    <div>\nthat looks > like\n    <html> but is not', {
      preserveWhitespace: true
    });
    expect(template({})).toBe('\n\nSome text\n    <div>\nthat looks > like\n    <html> but is not');
  });

  test('significantly nested context', () => {
    const template = compile('<%= a.b.c.d.e.f.g %>');
    expect(template({ a: { b: { c: { d: { e: { f: { g: 'deep' } } } } } } })).toBe('deep');
  });

  test('false-y context is replaced with an empty object', () => {
    const template = compile('<%= typeof ctx %> <%= JSON.stringify(ctx) %>');
    expect(template(null)).toBe('object {}');
    expect(template(undefined)).toBe('object {}');
    expect(template(false as any)).toBe('object {}');
    expect(template(true as any)).toBe('boolean true');
    expect(template(0 as any)).toBe('object {}');
    expect(template(1 as any)).toBe('number 1');
    expect(template('' as any)).toBe('object {}');
    expect(template('hello' as any)).toBe('string &quot;hello&quot;');
  });

  test('broken or evil options should be handled gracefully', () => {
    // wrong type for readFile
    expect(() => compileFile('test', { readFile: 'not a function' as any, useCache: false }))
      .toThrow();

    // wrong type for other options - should coerce or handle gracefully
    const t1 = compile('test', { preserveWhitespace: 'yes' as any });
    expect(t1({})).toBe('test');

    const t2 = compile('test', { useCache: 'false' as any });
    expect(t2({})).toBe('test');

    // null/undefined options should use defaults
    const t3 = compile('test', { baseDirectory: null as any, extension: undefined });
    expect(t3({})).toBe('test');

    // object as templateFilename should stringify
    const t4 = compile('<% throw new Error("fail"); %>', {
      templateFilename: { toString: () => 'custom.ejs' } as any
    });
    expect(() => t4({})).toThrow('custom.ejs');
  });

  test('broken readFile implementation should generate readable errors', () => {
    // readFile returns null instead of string
    const t1 = compile('<%- include("test") %>', {
      readFile: () => null as any,
    });
    expect(() => t1({})).toThrow();

    // readFile returns undefined
    const t2 = compile('<%- include("test") %>', {
      readFile: () => undefined as any,
    });
    expect(() => t2({})).toThrow();

    // readFile returns a number
    const t3 = compile('<%- include("test") %>', {
      readFile: () => 123 as any,
    });
    expect(() => t3({})).toThrow();

    // readFile throws an error
    const t4 = compile('<%- include("test") %>', {
      readFile: () => { throw new Error('Custom file error'); },
    });
    expect(() => t4({})).toThrow('Custom file error');
  });

  test('script/style tags preserve whitespace, except for the known bug', () => {
    // test that whitespace is preserved inside script/style tags
    const t1 = compile('cool script:   <script>var x  =  1  +  2; var   y   =   42;</script>');
    const r1 = t1({});
    expect(r1).toBe('cool script: <script>var x  =  1  +  2; var   y   =   42;</script>');

    // </script> in a string literal
    // the parser treats it as a real closing tag, so whitespace after it is collapsed, my awesome bug!
    const t2 = compile('<script>var str = "</script>"; var   after   =   "spaced";</script>');
    const r2 = t2({});
    expect(r2).toBe('<script>var str = "</script>"; var after = "spaced";</script>');

    // style tag with </style> in content
    // same awesome bug
    const t3 = compile('<style>.class::after { content:  "</style>"; color:   red; }</style>');
    const r3 = t3({});
    expect(r3).toContain('content:  "</style>"');
    expect(r3).toContain('color: red');
  });

  test('script/style tags with template expressions', () => {
    const t1 = compile('<script>var name = "<%= name %>"; var   x   =   <%= value %>;</script>');
    const r1 = t1({ name: 'test', value: 42 });
    expect(r1).toContain('var name = "test"');
    expect(r1).toContain('var   x   =   42');

    const t2 = compile('<style>.class { content:  "<%- content %>";  background: <%= bg %>; }</style>');
    const r2 = t2({ content: '</style>', bg: 'red' });
    expect(r2).toBe('<style>.class { content:  "</style>";  background: red; }</style>');
  });

});

import type { EscapeFunction, IncludeFunction, Options, Template } from './types';
import { compile } from './compile';
import { generate } from './generate';
import { escape } from './utils';

/**
 * Prepares and normalizes the user-provided options for template compilation and rendering.
 * @param options The user-provided options.
 * @returns The prepared options.
 */
function prepareOptions(options: Options | undefined): Required<Options> {
  var prepared: Required<Options> = {
    baseDirectory: '',
    extension: '.ejs',
    readFile: null,
    escape: null,
    include: null,
    useCache: true,
    preserveWhitespace: false,
    templatePath: '<anonymous template>'
  };
  if (typeof process === 'object' && process.env) {
    prepared.useCache = process.env.NODE_ENV !== 'development';
  }
  if (options) {
    var baseDirectory = options.baseDirectory;
    if (typeof baseDirectory === 'string' && baseDirectory) {
      prepared.baseDirectory = baseDirectory;
    }
    var extension = options.extension;
    if (typeof extension === 'string' && extension) {
      prepared.extension = extension;
    }
    var readFileFunction = options.readFile;
    if (typeof readFileFunction === 'function') {
      prepared.readFile = readFileFunction;
    }
    var escapeFunction = options.escape;
    if (typeof escapeFunction === 'function') {
      prepared.escape = escapeFunction;
    }
    var includeFunction = options.include;
    if (typeof includeFunction === 'function') {
      prepared.include = includeFunction;
    }
    var useCache = options.useCache;
    if (typeof useCache === 'boolean') {
      prepared.useCache = useCache;
    }
    var preserveWhitespace = options.preserveWhitespace;
    if (typeof preserveWhitespace === 'boolean') {
      prepared.preserveWhitespace = preserveWhitespace;
    }
    var templatePath = options.templatePath;
    if (typeof templatePath === 'string' && templatePath) {
      prepared.templatePath = templatePath;
    }
  }
  if (prepared.escape == null) {
    prepared.escape = escape;
  }
  if (prepared.include == null) {
    prepared.include = createIncludeFunction(prepared);
  }
  return prepared;
}

/**
 * Represents a file loaded from disk.
 */
interface File {
  /**
   * Path to the file.
   */
  path: string;
  /**
   * Content of the file.
   */
  content: string;
}

/**
 * Default template file reading function for Node.js environments.
 *
 * @param path The path to the file.
 * @param options The prepared options.
 * @returns The loaded file.
 * @throws If the file cannot be read.
 */
var defaultReadFile: (path: string, options: Required<Options>) => File;

// lazy initialization so that 'fs' and 'path' are only `require`d if needed
defaultReadFile = function (firstPath, firstOptions) {
  var nodeFs = require('fs');
  var nodePath = require('path');

  defaultReadFile = function (path, options) {
    // if base directory is set, prepend it to the path
    if (options.baseDirectory) {
      path = nodePath.join(options.baseDirectory, path);
    }
    try {
      // try to read the file as-is
      return { path: path, content: nodeFs.readFileSync(path, 'utf8') };
    } catch (cause) {
      // if that fails, and an extension is set, try adding it
      if (options.extension) {
        path += options.extension;
        try {
          return { path: path, content: nodeFs.readFileSync(path, 'utf8') };
        } catch (ignored) {}
      }
      throw cause;
    }
  };

  return defaultReadFile(firstPath, firstOptions);
};

/**
 * Reads a template file from the disk using the user-provided readFile function, or the default one if not provided.
 *
 * @param path The path to the file.
 * @param options The prepared options.
 * @returns The loaded file.
 * @throws If the file cannot be read.
 */
function readFile(path: string, options: Required<Options>): File {
  var userReadFile = options.readFile;
  if (userReadFile) {
    var content = userReadFile(path);
    if (typeof content !== 'string') {
      throw new Error('readFile returned ' + typeof content + ' instead of string');
    }
    return { path: path, content: content };
  } else {
    return defaultReadFile(path, options);
  }
}

/**
 * Generates and compiles a template from a source string.
 *
 * @param source The source code of the template.
 * @param options The prepared options.
 * @returns The compiled template.
 * @throws If there is a syntax error in the generated code.
 */
function generateAndCompileString(source: string, options: Required<Options>): Template {
  var path = options.templatePath;
  var whitespace = !options.preserveWhitespace;
  var escape: EscapeFunction = options.escape!;
  var include: IncludeFunction = options.include!;
  var code = generate(null, path, source, whitespace);
  var renderFunction = compile(path, code, escape, include);
  return renderFunction;
}

// cache of compiled render functions, by template path
// never cleared, but i'm sure the user won't fill it up or anything :wink:
var renderFunctionCache = new Map<string, Template>();

/**
 * Generates and compiles a template that is loaded from a file.
 *
 * @param path The path to the template file.
 * @param options The prepared options.
 * @returns The compiled template.
 * @throws If the file cannot be read.
 * @throws If there is a syntax error in the generated code.
 */
function generateAndCompileFile(path: string, options: Required<Options>): Template {
  if (options.useCache) {
    var cachedRenderFunction = renderFunctionCache.get(path);
    if (cachedRenderFunction) return cachedRenderFunction;
  }
  var file = readFile(path, options);
  options.templatePath = file.path;
  var renderFunction = generateAndCompileString(file.content, options);
  if (options.useCache) {
    renderFunctionCache.set(path, renderFunction);
    renderFunctionCache.set(file.path, renderFunction);
  }
  return renderFunction;
}

/**
 * Creates an include closure that can be used within templates to include other templates.
 *
 * @param options The prepared options.
 * @returns The created include closure.
 */
function createIncludeFunction(options: Required<Options>): IncludeFunction {
  function include(path: string, context: any): string {
    var renderFunction = generateAndCompileFile(path, options);
    return renderFunction(context);
  }
  return include;
}

/**
 * Compiles a template source string into generated JavaScript code without executing it.
 *
 * This function is useful when you want to inspect the generated JavaScript code,
 * save it for later use, or integrate template compilation into a build pipeline.
 * Unlike `compileString`, this returns the raw JavaScript code as a string rather
 * than a compiled function.
 *
 * @param name The name to use for the generated function. If provided, the code will be
 *             wrapped in a function declaration with this name. If `null`, only the
 *             function body will be generated.
 * @param source The template source code to compile.
 * @param options Optional compilation options for controlling template behavior.
 * @returns The generated JavaScript code as a string.
 *
 * @example
 * var code = compileToString('myTemplate', '<h1><%= title %></h1>');
 * console.log(code);
 * // Outputs:
 * // function myTemplate(__context, __escape, __include) {
 * // var __buffer = "";
 * // ...
 * // return __buffer;
 * // }
 *
 * @example
 * var bodyOnly = compileToString(null, '<p><%= message %></p>');
 * console.log(bodyOnly);
 * // Outputs:
 * // var __buffer = "";
 * // ...
 * // return __buffer;
 */
export function compileToString(name: string | null, source: string, options?: Options): string {
  if (name !== null && typeof name !== 'string') {
    throw new TypeError('name must be a string or null');
  }
  if (typeof source !== 'string') {
    throw new TypeError('source must be a string');
  }
  if (options && typeof options !== 'object') {
    throw new TypeError('options must be an object if provided');
  }
  var prepared = prepareOptions(options);
  var path = prepared.templatePath;
  var whitespace = !prepared.preserveWhitespace;
  var code = generate(name, path, source, whitespace);
  return code;
}

/**
 * Compiles a template source string into a render function that can be called with context data.
 *
 * This is the primary function for compiling templates from strings. It parses the template
 * syntax, generates JavaScript code, and returns a ready-to-use function that accepts a
 * context object and returns the rendered output.
 *
 * @param source The template source code to compile.
 * @param options Optional compilation options for controlling template behavior.
 * @returns A compiled template function that takes a context object and returns the rendered string.
 * @throws If there is a syntax error in the template or generated code.
 *
 * @example
 * var template = compileString('<h1><%= title %></h1><p><%= content %></p>');
 * var html = template({ title: 'Hello', content: 'World!' });
 * console.log(html);
 * // Outputs: <h1>Hello</h1><p>World!</p>
 *
 * @example
 * var template = compileString('<ul><% items.forEach(item => { %><li><%= item %></li><% }); %></ul>');
 * var html = template({ items: ['Apple', 'Banana', 'Cherry'] });
 * console.log(html);
 * // Outputs: <ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>
 *
 * @example
 * // Using custom escape function
 * var template = compileString('<p><%= text %></p>', {
 *   escape: (value) => String(value).toUpperCase()
 * });
 * var html = template({ text: 'hello' });
 * console.log(html);
 * // Outputs: <p>HELLO</p>
 */
export function compileString(source: string, options?: Options): Template {
  if (typeof source !== 'string') {
    throw new TypeError('source must be a string');
  }
  if (options && typeof options !== 'object') {
    throw new TypeError('options must be an object if provided');
  }
  var prepared = prepareOptions(options);
  var renderFunction = generateAndCompileString(source, prepared);
  return renderFunction;
}

/**
 * Compiles a template from a file into a render function that can be called with context data.
 *
 * This function reads a template file from disk, compiles it, and returns a render function.
 * By default, compiled templates are cached, so subsequent calls with the same path will
 * return the cached version for better performance. The file is read using either the
 * provided `readFile` function in options, or the default Node.js file system reader.
 *
 * @param path The path to the template file. If `baseDirectory` is set in options, it will
 *             be prepended to this path. If `extension` is set and the file is not found,
 *             the extension will be appended and retried.
 * @param options Optional compilation options for controlling template behavior.
 * @returns A compiled template function that takes a context object and returns the rendered string.
 * @throws If the file cannot be read or there is a syntax error in the template or generated code.
 *
 * @example
 * // Assuming 'views/header.ejs' contains: <h1><%= title %></h1>
 * var template = compileFile('views/header.ejs');
 * var html = template({ title: 'Welcome' });
 * console.log(html);
 * // Outputs: <h1>Welcome</h1>
 *
 * @example
 * // Using baseDirectory and extension options
 * var template = compileFile('header', {
 *   baseDirectory: './views',
 *   extension: '.tpl'
 * });
 * // This will look for './views/header.tpl'
 * var html = template({ title: 'My Site' });
 *
 * @example
 * // Disabling cache for development
 * // Note that setting `NODE_ENV` to 'development' also disables caching!
 * var template = compileFile('template.ejs', { useCache: false });
 * var html = template({ data: 'Fresh compilation every time' });
 */
export function compileFile(path: string, options?: Options): Template {
  if (typeof path !== 'string' || !path) {
    throw new TypeError('path must be a non-empty string');
  }
  if (options && typeof options !== 'object') {
    throw new TypeError('options must be an object if provided');
  }
  var prepared = prepareOptions(options);
  var renderFunction = generateAndCompileFile(path, prepared);
  return renderFunction;
}

/**
 * Renders a template file directly to a string in a single operation.
 *
 * This is a convenience function that combines `compileFile` and calling the resulting
 * render function in one step. It reads the template file, compiles it, and immediately
 * renders it with the provided context data. This is ideal for one-off renders or when
 * you don't need to keep the compiled template function. If the cache is enabled, then
 * subsequent calls with the same path will use the cached version.
 *
 * @param path The path to the template file. If `baseDirectory` is set in options, it will
 *             be prepended to this path. If `extension` is set and the file is not found,
 *             the extension will be appended and retried.
 * @param context The context object containing data to use when rendering the template.
 *                All properties of this object are available as variables in the template.
 * @param options Optional compilation options for controlling template behavior.
 * @returns The rendered template as a string.
 * @throws If the file cannot be read or there is a syntax error in the template or generated code.
 * @throws If an error occurs during template rendering.
 *
 * @example
 * // Assuming 'welcome.ejs' contains: <h1>Hello, <%= name %>!</h1>
 * var html = render('welcome.ejs', { name: 'Alice' });
 * console.log(html);
 * // Outputs: <h1>Hello, Alice!</h1>
 *
 * @example
 * // Using with options
 * var html = render('page', { title: 'Home', items: [1, 2, 3] }, {
 *   baseDirectory: './templates',
 *   extension: '.ejs',
 *   preserveWhitespace: true
 * });
 *
 * @example
 * // Rendering with complex data
 * var html = render('user-profile.ejs', {
 *   user: { name: 'Bob', age: 30 },
 *   posts: [
 *     { title: 'First Post', content: 'Hello world' },
 *     { title: 'Second Post', content: 'More content' }
 *   ]
 * });
 */
export function render(path: string, context: any, options?: Options): string {
  var renderFunction = compileFile(path, options);
  return renderFunction(context);
}

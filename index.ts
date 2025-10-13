/**
 * Represents a token in the templating language. Each token has a type and
 * associated text, along with additional fields depending on the token type.
 */
type Token = {
  text: string;
} & (
  | { type: 'text' }
  | { type: 'cmnt' } // <!--TEXT-->
  | { type: 'tmpl-ctrl' } // <%TEXT%>
  | { type: 'tmpl-expr'; escape: boolean } // <%=TEXT%>
  | { type: 'tag-close'; name: string } // </NAME>
  | { type: 'tag-start'; name: string } // <NAME
  | { type: 'tag-end'; closed: boolean; synthetic: boolean } // > or />
  | { type: 'attr'; key: string } // KEY=
);

/**
 * Matches different tokens used for splitting up the source string:
 * 1. HTML comment start `<!--`
 * 2. Template tag start `<%`, `<%=`, `<%-`
 * 3. HTML closing tag `</tagname>`
 * 4. HTML opening tag start `<tagname`
 */
var pattern = /(<!--)|(<%[=-]?(?!%))|(<\/[^\s!%<>/]+>)|(<[^\s!%<>/]+)/g;

/**
 * Tokenizes the input source string into an array of tokens.
 * @param source The input string to tokenize.
 * @returns An array of tokens representing the parsed structure of the input.
 */
function tokenize(source: string): Token[] {
  // output token list,
  // should only be appended to via emit
  var tokens: Token[] = [];

  // adds a token to the output list
  function emit<
    T extends Token['type'],
    F extends Omit<Extract<Token, { type: T }>, 'type' | 'text'> & { text?: string },
  >(type: T, fields: F | string) {
    if (typeof fields === 'string') {
      tokens.push({ type, text: fields } as Token);
    } else {
      tokens.push(Object.assign({ type, text: '' }, fields) as Token);
    }
  }

  // current index in the source string
  var currentIndex = 0;

  // searches for the next occurrence of `needle` in `source` starting from `currentIndex`
  // returns the text between `currentIndex` and the found index
  // updates `currentIndex` to be the index after the found `needle`
  // if `needle` is not found, returns the text from `currentIndex` to the end of `source`
  function until(needle: string): string {
    // find the next occurrence of `needle`
    var needleIndex = source.indexOf(needle, currentIndex);
    if (needleIndex === -1) needleIndex = source.length;

    // extract the text between `currentIndex` and `needleIndex`
    var text = source.slice(currentIndex, needleIndex);

    // update `currentIndex` to be after the found `needle`
    pattern.lastIndex = currentIndex = needleIndex + needle.length;

    return text;
  }

  // current regex match
  var match;

  // iterate over all matches in the source string
  while (match = pattern.exec(source)) {
    // emit any text before the match as a text token
    if (currentIndex < match.index) {
      emit('text', source.slice(currentIndex, match.index));
    }

    // update currentIndex to be after the matched token
    currentIndex = pattern.lastIndex;

    // destructure the match array to identify which group matched
    var [, matchCmnt, matchTmpl, matchTagClose, matchTagStart] = match;

    // handle comments
    if (matchCmnt) {
      emit('cmnt', until('-->'));
      continue;
    }

    // handle template tags
    if (matchTmpl) {
      var text = until('%>');
      if (matchTmpl === '<%') {
        emit('tmpl-ctrl', text);
      } else {
        emit('tmpl-expr', { text, escape: matchTmpl === '<%=' });
      }
      continue;
    }

    // handle closing tags
    if (matchTagClose) {
      emit('tag-close', { name: matchTagClose.slice(2, -1) });
      continue;
    }

    // parse opening tag
    // we've just matched <NAME and currentIndex is after the tag name
    // we need to parse out all the attributes and the tag end
    // as well as any template tags inside the attributes

    // extract the tag name
    var name = matchTagStart!.slice(1);

    // start by emitting the tag-start token
    emit('tag-start', { name });

    // current buffer
    // accumulates text until we hit a special character
    var buffer = '';

    // whether the tag was closed with /> or not
    var closed = false;
    // whether the tag was auto-closed due to EOF or some other condition
    var synthetic = true;

    // are we in quotes? which ones?
    var quote: '' | '"' | "'" = '';

    // sticky regex matching the next opening template tag
    var patternTmpl = /<%[=-]?/y;

    // iterate!
    while (true) {
      // check if there's a template tag at the current position
      patternTmpl.lastIndex = currentIndex;
      match = patternTmpl.exec(source);
      if (match) {
        // there is! first, move past it and store the match
        currentIndex = patternTmpl.lastIndex;
        matchTmpl = match[0]!;
        // then emit any buffered text before the template tag
        if (buffer) {
          emit('text', buffer);
          buffer = '';
        }
        // finally, parse out the template tag content
        // this is (or should be) the *exact* same as how we parse template tags outside of tags
        var text = until('%>');
        if (matchTmpl === '<%') {
          emit('tmpl-ctrl', text);
        } else {
          emit('tmpl-expr', { text, escape: matchTmpl === '<%=' });
        }
      }

      // get the next character
      var c = source[currentIndex++];

      // if we hit the end of the source, emit any remaining buffer and break
      if (!c) {
        if (buffer) emit('text', buffer);
        break;
      }

      // if we're in quotes, only look for the matching quote to close them
      if (quote) {
        if (c === quote) {
          quote = '';
        }
      }
      // match opening quotes
      else if (c === '"' || c === "'") {
        quote = c;
      }
      // attempt to match attributes in the form KEY=
      else if (c === '=') {
        // try to match KEY= at the end of the buffer
        match = buffer.match(/[^\s"'>/=]+$/);
        if (match) {
          // we have a match! start by removing the KEY from the buffer
          var key = match[0]!;
          buffer = buffer.slice(0, -key.length);
          // emit any remaining buffer as text
          if (buffer) {
            emit('text', buffer);
            buffer = '';
          }
          // emit the attr token
          emit('attr', { key });
          // DON'T put the = in the buffer, just continue
          continue;
        }
      }
      // match the end of the tag
      else if (c === '>') {
        // if the previous character was a /, it's a self-closing tag
        if (closed = buffer.endsWith('/')) {
          buffer = buffer.slice(0, -1);
        }
        // emit any remaining buffer and break
        if (buffer) {
          emit('text', buffer);
        }
        synthetic = false;
        break;
      }

      // accumulate most characters into the buffer
      buffer += c;
    }

    // finally, emit the tag-end token
    emit('tag-end', { closed, synthetic });
  }

  // emit any remaining text after the last match as a text token
  if (currentIndex < source.length) {
    emit('text', source.slice(currentIndex));
  }

  return tokens;
}

/**
 * List of HTML void element names.
 * Void elements are self-closing and do not have closing tags.
 */
var voidElements = new Set(
  'area base br col embed hr img input link meta param source track wbr'
    .split(' ')
);
/**
 * List of HTML block-opening element names.
 * These elements typically start a new block.
 */
var blockElements = new Set(
  'address article aside blockquote div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr main nav ol p pre section table ul'
    .split(' ')
);

/**
 * Should the current top-of-stack element auto-close when `incoming` opens?
 * @param top The name of the current top-of-stack element.
 * @param incoming The name of the incoming element.
 * @returns Whether the top element should auto-close.
 */
function shouldClose(top: string, incoming: string): boolean {
  // close <p> when a new block starts
  if (top === 'p' && blockElements.has(incoming)) return true;

  // lists
  if (top === 'li' && incoming === 'li') return true;

  // definition lists
  if (top === 'dt' && (incoming === 'dt' || incoming === 'dd')) return true;
  if (top === 'dd' && (incoming === 'dt' || incoming === 'dd')) return true;

  // tables, rows, and cells
  if (top === 'tr' && (incoming === 'tr' || incoming === 'tbody' || incoming === 'thead' || incoming === 'tfoot')) return true;
  if ((top === 'td' || top === 'th') && (incoming === 'td' || incoming === 'th' || incoming === 'tr')) return true;

  // select options
  if (top === 'option' && (incoming === 'option' || incoming === 'optgroup')) return true;
  if (top === 'optgroup' && incoming === 'optgroup') return true;

  return false;
}

/**
 * Removes leading whitespace from each line of a multi-line string.
 * @param input The multi-line string to process.
 * @returns The processed string with leading whitespace removed.
 */
function dedent(input: string): string {
  if (!input) {
    return '';
  }
  var lines = input.split('\n');
  if (lines.length <= 1) {
    return input;
  }
  var amount = Infinity;
  for (var line of lines) {
    var indent = line.match(/^[ \t]*/)![0];
    if (indent !== line) {
      if (indent) {
        amount = Math.min(amount, indent.length);
      } else {
        return input;
      }
    }
  }
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i]!.slice(amount);
  }
  return lines.join('\n');
}

/**
 * Collapses whitespace in a string.
 * @param input The input string to process.
 * @returns The processed string with collapsed whitespace.
 */
function collapseWhitespace(input: string): string {
  return input
    // normalize all CRLF/CR to LF
    .replace(/\r\n?/g, '\n')
    // collapse spaces and tabs
    .replace(/[ \t]+/g, ' ')
    // remove spaces around newlines
    .replace(/ *\n */g, '\n')
    // collapse multiple newlines
    .replace(/\n{2,}/g, '\n');
}

/**
 * Compiles a list of tokens into a render function.
 * @param tokens The list of tokens to compile.
 * @param options Template options.
 * @returns A compiled template function.
 */
function compileFromTokens(tokens: Token[], options: Required<Options>): Template {
  // retrieve the options we need
  var filename = options.templateFilename;
  var preserveWhitespace = options.preserveWhitespace;

  // stack of open elements
  var stack: string[] = [];

  // are we inside a <script> or <style> tag?
  var inScript = false;
  // if so, what tag is it, and what was the stack when we entered it?
  var lastScriptName: string | null = null;
  var lastScriptStack: string[] | null = null;

  /**
   * Attempts to open a tag, updating the stack.
   * May implicitly close tags according to optional-end-tag rules.
   */
  function open(name: string) {
    // once we're in a script or style, ignore everything until we close it
    if (inScript) return;

    name = name.toLowerCase();

    // if it's a script or style, enter script mode
    if (name === 'script' || name === 'style') {
      inScript = true;
      lastScriptName = name;
      lastScriptStack = stack.slice();
    }

    // void elements don't go on the stack
    if (voidElements.has(name)) return;

    // repeatedly auto-close as long as the new tag triggers a closure of the top
    while (shouldClose(stack.at(-1)!, name)) {
      stack.pop();
    }

    stack.push(name);
  }

  /**
   * Attempts to close a tag, updating the stack.
   * Pops until the named tag is found (or nothing).
   */
  function close(name: string) {
    name = name.toLowerCase();

    // if we're in a script/style,
    if (inScript) {
      // only exit if we're closing the script/style tag
      if (name === lastScriptName) {
        inScript = false;
      } else {
        return;
      }
    // or if we're closing it a second time, restore the stack
    // this handles something like:
    // <script>
    //   const thisIsJustAString = `</script>`; // not a real closing tag
    //   const thisIsAnotherString = "<div>"; // also not a real tag!
    // </script>
    } else if (name === lastScriptName) {
      stack = lastScriptStack!.slice();
    }

    // void elements don't go on the stack
    if (voidElements.has(name)) return;

    // pop until we find the matching tag
    for (var i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === name) {
        stack.length = i; // drop everything above
        return;
      }
    }

    // not found, ignore it!
  }

  // generated code
  var code = `
  var __result;
  var __output = "";
  function __toString(str) {
    return str != null ? "" + str : "";
  }
  function __write(str) {
    __output += __toString(str);
  }
  var __escapeRegex = /[&<>"']/g;
  var __escapeChars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function __escapeReplace(c) {
    return __escapeChars[c];
  }
  function __escape(str) {
    return __toString(str).replace(__escapeRegex, __escapeReplace);
  }
  try {
    __renderTemplate();
  } catch (__cause) {
    var __message = __cause != null && __cause.message ? __cause.message : __cause;
    throw new Error(${JSON.stringify(filename + ': ')} + __message, { cause: __cause });
  }
  return __output;
  function __renderTemplate() {
    var ctx = __context;
    var include = __include;
    with (__context) {
`;

  // normal text output is buffered until we need to do templating
  var buffer = '';

  /**
   * Flushes the current text buffer.
   */
  function flush() {
    if (buffer) {
      code += '__write(' + JSON.stringify(buffer) + ');\n';
      buffer = '';
    }
  }

  // was the previous token a tmpl-expr?
  // we don't dedent after those
  var previousWasTmplExpr = false;

  // process each token
  for (var token of tokens) {
    var text = token.text;

    // handle whitespace preservation directives
    if (text.includes('PRESERVE_WHITESPACE_OFF')) {
      preserveWhitespace = false;
    } else if (text.includes('PRESERVE_WHITESPACE')) {
      preserveWhitespace = true;
    }

    // dedent multi-line text tokens if we're not preserving whitespace
    if (text && !preserveWhitespace && !previousWasTmplExpr) {
      text = dedent(text);
    }

    // handle template tokens immediately
    if (token.type === 'tmpl-ctrl') {
      flush();
      code += `${text}\n`;
      continue;
    }
    if (token.type === 'tmpl-expr') {
      flush();
      previousWasTmplExpr = true;
      code += `__result = (\n${text}\n);\n`;
      if (token.escape) {
        code += `__write(__escape(__result));\n`;
      } else {
        code += `__write(__result);\n`;
      }
      continue;
    }

    // handle all text-emitting tokens
    switch (token.type) {
      case 'text':
        // collapse whitespace if we're not preserving it and not in a script/style/pre tag
        if (!preserveWhitespace && !inScript && !stack.includes('pre')) {
          text = collapseWhitespace(text);
        }
        buffer += text;
        break;
      case 'cmnt':
        buffer += '<!--' + text + '-->';
        break;
      case 'tag-close':
        close(token.name);
        buffer += '</' + token.name + '>';
        break;
      case 'tag-start':
        open(token.name);
        buffer += '<' + token.name;
        break;
      case 'attr':
        buffer += token.key + '=';
        break;
      case 'tag-end':
        if (!token.synthetic) {
          buffer += token.closed ? '/>' : '>';
        }
        break;
    }

    previousWasTmplExpr = false;
  }

  // write any remaining buffer
  flush();

  // finish up the code
  code += '\n    }\n  }\n';

  // compile the generated code into a function
  var generatedRenderFunction: Function;
  try {
    generatedRenderFunction = new Function('__context', '__include', code);
  } catch (cause: any) {
    throw new Error(filename + ': ' + cause?.message || cause, { cause });
  }

  // include function, passed to the generated function
  function include(path: string, context: any) {
    var includedRenderFunction = compileTemplateFile(path, options);
    return includedRenderFunction(context);
  }

  // the final render function, returned to the user
  function renderFunction(context: any): string {
    return generatedRenderFunction(context || {}, include);
  }

  return renderFunction;
}

/**
 * Represents options for template compilation and rendering.
 */
export interface Options {
  /**
   * Base directory path for resolving included templates.
   * Defaults to the current working directory.
   * Ignored if a custom `readFile` function is provided.
   */
  baseDirectory?: string;
  /**
   * File extension to append when resolving template names.
   * Defaults to `.ejs`.
   * Ignored if a custom `readFile` function is provided.
   */
  extension?: string;
  /**
   * Function that reads a file from the filesystem.
   * @param path The path to the file to read.
   * @returns The contents of the file as a string.
   * Defaults to using Node's `fs.readFileSync` with `baseDirectory`.
   */
  readFile?: ((path: string) => string) | null;
  /**
   * Whether to cache compiled templates.
   * Defaults to `true` unless `NODE_ENV` is set to `development`
   */
  useCache?: boolean;
  /**
   * Whether to preserve all whitespace in the template.
   * Defaults to `false`, which collapses some whitespace.
   */
  preserveWhitespace?: boolean;
  /**
   * Name of the template, used for error messages.
   * If not provided, the `path` parameter to `template` is used.
   */
  templateFilename?: string;
}

/**
 * Represents a compiled template function that takes a context object and returns the rendered string.
 */
export type Template = (context: any) => string;

/**
 * Sanitizes and fills in default template options.
 * @param path The path to the template file, used as a fallback for `templateFilename`.
 * @param options The user-provided template options.
 * @returns The sanitized and filled-in template options.
 */
function prepareOptions(path: string | null, options: Options | undefined): Required<Options> {
  if (!options) options = {};
  return {
    baseDirectory: options.baseDirectory ? String(options.baseDirectory) : '',
    extension: options.extension ? String(options.extension) : '.ejs',
    readFile: options.readFile || null,
    useCache: options.useCache != null ? !!options.useCache : process.env.NODE_ENV !== 'development',
    preserveWhitespace: options.preserveWhitespace != null ? !!options.preserveWhitespace : false,
    templateFilename: options.templateFilename ? String(options.templateFilename) : path || 'anonymous template',
  };
}

/**
 * Default file reading function using Node's `fs` module.
 */
var defaultReadFile: (path: string, options: Options) => { path: string; content: string };

// lazy-initialized so that we don't require('fs') unless we actually need to read a file
defaultReadFile = function (path, options) {
  var nodeFs = require('fs');
  var nodePath = require('path');

  defaultReadFile = function (path, options) {
    if (options.baseDirectory) {
      path = nodePath.join(options.baseDirectory, path);
    }
    try {
      return { path, content: nodeFs.readFileSync(path, 'utf8') };
    } catch (cause) {
      if (options.extension) {
        path += options.extension;
        try {
          return { path, content: nodeFs.readFileSync(path, 'utf8') };
        } catch (ignored) {}
      }
      throw cause;
    }
  };

  return defaultReadFile(path, options);
};

/**
 * Reads a file from the filesystem.
 * @param path The path to the file to read.
 * @param options Template options.
 * @returns The contents of the file as a string.
 */
function readFile(path: string, options: Required<Options>): { path: string; content: string } {
  var userReadFile = options.readFile;
  if (userReadFile) {
    if (typeof userReadFile !== 'function') {
      throw new Error('readFile option must be a function or null/undefined');
    }
    var content = userReadFile(path);
    if (typeof content !== 'string') {
      throw new Error('readFile function must return a string');
    }
    return { path, content };
  } else {
    return defaultReadFile(path, options);
  }
}

/**
 * Compiles a template from a string.
 * @param source The template source code.
 * @param options Template options.
 * @returns A compiled template function.
 */
function compileTemplate(source: string, options: Required<Options>): Template {
  var tokens = tokenize(source);
  var renderFunction = compileFromTokens(tokens, options);
  return renderFunction;
}

// cache of compiled render functions by template path
// never cleared, but i'm sure the user won't fill it up or anything :wink:
var renderFunctionCache = new Map<string, Template>();

/**
 * Compiles a template from a file.
 * @param path The path to the template file.
 * @param options Template options.
 * @returns A compiled template function.
 */
function compileTemplateFile(path: string, options: Required<Options>): Template {
  if (options.useCache) {
    var cachedRenderFunction = renderFunctionCache.get(path);
    if (cachedRenderFunction) return cachedRenderFunction;
  }
  options.templateFilename = path;
  var file = readFile(path, options);
  var renderFunction = compileTemplate(file.content, options);
  if (options.useCache) {
    renderFunctionCache.set(path, renderFunction);
    renderFunctionCache.set(file.path, renderFunction);
  }
  return renderFunction;
}

/**
 * Compiles a template from a string.
 * @param source The template source code.
 * @param options Options for template compilation.
 * @returns A compiled template function.
 */
export function compile(source: string, options?: Options): Template {
  var preparedOptions = prepareOptions(null, options);
  return compileTemplate(source, preparedOptions);
}

/**
 * Compiles a template from a file.
 * @param path The path to the template file.
 * @param options Options for template compilation.
 * @returns A compiled template function.
 */
export function compileFile(path: string, options?: Options): Template {
  var preparedOptions = prepareOptions(path, options);
  return compileTemplateFile(path, preparedOptions);
}

/**
 * Compiles and renders a template from a file with the given context.
 * @param path The path to the template file.
 * @param context The context to render the template with.
 * @param options Options for template compilation.
 * @returns The rendered template string.
 */
export function render(path: string, context: any, options?: Options): string {
  var renderFunction = compileFile(path, options);
  return renderFunction(context);
}

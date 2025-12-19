import { collapse, dedent, scan } from './utils';

// preserved elements and their closing tag regexes
// whitespace inside these elements will not be collapsed, but will be dedented
var preservedElements: Record<string, RegExp> = {
  'textarea': /<\/textarea>/ig,
  'script': /<\/script>/ig,
  'style': /<\/style>/ig
};

/**
 * Generates the JavaScript code for a template.
 *
 * @param name The name of the template function, or null for just the body.
 * @param path The path of the template for error messages.
 * @param source The source code of the template.
 * @param whitespace True to collapse whitespace outside of preserved elements.
 * @returns The generated JavaScript code as a string.
 *
 * @example
 * var withName = generate('myTemplate', 'template.ejs', '<h1><%= title %></h1>', true);
 * console.log(withName);
 * // Outputs:
 * // function myTemplate(__context, __escape, __include) {
 * // var __buffer = "";
 * // ...
 * // return __buffer;
 * // }
 *
 * @example
 * var withoutName = generate(null, 'template.ejs', '<h1><%= title %></h1>', true);
 * console.log(withoutName);
 * // Outputs:
 * // var __buffer = "";
 * // ...
 * // return __buffer;
 */
export function generate(
  name: string | null,
  path: string,
  source: string,
  whitespace: boolean
): string {
  // generated code
  var code = (
    'var __buffer = "";\n' +
    'var __result;\n' +
    'var ctx = __context;\n' +
    'var include = __include;\n' +
    'try { with (__context) {\n'
  );

  // wrap in function if name is provided
  if (name != null) {
    code = 'function ' + name + '(__context, __escape, __include) {\n' + code;
  }

  // current text segment
  var text = '';

  // flushes the current text segment, if any
  function flush() {
    if (text) {
      code += '__buffer += ' + JSON.stringify(text) + ';\n';
      text = '';
    }
  }

  // expands a slice of the source, handling template tags, with or without whitespace collapsing
  function expand(slice: string, whitespace: boolean) {
    var scanner = scan(slice);
    while (scanner(/<%[=-]?(?!%)/g) || scanner.match) {
      if (whitespace) {
        text += collapse(scanner.slice);
      } else {
        text += scanner.slice;
      }
      if (scanner.match) {
        flush();
        var tag = scanner.match[0];
        var body = dedent(scanner('%>'));
        if (tag === '<%') {
          code += body + '\n';
        } else {
          code += '__result = (\n' + body + '\n);\nif (__result != null) __buffer += ';
          if (tag === '<%=') {
            code += '__escape(__result);\n';
          } else {
            code += '__result;\n';
          }
        }
      }
    }
  }

  // do we need to collapse whitespace?
  if (whitespace) {
    // are we inside a <pre> element?
    var pre = false;

    var scanner = scan(source);
    var regex = /(<!--)|(<\/[^\s<>!/%=-]+>)|(<[^\s<>!/%=-]+)/g;

    while (scanner(regex) || scanner.match) {
      // expand the text before the match
      expand(scanner.slice, whitespace && !pre);

      // handle the match, if any
      var match = scanner.match;
      if (match) {
        // add the matched delimiter to the output
        text += match[0];

        var comment = match[1];
        var tagClose = match[2];
        var tagStart = match[3];

        // handle comments
        // comments will not have their internal whitespace collapsed, but they will be dedented
        if (comment) {
          expand(dedent(scanner('-->')), false);
          text += '-->';
          continue;
        }

        // handle closing tags
        // this is just to find </pre> tags to turn off pre mode
        if (tagClose) {
          if (tagClose.toLowerCase() === '</pre>') {
            pre = false;
          }
          continue;
        }

        // handle opening tags

        // first, find the tag name
        var tag = tagStart!.slice(1).toLowerCase();

        // check for <pre> to turn on pre mode
        if (tag === 'pre') {
          pre = true;
        }

        // now, parse the rest of the tag
        var rune, buffer = ''; // accumulated but unexpanded/unemitted text
        var quote: '' | '"' | "'" = ''; // are we in a quoted attribute value?

        while (rune = source[scanner.index++]) {
          buffer += rune;
          if (quote) {
            if (rune === quote) {
              expand(buffer, false); // emit quoted text without collapsing
              buffer = quote = '';
            }
          } else if (rune === '"' || rune === "'") {
            expand(buffer, true); // emit unquoted text with collapsing
            buffer = '';
            quote = rune;
          } else if (rune === '>') {
            break; // end of tag
          }
        }

        // emit any remaining buffered text
        expand(buffer, !quote);

        // check for preserved elements to avoid collapsing their content
        // if we find one, scan to its closing tag and emit the content with only dedent
        var closing = preservedElements[tag];
        if (closing) {
          expand(dedent(scanner(closing)), false);
          if (scanner.match) {
            text += scanner.match[0];
          }
        }
      }
    }
  } else {
    // no whitespace collapsing, just expand the whole source!
    expand(source, false);
  }

  // flush any remaining text
  flush();

  // finish the generated code with error handling and return statement
  code += (
    '} } catch (__cause) {\n' +
    'var __message = __cause != null && __cause.message ? __cause.message : __cause;\n' +
    'throw new Error(' + JSON.stringify(path + ': ') + ' + __message, { cause: __cause });\n' +
    '}\n' +
    'return __buffer;\n'
  );

  // close the function if needed
  if (name != null) {
    code += '}\n';
  }

  return code;
}

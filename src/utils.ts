
var escapeRegex = /[&<>"']/g;
var escapeRunes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeReplace(rune: string): string {
  return escapeRunes[rune as keyof typeof escapeRunes];
}

/**
 * Replaces the characters "&", "<", ">", '"', and "'" in a string with their corresponding HTML entities.
 *
 * @param string The string to escape. Non-string values will be converted to strings.
 * @returns The escaped string.
 */
export function escape(string: any): string {
  return String(string).replace(escapeRegex, escapeReplace);
}

/**
 * Collapses whitespace in a string:
 * 1. Replaces runs of spaces and tabs with a single space.
 * 2. Replaces runs of newlines, possibly mixed with spaces, with a single newline.
 * 3. Trims any spaces around newlines.
 * Note that leading and trailing whitespace is not removed.
 *
 * @param string The string to collapse.
 * @returns The collapsed string.
 */
export function collapse(string: string): string {
  return string
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\r?\n(?: |\r?\n)*/g, '\n');
}

/**
 * Dedents a multi-line string by removing the common leading whitespace from each line.
 *
 * @param string The string to dedent.
 * @returns The dedented string.
 */
export function dedent(string: string): string {
  var lines = string.split(/\r?\n/);
  if (lines.length <= 1) return string;
  var amount = Infinity;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]!;
    var indent = line.match(/^[ \t]*/)![0];
    if (indent !== line) {
      if (indent) {
        amount = Math.min(amount, indent.length);
      } else {
        return string;
      }
    }
  }
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i]!.slice(amount);
  }
  return lines.join('\n');
}

/**
 * A stateful text scanner for sequential parsing with string and regex delimiters.
 */
export interface Scanner {
  /**
   * The current index in the source string.
   * This is updated after each scan operation, and indicates where the next scan will start.
   */
  index: number;
  /**
   * The text extracted by the most recent scan operation.
   * This is the substring from the previous index up to, but not including, the matched delimiter.
   */
  slice: string;
  /**
   * The RegExp match result from the most recent regex scan, or null if the last scan used a string or found no match.
   */
  match: RegExpExecArray | null;
  /**
   * Scans forward in the source text and returns all text from the current position up to, but not including, the needle.
   *
   * @param needle The delimiter or pattern to search for
   * @returns The text slice from the current position up to the needle
   *
   * @remarks
   * - Advances the scanner's index past the needle
   * - Updates scanner.slice with the returned text
   * - For RegExp needles, you should almost always use the 'g' flag to ensure correct behavior
   * - For RegExp needles, updates scanner.match with the match result
   * - If the needle is not found, returns all remaining text and moves to the end
   * - If an empty string is passed, returns all remaining text and moves to the end
   * - If already at the end of the source, returns an empty string
   *
   * @example
   * // String delimiter
   * var scanner = scan('a=1; b=2;');
   * var variable = scanner('=');  // 'a'
   * var value = scanner(';');     // '1'
   *
   * @example
   * // Regex pattern
   * var scanner = scan('The answer is 42');
   * var text = scanner(/\d+/g);      // 'The answer is '
   * console.log(scanner.match[0]);    // '42'
   */
  (needle: string | RegExp): string;
}

/**
 * Creates a new Scanner instance.
 *
 * @param source The text to be scanned
 * @returns The new Scanner instance
 *
 * @example
 * var scanner = scan('Hello, World!');
 * var greeting = scanner(', ');  // 'Hello'
 * var target = scanner('!');     // 'World'
 */
export function scan(source: string): Scanner {
  var scanner = function (needle) {
    scanner.match = null;
    if (scanner.index >= source.length) {
      return scanner.slice = '';
    }
    var needleLength = 0;
    var needleIndex = source.length;
    if (typeof needle === 'string') {
      needleLength = needle.length;
      if (needle) {
        var indexOf = source.indexOf(needle, scanner.index);
        if (indexOf !== -1) needleIndex = indexOf;
      }
    } else {
      needle.lastIndex = scanner.index;
      var match = needle.exec(source);
      if (match) {
        scanner.match = match;
        needleLength = match[0].length;
        needleIndex = match.index;
      }
    }
    scanner.slice = source.slice(scanner.index, needleIndex);
    scanner.index = needleIndex + needleLength;
    return scanner.slice;
  } as Scanner;
  scanner.index = 0;
  scanner.slice = '';
  scanner.match = null;
  return scanner;
}

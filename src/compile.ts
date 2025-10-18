import type { EscapeFunction, IncludeFunction, RawTemplate, Template } from './types';

/**
 * Compiles a template's generated JavaScript code into a render function.
 *
 * @param path The path of the template for error messages.
 * @param code The generated JavaScript code of the template.
 * @param escapeFunction The function used to escape HTML.
 * @param includeFunction The function used to include other templates.
 * @returns The compiled render function.
 * @throws If there is a syntax error in the generated code.
 */
export function compile(
  path: string,
  code: string,
  escapeFunction: EscapeFunction,
  includeFunction: IncludeFunction
): Template {
  var compiledRenderFunction: RawTemplate;
  try {
    compiledRenderFunction = new Function('__context', '__escape', '__include', code) as RawTemplate;
  } catch (cause: any) {
    var message = cause != null && cause.message ? cause.message : cause;
    throw new Error(path + ': ' + message, { cause: cause });
  }
  function renderFunction(context: any): string {
    return compiledRenderFunction(context || {}, escapeFunction, includeFunction);
  }
  return renderFunction;
}

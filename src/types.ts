
/**
 * Function used to read the contents of a file.
 *
 * @param path The path to the file.
 * @returns The content of the file.
 * @throws If the file cannot be read.
 */
export type ReadFileFunction = (path: string) => string;

/**
 * Function used to escape values for safe inclusion in templates.
 *
 * @param string The value to escape.
 * @returns The escaped string.
 */
export type EscapeFunction = (string: any) => string;

/**
 * Function used to include other templates within a template.
 *
 * @param path The path to the template to include.
 * @param context The context object to use when rendering the included template.
 * @returns The rendered string of the included template.
 * @throws If the included template cannot be found or rendered.
 */
export type IncludeFunction = (path: string, context: any) => string;

/**
 * Represents a raw compiled template function that takes a context object,
 * an escape function, and an include function, and returns the rendered string.
 *
 * @param context The context object for rendering the template.
 * @param escape The escape function to use for escaping values.
 * @param include The include function to use for including other templates.
 * @returns The rendered template string.
 * @throws If an error occurs during rendering.
 */
export type RawTemplate = (context: any, escape: EscapeFunction, include: IncludeFunction) => string;

/**
 * Represents a compiled template function that takes a context object and returns the rendered string.
 *
 * @param context The context object for rendering the template.
 * @returns The rendered template string.
 * @throws If an error occurs during rendering.
 */
export type Template = (context: any) => string;

/**
 * Options for template compilation and rendering.
 */
export interface Options {
  /**
   * The base directory for resolving template paths when including other templates.
   * Defaults to the current working directory. Ignored if a custom `readFile` function is provided.
   */
  baseDirectory?: string;
  /**
   * File extension to append when resolving template names.
   * Defaults to `.ejs`. Ignored if a custom `readFile` function is provided.
   */
  extension?: string;
  /**
   * Function used to read the contents of a file.
   * If not provided, the default file system read function will be used.
   */
  readFile?: ReadFileFunction | null;
  /**
   * Function used to escape values for safe inclusion in templates.
   * If not provided, a default escape function for HTML will be used.
   */
  escape?: EscapeFunction | null;
  /**
   * Function used to include other templates within a template.
   * If not provided, a default include function will be used that calls `readFile`.
   */
  include?: IncludeFunction | null;
  /**
   * Whether to cache compiled templates.
   * Defaults to `true` unless `NODE_ENV` is set to `"development"`.
   */
  useCache?: boolean;
  /**
   * Whether to preserve all whitespace in the template.
   * Defaults to `false`, which collapses some whitespace.
   */
  preserveWhitespace?: boolean;
  /**
   * Path to the template, used for error messages.
   * Defaults `"<anonymous template>"` if no path is given. Ignored if the path argument is provided.
   */
  templatePath?: string;
}

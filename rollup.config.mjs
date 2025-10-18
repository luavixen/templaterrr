import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/templaterrr.js',
      format: 'cjs',
      generatedCode: 'es5'
    },
    external: ['fs', 'path'],
    plugins: [typescript()]
  },
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/templaterrr.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];

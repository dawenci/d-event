import typescript from 'rollup-plugin-typescript2'
// const babel = require('rollup-plugin-babel')
import nodeResolvePlugin from 'rollup-plugin-node-resolve'
import commonJSPlugin from 'rollup-plugin-commonjs'
const pkg = require('./package.json')

export default {
  input: './src/index.ts',
  output: [
    {
      file: pkg.module,
      format: 'es',
      sourcemap: false
    },
    {
      file: pkg.browser,
      format: 'umd',
      name: 'DEvent',
      sourcemap: false
    },
    {
      file: pkg.browser.replace('.js', '.min.js'),
      format: 'umd',
      name: 'DEvent',
      sourcemap: false
    }
  ],
  plugins: [
    nodeResolvePlugin({ browser: true }),
    commonJSPlugin(),
    typescript({
      tsconfigOverride: {
        compilerOptions: {
          // noEmitOnError: false,
          // noImplicitAny: false,
          // strict: false,
          allowSyntheticDefaultImports: true,
          experimentalDecorators: true,
          lib: [ 'dom', 'scripthost', 'es5', 'es2015.promise' ]
        }
      }
    })
    // babel({
    //   exclude: 'node_modules/**' // only transpile our source code
    // })
  ]
}

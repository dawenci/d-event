const fs = require('fs')
const fse = require('fs-extra')
const klawSync = require('klaw-sync')
const path = require('path')
const zlib = require('zlib')
const rollup = require('rollup')
const typescriptPlugin = require('rollup-plugin-typescript2')
const nodeResolvePlugin = require('rollup-plugin-node-resolve')
const commonJSPlugin = require('rollup-plugin-commonjs')
const typescript = require('typescript')
const tsCompile = require('./typescript-compile')
  // const babel = require('rollup-plugin-babel')
const uglify = require('uglify-js')
const replace = require('rollup-plugin-replace')
const pkg = require('../package.json')
const banner = require('./banner')
const INPUT = 'src/index.ts'
Promise.resolve()
  .then(buildESM)
  .then(buildCJS)
  .then(buildUMDDev)
  .then(buildUMDProd)
  .then(generateDeclarations)
  .then(clean)
  .catch(logError)

function write(dest, code, zip) {
  return new Promise((resolve, reject) => {
    function report(extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
      resolve()
    }
    fs.writeFile(dest, code, err => {
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

function getSize(code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError(e) {
  console.log(e)
}

function blue(str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}

function walkSync(dir) {
  let files = klawSync(dir, {
    filter: item => /^.j|ts$/.test(path.extname(item.path))
  }).map(item => item.path)
  return files
}
// generate declarations
function generateDeclarations() {
  fse.ensureDirSync('types/_temp')
  const files = walkSync('src/')
  tsCompile(files, {
    noEmitOnError: false,
    noImplicitAny: false,
    strict: false,
    declaration: true, // Auto-Generate typings
    declarationDir: 'types',
    outDir: 'types/_temp',
    listEmittedFiles: true
  })
  fse.removeSync('types/_temp')
  console.log(blue('types') + ' generated.')
}
// 编译 esm 版本
function buildESM() {
  fse.ensureDirSync('dist/esm')
  const files = walkSync('src/')
  const emittedFiles = tsCompile(files, {
    noEmitOnError: false,
    noImplicitAny: false,
    strict: false,
    moduleResolution: typescript.ModuleResolutionKind.ES2015,
    target: typescript.ScriptTarget.ES5,
    module: typescript.ModuleKind.ES2015,
    declaration: false,
    outDir: 'dist/esm',
    // rootDir: './', // 加上该行，输出会是 dist/esm/src/index.js 这样的
    listEmittedFiles: true
  })
  if (Array.isArray(emittedFiles)) {
    emittedFiles.forEach(file => {
      console.log(blue(file) + ' emitted.')
    })
  }
  console.log(blue('esm...') + ' done.')
}
// 编译 commonJS 版本
function buildCJS() {
  fse.ensureDirSync('dist/cjs')
  const files = walkSync('src/')
  const emittedFiles = tsCompile(files, {
    noEmitOnError: false,
    noImplicitAny: false,
    strict: false,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    target: typescript.ScriptTarget.ES5,
    module: typescript.ModuleKind.CommonJS,
    declaration: false,
    outDir: 'dist/cjs',
    listEmittedFiles: true
  })
  if (Array.isArray(emittedFiles)) {
    emittedFiles.forEach(file => {
      console.log(blue(file) + ' emitted.')
    })
  }
  console.log(blue('cjs...') + ' done.')
}
// browser 开发版 (bundle)
function buildUMDDev() {
  fse.ensureDirSync('dist')
    // Standalone Dev Build (Browser)
  return rollup
    .rollup({
      input: INPUT,
      plugins: [
        replace({ 'process.env.NODE_ENV': "'development'" }),
        nodeResolvePlugin(),
        commonJSPlugin(),
        typescriptPlugin({
          typescript,
          tsconfigOverride: {
            compilerOptions: {
              noEmitOnError: false,
              noImplicitAny: false,
              strict: false,
            }
          }
        }),
        // babel({
        //   exclude: 'node_modules/**'
        // })
      ]
    })
    .then(function(bundle) {
      return bundle.generate({
        format: 'umd',
        banner: banner,
        name: 'DEvents'
      })
    })
    .then(({ code }) => {
      return write(pkg.browser, code)
    })
}
// browser 产品版 (bundle)
function buildUMDProd() {
  fse.ensureDirSync('dist')
    // Standalone Production Build (Browser)
  return rollup
    .rollup({
      input: INPUT,
      plugins: [
        replace({ 'process.env.NODE_ENV': "'production'" }),
        nodeResolvePlugin(),
        commonJSPlugin(),
        typescriptPlugin({
          typescript,
          tsconfigOverride: {
            compilerOptions: {
              noEmitOnError: false,
              noImplicitAny: false,
              strict: false,
            }
          }
        }),
        // babel({
        //   exclude: 'node_modules/**'
        // })
      ]
    })
    .then(function(bundle) {
      return bundle.generate({
        format: 'umd',
        name: 'DEvents',
        banner: banner
      })
    })
    .then(({ code }) => {
      var result = uglify.minify(code, {})
      var minified = result.code
        // var map = result.map
      minified = banner + '\n' + minified
      return write(pkg.browser.replace('.js', '.min.js'), minified, true)
    })
}
// 清理编译中间产物
function clean() {
  // rollup-plugin-typescript2 缓存
  fse.removeSync('.rpt2_cache')
}

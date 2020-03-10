import svelte from 'rollup-plugin-svelte-hot'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
import {terser} from 'rollup-plugin-terser'
import hmr, {autoCreate} from 'rollup-plugin-hot'

const spa = false
const nollup = !!process.env.NOLLUP
const watch = !!process.env.ROLLUP_WATCH
const useLiveReload = !!process.env.LIVERELOAD

const dev = watch || useLiveReload
const production = !dev

const hot = watch && !useLiveReload

export default {
  input: 'src/main.js',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'app',
    file: 'public/build/bundle.js'
  },
  plugins: [
    svelte({
      dev: !production,
      ...(!hot && {
        css: css => {
          css.write('public/build/bundle.css')
        }
      }),
      hot: hot && {
        optimistic: true,
        noPreserveState: false
      }
    }),
    resolve({
      browser: true
    }),
    commonjs(),
    dev && !nollup && serve(),
    useLiveReload && livereload('public'),
    production && terser(),
    hot &&
      autoCreate({
        include: 'src/**/*',
        recreate: true
      }),
    hmr({
      public: 'public',
      inMemory: true,
      compatModuleHot: !hot
    })
  ],
  watch: {
    clearScreen: false
  }
}

function serve() {
  let started = false
  return {
    name: 'svelte/template:serve',
    writeBundle() {
      if (!started) {
        started = true
        const flags = ['run', 'start', '--', '--dev']
        if (spa) {
          flags.push('--single')
        }
        require('child_process').spawn('npm', flags, {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true
        })
      }
    }
  }
}

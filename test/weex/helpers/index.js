import fs from 'fs'
import path from 'path'
import * as Vue from '../../../packages/weex-vue-framework'
import { compile } from '../../../packages/weex-template-compiler'
import WeexRuntime from 'weex-js-runtime'
import styler from 'weex-styler'

const styleRE = /<\s*style\s*\w*>([^(<\/)]*)<\/\s*style\s*>/g
const scriptRE = /<\s*script.*>([^]*)<\/\s*script\s*>/
const templateRE = /<\s*template\s*([^>]*)>([^]*)<\/\s*template\s*>/

export function readFile (filename) {
  return fs.readFileSync(path.resolve(__dirname, '../cases/', filename), 'utf8')
}

export function readObject (filename) {
  return (new Function(`return ${readFile(filename)}`))()
}

console.debug = () => {}

// http://stackoverflow.com/a/35478115
const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g
export function strToRegExp (str) {
  return new RegExp(str.replace(matchOperatorsRe, '\\$&'))
}

function parseStatic (fns) {
  return '[' + fns.map(fn => `function () { ${fn} }`).join(',') + ']'
}

export function compileAndStringify (template) {
  const { render, staticRenderFns } = compile(template)
  return {
    render: `function () { ${render} }`,
    staticRenderFns: parseStatic(staticRenderFns)
  }
}

/**
 * Compile *.vue file into js code
 * @param {string} source raw text of *.vue file
 * @param {string} componentName whether compile to a component
 */
export function compileVue (source, componentName) {
  return new Promise((resolve, reject) => {
    if (!templateRE.test(source)) {
      return reject('No Template!')
    }
    const scriptMatch = scriptRE.exec(source)
    const script = scriptMatch ? scriptMatch[1] : ''
    const templateMatch = templateRE.exec(source)
    const compileOptions = {}
    if (/\s*recyclable\=?/i.test(templateMatch[1])) {
      compileOptions.recyclable = true
    }
    const res = compile(templateMatch[2], compileOptions)

    const name = 'test_case_' + (Math.random() * 99999999).toFixed(0)
    const generateCode = styles => (`
      try { weex.document.registerStyleSheets("${name}", [${JSON.stringify(styles)}]) } catch(e) {};
      var ${name} = Object.assign({
        _scopeId: "${name}",
        style: ${JSON.stringify(styles)},
        render: function () { ${res.render} },
        ${res['@render'] ? ('"@render": function () {' + res['@render'] + '},') : ''}
        staticRenderFns: ${parseStatic(res.staticRenderFns)},
      }, (function(){
        var module = { exports: {} };
        ${script};
        return module.exports;
      })());
    ` + (componentName
        ? `Vue.component('${componentName}', ${name});\n`
        : `${name}.el = 'body';new Vue(${name});`)
    )

    let cssText = ''
    let styleMatch = null
    while ((styleMatch = styleRE.exec(source))) {
      cssText += `\n${styleMatch[1]}\n`
    }
    styler.parse(cssText, (error, result) => {
      if (error) {
        return reject(error)
      }
      resolve(generateCode(result.jsonStyle))
    })
    resolve(generateCode({}))
  })
}

export function compileWithDeps (entryPath, deps) {
  return new Promise((resolve, reject) => {
    if (Array.isArray(deps)) {
      Promise.all(deps.map(dep => {
        return compileVue(readFile(dep.path), dep.name).catch(reject)
      })).then(depCodes => {
        compileVue(readFile(entryPath)).then(entryCode => {
          resolve(depCodes.join('\n') + entryCode)
        }).catch(reject)
      }).catch(reject)
    }
  })
}

function isObject (object) {
  return object !== null && typeof object === 'object'
}

function isEmptyObject (object) {
  return isObject(object) && Object.keys(object).length < 1
}

function omitUseless (object, parentKey) {
  if (isObject(object)) {
    if (parentKey !== 'attr') {
      delete object.ref
    }
    for (const key in object) {
      omitUseless(object[key], key)
      if (key === '@styleScope' ||
        key === '@templateId' ||
        key === 'bindingExpression') {
        delete object[key]
      }
      if (key.charAt(0) !== '@' &&
        (isEmptyObject(object[key]) || object[key] === undefined)) {
        delete object[key]
      }
      if (key === 'event' && Array.isArray(object[key])) {
        object.event = object.event.filter(name => {
          return name !== '_attach_slot' && name !== '_detach_slot'
        })
        if (!object.event.length) {
          delete object.event
        }
      }
    }
  }
  return object
}

export function getRoot (instance) {
  return omitUseless(instance.$getRoot())
}

// Get all binding events in the instance
export function getEvents (instance) {
  const events = []
  const recordEvent = node => {
    if (!node) { return }
    if (Array.isArray(node.event)) {
      node.event.forEach(type => {
        if (type !== '_attach_slot' && type !== '_detach_slot') {
          events.push({ ref: node.ref, type })
        }
      })
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(recordEvent)
    }
  }
  recordEvent(instance.$getRoot())
  return events
}

export function fireEvent (instance, ref, type, event = {}, params) {
  const el = instance.document.getRef(ref)
  if (el) {
    const _type = typeof type === 'string' ? type : type.type || ''
    instance.document.fireEvent(el, _type, event, {}, { params })
  }
}

export function createInstance (id, code, ...args) {
  WeexRuntime.config.frameworks = { Vue }
  const context = WeexRuntime.init(WeexRuntime.config)
  context.registerModules({
    timer: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    modal: ['toast', 'alert']
  })
  context.registerComponents([{
    type: 'recycle-list',
    methods: [
      'appendData', 'removeData', 'insertData',
      'updateData', 'insertRange', 'setListData'
    ]
  }])
  const instance = context.createInstance(id, `// { "framework": "Vue" }\n${code}`, ...args) || {}
  instance.document = context.getDocument(id)
  instance.$getRoot = () => context.getRoot(id)
  instance.$refresh = (data) => context.refreshInstance(id, data)
  instance.$destroy = () => {
    delete instance.document
    context.destroyInstance(id)
  }
  instance.$triggerHook = (id, hook, args) => {
    return instance.document.taskCenter.triggerHook(id, 'lifecycle', hook, args)
  }
  return instance
}

export function compileAndExecute (template, additional = '') {
  return new Promise(resolve => {
    const id = String(Date.now() * Math.random())
    const { render, staticRenderFns } = compile(template)
    const instance = createInstance(id, `
      new Vue({
        el: '#whatever',
        render: function () { ${render} },
        staticRenderFns: ${parseStatic(staticRenderFns)},
        ${additional}
      })
    `)
    setTimeout(() => resolve(instance), 10)
  })
}

export function syncPromise (arr) {
  let p = Promise.resolve()
  arr.forEach(item => {
    p = p.then(item)
  })
  return p
}

export function checkRefresh (instance, data, checker) {
  return () => new Promise(res => {
    instance.$refresh(data)
    setTimeout(() => {
      checker(getRoot(instance))
      res()
    })
  })
}

export function addTaskHook (hook) {
  global.callNative = function callNative (id, tasks) {
    if (Array.isArray(tasks) && typeof hook === 'function') {
      tasks.forEach(task => {
        hook(id, {
          module: task.module,
          method: task.method,
          args: Array.from(task.args)
        })
      })
    }
  }
}

export function resetTaskHook () {
  delete global.callNative
}

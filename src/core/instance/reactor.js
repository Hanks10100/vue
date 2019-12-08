/* @flow */

import { bind, noop } from '../util/index'
import { callHook } from './lifecycle'

export function isReactiveElement(target: any): boolean {
  return target && target instanceof ReactiveElement
}

export function hasReactiveElement(vm: Component): boolean {
  return vm && isReactiveElement(vm.$vnode)
}

export function getReactiveElement(vm: Component): ReactiveElement | void {
  if (vm && isReactiveElement(vm.$vnode)) {
    return vm.$vnode
  }
}

export function hasDefinition(options: any): boolean {
  return typeof options === 'function' &&
         typeof options.definition === 'function' &&
         options.definition._isNative === true
}

export function getDefinition(options: any) {
  if (hasDefinition(options)) {
    return options.definition
  }
}

export function setupReactiveElement(vm: Component, app: ReactiveElement, args: []): void {
  // console.log('------> setupReactiveElement', vm._uid)
  app.addEventListener('beforeUpdate', () => callHook(vm, 'beforeUpdate'))
  app.addEventListener('updated', () => callHook(vm, 'updated'))
  app.addEventListener('beforeMount', () => callHook(vm, 'beforeMount'))
  app.addEventListener('mounted', () => callHook(vm, 'mounted'))
  app.addEventListener('destroy', () => vm.$destroy())
  vm.$vnode = app
  app.$vueComponent = vm
  if (args[0] && typeof args[0] === 'object') {
    app.setState(args[0])
  }
}

export function setupDefinition(Ctor: Function, NativeDefinition: Function, options = {}) {
  const { name, template, styleSheets } = options
  if (typeof name !== 'string' || !name || !template) {
    return;
  }
  NativeDefinition._isNative = true
  NativeDefinition.componentName = name
  customElements.define(name, NativeDefinition, { reactive: true })
  customElements.defineTemplate(NativeDefinition, template)
  if (Array.isArray(styleSheets) && styleSheets.length) {
    styleSheets.forEach(sheet => {
      customElements.registerStyleSheet(NativeDefinition, sheet)
    })
  }
  Ctor.definition = NativeDefinition
  if (Ctor.options.components) {
    for (const name in Ctor.options.components) {
      const Sub = Ctor.options.components[name]
      if (Sub.definition && typeof Sub.definition.componentName === 'string') {
        console.log('------> defineAlias', name, Sub.definition.componentName)
        customElements.defineAlias(NativeDefinition, name.toLowerCase(), Sub.definition.componentName)
      }
    }
  }
}

export function registerMethods (vm: Component, methods: Object) {
  const $target = getReactiveElement(vm)
  if ($target) {
    for (const key in methods) {
      if (typeof methods[key] !== 'function') {
        $target[key] = bind(methods[key], vm)
      } else {
        $target[key] = noop
      }
    }
  }
}

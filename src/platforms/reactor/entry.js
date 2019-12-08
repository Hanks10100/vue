/* @flow */

import Vue from 'core/instance/index'

import { mountComponent } from 'core/instance/lifecycle'
import { setupReactiveElement, setupDefinition } from 'core/instance/reactor'

Vue.version = '__VERSION__'

Vue.prototype.__patch__ = function patch () {
  throw new Error('Should never call Vue.prototype.__patch__')
}

Vue.prototype.$mount = function (el?: string): Component {
  console.log('------> Vue.prototype.$mount', el)
  return mountComponent(this, el, false)
}

Vue.defineReactiveElement = function defineReactiveElement(Ctor, options) {
  if (typeof Ctor !== 'function') {
    return
  }
  console.log('------> defineReactiveElement', 'Ctor.options', 'options')
  if (options && options.name && options.template) {
    class VueReactiveComponent extends ReactiveElement {
      constructor (...args) {
        super(VueReactiveComponent)
        setupReactiveElement(new Vue(Ctor.options), this, args)
      }
    }
    setupDefinition(Ctor, VueReactiveComponent, options)
  }
}

export default Vue

import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import { initGlobalAPI } from '../global-api/index'

import { hasDefinition, getDefinition } from './reactor'

function Vue (options) {
  // console.log('--------->>>> Vue()', 'options')
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  if (hasDefinition(options)) {
    const NativeElement = getDefinition(options)
    const target = new NativeElement()
    return target.$vueComponent
  } else {
    this._init(options)
  }
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

initGlobalAPI(Vue)

export default Vue

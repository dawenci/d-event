'use strict'

const initEventObject = (eventObj) => {
  Object.defineProperty(eventObj, '__events__', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: {}
  })
  return eventObj
}

/**
 * @name DEvent
 * @description 事件构造函数（类），可以直接使用，或者作为基类被继承使用
 * @constructor
 */
class DEvent {
  constructor() {
    initEventObject(this)
  }

  /**
     * @method trigger
     * @description 发射事件
     */
  trigger(evType) {
    let evList, ev, eLen, aLen, args, a1, a2, i

    if (!this.__events__) initEventObject(this)

    // 假设该evType下，只有一个事件处理器
    ev = this.__events__[evType]

    if (!ev) return this

    aLen = arguments.length

    // 确认该evType下确实只有一个处理器
    if (typeof ev.callback === 'function') {
      // 把常用的情况单独处理，比全部都使用apply调用执行更快
      switch (aLen) {
        case 1:
          ev.callback.call(ev.ctx)
          break
        case 2:
          ev.callback.call(ev.ctx, arguments[1])
          break
        case 3:
          ev.callback.call(ev.ctx, arguments[1], arguments[2])
          break
        default:
          args = new Array(aLen - 1)
          for (i = 1; i < aLen; i += 1) {
            args[i - 1] = arguments[i]
          }
          ev.callback.apply(ev.ctx, args)
      }

      // 该evType其实是个数组的情况（2个事件处理器以上）
    }
    else if (Array.isArray(ev)) {
      // evList = ev.slice()
      evList = ev
      eLen = evList.length

      switch (aLen) {
        case 1:
          for (i = 0; i < eLen; i += 1) {
            ;(ev = evList[i]).callback.call(ev.ctx)
          }
          break
        case 2:
          a1 = arguments[1] // 缓存再参与循环
          for (i = 0; i < eLen; i += 1) {
            ;(ev = evList[i]).callback.call(ev.ctx, a1)
          }
          break
        case 3:
          a1 = arguments[1]
          a2 = arguments[2]
          for (i = 0; i < eLen; i += 1) {
            ;(ev = evList[i]).callback.call(ev.ctx, a1, a2)
          }
          break
        default:
          args = new Array(aLen - 1)
          for (i = 1; i < aLen; i += 1) {
            args[i - 1] = arguments[i]
          }
          for (i = 0; i < eLen; i += 1) {
            ;(ev = evList[i]).callback.apply(ev.ctx, args)
          }
      }
    }

    return this
  }

  /**
     * @method on
     * @description 注册一个事件处理器
     * @param {String} eventType 事件类型（名称）
     * @param {Function} eventHandler 事件处理器
     * @param {Object} context 事件处理器的执行上下文
     * @return {DEvent} this
     */
  on(eventType, eventHandler, context) {
    if (typeof eventHandler !== 'function') throw new TypeError('listener must be a function')
    let events = this.__events__ || initEventObject(this)

    let eventListOfType = events[eventType]
    // 该事件类别不存在处理器，则当前是该类型第一个注册的事件，不需要保存在数组中
    if (!eventListOfType) {
      let inputEv = { callback: eventHandler, context: context, ctx: context || this }
      events[eventType] = inputEv
    }
    else if (Array.isArray(eventListOfType)) {
      // 已经是个数组了，则检查是否重复，不重复就push进去
      let eLen = eventListOfType.length
      while (eLen--) {
        let ev = eventListOfType[eLen]
        if (ev.context === context && ev.callback === eventHandler) {
          throw new Error('listener cannot be added more than once')
        }
      }
      let inputEv = { callback: eventHandler, context: context, ctx: context || this }
      eventListOfType.push(inputEv)
    }
    else {
      // 也不是一个数组，就是说当前传入的是第二个事件处理器。
      // 检查不重复的话，转成数组存放两个事件处理器
      let ev = eventListOfType
      if (ev.context === context && ev.callback === eventHandler) {
        throw new Error('listener cannot be added more than once')
      }
      let inputEv = { callback: eventHandler, context: context, ctx: context || this }
      events[eventType] = [ ev, inputEv ]
    }

    return this
  }

  /**
     * @method off
     * @description 移除事件处理器
     * 不传入参数，移除所有的事件处理器
     * 只传入evType，移除该evType下的所有事件处理器
     * 传入evType基础上，有传入fn或者context，则各需满足fn、context一样的情况才移除
     * @param {String} eventType 事件类型（名称）
     * @param {Function} eventHandler 事件处理器
     * @param {Object} context 事件处理器的上下文
     * @return this
     */
  off(eventType, eventHandler, context) {
    if (!this.__events__) return initEventObject(this)

    // 无参数，即清空所有事件
    if (!eventType && !eventHandler && !context) {
      return initEventObject(this)
    }

    let events = this.__events__
    let handler
    // handler 可能是数组，也可能已经是我们要的事件对象了
    if ((handler = events[eventType])) {
      // handler 是单独的一个事件处理器
      if (handler.callback) {
        // 只要满足一种不匹配的情况，就可以不用移除事件处理器
        if ((eventHandler && eventHandler !== handler.callback) || (context && context !== handler.context)) {
          return this
        }
        else {
          delete events[eventType]
        }
      }
      else if (Array.isArray(handler)) {
        // handler 是事件处理器数组的情况
        let len = handler.length
        let retain = (events[eventType] = [])

        for (let i = 0; i < len; i += 1) {
          let ev = handler[i]

          // 注意在 once 注册的事件中，
          // ev.callback 中存放的是中间函数，
          // ev.callback.callbackOnce 存放的才是事件处理器
          if (
            (eventHandler && eventHandler !== ev.callback && eventHandler !== ev.callback.callbackOnce) ||
            (context && context !== ev.context)
          ) {
            retain.push(ev)
          }
        }

        if (!retain.length) {
          delete events[eventType]
        }
      }
    }

    return this
  }

  once(eventType, eventHandler, context) {
    if (typeof eventHandler !== 'function') throw new TypeError('listener must be a function')

    let self = this
    let fired = false
    let ctx = context || this

    function g() {
      self.off(eventType, g)
      if (!fired) {
        fired = true
        eventHandler.apply(ctx, arguments)
      }
    }

    g.callbackOnce = eventHandler
    this.on(eventType, g)

    return this
  }
}

const pt = DEvent.prototype
pt.addListener = pt.on
pt.removeListener = pt.off
pt.emit = pt.trigger

module.exports = DEvent

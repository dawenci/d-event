'use strict'
;(function(factory) {
  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  const root =
    (typeof self == 'object' && self.self === self && self) ||
    (typeof global == 'object' && global.global === global && global)

  if (typeof define === 'function' && define.amd) {
    define([ 'exports' ], function(exports) {
      root.DEvents = factory(root, exports)
    })
  }
  else if (typeof exports !== 'undefined') {
    factory(root, exports)
  }
  else {
    root.DEvents = factory(root, {})
  }
})(function(root, DEvents) {
  /*************************************************/

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  const uniqueId = (() => {
    var idCounter = 0

    return function(prefix) {
      let id = ++idCounter + ''
      return prefix ? prefix + id : id
    }
  })()

  // Similar to ES6's rest param (http://ariya.ofilabs.com/2013/03/es6-and-rest-parameter.html)
  // This accumulates the arguments passed into an array, after a given index.
  const restArgs = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
        rest = Array(length),
        index = 0
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex]
      }
      switch (startIndex) {
        case 0:
          return func.call(this, rest)
        case 1:
          return func.call(this, arguments[0], rest)
        case 2:
          return func.call(this, arguments[0], arguments[1], rest)
      }
      var args = Array(startIndex + 1)
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index]
      }
      args[startIndex] = rest
      return func.apply(this, args)
    }
  }

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  const bind = restArgs(function(func, context, args) {
    if (typeof func !== 'function') throw new TypeError('Bind must be called on a function')
    let bound = restArgs(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs))
    })
    return bound
  })

  const shallowProperty = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key]
    }
  }
  const MAX_ARRAY_INDEX = Math.pow(2, 53) - 1
  const getLength = shallowProperty('length')
  const isArrayLike = function(collection) {
    var length = getLength(collection)
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX
  }
  const toString = Object.prototype.toString
  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  const isEmpty = function(obj) {
    if (obj == null) return true
    if (
      isArrayLike(obj) &&
      (Array.isArray(obj) || typeof obj === 'string' || toString.call(obj) === '[object Arguments]')
    )
      return obj.length === 0

    return Object.keys(obj).length === 0
  }

  // Is a given variable an object?
  const isObject = (obj) => {
    var type = typeof obj
    return type === 'function' || (type === 'object' && !!obj)
  }
  // An internal function for creating a new object that inherits from another.
  const baseCreate = function(prototype) {
    if (!isObject(prototype)) return {}
    if (Object.create) return Object.create(prototype)
    Ctor.prototype = prototype
    let result = new Ctor()
    Ctor.prototype = null
    return result
  }
  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  const executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args)
    var self = baseCreate(sourceFunc.prototype)
    var result = sourceFunc.apply(self, args)
    if (isObject(result)) return result
    return self
  }
  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  const partial = restArgs(function(func, boundArgs) {
    var placeholder = partial.placeholder
    var bound = function() {
      var position = 0,
        length = boundArgs.length
      var args = Array(length)
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i]
      }
      while (position < arguments.length) args.push(arguments[position++])
      return executeBound(func, bound, this, this, args)
    }
    return bound
  })

  partial.placeholder = null

  // Returns a function that will only be executed up to (but not including) the Nth call.
  const before = function(times, func) {
    let memo
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments)
      }
      if (times <= 1) func = null
      return memo
    }
  }

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  const once = partial(before, 2)

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // a custom event channel. You may bind a callback to an event with `on` or
  // remove with `off`; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  // var DEvents = {}

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/

  // A private global variable to share between listeners and listenees.
  var _listening

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  const eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0,
      names
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback
      for (names = Object.keys(name); i < names.length; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts)
      }
    }
    else if (name && eventSplitter.test(name)) {
      // Handle space-separated event names by delegating them individually.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts)
      }
    }
    else {
      // Finally, standard events.
      events = iteratee(events, name, callback, opts)
    }
    return events
  }

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  DEvents.on = function(name, callback, context) {
    this._events = eventsApi(onApi, this._events || {}, name, callback, {
      context: context,
      ctx: this,
      listening: _listening
    })

    if (_listening) {
      var listeners = this._listeners || (this._listeners = {})
      listeners[_listening.id] = _listening
      // Allow the listening to use a counter, instead of tracking
      // callbacks for library interop
      _listening.interop = false
    }

    return this
  }

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  DEvents.listenTo = function(obj, name, callback) {
    if (!obj) return this
    var id = obj._listenId || (obj._listenId = uniqueId('l'))
    var listeningTo = this._listeningTo || (this._listeningTo = {})
    var listening = (_listening = listeningTo[id])

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      this._listenId || (this._listenId = uniqueId('l'))
      listening = _listening = listeningTo[id] = new Listening(this, obj)
    }

    // Bind callbacks on obj.
    var error = tryCatchOn(obj, name, callback, this)
    _listening = void 0

    if (error) throw error
    // If the target obj is not Backbone.Events, track events manually.
    if (listening.interop) listening.on(name, callback)

    return this
  }

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = [])
      var context = options.context,
        ctx = options.ctx,
        listening = options.listening
      if (listening) listening.count++

      handlers.push({ callback: callback, context: context, ctx: context || ctx, listening: listening })
    }
    return events
  }

  // An try-catch guarded #on function, to prevent poisoning the global
  // `_listening` variable.
  var tryCatchOn = function(obj, name, callback, context) {
    try {
      obj.on(name, callback, context)
    } catch (e) {
      return e
    }
  }

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  DEvents.off = function(name, callback, context) {
    if (!this._events) return this
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    })

    return this
  }

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  DEvents.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo
    if (!listeningTo) return this

    var ids = obj ? [ obj._listenId ] : Object.keys(listeningTo)
    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]]

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break

      listening.obj.off(name, callback, this)
      if (listening.interop) listening.off(name, callback)
    }
    if (isEmpty(listeningTo)) this._listeningTo = void 0

    return this
  }

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    if (!events) return

    var context = options.context,
      listeners = options.listeners
    var i = 0,
      names

    // Delete all event listeners and "drop" events.
    if (!name && !context && !callback) {
      for (names = Object.keys(listeners); i < names.length; i++) {
        listeners[names[i]].cleanup()
      }
      return
    }

    names = name ? [ name ] : Object.keys(events)
    for (; i < names.length; i++) {
      name = names[i]
      var handlers = events[name]

      // Bail out if there are no events stored.
      if (!handlers) break

      // Find any remaining events.
      var remaining = []
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j]
        if (
          (callback && callback !== handler.callback && callback !== handler.callback._callback) ||
          (context && context !== handler.context)
        ) {
          remaining.push(handler)
        }
        else {
          var listening = handler.listening
          if (listening) listening.off(name, callback)
        }
      }

      // Replace events if there are any remaining.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining
      }
      else {
        delete events[name]
      }
    }

    return events
  }

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  DEvents.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, bind(this.off, this))
    if (typeof name === 'string' && context == null) callback = void 0
    return this.on(events, callback, context)
  }

  // Inversion-of-control versions of `once`.
  DEvents.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, bind(this.stopListening, this, obj))
    return this.listenTo(obj, events)
  }

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      let _once = (map[name] = once(function() {
        offer(name, _once)
        callback.apply(this, arguments)
      }))
      _once._callback = callback
    }
    return map
  }

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  DEvents.trigger = function(name) {
    if (!this._events) return this

    var length = Math.max(0, arguments.length - 1)
    var args = Array(length)
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1]

    eventsApi(triggerApi, this._events, name, void 0, args)
    return this
  }

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name]
      var allEvents = objEvents.all
      if (events && allEvents) allEvents = allEvents.slice()
      if (events) triggerEvents(events, args)
      if (allEvents) triggerEvents(allEvents, [ name ].concat(args))
    }
    return objEvents
  }

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev,
      i = -1,
      l = events.length,
      a1 = args[0],
      a2 = args[1],
      a3 = args[2]
    switch (args.length) {
      case 0:
        while (++i < l) (ev = events[i]).callback.call(ev.ctx)
        return
      case 1:
        while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1)
        return
      case 2:
        while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2)
        return
      case 3:
        while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3)
        return
      default:
        while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args)
        return
    }
  }

  // A listening class that tracks and cleans up memory bindings
  // when all callbacks have been offed.
  var Listening = function(listener, obj) {
    this.id = listener._listenId
    this.listener = listener
    this.obj = obj
    this.interop = true
    this.count = 0
    this._events = void 0
  }

  Listening.prototype.on = DEvents.on

  // Offs a callback (or several).
  // Uses an optimized counter if the listenee uses Backbone.Events.
  // Otherwise, falls back to manual tracking to support events
  // library interop.
  Listening.prototype.off = function(name, callback) {
    var cleanup
    if (this.interop) {
      this._events = eventsApi(offApi, this._events, name, callback, {
        context: void 0,
        listeners: void 0
      })
      cleanup = !this._events
    }
    else {
      this.count--
      cleanup = this.count === 0
    }
    if (cleanup) this.cleanup()
  }

  // Cleans up memory bindings between the listener and the listenee.
  Listening.prototype.cleanup = function() {
    delete this.listener._listeningTo[this.obj._listenId]
    if (!this.interop) delete this.obj._listeners[this.id]
  }

  // Aliases for backwards compatibility.
  DEvents.bind = DEvents.addListener = DEvents.on
  DEvents.unbind = DEvents.removeListener = DEvents.off
  DEvents.emit = DEvents.trigger

  return DEvents
})

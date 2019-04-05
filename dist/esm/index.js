var hasOwn = Object.prototype.hasOwnProperty;
var uniqueId = (function () {
    var id = 0;
    return function uniqueId(prefix) {
        return (prefix || '') + id++;
    };
})();
function isEmpty(obj) {
    if (obj == null)
        return true;
    for (var p in obj) {
        if (hasOwn.call(obj, p))
            return false;
    }
    return true;
}
// const func = bind(function(a,b, c,) {console.log(this.a, a, b, c)}, { a: 'avalue' }, 'a', null, 'c')
// func('已经填充', 'b', '已经填充') // => avalue a b c
var bindPlaceholder = null;
function bind(func, thisArg) {
    var partials = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        partials[_i - 2] = arguments[_i];
    }
    if (typeof func !== 'function') {
        throw new TypeError('Bind must be called on a function');
    }
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var len = partials.length;
        for (var i = 0; i < len; i += 1) {
            if (partials[i] !== bindPlaceholder)
                args[i] = partials[i];
        }
        return func.call.apply(func, [thisArg].concat(args));
    };
}
function once(func) {
    if (typeof func != 'function') {
        throw new TypeError('Expected a function');
    }
    var called = false;
    var memo;
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (called)
            return memo;
        called = true;
        return (memo = func.apply(void 0, args));
    };
}
/**
 * 映射 `{ event: callback }` 为 ` { event: onceWrapper } ` 的包裹形式
 * `offer` 用来在 `onceWrapper` 调用后解包
 *
 * @param {*} map
 * @param {*} name
 * @param {*} callback
 * @param {*} offer
 * @returns
 */
function onceMap(map, name, callback, offer) {
    if (!callback)
        return map;
    var _once = (map[name] = once(function () {
        offer(name, _once);
        callback.apply(this, arguments);
    }));
    _once._callback = callback;
    return map;
}
/**
 * 使用该 events 迭代器简化不同输入形式的事件的绑定、解绑、触发等等功能
 * iteratee api 迭代输入的事件，
 * 事件支持以下输入形式：
 * 1. `event, callback` （标准情况）
 * 2. `event1 event2, callback` （空格分割多个事件名称）
 * 3. `{ event: callback }` （jQuery-style 事件映射）
 *
 * @param {Function} iteratee 事件处理 api，例如 onApi, offApi, triggerApi 等等
 * @param {*} events 事件回调映射对象
 * @param {*} name 事件名称
 * @param {*} callback
 * @param {*} opts
 * @returns
 */
function iterateEvents(iteratee, events, name, callback, opts) {
    // 使用该正则分离用空格分割的多个事件名称
    var eventSplitter = /\s+/;
    var i = 0;
    var names;
    // 处理 jQuery 风格 event maps
    if (name && typeof name === 'object') {
        if (callback !== void 0 && 'context' in opts && opts.context === void 0) {
            opts.context = callback;
        }
        for (names = Object.keys(name); i < names.length; i++) {
            events = iterateEvents(iteratee, events, names[i], name[names[i]], opts);
        }
    }
    else if (name && eventSplitter.test(name)) {
        // 处理使用空格分割的事件
        for (names = name.split(eventSplitter); i < names.length; i++) {
            events = iteratee(events, names[i], callback, opts);
        }
    }
    else {
        // 处理简单的标准事件绑定方式
        events = iteratee(events, name, callback, opts);
    }
    return events;
}
// iterateEvents 的迭代函数
// 向 `events` 对象添加事件回调
function onIteratee(events, name, callback, options) {
    if (callback) {
        var handlers = events[name] || (events[name] = []);
        var context = options.context;
        var ctx = context || options.ctx;
        // 监听计数，用以判断是否清理内存
        var listening = options.listening;
        if (listening)
            listening.count += 1;
        handlers.push({ callback: callback, context: context, ctx: ctx, listening: listening });
    }
    return events;
}
// iterateEvents 的迭代函数
// 从 `events` 对象中移除事件回调
function offIteratee(events, name, callback, options) {
    if (!events)
        return;
    var context = options.context;
    var listeners = options.listeners;
    var i = 0;
    var names;
    // Delete all event listeners and "drop" events.
    if (!name && !context && !callback) {
        for (names = Object.keys(listeners); i < names.length; i++) {
            listeners[names[i]].cleanup();
        }
        return;
    }
    names = name ? [name] : Object.keys(events);
    for (; i < names.length; i++) {
        name = names[i];
        var handlers = events[name];
        // Bail out if there are no events stored.
        if (!handlers)
            break;
        // 查找是否还有剩余的事件
        var remaining = [];
        for (var j = 0; j < handlers.length; j++) {
            var handler = handlers[j];
            if ((callback && callback !== handler.callback && callback !== handler.callback._callback) ||
                (context && context !== handler.context)) {
                remaining.push(handler);
            }
            else {
                var listening = handler.listening;
                if (listening)
                    listening.off(name, callback);
            }
        }
        // 如果还有事件，则替换
        if (remaining.length) {
            events[name] = remaining;
        }
        else {
            // 否则做清理
            delete events[name];
        }
    }
    return events;
}
// iterateEvents 的迭代函数
// 触发符合要求的事件回调
function triggerIteratee(objEvents, name, callback, args) {
    if (objEvents) {
        var events = objEvents[name];
        var allEvents = objEvents.all;
        if (events && allEvents)
            allEvents = allEvents.slice();
        if (events)
            trigger(events, args);
        if (allEvents)
            trigger(allEvents, [name].concat(args));
    }
    return objEvents;
}
// 针对 3 个以内的参数进行优化
function trigger(events, args) {
    var count = events.length;
    var arg1 = args[0];
    var arg2 = args[1];
    var arg3 = args[2];
    var event;
    var i = -1;
    switch (args.length) {
        case 0:
            while (++i < count)
                (event = events[i]).callback.call(event.ctx);
            return;
        case 1:
            while (++i < count)
                (event = events[i]).callback.call(event.ctx, arg1);
            return;
        case 2:
            while (++i < count)
                (event = events[i]).callback.call(event.ctx, arg1, arg2);
            return;
        case 3:
            while (++i < count)
                (event = events[i]).callback.call(event.ctx, arg1, arg2, arg3);
            return;
        default:
            while (++i < count)
                (event = events[i]).callback.apply(event.ctx, args);
            return;
    }
}
// 私有全局变量，用来给 listeners 和 listenees 共享使用.
var _listening;
var Events = /** @class */ (function () {
    function Events() {
    }
    /**
     * 绑定事件
     *
     * @param {*} name 事件名称，传入 `'all'` 关键字会绑定所有触发
     * @param {*} callback
     * @param {*} context
     * @returns
     * @memberof Events
     */
    Events.prototype.on = function (name, callback, context) {
        // 使用 onIteratee 统一化绑定事件
        this.__events__ = iterateEvents(onIteratee, this.__events__ || {}, name, callback, {
            context: context,
            ctx: this,
            listening: _listening
        });
        if (_listening) {
            var listeners = this.__listeners__ || (this.__listeners__ = {});
            listeners[_listening.id] = _listening;
            // Allow the listening to use a counter,
            // instead of tracking callbacks for library interop
            _listening.interop = false;
        }
        return this;
    };
    /**
     * 移除一个或者多个事件处理器，参数越齐全，移除的范围越精准（小）
     * 1. 三个参数，移除 context 上的指定 name 的 callback 对应的事件
     * 2. 两个参数，如果 context 为 null，移除所有 callback 函数对应的事件
     * 3. 没有参数，如果 name 为 null，移除所有绑定的事件
     *
     * @param {*} name
     * @param {*} callback
     * @param {*} context
     * @returns
     * @memberof Events
     */
    Events.prototype.off = function (name, callback, context) {
        if (!this.__events__)
            return this;
        // 使用 offIteratee 统一、批量解除事件绑定
        this.__events__ = iterateEvents(offIteratee, this.__events__, name, callback, {
            context: context,
            listeners: this.__listeners__
        });
        return this;
    };
    // 激发事件
    Events.prototype.trigger = function (name) {
        var rest = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            rest[_i - 1] = arguments[_i];
        }
        if (!this.__events__)
            return this;
        // rest 参数列表
        // let length = Math.max(0, arguments.length - 1)
        // let args = Array(length)
        // for (let i = 0; i < length; i++) args[i] = arguments[i + 1]
        // iterateEvents(triggerIteratee, this.__events__, name, void 0, args)
        iterateEvents(triggerIteratee, this.__events__, name, void 0, rest);
        return this;
    };
    /**
     * `on` 的 IOC 版本，便于后续解绑
     *
     * @param {*} target 目标事件对象
     * @param {*} name 事件名称
     * @param {*} [callback] 事件处理器
     * @returns
     * @memberof Events
     */
    Events.prototype.listenTo = function (target, name, callback) {
        if (!target)
            return this;
        // 监听的目标的 ID
        var id = target.__listenId__ || (target.__listenId__ = uniqueId('l'));
        // 保存监听信息的对象，如果还不存在，则创建
        var listeningTo = this.__listeningTo__ || (this.__listeningTo__ = {});
        // 从记录对象里面查找是否对该目标对象有过监听
        // 若当前对象还未监听 `target` 上的其他事件，
        // 需要先设置引用追踪 listening callbacks
        var listening = (_listening = listeningTo[id]);
        if (!listening) {
            // 有可能从未监听过任何其他对象的事件，初始化自己的 ID
            if (!this.__listenId__) {
                this.__listenId__ = uniqueId('l');
            }
            // 初始化一个 Listening 对象，
            // 用来管理本对象对 target 对象的所有监听
            // 同时更新全局变量 `_listening`，后续尝试 `target.on` 时会用到
            listening = _listening = listeningTo[id] = new Listening(this, target);
        }
        // 尝试在 `target` 上绑定 callbacks
        // 使用 try-catch 避免污染全局共享用的 `_listening` 变量
        var error;
        try {
            // this 指向本对象
            target.on(name, callback, this);
        }
        catch (e) {
            error = e;
        }
        // 清理共享变量
        _listening = void 0;
        if (error)
            throw error;
        // 如果目标 `target` 不是 Events 的实例，
        // 使用 listening 手动追踪其 events
        if (listening.interop) {
            listening.on(name, callback);
        }
        return this;
    };
    // 停止监听指定事件或者所有监听的对象
    Events.prototype.stopListening = function (obj, name, callback) {
        var listeningTo = this.__listeningTo__;
        if (!listeningTo)
            return this;
        var ids = obj ? [obj.__listenId__] : Object.keys(listeningTo);
        for (var i = 0; i < ids.length; i++) {
            var listening = listeningTo[ids[i]];
            // 如果 listening 不存在，说明当前对象
            // 没有监听 `obj`，无需处理提前退出
            if (!listening)
                break;
            listening.target.off(name, callback, this);
            if (listening.interop) {
                listening.off(name, callback);
            }
        }
        if (isEmpty(listeningTo))
            this.__listeningTo__ = void 0;
        return this;
    };
    // 绑定一次性事件
    Events.prototype.once = function (name, callback, context) {
        // Map the event into a `{event: once}` object.
        var events = iterateEvents(onceMap, {}, name, callback, bind(this.off, this));
        if (typeof name === 'string' && (context === undefined || context === null)) {
            callback = void 0;
        }
        return this.on(events, callback, context);
    };
    // once 的 IOC 版本
    Events.prototype.listenToOnce = function (obj, name, callback) {
        // Map the event into a `{event: once}` object.
        var events = iterateEvents(onceMap, {}, name, callback, bind(this.stopListening, this, obj));
        return this.listenTo(obj, events);
    };
    return Events;
}());
export default Events;
// Listening 类，用来维护某个事件对另一个事件对象的所有监听
// 用于记录一个 Listening，追踪绑定、并在回调全部 offed 之后清理内存。
var Listening = /** @class */ (function () {
    function Listening(listener, target) {
        this.listener = listener;
        this.target = target;
        this.__events__ = void 0;
        this.interop = true;
        this.count = 0;
        this.listener = listener;
        this.target = target;
        this.id = listener.__listenId__;
    }
    // Offs a callback (or several).
    // Uses an optimized counter if the listenee uses Events.
    // Otherwise, falls back to manual tracking to support events
    // library interop.
    Listening.prototype.off = function (name, callback) {
        var shouldCleanup;
        // 对于 Events 实例的处理
        if (this.interop) {
            this.__events__ = iterateEvents(offIteratee, this.__events__, name, callback, {
                context: void 0,
                listeners: void 0
            });
            shouldCleanup = !this.__events__;
        }
        else {
            // 对于其他支持 event 的对象
            this.count--;
            shouldCleanup = this.count === 0;
        }
        if (shouldCleanup) {
            this.cleanup();
        }
    };
    /**
     * 在 listener 对 target 没有任何事件监听的时候，
     * 解除引用关系，以便内存回收
     *
     * @memberof Listening
     */
    Listening.prototype.cleanup = function () {
        // 解除 listener 对 target 的引用
        delete this.listener.__listeningTo__[this.target.__listenId__];
        // 对于其他支持 Events api 的非 Events 对象的处理
        if (!this.interop) {
            delete this.target.__listeners__[this.id];
        }
    };
    return Listening;
}());
Listening.prototype.on = Events.prototype.on;

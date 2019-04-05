export default class DEvent {
    private __events__?;
    private __listenId__?;
    private __listeners__?;
    private __listeningTo__?;
    /**
     * 绑定事件
     *
     * @param {*} name 事件名称，传入 `'all'` 关键字会绑定所有触发
     * @param {*} callback
     * @param {*} context
     * @returns
     * @memberof Events
     */
    on(name: any, callback: any, context?: any): this;
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
    off(name: any, callback: any, context?: any): this;
    trigger(name: any, ...rest: any[]): this;
    /**
     * `on` 的 IOC 版本，便于后续解绑
     *
     * @param {*} target 目标事件对象
     * @param {*} name 事件名称
     * @param {*} [callback] 事件处理器
     * @returns
     * @memberof Events
     */
    listenTo(target: any, name: any, callback?: any): this;
    stopListening(obj: any, name?: any, callback?: any): this;
    once(name: any, callback: any, context?: any): this;
    listenToOnce(obj: any, name: any, callback: any): this;
}

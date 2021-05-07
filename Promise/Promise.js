// 导出模块 IIFE
(function (window) {
    /**
     * excutor执行函数(同步)
     */
    const PENDING = 'pending'
    const RESOLVED = 'resolved'
    const REJECTED = 'rejected'

    function Promise(excutor) {
        const self = this;
        // 指定 promise的状态
        self.status = PENDING; // 给promise对象指定初始状态
        self.data = undefined; // 给promise对象指定一个用于存储结果的属性
        self.callbacks = [] // 每个元素的结果为{onResolve(){},onReject(){}}
        function resolve(value) {
            //    如果当前状态不是pending 直接返回
            if (self.status !== PENDING) {
                return
            }
            /**
             * 1.更改状态
             * 2.保存结果
             * 3.如果有待执行的callback,立即异步执行回调函数
             */
            self.status = RESOLVED
            self.data = value;
            if (self.callbacks.length > 0) {
                setTimeout(() => {
                    self.callbacks.forEach(callbacksObj => {
                        callbacksObj.onResolved(value)
                    })
                }, 0)
            }
        }

        function reject(reason) {
            if (self.status !== PENDING) {
                return
            }
            self.status = REJECTED;
            self.data = reason
            if (self.callbacks.length > 0) {
                setTimeout(() => {
                    self.callbacks.forEach(callbacksObj => {
                        callbacksObj.onRejected(reason)
                    })
                }, 0)
            }
        }
        // 如果抛出异常则直接调用失败的函数
        try {
            excutor(resolve, reject)
        } catch (error) {
            reject(error)
        }
    }

    /**
     * Promise原型对象的then
     * 指定一个成功或者失败的回调函数，返回一个新的promise
     */
    Promise.prototype.then = function (onResolved, onRejected) {
        const self = this;
        onResolved = typeof onResolved === 'function' ? onResolved : value => value
        // 异常传透的关键步骤
        onRejected = typeof onRejected === 'function' ? onRejected : reason => {
            throw reason
        }

        return new Promise((resolve, reject) => {
            // 调用指定的函数处理,根据执行的结果,改变return的promise状态
            function handle(callbacks) {
                /**
                 * 1.如果抛出异常，return的promise就会失败,reason就是error
                 * 2.如果回调函数返回的不是promise,return的promise就会成功,value就是返回值
                 * 3.如果回调函数返回的是promise,return的promise结果就是这个promise的结果
                 */
                try {
                    const result = callbacks(self.data)
                    if (result instanceof Promise) {
                        // 如果回调函数返回的是promise,return的promise结果就是这个promise的结果
                        result.then(
                            value => resolve(value), // 当result成功时,让return的promise也成功
                            reason => reject(reason)) // 当result失败时,让return的promise也失败
                        // result.then(resolve,reject)
                    } else {
                        // 2.如果回调函数返回的不是promise,return的promise就会成功,value就是返回值
                        resolve(result)
                    }
                } catch (error) {
                    reject(error)
                }
            }



            if (self.status === PENDING) {
                // 当前状态是pending状态，保存当前函数
                self.callbacks.push({
                    onResolved(value) {
                        handle(onResolved)
                    },
                    onRejected(reason) {
                        handle(onRejected)
                    }
                })
            } else if (self.status === RESOLVED) {
                // 如果当前是resolved状态,异步执行onResolved并改变return的promise状态
                setTimeout(() => {
                    handle(onResolved)
                })
            } else {
                // 如果当前是resolved状态,异步执行onResolved并改变return的promise状态
                setTimeout(() => {
                    handle(onRejected)

                })
            }
        })

    }
    /**
     * 原型对象的catch方法
     * 指定一个失败的回调函数，返回一个新的promise
     */
    Promise.prototype.catch = function (onRejected) {
        return this.then(undefined, onRejected)
    }

    /**
     * Promise函数对象的resolve方法
     * 返回一个指定的结果成功promise成功/失败
     * 如果是一般值,
     */
    Promise.resolve = function (value) {
        return new Promise((resolve, reject) => {
            // value 是否是promise
            if (value instanceof Promise) {
                value.then(resolve, reject)
            } else {
                //   不是promise
                resolve(value)
            }
        })
    }
    /**
     * Promise函数对象的reject方法
     * 返回一个指定reason结果失败的promise
     */
    Promise.reject = function (reason) {
        return new Promise((resolve, reject) => {
            reject(reason)
        })
    }
    /**
     * Promise函数对象的all方法
     * 返回一个promise,只有当所有promise都成功才成功,否则则失败
     */
    Promise.all = function (promises) {
        const values = new Array(promises.length);
        let resolveCount = 0
        return new Promise((resolve, reject) => {
            promises.forEach((p, index) => {
                Promise.resolve(p).then(value => {
                        resolveCount++
                        values[index] = value
                        if (resolveCount === promises.length) {
                            resolve(values)
                        }
                    },
                    reason => {
                        reject(reason)
                    })
            })
        })
    }
    /**
     * Promise函数对象的race方法
     * 返回一个promise,由第一个返回promise的结果决定
     */
    Promise.race = function (promises) {
        return new Promise((resolve, reject) => {
            promises.forEach((p, index) => {
                Promise.resolve(p).then(value => {
                        resolve(value)
                    },
                    reason => {
                        reject(reason)
                    })
            })
        })
    }
    // 暴露Promise
    window.Promise = Promise
})(window)
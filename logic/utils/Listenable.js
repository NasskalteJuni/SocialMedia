/**
 * @Mixin Listenable
 * @function
 * @param {Class} [superclass=Object] a class to mix/extend the given functions and properties into
 * A Mixin that enriches your class by event listening abilities.
 * Can be added by a declaration like `myClass extends Listenable(mySuperclass){ ... }` or `module.exports = Listenable(class myClass{ ... })`
 * Events can be triggered via `trigger` and be listened to via `on`
 * */
module.exports = (superclass= Object) => class Listenable extends superclass{

    constructor(...args){
        super(...args);
        this._listeners = {};
    }

    /**
     * register an event listener
     * @param {String} event an event to listen for
     * @param {Function} listener an event listener which is called for the given event
     * @returns {Listenable} this (allows call chaining)
     */
    on(event, listener){
        if(!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(listener);
        return this;
    }

    /**
     * register an event listener that is only triggered once (and is then removed)
     * @param {String} event an event to listen for
     * @param {Function} listener an event listener that is only called once for the given event
     * @returns {Listenable} this (allows call chaining)
     * */
    once(event, listener){
        listener.type = "once";
        this.on(event, listener);
        return this;
    }

    /**
     * unregister an event listener
     * @param {String} event the event for which the listener was registered for
     * @param {Function} listener the listener to unregister
     * @returns {Listenable} this (allows call chaining)
     * */
    off(event, listener){
        if(this._listeners[event] && listener){
            this._listeners[event] = this._listeners[event].filter(fn => fn.toString() !== listener.toString());
        }
        return this;
    }

    /**
     * unregister all event listeners (for the given event)
     * @param {String} [event] the event to unregister all listeners for. Omit this to unregister all listeners for all events.
     * @returns {Listenable} this (allows call chaining)
     * */
    allOff(event){
        Object.keys(this._listeners).filter(e => event === undefined || e === event).forEach(e => {
            this._listeners[e] = [];
        });
        return this;
    }

    /**
     * trigger an event
     * @param {String} event the event to trigger
     * @param {...*} [args] any number of arguments that shall be passed to the event listeners
     * @returns {Listenable} this (allows call chaining)
     * */
    trigger(event, ...args){
        if(this._listeners[event]) this._listeners[event].forEach((fn, index, listeners) => {
            fn(...args);

            if(fn.type === "once"){
                listeners.splice(index, 1);
            }
        });
    }
};
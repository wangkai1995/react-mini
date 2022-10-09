
import { Fiber } from '../rm-reconciler';
import { reactElementType } from '../share/type'

export type classComponentUpdater = {
    enqueueSetState:(inst, payload, callback)=>void,
    enqueueReplaceState:(inst, payload, callback)=>void,
    enqueueForceUpdate:(inst, callback)=>void,
}


export class Component {
    static isClassComponent = true;
    _reactFiber:Fiber = null;
    updater?:classComponentUpdater = null;
    state?:any
    props?:any
    refs?:any
    getSnapshotBeforeUpdate?:Function
    UNSAFE_componentWillMount?:Function
    componentWillMount?:Function
    componentDidMount?:Function
    UNSAFE_componentWillReceiveProps?:Function
    componentWillReceiveProps?:Function
    shouldComponentUpdate?:Function
    componentDidUpdate?:Function
    componentWillUpdate?:Function
    UNSAFE_componentWillUpdate?:Function
    componentWillUnmount?:Function
    componentDidCatch?:Function
    render:()=>reactElementType|null
    setState:(newState:any,callback?:Function)=>any = (newState,callbaclk)=>{
        return this.updater.enqueueSetState(this,newState,callbaclk)
    }
}


export class Suspense {
    static isSuspenseComponent = true;
}


import { 
    Fiber,FiberRoot,FiberTag,
    createWorkProcess as createCloneFiber,
    NotEffect,UpdateEffect,HookPassiveEffect,HookLayoutEffect
} from './Fiber'
import { 
    requestUpdateLane
} from './Lane'
import { mountEffectImp,updateEffectImp } from './hookEffect'
import { scheduleUpdateOnFiber } from './workLoop'
import { shallowEqual } from '../share/tool'

export type Hook = {
    memoizedState: any,
    baseState: any,
    baseQueue: HookUpdate | null,
    queue: HookUpdateQueue | null,
    next: Hook | null,
}
export type HookUpdate={
    action: any,
    eagerReducer: ((S, A) => any) | null,
    eagerState: any | null,
    next: HookUpdate,
}
export type HookUpdateQueue = {
    pending: HookUpdate | null,
    dispatch: ((any) => void) | null,
    lastRenderedReducer: ((S, A) => any) | null,
    lastRenderedState: any | null,
}



var currentlyRenderingFiber:Fiber
var currentHook:Hook
var workInProgressHook:Hook
var ReactCurrentDispatcher


export const useState = function(initState){
    try{
        return ReactCurrentDispatcher.useState(initState)
    }catch(e){
        console.error(e);
    }
}
export const useEffect = function(callback,dep){
    try{
        return ReactCurrentDispatcher.useEffect(callback,dep)
    }catch(e){
        console.error(e);
    }
}
export const useLayoutEffect = function(callback,dep){
    try{
        return ReactCurrentDispatcher.useLayoutEffect(callback,dep)
    }catch(e){
        console.error(e);
    }
}
export const renderWithHooks = function(current: Fiber | null,workInProgress: Fiber,Component: (props?:any) => any,props: any){
    currentlyRenderingFiber = workInProgress
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;
    ReactCurrentDispatcher = !current  || current.memoizedState === null || current.memoizedState === undefined
        ? HooksDispatcherOnMount
        : HooksDispatcherOnUpdate;
    //render
    let children = Component(props);
    //reset
    currentlyRenderingFiber = null;
    currentHook = null;
    workInProgressHook = null;
    ReactCurrentDispatcher  = defaultHook 
   return children
}


const mountWorkInProgressHook = function():Hook{
    var newHook = {
        memoizedState: null,
        baseState: null,
        baseQueue: null,
        queue:  null,
        next: null,
    }
    if(!workInProgressHook){
        currentlyRenderingFiber.memoizedState = workInProgressHook = newHook
    }else{
        workInProgressHook = workInProgressHook.next = newHook;
    }
    return workInProgressHook
}
const updateWorkInProgressHook = function():Hook{
    //这个函数要更新2个对象，一个是currentHook 一个是workInProgressHook
    //类似 currentFiber 和 alternate的关系
    let nextCurrentHook
    //当前的hoot currentFiber
    if(!currentHook){
        const current = currentlyRenderingFiber.alternate
        if(current){
            nextCurrentHook = current.memoizedState;
        }
    }else{
        nextCurrentHook = currentHook.next
    }
    //workInProgress节点的
    let nextWorkInProgressHook
    if(!workInProgressHook){
        nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
    }else{
        nextWorkInProgressHook = workInProgressHook.next;
    }

    //如果存在当前work
    if(nextWorkInProgressHook){
        workInProgressHook = nextWorkInProgressHook;
        nextWorkInProgressHook.next = workInProgressHook;

        currentHook = nextCurrentHook
    }else{
        currentHook = nextCurrentHook
        const newHook: Hook = {
            memoizedState: currentHook.memoizedState,
            baseState: currentHook.baseState,
            baseQueue: currentHook.baseQueue,
            queue: currentHook.queue,
            next: null,
        };
        if (workInProgressHook === null) {
            currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
        } else {
            workInProgressHook = workInProgressHook.next = newHook;
        }
    }
    return workInProgressHook
}


const mountState = function(initState){
    if( typeof initState === 'function'){
        initState = initState();
    }
    const hook = mountWorkInProgressHook();
    const queue = {
        pending:null,
        dispatch:null,
        lastRenderedReducer:(state,action)=>typeof action==='function'?action(state):action,
        lastRenderedState:initState
    }
    hook.baseState = initState
    hook.memoizedState = initState
    hook.queue = queue;
    queue.dispatch = dispatchAction.bind(null,currentlyRenderingFiber,queue)
    return [hook.memoizedState,queue.dispatch];
}
const updateState = function(initState){
    //合并pending 到BaseQueue，进行链式计算最新的state
    const hook = updateWorkInProgressHook();
    //合并计算
    let queue = hook.queue;
    let baseQueue = hook.baseQueue;
    let pending = queue.pending
    if(pending){
        if(baseQueue){
            let first = baseQueue.next 
            baseQueue.next = pending.next;
            pending.next = first;
        }else{
            baseQueue = pending;
        }
        queue.pending = null;
    }
    if(baseQueue){
        let first = baseQueue.next
        let update = first
        let newState = hook.baseState;
        //跳过update有时候用,目前暂时未使用
        let newLastbaseQueue = null;
        do{
            //这里还存在一个根据lane跳过更新的，先不处理
            if(update.eagerReducer === queue.lastRenderedReducer){
                newState = update.eagerState
            }else{
                newState = queue.lastRenderedReducer(newState,update.action);
            }
            update = update.next;
        }while(update && update !== first )

        hook.memoizedState = newState
        hook.baseState = newState
        hook.baseQueue = newLastbaseQueue;

        queue.lastRenderedReducer = (state,action)=>typeof action==='function'?action(state):action;
        queue.lastRenderedState = newState
    }
    const dispatch = queue.dispatch
    return [hook.memoizedState,dispatch]
}

const mountEffect = function(callback,dep){
    const hook = mountWorkInProgressHook();
    return mountEffectImp(
        currentlyRenderingFiber,
        hook,
        UpdateEffect | HookPassiveEffect,
        callback,
        dep
    )
}
const updateEffect = function(callback,dep){
    const hook = updateWorkInProgressHook();
    return updateEffectImp(
        currentlyRenderingFiber,
        hook,
        UpdateEffect | HookPassiveEffect,
        callback,
        dep
    )
}
const mountLayoutEffect = function(callback,dep){
    const hook = mountWorkInProgressHook();
    return mountEffectImp(
        currentlyRenderingFiber,
        hook,
        UpdateEffect | HookLayoutEffect,
        callback,
        dep
    )
}
const updateLayoutEffect = function(callback,dep){
    const hook = updateWorkInProgressHook();
    return updateEffectImp(
        currentlyRenderingFiber,
        hook,
        UpdateEffect | HookLayoutEffect,
        callback,
        dep
    )
}


const dispatchAction = function(fiber:Fiber,queue:HookUpdateQueue,action:any){
    const lane = requestUpdateLane(fiber)
    //这个函数需要计算出 HookUpdateQueue.pengding链。将更新内容链式的挂载在.pengding上
    let update:HookUpdate = {
        action,
        eagerReducer:null,
        eagerState:null,
        next:null,
    }
    let pending = queue.pending;
    if(pending){
        update.next = pending.next
        pending.next = update
    }else{
        update.next = update;
    }
    queue.pending = update;
    if(fiber.flag === NotEffect && (!fiber.alternate || fiber.alternate.flag === NotEffect)){
        const currentState = queue.lastRenderedState
        const eagerState = queue.lastRenderedReducer(queue.lastRenderedState,action)
        update.eagerReducer = queue.lastRenderedReducer;
        update.eagerState = eagerState;
        //判断2次是否相等，相等就不进行调度更新了
        if(shallowEqual(currentState,eagerState)){
            console.warn('相等的dispatch不进行调度更新')
            return 
        }
    }
    scheduleUpdateOnFiber(fiber,lane);
}



const HooksDispatcherOnMount = {
    useState:mountState,
    useEffect:mountEffect,
    useLayoutEffect:mountLayoutEffect,
}
const HooksDispatcherOnUpdate = {
    useState:updateState,
    useEffect:updateEffect,
    useLayoutEffect:updateLayoutEffect,
}
const defaultHook = {
    useState:()=>{throw new Error("不能在FunctionComponent之外调用hook")},
    useEffect:()=>{throw new Error("不能在FunctionComponent之外调用hook")},
    useLayoutEffect:()=>{throw new Error("不能在FunctionComponent之外调用hook")},
}



import { Fiber,FiberRoot,CallbackEffect, ShouldCaptureEffect, DidCaptureEffect } from './Fiber'
import { requestUpdateLane } from './Lane'
import { Component } from '../rm-core/classComponent'
import { scheduleUpdateOnFiber } from '../rm-reconciler/workLoop'




export const NoUpdatetContext = 0b000000;
export const RenderContext = 0b000001;
export const CommitContext = 0b000010;
export const SynUpdateContext = 0b000100;
export const BatchUpdateContext = 0b001000;
export const EventUpdateContext = 0b010000;

var UpdateContext = NoUpdatetContext;
export const getUpdateContext = function(){
    return UpdateContext
}
export const setUpdateContext = function(context){
    UpdateContext = context
}
export const synUpdates = function(callback:()=>void) {
    UpdateContext |= SynUpdateContext;
    try {
        callback();
    } catch (e) {
        UpdateContext  &= ~SynUpdateContext;
        console.log(e)
    } finally {
        UpdateContext  &= ~SynUpdateContext;
    }
};
export const batchUpdates = function(callback:()=>void){
    UpdateContext |= BatchUpdateContext;
    UpdateContext &= ~SynUpdateContext;
    try {
        callback();
    } catch (e) {
        UpdateContext  &= ~BatchUpdateContext;
        console.log(e)
    } finally{
        UpdateContext  &= ~BatchUpdateContext;
    }
}
export const updateContainer = function(fiberRoot:Fiber){
    const root = fiberRoot.stateNode as FiberRoot
    const fiber = root.current
    //fiber 根据优先级设置lane的优先级。设置相关的lane
    const lane = requestUpdateLane(fiber)
    //根据lane 创建update
    const update = createUpdateQueue(Date.now(),UpdateState,{
        element: root.element
    })
    //插入update更新链表
    enqueueUpdate(fiber,update)
    //进行调度
    scheduleUpdateOnFiber(fiber,lane)
}




var currentEventTime = Date.now();
//请求更新时间
export function requestEventTime() {
    //当前是挂载阶段
    if ((UpdateContext & (SynUpdateContext | CommitContext)) !== NoUpdatetContext) {
      return Date.now();
    }
    //如果当前没交互,进行合并
    if (UpdateContext !== NoUpdatetContext) {

      return currentEventTime;
    }
    currentEventTime =Date.now();
    return currentEventTime;
}



type tagType = 0|1|2|3
export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

type SharedQueue = {
    pending: Update| null,
};
export type UpdateQueue = { 
    baseState: any,
    firstBaseUpdate: Update | null,
    lastBaseUpdate: Update | null,
    shared: SharedQueue,
    effects: Array<Function> | null,
};
export class Update{
    eventTime:Number
    tag: tagType
    // lane相关的先不处理,后期实现
    // lane: Lane
    payload: any
    callback?: Function
    next?: Update
    firstUpdate?: Update
    lastUpdate?: Update
    constructor(eventTime:Number,tag:tagType,payload,callback?){
        this.eventTime = eventTime
        this.tag = tag
        this.payload = payload
        this.callback = callback
    }
}

var  hasForceUpdate = false;
//检查是否强制更新
export const checkHasForceUpdateAfterProcessing = function(){
    return hasForceUpdate
}
//恢复默认值
export const resetHasForceUpdateBeforeProcessing = function(){
    hasForceUpdate = false;
}

//创建根节点错误处理更新
export function createRootErrorUpdate(
    fiber: Fiber,
    errorInfo: Error,
  ): Update {
    const update = createUpdateQueue(Date.now(), CaptureUpdate,{
        element: null
    });
    //准备卸载hootRoot
    update.payload = {element: null};
    update.callback = () => {
      //打印错误信息
      console.error(errorInfo)
    };
    return update;
}
//创建class节点错误处理更新
export function createClassErrorUpdate( fiber: Fiber,errorInfo: Error){
    const getDerivedStateFromError = (fiber.type as any).getDerivedStateFromError;
    let payload = null
    if (typeof getDerivedStateFromError === 'function') {
        const error = errorInfo;
        payload = () => {
            //打印错误信息
            console.error('catch error:',errorInfo)
            return getDerivedStateFromError(error);
        };
    }
    const inst = fiber.stateNode as Component;
    let callback = null 
    if (inst && typeof inst.componentDidCatch === 'function') {
        callback = function callback() {
            if (typeof getDerivedStateFromError !== 'function') {
                console.error('catch error:',errorInfo)
            }
            const error = errorInfo;
            this.componentDidCatch(error, {
                componentStack:'',
                
            });
        }
    }
    const update = createUpdateQueue(Date.now(), CaptureUpdate,payload,callback);
    return update
}
//插入更新队列-错误更新
export function enqueueCapturedUpdate(  workProgress: Fiber,capturedUpdate: Update){
    let queue = workProgress.updateQueue as UpdateQueue
    const current = workProgress.alternate;
    if (current !== null) {
        //如果当前挂载的分支上存在更新队列，需要和错误做合并处理
        let newFirst = null;
        let newLast = null;
        let currentQueue = current.updateQueue as UpdateQueue
        if(queue === currentQueue){
            var firstBaseUpdate = currentQueue.firstBaseUpdate
            //当前的更新队列接上去
            if(firstBaseUpdate){
               let update = firstBaseUpdate
               do{
                    let clone = cloneUpdate(update);
                    if (newLast === null) {
                        newFirst = newLast = clone;
                    } else {
                        newLast.next = clone;
                        newLast = clone;
                    }
                    update = update.next;
               }while(update)
            }
            if (newLast === null) {
                newFirst = newLast = capturedUpdate;
            } else {
                newLast.next = capturedUpdate;
                newLast = capturedUpdate;
            }
        }else{
            newFirst = newLast = capturedUpdate;
        }
        queue = {
            baseState: currentQueue.baseState,
            firstBaseUpdate: newFirst,
            lastBaseUpdate: newLast,
            shared: currentQueue.shared,
            effects: currentQueue.effects,
        };
        workProgress.updateQueue = queue;
        return;
    }
    //不存在当前节点
    const lastBaseUpdate = queue.lastBaseUpdate;
    if (lastBaseUpdate === null) {
      queue.firstBaseUpdate = capturedUpdate;
    } else {
      lastBaseUpdate.next = capturedUpdate;
    }
    queue.lastBaseUpdate = capturedUpdate;
}


//初始化更新队列
export const initializeUpdateQueue = function(fiber:Fiber){
    const queue = {
        baseState: fiber.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: {
            pending: null,
        },
        effects: null,
    };
    fiber.updateQueue = queue;
}
//创建更新队列
export const createUpdateQueue = function(eventTime:Number,tag:tagType,payload,callback?):Update{
    var update = new Update(eventTime,tag,payload,callback)
    return update
}
//插入更新队列
export const enqueueUpdate =function(fiber:Fiber,update:Update){
    const updateQueue = fiber.updateQueue;
    const sharedQueue: SharedQueue = updateQueue.shared;
    const pending = sharedQueue.pending;
    if (pending === null) {
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    sharedQueue.pending = update;
}
//复制更新队列
export const cloneUpdateQueue = function(current:Fiber,workProcess:Fiber){
    const queue: UpdateQueue = (workProcess.updateQueue);
    const currentQueue: UpdateQueue = (current.updateQueue);
    //隔断引用联系
    if (queue === currentQueue) {
        const clone: UpdateQueue = {
            baseState: currentQueue.baseState,
            firstBaseUpdate: currentQueue.firstBaseUpdate,
            lastBaseUpdate: currentQueue.lastBaseUpdate,
            shared: currentQueue.shared,
            effects: currentQueue.effects,
        };
        workProcess.updateQueue = clone;
    }
}
export const cloneUpdate = function(originUpdate:Update){
    const clone: Update = {
        eventTime: originUpdate.eventTime,
        tag: originUpdate.tag,
        payload: originUpdate.payload,
        callback: originUpdate.callback,
        firstUpdate: originUpdate.firstUpdate,
        lastUpdate: originUpdate.lastUpdate,

        next: null
    };
    return clone
}
//处理更新队列
//根据lane跳过更新队列，暂时先不实现，后续处理lane的时候在实现
export const processUpdateQueue = function(workProcess:Fiber,nextProps:any,instance:any){
    const queue = workProcess.updateQueue;
    var baseState = queue.baseState
    var newBaseState = baseState
    var firstBaseUpdate = queue.firstBaseUpdate
    var lastBaseUpdate = queue.lastBaseUpdate
    const pedingQueue = queue.shared.pending
    //如果存在,等待处理中的任务,则需要拼接起来
    if(pedingQueue){
        queue.shared.pending = null;
        var newLastPedingUpdate = pedingQueue
        var newFirsPedingUpdate = newLastPedingUpdate.next
        if(!lastBaseUpdate){
            firstBaseUpdate = newFirsPedingUpdate
        }else{
            lastBaseUpdate.next = newFirsPedingUpdate
        }
        lastBaseUpdate = newLastPedingUpdate
    }
    //开始执行更新队列
    if(firstBaseUpdate){
        var update = firstBaseUpdate
        //链表尾添加终止条件
        lastBaseUpdate.next = null
        //从链表头向尾开始执行
        do{
            newBaseState = getStateFromUpdate(workProcess,update,newBaseState,nextProps,instance)
            //简化处理callback
            let callback = update.callback
            if(callback){
                workProcess.flag |= CallbackEffect;
                if(queue.effects){
                    queue.effects.push(callback)
                }else{
                    queue.effects = [callback]
                }
            }
            update = update.next
            if(!update){
                break;
            }
        }while(true)
        queue.baseState = newBaseState;
        queue.firstBaseUpdate = null;
        queue.lastBaseUpdate = null;
    }
    workProcess.memoizedState = queue.baseState
}
//执行合并更新
export const getStateFromUpdate = function(fiber:Fiber,update:Update,preState:any,nextProps:any,instance:any){
    let payload
    let comperterState
    switch(update.tag){
        //简化处理
        case CaptureUpdate:
            fiber.flag =(fiber.flag & ~ShouldCaptureEffect) | DidCaptureEffect;
        case UpdateState:
            payload = update.payload
            if(typeof payload === 'function'){
                comperterState = payload.call(instance,preState,nextProps)
                payload = comperterState?comperterState:preState
            }
            return Object.assign({},preState,payload)
        case ReplaceState:
            payload = update.payload
            if(typeof payload === 'function'){
                comperterState = payload.call(instance,preState,nextProps)
                return comperterState?comperterState:preState
            }
            return payload?payload:preState
        case ForceUpdate:
            hasForceUpdate = true;
            return payload?payload:preState
    }
}


